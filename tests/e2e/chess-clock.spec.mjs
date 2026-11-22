import { test, expect } from '@playwright/test';

// Browser checks for the unlisted chess clock at /chess-clock/.
// The page exposes a small window.chessClock surface so timing states can be
// driven deterministically without waiting on real minutes.

async function fresh(page, baseURL) {
  await page.goto(baseURL + '/chess-clock/');
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(baseURL + '/chess-clock/');
}

test('loads dark, unlisted and without external requests', async ({ page, baseURL }) => {
  const external = [];
  page.on('request', (r) => { if (!r.url().startsWith(baseURL)) external.push(r.url()); });
  await page.goto(baseURL + '/chess-clock/');
  await expect(page).toHaveTitle(/Chess clock/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  expect(external).toEqual([]);
  await expect(page.locator('h1')).toHaveText('Play chess');
});

test('not linked from public pages and absent from the sitemap', async ({ page, request, baseURL }) => {
  for (const route of ['/', '/about/', '/pricing/', '/charity/', '/contact/', '/prospects/']) {
    await page.goto(baseURL + route);
    await expect(page.locator('a[href*="/test-clock"]')).toHaveCount(0);
    await expect(page.locator('a[href*="/chess-clock"]')).toHaveCount(0);
  }
  const sitemap = await request.get(baseURL + '/sitemap.xml');
  expect(await sitemap.text()).not.toContain('chess-clock');
});

test('full game flow: start, first tap, turns, increment, pause, confirmed reset', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#custom-time summary').click();
  await page.locator('#time-chips [data-minutes="3"]').click();
  await page.locator('#inc-chips [data-inc="2"]').click();
  await page.locator('#start-btn').click();
  await expect(page.locator('#clock-view')).toBeVisible();
  expect((await page.evaluate(() => chessClock.getState())).phase).toBe('ready');

  // Tapping Black before the game starts does nothing.
  await page.locator('#p2').dispatchEvent('pointerdown');
  expect((await page.evaluate(() => chessClock.getState())).phase).toBe('ready');

  // The Start button starts White's clock at once.
  await expect(page.locator('#pause-btn')).toHaveAttribute('aria-label', 'Start game');
  await page.locator('#pause-btn').click();
  let state = await page.evaluate(() => chessClock.getState());
  expect(state.phase).toBe('running');
  expect(state.active).toBe('p1');
  const before = state.remaining.p1;
  await page.waitForTimeout(1100);
  state = await page.evaluate(() => chessClock.getState());
  expect(state.remaining.p1).toBeLessThan(before);
  expect(state.remaining.p2).toBe(3 * 60000);
  await expect(page.locator('#pause-btn')).toHaveAttribute('aria-label', 'Pause');

  // Active player taps: their turn ends and they gain the 2s increment.
  await page.evaluate(() => chessClock.setRemainingMs('p1', 60000));
  await page.locator('#p1').dispatchEvent('pointerdown');
  state = await page.evaluate(() => chessClock.getState());
  expect(state.active).toBe('p2');
  expect(state.moves.p1).toBe(1);
  expect(state.remaining.p1).toBeGreaterThanOrEqual(61000);
  expect(state.remaining.p1).toBeLessThanOrEqual(63000);

  // Tapping the waiting side does nothing.
  await page.locator('#p1').dispatchEvent('pointerdown');
  state = await page.evaluate(() => chessClock.getState());
  expect(state.active).toBe('p2');

  // Pause, then reset requires a confirmation tap (reset lives in the sheet).
  await page.locator('#pause-btn').click();
  expect((await page.evaluate(() => chessClock.getState())).phase).toBe('paused');
  await expect(page.locator('#bar-status')).toHaveText('Paused');
  await page.locator('#settings-btn').click();
  await page.locator('#sheet-reset').click();
  expect((await page.evaluate(() => chessClock.getState())).phase).toBe('paused');
  await page.locator('#sheet-reset').click();
  state = await page.evaluate(() => chessClock.getState());
  expect(state.phase).toBe('ready');
  expect(state.remaining.p1).toBe(3 * 60000);
});

test('10 min + 3 s control: first completed move gives the mover exactly +3s', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#custom-time summary').click();
  await page.locator('#time-chips [data-minutes="10"]').click();
  await page.locator('#inc-chips [data-inc="3"]').click();
  await page.locator('#start-btn').click();
  // Start game runs White's clock; White completes the first move: exactly +3s, not more.
  await page.locator('#pause-btn').click();
  const state = await page.evaluate(() => {
    chessClock.setRemainingMs('p1', 600000);
    chessClock.press('p1');
    return chessClock.getState();
  });
  expect(state.moves.p1).toBe(1);
  expect(state.remaining.p1).toBe(603000);
  await expect(page.locator('#bar-status')).toHaveText('10 min + 3 s');
});

test('reset works from the settings sheet, behind a confirmation tap', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#start-btn').click();
  await page.locator('#pause-btn').click();
  await page.locator('#settings-btn').click();
  await expect(page.locator('#sheet-reset')).toHaveAttribute('aria-disabled', 'false');
  await page.locator('#sheet-reset').click();
  // First tap only arms the confirmation; the game is not reset.
  expect((await page.evaluate(() => chessClock.getState())).phase).not.toBe('ready');
  await page.locator('#sheet-reset').click();
  const state = await page.evaluate(() => chessClock.getState());
  expect(state.phase).toBe('ready');
  expect(state.remaining.p1).toBe(10 * 60000);
  // The sheet closes so players can start; the clock is usable, not inert.
  await expect(page.locator('#settings-sheet')).toBeHidden();
  expect(await page.evaluate(() => document.getElementById('clock-view').inert)).toBe(false);
  await page.locator('#pause-btn').click();
  expect((await page.evaluate(() => chessClock.getState())).phase).toBe('running');
});

test('flag fall ends the game and names the winner', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#start-btn').click();
  await page.locator('#pause-btn').click();
  await page.evaluate(() => chessClock.setRemainingMs('p1', 400));
  await expect(page.locator('#bar-status')).toHaveText('Game over', { timeout: 3000 });
  await expect(page.locator('#p2-result')).toHaveText('Time! Black wins');
  const state = await page.evaluate(() => chessClock.getState());
  expect(state.phase).toBe('ended');
  expect(state.winner).toBe('p2');
  // Tenths of a second show in the last 20 seconds.
  await page.evaluate(() => { chessClock.start(); chessClock.begin(); chessClock.setRemainingMs('p1', 15400); });
  await expect(page.locator('#p1-time')).toHaveText('0:15.4');
});

