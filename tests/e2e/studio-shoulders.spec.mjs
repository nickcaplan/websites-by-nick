import { test, expect } from '@playwright/test';
function checkPose(p) {
  const [x, y, ex, ey, hx, hy] = p.n;
  expect(x - p.dx).toBeCloseTo(366, 0);
  expect(y).toBe(260);
  expect(Math.hypot(ex-x, ey-y)).toBeCloseTo(110, 0);
  expect(Math.hypot(hx-ex, hy-ey)).toBeCloseTo(110, 0);
  expect(p.seam).toBeCloseTo(p.dx - 56, 0);
}
async function readPose(page) {
  return page.locator('.studio svg').evaluate(svg => ({
    n: svg.querySelector('.sd-arm').getAttribute('d').match(/-?[\d.]+/g).map(Number),
    dx: Number(svg.querySelector('.sd-body').getAttribute('transform').match(/-?[\d.]+/)[0]),
    seam: Number(svg.querySelector('.sd-shoulder-seam').getAttribute('transform').match(/-?[\d.]+/)[0]),
  }));
}
for (const width of [390, 1440]) for (const theme of ['dark', 'light']) for (const route of ['/', '/homepage-concepts/']) {
  test(`studio shoulder stays attached through drawing ${route} ${width} ${theme}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(t => localStorage.setItem('nick-theme', t), theme);
    await page.goto(route);
    await page.locator('.studio').scrollIntoViewIfNeeded();
    const poses = new Set();
    await expect.poll(async () => {
      const p = await readPose(page);
      checkPose(p);
      poses.add(p.n.join(','));
      return poses.size;
    }, { timeout: 10000 }).toBeGreaterThan(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });
}
for (const reduced of [true, false]) test(`static shoulder fallback ${reduced ? 'reduced motion' : 'no JS'}`, async ({ browser }) => {
  const c = await browser.newContext({ javaScriptEnabled: reduced, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  try { const page = await c.newPage(); await page.goto('/'); checkPose(await readPose(page)); }
  finally { await c.close(); }
});
