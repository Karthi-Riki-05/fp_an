import { test as setup, expect, request } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const authFile = path.join(__dirname, '../.auth/admin.json');

setup('login as admin', async ({ page, context }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  // Call the API directly to get the token, bypassing cross-origin cookie issues
  const api = await request.newContext({ ignoreHTTPSErrors: true });
  const res = await api.post('https://api.fptest.com/api/v1/auth/login', {
    data: { email: 'user1@gmail.com', password: 'password123' },
  });
  expect(res.ok(), `Admin login API failed: ${res.status()}`).toBeTruthy();

  // Extract the token from the Set-Cookie header
  const setCookie = res.headers()['set-cookie'] ?? '';
  const match = setCookie.match(/access_token=([^;]+)/);
  expect(match, 'access_token cookie not found in response').toBeTruthy();
  const token = match![1];

  // Inject the cookie on both origins so Next.js middleware can read it
  await context.addCookies([
    {
      name: 'access_token',
      value: token,
      domain: 'fptest.com',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
    {
      name: 'access_token',
      value: token,
      domain: 'api.fptest.com',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);

  // Verify the session works
  await page.goto('https://fptest.com/dashboard');
  await expect(page).not.toHaveURL(/login/, { timeout: 10000 });

  await context.storageState({ path: authFile });
  console.log('Admin session saved.');
});
