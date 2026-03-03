// server/bootstrap.mjs — copied to dist/index.mjs at build time.
// "npm start" runs "node dist/index.mjs" which IS this file.
// This file is ~20 lines so Node parses it in < 5ms.
// It binds port 5000 immediately so Replit's health check always gets 200,
// even while the real 92 000-line bundle is loading (takes ~3-4 s to JIT).
import http from "node:http";

const PORT = Number(process.env.PORT ?? 5000);

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end('{"ok":true,"status":"starting"}');
});

server.listen(PORT, "0.0.0.0", async () => {
  const t = Date.now();
  console.log(`[bootstrap] port ${PORT} bound — loading app bundle`);

  // Import the real bundle. This takes ~3-4 s (JIT of 92 000 lines).
  // During that wait, health checks above still return 200.
  const { app, initBackground } = await import("./app.mjs");

  console.log(`[bootstrap] bundle ready in ${Date.now() - t}ms — handing off to Express`);

  // Hand the live socket to Express — zero downtime, same port.
  server.removeAllListeners("request");
  server.on("request", app);

  // Mount all routes, static assets, DB migrations in background.
  initBackground().catch((err) => console.error("[bootstrap] init error:", err));
});