test('colour, theme and sound choices persist locally', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#appearance summary').click();
  await page.locator('#accent-chips [data-accent-pick="sky"]').click();
  await page.locator('#theme-chips [data-theme-pick="light"]').click();
  await page.locator('#more-options summary').click();
  await page.locator('#setup-sound-chips [data-sound-pick="off"]').click();
  await page.goto(baseURL + '/chess-clock/');
  expect(await page.evaluate(() => document.documentElement.dataset.accent)).toBe('sky');
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('light');
  // No tracking: nothing leaves the device when changing settings.
  const state = await page.evaluate(() => chessClock.getState());
  expect(state.settings.sound).toBe('off');
});

test('settings sheet pauses the clock, sound and move counter toggle from the bar', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#start-btn').click();
  await page.locator('#pause-btn').click();
  await page.locator('#settings-btn').click();
  expect((await page.evaluate(() => chessClock.getState())).phase).toBe('paused');
  await expect(page.locator('#settings-sheet')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#settings-sheet')).toBeHidden();
  // Sound and move counter toggle straight from the clock bar, mid-game.
  await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#sound-toggle').click();
  let state = await page.evaluate(() => chessClock.getState());
  expect(state.settings.sound).toBe('off');
  await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#moves-toggle').click();
  state = await page.evaluate(() => chessClock.getState());
  expect(state.settings.moves).toBe('on');
  expect(state.phase).toBe('paused'); // the toggles do not resume the clock
  await page.locator('#pause-btn').click();
  expect((await page.evaluate(() => chessClock.getState())).phase).toBe('running');
  await expect(page.locator('#p1-mv')).toContainText('move');
  // Both choices persist across a reload.
  await page.goto(baseURL + '/chess-clock/');
  state = await page.evaluate(() => chessClock.getState());
  expect(state.settings.moves).toBe('on');
  expect(state.settings.sound).toBe('off');
});

test('keyboard: space presses the active side', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#start-btn').click();
  await page.locator('body').press(' ');
  let state = await page.evaluate(() => chessClock.getState());
  expect(state.phase).toBe('running');
  expect(state.active).toBe('p1');
  await page.locator('body').press(' ');
  state = await page.evaluate(() => chessClock.getState());
  expect(state.active).toBe('p2');
});

test('no sideways scrolling at 320px, including 200% text', async ({ page, baseURL }) => {
  await page.goto(baseURL + '/chess-clock/');
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
      '.player, .player .time, .player .pname, .player .note, .turn-pill, .bar, .bar button, .bar .status, .sheet, .sheet h2, .sheet .group-label, .chips, .chips .chip, .tile, .name-field, .name-field input, .play-summary, .disclosure summary, .start'
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

test('a reload starts a fresh session on the setup screen, keeping settings', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.evaluate(() => localStorage.setItem('chess-clock-settings', JSON.stringify({ theme: 'light', accent: 'peach', sound: 'off', moves: 'on', minutes: 5, inc: 0, p1name: 'Ann', p2name: 'Bo' })));
  await page.goto(baseURL + '/chess-clock/');
  await page.locator('#start-btn').click();
  await page.locator('#pause-btn').click();
  await page.evaluate(() => chessClock.pause());
  await page.goto(baseURL + '/chess-clock/');
  const state = await page.evaluate(() => chessClock.getState());
  expect(state.phase).toBe('setup');
  expect(state.moves).toEqual({ p1: 0, p2: 0 });
  expect(state.settings).toEqual({ theme: 'light', accent: 'peach', sound: 'off', moves: 'on', minutes: 5, inc: 0, p1name: 'Ann', p2name: 'Bo' });
  await expect(page.locator('#start-btn')).toBeVisible();
  await expect(page.locator('#clock-view')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('chess-clock-game'))).toBeNull();
  // A game saved by an earlier version is discarded too.
  await page.evaluate(() => localStorage.setItem('chess-clock-game', JSON.stringify({ phase: 'paused', active: 'p1', remaining: { p1: 1000, p2: 1000 }, moves: { p1: 1, p2: 1 }, minutes: 10, inc: 3, savedAt: Date.now() })));
  await page.goto(baseURL + '/chess-clock/');
  expect((await page.evaluate(() => chessClock.getState())).phase).toBe('setup');
  expect(await page.evaluate(() => localStorage.getItem('chess-clock-game'))).toBeNull();
});

test('players style: the whole half is tappable, including edges and corners', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#start-btn').click();
  await page.evaluate(() => chessClock.begin());
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
    expect((await page.evaluate(() => chessClock.getState())).active).toBe('p1');
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
  await page.goto(baseURL + '/chess-clock/');
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

test('sheet buttons keep their text inside at 320px with 200% text', async ({ page, baseURL }) => {
  // Both zoom styles browsers offer: root em scaling and per-element text
  // sizing (the latter with important priority, as strict harnesses apply
  // it). No button may spill its text or cross the sheet's right edge.
  for (const mode of ['root', 'element']) {
    await page.setViewportSize({ width: 320, height: 700 });
    await page.goto(baseURL + '/chess-clock/');
    await page.evaluate(() => { chessClock.start(); chessClock.begin(); });
    await page.locator('#settings-btn').click();
    if (mode === 'root') {
      await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    } else {
      await page.evaluate(() => {
        for (const x of document.querySelectorAll('body *')) {
          const size = parseFloat(getComputedStyle(x).fontSize);
          if (size) x.style.setProperty('font-size', size * 2 + 'px', 'important');
        }
      });
    }
    await page.waitForTimeout(150);
    const result = await page.evaluate(() => {
      const sheetRight = document.querySelector('#settings-sheet .sheet').getBoundingClientRect().right;
      return ['sheet-close', 'sheet-resume', 'sheet-change-time'].map((id) => {
        const b = document.getElementById(id);
        return {
          id,
          insideSheet: b.getBoundingClientRect().right <= sheetRight + 1,
          textFits: b.scrollHeight <= b.clientHeight + 1 && b.scrollWidth <= b.clientWidth + 1,
        };
      });
    });
    for (const r of result) {
      expect(r.insideSheet, `${mode}: #${r.id} crosses the sheet's right edge`).toBe(true);
      expect(r.textFits, `${mode}: #${r.id} spills its text`).toBe(true);
    }
  }
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

test('player names: optional, editable, shown on the clock and persisted', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await expect(page.locator('#name-p1')).toHaveValue('');
  await expect(page.locator('#name-p2')).toHaveValue('');
  await page.locator('#name-p1').fill('Luca');
  await page.locator('#name-p2').fill('Dad');
  await expect(page.locator('#play-summary')).toContainText('Luca (White, bottom) vs Dad (Black, top)');
  await page.locator('#start-btn').click();
  await expect(page.locator('#p1 .pname')).toHaveText('Luca');
  await expect(page.locator('#p2 .pname')).toHaveText('Dad');
  await expect(page.locator('#p1')).toHaveAttribute('aria-label', /Luca/);
  // Empty falls back to the colour; the old default names are migrated away.
  await page.evaluate(() => { chessClock.changeTime(); });
  await page.locator('#name-p1').fill('');
  await expect(page.locator('#play-summary')).toContainText('White (bottom) vs Dad (Black, top)');
  await page.locator('#name-p1').fill('Luca');
  // Persisted across reloads.
  await page.goto(baseURL + '/chess-clock/');
  await expect(page.locator('#name-p1')).toHaveValue('Luca');
  await expect(page.locator('#name-p2')).toHaveValue('Dad');
});

test('game-over text names the winner', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#name-p1').fill('Luca');
  await page.locator('#start-btn').click();
  await page.evaluate(() => {
    chessClock.start();
    chessClock.begin();
    chessClock.press('p1');
    chessClock.setRemainingMs('p2', 100);
  });
  await page.waitForTimeout(700);
  await expect(page.locator('#p1-result')).toHaveText('Time! Luca wins');
});

test('settings sheet: resume actually resumes, close leaves the clock paused', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#start-btn').click();
  await page.locator('#pause-btn').click();
  await page.locator('#settings-btn').click();
  await expect(page.locator('#settings-title')).toHaveText('Game paused');
  await page.locator('#sheet-close').click();
  await expect(page.locator('#settings-sheet')).toBeHidden();
  expect((await page.evaluate(() => chessClock.getState())).phase).toBe('paused');
  await page.locator('#settings-btn').click();
  await page.locator('#sheet-resume').click();
  await expect(page.locator('#settings-sheet')).toBeHidden();
  expect((await page.evaluate(() => chessClock.getState())).phase).toBe('running');
});

