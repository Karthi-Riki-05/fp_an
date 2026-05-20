import { test, expect } from '@playwright/test';

// Smoke tests for the redesigned /units page (FP Analyzer port).
// The existing user.spec.ts already exercises the route load + auth gate;
// these tests cover the unit-list specific UI primitives.

test.describe('units page', () => {
  test('renders the panel heading and unit list title', async ({ page }) => {
    await page.goto('/units');
    await page.waitForLoadState('domcontentloaded');

    // Panel heading: "Units" inside the teal bar
    await expect(page.locator('.units-panel-heading')).toContainText('Units', { timeout: 8000 });
    // Centred subtitle "Unit List"
    await expect(page.locator('.units-title-row h4')).toContainText('Unit List');
  });

  test('expanding a unit row reveals the unregistered-stops header', async ({ page }) => {
    await page.goto('/units');
    await page.waitForLoadState('domcontentloaded');

    const firstRow = page.locator('.flow-list-view-hld > li.item').first();
    // The page may render zero units in some seeded states — skip if so.
    const count = await page.locator('.flow-list-view-hld > li.item').count();
    test.skip(count === 0, 'no units seeded');

    await firstRow.locator('.li-head').click();
    await expect(firstRow).toHaveClass(/active/);
    await expect(firstRow.locator('.child-cont-hld')).toBeVisible();
    await expect(firstRow.locator('.ch-title')).toContainText('Unregistered stops');
  });

  test('1Hz clock element renders a HH:MM:SS pattern', async ({ page }) => {
    await page.goto('/units');
    await page.waitForLoadState('domcontentloaded');
    const count = await page.locator('.flow-list-view-hld > li.item').count();
    test.skip(count === 0, 'no units seeded');

    const clock = page.locator('.flow-list-clock').first();
    await expect(clock).toBeVisible();
    await expect(clock).toHaveText(/\d{2}:\d{2}:\d{2}/);
  });
});
