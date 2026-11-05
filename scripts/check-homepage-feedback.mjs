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
  if (!/I design cool,\s*playful websites\./.test(h1.replace(/\s+/g, " "))) fail("hero message " + h1);
  for (const re of banned) if (re.test(text)) fail("removed line is back: " + re + " at " + width);
  // screenshots must differ from the previous same-looking pair
  const srcs = await p.evaluate(() => [...document.querySelectorAll(".composer img, .community img, .project img")].map((i) => i.getAttribute("src")));
  if (!srcs.length || srcs.some((s) => /3-sam-home|foa-fundraising/.test(s))) fail("old matching screenshots " + srcs);
  if (!srcs.some((s) => /sam-watch-desk-dark/.test(s)) || !srcs.some((s) => /foa-fireworks-desk/.test(s))) fail("new screenshots missing");
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
  if (!/PLAYED WITH\./.test(sticker.text)) fail("sticker text " + sticker.text);
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
// Nick's eye follows the pointer and blinks; it stays still while paused.
{
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(base + "/homepage-concepts/");
  await p.waitForLoadState("networkidle");
  await p.evaluate(() => document.querySelector(".studio svg").scrollIntoView({ block: "center", behavior: "instant" }));
  await p.waitForTimeout(500);
  const eyeT = () => p.locator(".sd-eye").evaluate((e) => e.style.translate);
  await p.mouse.move(5, 450);
  await p.waitForTimeout(300);
  const left = await eyeT();
  await p.mouse.move(1275, 450);
  await p.waitForTimeout(300);
  const right = await eyeT();
  if (!left || !right || left === right) fail("eye does not follow the pointer " + left + " / " + right);
  if (parseFloat(left) >= 0 || parseFloat(right) <= 0) fail("eye looks the wrong way " + left + " / " + right);
  const blink = await p.locator(".sd-eyeball").evaluate((e) => e.getAnimations().some((a) => a.animationName === "sd-blink"));
  if (!blink) fail("eye does not blink");
  await p.getByRole("button", { name: "Pause motion", exact: true }).click();
  await p.mouse.move(640, 5);
  await p.waitForTimeout(300);
  if ((await eyeT()) !== "") fail("eye moved while paused");
  console.log("PASS eye");
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
