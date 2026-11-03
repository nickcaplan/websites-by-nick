import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import { resolve, extname, sep } from "node:path";
import { fileURLToPath } from "node:url";
const outputDir = process.env.CONCEPT_SCREENSHOTS || resolve(tmpdir(), "wbn-concept-screenshots");
await mkdir(outputDir, {recursive:true});
const chrome = process.env.CHROME_PATH || (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const server = createServer(async (req, res) => {
  try {
    let path = resolve(
      root,
      "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname),
    );
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    if (!extname(path)) path = resolve(path, "index.html");
    res.setHeader(
      "content-type",
      {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".webp": "image/webp",
        ".woff2": "font/woff2",
      }[extname(path)] || "application/octet-stream",
    );
    res.end(await readFile(path));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const base =
  process.env.CONCEPT_BASE || `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: chrome,
    args: ["--no-sandbox"],
  });
  for (const width of [320, 390, 768, 1280]) {
    const page = await browser.newPage({ viewport: { width, height: 950 } });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const slug of [
      "",
      "playground/",
      "transformation/",
      "portfolio/",
      "art-direction/",
    ]) {
      await page.goto(base + "/homepage-concepts/" + slug);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForLoadState("networkidle");
      const check = async () => {
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        );
        if (overflow) throw Error(`overflow ${width} ${slug}`);
        if (errors.length) throw Error(errors.join(";"));
      };
      await check();
      const name = slug.slice(0, -1) || "compare";
      await page.screenshot({
        animations: "disabled",
        path: `${outputDir}/concept-${name}-${width}.png`,
      });
      if (slug === "playground/") {
        for (const label of ["Bold", "Playful", "Calm"]) {
          await page.getByRole("button", { name: label, exact: true }).click();
          if ((await page.locator(".mini").getAttribute("data-personality")) !== label.toLowerCase())
            throw Error("personality state missing " + label);
          if ((await page.getByRole("button", {name:label,exact:true}).getAttribute("aria-pressed")) !== "true")
            throw Error("personality selection missing " + label);
          if (!(await page.locator("#demo-status").innerText()).startsWith(label + ":"))
            throw Error("personality announcement missing " + label);
          await check();
        }
        await page.getByRole("button", { name: "Phone", exact: true }).click();
        if ((await page.locator(".device-frame").getAttribute("data-device")) !== "phone")
          throw Error("phone frame state missing");
        await check();
        if (width === 1280)
          await page.screenshot({
        animations: "disabled",
            path: `${outputDir}/concept-playground-phone-frame.png`,
          });
      }
      if (slug === "transformation/") {
        await page.getByRole("button", { name: "Before", exact: true }).click();
        if (
          (await page
            .locator(".transform-frame")
            .getAttribute("data-version")) !== "before"
        )
          throw Error("before not set");
        await check();
        if (width === 1280)
          await page.screenshot({
        animations: "disabled",
            path: `${outputDir}/concept-transformation-before.png`,
          });
        await page
          .getByRole("button", { name: "Give it some character", exact: false })
          .click();
        if (
          (await page
            .locator(".transform-frame")
            .getAttribute("data-version")) !== "after"
        )
          throw Error("after not set");
      }
      if (slug === "portfolio/") {
        await page
          .getByRole("button", { name: "Composer", exact: true })
          .click();
        await page.getByRole("button", { name: "Phone", exact: true }).click();
        await page.locator("#project-image").evaluate((img) => img.decode());
        if (
          (await page.locator("#project-name").innerText()) !==
          "Samantha Fernando"
        )
          throw Error("project switch failed");
        await check();
        if (width === 1280)
          await page.screenshot({
        animations: "disabled",
            path: `${outputDir}/concept-portfolio-composer-phone.png`,
          });
      }
      if (slug === "art-direction/") {
        for (const label of ["Expressive", "Playful", "Quiet"]) {
          await page.getByRole("button", { name: label, exact: true }).click();
          await check();
          if (width === 1280)
            await page.screenshot({
        animations: "disabled",
              path: `${outputDir}/concept-art-${label.toLowerCase()}.png`,
            });
        }
        await page
          .getByRole("button", { name: "Playful", exact: true })
          .click();
        await page.reload();
        if (
          (await page.locator("body").getAttribute("data-direction")) !==
          "playful"
        )
          throw Error("local choice missing");
      }
      await page
        .getByRole("button", { name: "Light mode", exact: true })
        .click();
      await check();
      if ((await page.locator("body").getAttribute("data-theme")) !== "light" ||
          (await page.getByRole("button", {name:"Light mode",exact:true}).getAttribute("aria-pressed")) !== "true")
        throw Error("light theme state missing");
      await page
        .getByRole("button", { name: "Light mode", exact: true })
        .click();
      await page.keyboard.press("Tab");
      await check();
      console.log("PASS", width, name);
    }
    await page.close();
  }
  const nojs = await browser.newPage({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  for (const slug of [
    "playground",
    "transformation",
    "portfolio",
    "art-direction",
  ]) {
    await nojs.goto(base + "/homepage-concepts/" + slug + "/");
    if ((await nojs.locator("h1").count()) !== 1)
      throw Error("missing static heading");
    if (
      (await nojs
        .getByRole("link", { name: "Discuss your website", exact: false })
        .count()) < 1
    )
      throw Error("missing static CTA");
  }
  console.log("PASS no-JS content");
} finally {
  try {
    await browser?.close();
  } finally {
    await new Promise((r) => server.close(r));
  }
}
