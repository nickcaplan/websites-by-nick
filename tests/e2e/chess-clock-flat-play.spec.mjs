import {test,expect} from '@playwright/test';
for(const theme of ['dark','light'])for(const accent of ['green','peach','sky'])test(`flat Play remains full size ${theme} ${accent}`,async({page})=>{
 await page.goto('/chess-clock/');await page.evaluate(({theme,accent})=>{document.documentElement.dataset.theme=theme;document.documentElement.dataset.accent=accent},{theme,accent});
 const button=page.locator('#start-btn');expect(await button.evaluate(e=>getComputedStyle(e).boxShadow)).toBe('none');
 const r=await button.boundingBox();expect(r.height).toBeGreaterThanOrEqual(60);expect(r.width).toBeGreaterThan(250);
 await button.focus();expect(await button.evaluate(e=>getComputedStyle(e).outlineWidth)).toBe('3px');
 await page.keyboard.press('Enter');await expect(page.locator('#clock-view')).toBeVisible();
});
