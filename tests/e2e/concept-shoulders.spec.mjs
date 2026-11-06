import {test,expect} from '@playwright/test';
for(const width of [390,1280])test(`cartoon drawing arm stays on shoulder with fixed bones ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/homepage-concepts/');await page.locator('.studio').scrollIntoViewIfNeeded();
 for(let i=0;i<20;i++){
  const pose=await page.locator('.studio svg').evaluate(svg=>{const body=svg.querySelector('.sd-body'),arm=svg.querySelector('.sd-arm'),nums=arm.getAttribute('d').match(/-?[\d.]+/g).map(Number),dx=Number(body.getAttribute('transform').match(/-?[\d.]+/)[0]);return{nums,dx}});
  const [x,y,ex,ey,hx,hy]=pose.nums;expect(Math.abs(x-(pose.dx+366))).toBeLessThan(1);expect(y).toBe(260);expect(Math.abs(Math.hypot(ex-x,ey-y)-110)).toBeLessThan(1);expect(Math.abs(Math.hypot(hx-ex,hy-ey)-110)).toBeLessThan(1);expect(x).toBeGreaterThan(pose.dx+352);await page.waitForTimeout(160);
 }
});
