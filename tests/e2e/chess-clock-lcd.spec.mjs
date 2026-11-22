import {test,expect} from '@playwright/test';
for(const width of [320,390,768,1440])for(const theme of ['dark','light'])test(`LCD depth stays in footprint ${width} ${theme}`,async({page})=>{
 await page.addInitScript(()=>{const now=Date.now();Date.now=()=>now});
 await page.setViewportSize({width,height:900});await page.goto('/chess-clock/');
 await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
 await page.locator('#start-btn').click();
 const rects=()=>page.locator('#p1,#p2,.player .time,.bar button').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}));
 await page.locator('#pause-btn').click();
 await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(180);
 const before=await rects();
 await page.locator('#p1').dispatchEvent('pointerdown',{pointerType:'touch'});
 await expect(page.locator('#p1')).toHaveClass(/tap-depth/);
 for(let i=0;i<4;i++){expect(await rects()).toEqual(before);await page.waitForTimeout(30)}
 await expect(page.locator('#p1')).not.toHaveClass(/tap-depth/);
 await page.locator('#p2').focus();await page.keyboard.press('Enter');
 await expect(page.locator('#p2')).toHaveClass(/tap-depth/);
 await expect.poll(()=>page.evaluate(()=>chessClock.getState().active)).toBe('p1');
 expect(await rects()).toEqual(before);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('reduced motion changes turns without a press animation',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/chess-clock/');await page.locator('#start-btn').click();
 await page.locator('#p1').dispatchEvent('pointerdown');
 await expect(page.locator('#p1')).not.toHaveClass(/tap-depth/);
 expect(await page.evaluate(()=>chessClock.getState().active)).toBe('p1');
 expect(await page.locator('#p1').evaluate(e=>getComputedStyle(e,'::before').animationName)).toBe('none');
});

for(const width of [320,390,768,1440])test(`LCD contains the entire content block at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:844});await page.goto('/chess-clock/');await page.locator('#start-btn').click();await page.locator('#pause-btn').click();
 for(const theme of ['dark','light']){
  await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
  const rows=await page.locator('.player').evaluateAll(panels=>panels.map(panel=>{
   const cs=getComputedStyle(panel,'::after'),r=panel.getBoundingClientRect(),rotate=panel.classList.contains('top');
   const top=r.top+parseFloat(rotate?cs.bottom:cs.top),bottom=r.bottom-parseFloat(rotate?cs.top:cs.bottom);
   const children=[...panel.querySelectorAll('.time,.side,.pname,.turn-pill')].filter(e=>e.getBoundingClientRect().height&&getComputedStyle(e).visibility!=='hidden'&&e.textContent.trim());
   return children.map(e=>{const c=e.getBoundingClientRect();return {name:e.className,top:c.top-top,bottom:bottom-c.bottom}})
  }));
  for(const row of rows.flat()){expect(row.top,row.name+' top breathing room').toBeGreaterThanOrEqual(4);expect(row.bottom,row.name+' bottom breathing room').toBeGreaterThanOrEqual(4)}
 }
});

test('clock targets suppress native tap highlight but retain keyboard focus',async({page})=>{
 await page.goto('/chess-clock/');
 const targets=page.locator('button,summary,input,select,label,[tabindex]');
 // Firefox has no WebKit native highlight property. Selection and focus still
 // run in every browser; assert the highlight where the browser implements it.
 const supportsHighlight=await page.evaluate(()=>CSS.supports('-webkit-tap-highlight-color','transparent'));
 if(supportsHighlight)for(const color of await targets.evaluateAll(es=>es.map(e=>getComputedStyle(e).webkitTapHighlightColor)))expect(color).toBe('rgba(0, 0, 0, 0)');
 await page.locator('#start-btn').click();await page.locator('#pause-btn').click();
 await page.locator('#p1').click();
 expect(await page.locator('#p1').evaluate(e=>getComputedStyle(e).userSelect)).toBe('none');
 await page.keyboard.press('Tab');
 expect(await page.evaluate(()=>document.activeElement.matches(':focus-visible'))).toBe(true);
 expect(await page.evaluate(()=>getComputedStyle(document.activeElement).outlineStyle)).toBe('solid');
 expect(await page.evaluate(()=>parseFloat(getComputedStyle(document.activeElement).outlineWidth))).toBeGreaterThanOrEqual(3);
});
