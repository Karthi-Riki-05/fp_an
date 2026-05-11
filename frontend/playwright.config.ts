import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,       // 1 worker — dev Next.js in Docker can't handle concurrent load
  retries: 2,       // retry twice to survive transient network blips
  timeout: 45000,
  expect: { timeout: 10000 },
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],

  use: {
    baseURL: 'https://fptest.com',
    ignoreHTTPSErrors: true,
    screenshot: 'on',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    navigationTimeout: 30000,
    actionTimeout: 15000,
  },

  projects: [
    // Auth setup — runs first, saves sessions
    { name: 'admin-setup', testMatch: '**/auth/admin.setup.ts' },
    { name: 'user-setup',  testMatch: '**/auth/user.setup.ts'  },

    // Desktop — Admin (1280px)
    {
      name: 'desktop-admin',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/admin.json',
        viewport: { width: 1280, height: 800 },
      },
      dependencies: ['admin-setup'],
      testMatch: '**/admin.spec.ts',
    },

    // Desktop — Company User (1280px)
    {
      name: 'desktop-user',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/user.json',
        viewport: { width: 1280, height: 800 },
      },
      dependencies: ['user-setup'],
      testMatch: '**/user.spec.ts',
    },

    // Mobile — Admin (375px iPhone 12)
    {
      name: 'mobile-admin',
      use: {
        ...devices['iPhone 12'],
        storageState: 'tests/.auth/admin.json',
      },
      dependencies: ['admin-setup'],
      testMatch: '**/admin.spec.ts',
    },

    // Mobile — Company User (375px iPhone 12)
    {
      name: 'mobile-user',
      use: {
        ...devices['iPhone 12'],
        storageState: 'tests/.auth/user.json',
      },
      dependencies: ['user-setup'],
      testMatch: '**/user.spec.ts',
    },

    // Public pages — desktop + mobile (no auth)
    {
      name: 'public',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      testMatch: '**/public.spec.ts',
    },
    {
      name: 'public-mobile',
      use: { ...devices['iPhone 12'] },
      testMatch: '**/public.spec.ts',
    },
  ],
});
