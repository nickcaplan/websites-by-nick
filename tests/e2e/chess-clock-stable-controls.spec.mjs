import{test,expect}from'@playwright/test';
for(const width of[320,390,561,768,1440])for(const theme of['dark','light'])test(`controls stay put across ready running paused ${width} ${theme}`,async({page,baseURL})=>{
 await page.setViewportSize({width,height:844});await page.goto(baseURL+'/chess-clock/');await page.locator('#start-btn').click();await page.evaluate(t=>document.documentElement.dataset.theme=t,theme);
 const rects=()=>page.locator('.bar button:not([hidden])').evaluateAll(es=>es.map(e=>({id:e.id,...e.getBoundingClientRect().toJSON()})));
 const ready=await rects();for(const r of ready){expect(r.width).toBeGreaterThanOrEqual(44);expect(r.height).toBeGreaterThanOrEqual(44)}
 await page.locator('#pause-btn').click();expect(await rects()).toEqual(ready);
 await page.locator('#pause-btn').click();expect(await rects()).toEqual(ready);
 await page.locator('#pause-btn').click();expect(await rects()).toEqual(ready);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
