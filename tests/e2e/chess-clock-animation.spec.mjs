import { test, expect } from '@playwright/test';

test('flip and slam runs once, ends at 700ms and only animates faces and plungers', async ({ page }) => {
  await page.goto('/chess-clock/');
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
