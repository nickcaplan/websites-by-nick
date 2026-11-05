import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const output =
  process.env.MOTION_SCREENSHOTS || resolve(tmpdir(), "wbn-motion");
await mkdir(output, { recursive: true });
const server = createServer(async (req, res) => {
  let p = resolve(root, "." + new URL(req.url, "http://localhost").pathname);
  if (p !== root && !p.startsWith(root + sep)) {
    res.writeHead(403).end();
    return;
  }
  if (!extname(p)) p += "/index.html";
  try {
    res.setHeader(
      "content-type",
      {
        ".html": "text/html",
        ".css": "text/css",
        ".js": "text/javascript",
        ".woff2": "font/woff2",
        ".webp": "image/webp",
      }[extname(p)] || "application/octet-stream",
    );
    res.end(await readFile(p));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, r));
const base =
  process.env.MOTION_BASE || "http://localhost:" + server.address().port;
const b = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    (existsSync("/usr/bin/google-chrome")
      ? "/usr/bin/google-chrome"
      : undefined),
  args: ["--no-sandbox"],
});
for (const width of [320, 390, 768, 1280, 1600]) {
  const p = await b.newPage({
    viewport: { width, height: width < 600 ? 844 : 1000 },
  });
  let errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(base + "/homepage-concepts/");
  await p.evaluate(() => document.fonts.ready);
  await p.waitForLoadState("networkidle");
  await p.locator(".composer img").evaluate((e) => e.decode());
  await p.waitForFunction(() =>
    document
      .querySelector(".composer")
      .getAnimations()
      .some((a) => a.currentTime > 1400),
  );
  if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth))
    throw Error("overflow" + width);
  if (errors.length) throw Error(errors);
  if (width === 390 || width === 1280)
    await p.screenshot({ path: output + "/motion-" + width + ".png" });
  await p.waitForFunction(() =>
    [...document.querySelectorAll(".composition, .swoosh")]
      .flatMap((e) => e.getAnimations({ subtree: true }))
      .some((a) => a.playState === "running"),
  );
  await p.getByRole("button", { name: "Pause motion", exact: true }).click();
  if (
    (await p
      .getByRole("button", { name: "Pause motion", exact: true })
      .getAttribute("aria-pressed")) !== "true"
  )
    throw Error("pause");
  const states = () =>
    p
      .locator(".composition, .swoosh")
      .evaluateAll((elements) =>
        elements.flatMap((e) =>
          e.getAnimations({ subtree: true }).map((a) => a.playState),
        ),
      );
  if ((await states()).some((s) => s === "running"))
    throw Error("motion not paused");
  await p.getByRole("button", { name: "Pause motion", exact: true }).click();
  if ((await states()).some((s) => s === "paused"))
    throw Error("motion not resumed");
  await p.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  if ((await states()).some((s) => s === "running"))
    throw Error("visibility alone did not pause");
  await p.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  if ((await states()).some((s) => s === "paused"))
    throw Error("visibility alone did not resume");
  await p.getByRole("button", { name: "Pause motion", exact: true }).click();
  await p.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  if ((await states()).some((s) => s === "running"))
    throw Error("background motion running");
  await p.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  if ((await states()).some((s) => s === "running"))
    throw Error("manual pause lost");
  await p.getByRole("button", { name: "Pause motion", exact: true }).click();
  if ((await states()).some((s) => s === "paused"))
    throw Error("motion stuck after visibility change");
  if (
    (await p
      .locator(".nav nav a")
      .last()
      .evaluate((e) => getComputedStyle(e).borderBottomStyle)) === "none"
  )
    throw Error("contact underline");
  await p.getByRole("link", { name: "Take a closer look" }).click();
  await p.waitForFunction(
    () =>
      Math.abs(
        document.querySelector("#work").getBoundingClientRect().top - 30,
      ) < 5,
  );
  await p
    .locator(".project img")
    .evaluateAll((a) =>
      Promise.all(
        a
          .filter((i) => getComputedStyle(i).display !== "none")
          .map((i) => {
            i.loading = "eager";
            return i.decode();
          }),
      ),
    );
  if (width === 390 || width === 1280)
    await p.screenshot({ path: output + "/motion-work-" + width + ".png" });
  await p.getByRole("button", { name: "Dark mode", exact: true }).click();
  if (!(await p.locator("body").evaluate((e) => e.classList.contains("dark"))))
    throw Error("theme");
  if (width === 390 || width === 1280)
    await p.screenshot({ path: output + "/motion-dark-" + width + ".png" });
  await p.getByRole("button", { name: "Dark mode", exact: true }).click();
  await p.locator("footer").scrollIntoViewIfNeeded();
  await p.locator(".about-grid img").evaluate((e) => e.decode());
  if (width === 390)
    await p.screenshot({ path: output + "/motion-footer.png" });
  console.log("PASS", width);
  await p.close();
}
const settle = await b.newPage({ viewport: { width: 1280, height: 1000 } });
await settle.goto(base + "/homepage-concepts/", {
  waitUntil: "domcontentloaded",
});
await settle.waitForTimeout(700);
await settle.getByRole("button", { name: "Pause motion", exact: true }).click();
await settle.waitForFunction(() => {
  const h = document.getElementById("hero-title");
  return h.classList.contains("typed") && h.classList.contains("drawn");
});
const settled = await settle.evaluate(() => {
  const h = document.getElementById("hero-title");
  return {
    total: h.querySelectorAll(".hc").length,
    on: h.querySelectorAll(".hc.on").length,
    caret: !!h.querySelector(".hero-caret"),
    off: getComputedStyle(h.querySelector(".swoosh")).strokeDashoffset,
  };
});
if (!settled.total || settled.total !== settled.on)
  throw Error("pause did not settle title");
