import {test,expect} from '@playwright/test';
for(const width of[390,1280])for(const dpr of[1,2])test(`collage chooses responsive sources ${width} DPR ${dpr}`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:dpr,reducedMotion:'reduce'}),page=await context.newPage();await page.goto('/homepage-concepts/');
 for(const img of await page.locator('.composition .browser-card img').all()){
  await img.evaluate(e=>e.decode());await expect(img).not.toHaveAttribute('fetchpriority','high');await expect(img).not.toHaveAttribute('loading','lazy');const s=await img.evaluate(e=>({src:e.currentSrc,natural:e.naturalWidth,width:e.clientWidth,height:e.clientHeight,ratio:Number(e.getAttribute('width'))/Number(e.getAttribute('height'))}));expect(s.src).toMatch(/-(400|800|1280|1920)w\.webp$/);expect(s.width/s.height).toBeCloseTo(s.ratio,1);if(width===390&&dpr===1)expect(s.src).toContain('-400w.webp');if(width===390&&dpr===2)expect(s.src).toContain('-800w.webp');
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await context.close();
});
