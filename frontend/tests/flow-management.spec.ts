import { APIRequestContext, expect, test } from '@playwright/test';
import {
  API_BASE,
  apiContextFor,
  createFlow,
  deleteFlow,
  getFlowList,
  waitForFlowListLoaded,
} from './helpers/flow';

/**
 * Plan A — Flow Management E2E tests.
 * Storage state is user.json (user2@gmail.com / Company role). user2 holds
 * both manage-flow-designs AND the view-* permissions after the Step 2
 * pre-check re-seed, so they can drive every page in this module.
 * Per-permission validation (User-role caller can read but not write) is
 * covered by the backend curl smoke in commit dd4873e / 59f4505.
 */

// Module-scoped fixture: a fresh flow per file, deleted at the end.
// Avoids depending on whatever happens to be in the tenant when tests run.
let api: APIRequestContext;
let fixtureFlowId: number;
const FIXTURE_NAME = `Playwright Fixture Flow ${Date.now()}`;

test.beforeAll(async () => {
  api = await apiContextFor('user2@gmail.com', 'password123');
  fixtureFlowId = await createFlow(api, FIXTURE_NAME);
});

test.afterAll(async () => {
  if (fixtureFlowId) await deleteFlow(api, fixtureFlowId);
});

// ─────────────────────────────────────────────────────────────────────────
test.describe('Flow Designs — admin list page', () => {
  test('list page loads and shows the fixture flow', async ({ page }) => {
    await page.goto('/admin/flow-designs');
    await expect(page.getByRole('heading', { name: /flow design/i }).first()).toBeVisible();
    await waitForFlowListLoaded(page);
    await expect(page.getByText(FIXTURE_NAME)).toBeVisible();
  });

  test('add flow design creates a new row', async ({ page }) => {
    const uniqueName = `Playwright Add Test ${Date.now()}`;
    await page.goto('/admin/flow-designs');
    await waitForFlowListLoaded(page);

    await page.getByRole('button', { name: /add flow design/i }).click();
    // Wait for the modal Name field to be visible before typing.
    const nameField = page.locator('.ant-modal input').first();
    await nameField.waitFor({ state: 'visible' });
    await nameField.fill(uniqueName);
    // The modal's primary OK button.
    await page.locator('.ant-modal .ant-modal-footer .ant-btn-primary').click();

    await expect(page.getByText(uniqueName)).toBeVisible();

    // Cleanup so subsequent test runs don't accumulate rows.
    const flows = await getFlowList(api);
    const created = flows.find((f) => f.name === uniqueName);
    if (created) await deleteFlow(api, created.id);
  });

  test('delete flow removes it from the list', async ({ page }) => {
    const tempName = `Playwright Delete Test ${Date.now()}`;
    const tempId = await createFlow(api, tempName);
    await page.goto('/admin/flow-designs');
    await waitForFlowListLoaded(page);

    const row = page.locator('tr', { hasText: tempName });
    await expect(row).toBeVisible();
    // Delete icon = the danger-styled action button inside this row.
    await row.locator('button.ant-btn-dangerous, button:has([aria-label*="delete"]), button:has(.anticon-delete)').last().click();
    // Popconfirm OK button (or Ant Modal confirm — both appear via portal).
    await page.locator('.ant-popover-buttons .ant-btn-primary, .ant-popconfirm-buttons .ant-btn-primary').first().click();

    await expect(page.getByText(tempName)).toHaveCount(0);
    // Safety net — make sure the soft-delete actually persisted.
    const remaining = await getFlowList(api);
    expect(remaining.find((f) => f.id === tempId)).toBeFalsy();
  });
});

// ─────────────────────────────────────────────────────────────────────────
test.describe('Flow Designer — edit page (Plan A — GoJS placeholder)', () => {
  test('designer page loads with the GoJS license placeholder', async ({ page }) => {
    await page.goto(`/admin/flow-designs/${fixtureFlowId}/edit`);
    await expect(page).toHaveURL(/\/admin\/flow-designs\/\d+\/edit/);

    // Placeholder is rendered (data-testid set on the component root).
    await expect(page.getByTestId('gojs-placeholder').first()).toBeVisible();
    await expect(page.getByText(/GoJS license required|Flow diagrams require a GoJS license/i).first())
      .toBeVisible();

    // Save button is disabled (no license). Use a CSS selector for the
    // visible Save button — the role-based query missed because AntD
    // tooltip-wrapped buttons render inside an extra <span>.
    const saveBtn = page.locator('button', { hasText: /^Save$/ }).first();
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toBeDisabled();
    const bgBtn = page.locator('button', { hasText: /Background/i }).first();
    await expect(bgBtn).toBeDisabled();
  });

  test('flow name is inline-editable and persists on reload', async ({ page }) => {
    const newName = `Renamed ${Date.now()}`;
    await page.goto(`/admin/flow-designs/${fixtureFlowId}/edit`);

    const nameInput = page.locator('input[placeholder="Flow name"]').first();
    await nameInput.waitFor({ state: 'visible' });
    await nameInput.fill(newName);

    // Watch for the PATCH request fired on blur.
    const patchPromise = page.waitForResponse(
      (r) => r.url().includes(`/flow-designs/${fixtureFlowId}`)
        && r.request().method() === 'PATCH'
        && r.status() === 200,
    );
    await nameInput.blur();
    await patchPromise;

    // Reload — the new name persists.
    await page.reload();
    await expect(page.locator('input[placeholder="Flow name"]')).toHaveValue(newName);
  });

  // ── TODO Plan B (requires NEXT_PUBLIC_GOJS_LICENSE_KEY) ──────────────────
  test.skip('drag equipment from tree to canvas creates a node', async () => {
    // Wired in Plan B once gojs + gojs-react are installed and the
    // FlowDesignerCanvas component replaces the placeholder.
  });
  test.skip('save flow preserves diagram on reload', async () => {
    // Plan B: type-in some nodes via palette, save, reload, see them.
  });
  test.skip('background image upload appears on canvas', async () => {
    // Plan B: upload a PNG via the Background button, see it behind nodes.
  });
});

