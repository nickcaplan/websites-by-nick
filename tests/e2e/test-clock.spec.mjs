import { test, expect } from '@playwright/test';

// Browser checks for the unlisted chess clock at /test-clock/.
// The page exposes a small window.chessClock surface so timing states can be
// driven deterministically without waiting on real minutes.

async function fresh(page, baseURL) {
  await page.goto(baseURL + '/test-clock/');
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(baseURL + '/test-clock/');
}

test('loads dark, unlisted and without external requests', async ({ page, baseURL }) => {
  const external = [];
  page.on('request', (r) => { if (!r.url().startsWith(baseURL)) external.push(r.url()); });
  await page.goto(baseURL + '/test-clock/');
  await expect(page).toHaveTitle(/Chess clock/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  expect(external).toEqual([]);
  await expect(page.locator('h1')).toHaveText('Chess clock');
});

test('not linked from public pages and absent from the sitemap', async ({ page, request, baseURL }) => {
  for (const route of ['/', '/about/', '/pricing/', '/charity/', '/contact/', '/prospects/']) {
    await page.goto(baseURL + route);
    await expect(page.locator('a[href*="/test-clock"]')).toHaveCount(0);
  }
  const sitemap = await request.get(baseURL + '/sitemap.xml');
  expect(await sitemap.text()).not.toContain('test-clock');
});

test('full game flow: start, first tap, turns, increment, pause, confirmed reset', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#time-chips [data-minutes="3"]').click();
  await page.locator('#inc-chips [data-inc="2"]').click();
  await page.locator('#start-btn').click();
  await expect(page.locator('#clock-view')).toBeVisible();
  expect((await page.evaluate(() => chessClock.getState())).phase).toBe('ready');

  // First tap on a side starts the OTHER player's clock.
  await page.locator('#p1').dispatchEvent('pointerdown');
  let state = await page.evaluate(() => chessClock.getState());
  expect(state.phase).toBe('running');
  expect(state.active).toBe('p2');
  const before = state.remaining.p2;
  await page.waitForTimeout(1100);
  state = await page.evaluate(() => chessClock.getState());
  expect(state.remaining.p2).toBeLessThan(before);
  expect(state.remaining.p1).toBe(3 * 60000);

  // Active player taps: their turn ends and they gain the 2s increment.
  await page.evaluate(() => chessClock.setRemainingMs('p2', 60000));
  await page.locator('#p2').dispatchEvent('pointerdown');
  state = await page.evaluate(() => chessClock.getState());
  expect(state.active).toBe('p1');
  expect(state.moves.p2).toBe(1);
  expect(state.remaining.p2).toBeGreaterThanOrEqual(61000);
  expect(state.remaining.p2).toBeLessThanOrEqual(63000);

  // Tapping the waiting side does nothing.
  await page.locator('#p2').dispatchEvent('pointerdown');
  state = await page.evaluate(() => chessClock.getState());
  expect(state.active).toBe('p1');

  // Pause, then reset requires a confirmation tap.
  await page.locator('#pause-btn').click();
  expect((await page.evaluate(() => chessClock.getState())).phase).toBe('paused');
  await expect(page.locator('#bar-status')).toHaveText('Paused');
  await page.locator('#reset-btn').click();
  expect((await page.evaluate(() => chessClock.getState())).phase).toBe('paused');
  await page.locator('#reset-btn').click();
  state = await page.evaluate(() => chessClock.getState());
  expect(state.phase).toBe('ready');
  expect(state.remaining.p1).toBe(3 * 60000);
});

test('10 min + 3 s control: first completed move gives the mover exactly +3s', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#time-chips [data-minutes="10"]').click();
  await page.locator('#inc-chips [data-inc="3"]').click();
  await page.locator('#start-btn').click();
  // First tap starts the other player's clock, as Black starts White's.
  await page.locator('#p1').dispatchEvent('pointerdown');
  // Player 2 completes their first move: exactly +3s, not more.
  const state = await page.evaluate(() => {
    chessClock.setRemainingMs('p2', 600000);
    chessClock.press('p2');
    return chessClock.getState();
  });
  expect(state.moves.p2).toBe(1);
  expect(state.remaining.p2).toBe(603000);
  await expect(page.locator('#bar-status')).toHaveText('10 min + 3 s');
});

