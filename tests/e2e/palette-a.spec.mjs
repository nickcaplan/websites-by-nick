import { test, expect } from '@playwright/test';
const rgb = hex => `rgb(${hex.match(/\w\w/g).map(v => parseInt(v, 16)).join(', ')})`;
for (const theme of ['light', 'dark']) for (const width of [390, 1440]) {
  test(`palette A across public brand pages ${theme} ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(t => localStorage.setItem('nick-theme', t), theme);
    const paper = rgb(theme === 'light' ? 'f4f1e9' : '1b2521');
    const ink = rgb(theme === 'light' ? '22312a' : 'f2ede1');
    for (const route of ['/', '/homepage-concepts/', '/about/', '/pricing/', '/charity/', '/contact/', '/privacy/', '/experience/']) {
      await page.goto(route);
      await expect(page.locator('body')).toHaveCSS('background-color', paper);
      await expect(page.locator('body')).toHaveCSS('color', ink);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route).toBe(true);
    }
    await page.goto('/');
    const hero = page.locator('#hero-title');
    for (const word of ['remember', 'enjoy', 'love']) {
      await hero.evaluate((el, word) => el.dataset.bulbWord = word, word);
      const colour = word === 'enjoy' ? (theme === 'light' ? '54604e' : 'a8b598') : (theme === 'light' ? '9e3d1c' : 'f0996f');
      await expect(hero.locator('.last em')).toHaveCSS('color', rgb(colour));
    }
    if (theme === 'light') await expect(page.locator('footer .cta')).toHaveCSS('color', rgb('ffffff'));
    if (theme === 'dark') {
      await expect(page.locator('.cta').first()).toHaveCSS('background-color', rgb('f0996f'));
      await expect(page.locator('footer .cta')).toHaveCSS('background-color', rgb('f0996f'));
    }
  });
}
