import {test,expect} from '@playwright/test';
for(const width of [320,390,1440])for(const scale of [1,2])test(`link action icons ${width} ${scale}`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});await page.addInitScript(()=>localStorage.setItem('nick-theme','light'));
 for(const route of ['/','/about/','/charity/','/pricing/','/contact/','/privacy/']){
 await page.goto(route);await page.evaluate(s=>{if(s===2){const es=[...document.querySelectorAll('body *')],sizes=es.map(e=>parseFloat(getComputedStyle(e).fontSize));es.forEach((e,i)=>e.style.setProperty('font-size',sizes[i]*2+'px','important'))}},scale);
 for(const a of await page.locator('a:has(.link-action-icon)').all()){
 const href=await a.getAttribute('href'),symbol=await a.locator('.link-action-icon').textContent();expect(symbol).toBe(href.startsWith('#')?'↓':href.startsWith('http')?'↗':'→');await expect(a.locator('.link-action-icon')).toHaveAttribute('aria-hidden','true');
 const inside=await a.evaluate(e=>{const i=e.querySelector('.link-action-icon').getBoundingClientRect(),b=e.getBoundingClientRect();return i.left>=b.left-1&&i.right<=b.right+1});expect(inside,route).toBe(true);
 }
 }
});