test('change time asks before resetting the clock', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#start-btn').click();
  await page.locator('#pause-btn').click();
  await page.locator('#settings-btn').click();
  await page.locator('#sheet-change-time').click();
  // First tap only arms it: still in the game, confirmation showing.
  await expect(page.locator('#sheet-change-time')).toContainText('New game?');
  expect((await page.evaluate(() => chessClock.getState())).phase).toBe('paused');
  await page.locator('#sheet-change-time').click();
  await expect(page.locator('#setup-view')).toBeVisible();
  expect((await page.evaluate(() => chessClock.getState())).phase).toBe('setup');
});

test('armed new-game button stays inside the visible viewport at small widths with 200% text', async ({ page, baseURL }) => {
  // Arming New game swaps in a longer label; the action row must stay inside
  // the visible sheet so the confirm text is never cut off.
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 700 });
    await page.goto(baseURL + '/chess-clock/');
    await page.evaluate(() => { chessClock.start(); chessClock.begin(); });
    await page.locator('#settings-btn').click();
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await page.locator('#sheet-change-time').click();
    await page.waitForTimeout(150);
    const r = await page.evaluate(() => {
      const b = document.getElementById('sheet-change-time').getBoundingClientRect();
      return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, vw: innerWidth, vh: innerHeight };
    });
    expect(r.bottom, `${width}: armed button below visible bottom`).toBeLessThanOrEqual(r.vh);
    expect(r.top, `${width}: armed button above visible top`).toBeGreaterThanOrEqual(0);
    expect(r.right, `${width}: armed button past visible right edge`).toBeLessThanOrEqual(r.vw);
    expect(r.left, `${width}: armed button past visible left edge`).toBeGreaterThanOrEqual(0);
  }
});

test('the play button sits at the top of the setup screen', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  const btn = await page.locator('#start-btn').boundingBox();
  const timeHeading = await page.locator('#time-heading').boundingBox();
  expect(btn.y).toBeLessThan(timeHeading.y);
});

test('no 15 minute option anywhere', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await expect(page.locator('[data-preset="15,0"]')).toHaveCount(0);
  await page.locator('#custom-time summary').click();
  await expect(page.locator('#time-chips [data-minutes="15"]')).toHaveCount(0);
});

test('tapping either side while paused resumes the game', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#start-btn').click();
  await page.locator('#pause-btn').click();
  await page.locator('#pause-btn').click();
  expect((await page.evaluate(() => chessClock.getState())).phase).toBe('paused');
  await page.locator('#p2').dispatchEvent('pointerdown');
  let state = await page.evaluate(() => chessClock.getState());
  expect(state.phase).toBe('running');
  expect(state.active).toBe('p1'); // the side to move keeps ticking
  await page.locator('#pause-btn').click();
  await page.locator('#p1').dispatchEvent('pointerdown');
  state = await page.evaluate(() => chessClock.getState());
  expect(state.phase).toBe('running');
  expect(state.active).toBe('p1');
});

test('sound: audio context unlocks on the first tap', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#start-btn').click();
  await page.locator('#pause-btn').click();
  const audio = (await page.evaluate(() => chessClock.getState())).audio;
  expect(['running', 'suspended']).toContain(audio); // headless may keep it suspended; the unlock path must not throw
  await page.waitForTimeout(300);
  const settled = (await page.evaluate(() => chessClock.getState())).audio;
  // Headless Firefox never grants user activation to synthetic taps, so the
  // context legitimately stays suspended there; Chromium must be running.
  if (test.info().project.name.includes('firefox')) {
    expect(['running', 'suspended']).toContain(settled);
  } else {
    expect(settled).toBe('running');
  }
});

test('10 + 3 is the default, and the chosen preset stays selected after reload', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  let state = await page.evaluate(() => chessClock.getState());
  expect(state.settings.minutes).toBe(10);
  expect(state.settings.inc).toBe(3);
  await expect(page.locator('#preset-tiles [data-preset="10,3"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#play-summary')).toContainText('10 + 3');
  await page.locator('#preset-tiles [data-preset="3,2"]').click();
  state = await page.evaluate(() => chessClock.getState());
  expect(state.settings.minutes).toBe(3);
  expect(state.settings.inc).toBe(2);
  await page.goto(baseURL + '/chess-clock/');
  await expect(page.locator('#preset-tiles [data-preset="3,2"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#play-summary')).toContainText('3 + 2');
});

