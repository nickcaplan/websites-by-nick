import {test,expect} from '@playwright/test';
for(const width of[320,390,768,920,1440])test(`Dental section links remain available ${width}`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/walton-park-dental/');
 const nav=page.getByRole('navigation',{name:'Sections'});await expect(nav).toBeVisible();await expect(nav.getByRole('link')).toHaveCount(6);
 for(const name of['Treatments','Dentists','FAQs']){const link=nav.getByRole('link',{name,exact:true});await link.scrollIntoViewIfNeeded();await expect(link).toBeVisible();await link.click();await expect(page).toHaveURL(new RegExp(name==='Treatments'?'#treatments':name==='Dentists'?'#dentists':'#faq'));}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)).toBe(false);
});
