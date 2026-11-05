// Browser checks for the 5 Nov feedback on the animated homepage concept:
// message, removed lines, distinct screenshots, visible sticker, large drawing
// studio (draws, pauses, settles) and the theme on the About and Pricing pages.
import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".woff2": "font/woff2", ".webp": "image/webp", ".svg": "image/svg+xml", ".png": "image/png" };
const server = createServer(async (req, res) => {
  let p = resolve(root, "." + new URL(req.url, "http://x").pathname);
  if (p !== root && !p.startsWith(root + sep)) return res.writeHead(403).end();
  if (!extname(p)) p += "/index.html";
  try {
    res.setHeader("content-type", types[extname(p)] || "application/octet-stream");
    res.end(await readFile(p));
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => server.listen(0, r));
const base = process.env.MOTION_BASE || "http://localhost:" + server.address().port;
const b = await chromium.launch({
  executablePath: process.env.CHROME_PATH || (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined),
  args: ["--no-sandbox"],
});
const fail = (m) => { throw Error(m); };
const banned = [/not a template/i, /what if/i, /a bit of/i];
const studioState = (p) => p.evaluate(() => {
  const svg = document.querySelector(".studio svg");
  const ink = [...svg.querySelectorAll(".sd-ink")];
  const left = ink.reduce((n, e) => n + (parseFloat(getComputedStyle(e).strokeDashoffset) || 0), 0);
  const fills = [...svg.querySelectorAll(".sd-fill")].map((e) => getComputedStyle(e).opacity);
  return {
    left: Math.round(left),
    fills,
    clip: parseFloat(svg.querySelector(".sd-clip").getAttribute("width")),
    done: svg.classList.contains("done"),
    hand: svg.querySelector(".sd-hand").getAttribute("transform"),
  };
});
const complete = (s) => s.left === 0 && s.fills.every((o) => o === "1") && s.clip >= 349;

for (const width of [320, 390, 768, 1280, 1600]) {
  const p = await b.newPage({ viewport: { width, height: width < 600 ? 844 : 1000 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(base + "/homepage-concepts/");
  await p.waitForLoadState("networkidle");
  await p.evaluate(() => document.fonts.ready);
  const text = await p.evaluate(() => document.body.innerText);
  const h1 = await p.evaluate(() => document.getElementById("hero-title").getAttribute("aria-label") || document.getElementById("hero-title").textContent);
  if (!/Websites people\s*remember\./.test(h1.replace(/\s+/g, " "))) fail("hero message " + h1);
  for (const re of banned) if (re.test(text)) fail("removed line is back: " + re + " at " + width);
  // screenshots must differ from the previous same-looking pair
  const srcs = await p.evaluate(() => [...document.querySelectorAll(".composer img, .community img, .project img")].map((i) => i.getAttribute("src")));
  if (!srcs.length || srcs.some((s) => /3-sam-home|foa-fundraising/.test(s))) fail("old matching screenshots " + srcs);
  if (!srcs.some((s) => /sam-watch-desk-dark/.test(s)) || !srcs.some((s) => /foa-fireworks-desk/.test(s))) fail("new screenshots missing");
  // Compass card: real captures load, and only the current theme's pair shows
  await p.evaluate(() => document.querySelector(".project-cmp").scrollIntoView({ behavior: "instant" }));
  await p.waitForFunction(() => [...document.querySelectorAll("a.project-cmp img")].filter((i) => getComputedStyle(i).display !== "none").every((i) => i.complete && i.naturalWidth > 0), null, { timeout: 15000 });
  const cp = await p.evaluate(() => {
    const a = document.querySelector("a.project-cmp");
    const vis = [...a.querySelectorAll("img")].filter((i) => getComputedStyle(i).display !== "none");
    return { href: a.href, h3: a.querySelector("h3").textContent, vis: vis.length, loaded: vis.every((i) => i.complete && i.naturalWidth > 0) };
  });
  if (cp.h3 !== "Compass" || !/compass-demo\.websitesbynick\.co\.uk/.test(cp.href)) fail("compass card wrong " + JSON.stringify(cp));
  if (cp.vis !== 2 || !cp.loaded) fail("compass screenshots not shown/loaded " + JSON.stringify(cp));
  await p.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await p.waitForTimeout(400);
  // sticker fully visible, not covered by a card
  await p.waitForTimeout(2200);
  const sticker = await p.evaluate(() => {
    const el = document.querySelector(".sketch");
    const comp = document.querySelector(".composition").getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const pts = [[0.5, 0.5], [0.3, 0.3], [0.7, 0.3], [0.3, 0.7]].map(([x, y]) => document.elementFromPoint(r.left + r.width * x, r.top + r.height * y));
    return {
      covered: pts.some((e) => !e || !(e === el || el.contains(e))),
      inside: r.left >= comp.left - 1 && r.right <= comp.right + 1 && r.top >= comp.top - 1 && r.bottom <= comp.bottom + 1,
      text: el.innerText.replace(/\s+/g, " ").trim(),
    };
  });
  if (sticker.covered) fail("sticker covered at " + width);
  if (!sticker.inside) fail("sticker clipped at " + width);
  if (!/HELLO\./.test(sticker.text)) fail("sticker text " + sticker.text);
  if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)) fail("overflow " + width);
  // the drawing studio is large and draws live
  await p.locator(".studio svg").scrollIntoViewIfNeeded();
  const box = await p.locator(".studio svg").boundingBox();
  const need = Math.min(600, width * 0.85);
  if (box.width < need) fail("studio too small " + box.width + " at " + width);
  await p.evaluate(() => document.querySelector(".studio svg").scrollIntoView({ block: "center", behavior: "instant" }));
  await p.waitForTimeout(1600);
  const a = await studioState(p);
  await p.waitForTimeout(1400);
  const m = await studioState(p);
  if (complete(a) && width === 1280) fail("studio did not start drawing");
  if (m.hand === a.hand && m.left === a.left && m.clip === a.clip) fail("studio is not moving");
  await p.waitForFunction(() => document.querySelector(".studio svg").classList.contains("done"), null, { timeout: 25000 });
  const e = await studioState(p);
  if (!complete(e)) fail("studio did not finish " + JSON.stringify(e));
  if (errors.length) fail(errors.join());
  console.log("PASS", width);
  await p.close();
}

// Pause mid-drawing settles the finished picture; resume does not redraw it.
{
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(base + "/homepage-concepts/");
  await p.waitForLoadState("networkidle");
  await p.evaluate(() => document.querySelector(".studio svg").scrollIntoView({ block: "center", behavior: "instant" }));
  await p.waitForTimeout(1800);
  if (complete(await studioState(p))) fail("too early to test pause");
  await p.getByRole("button", { name: "Pause motion", exact: true }).click();
  await p.waitForTimeout(900);
  if (!complete(await studioState(p))) fail("pause did not settle the drawing " + JSON.stringify(await studioState(p)));
  const hand1 = (await studioState(p)).hand;
  await p.getByRole("button", { name: "Pause motion", exact: true }).click();
  await p.waitForTimeout(1200);
  const after = await studioState(p);
  if (!complete(after) || after.hand !== hand1) fail("resume redrew or moved the drawing");
  console.log("PASS pause-settle");
  await p.close();
}
// Hidden tab freezes the drawing without losing progress.
{
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(base + "/homepage-concepts/");
  await p.waitForLoadState("networkidle");
  await p.evaluate(() => document.querySelector(".studio svg").scrollIntoView({ block: "center", behavior: "instant" }));
  await p.waitForTimeout(1800);
  await p.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, get: () => true }); document.dispatchEvent(new Event("visibilitychange")); });
  await p.waitForTimeout(150);
  const s1 = await studioState(p);
  await p.waitForTimeout(1500);
  const s2 = await studioState(p);
  if (s1.left !== s2.left || s1.clip !== s2.clip) fail("drawing moved while hidden");
  await p.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event("visibilitychange")); });
  await p.waitForTimeout(1200);
  const s3 = await studioState(p);
  if (s3.left === s2.left && s3.clip === s2.clip) fail("drawing did not resume");
  console.log("PASS hidden-freeze");
  await p.close();
}
// No face in the cartoon: no eye or mouth to follow the pointer or blink.
{
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(base + "/homepage-concepts/");
  await p.waitForLoadState("networkidle");
  await p.evaluate(() => document.querySelector(".studio svg").scrollIntoView({ block: "center", behavior: "instant" }));
  await p.waitForTimeout(300);
  const bits = await p.evaluate(() => ({
    eyes: document.querySelectorAll(".studio .sd-eye, .studio .sd-eyeball").length,
    dark: document.querySelectorAll(".studio .sd-head [stroke='#203027'], .studio .sd-head [fill='#203027'], .studio .sd-head [fill='#fffdf6']").length,
    small: [...document.querySelectorAll(".studio .sd-head circle")].filter((c) => +c.getAttribute("r") < 40).length,
  }));
  if (bits.eyes || bits.dark || bits.small) fail("cartoon shows a face " + JSON.stringify(bits));
  const head0 = await p.locator(".sd-head").evaluate((e) => e.outerHTML);
  await p.mouse.move(5, 450);
  await p.mouse.move(1275, 450);
  await p.waitForTimeout(300);
  if ((await p.locator(".sd-head").evaluate((e) => e.outerHTML)) !== head0) fail("head reacts to the pointer");
  console.log("PASS no-face");
  await p.close();
}
// Paused on desktop: project cards stop stacking, so none is covered while
// still focusable; resuming restores stacking; resizing clears stale styles.
{
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  await p.goto(base + "/homepage-concepts/");
  await p.waitForLoadState("networkidle");
  const pos = () => p.evaluate(() => [...document.querySelectorAll(".project")].map((e) => getComputedStyle(e).position).join());
  if (!(await pos()).includes("sticky")) fail("desktop cards should stack when motion is on");
  const t = p.getByRole("button", { name: /motion/i });
  await t.click();
  if ((await pos()).includes("sticky")) fail("cards still sticky while paused");
  // Keyboard: every project link that gets focus must be the topmost element at its centre.
  await p.evaluate(() => document.querySelector(".project").scrollIntoView({ behavior: "instant" }));
  const hrefs = await p.$$eval("a.project[href]", (as) => as.map((a) => a.href));
  if (hrefs.length !== 3) fail("expected exactly three project links, found " + hrefs.length);
  const reached = new Set();
  for (let i = 0; i < 60 && reached.size < hrefs.length; i++) {
    await p.keyboard.press("Tab");
    await p.waitForTimeout(500); // focus scrolls into view smoothly; measure once settled
    const r = await p.evaluate(() => {
      const e = document.activeElement;
      if (!e || !e.matches("a.project[href]")) return null;
      const q = e.getBoundingClientRect();
      const x = Math.min(Math.max(q.left + q.width / 2, 1), innerWidth - 2);
      const y = Math.min(Math.max(q.top + q.height / 2, 1), innerHeight - 2);
      const at = document.elementFromPoint(x, y);
      return { href: e.href, top: !!at && (at === e || e.contains(at)) };
    });
    if (!r) continue;
    if (!r.top) fail("focused project link is covered while paused: " + r.href);
    reached.add(r.href);
  }
  if (reached.size !== hrefs.length) fail("Tab never reached every project link while paused");
  await t.click();
  if (!(await pos()).includes("sticky")) fail("stacking did not return after resume");
  await p.setViewportSize({ width: 800, height: 800 });
  await p.waitForTimeout(400);
  const stale = await p.evaluate(() => { const e = document.querySelector(".project"); return e.style.pointerEvents || e.getAttribute("tabindex") || e.style.opacity || e.style.transform; });
  if (stale) fail("stale stacked styles after resize " + stale);
  console.log("PASS paused-desktop");
  await p.close();
}
// Reduced motion and no JS show the finished picture, arm included.
for (const mode of ["reduced", "nojs"]) {
  const p = await b.newPage(mode === "reduced" ? { reducedMotion: "reduce", viewport: { width: 390, height: 844 } } : { javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  await p.goto(base + "/homepage-concepts/");
  await p.waitForLoadState("networkidle");
  const s = await studioState(p);
  if (!(s.left === 0 && s.fills.every((o) => o === "1") && s.clip >= 349)) fail(mode + " drawing not complete " + JSON.stringify(s));
  if (!/translate\(/.test(s.hand)) fail(mode + " arm missing");
  console.log("PASS", mode);
  await p.close();
}
// The theme on the other pages.
for (const [path, h1re] of [["/homepage-concepts/about/", /Websites are what I build\./], ["/homepage-concepts/pricing/", /What a website costs\./]]) {
  for (const width of [320, 390, 1280]) {
    const p = await b.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(base + path);
    await p.waitForLoadState("networkidle");
    await p.evaluate(() => document.fonts.ready);
    const h = await p.locator("h1").innerText();
    if (!h1re.test(h.replace(/\s+/g, " "))) fail("page heading " + h);
    const text = await p.evaluate(() => document.body.innerText);
    for (const re of banned) if (re.test(text)) fail(path + " has removed line " + re);
    if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)) fail("overflow " + path + width);
    await p.getByRole("button", { name: "Dark mode", exact: true }).click();
    if (!(await p.locator("body").evaluate((e) => e.classList.contains("dark")))) fail("theme " + path);
    if (errors.length) fail(errors.join());
    await p.close();
  }
  console.log("PASS", path);
}
await b.close();
server.close();
