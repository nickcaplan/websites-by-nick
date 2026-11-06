import {test,expect} from '@playwright/test';
for(const path of ['', 'about/', 'pricing/'])for(const width of[320,390,1280]) {
 test(`live-style theme control ${path||'home'} ${width}`,async({page})=>{
  await page.setViewportSize({width,height:900});await page.addInitScript(()=>{if(!localStorage.getItem('nick-theme'))localStorage.setItem('nick-theme','dark')});await page.goto('/homepage-concepts/'+path);
  const button=page.getByRole('button',{name:'Switch to light mode',exact:true});await expect(button).toBeVisible();await expect(button.locator('.theme-icon')).toHaveText('☀');
  const bounds=await button.boundingBox();expect(bounds.width).toBeGreaterThanOrEqual(44);expect(bounds.height).toBeGreaterThanOrEqual(44);
  const brand=await page.locator('header .wordmark').boundingBox();expect(Math.abs((bounds.y+bounds.height/2)-(brand.y+brand.height/2))).toBeLessThan(2);
  await expect(page.locator('header nav').getByRole('link',{name:'Contact',exact:true})).toHaveCount(1);
  await button.click();await expect(page.getByRole('button',{name:'Switch to dark mode',exact:true})).toBeVisible();await expect(page.locator('.theme-icon')).toHaveText('☾');expect(await page.evaluate(()=>localStorage.getItem('nick-theme'))).toBe('light');await page.reload();await expect(page.locator('body')).not.toHaveClass(/dark/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 });
}

for(const route of ['/homepage-concepts/','/homepage-concepts/about/','/homepage-concepts/pricing/']) {
 test(`theme button uses an action name without pressed state on ${route}`,async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('nick-theme','dark'));
  await page.goto(route);const button=page.locator('.theme-toggle');
  await expect(button).toHaveAttribute('aria-label','Switch to light mode');await expect(button).not.toHaveAttribute('aria-pressed');
  await button.click();await expect(button).toHaveAttribute('aria-label','Switch to dark mode');await expect(button).not.toHaveAttribute('aria-pressed');
 });
}
