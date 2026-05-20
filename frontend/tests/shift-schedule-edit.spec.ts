/**
 * Verifies the two regressions the operator reported on the shift-schedule
 * edit page (/admin/shift-schedules/:id/edit):
 *   1. Events can be dragged to move them.
 *   2. Clicking an event shows a floating menu with Edit + Remove, and
 *      clicking Edit opens the modal pre-filled with the event values.
 *
 * Logs in as user2 (Company role, tenant_2) — that tenant already has
 * a couple of seeded events on schedule_id 2/3. We create our own fresh
 * non-recurring event on schedule_id 4 ("Standard Week") so the test
 * doesn't rely on existing rows.
 */

import { test, expect, type Page, request as pwRequest, type APIRequestContext } from '@playwright/test';

const SCHEDULE_ID = 4;
const PAGE_URL = `https://fptest.com/admin/shift-schedules/${SCHEDULE_ID}/edit`;

async function apiContext(page: Page): Promise<APIRequestContext> {
  // Reuse the cookie-jar from the browser context so the API sees the
  // same access_token the page is using.
  const cookies = await page.context().cookies('https://api.fptest.com');
  const token = cookies.find((c) => c.name === 'access_token')?.value;
  return pwRequest.newContext({
    baseURL: 'https://api.fptest.com',
    ignoreHTTPSErrors: true,
    extraHTTPHeaders: token ? { Cookie: `access_token=${token}` } : {},
  });
}

async function cleanupSchedule(api: APIRequestContext) {
  // Drop any non-recurring events left over from prior runs so the
  // drag-target is unambiguous.
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth() - 2, 1).toISOString().slice(0, 10);
  const to = new Date(today.getFullYear(), today.getMonth() + 3, 0).toISOString().slice(0, 10);
  const res = await api.get(`/api/v1/admin/shift-schedules/${SCHEDULE_ID}/events`, {
    params: { start: from, end: to },
  });
  if (!res.ok()) return;
  const list = (await res.json()) as Array<{ id: number | string; isRecurring?: boolean; parentId?: number }>;
  const ids = new Set<number>();
  for (const ev of list) {
    if (ev.isRecurring) continue;
    const n = Number(typeof ev.id === 'string' ? ev.id.split('-')[0] : ev.id);
    if (Number.isFinite(n)) ids.add(n);
  }
  for (const id of ids) {
    await api.delete(`/api/v1/admin/shift-schedules/${SCHEDULE_ID}/events/${id}`).catch(() => {});
  }
}

async function createEventViaApi(api: APIRequestContext, title: string, startISO: string, endISO: string) {
  const res = await api.post(`/api/v1/admin/shift-schedules/${SCHEDULE_ID}/events`, {
    data: {
      title,
      start: startISO,
      end: endISO,
      isRecurring: false,
      textColor: '#ffffff',
      backgroundColor: '#3788d8',
      rcData: null,
    },
  });
  expect(res.ok(), `Create event failed: ${res.status()}`).toBeTruthy();
  return res.json();
}

async function waitForCalendar(page: Page) {
  // FullCalendar renders the .fc-view-harness once events have loaded.
  await page.locator('.fc-view-harness').waitFor({ timeout: 15000 });
  // Make sure we're in timeGridWeek (so drag works on time slots).
  await page.locator('.fc-timeGridWeek-button').click();
  await page.locator('.fc-timegrid').waitFor({ timeout: 5000 });
}

async function createEvent(page: Page, name: string) {
  // Drag-select two adjacent half-hour slots in the timegrid to open the
  // create modal. The slot grid lanes live inside .fc-timegrid-slot.
  const slot = page.locator('.fc-timegrid-slot[data-time]').first();
  await expect(slot).toBeVisible();
  const box = await slot.boundingBox();
  if (!box) throw new Error('No timegrid slot found');

  // Click+drag across two slot heights to make a selectable range.
  const startX = box.x + 200;
  const startY = box.y + 4;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX, startY + box.height * 2, { steps: 12 });
  await page.mouse.up();

  // Modal should open. Fill Name and Save.
  const modal = page.locator('.ant-modal-content', { hasText: 'Add production time' });
  await expect(modal).toBeVisible({ timeout: 8000 });
  await modal.locator('input[id$="title"]').fill(name);
  await modal.getByRole('button', { name: 'Save' }).click();
  await expect(modal).toBeHidden({ timeout: 8000 });
  // The new event renders inside .fc-event with the given title.
  await page.locator('.fc-event', { hasText: name }).first().waitFor({ timeout: 8000 });
}

