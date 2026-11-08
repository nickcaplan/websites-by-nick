import{test,expect}from'@playwright/test';
for(const width of[390,1280])for(const theme of['dark','light'])test(`single readable pull stops on remember ${width} ${theme}`,async({page})=>{
 test.setTimeout(25000);await page.setViewportSize({width,height:900});await page.addInitScript(t=>localStorage.setItem('nick-theme',t),theme);await page.goto('/homepage-concepts/');
 await page.evaluate(()=>{const h=document.querySelector('#hero-title');window.beats=[];let wasLit=false;new MutationObserver(()=>{const lit=h.classList.contains('bulb-lit');if(lit&&!wasLit)window.beats.push({word:h.querySelector('.last em').textContent,t:performance.now()});wasLit=lit}).observe(h,{attributes:true,attributeFilter:['class']})});
 await expect.poll(()=>page.evaluate(()=>window.beats.length),{timeout:14000}).toBe(1);const beats=await page.evaluate(()=>window.beats);expect(beats.map(b=>b.word)).toEqual(['remember.']);
 await page.waitForTimeout(3000);expect(await page.evaluate(()=>window.beats.length)).toBe(1);await expect(page.locator('#hero-title .last em')).toHaveText('remember.');await expect(page.locator('#hero-title')).toHaveClass(/bulb-lit/);
});
