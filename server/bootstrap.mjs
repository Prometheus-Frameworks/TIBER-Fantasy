// server/bootstrap.mjs — copied to dist/index.mjs at build time.
// Deployment run: node dist/index.mjs  (no npm overhead)
// Binds port 5000 in ~400ms; Express bundle loads in ~3s behind it.
import http from "node:http";
import fs   from "node:fs";
import path from "node:path";

process.env.NODE_ENV = process.env.NODE_ENV || "production";

process.on("uncaughtException",  (err) => console.error("[bootstrap] uncaughtException:",  err));
process.on("unhandledRejection", (r)   => console.error("[bootstrap] unhandledRejection:", r));

const PORT = Number(process.env.PORT ?? 5000);
console.log(`[bootstrap] start — PORT=${PORT} NODE_ENV=${process.env.NODE_ENV}`);

const INDEX_HTML_PATH = path.join(process.cwd(), "dist", "public", "index.html");
let indexHtmlBuf = null;
try {
  indexHtmlBuf = fs.readFileSync(INDEX_HTML_PATH);
  console.log(`[bootstrap] index.html loaded (${indexHtmlBuf.length} bytes)`);
} catch {
  console.warn(`[bootstrap] index.html not found at ${INDEX_HTML_PATH}`);
}

let expressApp = null;

const server = http.createServer((req, res) => {
  const url    = (req.url ?? "/").split("?")[0];
  const method = req.method ?? "GET";

  if (url === "/" || url === "/health") {
    if (url === "/" && indexHtmlBuf) {
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

  if (expressApp) {
    expressApp(req, res);
  } else {
    const body = '{"error":"starting"}';
    res.writeHead(503, { "Content-Type": "application/json", "Content-Length": String(Buffer.byteLength(body)), "Connection": "close" });
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
  })().catch((err) => console.error("[bootstrap] FATAL:", err));
});
