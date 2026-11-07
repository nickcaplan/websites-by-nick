// Text-only enlargement retains all content and never needs horizontal scroll.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { startStaticServer } from './lib/static-server.mjs';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
const server = await startStaticServer(fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, ''));
const browser = await chromium.launch({executablePath:process.env.CHROME_PATH || (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined)});
try {
  for (const width of [320, 390, 768, 1280, 1400]) for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: theme });
    await page.addInitScript(value => localStorage.setItem('nick-theme', value), theme);
    await page.goto(`http://localhost:${server.address().port}/homepage-concepts/`);
    assert.equal(await page.locator('body').evaluate(e => e.classList.contains('dark')), theme === 'dark');
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole('button', { name: 'Pause motion', exact: true }).click();
    await page.evaluate(() => {
      const elements = [...document.querySelectorAll('body *')].filter(e => !e.closest('svg'));
      const sizes = elements.map(e => parseFloat(getComputedStyle(e).fontSize));
      elements.forEach((e, i) => { e.style.fontSize = sizes[i] * 2 + 'px'; });
    });
    // Inspect character line boxes: complete words must never split mid-word.
    const brokenWords = await page.locator('#hero-title').evaluate(el => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const chars = [];
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (node.parentElement.closest('svg')) continue;
        for (let i = 0; i < node.length; i++) {
          const range = document.createRange(); range.setStart(node, i); range.setEnd(node, i + 1);
          const r = range.getBoundingClientRect(); chars.push({ char: node.textContent[i], top: Math.round(r.top), line: node.parentElement.closest('.line') });
        }
      }
      let previous = null, broken = false;
      for (const item of chars) {
        if (/\s/.test(item.char)) { previous = null; continue; }
        if (previous && item.line === previous.line && Math.abs(item.top - previous.top) > 5) broken = true;
        previous = item;
      }
      return broken;
    });
    assert.equal(brokenWords, false, `hero splits a word: ${width} ${theme}`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `200% text overflow: ${width} ${theme}`);
    for (const el of await page.locator('.nav nav a, .nav nav button, .cta, .footer-cta').all()) {
      const rect = await el.boundingBox();
      assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= width + 1, `control outside viewport: ${width}`);
    }
    await page.close();
    console.log('PASS text200', width, theme);
  }
  for (const width of [320, 390, 768, 900]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    await page.goto(`http://localhost:${server.address().port}/homepage-concepts/`);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `reduced motion overflow: ${width}`);
    assert.ok(await page.locator('.project').evaluateAll(es => es.length > 0 && es.every(e => getComputedStyle(e).position === 'relative')));
    await page.close(); console.log('PASS reduced containment', width);
  }
  for (const width of [320, 390, 600, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    await page.goto(`http://localhost:${server.address().port}/homepage-concepts/pricing/`);
    assert.ok(await page.locator('.card h2').evaluateAll(es => es.length > 0 && es.every(e => getComputedStyle(e).marginTop === '0px')), `price card top gap: ${width}`);
    await page.close(); console.log('PASS price heading gap', width);
  }
  {
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    await page.goto(`http://localhost:${server.address().port}/homepage-concepts/`);
    await page.getByRole('button', { name: 'Pause motion', exact: true }).click();
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => [...document.querySelectorAll('.project')].every(e => getComputedStyle(e).position === 'relative' && ['auto', '0px'].includes(getComputedStyle(e).top)));
    assert.ok(await page.locator('.project').count() > 0);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    const frame=await page.locator('.penframe').boundingBox(),caption=await page.locator('.pf-nav').boundingBox();
    assert.ok(caption.y>frame.y+25 && caption.y+caption.height<frame.y+frame.height, 'frame caption is contained below toolbar');
    await page.close(); console.log('PASS late reduced-motion and wide frame caption');
  }
} finally { await browser.close(); server.close(); }
