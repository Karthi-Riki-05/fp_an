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

    // Shift Schedule edit — drag-to-reorder + Edit popover regression spec.
    {
      name: 'shift-schedule-edit',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/user.json',
        viewport: { width: 1440, height: 900 },
      },
      dependencies: ['user-setup'],
      testMatch: '**/shift-schedule-edit.spec.ts',
    },

    // Locale-selector removal + legacy translation merge smoke spec.
    {
      name: 'locale-cleanup',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/user.json',
        viewport: { width: 1440, height: 900 },
      },
      dependencies: ['user-setup'],
      testMatch: '**/locale-cleanup.spec.ts',
    },

    // Round 2 fixes: sidebar SV completion, login cleanup, /profile/edit,
    // Settings-tab unit selector backed by /api/v1/units.
    {
      name: 'i18n-and-profile',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/user.json',
        viewport: { width: 1440, height: 900 },
      },
      dependencies: ['user-setup'],
      testMatch: '**/i18n-and-profile.spec.ts',
    },

    // Round 3 fixes: root redirect, marketing nav strip, split profile pages.
    {
      name: 'round3-fixes',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/user.json',
        viewport: { width: 1440, height: 900 },
      },
      dependencies: ['user-setup'],
      testMatch: '**/round3-fixes.spec.ts',
    },

    // Responsive audit — data-collection only, no assertions. Generates
    // tests/responsive-audit/{report.md,findings.json,*.png}.
    {
      name: 'responsive-audit',
      // No `viewport` here: the spec itself opens contexts at each
      // viewport from the operator's 7-row table.
      use: { ...devices['Desktop Chrome'], storageState: 'tests/.auth/user.json' },
      dependencies: ['user-setup'],
      testMatch: '**/responsive-audit.spec.ts',
      // The audit is one long-running test; retries would re-do the
      // whole sweep on a transient blip.
      retries: 0,
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

    // Flow Management — Plan A E2E (uses Company user / user.json).
    // Company role holds both manage-flow-designs AND the view-* perms,
    // so a single auth state is enough to drive the admin list page,
    // the Designer placeholder, Monitor, and Analyzer.
    {
      name: 'flow-management',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'tests/.auth/user.json',
        viewport: { width: 1280, height: 800 },
      },
      dependencies: ['user-setup'],
      testMatch: '**/flow-management.spec.ts',
    },

    // Ad-hoc debugging project for the draw.io drop investigation
    // (delete once §11-S5 drop rendering is confirmed working).
    {
      name: 'flow-drop-debug',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      testMatch: '**/flow-drop-debug.spec.ts',
    },
    {
      name: 'flow-thumbnail-debug',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      testMatch: '**/flow-thumbnail-debug.spec.ts',
    },
    {
      name: 'flow-monitor-debug',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      testMatch: '**/flow-monitor-debug.spec.ts',
    },
    {
      name: 'flow-analyzer-debug',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
      testMatch: '**/flow-analyzer-debug.spec.ts',
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
