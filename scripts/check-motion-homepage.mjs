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
      .getByRole("button", { name: "Resume motion" })
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
  await p.getByRole("button", { name: "Resume motion" }).click();
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
  await p.getByRole("button", { name: "Resume motion" }).click();
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
    .evaluateAll((a) => Promise.all(a.map((i) => i.decode())));
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
