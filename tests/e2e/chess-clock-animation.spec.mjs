import { test, expect } from '@playwright/test';

test('flip and slam runs once, ends at 700ms and only animates faces and plungers', async ({ page }) => {
  await page.goto('/chess-clock/');
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(4);
  const animations = await page.evaluate(() => document.getAnimations().map(a => ({target:a.effect.target.classList.value,timing:a.effect.getTiming()})));
  expect(animations).toHaveLength(4);
  expect(animations.every(a => /clock-digits|clock-plunger/.test(a.target))).toBe(true);
  expect(Math.max(...animations.map(a => a.timing.duration + a.timing.delay))).toBe(700);
  expect(animations.every(a => a.timing.easing === 'linear')).toBe(true);
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
  await page.locator('[data-preset="3,2"]').click();
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await expect(page.locator('#setup-clock-left')).toHaveAttribute('data-time','3:00');
  await expect(page.locator('#setup-clock-right')).toHaveAttribute('data-time','3:00');
});

test('reduced motion renders final state immediately and switching it on cancels motion', async ({ page }) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/chess-clock/');
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await expect(page.locator('#setup-clock-left')).toHaveAttribute('data-time','10:00');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.reload();
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
});

test('preset and Play remain immediately usable during the intro', async ({ page }) => {
  await page.goto('/chess-clock/');
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(4);
  await page.evaluate(() => document.getAnimations().forEach(a => {a.pause();a.currentTime=0;}));
  await page.locator('[data-preset="1,0"]').click();
  await expect(page.locator('#setup-clock-left')).toHaveAttribute('data-time','1:00');
  await expect(page.locator('#setup-clock-right')).toHaveAttribute('data-time','1:00');
  await page.locator('#start-btn').click();
  await expect(page.locator('#p1-time')).toHaveText('1:00');
  await expect(page.locator('#p2-time')).toHaveText('1:00');
});

test('sampled animation geometry leaves body, Play and tiles still at narrow and wide widths', async ({ page }) => {
  for (const width of [320,390,1440]) {
    await page.setViewportSize({width,height:1000});
    await page.goto('/chess-clock/');
    await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(4);
    const result=await page.evaluate(() => {
      const animations=document.getAnimations();
      animations.forEach(a=>a.pause());
      const stable=[...document.querySelectorAll('.clock-case,#start-btn,.tile')];
      const geometry=()=>stable.map(x=>{const r=x.getBoundingClientRect();return [r.x,r.y,r.width,r.height];});
      const initial=JSON.stringify(geometry());
      let still=true,overflow=false,matching=true;
      for(let t=0;t<=700;t+=20){
        animations.forEach(a=>a.currentTime=t);
        still &&= JSON.stringify(geometry())===initial;
        overflow ||= document.documentElement.scrollWidth>innerWidth;
        matching &&= [...document.querySelectorAll('.clock-digits')].every(g=>g.dataset.time==='10:00');
      }
      return {still,overflow,matching};
    });
    expect(result).toEqual({still:true,overflow:false,matching:true});
  }
});

test('the opening waits for the full load and about half a second, so it is seen', async ({ page }) => {
  // Instrument before any page script: record when the load event fires and when the first animation starts.
  await page.addInitScript(() => {
    window.__t = {};
    window.addEventListener('load', () => { window.__t.load = performance.now(); });
    const orig = Element.prototype.animate;
    Element.prototype.animate = function () { if (window.__t.firstAnim === undefined) window.__t.firstAnim = performance.now(); return orig.apply(this, arguments); };
  });
  await page.goto('/chess-clock/');
  await expect.poll(() => page.evaluate(() => window.__t.firstAnim !== undefined)).toBe(true);
  const t = await page.evaluate(() => window.__t);
  expect(t.load).toBeGreaterThan(0);
  expect(t.firstAnim - t.load, 'starts at least ~0.5s after the page has loaded').toBeGreaterThanOrEqual(450);
  expect(t.firstAnim - t.load, 'but not much later').toBeLessThan(1500);
});

test('a page opened in a background tab plays the opening only once it is shown', async ({ page, context }) => {
  await page.goto('/chess-clock/?warm=1');
  await page.addInitScript(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis || 'hidden' });
    window.__vis = 'hidden';
    window.__started = 0;
    const orig = Element.prototype.animate;
    Element.prototype.animate = function () { window.__started++; return orig.apply(this, arguments); };
  });
  await page.goto('/chess-clock/');
  await page.waitForTimeout(1500);
  expect(await page.evaluate(() => window.__started), 'nothing plays while hidden').toBe(0);
  await page.evaluate(() => { window.__vis = 'visible'; document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__started), 'not before the 0.5s delay').toBe(0);
  await expect.poll(() => page.evaluate(() => window.__started)).toBeGreaterThan(0);
});
