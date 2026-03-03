// server/bootstrap.mjs — copied to dist/index.mjs at build time.
// run: ["node", "dist/index.mjs"]
//
// Cloud Run startup sequence:
//   1. Load app.mjs  (CPU fully allocated — startup probe retries on ECONNREFUSED)
//   2. Call initBackground()  (mount routes, warm caches)
//   3. Bind port 5000  (startup probe passes here, traffic flows in)
//
// This keeps CPU allocated during the expensive JIT/bundle-load phase.
// Cloud Run allows up to 240s for startup probes, so ~15s init is fine.
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
  console.log(`[bootstrap] index.html cached (${indexHtmlBuf.length} bytes)`);
} catch {
  console.warn(`[bootstrap] index.html not found at ${INDEX_HTML_PATH}`);
}

async function main() {
  // ── Phase 1: load bundle ──────────────────────────────────────────────────
  // Cloud Run allocates full CPU while the startup probe is failing (ECONNREFUSED).
  // Loading app.mjs here (~3s on a real CPU) completes before the probe times out.
  console.log("[bootstrap] loading app bundle…");
  const t0 = Date.now();
  const { app, initBackground } = await import("./app.mjs");
  console.log(`[bootstrap] bundle loaded in ${Date.now() - t0}ms`);

  // ── Phase 2: mount routes + warm caches ──────────────────────────────────
  await initBackground();
  console.log("[bootstrap] routes ready");

  // ── Phase 3: bind port — startup probe passes, Cloud Run sends traffic ───
  const server = http.createServer(app);
  server.on("error", (err) => console.error("[bootstrap] server error:", err));

  await new Promise((resolve, reject) => {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`[bootstrap] port ${PORT} bound — fully ready`);
      resolve(null);
    });
    server.once("error", reject);
  });
}

main().catch((err) => {
  console.error("[bootstrap] FATAL — exiting:", err);
  process.exit(1);
});
