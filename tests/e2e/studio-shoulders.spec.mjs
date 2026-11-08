import { test, expect } from '@playwright/test';
function checkPose(p) {
  const [x, y, ex, ey, hx, hy] = p.n;
  expect(p.rest.d).toBe("M267 260C254 292 246 337 250 392");
  expect(p.rest.stroke).toBe("#6d2b3d");
  expect(p.rest.capFill).toBe(p.rest.stroke);
  expect(p.rest.capStroke).toBeNull();
  expect(p.rest.hand).toEqual([250, 400]);
  expect(p.rest.sameGroup).toBe(true);
  expect(x - p.dx).toBeCloseTo(354, 0);
  expect(y).toBe(260);
  expect(Math.hypot(ex-x, ey-y)).toBeCloseTo(126, 0);
  expect(Math.hypot(hx-ex, hy-ey)).toBeCloseTo(126, 0);
  expect(p.sleeve[0]).toBeCloseTo(x, 0);
  expect(p.sleeve[1]).toBeCloseTo(y, 0);
}
async function readPose(page) {
  return page.locator('.studio svg').evaluate(svg => ({
    rest: {d:svg.querySelector('.sd-rest-arm').getAttribute('d'),stroke:svg.querySelector('.sd-rest-arm').getAttribute('stroke'),capFill:svg.querySelector('.sd-rest-sleeve').getAttribute('fill'),capStroke:svg.querySelector('.sd-rest-sleeve').getAttribute('stroke'),hand:['cx','cy'].map(a=>Number(svg.querySelector('.sd-rest-hand').getAttribute(a))),sameGroup:svg.querySelector('.sd-rest-arm').parentElement===svg.querySelector('.sd-body')&&svg.querySelector('.sd-rest-sleeve').parentElement===svg.querySelector('.sd-body')&&svg.querySelector('.sd-rest-hand').parentElement===svg.querySelector('.sd-body')},
    n: svg.querySelector('.sd-arm').getAttribute('d').match(/-?[\d.]+/g).map(Number),
    dx: Number(svg.querySelector('.sd-body').getAttribute('transform').match(/-?[\d.]+/)[0]),
    sleeve: svg.querySelector('.sd-sleeve').getAttribute('transform').match(/-?[\d.]+/g).map(Number),
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

test('integrated shoulder can reach every drawing point without pen clamping', async ({ page }) => {
  await page.goto('/');
  const farthest = await page.locator('.studio svg').evaluate(svg => {
    let max = 0;
    const check = P => {
      const dx = Math.max(0, Math.min(110, ((P.x - 480) / 220) * 110));
      max = Math.max(max, Math.hypot(P.x - 20 - (378 + dx), P.y + 20 - 260));
    };
    for (const selector of ['.sd-swoosh', '.sd-subline', '.sd-btn', '.sd-card1', '.sd-card2', '.sd-card3']) {
      const path = svg.querySelector(selector), length = path.getTotalLength();
      for (let i = 0; i <= 1000; i++) check(path.getPointAtLength(length * i / 1000));
    }
    for (let i = 0; i <= 1000; i++) check({ x: 480 + 250 * i / 1000, y: 140 + Math.sin(i / 1000 * 22) * 10 });
    return max;
  });
  expect(farthest).toBeLessThan(251);
});
