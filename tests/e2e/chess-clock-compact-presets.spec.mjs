import{test,expect}from'@playwright/test';
for(const width of[320,390,768,1440])test(`preset cards compact and stable ${width}`,async({page,baseURL})=>{
 await page.setViewportSize({width,height:844});await page.goto(baseURL+'/chess-clock/');
 const rects=()=>page.locator('.tile').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));const now=await rects();
 for(const r of now)expect(r.height).toBeGreaterThanOrEqual(44);
 await page.addStyleTag({content:'.tile {padding:14px}.tile::after {content:"Selected";visibility:hidden;font-size:.8rem;font-weight:800;margin-top:6px}'});const old=await rects();expect(old[0].height-now[0].height).toBeGreaterThan(20);await page.locator('style').last().evaluate(e=>e.remove());
 for(const tile of await page.locator('.tile').all()){await tile.click();expect(await rects()).toEqual(now);await expect(tile).toHaveAttribute('aria-pressed','true')}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
