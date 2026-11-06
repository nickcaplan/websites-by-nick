// Shared static server for the browser check scripts: traversal guard,
// index.html fallback, and one MIME map covering every asset type either
// script serves. Binds to localhost only.
import { createServer } from "node:http";
import { readFile, stat, realpath } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".woff2": "font/woff2",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export const startStaticServer = (root) => {
  root = resolve(root);
  const server = createServer(async (req, res) => {
    try {
      const port = server.address().port;
      if (!["localhost:" + port, "127.0.0.1:" + port].includes(req.headers.host)) {
        res.writeHead(403).end();
        return;
      }
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      const p = resolve(root, "." + pathname);
      if (p !== root && !p.startsWith(root + sep)) {
        res.writeHead(403).end();
        return;
      }
      const parts = pathname.split("/").filter(Boolean);
      const publicDirs = ["homepage-concepts", "assets", "contact", "experience", "privacy", "pricing"];
      if (parts.some(part => part.startsWith(".")) ||
          (parts.length > 1 && !publicDirs.includes(parts[0]))) {
        res.writeHead(403).end();
        return;
      }
      const directory = (await stat(p)).isDirectory();
      const file = directory || !extname(p) ? p + "/index.html" : p;
      const actual = await realpath(file);
      const actualRoot = await realpath(root);
      const actualParts = actual.slice(actualRoot.length + 1).split(sep);
      if ((actualParts.length > 1 && !publicDirs.includes(actualParts[0])) ||
          !actual.startsWith(actualRoot + sep) || !types[extname(actual)] ||
          actual.slice(actualRoot.length + 1).split(sep).some(part => part.startsWith("."))) {
        res.writeHead(403).end();
        return;
      }
      res.setHeader("content-type", types[extname(actual)]);
      res.end(await readFile(actual));
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolveIt) => server.listen(0, "127.0.0.1", () => resolveIt(server)));
};
