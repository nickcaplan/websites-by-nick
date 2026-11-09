import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
for (const file of ['index.html', 'homepage-concepts/index.html']) {
  const src = readFileSync(new URL('../' + file, import.meta.url), 'utf8');
  test(`${file}: opening browser has only enjoy then remember`, () => {
    assert.match(src, /const words=\['enjoy\.','remember\.'\]/);
    assert.match(src, /aria-label="Websites people enjoy, remember\."/);
    assert.match(src, /class="line last"><em>enjoy\.<\/em>/);
    assert.doesNotMatch(src, /data-bulb-word="love"/);
    assert.match(src, /if\(m\.matches\)\{i=words\.length-1;e\.textContent=words\[i\]\}/);
  });
}