if (settled.caret) throw Error("caret left after pause");
if (settled.off !== "0px") throw Error("underline not settled on pause");
await settle.getByRole("button", { name: "Pause motion", exact: true }).click();
const resumed = await settle.evaluate(() => {
  const sw = document.querySelector("#hero-title .swoosh");
  return {
    off: getComputedStyle(sw).strokeDashoffset,
    running: sw
      .getAnimations()
      .filter((a) => a.playState === "running" || a.playState === "pending")
      .length,
  };
});
if (resumed.off !== "0px" || resumed.running)
  throw Error("underline redrew on resume");
// Nick asked for no face in the cartoon: the figure is drawn from behind, with
// no eye, mouth or nose, and nothing in it follows the pointer.
await settle.evaluate(() => document.querySelector(".studio svg").scrollIntoView({ block: "center" }));
const faceBits = await settle.evaluate(() => ({
  eyes: document.querySelectorAll(".studio .sd-eye, .studio .sd-eyeball").length,
  dark: [...document.querySelectorAll(".studio .sd-head [stroke='#203027'], .studio .sd-head [fill='#203027'], .studio .sd-head [fill='#fffdf6']")].length,
  small: [...document.querySelectorAll(".studio .sd-head circle")].filter((c) => +c.getAttribute("r") < 40).length,
}));
if (faceBits.eyes || faceBits.dark || faceBits.small) throw Error("cartoon shows a face again " + JSON.stringify(faceBits));
await settle.getByRole("button", { name: "Pause motion", exact: true }).click();
console.log("PASS pause-settle");
await settle.close();
const asm = await b.newPage({ viewport: { width: 1280, height: 900 } });
await asm.goto(base + "/homepage-concepts/", { waitUntil: "networkidle" });
const seq = await asm.evaluate(async () => {
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
  const onCount = () =>
    [...document.querySelectorAll(".project-sam .cmp")].filter((e) =>
      e.classList.contains("on"),
    ).length;
  const el = document.querySelector(".project-sam .cmp-stage");
  const abs = window.scrollY + el.getBoundingClientRect().top;
  const counts = [];
  const total = document.querySelectorAll(".project-sam .cmp").length;
  counts.push(total);
  window.scrollTo(0, Math.max(0, abs - innerHeight - 80));
  await sleep(400);
  counts.push(onCount());
  window.scrollTo(0, abs - innerHeight * 0.55);
  await sleep(400);
  counts.push(onCount());
  window.scrollTo(0, abs - 60);
  await sleep(400);
  counts.push(onCount());
  return {
    counts,
    building: el.classList.contains("building"),
  };
});
const [total, early, mid, full] = seq.counts;
if (total < 4) throw Error("too few components " + total);
if (early !== 0) throw Error("assembly started early " + seq.counts);
if (!(mid > 0 && mid < total))
  throw Error("assembly did not stage " + seq.counts);
if (full !== total) throw Error("assembly incomplete " + seq.counts);
if (!seq.building) throw Error("assembly not marked building");
console.log("PASS assembly");
await asm.close();
const r = await b.newPage({
  reducedMotion: "reduce",
  viewport: { width: 390, height: 844 },
});
await r.goto(base + "/homepage-concepts/");
await r.waitForLoadState("networkidle");
if (await r.locator(".motion-toggle").isVisible())
  throw Error("motion control not hidden");
if (await r.locator(".composer").evaluate((e) => e.getAnimations().length))
  throw Error("animation reduced");
await r.screenshot({ path: output + "/motion-reduced.png" });
console.log("PASS reduced");
const hidden = await b.newPage();
await hidden.addInitScript(() =>
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => true,
  }),
);
await hidden.goto(base + "/homepage-concepts/");
if (
  !(await hidden
    .locator("body")
    .evaluate((e) => e.classList.contains("hidden-page")))
)
  throw Error("initial hidden state");
if (
  (
    await hidden
      .locator(".composer")
      .evaluate((e) => e.getAnimations().map((a) => a.playState))
  ).some((s) => s === "running")
)
  throw Error("initial background motion running");
await hidden.evaluate(() => {
  delete document.hidden;
  document.dispatchEvent(new Event("visibilitychange"));
});
if (
  (
    await hidden
      .locator(".composer")
      .evaluate((e) => e.getAnimations().map((a) => a.playState))
  ).some((s) => s === "paused")
)
  throw Error("initial background motion stuck");
await hidden.close();
console.log("PASS initial hidden");
const n = await b.newPage({ javaScriptEnabled: false });
await n.goto(base + "/homepage-concepts/");
if (!(await n.locator("h1").isVisible())) throw Error("noJS");
console.log("PASS noJS");
await b.close();
server.close();
