import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const html = readFileSync(new URL("../ozo-cafe/index.html", import.meta.url), "utf8");
test("Ozo main landmark contains the page content, not the header or footer", () => {
  assert.match(html, /<header>[\s\S]*?<\/header>[\s\S]*?<main>[\s\S]*?class="hero"[\s\S]*?class="find"[\s\S]*?<\/main>[\s\S]*?<footer>/);
});
test("Ozo decorative menu glyphs are hidden from assistive technology", () => {
  assert.equal((html.match(/class="dot" aria-hidden="true"/g) || []).length, 4);
});
test("Ozo theme initializes on the root before visible content", () => {
  const head = html.slice(0, html.indexOf("</head>"));
  assert.match(head, /localStorage.getItem\("ozo-theme"\)/);
  assert.match(head, /document.documentElement.classList.toggle\("dark"/);
  assert.match(head, /:root\.dark \.find/);
  assert.doesNotMatch(html, /body\.dark/);
  assert.doesNotMatch(html, /document.body.classList.toggle\("dark"/);
});
