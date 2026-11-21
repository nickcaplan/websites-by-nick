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

test('reset works from the settings sheet, behind a confirmation tap', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#start-btn').click();
  await page.locator('#p1').dispatchEvent('pointerdown');
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
  await page.locator('#p1').dispatchEvent('pointerdown');
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
  await page.locator('#p1').dispatchEvent('pointerdown');
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
  await expect(page.locator('#p1 .pname')).toContainText('move');
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
  await page.locator('body').press(' ');
  state = await page.evaluate(() => chessClock.getState());
  expect(state.active).toBe('p1');
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

test('restores a paused game after reload', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#start-btn').click();
  await page.locator('#p1').dispatchEvent('pointerdown');
  await page.evaluate(() => chessClock.pause());
  await page.goto(baseURL + '/chess-clock/');
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
    await page.evaluate(() => { chessClock.start(); chessClock.press('p1'); });
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

test('player names: prefilled, editable, shown on the clock and persisted', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await expect(page.locator('#name-p1')).toHaveValue('Player 1');
  await expect(page.locator('#name-p2')).toHaveValue('Player 2');
  await page.locator('#name-p1').fill('Luca');
  await page.locator('#name-p2').fill('Dad');
  await expect(page.locator('#play-summary')).toContainText('Luca (White, bottom) vs Dad (Black, top)');
  await page.locator('#start-btn').click();
  await expect(page.locator('#p1 .pname')).toHaveText('Luca');
  await expect(page.locator('#p2 .pname')).toHaveText('Dad');
  await expect(page.locator('#p1')).toHaveAttribute('aria-label', /Luca/);
  // Empty falls back to the default.
  await page.evaluate(() => { chessClock.changeTime(); });
  await page.locator('#name-p1').fill('');
  await expect(page.locator('#play-summary')).toContainText('Player 1 (White, bottom)');
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
    chessClock.press('p1');
    chessClock.setRemainingMs('p2', 100);
  });
  await page.waitForTimeout(700);
  await expect(page.locator('#p1-result')).toHaveText('Time! Luca wins');
});

test('settings sheet: resume actually resumes, close leaves the clock paused', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#start-btn').click();
  await page.locator('#p1').dispatchEvent('pointerdown');
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
  await page.locator('#p1').dispatchEvent('pointerdown');
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
    await page.evaluate(() => { chessClock.start(); chessClock.press('p1'); });
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
  await page.locator('#p1').dispatchEvent('pointerdown');
  await page.locator('#pause-btn').click();
  expect((await page.evaluate(() => chessClock.getState())).phase).toBe('paused');
  await page.locator('#p2').dispatchEvent('pointerdown');
  let state = await page.evaluate(() => chessClock.getState());
  expect(state.phase).toBe('running');
  expect(state.active).toBe('p2'); // the side to move keeps ticking
  await page.locator('#pause-btn').click();
  await page.locator('#p1').dispatchEvent('pointerdown');
  state = await page.evaluate(() => chessClock.getState());
  expect(state.phase).toBe('running');
  expect(state.active).toBe('p2');
});

test('sound: audio context unlocks on the first tap', async ({ page, baseURL }) => {
  await fresh(page, baseURL);
  await page.locator('#start-btn').click();
  await page.locator('#p1').dispatchEvent('pointerdown');
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
    // Start via the page API: a restored game also shows the clock view.
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
      // Start via the page API: a restored game also shows the clock view.
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
  await page.locator('#p1').dispatchEvent('pointerdown');
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
  await page.locator('#p1').dispatchEvent('pointerdown');
  await page.evaluate(() => chessClock.setRemainingMs('p2', 150));
  await expect(page.locator('#p1-result')).toBeVisible();
  await expect(page.locator('#p1-result')).toContainText('wins');
  await expect(page.locator('#p2-result')).toBeVisible();
  await expect(page.locator('#p2-result')).toContainText('flag fell');
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
    await page.evaluate(() => { localStorage.clear(); chessClock.start(); chessClock.press('p1'); });
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
  for (const [width, big] of [[320, false], [390, false], [320, true], [390, true]]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(baseURL + '/chess-clock/');
    await page.evaluate(() => { localStorage.clear(); });
    await page.goto(baseURL + '/chess-clock/');
    if (big) await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await page.evaluate(() => chessClock.start());
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
        out[q] = [Math.round(r.top), Math.round(r.left + r.width / 2)]; // whole px: sub-pixel rounding noise ignored
        out[q + 'inside'] = r.left >= card.left && r.right <= card.right && r.top >= card.top && r.bottom <= card.bottom;
      }
      const side = document.querySelector('#' + id + ' .side').getBoundingClientRect();
      out.oneLine = side.height < 40 * (parseFloat(getComputedStyle(document.documentElement).fontSize) / 16);
      return out;
    }));
    await page.waitForTimeout(500); // let the view-in transition and font-fit settle
    const ready = await measure();
    for (const m of ready) { expect(m['.sideinside'] && m.oneLine, `${width}${big ? ' 200%' : ''}: badge inside card on one line`).toBe(true); }
    const states = {};
    await page.evaluate(() => chessClock.press('p1')); states.running = await measure();
    await page.evaluate(() => chessClock.press('p2')); states.runningOther = await measure();
    await page.evaluate(() => chessClock.pause()); states.paused = await measure();
    await page.evaluate(() => { chessClock.resume(); chessClock.setRemainingMs(chessClock.getState().active, 50); });
    await expect.poll(async () => (await page.evaluate(() => chessClock.getState())).phase).toBe('ended');
    states.ended = await measure();
    for (const [name, got] of Object.entries(states)) {
      expect(got, `${width}${big ? ' 200%' : ''}: badge, name and digits unchanged in ${name}`).toEqual(ready);
    }
  }
});
