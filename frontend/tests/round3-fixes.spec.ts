/**
 * Round-3 fixes:
 *   1. Hitting fptest.com (`/`) redirects to /login when anonymous and
 *      to /dashboard when authenticated.
 *   2. Authenticated user pages no longer show the marketing nav
 *      (TJÄNSTER / VÅR PRODUKT / OM OSS / KONTAKTA OSS).
 *   3. /profile/edit holds only the Edit profile card; /profile/password
 *      holds only the Change password card. No duplicated MarketingHeader.
 */

import { test, expect } from '@playwright/test';

test.describe('Root redirect', () => {
  test('Anonymous visiting / is sent to /login', async ({ browser }) => {
    // Explicit empty storage — `browser.newContext` would otherwise
    // still inherit the project-level user storageState that's configured
    // in playwright.config.ts.
    const ctx = await browser.newContext({
      ignoreHTTPSErrors: true,
      storageState: { cookies: [], origins: [] },
    });
    const page = await ctx.newPage();
    await page.goto('https://fptest.com/');
    await page.waitForURL(/\/login(\?.*)?$/, { timeout: 8000 });
    await expect(page).toHaveURL(/\/login/);
    await ctx.close();
  });

  test('Authenticated visiting / is sent to /dashboard', async ({ browser }) => {
    const ctx = await browser.newContext({
      ignoreHTTPSErrors: true,
      storageState: 'tests/.auth/user.json',
    });
    const page = await ctx.newPage();
    await page.goto('https://fptest.com/');
    await page.waitForURL(/\/dashboard/, { timeout: 8000 });
    await expect(page).toHaveURL(/\/dashboard/);
    await ctx.close();
  });
});

test.describe('Marketing nav removed from authenticated pages', () => {
  test.use({ storageState: 'tests/.auth/user.json' });

  test('Dashboard no longer renders the marketing nav links', async ({ page }) => {
    await page.goto('https://fptest.com/dashboard');
    await page.waitForLoadState('networkidle');

    // Marketing-nav links are uppercased anchors inside the teal header.
    // None of the four should be visible on authenticated user pages.
    const headerNav = page.locator('header');
    await expect(headerNav).toBeVisible();
    await expect(headerNav.getByRole('link', { name: /TJÄNSTER|Services/i })).toHaveCount(0);
    await expect(headerNav.getByRole('link', { name: /VÅR PRODUKT|Our Product/i })).toHaveCount(0);
    await expect(headerNav.getByRole('link', { name: /OM OSS|About Us/i })).toHaveCount(0);
    await expect(headerNav.getByRole('link', { name: /KONTAKTA OSS|Contact Us/i })).toHaveCount(0);

    // User dropdown is still there — finds the company name.
    await expect(headerNav.getByText(/Company User|Volvo/)).toBeVisible();
  });

  test('There is only one header on /profile/edit (no duplicate navbar)', async ({ page }) => {
    await page.goto('https://fptest.com/profile/edit');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('header')).toHaveCount(1);
  });
});

test.describe('Profile edit + password are on separate pages', () => {
  test.use({ storageState: 'tests/.auth/user.json' });

  test('/profile/edit shows ONLY the Edit profile card', async ({ page }) => {
    await page.context().addCookies([{
      name: 'NEXT_LOCALE', value: 'sv',
      domain: 'fptest.com', path: '/', httpOnly: false, secure: false, sameSite: 'Lax',
    }]);
    await page.goto('https://fptest.com/profile/edit');
    await page.waitForLoadState('networkidle');

    await expect(page.getByText('Redigera profil').first()).toBeVisible({ timeout: 8000 });
    // Change-password card title should NOT appear as a card header here.
    // (A cross-link with the same text exists at the bottom; we look for
    // the actual `.ant-card-head-title` to disambiguate.)
    const passwordCardHeader = page.locator('.ant-card-head-title', { hasText: 'Byt lösenord' });
    await expect(passwordCardHeader).toHaveCount(0);

    // Email pre-filled.
    await expect(page.locator('input[type="email"]').first()).not.toHaveValue('');
  });

  test('/profile/password shows ONLY the Change password card', async ({ page }) => {
    await page.context().addCookies([{
      name: 'NEXT_LOCALE', value: 'sv',
      domain: 'fptest.com', path: '/', httpOnly: false, secure: false, sameSite: 'Lax',
    }]);
    await page.goto('https://fptest.com/profile/password');
    await page.waitForLoadState('networkidle');

    const passwordCardHeader = page.locator('.ant-card-head-title', { hasText: 'Byt lösenord' });
    await expect(passwordCardHeader).toHaveCount(1);

    // The Edit-profile card should NOT be on this page.
    const editCardHeader = page.locator('.ant-card-head-title', { hasText: 'Redigera profil' });
    await expect(editCardHeader).toHaveCount(0);

    // Three password fields.
    await expect(page.locator('input[type="password"]')).toHaveCount(3);
  });

  test('Dashboard My-Profile "Byt lösenord" button navigates to /profile/password', async ({ page }) => {
    await page.context().addCookies([{
      name: 'NEXT_LOCALE', value: 'sv',
      domain: 'fptest.com', path: '/', httpOnly: false, secure: false, sameSite: 'Lax',
    }]);
    await page.goto('https://fptest.com/dashboard?tab=myprofile');
    await page.waitForLoadState('networkidle');

    // The button is a Link wrapping an AntD Button — find by text.
    await page.getByRole('link', { name: /Byt lösenord/ }).first().click();
    await page.waitForURL(/\/profile\/password/, { timeout: 6000 });
  });
});
