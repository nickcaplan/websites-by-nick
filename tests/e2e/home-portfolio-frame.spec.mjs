import {test,expect} from '@playwright/test';
for(const width of[320,390,768,1024,1440])for(const theme of['dark','light'])test(`homepage screenshot frames ${width} ${theme}`,async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width,height:1000});await page.addInitScript(t=>localStorage.setItem('nick-theme',t),theme);await page.goto('/');
 const cards=page.locator('.work .project');await expect(cards).toHaveCount(3);
 for(const card of await cards.all()){
  await card.scrollIntoViewIfNeeded();const box=await card.evaluate(e=>{const c=getComputedStyle(e);return{inset:parseFloat(c.paddingLeft)+parseFloat(c.borderLeftWidth),gap:parseFloat(c.paddingRight)+parseFloat(c.borderRightWidth),ratio:getComputedStyle(e.querySelector('.cmp-stage')).aspectRatio}});
  if(await card.evaluate(e=>e.classList.contains('project-foa'))){const crop=await card.locator('.cmp-stage-foa').evaluate(e=>({width:parseFloat(getComputedStyle(e).width),frame:e.parentElement.clientWidth,offset:parseFloat(getComputedStyle(e).marginLeft)}));expect(crop.width/crop.frame).toBeCloseTo(1280/1140,2);expect(crop.offset/crop.frame).toBeCloseTo(-70/1140,2)}
  expect(box.inset).toBe(width<=900?7:9);expect(box.gap).toBe(width<=900?7:9);expect(box.ratio).toMatch(/1280/);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