// ─────────────────────────────────────────────────────────────────────────
test.describe('Flow Monitor — user-facing card grid', () => {
  test('card grid loads at /monitor', async ({ page }) => {
    await page.goto('/monitor');
    await expect(page.getByRole('heading', { name: /flow monitor/i })).toBeVisible();
    await expect(page.getByTestId('flow-card').first()).toBeVisible({ timeout: 15000 });
  });

  test('GoJS placeholder appears in each card thumbnail', async ({ page }) => {
    await page.goto('/monitor');
    await expect(page.getByTestId('flow-card').first()).toBeVisible({ timeout: 15000 });
    // Every card renders a compact GoJsLicensePlaceholder inside it.
    const placeholders = page.getByTestId('gojs-placeholder');
    expect(await placeholders.count()).toBeGreaterThan(0);
  });

  test('grid / list toggle switches layout', async ({ page }) => {
    await page.goto('/monitor');
    await expect(page.getByTestId('flow-card').first()).toBeVisible({ timeout: 15000 });

    // No table yet — we're in grid mode.
    await expect(page.locator('table')).toHaveCount(0);
    // Switch to list view.
    await page.getByRole('button', { name: /list view/i }).click();
    await expect(page.locator('table')).toBeVisible();
  });

  test('clicking a flow card navigates to /monitor/<id>', async ({ page }) => {
    await page.goto('/monitor');
    const firstCard = page.getByTestId('flow-card').first();
    await expect(firstCard).toBeVisible({ timeout: 15000 });
    await firstCard.click();
    await expect(page).toHaveURL(/\/monitor\/\d+/);
  });

  test.slow();
  test('monitor-status polling fires a second request after ~10s', async ({ page }) => {
    // Direct-navigate to the fixture flow detail so we know an id exists.
    const requests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('monitor-status')) requests.push(req.url());
    });

    await page.goto(`/monitor/${fixtureFlowId}`);
    // Wait long enough for two poll cycles (interval is 10s).
    await page.waitForTimeout(12_000);
    expect(requests.length).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────
test.describe('Flow Analyzer — admin card grid + detail', () => {
  test('card grid loads at /analyzer', async ({ page }) => {
    await page.goto('/analyzer');
    await expect(page.getByRole('heading', { name: /flow analyzer/i })).toBeVisible();
    await expect(page.getByTestId('flow-card').first()).toBeVisible({ timeout: 15000 });
  });

  test('analyzer detail shows HighCharts panels (even when empty)', async ({ page }) => {
    await page.goto(`/analyzer/${fixtureFlowId}`);
    // DateRangeStrip — labelled "Datumintervall" in the existing component.
    await expect(page.getByText(/Datumintervall|Date|today/i).first()).toBeVisible();
    // Recent stops / scraps sections render (either table or empty state).
    await expect(page.getByText(/recent stop/i)).toBeVisible();
    await expect(page.getByText(/recent scrap/i)).toBeVisible();
  });

  test('analyzer detail makes line-chart + quant-time requests', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (req) => {
      const u = req.url();
      if (u.includes('line-chart') || u.includes('quant-time') || u.includes('analyzer-data')) {
        requests.push(u);
      }
    });
    await page.goto(`/analyzer/${fixtureFlowId}`);
    // Give the queries time to fire.
    await page.waitForTimeout(2_000);
    expect(requests.length).toBeGreaterThanOrEqual(2);
  });

  test('recent stops card renders (empty-state or table)', async ({ page }) => {
    await page.goto(`/analyzer/${fixtureFlowId}`);
    // Scope strictly to the "Recent stops" Card. Anything inside it counts
    // as success: either an empty Empty component or a table.
    const stopsCard = page.locator('.ant-card', { hasText: 'Recent stops' });
    await expect(stopsCard).toBeVisible({ timeout: 15000 });
    const empty = stopsCard.locator('.ant-empty');
    const table = stopsCard.locator('table');
    // Wait until either renders (whichever fires first).
    await Promise.race([
      empty.first().waitFor({ state: 'visible', timeout: 15000 }),
      table.first().waitFor({ state: 'visible', timeout: 15000 }),
    ]);
  });
});
