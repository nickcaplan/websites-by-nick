import{test,expect}from'@playwright/test';
for(const width of[320,390,768,1440])for(const theme of['dark','light'])test(`compact control bar ${width} ${theme}`,async({page,baseURL})=>{
 await page.setViewportSize({width,height:844});await page.goto(baseURL+'/chess-clock/');await page.locator('#start-btn').click();
 await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
 const metrics=()=>page.evaluate(()=>({bar:document.querySelector('.bar').getBoundingClientRect().toJSON(),status:document.querySelector('#bar-status').getBoundingClientRect().toJSON(),buttons:[...document.querySelectorAll('.bar button:not([hidden])')].map(e=>({id:e.id,...e.getBoundingClientRect().toJSON()})),players:[...document.querySelectorAll('.player')].map(e=>e.getBoundingClientRect().toJSON()),overflow:document.documentElement.scrollWidth>innerWidth}));
 const now=await metrics();expect(now.overflow).toBe(false);for(const r of now.buttons){expect(r.width).toBeGreaterThanOrEqual(44);expect(r.height).toBeGreaterThanOrEqual(44)}
 if(width<=560){expect(now.status.height).toBeLessThan(25);await page.addStyleTag({content:'.bar {grid-template-rows:minmax(44px,auto)}'});const old=await metrics();expect(old.bar.height-now.bar.height).toBeGreaterThan(20);for(let i=0;i<2;i++)expect(now.players[i].height).toBeGreaterThanOrEqual(old.players[i].height);await page.locator('style').last().evaluate(e=>e.remove())}
 await page.locator('#pause-btn').click();const paused=await metrics();expect(paused.bar.height).toBe(now.bar.height);if(width<=560)expect(paused.buttons).toEqual(now.buttons);
 await page.locator('#sound-toggle').click();const muted=await metrics();expect(muted.buttons).toEqual(paused.buttons);
});
