import {test,expect} from '@playwright/test';
for(const width of [320,390,1440])for(const scale of [1,2])test(`link action icons ${width} ${scale}`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.emulateMedia({reducedMotion:'reduce'});await page.addInitScript(()=>localStorage.setItem('nick-theme','light'));
 for(const route of ['/','/about/','/charity/','/pricing/','/contact/','/privacy/']){
 await page.goto(route);await page.evaluate(s=>{if(s===2){const es=[...document.querySelectorAll('body *')],sizes=es.map(e=>parseFloat(getComputedStyle(e).fontSize));es.forEach((e,i)=>e.style.setProperty('font-size',sizes[i]*2+'px','important'))}},scale);
 for(const button of await page.locator('.contact-form .button').all()){
 const fit=await button.evaluate(e=>{const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode())for(const m of n.textContent.matchAll(/[A-Za-z]{3,}/g)){const r=document.createRange();r.setStart(n,m.index);r.setEnd(n,m.index+m[0].length);if(r.getClientRects().length>1)return false}return true});expect(fit,'form button keeps whole words').toBe(true);
 }
 for(const a of await page.locator('a:has(.link-action-icon)').all()){
 const href=await a.getAttribute('href'),symbol=await a.locator('.link-action-icon').textContent();expect(symbol).toBe(href.startsWith('#')?'↓':href.startsWith('http')?'↗':'→');await expect(a.locator('.link-action-icon')).toHaveAttribute('aria-hidden','true');
 const control=await a.evaluate(e=>e.matches('.cta,.footer-cta,.go'));
 if(control){
 await expect(a.locator(':scope > .link-action-icon')).toHaveCount(1);
 await expect(a.locator('.link-icon-word')).toHaveCount(0);
 const lane=await a.evaluate(e=>{
   const icon=e.querySelector('.link-action-icon'),i=icon.getBoundingClientRect(),b=e.getBoundingClientRect(),cs=getComputedStyle(e),is=getComputedStyle(icon);
   // Use local CSS coordinates for lane placement: pricing cards are rotated.
   const texts=[];
   const tw=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n;
   while(n=tw.nextNode())if(!icon.contains(n)&&n.textContent.trim()){
     const t=document.createRange();t.selectNodeContents(n);for(const x of t.getClientRects())texts.push({left:x.left,right:x.right});
   }
   return {position:is.position,inset:Math.abs(e.clientWidth-(parseFloat(is.left)+parseFloat(is.width)+parseFloat(is.right))),center:Math.abs(parseFloat(is.top)-e.clientHeight/2),clear:texts.every(t=>t.right<=i.left-2)};
 });
 expect(lane.position,route+' control uses reserved icon lane').toBe('absolute');
 expect(lane.inset,route+' icon matches right inset').toBeLessThan(1);
 expect(lane.center,route+' icon vertically centered').toBeLessThan(1);
 expect(lane.clear,route+' text stays clear of icon lane').toBe(true);
 }else{
 await expect(a.locator('.link-icon-word')).toHaveCount(1);expect(await a.locator('.link-icon-word').evaluate(e=>getComputedStyle(e).whiteSpace)).toBe('nowrap');
 }

 const inside=await a.evaluate(e=>{const i=e.querySelector('.link-action-icon').getBoundingClientRect(),b=e.getBoundingClientRect();return i.left>=b.left-1&&i.right<=b.right+1});expect(inside,route).toBe(true);
 }
 }
});
