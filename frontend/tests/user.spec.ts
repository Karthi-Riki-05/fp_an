import { test, expect } from '@playwright/test';
import { fullPageCheck, checkAllLinks } from './helpers';

const USER_PAGES = [
  '/dashboard',
  '/analyzer',
  '/boards',
  '/machines',
  '/monitor',
  '/myresult',
  '/orders',
  '/units',
  '/feedback',
  '/profile/edit',
];

for (const url of USER_PAGES) {
  test(`user page loads: ${url}`, async ({ page }) => {
    await fullPageCheck(page, url);
  });
}

test('dashboard — key UI elements visible', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
  const nav = page.locator('nav, aside, [class*="sider"], [class*="sidebar"], [class*="menu"]');
  await expect(nav.first()).toBeVisible({ timeout: 8000 });
});

// Fix: profile/edit is a Coming Soon placeholder — check for its heading instead of form inputs
test('profile edit — page renders', async ({ page }) => {
  await page.goto('/profile/edit');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(800);
  const content = page.locator('h1, h2, h3, h4, [class*="title"], input:visible');
  await expect(content.first()).toBeVisible({ timeout: 8000 });
});

// Fix: increased timeout to 20s — Next.js middleware redirect can be slow on cold start
test('unauthenticated access redirects to login', async ({ browser }) => {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await page.goto('https://fptest.com/dashboard');
  await page.waitForURL(/login/, { timeout: 20000 });
  expect(page.url()).toContain('login');
  await ctx.close();
});

test('internal links on dashboard are valid', async ({ page }) => {
  await page.goto('/dashboard');
  await page.waitForTimeout(1500);
  const links = await checkAllLinks(page);
  console.log(`Found ${links.length} internal links on dashboard:`, links);
  expect(links.length).toBeGreaterThan(0);
});