test('sheet sound and moves pickers keep the bar toggles in sync, both directions', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#start-btn').click();
  // Set a known starting state from the bar: sound off, moves on.
  await page.locator('#sound-toggle').click();
  await page.locator('#moves-toggle').click();
  await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-label', 'Sound off, tap to unmute');
  await expect(page.locator('#moves-toggle')).toHaveAttribute('aria-pressed', 'true');
  // Flip both from the settings sheet: sound on, moves off.
  await page.locator('#settings-btn').click();
  await page.locator('#sheet-sound-chips [data-sound-pick="on"]').click();
  await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-label', 'Sound on, tap to mute');
  await page.locator('#sheet-moves-chips [data-moves-pick="off"]').click();
  await expect(page.locator('#moves-toggle')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#moves-toggle')).toHaveAttribute('aria-label', 'Move counter off, tap to show');
  await page.keyboard.press('Escape');
  let state = await page.evaluate(() => chessClock.getState());
  expect(state.settings.sound).toBe('on');
  expect(state.settings.moves).toBe('off');
  // And back again from the sheet: sound off, moves on.
  await page.locator('#settings-btn').click();
  await page.locator('#sheet-sound-chips [data-sound-pick="off"]').click();
  await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#sheet-moves-chips [data-moves-pick="on"]').click();
  await expect(page.locator('#moves-toggle')).toHaveAttribute('aria-pressed', 'true');
  state = await page.evaluate(() => chessClock.getState());
  expect(state.settings.sound).toBe('off');
  expect(state.settings.moves).toBe('on');
});

test('setup screen sound and moves pickers keep the bar toggles in sync', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  // The bar is visible behind the setup screen; defaults are sound on, moves off.
  await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#moves-toggle')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#more-options > summary').click();
  await page.locator('#setup-sound-chips [data-sound-pick="off"]').click();
  await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#setup-moves-chips [data-moves-pick="on"]').click();
  await expect(page.locator('#moves-toggle')).toHaveAttribute('aria-pressed', 'true');
  // And back.
  await page.locator('#setup-sound-chips [data-sound-pick="on"]').click();
  await expect(page.locator('#sound-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#setup-moves-chips [data-moves-pick="off"]').click();
  await expect(page.locator('#moves-toggle')).toHaveAttribute('aria-pressed', 'false');
});

test('sound toggle plays a confirmation cue, on the bar and in the sheet', async ({ page, baseURL, browserName }) => {
  // Headless Firefox in CI has no audio backend: resume() never resolves there,
  // so cue measurement runs on chromium and webkit only.
  test.skip(browserName === 'firefox', 'no audio backend in headless CI Firefox');
  await page.addInitScript(() => {
    const proto = window.AudioContext && window.AudioContext.prototype;
    if (!proto) return;
    const orig = proto.createOscillator;
    window.__beeps = 0;
    proto.createOscillator = function () { window.__beeps++; return orig.call(this); };
  });
  await fresh(page, baseURL);
  await page.locator('#start-btn').click();
  const beeps = () => page.evaluate(() => window.__beeps);
  // Bar toggle to OFF: the cue is requested before muting.
  let n = await beeps();
  await page.locator('#sound-toggle').click();
  expect(await beeps()).toBeGreaterThan(n);
  expect((await page.evaluate(() => chessClock.getState())).settings.sound).toBe('off');
  // Bar toggle back ON: the cue is requested even though sound was off.
  n = await beeps();
  await page.locator('#sound-toggle').click();
  expect(await beeps()).toBeGreaterThan(n);
  expect((await page.evaluate(() => chessClock.getState())).settings.sound).toBe('on');
  // Sheet picker change cues too; tapping the already-selected value does not.
  await page.locator('#settings-btn').click();
  n = await beeps();
  await page.locator('#sheet-sound-chips [data-sound-pick="off"]').click();
  expect(await beeps()).toBeGreaterThan(n);
  n = await beeps();
  await page.locator('#sheet-sound-chips [data-sound-pick="off"]').click();
  expect(await beeps()).toBe(n);
});

test('bar keeps every label inside its button at 320px and 390px with 200% text', async ({ page, baseURL }) => {
  for (const w of [320, 390]) {
    await page.setViewportSize({ width: w, height: 844 });
    await fresh(page, baseURL);
    // Start via the page API: start without the setup screen.
    await page.evaluate(() => { chessClock.start(); document.documentElement.style.fontSize = '200%'; });
    const spills = () => page.evaluate(() => {
      const bad = [];
      document.querySelectorAll('#clock-view .bar button, #clock-view .bar .status').forEach((el) => {
        const b = el.getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(el);
        for (const r of range.getClientRects()) {
          if (r.width < 1 || r.height < 1) continue;
          if (r.left < b.left - 1 || r.right > b.right + 1) {
            bad.push(`"${el.textContent.trim()}" text ${r.left.toFixed(0)}..${r.right.toFixed(0)} outside button ${b.left.toFixed(0)}..${b.right.toFixed(0)}`);
          }
        }
      });
      return bad;
    });
    expect(await spills(), `running at ${w}px with 200% text`).toEqual([]);
    // Four buttons in two even rows of two: no orphan on a row of its own.
    const rows = await page.evaluate(() => {
      const tops = [...document.querySelectorAll('#clock-view .bar button:not([hidden])')]
        .map((el) => Math.round(el.getBoundingClientRect().top))
        .sort((a, b) => a - b);
      const groups = [];
      for (const t of tops) {
        const g = groups.find((grp) => Math.abs(grp[0] - t) <= 4);
        if (g) g.push(t); else groups.push([t]);
      }
      return groups.map((g) => g.length).sort((a, b) => a - b);
    });
    expect(rows, `buttons not in two even rows at ${w}px`).toEqual([2, 2]);
  }
});

test('sheet rows share one aligned, equal-width control column at 320px, 390px and 200% text', async ({ page, baseURL }) => {
  for (const w of [320, 390]) {
    for (const zoom of [1, 2]) {
      await page.setViewportSize({ width: w, height: 844 });
      await fresh(page, baseURL);
      // Start via the page API: start without the setup screen.
      await page.evaluate((z) => {
        chessClock.start();
        document.documentElement.style.fontSize = z === 2 ? '200%' : '';
      }, zoom);
      await page.locator('#settings-btn').click();
      const res = await page.evaluate(() => {
        const sheet = document.querySelector('#settings-sheet .sheet').getBoundingClientRect();
        const rows = [...document.querySelectorAll('#settings-sheet .sheet .row')];
        const groups = rows.map((row) => row.querySelector('.chips')).filter(Boolean);
        const lefts = groups.map((g) => g.getBoundingClientRect().left);
        const rights = groups.map((g) => g.getBoundingClientRect().right);
        const widths = groups.map((g) => g.getBoundingClientRect().width);
        const chips = groups.map((g) => [...g.children].map((c) => {
          const r = c.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(c);
          let textOk = true;
          for (const rr of range.getClientRects()) {
            if (rr.width < 1 || rr.height < 1) continue;
            if (rr.left < r.left - 1 || rr.right > r.right + 1) textOk = false;
          }
          return { w: r.width, h: r.height, textOk };
        }));
        return { lefts, rights, widths, chips, sheetRight: sheet.right };
      });
      const spread = (a) => Math.max(...a) - Math.min(...a);
      expect(spread(res.lefts), `${w}px z${zoom}: control column left edges differ`).toBeLessThanOrEqual(1);
      expect(spread(res.widths), `${w}px z${zoom}: control column widths differ`).toBeLessThanOrEqual(1);
      for (const r of res.rights) {
        expect(r, `${w}px z${zoom}: a control crosses the sheet's right edge`).toBeLessThanOrEqual(res.sheetRight + 1);
      }
      for (const chips of res.chips) {
        expect(spread(chips.map((c) => c.w)), `${w}px z${zoom}: chips in a group have unequal widths`).toBeLessThanOrEqual(1);
        expect(spread(chips.map((c) => c.h)), `${w}px z${zoom}: chips in a group have unequal heights`).toBeLessThanOrEqual(1);
        for (const c of chips) expect(c.textOk, `${w}px z${zoom}: chip text spills its button`).toBe(true);
      }
    }
  }
});

