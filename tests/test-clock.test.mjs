// Content checks for the unlisted chess clock at /test-clock/.
// Dependency-free: node --test tests/test-clock.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = resolve(import.meta.dirname, '..');
const html = readFileSync(resolve(root, 'test-clock/index.html'), 'utf8');

test('test-clock: complete document, single heading, not indexed', () => {
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html lang="en">/);
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.match(html, /<meta\s+name="viewport"\s+content="[^"]*width=device-width/);
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.match(html, /<meta\s+name="robots"\s+content="noindex, nofollow"/);
});

test('test-clock: no external requests, no analytics, no tracking', () => {
  assert.doesNotMatch(html, /src="https?:|href="https?:/);
  assert.doesNotMatch(html, /G-J3J3NS19ZS|googletagmanager|google-analytics|analytics\.js/);
  assert.doesNotMatch(html, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|new Image\s*\(/);
});

test('test-clock: favicons resolve to existing assets', () => {
  for (const m of html.matchAll(/<link[^>]+rel="(?:icon|apple-touch-icon)"[^>]*>/g)) {
    const href = m[0].match(/\shref="([^"]*)"/)[1];
    assert.ok(existsSync(resolve(root, href.slice(1))), href);
  }
});

test('test-clock: not linked from public pages, nav or sitemap', () => {
  const pages = ['index.html', 'about/index.html', 'pricing/index.html', 'charity/index.html', 'contact/index.html', 'privacy/index.html', 'prospects/index.html'];
  for (const page of pages) {
    const source = readFileSync(resolve(root, page), 'utf8');
    assert.doesNotMatch(source, /test-clock/, page);
  }
  assert.doesNotMatch(readFileSync(resolve(root, 'sitemap.xml'), 'utf8'), /test-clock/);
  assert.doesNotMatch(readFileSync(resolve(root, 'robots.txt'), 'utf8'), /test-clock/);
});

test('test-clock: inline scripts parse', () => {
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.ok(scripts.length >= 2);
  for (const script of scripts) new vm.Script(script[1], { filename: 'test-clock/index.html' });
});

test('test-clock: copy style rules (no em-dashes, no placeholder copy)', () => {
  assert.doesNotMatch(html, /—|–/);
  assert.doesNotMatch(html, /lorem|to be confirmed|TODO/i);
});

test('test-clock: accessible controls and time choices', () => {
  for (const id of ['pause-btn', 'reset-btn', 'settings-btn', 'start-btn']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  for (const minutes of [1, 3, 5, 10, 15]) assert.match(html, new RegExp(`data-minutes="${minutes}"`));
  for (const inc of [0, 2, 5]) assert.match(html, new RegExp(`data-inc="${inc}"`));
  for (const style of ['studio', 'players', 'tournament']) assert.match(html, new RegExp(`data-style-pick="${style}"`));
  for (const accent of ['green', 'peach', 'sky']) assert.match(html, new RegExp(`data-accent-pick="${accent}"`));
  assert.match(html, /aria-label="Pause"/);
  assert.match(html, /aria-label="Reset clock"/);
  assert.match(html, /role="dialog" aria-modal="true"/);
  assert.match(html, /aria-pressed/);
});
