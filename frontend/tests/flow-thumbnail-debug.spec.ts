import { test, request } from '@playwright/test';
import * as fs from 'fs';

/**
 * §11-S6 verification: drop an equipment node, trigger drawio's Save,
 * navigate to the Flow Analyzer landing grid, and confirm the FlowCard
 * for our flow now renders an inline <svg> instead of the empty
 * placeholder.
 *
 * This is the e2e proof that:
 *   - FlowDesignerEditor's save handler captures svg via the export
 *     postMessage round-trip,
 *   - the backend persists it to svg_cache,
 *   - listWithData returns svgCache,
 *   - FlowCard renders it.
 */

const API = 'https://api.fptest.com/api/v1';
const APP = 'https://fptest.com';

test('save in designer populates svgCache and FlowCard renders the SVG', async ({ browser }) => {
  const ctx = await browser.newContext({
    storageState: 'tests/.auth/user.json',
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();
  const msgs: string[] = [];
  page.on('console', (m) => msgs.push(`[main]  ${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => msgs.push(`[error] ${e.message}`));

  // Create a fresh flow.
  const api = await request.newContext({ ignoreHTTPSErrors: true });
  await api.post(`${API}/auth/login`, { data: { email: 'user2@gmail.com', password: 'password123' } });
  const r = await api.post(`${API}/admin/flow-designs`, { data: { name: `thumb-debug ${Date.now()}` } });
  const flowId = (await r.json()).id;
  console.log('created flow', flowId);

  // Open Designer.
  await page.goto(`${APP}/admin/flow-designs/${flowId}/edit`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => !!((document.querySelector('iframe') as HTMLIFrameElement | null)?.contentWindow as { __editorUi?: unknown } | null)?.__editorUi,
    { timeout: 30000 },
  );
  console.log('editor ready');

  // Drop one equipment node.
  const firstRow = page.locator('[draggable="true"]').first();
  await firstRow.waitFor({ state: 'visible' });
  const rowBox = await firstRow.boundingBox();
  const iframeBox = await page.locator('iframe').first().boundingBox();
  if (!rowBox || !iframeBox) throw new Error('layout not ready');
  await page.mouse.move(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(iframeBox.x + iframeBox.width / 2, iframeBox.y + iframeBox.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(1000);

  // Trigger drawio's internal save action — same code path the toolbar
  // Save button hits. drawio will then postMessage `{event:'save', xml}`
  // back to us, which our FlowDesignerEditor turns into an SVG export and
  // a PUT /:id/diagram with both fields.
  const iframeEl = page.locator('iframe').first();
  const triggered = await iframeEl.evaluate((el: HTMLIFrameElement) => {
    const ui = (el.contentWindow as unknown as {
      __editorUi?: { actions?: { get?: (name: string) => { funct?: () => void } | undefined } };
    }).__editorUi;
    const action = ui?.actions?.get?.('save');
    if (action?.funct) { action.funct(); return true; }
    return false;
  });
  console.log('save action triggered?', triggered);
  // Wait for the save → export → PUT round-trip (5s should be plenty).
  await page.waitForTimeout(5000);
  console.log('save round-trip complete');

  // Poll the API for svgCache to be set.
  let row: { svgCache?: string | null } = {};
  for (let i = 0; i < 6; i++) {
    const list = await api.get(`${API}/admin/flow-designs/list-with-data`);
    const rows: Array<{ id: number; svgCache?: string | null }> = await list.json();
    const found = rows.find((x) => x.id === flowId);
    if (found?.svgCache) { row = found; break; }
    await page.waitForTimeout(500);
  }
  console.log('svgCache present?', !!row.svgCache, 'length=', row.svgCache?.length ?? 0);
  if (!row.svgCache) {
    console.log('--- relevant logs ---');
    msgs.filter((m) => /fp-embed|insertNode|export|save/i.test(m)).forEach((l) => console.log('   ', l));
    throw new Error('svgCache was not populated after save');
  }

  // Now load the analyzer landing grid and find the card by flow id /
  // name, then assert it carries the rendered SVG (flow-card-thumbnail)
  // and not the empty placeholder.
  await page.goto(`${APP}/analyzer`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const flowName = (row as { name?: string }).name;
  if (!flowName) throw new Error('flow row missing name');
  const card = page.locator('[data-testid="flow-card"]', { hasText: flowName }).first();
  await card.scrollIntoViewIfNeeded();
  const hasThumbnail = await card.locator('[data-testid="flow-card-thumbnail"]').count();
  const hasPlaceholder = await card.locator('[data-testid="empty-diagram-placeholder"]').count();
  console.log('card has thumbnail?', hasThumbnail, 'placeholder?', hasPlaceholder);
  await card.screenshot({ path: 'tests/.tmp-thumbnail-debug.png' });
  if (hasThumbnail === 0) throw new Error('FlowCard did not render the cached SVG');

  // Cleanup
  await api.delete(`${API}/admin/flow-designs/${flowId}`).catch(() => {});
});