test('sound cues emit a real non-silent signal, and silence when sound is off', async ({ page, baseURL, browserName }) => {
  test.skip(browserName === 'firefox', 'no audio backend in headless CI Firefox');
  await page.addInitScript(() => {
    const proto = window.AudioContext && window.AudioContext.prototype;
    if (!proto) return;
    window.__signals = [];
    const origOsc = proto.createOscillator;
    const origGain = proto.createGain;
    proto.createGain = function () {
      const gain = origGain.call(this);
      const rec = { peaks: [] };
      const ramp0 = gain.gain.exponentialRampToValueAtTime.bind(gain.gain);
      const set0 = gain.gain.setValueAtTime.bind(gain.gain);
      gain.gain.exponentialRampToValueAtTime = function (v, t) { rec.peaks.push(v); return ramp0(v, t); };
      gain.gain.setValueAtTime = function (v, t) { rec.peaks.push(v); return set0(v, t); };
      this.__lastGainRec = rec;
      return gain;
    };
    proto.createOscillator = function () {
      const osc = origOsc.call(this);
      const start0 = osc.start.bind(osc);
      const stop0 = osc.stop.bind(osc);
      const rec = { freq: 0, dur: 0, peak: 0 };
      osc.start = function (t) {
        rec.freq = osc.frequency.value;
        const at = typeof t === 'number' ? t : osc.context.currentTime;
        rec.start = at;
        const g = osc.context.__lastGainRec;
        rec.peak = g && g.peaks.length ? Math.max.apply(null, g.peaks) : 0;
        return start0(t);
      };
      osc.stop = function (t) {
        rec.stop = typeof t === 'number' ? t : osc.context.currentTime;
        rec.dur = rec.stop - rec.start;
        return stop0(t);
      };
      window.__signals.push(rec);
      return osc;
    };
  });
  await fresh(page, baseURL);
  await page.locator('#start-btn').click();
  const signals = () => page.evaluate(() => window.__signals);
  const sane = (s, label) => {
    expect(s.freq, `${label}: frequency out of range`).toBeGreaterThanOrEqual(300);
    expect(s.freq, `${label}: frequency out of range`).toBeLessThanOrEqual(1400);
    expect(s.dur, `${label}: duration out of range`).toBeGreaterThanOrEqual(0.03);
    expect(s.dur, `${label}: duration out of range`).toBeLessThanOrEqual(0.6);
    expect(s.peak, `${label}: silent signal`).toBeGreaterThanOrEqual(0.05);
  };
  // A move clicks: real signal around 1200 Hz for ~0.07s.
  let before = (await signals()).length;
  await page.locator('#pause-btn').click(); // Start game
  let sigs = (await signals()).slice(before);
  expect(sigs.length, 'move made no sound').toBeGreaterThanOrEqual(1);
  for (const s of sigs) sane(s, 'move cue');
  // Toggle sound OFF on the bar: the confirmation cue still sounds.
  before = (await signals()).length;
  await page.locator('#sound-toggle').click();
  sigs = (await signals()).slice(before);
  expect(sigs.length, 'toggle-off made no confirmation cue').toBeGreaterThanOrEqual(1);
  for (const s of sigs) sane(s, 'toggle-off cue');
  // Muted moves stay silent: no oscillator is even created.
  await page.evaluate(() => { window.__signals = []; });
  await page.locator('#p2').dispatchEvent('pointerdown');
  await page.waitForTimeout(300);
  expect((await signals()).length, 'a sound played while muted').toBe(0);
  // Toggle back ON: confirmation cue sounds again.
  await page.locator('#sound-toggle').click();
  expect((await signals()).length, 'toggle-on made no confirmation cue').toBeGreaterThanOrEqual(1);
  for (const s of await signals()) sane(s, 'toggle-on cue');
  // Flag fall: the alarm plays three real notes.
  await page.evaluate(() => { window.__signals = []; });
  const active = (await page.evaluate(() => chessClock.getState())).active;
  await page.evaluate((side) => chessClock.setRemainingMs(side, 200), active);
  await page.waitForFunction(() => window.__signals.length >= 3, null, { timeout: 3000 });
  sigs = await signals();
  expect(sigs.length, 'flag fall alarm notes').toBe(3);
  expect(sigs.map((s) => s.freq)).toEqual([880, 880, 660]);
  for (const s of sigs) sane(s, 'flag alarm');
});

