import { APIRequestContext, Page, expect, request } from '@playwright/test';

export const API_BASE = 'https://api.fptest.com/api/v1';
export const APP_BASE = 'https://fptest.com';

export interface FlowSeed { id: number; name: string }

/**
 * Login via the API and return a Playwright-ready `APIRequestContext` that
 * carries the access_token cookie. Saves an extra round-trip vs going
 * through the UI for setup work inside tests.
 *
 * Retries on HTTP 429. The backend login throttle is 50/min and Playwright
 * recycles workers on certain failures, which re-runs `beforeAll` and can
 * land its login inside an already-saturated minute window. A small
 * back-off loop turns those transient throttle hits into a brief wait
 * instead of a hard suite failure (see SESSION_HANDOFF_2026-05-15.md #3).
 */
export async function apiContextFor(email: string, password: string): Promise<APIRequestContext> {
  const api = await request.newContext({ ignoreHTTPSErrors: true });
  const backoffsMs = [0, 2_000, 5_000, 10_000, 20_000];
  let lastStatus = 0;
  for (const wait of backoffsMs) {
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const res = await api.post(`${API_BASE}/auth/login`, { data: { email, password } });
    if (res.ok()) return api;
    lastStatus = res.status();
    if (lastStatus !== 429) break; // non-throttle errors aren't worth retrying
  }
  expect(false, `Login API failed after retries: ${lastStatus}`).toBeTruthy();
  throw new Error(`Login API failed after retries: ${lastStatus}`); // unreachable; satisfies TS
}

/** GET the non-paginated flow list. Uses the same endpoint the card grids use. */
export async function getFlowList(api: APIRequestContext): Promise<FlowSeed[]> {
  const res = await api.get(`${API_BASE}/admin/flow-designs/list-with-data`);
  expect(res.ok(), `list-with-data failed: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  // listWithData returns a bare array, not a paginated envelope.
  return Array.isArray(body) ? body : (body?.data ?? []);
}

/** Create a flow via the API and return its id. */
export async function createFlow(api: APIRequestContext, name: string): Promise<number> {
  const res = await api.post(`${API_BASE}/admin/flow-designs`, { data: { name } });
  expect(res.ok(), `create flow failed: ${res.status()}`).toBeTruthy();
  const body = await res.json();
  return Number(body.id);
}

/** Delete a flow (soft-delete) — tolerant of 404 if already deleted. */
export async function deleteFlow(api: APIRequestContext, id: number): Promise<void> {
  await api.delete(`${API_BASE}/admin/flow-designs/${id}`);
}

/** Wait for the admin list page to settle (table painted + at least N rows).
 *  AntD Table renders a hidden `tr.ant-table-measure-row` before the data
 *  rows — match `tr.ant-table-row` so we wait for a real row. */
export async function waitForFlowListLoaded(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('table tbody tr.ant-table-row').first().waitFor({ state: 'visible', timeout: 15000 });
}
