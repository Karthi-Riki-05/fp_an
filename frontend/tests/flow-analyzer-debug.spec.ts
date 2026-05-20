import { test, expect, request } from '@playwright/test';

/**
 * §11-S8 verification: drop an equipment node in the Designer, save,
 * open the Analyzer for the same flow, click the rendered SVG cell,
 * and confirm:
 *   1. `data-equipment-id` decoration ran (cellId→equipmentId map applied),
 *   2. The Analyzer surfaces the "Filtered to equipment #N" chip,
 *   3. Clicking empty SVG canvas clears the filter.
 *
 * Note: Analyzer uses a STATIC SVG click map (decorated svgCache), not
 * a live drawio iframe — drawio's embed-mode createUi hook is unreliable
 * on the second iframe load. See decorateSvgWithEquipmentIds().
 */

const API = 'https://api.fptest.com/api/v1';
const APP = 'https://fptest.com';

test('analyzer cell click filters by equipment', async ({ browser }) => {
  const ctx = await browser.newContext({
    storageState: 'tests/.auth/user.json',
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();
  const msgs: string[] = [];
  page.on('console', (m) => msgs.push(`[main]  ${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => msgs.push(`[error] ${e.message}`));

  const api = await request.newContext({ ignoreHTTPSErrors: true });
  await api.post(`${API}/auth/login`, { data: { email: 'user2@gmail.com', password: 'password123' } });
  const r = await api.post(`${API}/admin/flow-designs`, { data: { name: `analyzer-debug ${Date.now()}` } });
  const flowId = (await r.json()).id;
  console.log('created flow', flowId);

  // 1. Designer: drop a node + save (so svgCache + flowData are populated).
  await page.goto(`${APP}/admin/flow-designs/${flowId}/edit`, { waitUntil: 'domcontentloaded' });
  await (async () => {
    for (let i = 0; i < 60; i++) {
      const ready = await page.evaluate(
        () => !!((document.querySelector('iframe') as HTMLIFrameElement | null)?.contentWindow as { __editorUi?: unknown } | null)?.__editorUi,
      );
      if (ready) return;
      await page.waitForTimeout(500);
    }
    throw new Error('Designer __editorUi never appeared after 30s');
  })();
  const firstRow = page.locator('[draggable="true"]').first();
  await firstRow.waitFor({ state: 'visible' });
  const draggableCount = await page.locator('[draggable="true"]').count();
  console.log('draggable rows on Designer page:', draggableCount);
  const rowBox = await firstRow.boundingBox();
  const iframeBox = await page.locator('iframe').first().boundingBox();
  if (!rowBox || !iframeBox) throw new Error('layout not ready');
  await page.mouse.move(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(iframeBox.x + iframeBox.width / 2, iframeBox.y + iframeBox.height / 2, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  // Pause briefly so init handshake settles before requesting save.
  await page.waitForTimeout(1500);
  const triggered = await page.locator('iframe').first().evaluate((el: HTMLIFrameElement) => {
    const ui = (el.contentWindow as unknown as {
      __editorUi?: { actions?: { get?: (n: string) => { funct?: () => void } | undefined } };
    }).__editorUi;
    const action = ui?.actions?.get?.('save');
    if (action?.funct) { action.funct(); return true; }
    return false;
  });
  console.log('save action triggered?', triggered);

  // Poll until svgCache lands in the DB (the save → SVG export → PUT
  // round-trip is async; give it up to 10 seconds).
  let apiBody: { svgCache?: string | null; flowData?: string | null } = {};
  for (let i = 0; i < 20; i++) {
    await page.waitForTimeout(500);
    const apiCheck = await api.get(`${API}/admin/flow-designs/${flowId}`);
    apiBody = await apiCheck.json();
    if (apiBody.svgCache) break;
  }
  console.log('flow record svgCache present?', !!apiBody.svgCache, 'flowData present?', !!apiBody.flowData);
  if (!apiBody.svgCache) {
    console.log('--- ALL CONSOLE EVENTS ---');
    msgs.slice(-40).forEach((m) => console.log('   ', m));
    throw new Error('svgCache not populated after save (10s)');
  }

  // 3. Analyzer: open detail page. Wait for the click-map div.
  await page.goto(`${APP}/analyzer/${flowId}`, { waitUntil: 'domcontentloaded' });
  const clickMap = page.locator('[data-testid="flow-diagram-click-map"]');
  await clickMap.waitFor({ state: 'visible', timeout: 15000 });

  // 3. Confirm decoration ran — at least one cell has data-equipment-id.
  const decoratedCount = await clickMap.locator('[data-equipment-id]').count();
  console.log('cells with data-equipment-id:', decoratedCount);
  if (decoratedCount === 0) {
    throw new Error('decorateSvgWithEquipmentIds did not inject any attributes');
  }

  // 4. Click the decorated cell.
  const cell = clickMap.locator('[data-equipment-id]').first();
  await cell.scrollIntoViewIfNeeded();
  await cell.click();

  // 5. Filter chip should appear.
  await expect(page.locator('text=Filtered to equipment')).toBeVisible({ timeout: 5000 });
  console.log('filter chip visible');

  await page.screenshot({ path: 'tests/.tmp-analyzer-debug.png', fullPage: false });

  // 6. Clicking empty canvas clears the filter.
  const mapBox = await clickMap.boundingBox();
  if (!mapBox) throw new Error('click-map missing');
  await page.mouse.click(mapBox.x + mapBox.width - 10, mapBox.y + mapBox.height - 10);
  await expect(page.locator('text=Filtered to equipment')).toHaveCount(0, { timeout: 3000 });
  console.log('empty-canvas click clears filter');

  await api.delete(`${API}/admin/flow-designs/${flowId}`).catch(() => {});
});
