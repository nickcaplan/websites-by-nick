import { test, expect } from '@playwright/test';
for (const width of [1280,1440,1600,1920]) for (const theme of ['light','dark']) {
  test(`desktop type and content column ${width} ${theme}`, async ({page}) => {
    await page.setViewportSize({width,height:1000});
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.addInitScript(t => localStorage.setItem('nick-theme',t),theme);
    await page.goto('/homepage-concepts/');
    await page.evaluate(() => document.fonts.ready);
    const g = await page.evaluate(() => {
      const box = s => {const r=document.querySelector(s).getBoundingClientRect();return {left:r.left,width:r.width,center:(r.left+r.right)/2}};
      const line=document.querySelector('#hero-title .line'),cs=getComputedStyle(line);
      return {tracking:parseFloat(cs.letterSpacing)/parseFloat(cs.fontSize),work:box('.work'),hero:box('.entrance'),frame:box('.penframe'),about:box('.about-grid'),footer:box('.footer-bottom'),overflow:document.documentElement.scrollWidth>innerWidth};
    });
    expect(g.tracking).toBeCloseTo(-.025,3);
    expect(g.work.width).toBe(1040);
    expect(g.hero.width).toBe(1040);
    expect(g.about.width).toBeCloseTo(940,1);
    expect(g.footer.width).toBeCloseTo(940,1);
    expect(g.frame.width).toBeCloseTo(830,1);
    for(const s of ['work','hero','frame','about','footer']) expect(g[s].center).toBeCloseTo(width/2,1);
    expect(g.overflow).toBe(false);
    for(const word of ['remember.','enjoy.','love.']) {
      const gap=await page.evaluate(word=>{const e=document.querySelector('#hero-title .last em');e.textContent=word;const r=document.createRange();r.selectNodeContents(document.querySelector('#hero-title .line'));return document.querySelector('.bulb-outline').getBoundingClientRect().left-Math.max(e.getBoundingClientRect().right,r.getBoundingClientRect().right)},word);
      expect(gap).toBeGreaterThan(10);
    }
  });
}
