import {test,expect} from '@playwright/test';

for(const route of ['/','/homepage-concepts/']) {
 test(`finite hero stays settled after a coalesced resume event ${route}`,async({page})=>{
  await page.addInitScript(()=>{
   const original=window.matchMedia.bind(window);
   window.heroMotionQueries=[];
   window.matchMedia=query=>{const m=original(query);if(query.includes('prefers-reduced-motion'))heroMotionQueries.push(m);return m;};
  });
  await page.goto(route);
  await page.waitForFunction(()=>document.querySelector('#hero-title').classList.contains('will-type'));
  // Deterministically model a fast reduce/no-preference toggle whose change
  // notifications coalesce, leaving only the final resume event to JS.
  await page.evaluate(()=>heroMotionQueries.forEach(m=>m.dispatchEvent(new MediaQueryListEvent('change',{matches:false,media:m.media}))));
  await expect(page.locator('#hero-title')).toHaveClass(/sketch-settled/);
  await expect(page.locator('.hero-caret')).toHaveCount(0);
  await page.waitForTimeout(250);
  await expect(page.locator('.hero-caret')).toHaveCount(0);
  expect(await page.locator('#hero-title .hc').evaluateAll(chars=>chars.every(c=>c.classList.contains('on')))).toBe(true);
  for(const preference of ['reduce','no-preference','reduce','no-preference']){
   await page.emulateMedia({reducedMotion:preference});
   await expect(page.locator('.pf-frame')).toHaveCSS('stroke-dashoffset','0px');
   expect(await page.locator('.pf-frame').evaluate(e=>e.getAnimations().length)).toBe(0);
  }
 });
 test(`hiding during early typing completes the hero and never redraws on return ${route}`,async({page})=>{
  await page.goto(route);
  await page.waitForFunction(()=>document.querySelector('#hero-title').classList.contains('will-type'));
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.locator('#hero-title')).toHaveClass(/sketch-settled/);
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await expect(page.locator('.pf-frame')).toHaveCSS('stroke-dashoffset','0px');
  expect(await page.locator('.pf-frame').evaluate(e=>e.getAnimations().length)).toBe(0);
  await expect(page.locator('.hero-caret')).toHaveCount(0);
 });
}