test('ended game shows the outcome on both halves and a Play again action', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#start-btn').click();
  await page.locator('#pause-btn').click();
  await page.evaluate(() => chessClock.setRemainingMs('p1', 150));
  await expect(page.locator('#p2-result')).toBeVisible();
  await expect(page.locator('#p2-result')).toContainText('wins');
  await expect(page.locator('#p1-result')).toBeVisible();
  await expect(page.locator('#p1-result')).toContainText('flag fell');
  await expect(page.locator('#again-btn')).toBeVisible();
  await expect(page.locator('#bar-change')).toBeVisible();
  // Ended-bar buttons keep their text inside their bounds at 320px with 200% text.
  await page.setViewportSize({ width: 320, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
  const spills = await page.evaluate(() => {
    const bad = [];
    document.querySelectorAll('#again-btn, #bar-change').forEach((el) => {
      const b = el.getBoundingClientRect();
      const range = document.createRange();
      range.selectNodeContents(el);
      for (const r of range.getClientRects()) {
        if (r.width < 1 || r.height < 1) continue;
        if (r.left < b.left - 1 || r.right > b.right + 1) {
          bad.push(`"${el.textContent.trim()}" text ${r.left.toFixed(0)}..${r.right.toFixed(0)} outside button ${b.left.toFixed(0)}..${b.right.toFixed(0)}`);
        }
      }
    });
    return bad;
  });
  expect(spills, 'ended-bar text spills at 320px 200%').toEqual([]);
  await page.locator('#again-btn').click();
  const state = await page.evaluate(() => chessClock.getState());
  expect(state.phase).toBe('ready');
  expect(state.remaining.p1).toBe(10 * 60000);
});

test('settings sheet buttons keep the same size and position when confirming', async ({ page, baseURL }) => {
  for (const width of [320, 390, 800]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(baseURL + '/chess-clock/');
    await page.evaluate(() => { localStorage.clear(); chessClock.start(); chessClock.begin(); });
    await page.locator('#settings-btn').click();
    const sel = '#sheet-reset, #sheet-change-time, #sheet-close, #sheet-resume, .sheet .chips .chip';
    const boxes = () => page.evaluate((s) => [...document.querySelectorAll(s)].map((b) => {
      const r = b.getBoundingClientRect();
      return [b.id || b.className, Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
    }), sel);
    await page.waitForTimeout(500); // let the sheet finish sliding in
    const before = await boxes();
    await page.locator('#sheet-reset').click();
    await expect(page.locator('#sheet-reset')).toHaveClass(/confirm/);
    expect(await boxes(), `${width}: reset armed`).toEqual(before);
    await page.locator('#sheet-change-time').click();
    await expect(page.locator('#sheet-change-time')).toHaveClass(/confirm/);
    expect(await boxes(), `${width}: both armed`).toEqual(before);
  }
});

test('each side shows a White or Black pawn badge; badge, name and digits never move or wrap', async ({ page, baseURL }) => {
  test.setTimeout(120000); // 32 combinations
  for (const [width, big, moves, flip, height] of [740, 900].flatMap((hh) => [false, true].flatMap((f) => [[320, false, false], [390, false, false], [320, true, false], [390, true, false], [320, false, true], [390, false, true], [320, true, true], [390, true, true]].map((c) => [...c, f, hh])))) {
    await page.setViewportSize({ width, height });
    await page.goto(baseURL + '/chess-clock/');
    await page.evaluate(() => { localStorage.clear(); });
    await page.goto(baseURL + '/chess-clock/');
    if (big) await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    // Longest allowed names (24 characters): the ended message and name must not change the layout.
    await page.evaluate((flipNames) => {
      for (const [id, v] of (flipNames ? [['name-p1', 'Al Be Ci Do Ev Fi Gu Ha Iv'.slice(0, 24)], ['name-p2', 'Jo Ka Le Mo Ny Os Pa Qu Ri'.slice(0, 24)]] : [['name-p1', 'Christopher Montgomerys'], ['name-p2', 'Bartholomew Featherstn']])) {
        const i = document.getElementById(id); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, flip);
    await page.evaluate(() => chessClock.start());
    if (moves) await page.locator('#moves-toggle').click(); // move counter on: the names gain " · N moves" while running
    await expect(page.locator('#p1 .side')).toHaveText('White');
    await expect(page.locator('#p2 .side')).toHaveText('Black');
    await expect(page.locator('#p1 .side svg.pawn-white use')).toHaveCount(1);
    await expect(page.locator('#p2 .side svg.pawn-black use')).toHaveCount(1);
    // Vertical position and horizontal centre of the badge, name and digits (the digits change
    // width as the string changes, so their centre is compared, not their left edge).
    const measure = () => page.evaluate(() => ['p1', 'p2'].map((id) => {
      const card = document.getElementById(id).getBoundingClientRect();
      const out = { card: Math.round(card.height) };
      for (const q of ['.side', '.pname', '.time']) {
        const r = document.querySelector('#' + id + ' ' + q).getBoundingClientRect();
        out[q] = [Math.round(r.top), Math.round(r.left + r.width / 2)]; // whole px: must be identical
        out[q + 'inside'] = r.left >= card.left && r.right <= card.right && r.top >= card.top && r.bottom <= card.bottom;
      }
      out.slotHeight = Math.round(document.querySelector('#' + id + ' .slot').getBoundingClientRect().height * 10) / 10; // the reserved slot never grows
      const side = document.querySelector('#' + id + ' .side').getBoundingClientRect();
      out.oneLine = side.height < 40 * (parseFloat(getComputedStyle(document.documentElement).fontSize) / 16);
      return out;
    }));
    await page.waitForTimeout(500); // let the view-in transition and font-fit settle
    const ready = await measure();
    for (const [i, id] of ['p1', 'p2'].entries()) {
      void i;
      expect(await page.evaluate((id) => document.querySelector('#' + id + ' .pname').textContent, id), 'no space before an ellipsis').not.toMatch(/\s\u2026/);
      expect(await page.evaluate((id) => { const card = document.getElementById(id).getBoundingClientRect(); const r = document.querySelector('#' + id + ' .pname').getBoundingClientRect(); return r.left >= card.left && r.right <= card.right; }, id), `${width}x${height}${big ? ' 200%' : ''}: long name stays inside its card`).toBe(true);
    }
    for (const m of ready) { expect(m['.sideinside'] && m.oneLine, `${width}x${height}${big ? ' 200%' : ''}${moves ? ' counter on' : ''}${flip ? ' other side loses' : ''}: badge inside card on one line`).toBe(true); }
    const states = {};
    await page.evaluate(() => chessClock.begin()); states.running = await measure();
    if (moves) {
      const counts = await page.evaluate(() => ['p1', 'p2'].map((id) => {
        const box = document.querySelector('#' + id + ' .pname').getBoundingClientRect();
        const c = document.getElementById(id + '-mv');
        const r = c.getBoundingClientRect();
        const card = document.getElementById(id).getBoundingClientRect();
        return /^\d+ moves?$/.test(c.textContent) && r.left >= card.left - 0.5 && r.right <= card.right + 0.5 && r.bottom <= card.bottom + 0.5 && r.top >= card.top - 0.5 && c.scrollWidth <= c.clientWidth + 1;
      }));
      const nameFit = await page.evaluate(() => ['p1', 'p2'].map((id) => { const card = document.getElementById(id).getBoundingClientRect(); const r = document.querySelector('#' + id + ' .pname').getBoundingClientRect(); return r.left >= card.left && r.right <= card.right; }));
      expect(nameFit, `${width}x${height}${big ? ' 200%' : ''}: name plus move count stays inside the card`).toEqual([true, true]);
      expect(counts, `${width}x${height}${big ? ' 200%' : ''}: move count fully visible beside long names`).toEqual([true, true]);
    }
    await page.evaluate(() => chessClock.press('p1')); states.runningOther = await measure();
    if (flip) { await page.evaluate(() => chessClock.press(chessClock.getState().active)); }
    await page.evaluate(() => chessClock.pause()); states.paused = await measure();
    await page.evaluate(() => { chessClock.resume(); chessClock.setRemainingMs(chessClock.getState().active, 50); });
    await expect.poll(async () => (await page.evaluate(() => chessClock.getState())).phase).toBe('ended');
    states.ended = await measure();
    // The outcome words are fully inside their card whatever the name length, and the name is the part that is cut.
    const ended = await page.evaluate(() => ['p1', 'p2'].map((id) => {
      const card = document.getElementById(id).getBoundingClientRect();
      const spans = [...document.querySelectorAll('#' + id + '-result > span')];
      const inside = spans.every((e) => { const r = e.getBoundingClientRect(); return r.left >= card.left - 0.5 && r.right <= card.right + 0.5 && r.bottom <= card.bottom + 0.5 && r.top >= card.top - 0.5; });
      const last = spans[spans.length - 1];
      return { inside, text: document.getElementById(id + '-result').textContent, lastFull: last.scrollWidth <= last.clientWidth + 1 };
    }));
    for (const e of ended) {
      expect(e.text, 'no space before an ellipsis').not.toMatch(/\s\u2026/);
      expect(e.inside && e.lastFull, `${width}x${height}${big ? ' 200%' : ''}${moves ? ' counter on' : ''}: ended outcome words fully visible`).toBe(true);
      expect(e.text).toMatch(/^Time! .+(wins|flag fell)$/);
    }
    for (const [name, got] of Object.entries(states)) {
      expect(got, `${width}x${height}${big ? ' 200%' : ''}${moves ? ' counter on' : ''}${flip ? ' other side loses' : ''}: badge, name and digits unchanged in ${name}`).toEqual(ready);
    }
  }
});

test('the reserved slot follows the ended result text size, however the size is changed', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(baseURL + '/chess-clock/');
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(baseURL + '/chess-clock/');
  await page.evaluate(() => {
    for (const [id, v] of [['name-p1', 'Al Be Ci Do Ev Fi Gu Ha Iv'], ['name-p2', 'Jo Ka Le Mo Ny Os Pa Qu Ri']]) {
      const i = document.getElementById(id); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true }));
    }
    chessClock.start();
    // Double the result's own computed size directly (not through the root text size).
    for (const r of document.querySelectorAll('.result')) r.style.fontSize = (parseFloat(getComputedStyle(r).fontSize) * 2) + 'px';
  });
  await page.waitForTimeout(400);
  const slots = () => page.evaluate(() => ['p1', 'p2'].map((id) => Math.round(document.querySelector('#' + id + ' .slot').getBoundingClientRect().height * 10) / 10));
  const ready = await slots();
  await page.evaluate(() => { chessClock.begin(); chessClock.press('p1'); chessClock.setRemainingMs(chessClock.getState().active, 50); });
  await expect.poll(async () => (await page.evaluate(() => chessClock.getState())).phase).toBe('ended');
  await page.waitForTimeout(400);
  expect(await slots()).toEqual(ready);
});

