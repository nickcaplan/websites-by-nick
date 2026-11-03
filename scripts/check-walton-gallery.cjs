// Verify the loaded gallery at phone, tablet and desktop widths.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = { '.html': 'text/html', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = path.resolve(root, `.${pathname}`);
    if (file !== root && !file.startsWith(`${root}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }
    if (pathname.endsWith('/')) file = path.join(file, 'index.html');
    response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    response.end(fs.readFileSync(file));
  } catch {
    response.writeHead(404).end();
  }
});
(async () => {
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}/walton-firs/`);
      const images = page.locator('.photo-pair img');
      assert.equal(await images.count(), 2, 'the gallery has two photos');
      for (const image of await images.all()) {
        await image.scrollIntoViewIfNeeded();
        await image.evaluate(async element => { await element.decode(); });
      }
      const sizes = await images.evaluateAll(elements => elements.map(element => ({
        width: element.clientWidth, height: element.clientHeight,
        loaded: element.complete && element.naturalWidth > 0
      })));
      for (const size of sizes) {
        assert(size.loaded, 'photo loaded');
        assert(size.width > 0 && size.height > 0, 'photo visible');
        assert(Math.abs(size.width / size.height - 4 / 3) < 0.02, 'photo is 4:3');
      }
      console.log(width, sizes);
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
