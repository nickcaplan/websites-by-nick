import {test,expect} from '@playwright/test';
for(const width of[320,390,700,1440])for(const javaScriptEnabled of[true,false])test(`wide real room image ${width} JS ${javaScriptEnabled}`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height:1000},javaScriptEnabled,reducedMotion:'reduce'});
 let source;
 try{
  const page=await context.newPage();await page.goto('/walton-park-dental/');
  const img=page.locator('.hero-photo img');await expect(img).toBeVisible();
  await expect.poll(()=>img.evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);
  const g=await img.evaluate(e=>{const r=e.getBoundingClientRect(),f=e.parentElement.getBoundingClientRect(),c=e.parentElement.previousElementSibling.getBoundingClientRect();return{width:r.width,height:r.height,src:e.currentSrc,fit:getComputedStyle(e).objectFit,top:f.top,copyBottom:c.bottom,overflow:document.documentElement.scrollWidth>innerWidth}});
  expect(g.overflow).toBe(false);expect(g.src).toContain('surgery-wide');source=g.src;
  if(width<=700){expect(g.width/g.height).toBeCloseTo(1.5,2);expect(g.fit).toBe('contain');expect(g.top).toBeGreaterThanOrEqual(g.copyBottom-.01)}
  await expect(page.locator('.hero-social a')).toHaveCount(2);
 }finally{await context.close()}
 // Firefox suppresses decode() callbacks in a script-disabled document, even
 // when the displayed image is complete. Decode the exact selected asset in a
 // separate script-enabled document, with no srcset density correction.
 const assetContext=await browser.newContext({javaScriptEnabled:true});
 try{
  const asset=await assetContext.newPage();await asset.goto(source);
  const raw=asset.locator('img');await expect(raw).toBeVisible();
  const natural=await raw.evaluate(async e=>{await e.decode();return e.naturalWidth});
  expect(natural).toBeGreaterThanOrEqual(width<=700?900:1440);
 }finally{await assetContext.close()}
});
