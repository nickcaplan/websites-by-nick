import{test,expect}from'@playwright/test';
for(const width of[390,1280])for(const theme of['light','dark'])for(const js of[true,false])test(`hero flows straight to work ${width} ${theme} js=${js}`,async({browser})=>{
 const c=await browser.newContext({viewport:{width,height:1000},javaScriptEnabled:js,reducedMotion:'reduce'});await c.addInitScript(t=>localStorage.setItem('nick-theme',t),theme);const page=await c.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/homepage-concepts/');
 await expect(page.locator('.composition,.entrance-end')).toHaveCount(0);await expect(page.getByText('For people who want to look like')).toHaveCount(0);await expect(page.getByText('Take a closer look')).toHaveCount(0);await expect(page.locator('.work .project')).toHaveCount(3);await expect(page.locator('.studio')).toHaveCount(1);
 await expect(page.locator('.hero-bottom .cta')).toHaveAttribute('href','#work');await page.locator('.hero-bottom .cta').click();await expect(page).toHaveURL(/#work$/);await expect(page.locator('#work-title')).toBeInViewport();
 if(js){expect(await page.evaluate(()=>{const h=document.querySelector('.hero-bottom').getBoundingClientRect(),w=document.querySelector('#work').getBoundingClientRect();return w.top-h.bottom})).toBeLessThan(100);expect(await page.evaluate(()=>[...document.querySelectorAll('a[href^="#"]')].every(a=>document.getElementById(a.hash.slice(1))))).toBe(true)}
 expect(errors).toEqual([]);await c.close();
});
