import {test,expect} from '@playwright/test';
for(const missed of[false,true])test(`system reduced preference handles repeated and missing notifications ${missed}`,async({page})=>{
 await page.addInitScript(missed=>{const match=window.matchMedia.bind(window);window.matchMedia=query=>{const media=match(query);if(query==='(prefers-reduced-motion: reduce)'){window.testReducedMedia=media;if(missed)media.addEventListener=()=>{}}return media}},missed);
 await page.goto('/homepage-concepts/');await expect(page.locator('.motion-toggle,.hero-motion-controls')).toHaveCount(0);
 for(let i=0;i<2;i++){
  await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('body')).toHaveClass(/paused/);await expect(page.locator('#hero-title .last em')).toHaveText('love.');
  if(!missed)await page.evaluate(()=>{window.testReducedMedia.dispatchEvent(new Event('change'));window.testReducedMedia.dispatchEvent(new Event('change'))});
  await page.emulateMedia({reducedMotion:'no-preference'});await expect(page.locator('body')).not.toHaveClass(/paused/);
 }
});