test('reset stays locked while the clock is running', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#start-btn').click();
  await page.locator('#p1').dispatchEvent('pointerdown');
  await expect(page.locator('#reset-btn')).toHaveAttribute('aria-disabled', 'true');
  await page.locator('#reset-btn').click({ force: true });
  expect((await page.evaluate(() => chessClock.getState())).phase).toBe('running');
});

test('flag fall ends the game and names the winner', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#start-btn').click();
  await page.locator('#p1').dispatchEvent('pointerdown');
  await page.evaluate(() => chessClock.setRemainingMs('p2', 400));
  await expect(page.locator('#bar-status')).toHaveText('Game over', { timeout: 3000 });
  await expect(page.locator('#p1-result')).toHaveText('Time! Player 1 wins');
  const state = await page.evaluate(() => chessClock.getState());
  expect(state.phase).toBe('ended');
  expect(state.winner).toBe('p1');
  // Tenths of a second show in the last 20 seconds.
  await page.evaluate(() => { chessClock.start(); chessClock.press('p1'); chessClock.setRemainingMs('p2', 15400); });
  await expect(page.locator('#p2-time')).toHaveText('0:15.4');
});

test('style, colour, theme and sound choices persist locally', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#style-chips [data-style-pick="tournament"]').click();
  await page.locator('#accent-chips [data-accent-pick="sky"]').click();
  await page.locator('#theme-chips [data-theme-pick="light"]').click();
  await page.goto(baseURL + '/test-clock/');
  expect(await page.evaluate(() => document.documentElement.dataset.style)).toBe('tournament');
  expect(await page.evaluate(() => document.documentElement.dataset.accent)).toBe('sky');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  // No tracking: nothing leaves the device when changing settings.
  const state = await page.evaluate(() => chessClock.getState());
  expect(state.settings.style).toBe('tournament');
});

test('settings sheet pauses the clock and switches style mid-game', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#start-btn').click();
  await page.locator('#p1').dispatchEvent('pointerdown');
  await page.locator('#settings-btn').click();
  expect((await page.evaluate(() => chessClock.getState())).phase).toBe('paused');
  await expect(page.locator('#settings-sheet')).toBeVisible();
  await page.locator('#sheet-style-chips [data-style-pick="studio"]').click();
  expect(await page.evaluate(() => document.documentElement.dataset.style)).toBe('studio');
  await page.keyboard.press('Escape');
  await expect(page.locator('#settings-sheet')).toBeHidden();
  await page.locator('#pause-btn').click();
  expect((await page.evaluate(() => chessClock.getState())).phase).toBe('running');
});

test('keyboard: space presses the active side', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#start-btn').click();
  await page.locator('body').press(' ');
  let state = await page.evaluate(() => chessClock.getState());
  expect(state.phase).toBe('running');
  await page.locator('body').press(' ');
  state = await page.evaluate(() => chessClock.getState());
  expect(state.active).toBe('p1');
});

