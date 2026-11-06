// Shared static server for the browser check scripts: traversal guard,
// index.html fallback, and one MIME map covering every asset type either
// script serves. Binds to localhost only.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";

const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
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
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      const p = resolve(root, "." + pathname);
      if (p !== root && !p.startsWith(root + sep)) {
        res.writeHead(403).end();
        return;
      }
      const directory = (await stat(p)).isDirectory();
      const file = directory || !extname(p) ? p + "/index.html" : p;
      res.setHeader("content-type", types[extname(file)] || "application/octet-stream");
      res.end(await readFile(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolveIt) => server.listen(0, "127.0.0.1", () => resolveIt(server)));
};
