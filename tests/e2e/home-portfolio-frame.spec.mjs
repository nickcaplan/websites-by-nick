import {test,expect} from '@playwright/test';
for(const width of[320,390,768,1024,1440])for(const theme of['dark','light'])test(`homepage screenshot frames ${width} ${theme}`,async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width,height:1000});await page.addInitScript(t=>localStorage.setItem('nick-theme',t),theme);await page.goto('/');
 const cards=page.locator('.work .project');await expect(cards).toHaveCount(3);
 for(const card of await cards.all()){
  await card.scrollIntoViewIfNeeded();const box=await card.evaluate(e=>{const c=getComputedStyle(e);return{inset:parseFloat(c.paddingLeft)+parseFloat(c.borderLeftWidth),gap:parseFloat(c.paddingRight)+parseFloat(c.borderRightWidth),ratio:getComputedStyle(e.querySelector('.cmp-stage')).aspectRatio}});
  if(await card.evaluate(e=>e.classList.contains('project-foa'))){const crop=await card.locator('.cmp-stage-foa').evaluate(e=>({width:parseFloat(getComputedStyle(e).width),frame:e.parentElement.clientWidth,offset:parseFloat(getComputedStyle(e).marginLeft)}));expect(crop.width/crop.frame).toBeCloseTo(1280/1140,2);expect(crop.offset/crop.frame).toBeCloseTo(-70/1140,2)}
  if(await card.evaluate(e=>e.classList.contains('project-sam'))){const crop=await card.locator('.cmp-stage-sam').evaluate(e=>({width:parseFloat(getComputedStyle(e).width),frame:e.parentElement.clientWidth,offset:parseFloat(getComputedStyle(e).marginLeft)}));expect(crop.width/crop.frame).toBeCloseTo(1280/1140,2);expect(crop.offset/crop.frame).toBeCloseTo(-70/1140,2)}
  if(await card.evaluate(e=>e.classList.contains('project-cmp'))){for(const hovered of[false,true]){if(hovered){await page.emulateMedia({reducedMotion:'no-preference'});await card.hover();await expect(card.locator('.cmp-stage-compass')).toHaveCSS('transform','none')}const bounds=await card.locator('.project-image').evaluate(e=>{const r=e.getBoundingClientRect();return[...e.querySelectorAll('img')].filter(x=>getComputedStyle(x).display!=='none').map(x=>{const b=x.getBoundingClientRect();return{left:b.left-r.left,top:b.top-r.top,right:r.right-b.right,bottom:r.bottom-b.bottom}})});for(const b of bounds)for(const v of Object.values(b))expect(v).toBeGreaterThanOrEqual(-1)}}
  expect(box.inset).toBe(width<=900?7:9);expect(box.gap).toBe(width<=900?7:9);expect(box.ratio).toMatch(/1280/);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
