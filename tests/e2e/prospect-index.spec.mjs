import {test,expect} from '@playwright/test';
for(const width of [320,390,768,1440,1920])for(const js of[true,false])test(`prospect index ${width} JS ${js}`,async({browser,baseURL})=>{const c=await browser.newContext({baseURL,viewport:{width,height:1000},javaScriptEnabled:js});const p=await c.newPage();await p.goto('/prospects/');await expect(p.locator('body')).toHaveClass(/dark/);await expect(p.locator('h1')).toHaveText('Prospective websites.');await expect(p.locator('meta[name="robots"]')).toHaveAttribute('content','noindex, nofollow');await expect(p.locator('.prospect-list li')).toHaveCount(12);await expect(p.locator('.prospect-list a').first()).toHaveAttribute('href','/the-boathouse/');await expect(p.locator('.prospect-list a').first()).toContainText('The Boathouse');await expect(p.locator('button,input,select')).toHaveCount(0);expect(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);await p.locator('.prospect-list a').first().click();await expect(p).toHaveURL(/\/the-boathouse\/$/);await expect(p).toHaveTitle(/Boathouse/);await c.close()});
test('index is absent from navigation and sitemap',async({page,request})=>{for(const route of['/','/about/','/pricing/','/charity/','/contact/']){await page.goto(route);await expect(page.locator('a[href="/prospects/"]')).toHaveCount(0)}const r=await request.get('/sitemap.xml');expect(await r.text()).not.toContain('/prospects/');await page.goto('/prospects/');await page.keyboard.press('Tab');await expect(page.locator('.skip')).toBeFocused();await page.keyboard.press('Enter');await expect(page).toHaveURL(/#main$/)});

test('heading wraps at enlarged text size on narrow screens', async ({ page }) => {
  await page.setViewportSize({width:320,height:1000});
  await page.goto('/prospects/');
  await page.locator('h1').evaluate(el => el.style.fontSize = `${parseFloat(getComputedStyle(el).fontSize)*2}px`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test('all published prospect designs are listed once', async ({page}) => { await page.goto('/prospects/'); const links=await page.locator('.prospect-list a').evaluateAll(xs=>xs.map(x=>x.getAttribute('href'))); expect(links).toEqual(['/the-boathouse/', '/walton-park-dental/', '/kitchen-shop/', '/riverhouse-barn/', '/ozo-cafe/', '/wheatley-and-sons/', '/walton-firs/', '/stay-inspired/', '/talk-surrey/', '/elmbridge-community-link/', '/bangham-and-scratchett/', '/kumar-co/']); expect(new Set(links).size).toBe(12); await expect(page.locator('.index-note')).toContainText('Work in progress'); });

test('every listed prospect route returns a page',async({page,request})=>{await page.goto('/prospects/');for(const href of await page.locator('.prospect-list a').evaluateAll(xs=>xs.map(x=>x.getAttribute('href')))){const r=await request.get(href);expect(r.ok(),href).toBe(true);expect(await r.text()).toContain('<title>');}});

for (const width of [320,390,768,1440]) test(`showcase previews and contact ${width}`,async({page,request})=>{
  await page.setViewportSize({width,height:1000});await page.goto('/prospects/');
  await expect(page.locator('.wip-label')).toHaveText('Work in progress');
  await expect(page.locator('.index-note')).toContainText('not commissioned client projects');
  await expect(page.locator('.design-card img')).toHaveCount(24);
  for (const image of await page.locator('.design-card img').all()){await expect(image).toHaveAttribute('loading','lazy');await expect(image).toHaveAttribute('width',/^[1-9][0-9]+$/);await expect(image).toHaveAttribute('height',/^[1-9][0-9]+$/);const r=await request.get(await image.getAttribute('src'));expect(r.ok()).toBe(true);expect(r.headers()['content-type']).toContain('image/webp');}
  for(const a of await page.locator('a[href="/contact/"]').all()){await expect(a).toBeVisible();}
  await page.locator('.showcase-contact a').click();await expect(page).toHaveURL(/\/contact\/$/);
});

test('enlarged text keeps content within a phone and arrows with their last word',async({page})=>{
 await page.setViewportSize({width:320,height:1000});await page.goto('/prospects/');await page.evaluate(async()=>{await document.fonts.ready;const xs=[...document.querySelectorAll('body *')].map(x=>[x,parseFloat(getComputedStyle(x).fontSize)]);for(const[x,size]of xs)x.style.fontSize=size*2+'px';});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
 for(const tail of await page.locator('.cta-tail').all()){expect(await tail.evaluate(el=>getComputedStyle(el).whiteSpace)).toBe('nowrap');}
});

test('uncommissioned notice precedes every design link',async({page})=>{await page.goto('/prospects/');expect(await page.locator('.concept-note').evaluate(el=>Boolean(el.compareDocumentPosition(document.querySelector('.prospect-list'))&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);for(const image of await page.locator('.design-card img').all()){await expect(image).toHaveAttribute('srcset',/-small\.webp/);}});
