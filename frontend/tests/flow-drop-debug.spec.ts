import { test, request } from '@playwright/test';
import * as fs from 'fs';

const API = 'https://api.fptest.com/api/v1';
const APP = 'https://fptest.com';

test('drag equipment row onto drawio canvas and screenshot the result', async ({ browser }) => {
  // 1. Use the saved user2 session so we skip login.
  const ctx = await browser.newContext({
    storageState: 'tests/.auth/user.json',
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
  });
  const page = await ctx.newPage();

  // 2. Capture ALL events.
  const msgs: string[] = [];
  page.on('console', (m) => msgs.push(`[main]  ${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => msgs.push(`[error] ${e.message}`));
  page.on('requestfailed', (r) => msgs.push(`[reqfail] ${r.url()} ${r.failure()?.errorText ?? ''}`));
  page.on('frameattached', (frame) => {
    msgs.push(`[frameattached] ${frame.url()}`);
  });

  // 3. Create a fresh flow via API so we know the id and the canvas is empty.
  const api = await request.newContext({ ignoreHTTPSErrors: true });
  const login = await api.post(`${API}/auth/login`, {
    data: { email: 'user2@gmail.com', password: 'password123' },
  });
  console.log('login status', login.status());
  const r = await api.post(`${API}/admin/flow-designs`, {
    data: { name: `drop-debug ${Date.now()}` },
  });
  console.log('create flow status', r.status());
  const flowJson = await r.json();
  console.log('create flow body', JSON.stringify(flowJson).slice(0, 200));
  const flowId = flowJson.id;
  if (!flowId) throw new Error('Could not create flow: ' + JSON.stringify(flowJson));

  // 4. Open the Designer.
  const target = `${APP}/admin/flow-designs/${flowId}/edit`;
  console.log('navigating to', target);
  const response = await page.goto(target, { waitUntil: 'domcontentloaded' });
  console.log('nav response status', response?.status(), 'finalUrl', page.url());

  // Give Next time to hydrate.
  await page.waitForTimeout(4000);
  console.log('after 4s url', page.url(), 'title', await page.title());

  // Snapshot what the page actually contains right now.
  const bodyText = await page.locator('body').innerText().catch(() => '<no body>');
  console.log('--- BODY TEXT (first 400 chars) ---');
  console.log(bodyText.slice(0, 400));

  // Is there an iframe at all?
  const iframeCount = await page.locator('iframe').count();
  console.log('iframe count =', iframeCount);

  // Wait for it to mount, with a longer timeout.
  if (iframeCount === 0) {
    console.log('no iframe yet, waiting up to 25s for one to appear');
    try {
      await page.locator('iframe').first().waitFor({ state: 'attached', timeout: 25000 });
    } catch (err) {
      console.log('iframe never appeared:', (err as Error).message);
      console.log('--- FINAL BODY TEXT ---');
      console.log((await page.locator('body').innerText().catch(() => '')).slice(0, 1000));
      console.log('--- ALL EVENTS ---');
      msgs.forEach((m) => console.log('   ', m));
      await page.screenshot({ path: 'tests/.tmp-drop-debug-noiframe.png', fullPage: true });
      await api.delete(`${API}/admin/flow-designs/${flowId}`).catch(() => {});
      throw err;
    }
  }

  // 5. iframe present — wait for fp-embed.js to actually load inside it.
  const iframeEl = page.locator('iframe').first();
  console.log('iframe src =', await iframeEl.getAttribute('src'));

  // Wait until __editorUi exists inside the iframe.
  console.log('waiting for __editorUi inside iframe…');
  await page.waitForFunction(
    () => {
      const fr = (document.querySelector('iframe') as HTMLIFrameElement | null);
      return !!(fr && fr.contentWindow && (fr.contentWindow as any).__editorUi);
    },
    { timeout: 30000 },
  ).catch((e) => console.log('editorUi never appeared:', e.message));

  // Now also check fp-embed.js is in the script list.
  const scriptsInIframe = await iframeEl.evaluate((el: HTMLIFrameElement) => {
    return Array.from(el.contentDocument?.scripts ?? []).map((s) => s.src);
  }).catch((e) => { console.log('script enum failed:', e.message); return []; });
  console.log('--- iframe scripts (fp-embed/over-ride) ---');
  scriptsInIframe.filter((s) => /fp-embed|over-ride/.test(s)).forEach((s) => console.log('    ', s));

  // 6. Drag.
  const firstRow = page.locator('[draggable="true"]').first();
  await firstRow.waitFor({ state: 'visible', timeout: 10000 });
  const rowBox = await firstRow.boundingBox();
  const iframeBox = await iframeEl.boundingBox();
  console.log('rowBox', rowBox, 'iframeBox', iframeBox);
  if (!rowBox || !iframeBox) throw new Error('layout not ready');

  await page.mouse.move(rowBox.x + rowBox.width / 2, rowBox.y + rowBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(iframeBox.x + iframeBox.width / 2, iframeBox.y + iframeBox.height / 2, { steps: 12 });
  await page.mouse.up();

  await page.waitForTimeout(2500);

  fs.mkdirSync('tests', { recursive: true });
  await page.screenshot({ path: 'tests/.tmp-drop-debug.png', fullPage: false });

  console.log('--- ALL EVENTS ---');
  msgs.forEach((m) => console.log('   ', m));

  await api.delete(`${API}/admin/flow-designs/${flowId}`).catch(() => {});
});
