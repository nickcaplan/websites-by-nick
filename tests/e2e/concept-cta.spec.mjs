import {test,expect} from '@playwright/test';
for(const width of [320,360,390,430,1280])for(const theme of ['dark','light'])for(const motion of ['reduce','no-preference'])test(`hero work link and later contact ${width} ${theme} ${motion}`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.addInitScript(t=>localStorage.setItem('nick-theme',t),theme);await page.emulateMedia({reducedMotion:motion});await page.goto('/homepage-concepts/');await page.evaluate(()=>document.fonts.ready);
 const hero=page.locator('.hero-bottom .cta'),contact=page.locator('.work-contact .cta');
 await expect(hero).toHaveAccessibleName('See the work');await expect(hero).toHaveAttribute('href','#work');await expect(hero.locator('[aria-hidden="true"]')).toHaveText('↓');await expect(page.locator('html')).toHaveCSS('scroll-behavior',motion==='reduce'?'auto':'smooth');
 await expect(contact).toHaveAccessibleName("Let's make yours");await expect(contact).toHaveAttribute('href','/homepage-concepts/contact/');await expect(page.locator('header.nav nav a').filter({hasText:'Contact'})).toHaveAttribute('href','/homepage-concepts/contact/');
 expect(await contact.evaluate(e=>{const wrap=e.closest('.work-contact'),work=document.querySelector('#work'),about=document.querySelector('.about'),r=e.getBoundingClientRect();return wrap.previousElementSibling===work&&wrap.nextElementSibling===about&&r.top>=work.getBoundingClientRect().bottom&&r.right<=innerWidth&&r.left>=0})).toBe(true);
 await hero.focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(/#work$/);await expect.poll(()=>page.locator('#work').evaluate(e=>e.getBoundingClientRect().top),{timeout:5000}).toBeLessThan(90);await expect(page.locator('#work-title')).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 await contact.scrollIntoViewIfNeeded();await expect(contact).toBeVisible();await contact.click();await expect(page).toHaveURL(/\/homepage-concepts\/contact\/$/);
});
test('hero work anchor works without JavaScript',async({browser})=>{const context=await browser.newContext({javaScriptEnabled:false,reducedMotion:'reduce'});const page=await context.newPage();await page.goto('/homepage-concepts/');await page.locator('.hero-bottom .cta').click();await expect(page).toHaveURL(/#work$/);await context.close()});
