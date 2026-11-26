import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/formspree.io/**', (r) => r.abort());
});

for (const path of ['/', '/about/', '/pricing/', '/charity/', '/contact/', '/privacy/']) for (const width of [390, 1440]) {
  test(`${path} section headings are plain, with no eyebrow labels ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(path);
    await expect(page.locator('.eyebrow')).toHaveCount(0);
    const same = await page.evaluate(() =>
      [...document.querySelectorAll('h2 em')].map((em) => getComputedStyle(em).color === getComputedStyle(em.closest('h2')).color)
    );
    if (path === '/') expect(same.length).toBeGreaterThan(0);
    expect(same.every(Boolean)).toBe(true);
  });
}
