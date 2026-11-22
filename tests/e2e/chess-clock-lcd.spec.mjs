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
