import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css = readFileSync(new URL('../assets/css/site.css', import.meta.url), 'utf8');

// Touch screens keep :hover on the last tapped element, which left a tab
// looking highlighted while another one was selected. Every hover style must
// sit inside (hover: hover).
test('hover styles only apply on devices that can hover', () => {
  const outside = [];
  let depth = 0;
  let hoverDepth = null;
  for (const line of css.split('\n')) {
    if (/^\s*@media\s*\(hover:\s*hover\)/.test(line)) hoverDepth = depth;
    // Check each selector on its own so a grouped :focus-visible cannot hide a :hover.
    for (const selector of line.split('{')[0].split(',')) {
      if (/:hover/.test(selector) && hoverDepth === null) outside.push(selector.trim());
    }
    for (const c of line) {
      if (c === '{') depth++;
      if (c === '}') {
        depth--;
        if (hoverDepth !== null && depth === hoverDepth) hoverDepth = null;
      }
    }
  }
  assert.deepEqual(outside, []);
});

// The hover rule now sits before the current-page rule in the file, so it must
// exclude the current page itself or the active link would turn accent on hover.
test('nav link hover leaves the current page link alone', () => {
  assert.match(css, /\.nav-links a:not\(\[aria-current="page"\]\):hover/);
  assert.doesNotMatch(css, /\.nav-links a:hover/);
});
