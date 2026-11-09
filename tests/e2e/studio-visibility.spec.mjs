import { test, expect } from '@playwright/test';
for (const width of [320, 390, 768, 1440, 1920]) for (const theme of ['light', 'dark']) {
  test(`studio waits and stops outside view ${width} ${theme}`, async ({ page }) => {
    test.setTimeout(60000);
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(t => localStorage.setItem('nick-theme', t), theme);
    await page.goto('/');
    const svg = page.locator('.studio svg');
    await expect(svg).toHaveAttribute('data-state', 'idle');
    await expect(svg).not.toHaveClass(/studio-in-view/);
    const read = () => svg.evaluate(s => ({ step: s.dataset.step, arm: s.querySelector('.sd-arm').getAttribute('d'), time: s.querySelector('.sd-head').getAnimations()[0]?.currentTime, play: getComputedStyle(s.querySelector('.sd-head')).animationPlayState }));
    const initial = await read();
    await page.waitForTimeout(350);
    expect(await read()).toEqual(initial);
    expect(initial.play).toBe('paused');
    await svg.scrollIntoViewIfNeeded();
    await expect(svg).toHaveAttribute('data-state', 'running');
    await expect(svg).toHaveClass(/studio-in-view/);
    await expect.poll(async () => (await read()).play).toBe('running');
    await expect.poll(async () => (await read()).step).not.toBe('0');
    await page.evaluate(() => scrollTo(0, 0));
    await expect(svg).toHaveAttribute('data-state', 'idle');
    await expect(svg).not.toHaveClass(/studio-in-view/);
    const left = await read();
    await page.waitForTimeout(350);
    expect(await read()).toEqual(left);
    await svg.scrollIntoViewIfNeeded();
    await expect(svg).toHaveAttribute('data-state', 'running');
    await expect(svg).toHaveAttribute('data-step', '0');
    await expect(svg).toHaveAttribute('data-state', 'complete', { timeout: 45000 });
    await page.evaluate(() => scrollTo(0, 0));
    await expect(svg).not.toHaveClass(/studio-in-view/);
    await svg.scrollIntoViewIfNeeded();
    await expect(svg).toHaveAttribute('data-state', 'running');
  });
}
for (const mode of ['reduce', 'nojs']) test(`studio static fallback ${mode}`, async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: mode !== 'nojs', reducedMotion: mode === 'reduce' ? 'reduce' : 'no-preference' });
  const page = await context.newPage();
  await page.goto('/');
  const svg = page.locator('.studio svg');
  await svg.scrollIntoViewIfNeeded();
  await expect(svg).not.toHaveClass(/studio-live/);
  await expect(svg.locator('.sd-head')).toHaveCSS('animation-play-state', 'paused');
  await expect(svg.locator('.sd-signature')).toBeVisible();
  await context.close();
});
