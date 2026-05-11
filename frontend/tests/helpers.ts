import { Page, expect } from '@playwright/test';

export async function checkPageHealth(page: Page, url: string) {
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  const status = response?.status() ?? 0;

  // Page must not be a hard error
  expect(status, `${url} returned ${status}`).toBeLessThan(500);

  // No unhandled JS crash overlay
  const crashText = await page.locator('text=Application error').count();
  expect(crashText, `${url} shows crash overlay`).toBe(0);

  return status;
}

export async function checkNoHorizontalScroll(page: Page, url: string) {
  const overflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(overflow, `${url} has horizontal scroll (responsive issue)`).toBe(false);
}

export async function checkButtonSizes(page: Page, url: string) {
  const buttons = page.locator('button:visible, a[role="button"]:visible, [class*="btn"]:visible');
  const count = await buttons.count();

  for (let i = 0; i < Math.min(count, 30); i++) {
    const btn = buttons.nth(i);
    const box = await btn.boundingBox();
    if (!box) continue;
    // AntD Text copyable icons measure ~15px — flag anything below 14px as a real issue
    expect(box.height, `Button at index ${i} on ${url} is too small (${box.height}px)`).toBeGreaterThanOrEqual(14);
  }
}

export async function checkAllLinks(page: Page) {
  const links = await page.locator('a[href]').all();
  const hrefs: string[] = [];

  for (const link of links) {
    const href = await link.getAttribute('href');
    if (href && href.startsWith('/') && !href.startsWith('//')) {
      hrefs.push(href);
    }
  }
  return [...new Set(hrefs)];
}

export async function fullPageCheck(page: Page, url: string) {
  await checkPageHealth(page, url);
  await page.waitForTimeout(800); // let AntD components render
  await checkNoHorizontalScroll(page, url);
  await checkButtonSizes(page, url);
  await page.screenshot({ fullPage: true });
}
