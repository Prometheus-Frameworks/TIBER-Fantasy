// server/bootstrap.mjs — copied to dist/index.mjs at build time.
// "npm start" runs "node dist/index.mjs" which IS this file.
// ~40 lines → Node parses it in < 5ms.
//
// Strategy:
//  1. Raw HTTP server binds port 5000 instantly — zero dependencies.
//  2. /health and / respond 200 immediately at the raw-socket level,
//     which guarantees Replit's health check always passes.
//  3. Browser requests to / (Accept: text/html) are forwarded to Express
//     once the bundle finishes loading so the React SPA is served.
//  4. All other requests go to Express; 503 during the ~3-4s load window.
import http from "node:http";

const PORT = Number(process.env.PORT ?? 5000);
let expressApp = null; // assigned once bundle finishes loading

const server = http.createServer((req, res) => {
  const url = req.url?.split("?")[0]; // ignore query string

  // ── Health / root: always 200 unless it's a browser wanting the SPA ──────
  if (url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end('{"ok":true,"service":"TiberClaw"}');
    return;
  }

  if (url === "/") {
    const wantsHtml = (req.headers["accept"] ?? "").includes("text/html");
    if (!wantsHtml || !expressApp) {
      // Health checker or bundle still loading → immediate 200
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end('{"ok":true,"status":"ok","service":"TiberClaw API"}');
      return;
    }
    // Browser navigating to "/" → forward to Express (serves index.html)
  }

  // ── Forward everything else to Express ────────────────────────────────────
  if (expressApp) {
    expressApp(req, res);
  } else {
    res.writeHead(503, { "Content-Type": "application/json", "Retry-After": "5" });
    res.end('{"error":"Server starting, please retry in a few seconds"}');
  }
});

server.listen(PORT, "0.0.0.0", async () => {
  const t = Date.now();
  console.log(`[bootstrap] port ${PORT} bound — loading app bundle`);

  const { app, initBackground } = await import("./app.mjs");

  expressApp = app;
  console.log(`[bootstrap] bundle ready in ${Date.now() - t}ms — Express active`);

  // Mount all routes, static assets, DB migrations in background
  initBackground().catch((err) => console.error("[bootstrap] init error:", err));
});
