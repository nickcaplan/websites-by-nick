import{test,expect}from'@playwright/test';
for(const width of[320,390,768,1440])test(`preset cards compact and stable ${width}`,async({page,baseURL})=>{
 await page.setViewportSize({width,height:844});await page.goto(baseURL+'/chess-clock/');
 const rects=()=>page.locator('.tile').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));const now=await rects();
 for(const r of now)expect(r.height).toBeGreaterThanOrEqual(44);
 await page.addStyleTag({content:'.tile {padding:14px}.tile::after {content:"Selected";visibility:hidden;font-size:.8rem;font-weight:800;margin-top:6px}'});const old=await rects();expect(old[0].height-now[0].height).toBeGreaterThan(20);await page.locator('style').last().evaluate(e=>e.remove());
 for(const tile of await page.locator('.tile').all()){await tile.click();expect(await rects()).toEqual(now);await expect(tile).toHaveAttribute('aria-pressed','true')}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});

test('selection has no inset outline on load, click, blur or reload; keyboard focus remains',async({page,baseURL})=>{
 await page.goto(baseURL+'/chess-clock/');const tile=page.locator('[data-preset="3,2"]');
 const selected=page.locator('.tile[aria-pressed="true"]');
 const noOutline=async()=>expect(await selected.evaluate(e=>getComputedStyle(e).outlineStyle)).toBe('none');
 await noOutline();await tile.click();await noOutline();await page.locator('h1').click();await noOutline();await page.reload();await noOutline();
 await page.keyboard.press('Tab');
 while(!(await tile.evaluate(e=>e===document.activeElement)))await page.keyboard.press('Tab');
 expect(await tile.evaluate(e=>e.matches(':focus-visible'))).toBe(true);
 expect(await tile.evaluate(e=>getComputedStyle(e).outlineStyle)).toBe('solid');
 expect(await tile.evaluate(e=>getComputedStyle(e).outlineOffset)).toBe('3px');
});
