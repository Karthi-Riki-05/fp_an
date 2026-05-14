import { APIRequestContext, Page, expect, request } from '@playwright/test';

export const API_BASE = 'https://api.fptest.com/api/v1';
export const APP_BASE = 'https://fptest.com';

export interface FlowSeed { id: number; name: string }

/**
 * Login via the API and return a Playwright-ready `APIRequestContext` that
 * carries the access_token cookie. Saves an extra round-trip vs going
 * through the UI for setup work inside tests.
 */
export async function apiContextFor(email: string, password: string): Promise<APIRequestContext> {
  const api = await request.newContext({ ignoreHTTPSErrors: true });
  const res = await api.post(`${API_BASE}/auth/login`, { data: { email, password } });
  expect(res.ok(), `Login API failed: ${res.status()}`).toBeTruthy();
  return api;
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
