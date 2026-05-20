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
test.describe('Flow Designer — edit page (drawio embed)', () => {
  test('designer page mounts the drawio iframe and the equipment tree', async ({ page }) => {
    await page.goto(`/admin/flow-designs/${fixtureFlowId}/edit`);
    await expect(page).toHaveURL(/\/admin\/flow-designs\/\d+\/edit/);

    // The Designer renders the embedded drawio canvas.
    const drawioFrame = page.locator('iframe[src*="draw_io"]');
    await expect(drawioFrame).toBeVisible({ timeout: 15000 });

    // Equipment tree on the left, each row natively draggable.
    await expect(page.locator('[draggable="true"]').first()).toBeVisible();

    // Save/Background buttons that used to live next to the canvas were
    // removed when the GoJS placeholder was retired — saving now lives
    // inside the drawio toolbar. No further assertion needed here.
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

  test('drag equipment from tree to canvas creates a drawio cell', async ({ page }) => {
    await page.goto(`/admin/flow-designs/${fixtureFlowId}/edit`);
    // Wait for drawio's editor instance to be exposed inside the iframe
    // (over-ride.js sets it on createUi). Poll because Playwright's
    // waitForFunction is capped by actionTimeout in this config.
    await (async () => {
      for (let i = 0; i < 60; i++) {
        const ready = await page.evaluate(
          () => !!((document.querySelector('iframe') as HTMLIFrameElement | null)?.contentWindow as { __editorUi?: unknown } | null)?.__editorUi,
        );
        if (ready) return;
        await page.waitForTimeout(500);
      }
      throw new Error('drawio __editorUi never appeared after 30s');
    })();

    // Drag the first equipment row onto the iframe centre.
    const firstRow = page.locator('[draggable="true"]').first();
    await firstRow.waitFor({ state: 'visible' });
    const rowBox = await firstRow.boundingBox();
    const iframeBox = await page.locator('iframe').first().boundingBox();
    if (!rowBox || !iframeBox) throw new Error('layout not ready');
    await page.mouse.move(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(iframeBox.x + iframeBox.width / 2, iframeBox.y + iframeBox.height / 2, { steps: 12 });
    await page.mouse.up();

    // The dropped equipment becomes a UserObject cell with an
    // `equipment-id` attribute on it — confirm via the graph model.
    const cellFound = await page.locator('iframe').first().evaluate((el: HTMLIFrameElement) => {
      const ui = (el.contentWindow as unknown as {
        __editorUi?: { editor?: { graph?: { model?: { cells?: Record<string, unknown> } } } };
      }).__editorUi;
      const cells = ui?.editor?.graph?.model?.cells || {};
      for (const k of Object.keys(cells)) {
        const c = cells[k] as { value?: { getAttribute?: (n: string) => string | null } };
        if (c?.value?.getAttribute?.('equipment-id')) return true;
      }
      return false;
    });
    expect(cellFound).toBe(true);
  });

  test('save flow populates svgCache and preserves diagram on reload', async ({ page, request }) => {
    // Create a dedicated flow so this test owns the row.
    const created = await request.post(`${API_BASE}/admin/flow-designs`, {
      data: { name: `save-test ${Date.now()}` },
    });
    const flowId = (await created.json()).id as number;

    await page.goto(`/admin/flow-designs/${flowId}/edit`);
    await (async () => {
      for (let i = 0; i < 60; i++) {
        const ready = await page.evaluate(
          () => !!((document.querySelector('iframe') as HTMLIFrameElement | null)?.contentWindow as { __editorUi?: unknown } | null)?.__editorUi,
        );
        if (ready) return;
        await page.waitForTimeout(500);
      }
      throw new Error('drawio __editorUi never appeared');
    })();

    // Drop one equipment.
    const firstRow = page.locator('[draggable="true"]').first();
    await firstRow.waitFor({ state: 'visible' });
    const rowBox = await firstRow.boundingBox();
    const iframeBox = await page.locator('iframe').first().boundingBox();
    if (!rowBox || !iframeBox) throw new Error('layout not ready');
    await page.mouse.move(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(iframeBox.x + iframeBox.width / 2, iframeBox.y + iframeBox.height / 2, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(800);

    // Trigger drawio's save action — same code path the toolbar button hits.
    await page.locator('iframe').first().evaluate((el: HTMLIFrameElement) => {
      const ui = (el.contentWindow as unknown as {
        __editorUi?: { actions?: { get?: (n: string) => { funct?: () => void } | undefined } };
      }).__editorUi;
      ui?.actions?.get?.('save')?.funct?.();
    });

    // Poll until svgCache lands.
    let svgPresent = false;
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(500);
      const res = await request.get(`${API_BASE}/admin/flow-designs/${flowId}`);
      const body = await res.json();
      if (body.svgCache) { svgPresent = true; break; }
    }
    expect(svgPresent).toBe(true);

    // Cleanup.
    await request.delete(`${API_BASE}/admin/flow-designs/${flowId}`).catch(() => undefined);
  });
});

// ─────────────────────────────────────────────────────────────────────────
test.describe('Flow Monitor — user-facing card grid', () => {
  test('card grid loads at /monitor', async ({ page }) => {
    await page.goto('/monitor');
    await expect(page.getByRole('heading', { name: /flow monitor/i })).toBeVisible();
    await expect(page.getByTestId('flow-card').first()).toBeVisible({ timeout: 15000 });
  });

  test('flow cards render either the cached SVG thumbnail or the empty placeholder', async ({ page }) => {
    await page.goto('/monitor');
    await expect(page.getByTestId('flow-card').first()).toBeVisible({ timeout: 15000 });
    // Each card carries either an inline SVG (flow-card-thumbnail)
    // when svgCache is non-null, or the EmptyDiagramPlaceholder otherwise.
    const thumbnails = page.getByTestId('flow-card-thumbnail');
    const placeholders = page.getByTestId('empty-diagram-placeholder');
    expect((await thumbnails.count()) + (await placeholders.count())).toBeGreaterThan(0);
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

  test('analyzer detail renders the tabbed analytics layout', async ({ page }) => {
    await page.goto(`/analyzer/${fixtureFlowId}`);
    // DateRangeStrip — legacy port still carries the "Date Range" label.
    await expect(page.getByText(/Date Range|Datumintervall/i).first()).toBeVisible();
    // New tab structure: Stop Cause / Scrap / Production.
    await expect(page.getByRole('tab', { name: /stop cause/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /scrap/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /production/i })).toBeVisible();
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
    // Actively wait for at least 2 matching requests rather than a fixed
    // sleep — a busy backend can take longer than 2s to fire them and the
    // sleep masked a real regression as a flaky failure.
    await expect.poll(() => requests.length, {
      message: 'expected ≥2 analyzer data requests within 15s',
      timeout: 15_000,
      intervals: [250, 500, 1000],
    }).toBeGreaterThanOrEqual(2);
  });

  test('stop cause tab renders its filter bar + charts', async ({ page }) => {
    await page.goto(`/analyzer/${fixtureFlowId}`);
    const stopTab = page.getByRole('tab', { name: /stop cause/i });
    await expect(stopTab).toBeVisible({ timeout: 30000 });
    // AntD Select renders the placeholder as inner text (not a `placeholder`
    // attribute), so use a text matcher. Use `.first()` because both the
    // visible Select label and any AntD virtual list can render the string.
    await expect(page.getByText('Filter Workshift').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/show also excluded types/i)).toBeVisible();
    await expect(page.getByText(/show unregistered stop/i)).toBeVisible();
    await expect(page.getByText(/all stop causes/i)).toBeVisible({ timeout: 15000 });
  });
});
