import { test, request } from '@playwright/test';

/**
 * §11-S7 verification: drop an equipment node in the Designer, save,
 * open the Monitor for the same flow, and confirm fp-embed.js receives
 * the paintStatus message and applies a non-default fillColor to the
 * cell representing that equipment.
 */

const API = 'https://api.fptest.com/api/v1';
const APP = 'https://fptest.com';

test('monitor canvas receives paintStatus updates', async ({ browser }) => {
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
  const r = await api.post(`${API}/admin/flow-designs`, { data: { name: `monitor-debug ${Date.now()}` } });
  const flowId = (await r.json()).id;
  console.log('created flow', flowId);

  // 1. Open Designer, drop an equipment, save.
  await page.goto(`${APP}/admin/flow-designs/${flowId}/edit`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => !!((document.querySelector('iframe') as HTMLIFrameElement | null)?.contentWindow as { __editorUi?: unknown } | null)?.__editorUi,
    { timeout: 30000 },
  );
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

  // Trigger Designer save → SVG export → PUT /:id/diagram.
  await page.locator('iframe').first().evaluate((el: HTMLIFrameElement) => {
    const ui = (el.contentWindow as unknown as {
      __editorUi?: { actions?: { get?: (n: string) => { funct?: () => void } | undefined } };
    }).__editorUi;
    ui?.actions?.get?.('save')?.funct?.();
  });
  await page.waitForTimeout(4000);

  // 2. Sanity: monitor-status API returns the equipment id we just dropped.
  const statusR = await api.get(`${API}/admin/flow-designs/${flowId}/monitor-status`);
  const status = await statusR.json();
  console.log('monitor-status rows', JSON.stringify(status).slice(0, 400));
  if (!Array.isArray(status) || status.length === 0) {
    console.log('--- relevant logs ---');
    msgs.forEach((m) => console.log('   ', m));
    throw new Error('monitor-status returned 0 rows; getMonitorStatus drawio parse may be broken');
  }
  const equipmentId = status[0].equipmentId as number;
  const runningStatus = status[0].runningStatus as string;
  console.log('expecting paint for equipment', equipmentId, 'status=', runningStatus);

  // 3. Open Monitor for the same flow.
  await page.goto(`${APP}/monitor/${flowId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => !!((document.querySelector('iframe') as HTMLIFrameElement | null)?.contentWindow as { __editorUi?: unknown } | null)?.__editorUi,
    { timeout: 30000 },
  );

  // Wait for paintStatus log inside the iframe + a cell to exist with our equipment-id.
  await page.waitForFunction(
    (eid) => {
      const fr = document.querySelector('iframe') as HTMLIFrameElement | null;
      const ui = (fr?.contentWindow as unknown as {
        __editorUi?: { editor?: { graph?: { model?: { cells?: Record<string, unknown> } } } };
      })?.__editorUi;
      const cells = ui?.editor?.graph?.model?.cells || {};
      for (const k of Object.keys(cells)) {
        const c = cells[k] as { value?: { getAttribute?: (n: string) => string | null } };
        const id = c?.value?.getAttribute?.('equipment-id');
        if (id === String(eid)) return true;
      }
      return false;
    },
    equipmentId,
    { timeout: 15000 },
  );
  console.log('cell present in monitor iframe');

  // Give paintStatus a moment to fire.
  await page.waitForTimeout(2000);

  // 4. Read the cell's style and verify the fillColor was overridden.
  const finalStyle: string = await page.locator('iframe').first().evaluate(
    (el: HTMLIFrameElement, eid: number) => {
      const ui = (el.contentWindow as unknown as {
        __editorUi?: { editor?: { graph?: { model?: { cells?: Record<string, unknown> } } } };
      }).__editorUi;
      const cells = ui?.editor?.graph?.model?.cells || {};
      for (const k of Object.keys(cells)) {
        const c = cells[k] as {
          value?: { getAttribute?: (n: string) => string | null };
          getStyle?: () => string;
        };
        const id = c?.value?.getAttribute?.('equipment-id');
        if (id === String(eid)) return c.getStyle?.() ?? '';
      }
      return '';
    },
    equipmentId,
  );
  console.log('cell final style:', finalStyle);

  // Default fill is #dae8fc; any of the status palette colours overrides it.
  const expectedColours = ['#d4edda', '#e9ecef', '#f8d7da', '#fff3cd', '#e2e3e5'];
  const overridden = expectedColours.some((c) => finalStyle.toLowerCase().includes(c.toLowerCase()));
  console.log('--- fp-embed logs in monitor frame ---');
  msgs.filter((m) => /fp-embed|paintStatus/i.test(m)).forEach((l) => console.log('   ', l));

  await page.screenshot({ path: 'tests/.tmp-monitor-debug.png', fullPage: false });

  if (!overridden) throw new Error(`paintStatus did not override fillColor. style="${finalStyle}"`);

  await api.delete(`${API}/admin/flow-designs/${flowId}`).catch(() => {});
});
