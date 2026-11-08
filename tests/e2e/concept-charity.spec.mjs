import {test,expect} from '@playwright/test';
const root='/homepage-concepts/';
for(const width of [320,390,768,1280]) for(const theme of ['dark','light']) test(`charity ${width} ${theme}: layout, navigation, doubled text`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.addInitScript(t=>localStorage.setItem('nick-theme',t),theme);await page.emulateMedia({reducedMotion:'reduce'});await page.goto(root+'charity/');await page.evaluate(()=>document.fonts.ready);
 expect(await page.locator('body').evaluate(e=>e.classList.contains('dark'))).toBe(theme==='dark');await expect(page.locator('h1')).toContainText('Free websites');await expect(page.locator('.charity-list li')).toHaveCount(4);
 await expect(page.locator('nav a[aria-current="page"]')).toHaveText('Charity');await expect(page.locator('.charity-apply a')).toHaveAttribute('href',root+'contact/');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.evaluate(()=>{const es=[...document.querySelectorAll('body *')].filter(e=>!e.closest('svg'));const sizes=es.map(e=>parseFloat(getComputedStyle(e).fontSize));es.forEach((e,i)=>e.style.fontSize=sizes[i]*2+'px')});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
for(const path of ['','about/','pricing/','contact/','experience/','privacy/','charity/']) test(`Charity nav reachable from ${path||'home'}`,async({page})=>{
 await page.goto(root+path);const link=page.getByRole('navigation',{name:'Main',exact:true}).getByRole('link',{name:'Charity',exact:true});await expect(link).toHaveAttribute('href',root+'charity/');await link.click();await expect(page).toHaveURL(/\/homepage-concepts\/charity\/$/);
});
test('Charity saved light bootstrap without page script and noJS readable',async({page,browser,baseURL})=>{
 await page.addInitScript(()=>localStorage.setItem('nick-theme','light'));await page.route('**/pages.js',r=>r.abort());await page.goto(root+'charity/');await expect(page.locator('body')).not.toHaveClass(/dark/);await page.reload();await expect(page.locator('body')).not.toHaveClass(/dark/);
 const c=await browser.newContext({javaScriptEnabled:false});const p=await c.newPage();await p.goto(baseURL+root+'charity/');await expect(p.locator('body')).toHaveClass(/dark/);await expect(p.locator('.charity-list li')).toHaveCount(4);await c.close();
});

test('Charity theme toggle saves a choice across navigation',async({page})=>{
 await page.goto(root+'charity/');await page.locator('.theme-toggle').click();expect(await page.evaluate(()=>localStorage.getItem('nick-theme'))).toBe('light');await page.locator('.charity-apply a').click();await expect(page).toHaveURL(/\/homepage-concepts\/contact\/$/);await expect(page.locator('body')).not.toHaveClass(/dark/);await page.getByRole('navigation',{name:'Main',exact:true}).getByRole('link',{name:'Charity',exact:true}).click();await expect(page.locator('body')).not.toHaveClass(/dark/);
});
