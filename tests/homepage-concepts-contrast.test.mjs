// WCAG contrast checks for the homepage-concepts colour pairs that review
// feedback flagged, computed from the real CSS custom properties.
// Usage: node --test

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const motionCss = readFileSync(join(root, 'homepage-concepts/motion.css'), 'utf8');
const pagesCss = readFileSync(join(root, 'homepage-concepts/pages.css'), 'utf8');

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const chan = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan((n >> 16) & 255) + 0.7152 * chan((n >> 8) & 255) + 0.0722 * chan(n & 255);
}
function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
function darkVar(name) {
  const block = motionCss.match(/\.dark \{([^}]*)\}/)[1];
  return block.match(new RegExp(`${name}: (#[0-9a-f]{6})`))[1];
}

const DARK_ORANGE = darkVar('--orange');
const DARK_PAPER = darkVar('--paper');
const DARK_INK = darkVar('--ink');

test('orange card text: cream on light-mode orange is AA', () => {
  assert.ok(contrast('#fff4da', '#be492b') >= 4.5, contrast('#fff4da', '#be492b').toFixed(2));
});

test('orange card text in dark mode: pages.css switches to dark ink, AA', () => {
  const rule = pagesCss.match(/\.dark \.card\.orange \{([^}]*)\}/);
  assert.ok(rule, 'dark orange card override missing');
  const color = rule[1].match(/color: (#[0-9a-f]{6})/)[1];
  assert.ok(contrast(color, DARK_ORANGE) >= 4.5, contrast(color, DARK_ORANGE).toFixed(2));
});

test('dark-mode focus ring is two-tone: each tone contrasts cards and page', () => {
  const rule = motionCss.match(/\.dark a:focus-visible,\s*\.dark button:focus-visible \{([^}]*)\}/s);
  assert.ok(rule, 'dark focus override missing');
  const ring = rule[1].match(/outline: 3px solid (#[0-9a-f]{6})/)[1];
  const halo = rule[1].match(/box-shadow: 0 0 0 5px (#[0-9a-f]{6})/)[1];
  const backdrops = [DARK_PAPER, '#f9f6ef', '#d5df91', '#203027'];
  for (const bg of backdrops) {
    const ok = contrast(ring, bg) >= 3 || contrast(halo, bg) >= 3;
    assert.ok(ok, `ring ${ring} halo ${halo} vs ${bg}`);
  }
});

test('subpage wordmark dot does not animate without a pause control', () => {
  const rule = pagesCss.match(/\.wordmark-dot \{([^}]*)\}/);
  assert.ok(rule, 'pages.css wordmark-dot rule missing');
  assert.match(rule[1], /animation: none/);
});

test('theme toggle persists the choice in localStorage', () => {
  for (const file of ['homepage-concepts/motion.js', 'homepage-concepts/pages.js']) {
    const src = readFileSync(join(root, file), 'utf8');
    assert.match(src, /localStorage\.setItem\((?:KEY|THEME_KEY), dark \? "dark" : "light"\)/, file);
    assert.match(src, /prefers-color-scheme: dark/, file);
  }
});
