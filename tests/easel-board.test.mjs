import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
for (const file of ['index.html','homepage-concepts/index.html']) test(`easel is a drawing board without browser chrome: ${file}`,()=>{
 const html=readFileSync(file,'utf8');
 const board=html.split('<!-- canvas on an easel -->')[1].split('<!-- Nick sketches a website')[0];
 assert.ok(board.includes('class="sd-legs"'));
 assert.ok(board.includes('width="332" height="358"'));
 assert.ok(!board.includes('<circle'));
 assert.ok(!board.includes('y="58"'));
 assert.ok(!html.includes('sd-btn'));
 for (const device of ['sd-laptop','sd-phone','sd-desktop-page','sd-mobile-page']) assert.ok(html.includes(device));
});
