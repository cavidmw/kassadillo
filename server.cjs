const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");
const dotenv = require("dotenv");


dotenv.config({ path: path.join(__dirname, ".env.local") });
dotenv.config({ path: path.join(__dirname, ".env") });

const PORT = 3000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
};

function serveFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Not found");
  }
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(filePath).pipe(res);
}

// Express benzeri mini helper’lar (API dosyaların bozulmasın diye)
function attachExpressLikeHelpers(req, res, parsedUrl) {
  req.query = Object.fromEntries(parsedUrl.searchParams.entries());

  res.status = (code) => {
    res.statusCode = code;
    return res;
  };

  res.json = (obj) => {
    const body = JSON.stringify(obj);
    if (!res.headersSent) {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
    }
    res.end(body);
    return res;
  };

  res.send = (body) => {
    if (typeof body === "object") return res.json(body);
    if (!res.headersSent) {
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
    }
    res.end(String(body));
    return res;
  };

  return { req, res };
}

const server = http.createServer(async (req, res) => {
  const parsed = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = parsed.pathname;

  // Static
  if (pathname === "/") return serveFile(res, path.join(__dirname, "index.html"));
  if (pathname.startsWith("/styles/") || pathname.startsWith("/js/") || pathname.startsWith("/assets/")) {
    return serveFile(res, path.join(__dirname, pathname));
  }

  // API
  if (pathname.startsWith("/api/")) {
    try {
      // /api/channel-resolve -> api/channel-resolve.js
      const file = pathname.replace("/api/", "");
      const apiPath = path.join(__dirname, "api", `${file}.js`);
      if (!fs.existsSync(apiPath)) {
        res.writeHead(404, { "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify({ error: "API not found" }));
      }

      attachExpressLikeHelpers(req, res, parsed);

      // CommonJS module import (CJS export) uyumlu
      const mod = await import(url.pathToFileURL(apiPath));
      const handler = mod.default || mod;

      if (typeof handler !== "function") {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        return res.end(JSON.stringify({ error: "API handler not a function" }));
      }

      // ÖNEMLİ: await ile çağırıyoruz ki hata yakalansın
      await handler(req, res);

      // handler response’u kapatmadıysa kapat
      if (!res.writableEnded) res.end();
      return;
    } catch (e) {
      console.error(e);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      }
      if (!res.writableEnded) res.end(JSON.stringify({ error: e?.message || "API error" }));
      return;
    }
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`Local server running: http://localhost:${PORT}`);
});