import {test,expect} from '@playwright/test';
for(const width of [390,1440])for(const theme of ['dark','light'])test(`signature follows the wireframes ${width} ${theme}`,async({page},info)=>{
 await page.setViewportSize({width,height:1000});await page.addInitScript(t=>localStorage.setItem('nick-theme',t),theme);await page.goto('/');await page.locator('.studio').scrollIntoViewIfNeeded();const svg=page.locator('.studio svg');
 // Observe the hidden state and ordering atomically, before writing starts.
 await page.waitForFunction(()=>{const svg=document.querySelector('.studio svg');return svg.dataset.state==='running'&&Number(svg.dataset.step)<7&&[...svg.querySelectorAll('.sd-signature path')].every(p=>parseFloat(p.style.strokeDashoffset)>0)});
 await page.evaluate(()=>{window.earlySignatureInk=false;const svg=document.querySelector('.studio svg');const observer=new MutationObserver(()=>{if(Number(svg.dataset.step)<7&&[...svg.querySelectorAll('.sd-signature path')].some(p=>parseFloat(p.style.strokeDashoffset)<p.getTotalLength()-.1))window.earlySignatureInk=true});observer.observe(svg,{attributes:true,subtree:true,attributeFilter:['style','data-step']});});
 await page.waitForFunction(()=>{const p=document.querySelector('.sd-sign-cap'),v=parseFloat(p.style.strokeDashoffset);return v>p.getTotalLength()*.05&&v<p.getTotalLength()*.95});const track=await page.locator('.studio svg').evaluate(s=>{const p=s.querySelector('.sd-sign-cap'),len=p.getTotalLength(),t=1-parseFloat(p.style.strokeDashoffset)/len,P=p.getPointAtLength(len*t),hand=s.querySelector('.sd-hand').getAttribute('transform').match(/-?[\d.]+/g).map(Number);return Math.hypot(hand[0]+20-P.x,hand[1]-20-P.y)});expect(track).toBeLessThan(.3);
 await expect(svg).toHaveAttribute('data-state','complete',{timeout:20000});expect(await page.evaluate(()=>window.earlySignatureInk)).toBe(false);expect(await page.locator('.sd-signature path').evaluateAll(ps=>ps.every(p=>parseFloat(p.style.strokeDashoffset)===0))).toBe(true);await page.locator('.studio').screenshot({path:info.outputPath(`signature-${width}-${theme}.png`)});
});
for(const mode of ['reduce','no-js'])test(`signature static fallback ${mode}`,async({browser})=>{const c=await browser.newContext({reducedMotion:mode==='reduce'?'reduce':'no-preference',javaScriptEnabled:mode!=='no-js'});try{const p=await c.newPage();await p.goto('/');await expect(p.locator('.sd-signature path')).toHaveCount(4);expect(await p.locator('.sd-signature path').evaluateAll(ps=>ps.every(p=>!p.style.strokeDashoffset||parseFloat(p.style.strokeDashoffset)===0))).toBe(true);}finally{await c.close()}});

test('studio copy stays complete beneath the illustration without a caret', async({page})=>{
 for(const width of [390,1440]) {
  await page.setViewportSize({width,height:1000});await page.goto('/');await page.locator('.studio').scrollIntoViewIfNeeded();
  await expect(page.locator('.studio figcaption')).toHaveText('Thoughtful websites for small businesses, designed and built by Nick.');
  await expect(page.locator('.studio .tc-caret')).toHaveCount(0);
  const boxes=await page.locator('.studio').evaluate(s=>({drawing:s.querySelector('svg').getBoundingClientRect().bottom,copy:s.querySelector('figcaption').getBoundingClientRect().top}));
  expect(boxes.copy).toBeGreaterThan(boxes.drawing);
 }
});

test('laptop and phone stay separate and inside the canvas at every viewport',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const width of [320,390,768,1440]) {
  await page.setViewportSize({width,height:1000});await page.goto('/');
  const p=await page.locator('.studio svg').evaluate(s=>{const a=s.querySelector('.sd-laptop-base').getBoundingClientRect(),b=s.querySelector('.sd-phone').getBoundingClientRect(),board=s.querySelector('rect[width="332"]').getBoundingClientRect();return{gap:b.left-a.right,inside:b.right<board.right,overflow:document.documentElement.scrollWidth>innerWidth}});
  expect(p.gap).toBeGreaterThan(2);expect(p.inside).toBe(true);expect(p.overflow).toBe(false);
 }
});

test('colour is drawn with each shape, with no separate colouring steps',async({page})=>{
 await page.goto('/');await page.locator('.studio').scrollIntoViewIfNeeded();
 const sample=await page.waitForFunction(()=>{const s=document.querySelector('.studio svg'),p=s.querySelector('.sd-colour-hero');const offset=parseFloat(p.style.strokeDashoffset);return Number(s.dataset.step)===3&&offset>0&&offset<p.getTotalLength()*.95?{offset,step:Number(s.dataset.step)}:false});expect((await sample.jsonValue()).step).toBe(3);
 await expect(page.locator('.studio svg')).toHaveAttribute('data-state','complete',{timeout:15000});
 expect(await page.locator('.sd-paint').evaluateAll(ps=>ps.every(p=>Math.abs(parseFloat(p.style.strokeDashoffset))<.01))).toBe(true);
 await expect(page.locator('.studio svg')).toHaveAttribute('data-step','11');
});
for(const motion of['reduce','no-preference'])test(`hand-lettered board heading fits ${motion}`,async({page})=>{
 await page.emulateMedia({reducedMotion:motion});for(const width of[320,390,768,1440]){await page.setViewportSize({width,height:1000});await page.goto('/');await expect(page.locator('.sd-board-heading')).toHaveAttribute('aria-label','Designed with care.');const fit=await page.locator('.studio svg').evaluate(s=>{const h=s.querySelector('.sd-board-heading').getBoundingClientRect(),l=s.querySelector('.sd-laptop').getBoundingClientRect(),b=s.querySelector('rect[width="332"]').getBoundingClientRect();return h.bottom<l.top&&h.left>b.left&&h.right<b.right&&h.top>b.top});expect(fit).toBe(true)}
});
