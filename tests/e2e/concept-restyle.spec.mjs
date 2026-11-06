import { test, expect } from '@playwright/test';
const prefix='/homepage-concepts/';
test.beforeEach(async({page})=>{ await page.route('**/formspree.io/**',r=>r.abort()); });
for(const name of ['contact','experience','privacy']) for(const width of [320,390,768,1280]) {
 test(`${name} ${width}: dark default, consistent links, enlarged text`,async({page})=>{
  await page.setViewportSize({width,height:900}); await page.goto(prefix+name+'/');
  await expect(page.locator('body')).toHaveClass(/dark/);
  await expect(page.locator('h1')).toHaveCount(1);
  for(const a of await page.locator('header a,footer a').all()) {const href=await a.getAttribute('href');expect(href).toMatch(/^\/homepage-concepts\//)}
  await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>{const es=[...document.querySelectorAll('body *')].filter(e=>!e.closest('svg'));const sz=es.map(e=>parseFloat(getComputedStyle(e).fontSize));es.forEach((e,i)=>e.style.fontSize=sz[i]*2+'px')});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}
test('saved light survives nav, reload and early bootstrap without page script',async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('nick-theme','light'));await page.route('**/pages.js',r=>r.abort());
 await page.goto(prefix+'contact/');await expect(page.locator('body')).not.toHaveClass(/dark/);
 await page.reload();await expect(page.locator('body')).not.toHaveClass(/dark/);
});
test('career disclosure can open close and repeat with keyboard',async({page})=>{
 await page.goto(prefix+'experience/');await page.locator('[data-cookie-choice="essential"]').click();const d=page.locator('.career-history'),s=d.locator('summary');
 await s.focus();await page.keyboard.press('Enter');await expect(d).toHaveAttribute('open','');await page.keyboard.press('Enter');await expect(d).not.toHaveAttribute('open','');await s.click();await expect(d).toHaveAttribute('open','');
});
test('contact validation, network failure, retry, success and repeat',async({page})=>{
 await page.goto(prefix+'contact/');await page.locator('[data-cookie-choice="essential"]').click();await page.getByRole('button',{name:'Send message',exact:true}).click();await expect(page.locator('#contact-name')).toBeFocused();
 await page.getByLabel('Name',{exact:true}).fill('Test visitor');await page.getByLabel('Email',{exact:true}).fill('visitor@example.com');await page.getByLabel('Message',{exact:true}).fill('Intercepted test only.');
 await page.getByRole('button',{name:'Send message',exact:true}).click();await expect(page.locator('#contact-status')).toContainText('Check your connection');await expect(page.locator('#contact-message')).toHaveValue('Intercepted test only.');
 await page.route('**/formspree.io/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));await page.getByRole('button',{name:'Send message',exact:true}).click();await expect(page.locator('#contact-status')).toContainText('your message has been sent');await page.getByRole('button',{name:'Send another message',exact:true}).click();await expect(page.locator('#contact-name')).toHaveValue('');await expect(page.locator('#contact-name')).toBeFocused();
});
test('privacy consent reject, reopen, accept preview, withdraw',async({page})=>{
 await page.goto(prefix+'privacy/');await expect(page.locator('.cookie-banner a')).toHaveAttribute('href',/\/homepage-concepts\/privacy\//);await page.locator('[data-cookie-choice="essential"]').click();await page.reload();await expect(page.locator('#cookie-consent-panel')).toBeHidden();await page.getByRole('button',{name:'Cookie preferences',exact:true}).click();await page.locator('[data-cookie-choice="analytics"]').click();await expect(page.locator('[data-google-analytics]')).toHaveCount(0);await page.getByRole('button',{name:'Cookie preferences',exact:true}).click();await page.locator('[data-cookie-choice="essential"]').click();await expect(page.locator('#cookie-consent-panel')).toBeHidden();
});
test('noJS retains content, native form and career disclosure',async({browser,baseURL})=>{
 const c=await browser.newContext({javaScriptEnabled:false});const p=await c.newPage();await p.route('**/formspree.io/**',r=>r.abort());await p.goto(baseURL+prefix+'contact/');await expect(p.locator('form')).toHaveAttribute('method','POST');await expect(p.locator('form')).not.toHaveAttribute('novalidate','');await p.goto(baseURL+prefix+'experience/');await p.locator('summary').click();await expect(p.locator('.career-history')).toHaveAttribute('open','');await c.close();
});
