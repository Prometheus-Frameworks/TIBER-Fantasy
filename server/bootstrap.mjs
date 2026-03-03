// server/bootstrap.mjs — copied to dist/index.mjs at build time.
// Replit deployment now runs: node dist/index.mjs  (no npm overhead)
// Tiny (< 70 lines) → Node parses it in < 5ms.
// Binds port 5000 before the 92k-line bundle loads (~3 s).
import http from "node:http";
import fs   from "node:fs";
import path from "node:path";

// Ensure production mode even when NODE_ENV is not set by the run command
process.env.NODE_ENV = process.env.NODE_ENV || "production";

// Catch every process-level error so crashes appear in deployment logs
process.on("uncaughtException",  (err) => console.error("[bootstrap] uncaughtException:",  err));
process.on("unhandledRejection", (r)   => console.error("[bootstrap] unhandledRejection:", r));

const PORT = Number(process.env.PORT ?? 5000);
console.log(`[bootstrap] start — PORT=${PORT} NODE_ENV=${process.env.NODE_ENV}`);

// Read index.html once (sync, can't hang). Served for GET / so browsers load
// the React SPA and Replit's health checker gets an immediate 200.
const INDEX_HTML_PATH = path.join(process.cwd(), "dist", "public", "index.html");
let indexHtmlBuf = null;
try {
  indexHtmlBuf = fs.readFileSync(INDEX_HTML_PATH);
  console.log(`[bootstrap] index.html loaded (${indexHtmlBuf.length} bytes)`);
} catch {
  console.warn(`[bootstrap] index.html not found at ${INDEX_HTML_PATH}`);
}

let expressApp = null; // set after bundle loads

const server = http.createServer((req, res) => {
  const url    = (req.url ?? "/").split("?")[0];
  const method = req.method ?? "GET";
  console.log(`[req] ${method} ${url}`);  // visible in deployment logs

  // / — serve the React app shell; health checkers just need status 200
  if (url === "/") {
    if (indexHtmlBuf) {
      res.writeHead(200, {
        "Content-Type":   "text/html; charset=utf-8",
        "Content-Length": String(indexHtmlBuf.length),
        "Connection":     "close",
      });
      res.end(indexHtmlBuf);
    } else {
      const body = `{"ok":true,"status":"${expressApp ? "ready" : "starting"}"}`;
      res.writeHead(200, { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(body)), "Connection": "close" });
      res.end(body);
    }
    return;
  }

  // /health — always instant 200
  if (url === "/health") {
    const body = '{"ok":true,"service":"TiberClaw"}';
    res.writeHead(200, { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(body)), "Connection": "close" });
    res.end(body);
    return;
  }

  // Everything else → Express once ready, 503 while loading
  if (expressApp) {
    expressApp(req, res);
  } else {
    const body = '{"error":"Server starting, retry in a few seconds"}';
    res.writeHead(503, { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(body)), "Retry-After": "5", "Connection": "close" });
    res.end(body);
  }
});

server.on("error", (err) => console.error("[bootstrap] server error:", err));

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[bootstrap] port ${PORT} bound — loading app bundle`);
  const t = Date.now();

  (async () => {
    const { app, initBackground } = await import("./app.mjs");
    expressApp = app;
    console.log(`[bootstrap] bundle ready in ${Date.now() - t}ms — Express active`);
    await initBackground();
    console.log(`[bootstrap] fully initialized`);
  })().catch((err) => console.error("[bootstrap] FATAL init error:", err));
});
