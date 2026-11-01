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
    if (/:hover/.test(line) && hoverDepth === null && !/:focus-visible/.test(line)) outside.push(line.trim());
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
