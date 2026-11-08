import {test,expect} from '@playwright/test';
for(const width of[390,1280])for(const dpr of[1,2])test(`only work imagery is requested ${width} DPR ${dpr}`,async({browser})=>{
 const context=await browser.newContext({viewport:{width,height:900},deviceScaleFactor:dpr,reducedMotion:'reduce'}),page=await context.newPage(),requests=[];page.on('request',r=>requests.push(r.url()));await page.goto('/homepage-concepts/');
 await expect(page.locator('.composition,.entrance-end')).toHaveCount(0);
 expect(requests.some(u=>/\/(sam-watch-desk-dark|foa-fireworks-desk)-(400|800|1280|1920)w\.webp/.test(u))).toBe(false);
 for(const project of await page.locator('.work .project').all()){
  await project.scrollIntoViewIfNeeded();for(const img of await project.locator('img:visible').all()){await expect.poll(()=>img.evaluate(e=>e.complete&&e.naturalWidth>0)).toBe(true);await img.evaluate(e=>e.decode());}
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await context.close();
});
