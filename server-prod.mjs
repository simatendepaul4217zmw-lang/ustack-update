import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_DIR = path.join(__dirname, "dist", "client");

const port = parseInt(process.env.PORT || "3000");

const { default: handler } = await import("./dist/server/server.js");

const MIME = {
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".css": "text/css",
  ".html": "text/html",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

function serveStatic(req, res) {
  const url = new URL(req.url, "http://localhost");
  const filePath = path.join(STATIC_DIR, url.pathname);

  // Security: prevent path traversal
  if (!filePath.startsWith(STATIC_DIR)) return false;

  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) return false;

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";

    // Long cache for hashed assets, short cache for index.html
    const isHashed = /\.[a-f0-9]{8,}\.\w+$/.test(filePath);
    const cacheControl = isHashed
      ? "public, max-age=31536000, immutable"
      : "public, max-age=0, must-revalidate";

    res.writeHead(200, {
      "Content-Type": mime,
      "Cache-Control": cacheControl,
      "Content-Length": stat.size,
    });
    fs.createReadStream(filePath).pipe(res);
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  // Serve static files from dist/client/ first
  if (serveStatic(req, res)) return;

  try {
    const host = req.headers.host || "localhost";
    const url = new URL(req.url, `https://${host}`);

    const headers = new Headers();
    for (const [key, val] of Object.entries(req.headers)) {
      if (val === undefined) continue;
      if (Array.isArray(val)) val.forEach((v) => headers.append(key, v));
      else headers.set(key, val);
    }

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const hasBody = req.method !== "GET" && req.method !== "HEAD" && chunks.length > 0;

    const request = new Request(url.toString(), {
      method: req.method,
      headers,
      body: hasBody ? Buffer.concat(chunks) : undefined,
      duplex: hasBody ? "half" : undefined,
    });

    const response = await handler.fetch(request, {}, {});

    res.statusCode = response.status;
    response.headers.forEach((val, key) => res.setHeader(key, val));

    if (response.body) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(value);
      }
    }
    res.end();
  } catch (err) {
    console.error("Request error:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`UStack server listening on http://0.0.0.0:${port}`);
});
