import{test,expect}from'@playwright/test';
for(const width of[320,390,768,1440])test(`custom choice stays visible collapsed ${width}`,async({page,baseURL})=>{
 await page.setViewportSize({width,height:844});await page.goto(baseURL+'/chess-clock/');const row=page.locator('#custom-time summary');await row.click();await page.locator('[data-minutes="5"]').click();await page.locator('[data-inc="5"]').click();await row.click();await expect(row).toContainText('5 min + 5 s');expect((await row.boundingBox()).height).toBeGreaterThanOrEqual(44);
 await page.reload();await expect(row).toContainText('5 min + 5 s');await page.locator('[data-preset="3,2"]').click();await expect(row).toContainText('3 min + 2 s');expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