test('with no names typed, the clock shows only White and Black, and the old defaults are dropped', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(baseURL + '/chess-clock/');
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('chess-clock-settings', JSON.stringify({ p1name: 'Player 1', p2name: 'Player 2' })); });
  await page.goto(baseURL + '/chess-clock/');
  await expect(page.locator('#play-summary')).toContainText('White (bottom) vs Black (top)');
  await expect(page.locator('#name-p1')).toHaveAttribute('placeholder', 'Optional name');
  await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; chessClock.start(); });
  await page.locator('#moves-toggle').click();
  await expect(page.locator('#p1 .pname')).toBeHidden();
  await expect(page.locator('#p1')).toHaveAttribute('aria-label', /^White, /);
  await page.waitForTimeout(400);
  const m = () => page.evaluate(() => ['p1', 'p2'].map((id) => ['.side', '.time', '.slot'].map((q) => { const r = document.querySelector('#' + id + ' ' + q).getBoundingClientRect(); return Math.round(r.top) + '/' + Math.round(r.height); })));
  const ready = await m();
  await page.evaluate(() => { chessClock.begin(); chessClock.press('p1'); });
  expect(await m()).toEqual(ready);
  await page.evaluate(() => { chessClock.pause(); });
  expect(await m()).toEqual(ready);
  await page.evaluate(() => { chessClock.resume(); chessClock.setRemainingMs(chessClock.getState().active, 50); });
  await expect.poll(async () => (await page.evaluate(() => chessClock.getState())).phase).toBe('ended');
  await page.waitForTimeout(400);
  expect(await m()).toEqual(ready);
  await expect(page.locator('#p1-result')).toHaveText(/^Time! White( wins|.s flag fell)$/);
});

test('Start game button keeps its size and place through ready, running and paused', async ({ page, baseURL }) => {
  for (const [w, big] of [[320, true], [390, false]]) {
    await page.setViewportSize({ width: w, height: 780 });
    await fresh(page, baseURL);
    await page.evaluate((b) => { if (b) document.documentElement.style.fontSize = '200%'; chessClock.start(); }, big);
    const box = () => page.locator('#pause-btn').evaluate((e) => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 10) / 10); });
    // The painted shape (shadow, border, radius) must be identical in every state; only colour may change.
    const shape = () => page.locator('#pause-btn').evaluate((e) => { const c = getComputedStyle(e); return [c.boxShadow, c.borderTopWidth, c.borderRightWidth, c.borderBottomWidth, c.borderLeftWidth, c.borderStyle, c.borderTopLeftRadius, c.borderBottomRightRadius, c.outlineStyle]; });
    const ready = await box();
    const readyShape = await shape();
    expect(readyShape[0], `${w}px ready: no shadow ledge`).toBe('none');
    await expect(page.locator('#pause-btn')).toHaveAttribute('aria-label', 'Start game');
    await expect(page.locator('#pause-btn')).toHaveAttribute('aria-disabled', 'false');
    await page.locator('#pause-btn').click();
    expect((await page.evaluate(() => chessClock.getState())).active).toBe('p1');
    expect(await box(), `${w}px running`).toEqual(ready);
    expect(await shape(), `${w}px running shape`).toEqual(readyShape);
    await page.locator('#pause-btn').click();
    expect(await box(), `${w}px paused`).toEqual(ready);
    expect(await shape(), `${w}px paused shape`).toEqual(readyShape);
  }
});

