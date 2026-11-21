import { test, expect } from '@playwright/test';

async function openFresh(page) {
  await page.goto('/chess-clock/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
}

async function checkFaces(page, value) {
  for (const id of ['left', 'right']) {
    const face = page.locator('#setup-clock-' + id);
    await expect(face).toHaveAttribute('data-time', value);
    await expect(face.locator('path')).toHaveCount(value.length);
    // Real SVG paths must stay inside the visible window, not just claim a value.
    expect(await face.evaluate(g => {
      const box = g.getBBox();
      const window = g.parentNode.querySelectorAll('.clock-window')[g.id.endsWith('right') ? 1 : 0].getBBox();
      return box.x > window.x + 3 && box.y > window.y + 3 && box.x + box.width < window.x + window.width - 3 && box.y + box.height < window.y + window.height - 3;
    })).toBe(true);
  }
  const glyphs = await page.locator('.setup-clock .clock-digits').evaluateAll(groups => groups.map(group => [...group.children].map(path => ({ d: path.getAttribute('d'), transform: [...path.transform.baseVal].map(t => [t.matrix.a, t.matrix.d, t.matrix.e, t.matrix.f]) }))));
  for (let i = 0; i < glyphs[0].length; i++) {
    expect(glyphs[0][i].d).toBe(glyphs[1][i].d);
    expect(glyphs[1][i].transform[0][2] - glyphs[0][i].transform[0][2]).toBeCloseTo(70, 4);
    expect(glyphs[1][i].transform[0][3]).toBeCloseTo(glyphs[0][i].transform[0][3], 4);
    expect(glyphs[1][i].transform[1]).toEqual(glyphs[0][i].transform[1]);
  }
}

test('opening clock follows every preset, persists and uses the starting time on Play', async ({ page }) => {
  await openFresh(page);
  await checkFaces(page, '10:00');
  for (const [preset, value] of [['3,2', '3:00'], ['10,3', '10:00'], ['1,0', '1:00'], ['5,0', '5:00']]) {
    await page.locator(`[data-preset="${preset}"]`).click();
    await checkFaces(page, value);
    await page.reload();
    await checkFaces(page, value);
  }
  await page.locator('#start-btn').click();
  await expect(page.locator('#p1-time')).toHaveText('5:00');
  await expect(page.locator('#p2-time')).toHaveText('5:00');
});

test('custom minutes update both faces immediately and increments do not add to starting time', async ({ page }) => {
  await openFresh(page);
  await page.locator('#custom-time summary').click();
  for (const minutes of [1, 3, 5, 10]) {
    await page.locator(`[data-minutes="${minutes}"]`).click();
    await checkFaces(page, minutes + ':00');
    for (const inc of [0, 2, 3, 5]) {
      await page.locator(`[data-inc="${inc}"]`).click();
      await checkFaces(page, minutes + ':00');
    }
  }
  await page.reload();
  await checkFaces(page, '10:00');
  for (const minutes of [1, 3, 5, 10, 15, 90]) {
    await page.evaluate(m => localStorage.setItem('chess-clock-settings', JSON.stringify({minutes:m,inc:2})), minutes);
    await page.reload();
    await checkFaces(page, minutes + ':00');
  }
});

test('opening layout and inset clock survive 320px, theme, accent and real doubled text', async ({ page }) => {
  await openFresh(page);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const theme of ['dark', 'light']) {
      await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
      await checkFaces(page, '10:00');
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('body *')) {
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size) el.style.fontSize = size * 2 + 'px';
    }
  });
  await checkFaces(page, '10:00');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('#start-btn')).toBeVisible();
  expect(await page.locator('.tile').evaluateAll(tiles => tiles.every(tile => {
    const outer = tile.getBoundingClientRect();
    return [...tile.children].every(child => {
      const inner = child.getBoundingClientRect();
      return inner.left >= outer.left && inner.right <= outer.right && child.scrollWidth <= child.clientWidth;
    });
  }))).toBe(true);
  expect(await page.locator('.name-fields input').evaluateAll(inputs => inputs.every(input => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const style = getComputedStyle(input);
    ctx.font = style.font;
    return ctx.measureText(input.value).width <= input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  }))).toBe(true);
  // No visible player/time summary has crept back above Play.
  expect(await page.locator('#play-summary').evaluate(el => el.getBoundingClientRect().width)).toBe(1);
  await expect(page.locator('#start-btn')).toHaveAccessibleName('Play');
});

test('each player label stays paired with its own input at every setup width', async ({ page }) => {
  await openFresh(page);
  for (const width of [320, 390, 620, 768, 1440, 1920]) {
    await page.setViewportSize({width, height:1000});
    await page.reload();
    for (const scale of [1, 2]) {
      if (scale === 2) await page.evaluate(() => {
        for (const el of document.querySelectorAll('body *')) {
          const size = parseFloat(getComputedStyle(el).fontSize);
          if (size) el.style.fontSize = size * 2 + 'px';
        }
      });
      // WebKit flex rounding can differ by 1/64px. Permit <0.1px, not visible overflow.
      const rows = await page.locator('.name-row').evaluateAll(rows => rows.map(row => {
        const label = row.querySelector('label');
        const input = row.querySelector('input');
        const l = label.getBoundingClientRect();
        const i = input.getBoundingClientRect();
        const r = row.getBoundingClientRect();
        return {match:label.htmlFor === input.id,top:r.top,bottom:r.bottom, labelTop:l.top,inputTop:i.top,inputBottom:i.bottom,inside:i.right <= r.right + 0.1 && l.right <= r.right + 0.1};
      }));
      expect(rows).toHaveLength(2);
      expect(rows.every(r => r.match && r.inside && r.inputTop >= r.top - 0.1 && r.inputBottom <= r.bottom + 0.1)).toBe(true);
      expect(rows[1].top).toBeGreaterThan(rows[0].bottom);
      if (width >= 620 && scale === 1) expect(rows.every(r => r.inputTop <= r.labelTop && r.labelTop < r.inputBottom)).toBe(true);
    }
  }
});
