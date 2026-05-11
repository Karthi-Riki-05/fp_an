import { test, expect } from '@playwright/test';
import { fullPageCheck } from './helpers';

const PUBLIC_PAGES = ['/', '/login'];

for (const url of PUBLIC_PAGES) {
  test(`public page: ${url}`, async ({ page }) => {
    await fullPageCheck(page, url);
  });
}

test('login form — wrong credentials shows error', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#email').fill('wrong@example.com');
  await page.locator('#password').fill('wrongpassword');
  await page.locator('button[type="submit"]').click();
  await expect(page.locator('[role="alert"], .ant-message-error')).toBeVisible({ timeout: 8000 });
});

test('login form — empty submit shows validation errors', async ({ page }) => {
  await page.goto('/login');
  await page.locator('button[type="submit"]').click();
  const errors = page.locator('[role="alert"]');
  await expect(errors.first()).toBeVisible({ timeout: 5000 });
});

// Fix: set up response intercept before navigating so it never misses the call
test('login form submits and calls API successfully', async ({ page }) => {
  const loginPromise = page.waitForResponse(
    (r) => r.url().includes('/auth/login') && r.request().method() === 'POST',
    { timeout: 15000 },
  );

  await page.goto('/login');
  await page.locator('#email').fill('user2@gmail.com');
  await page.locator('#password').fill('password123');
  await page.locator('button[type="submit"]').click();

  const loginRes = await loginPromise;
  expect(loginRes.status(), 'Login API should return 200').toBe(200);
  const body = await loginRes.json();
  expect(body.user.email).toBe('user2@gmail.com');
});