test('tapping White before the game starts starts White\'s clock, like Start game', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#start-btn').click();
  let state = await page.evaluate(() => chessClock.getState());
  expect(state.phase).toBe('ready');
  await page.locator('#p2').dispatchEvent('pointerdown');
  expect((await page.evaluate(() => chessClock.getState())).phase).toBe('ready');
  await page.locator('#p1').dispatchEvent('pointerdown');
  state = await page.evaluate(() => chessClock.getState());
  expect(state.phase).toBe('running');
  expect(state.active).toBe('p1');
  expect(state.moves.p1).toBe(0);
  // Once running, tapping White passes the turn to Black as before.
  await page.locator('#p1').dispatchEvent('pointerdown');
  state = await page.evaluate(() => chessClock.getState());
  expect(state.active).toBe('p2');
  expect(state.moves.p1).toBe(1);
});

test('setup option titles keep at least 12px clear of their buttons at 320px, 390px and 200% text', async ({ page, baseURL }) => {
  for (const [w, big] of [[320, false], [390, false], [390, true]]) {
    await page.setViewportSize({ width: w, height: 900 });
    await fresh(page, baseURL);
    if (big) await page.addStyleTag({ content: 'html { font-size: 200% }' });
    await page.locator('#custom-time summary').click();
    await page.locator('#more-options summary').click();
    const gaps = await page.evaluate(() => [...document.querySelectorAll('.picker')].filter((p) => p.getClientRects().length).map((p) => {
      const r = document.createRange(); r.selectNodeContents(p.querySelector('legend'));
      return { label: p.querySelector('legend').textContent.trim(), gap: p.querySelector('.chip').getBoundingClientRect().top - r.getBoundingClientRect().bottom };
    }));
    expect(gaps.length).toBeGreaterThanOrEqual(4);
    for (const g of gaps) expect(g.gap, `${w}px${big ? ' 200%' : ''} ${g.label}`).toBeGreaterThanOrEqual(12);
  }
});

test('setup header clock picture is larger, and the title stays on one line, clear of it', async ({ page, baseURL }) => {
  for (const [w, minClock] of [[320, 100], [390, 120], [700, 160]]) {
    await page.setViewportSize({ width: w, height: 844 });
    await fresh(page, baseURL);
    const m = await page.evaluate(() => {
      const svg = document.querySelector('.setup-clock').getBoundingClientRect();
      const h1 = document.querySelector('.setup-hero h1');
      const r = document.createRange(); r.selectNodeContents(h1);
      const t = r.getBoundingClientRect();
      return { clock: svg.width, titleRight: t.right, clockLeft: svg.left, clockRight: svg.right, lines: Math.round(h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight)), scrollW: document.documentElement.scrollWidth };
    });
    expect(m.clock, `${w}px clock width`).toBeGreaterThanOrEqual(minClock);
    expect(m.lines, `${w}px title lines`).toBe(1);
    expect(m.titleRight, `${w}px title clear of clock`).toBeLessThanOrEqual(m.clockLeft - 4);
    expect(m.clockRight, `${w}px clock inside page`).toBeLessThanOrEqual(w);
    expect(m.scrollW, `${w}px no sideways scroll`).toBeLessThanOrEqual(w);
  }
});

test('setup compact header packs copy beside the full-size clock without overlap', async ({ page, baseURL }) => {
  // [width, enlarged text, max kicker->title gap, max title->tagline gap]
  for (const [w, big, maxKickerGap, maxLeadGap] of [[320, false, 24, 28], [390, false, 34, 32], [430, false, 38, 36], [700, false, 46, 44], [390, true, null, null]]) {
    await page.setViewportSize({ width: w, height: 844 });
    await fresh(page, baseURL);
    if (big) await page.addStyleTag({ content: 'html { font-size: 200% }' });
    const m = await page.evaluate(() => {
      const r = (s) => document.querySelector(s).getBoundingClientRect();
      const kicker = r('.setup-kicker'), h1 = r('.setup-hero h1'), lead = r('.setup-hero .lead'), clock = r('.setup-clock');
      return { leadRight:lead.right,clockLeft:clock.left, kickerBottom: kicker.bottom, h1Top: h1.top, h1Bottom: h1.bottom, leadTop: lead.top, leadLines: (() => { const walker = document.createTreeWalker(document.querySelector('.setup-hero .lead'), NodeFilter.SHOW_TEXT); const tops = []; while(walker.nextNode()){ if(!walker.currentNode.textContent.trim()) continue; const g = document.createRange(); g.selectNodeContents(walker.currentNode); tops.push(...[...g.getClientRects()].filter(r=>r.height>0).map(r=>Math.round(r.top))); } return new Set(tops).size; })(), clockBottom: clock.bottom, scrollW: document.documentElement.scrollWidth };
    });
    const tag = `${w}px${big ? ' 200%' : ''}`;
    expect(m.leadRight + 7, `${tag} tagline clear of clock`).toBeLessThanOrEqual(m.clockLeft);
    expect(m.scrollW, `${tag} no sideways scroll`).toBeLessThanOrEqual(w);
    if (!big) {
      expect(m.h1Top - m.kickerBottom, `${tag} kicker-to-title gap`).toBeLessThanOrEqual(maxKickerGap);
      expect(m.leadTop - m.h1Bottom, `${tag} title-to-tagline gap`).toBeLessThanOrEqual(maxLeadGap);
      expect(m.leadLines, `${tag} tagline lines`).toBe(w < 500 ? 2 : 1);
    }
  }
});

test('compact header lifts Play about 30px at 390 and never drops it at 320',async({page,baseURL})=>{
 // Compare with the exact pre-change header CSS in the same browser/font stack.
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});await fresh(page,baseURL);
  const play=await page.locator('#start-btn').boundingBox(),clock=await page.locator('.setup-clock').boundingBox();
  expect(play.height).toBe(64);expect(clock.width).toBeCloseTo(width*.325,1);
  await page.addStyleTag({content: `
    .setup {padding-top:28px}
    .setup-hero {row-gap:${width<=360?8:10}px;margin-bottom:0}
    .setup-hero .lead {grid-column:1 / -1;grid-row:3}
    .setup-hero .lead span {display:inline}
    .setup-clock {grid-row:1 / 3}
  `});
  const baseline=await page.locator('#start-btn').boundingBox();
  const lift=baseline.y-play.y;
  expect(lift).toBeGreaterThanOrEqual(0);
  if(width===390){expect(lift).toBeGreaterThanOrEqual(28);expect(lift).toBeLessThanOrEqual(33)}
 }

});
