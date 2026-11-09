import {test,expect} from '@playwright/test';
for(const width of [390,1280]) test(`caption is complete and static beneath the cartoon at ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto('/homepage-concepts/');await page.evaluate(()=>document.fonts.ready);
 const caption=page.locator('.studio figcaption');const copy='Thoughtful websites for small businesses, designed and built by Nick.';
 await expect(caption).toHaveText(copy);await page.locator('.studio').scrollIntoViewIfNeeded();
 await page.evaluate(()=>{window.captionMutations=0;new MutationObserver(()=>window.captionMutations++).observe(document.querySelector('.tc-text'),{subtree:true,childList:true,characterData:true})});
 await expect.poll(()=>page.locator('.studio svg').getAttribute('data-state'),{timeout:20000}).toBe('complete');
 await expect(caption).toHaveText(copy);expect(await page.evaluate(()=>window.captionMutations)).toBe(0);
 await expect(caption.locator('.tc-caret,.tc-reserve,.sr-only')).toHaveCount(0);await expect(caption.locator('.tc-text')).not.toHaveAttribute('aria-hidden','true');await expect(caption.locator('em')).toHaveText('Nick.');
 const position=await caption.evaluate(e=>({top:e.getBoundingClientRect().top,bottom:e.closest('.studio').querySelector('svg').getBoundingClientRect().bottom}));expect(position.top).toBeGreaterThan(position.bottom);
});