test.describe('Shift Schedule edit — drag + edit popover', () => {
  test.use({ storageState: 'tests/.auth/user.json' });

  test('event can be created, the click menu shows Edit + Remove, and Edit opens the modal', async ({ page }) => {
    const name = `e2e-${Date.now().toString(36)}`;
    await page.goto(PAGE_URL);
    await waitForCalendar(page);
    await createEvent(page, name);

    // Click the created event → floating menu should appear.
    const event = page.locator('.fc-event', { hasText: name }).first();
    await event.click();

    const menu = page.locator('[data-event-menu]');
    await expect(menu, 'event click should show the floating menu').toBeVisible({ timeout: 5000 });
    await expect(menu.getByRole('button', { name: 'Edit' })).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Remove' })).toBeVisible();

    // Click Edit → modal should reopen with the title field populated.
    await menu.getByRole('button', { name: 'Edit' }).click();
    const editModal = page.locator('.ant-modal-content', { hasText: 'Edit production time' });
    await expect(editModal, 'Edit click should open the modal').toBeVisible({ timeout: 5000 });

    const titleInput = editModal.locator('input[id$="title"]');
    await expect(titleInput).toHaveValue(name);

    // Cancel cleanly.
    await editModal.getByRole('button', { name: 'Cancel' }).click();
    await expect(editModal).toBeHidden();
  });

  test('event can be dragged to a new slot (PATCH /events/:id called)', async ({ page }) => {
    // Start from a clean slate so we know exactly which .fc-event we're
    // grabbing and so its bounding box is the full slot width.
    await page.goto(PAGE_URL);
    const api = await apiContext(page);
    await cleanupSchedule(api);

    const name = `drag-${Date.now().toString(36)}`;
    // Anchor the event at noon Monday so it has a tall vertical box
    // (12:00 → 13:00 = one full timegrid slot).
    const monday = (() => {
      const d = new Date();
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day; // ISO Monday
      d.setDate(d.getDate() + diff);
      d.setHours(12, 0, 0, 0);
      return d;
    })();
    const endAt = new Date(monday.getTime() + 60 * 60 * 1000);
    await createEventViaApi(
      api,
      name,
      monday.toISOString().slice(0, 19),
      endAt.toISOString().slice(0, 19),
    );

    // Reload so the calendar picks up the API-created event.
    await page.reload();
    await waitForCalendar(page);
    const event = page.locator('.fc-event', { hasText: name }).first();
    await expect(event).toBeVisible({ timeout: 8000 });

    // Capture the network PATCH the drag should fire.
    const patchPromise = page.waitForRequest(
      (req) => /\/events\/\d+/.test(req.url()) && req.method() === 'PATCH',
      { timeout: 10000 },
    );

    await event.scrollIntoViewIfNeeded();
    await event.hover({ position: { x: 30, y: 8 } });
    const before = await event.boundingBox();
    if (!before) throw new Error('Event has no bounding box');

    // FC's drag handler needs:
    //   1. mousedown over the event body (NOT the bottom resize handle)
    //   2. a movement above ~5px threshold to begin the drag
    //   3. a release over the target slot
    // Use a generous initial jiggle and many small steps so FC's
    // pointer-mover sees enough events. Grab the TOP portion of the
    // event (well clear of the bottom resize handle).
    const gripX = before.x + before.width / 2;
    const gripY = before.y + 8;
    await page.mouse.move(gripX, gripY);
    await page.mouse.down();
    // Stay still a moment so the long-press / drag-start can latch.
    await page.waitForTimeout(120);
    // Big jiggle to break the click threshold.
    await page.mouse.move(gripX, gripY + 20, { steps: 8 });
    await page.waitForTimeout(60);
    // Now actually move to the target — 4 hours down in timeGridWeek
    // (4 slots × ~40px = 160 px). Use many steps so FC's animation
    // can keep up.
    await page.mouse.move(gripX, gripY + 250, { steps: 40 });
    await page.waitForTimeout(60);
    await page.mouse.up();

    const req = await patchPromise;
    expect(req.url()).toMatch(/\/events\/\d+$/);
    const body = req.postDataJSON() as { start?: string; end?: string };
    expect(body.start, 'PATCH body should include new start').toBeTruthy();
    expect(body.end, 'PATCH body should include new end').toBeTruthy();
  });
});