test('no sideways scrolling at 320px, including 200% text', async ({ page, baseURL }) => {
  await page.goto(baseURL + '/test-clock/');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const view of ['setup', 'clock']) {
      if (view === 'clock') await page.evaluate(() => chessClock.start());
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), `${view} at ${width}`).toBe(false);
    }
  }
  await page.setViewportSize({ width: 320, height: 700 });
  await page.evaluate(() => chessClock.changeTime());
  await page.evaluate(() => {
    for (const x of document.querySelectorAll('body *')) {
      const size = parseFloat(getComputedStyle(x).fontSize);
      if (size) x.style.fontSize = size * 2 + 'px';
    }
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);

  // scrollWidth alone misses content clipped by overflow:hidden, so check the
  // bounding boxes of the visible pieces directly on both views.
  const fitsViewport = () => {
    const bad = [];
    const els = document.querySelectorAll(
      '.player, .player .time, .player .pname, .player .note, .turn-pill, .bar, .bar button, .bar .status, .sheet, .sheet h2, .sheet .group-label, .chips, .chips .chip'
    );
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue; // hidden
      if (r.left < -1 || r.right > window.innerWidth + 1) {
        bad.push(`${el.className} left=${Math.round(r.left)} right=${Math.round(r.right)}`);
      }
    }
    return bad;
  };
  for (const view of ['setup', 'clock']) {
    if (view === 'setup') await page.evaluate(() => chessClock.changeTime());
    if (view === 'clock') await page.evaluate(() => chessClock.start());
    expect(await page.evaluate(fitsViewport), `${view} at 320px 200% text`).toEqual([]);
  }
  await page.evaluate(() => document.getElementById('settings-btn').click());
  expect(await page.evaluate(fitsViewport), 'settings sheet at 320px 200% text').toEqual([]);
});

test('restores a paused game after reload', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#start-btn').click();
  await page.locator('#p1').dispatchEvent('pointerdown');
  await page.evaluate(() => chessClock.pause());
  await page.goto(baseURL + '/test-clock/');
  const state = await page.evaluate(() => chessClock.getState());
  expect(state.phase).toBe('paused');
  await expect(page.locator('#clock-view')).toBeVisible();
});

test('players style: the whole half is tappable, including edges and corners', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#start-btn').click();
  const box = await page.locator('#p1').boundingBox();
  const taps = [
    [box.x + 4, box.y + box.height - 4], // bottom-left outer corner
    [box.x + box.width - 4, box.y + 4], // top-right, towards the bar
    [box.x + 6, box.y + box.height / 2], // left edge strip
  ];
  for (const [x, y] of taps) {
    await page.mouse.click(x, y);
    expect((await page.evaluate(() => chessClock.getState())).active).toBe('p2');
    await page.evaluate(() => chessClock.press('p2'));
  }
});

test('settings sheet traps focus, closes on Escape and restores focus', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#start-btn').click();
  await page.locator('#settings-btn').click();
  await expect(page.locator('#settings-sheet')).toBeVisible();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press(i % 4 === 3 ? 'Shift+Tab' : 'Tab');
    const inside = await page.evaluate(() =>
      document.querySelector('#settings-sheet .sheet').contains(document.activeElement));
    expect(inside, `focus stays in the sheet (step ${i})`).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('#settings-sheet')).toBeHidden();
  await expect(page.locator('#settings-btn')).toBeFocused();
});

test('settings sheet opens at the top even with enlarged text', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 320, height: 500 });
  await page.goto(baseURL + '/test-clock/');
  await page.evaluate(() => chessClock.start());
  await page.evaluate(() => {
    for (const x of document.querySelectorAll('body *')) {
      const size = parseFloat(getComputedStyle(x).fontSize);
      if (size) x.style.fontSize = size * 2 + 'px';
    }
  });
  await page.locator('#settings-btn').click();
  await expect(page.locator('#settings-sheet')).toBeVisible();
  expect(await page.evaluate(() => document.querySelector('#settings-sheet .sheet').scrollTop)).toBe(0);
  await expect(page.locator('#settings-title')).toBeInViewport();
});

test('reloads offline once visited', async ({ page, context, baseURL, browserName }) => {
  // Playwright WebKit does not serve service-worker cached responses for
  // offline navigations; covered on Chromium and mobile Chrome instead.
  test.skip(browserName === 'webkit', 'Playwright WebKit cannot replay cached pages offline');
  await fresh(page, baseURL);
  await page.waitForFunction(() => !!(navigator.serviceWorker && navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('#start-btn')).toBeVisible();
  await page.locator('#start-btn').click();
  expect((await page.evaluate(() => chessClock.getState())).phase).toBe('ready');
  await context.setOffline(false);
});
