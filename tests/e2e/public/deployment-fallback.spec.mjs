import{test,expect}from'@playwright/test';
import{execFileSync}from'node:child_process';
import{readFileSync,rmSync}from'node:fs';
import{resolve}from'node:path';
import{randomUUID}from'node:crypto';
// Serve the actual generated Pages fallback HTML, not a mock redirect string.
test('Pages artifact fallbacks preserve queries and fragments in a browser',async({page})=>{
 const root=resolve(import.meta.dirname,'../../..'),dir=resolve(root,'.test-fallback-'+randomUUID());
 try{
  execFileSync(process.execPath,['scripts/prepare-public-deploy.mjs',dir],{cwd:root});
  await page.route('**/homepage-concepts/**',async route=>{
   const path=new URL(route.request().url()).pathname.slice('/homepage-concepts/'.length);
   if(!['','about/','pricing/','charity/','contact/','privacy/'].includes(path))return route.continue();
   await route.fulfill({contentType:'text/html',body:readFileSync(resolve(dir,'homepage-concepts',path,'index.html'),'utf8')});
  });
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const path of['','about/','pricing/','charity/','contact/','privacy/']){
   await page.goto('/homepage-concepts/'+path+'?promotion-check=1#arrival');
   await expect(page).toHaveURL(new RegExp('/'+path.replaceAll('/','\\/')+'\\?promotion-check=1#arrival$'));
   await expect(page.locator('h1')).toBeVisible();
   await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href','https://websitesbynick.co.uk/'+path);
  }
 }finally{rmSync(dir,{recursive:true,force:true})}
});
