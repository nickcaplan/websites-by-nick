import {test,expect} from '@playwright/test';
for(const width of [390,1280]) test(`caption reserves final responsive height while typing at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/homepage-concepts/');await page.evaluate(()=>document.fonts.ready);await page.locator('.studio').scrollIntoViewIfNeeded();await page.locator('.type-caption.typing').waitFor();
 const sample=()=>page.locator('.type-caption').evaluate(e=>({h:e.getBoundingClientRect().height,reserve:e.querySelector('.tc-reserve').getBoundingClientRect().height}));const first=await sample();expect(first.h).toBeGreaterThan(30);expect(first.h).toBe(first.reserve);
 let samples=0;const deadline=Date.now()+10000;
 while(await page.locator('.type-caption.typing').count()) {expect(Date.now()).toBeLessThan(deadline);const next=await sample();expect(Math.abs(next.h-first.h)).toBeLessThan(1);samples++;await page.waitForTimeout(100);}
 expect(samples).toBeGreaterThan(0);
 await page.locator('.type-caption.typed').waitFor();expect(Math.abs((await sample()).h-first.h)).toBeLessThan(1);await expect(page.locator('.type-caption .sr-only')).toHaveCount(1);await expect(page.locator('.tc-reserve')).toHaveAttribute('aria-hidden','true');await expect(page.locator('.tc-text')).toHaveAttribute('aria-hidden','true');await expect(page.locator('.tc-text em')).toHaveText('Nick.');
});
