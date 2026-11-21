import { test, expect } from '@playwright/test';

// Record every opening animation as it starts, so the specs never depend on
// catching transient animations by polling. With pause set, each one is held
// at its first frame so it can be sampled at leisure.
async function recordOpening(page, { pause = false } = {}) {
  await page.addInitScript((pauseAnimations) => {
    window.__opening = { starts: [], anims: [], firstAt: undefined };
    const orig = Element.prototype.animate;
    Element.prototype.animate = function () {
      const anim = orig.apply(this, arguments);
      const o = window.__opening;
      if (o.firstAt === undefined) o.firstAt = performance.now();
      o.starts.push({ target: this.classList.value, timing: anim.effect.getTiming() });
      if (pauseAnimations) { anim.pause(); anim.currentTime = 0; o.anims.push(anim); }
      return anim;
    };
  }, pause);
}
const started = (page, n = 4) => expect.poll(() => page.evaluate(() => window.__opening.starts.length)).toBeGreaterThanOrEqual(n);
const startedCount = (page) => page.evaluate(() => window.__opening.starts.length);

// Fake page visibility before any page script runs.
async function fakeVisibility(page, initial) {
  await page.addInitScript((vis) => {
    window.__vis = vis;
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => window.__vis });
    window.__setVis = (v) => { window.__vis = v; document.dispatchEvent(new Event('visibilitychange')); };
  }, initial);
}

test('flip and slam runs once, ends at 700ms and only animates faces and plungers', async ({ page }) => {
  await recordOpening(page);
  await page.goto('/chess-clock/');
  await started(page);
  const animations = await page.evaluate(() => window.__opening.starts.map(a => ({ target: a.target, timing: a.timing })));
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
  await recordOpening(page, { pause: true });
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/chess-clock/');
  await page.waitForTimeout(1200); // well past the opening delay
  expect(await startedCount(page)).toBe(0);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  await expect(page.locator('#setup-clock-left')).toHaveAttribute('data-time','10:00');
  // Switching it on while the opening is live cancels the running animations.
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.reload();
  await started(page); // held at the first frame, so they are alive until cancelled
  expect(await page.evaluate(() => window.__opening.anims.every(a => a.playState !== 'idle'))).toBe(true);
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect.poll(() => page.evaluate(() => window.__opening.anims.every(a => a.playState === 'idle'))).toBe(true);
  await expect(page.locator('#setup-clock-left')).toHaveAttribute('data-time','10:00');
});

test('preset and Play remain immediately usable during the intro', async ({ page }) => {
  await recordOpening(page, { pause: true });
  await page.goto('/chess-clock/');
  await started(page);
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
    await recordOpening(page, { pause: true });
    await page.goto('/chess-clock/');
    await started(page);
    const result=await page.evaluate(() => {
      const animations=window.__opening.anims;
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
  await page.addInitScript(() => { window.addEventListener('load', () => { window.__load = performance.now(); }); });
  await recordOpening(page);
  await page.goto('/chess-clock/');
  await started(page);
  const t = await page.evaluate(() => ({ load: window.__load, first: window.__opening.firstAt }));
  expect(t.load).toBeGreaterThan(0);
  expect(t.first - t.load, 'starts at least ~0.5s after the page has loaded').toBeGreaterThanOrEqual(450);
  expect(t.first - t.load, 'but not much later').toBeLessThan(1500);
});

test('a page opened in a background tab plays the opening only after it has been visible for the delay', async ({ page }) => {
  await fakeVisibility(page, 'hidden');
  await recordOpening(page);
  await page.goto('/chess-clock/');
  await page.waitForTimeout(1200);
  expect(await startedCount(page), 'nothing plays while hidden').toBe(0);
  await page.evaluate(() => window.__setVis('visible'));
  await page.waitForTimeout(250);
  expect(await startedCount(page), 'not before the 0.5s delay').toBe(0);
  await started(page);
});

test('hiding the tab during the delay cancels it; the opening gets a full visible delay later', async ({ page }) => {
  await fakeVisibility(page, 'hidden');
  await recordOpening(page);
  await page.goto('/chess-clock/');
  await page.waitForTimeout(600);
  // Shown briefly, then hidden again before the delay can finish.
  await page.evaluate(() => window.__setVis('visible'));
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__setVis('hidden'));
  await page.waitForTimeout(900);
  expect(await startedCount(page), 'never starts while hidden, even after the old delay would have passed').toBe(0);
  await page.evaluate(() => { window.__shownAt = performance.now(); window.__setVis('visible'); });
  await page.waitForTimeout(250);
  expect(await startedCount(page), 'a fresh half second of visible time is required').toBe(0);
  await started(page);
  const waited = await page.evaluate(() => window.__opening.firstAt - window.__shownAt);
  expect(waited).toBeGreaterThanOrEqual(450);
});

test('the opening does not start if the tab is hidden at the moment the delay ends', async ({ page }) => {
  await fakeVisibility(page, 'visible');
  await recordOpening(page);
  await page.addInitScript(() => {
    // Hide the tab 300ms after load, inside the 500ms delay.
    window.addEventListener('load', () => setTimeout(() => window.__setVis('hidden'), 300));
  });
  await page.goto('/chess-clock/');
  await page.waitForTimeout(1500);
  expect(await startedCount(page)).toBe(0);
});
