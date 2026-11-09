// Public-route equivalent of the approved design contract.
import{test,expect}from'@playwright/test';
const luminance=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
for(const width of[320,390,1280])for(const theme of['dark','light'])test(`word matches live bulb with readable contrast ${width} ${theme}`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.addInitScript(t=>localStorage.setItem('nick-theme',t),theme);await page.goto('/');
 for(const word of['enjoy','remember']){
  await expect(page.locator('#hero-title .last em')).toHaveText(word+'.',{timeout:12000});if(word==='remember')await expect(page.locator('#hero-title')).toHaveClass(/bulb-lit/);
  const c=await page.evaluate(()=>{const h=document.querySelector('#hero-title'),e=h.querySelector('.last em'),swatch=document.createElement('span');swatch.style.color=getComputedStyle(h).getPropertyValue('--bulb-colour');h.append(swatch);const bulb=getComputedStyle(swatch).color;swatch.remove();return{word:getComputedStyle(e).color,bulb,bg:getComputedStyle(document.body).backgroundColor,size:parseFloat(getComputedStyle(e).fontSize)}});
  expect(c.word).toBe(c.bulb);expect(c.size).toBeGreaterThanOrEqual(24);const parse=s=>s.match(/[\d.]+/g).slice(0,3).map(Number),a=luminance(parse(c.word)),b=luminance(parse(c.bg));expect((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toBeGreaterThanOrEqual(3);
 }
 await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('#hero-title .last em')).toHaveText('remember.');await expect(page.locator('#hero-title')).toHaveAttribute('data-bulb-word','remember');
});
