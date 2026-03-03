// server/bootstrap.mjs — copied to dist/index.mjs at build time.
// run: ["node", "dist/index.mjs"]
//
// Cloud Run startup sequence:
//   1. Load app.mjs  (CPU fully allocated — startup probe retries on ECONNREFUSED)
//   2. Race initBackground() vs 45s deadline
//      - completes fast → port binds, all routes ready
//      - hangs (DB cold-start) → port binds after 45s, remaining routes mount in background
//   3. Bind port 5000  (startup probe passes, traffic flows in)
//
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

  // ── Phase 2: mount routes with deadline ──────────────────────────────────
  // Race initBackground() against a 45s deadline. If the DB is cold and a query
  // hangs, statement_timeout (15s) will unblock it. The 45s deadline is a
  // safety net: port binds regardless, and any remaining route mounting
  // continues in the background.
  const INIT_DEADLINE_MS = 45_000;
  let initDone = false;

  const initPromise = initBackground().then(() => {
    initDone = true;
    console.log("[bootstrap] initBackground complete");
  }).catch((err) => {
    console.error("[bootstrap] initBackground error (non-fatal):", err?.message ?? err);
  });

  const deadline = new Promise((resolve) =>
    setTimeout(() => {
      if (!initDone) {
        console.warn(`[bootstrap] initBackground still running after ${INIT_DEADLINE_MS / 1000}s — binding port anyway`);
      }
      resolve(null);
    }, INIT_DEADLINE_MS)
  );

  await Promise.race([initPromise, deadline]);

  // ── Phase 3: bind port — startup probe passes, Cloud Run sends traffic ───
  const server = http.createServer(app);
  server.on("error", (err) => console.error("[bootstrap] server error:", err));

  await new Promise((resolve, reject) => {
    server.listen(PORT, "0.0.0.0", () => {
      console.log(`[bootstrap] port ${PORT} bound — ${initDone ? "fully ready" : "routes still loading"}`);
      resolve(null);
    });
    server.once("error", reject);
  });

  // If init was still running, wait for it now (non-blocking for port health)
  if (!initDone) {
    initPromise.then(() => {
      console.log("[bootstrap] late initBackground complete — all routes now mounted");
    });
  }
}

main().catch((err) => {
  console.error("[bootstrap] FATAL — exiting:", err);
  process.exit(1);
});
