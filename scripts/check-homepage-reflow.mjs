// Text-only enlargement retains all content and never needs horizontal scroll.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import { startStaticServer } from './lib/static-server.mjs';
import { fileURLToPath } from 'node:url';
const server = await startStaticServer(fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, ''));
const browser = await chromium.launch();
try {
  for (const width of [320, 390, 768, 1280]) for (const theme of ['light', 'dark']) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, colorScheme: theme });
    await page.goto(`http://localhost:${server.address().port}/homepage-concepts/`);
    await page.evaluate(() => document.fonts.ready);
    await page.getByRole('button', { name: 'Pause motion', exact: true }).click();
    await page.evaluate(() => {
      const elements = [...document.querySelectorAll('body *')].filter(e => !e.closest('svg'));
      const sizes = elements.map(e => parseFloat(getComputedStyle(e).fontSize));
      elements.forEach((e, i) => { e.style.fontSize = sizes[i] * 2 + 'px'; });
    });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `200% text overflow: ${width} ${theme}`);
    for (const el of await page.locator('.nav nav a, .nav nav button, .cta, .entrance-end a, .footer-cta').all()) {
      const rect = await el.boundingBox();
      assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= width + 1, `control outside viewport: ${width}`);
    }
    await page.close();
    console.log('PASS text200', width, theme);
  }
} finally { await browser.close(); server.close(); }
