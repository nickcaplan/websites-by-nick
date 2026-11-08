import { test, expect } from '@playwright/test';
const prefix='/homepage-concepts/';
test.beforeEach(async({page})=>{ await page.route('**/formspree.io/**',r=>r.abort()); });
for(const name of ['contact','experience','privacy']) for(const width of [320,390,768,1280]) {
 test(`${name} ${width}: dark default, consistent links, enlarged text`,async({page})=>{
  await page.setViewportSize({width,height:900}); await page.goto(prefix+name+'/');
  await expect(page.locator('body')).toHaveClass(/dark/);
  await expect(page.locator('h1')).toHaveCount(1);
  for(const a of await page.locator('header a,footer a').all()) {const href=await a.getAttribute('href');expect(href).toMatch(name==='contact'?/^(\/homepage-concepts\/|#contact-form$)/:/^\/homepage-concepts\//)}
  await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>{const es=[...document.querySelectorAll('body *')].filter(e=>!e.closest('svg'));const sz=es.map(e=>parseFloat(getComputedStyle(e).fontSize));es.forEach((e,i)=>e.style.fontSize=sz[i]*2+'px')});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.locator('.cookie-banner')).toBeVisible();
  expect(await page.locator('.cookie-banner').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
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

for(const path of ['', 'contact/', 'experience/', 'privacy/']) {
 test(`theme toggle persists on ${path || 'home'}`, async({page})=>{
  await page.goto(prefix+path); await page.locator('.theme-toggle').click();
  expect(await page.evaluate(()=>localStorage.getItem('nick-theme'))).toBe('light');
  await page.reload(); await expect(page.locator('body')).not.toHaveClass(/dark/);
  await page.locator('.theme-toggle').click();expect(await page.evaluate(()=>localStorage.getItem('nick-theme'))).toBe('dark');await page.reload();await expect(page.locator('body')).toHaveClass(/dark/);
 });
 test(`early light bootstrap on ${path || 'home'}`,async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('nick-theme','light'));
  await page.route('**/pages.js',r=>r.abort()); await page.route('**/motion.js',r=>r.abort());
  await page.goto(prefix+path); await expect(page.locator('body')).not.toHaveClass(/dark/);
 });
}

test('Contact footer preserves an unfinished message',async({page})=>{
 await page.goto(prefix+'contact/');await page.locator('[data-cookie-choice="essential"]').click();await page.getByLabel('Message',{exact:true}).fill('An unfinished message');await page.locator('.footer-cta').click();await expect(page).toHaveURL(/#contact-form$/);await expect(page.getByLabel('Message',{exact:true})).toHaveValue('An unfinished message');
});

// Experience prose must not inherit the homepage browser-card motion class.
for(const width of [320,390,1280]) for(const theme of ['dark','light']) {
 test(`Experience prose stays straight and fills its column at ${width} ${theme}`,async({page})=>{
  await page.setViewportSize({width,height:900});
  await page.addInitScript(theme=>{localStorage.setItem('nick-theme',theme);localStorage.setItem('websites-by-nick-cookie-preferences','essential')},theme);
  await page.goto(prefix+'experience/');await page.evaluate(()=>document.fonts.ready);
  await expect(page.locator('.community')).toHaveCount(0);
  const paragraphs=page.locator('.experience-prose');await expect(paragraphs).toHaveCount(2);
  for(const paragraph of await paragraphs.all()) {
   await paragraph.scrollIntoViewIfNeeded();
   const geometry=await paragraph.evaluate(e=>{const s=getComputedStyle(e),p=getComputedStyle(e.parentElement);return {transform:s.transform,animation:s.animationName,width:e.getBoundingClientRect().width,expected:Math.min(760,e.parentElement.clientWidth-parseFloat(p.paddingLeft)-parseFloat(p.paddingRight))}});
   expect(geometry.transform).toBe('none');expect(geometry.animation).toBe('none');expect(Math.abs(geometry.width-geometry.expected)).toBeLessThan(2);
  }
 });
}

for(const name of ['contact','experience','privacy']) for(const width of [390,1280]) {
 test(`${name} compact header spacing at ${width}`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.goto(prefix+name+'/');
  expect(await page.locator('main').evaluate(e=>parseFloat(getComputedStyle(e).paddingTop))).toBe(width<600?12:24);
 });
}


test('Contact starts with the headline, without an empty eyebrow gap', async ({ page }) => {
  await page.goto('/homepage-concepts/contact/');
  await expect(page.locator('.page-hero > :first-child')).toHaveJSProperty('tagName', 'H1');
  await expect(page.locator('.page-hero .eyebrow')).toHaveCount(0);
  const gap = await page.locator('.page-hero').evaluate(hero => hero.querySelector('h1').getBoundingClientRect().top - hero.getBoundingClientRect().top);
  expect(gap).toBeLessThanOrEqual(1);
});

for(const route of ['experience','privacy','charity']) {
 test(`restyled ${route} starts with headline without an eyebrow gap`,async({page})=>{
  await page.goto(`/homepage-concepts/${route}/`);
  await expect(page.locator('.page-hero > :first-child')).toHaveJSProperty('tagName','H1');
  await expect(page.locator('.page-hero .eyebrow')).toHaveCount(0);
  const gap=await page.locator('.page-hero').evaluate(e=>e.querySelector('h1').getBoundingClientRect().top-e.getBoundingClientRect().top);
  expect(gap).toBeLessThanOrEqual(1);
 });
}

test('banner overflow measurement detects an oversized child',async({page})=>{
 await page.goto('/homepage-concepts/contact/');
 await page.locator('.cookie-banner').evaluate(e=>{const child=document.createElement('div');child.style.width='3000px';child.textContent='Synthetic overflow';e.appendChild(child)});
 expect(await page.locator('.cookie-banner').evaluate(e=>e.scrollWidth>e.clientWidth)).toBe(true);
});
