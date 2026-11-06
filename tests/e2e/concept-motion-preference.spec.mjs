import {test,expect} from '@playwright/test';
for(const initiallyPaused of [false,true]) test(`duplicate reduced-motion changes restore visitor choice ${initiallyPaused}`,async({page})=>{
 await page.addInitScript(()=>{const match=window.matchMedia.bind(window);window.matchMedia=query=>{const media=match(query);if(query==='(prefers-reduced-motion: reduce)')window.testReducedMedia=media;return media;};});
 await page.goto('/homepage-concepts/');const button=page.locator('.motion-toggle');if(initiallyPaused)await button.click();
 await page.emulateMedia({reducedMotion:'reduce'});await expect(button).toHaveAttribute('aria-pressed','true');
 await page.evaluate(()=>{window.testReducedMedia.dispatchEvent(new Event('change'));window.testReducedMedia.dispatchEvent(new Event('change'));});
 await page.emulateMedia({reducedMotion:'no-preference'});await expect(button).toHaveAttribute('aria-pressed',String(initiallyPaused));
 await page.emulateMedia({reducedMotion:'reduce'});await expect(button).toHaveAttribute('aria-pressed','true');await page.emulateMedia({reducedMotion:'no-preference'});await expect(button).toHaveAttribute('aria-pressed',String(initiallyPaused));
});
