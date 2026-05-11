import { test as setup, expect, request } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const authFile = path.join(__dirname, '../.auth/user.json');

setup('login as company user', async ({ page, context }) => {
  fs.mkdirSync(path.dirname(authFile), { recursive: true });

  const api = await request.newContext({ ignoreHTTPSErrors: true });
  const res = await api.post('https://api.fptest.com/api/v1/auth/login', {
    data: { email: 'user2@gmail.com', password: 'password123' },
  });
  expect(res.ok(), `Company user login API failed: ${res.status()}`).toBeTruthy();

  const setCookie = res.headers()['set-cookie'] ?? '';
  const match = setCookie.match(/access_token=([^;]+)/);
  expect(match, 'access_token cookie not found in response').toBeTruthy();
  const token = match![1];

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

  await page.goto('https://fptest.com/dashboard');
  await expect(page).not.toHaveURL(/login/, { timeout: 10000 });

  await context.storageState({ path: authFile });
  console.log('Company user session saved.');
});
