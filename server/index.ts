// server/index.ts
import express, { type Request, type Response, type NextFunction } from "express";
import path from "node:path";
import fs from "node:fs";
import { attachSignatureHeader } from "./middleware/signature";

const log = (...args: any[]) => console.log(...args);

// Exported so bootstrap.mjs can use it as the request handler.
export const app = express();

// ── Core middleware ────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(attachSignatureHeader);

// Tiny API request logger
app.use((req, res, next) => {
  const start = Date.now();
  const pathStr = req.path;
  let captured: unknown;
  const origJson = res.json.bind(res);
  // @ts-expect-error preserve signature
  res.json = (body: unknown, ...rest: unknown[]) => { captured = body; return origJson(body, ...rest); };
  res.on("finish", () => {
    if (!pathStr.startsWith("/api")) return;
    const ms = Date.now() - start;
    let line = `${req.method} ${pathStr} ${res.statusCode} in ${ms}ms`;
    try { if (captured) line += ` :: ${JSON.stringify(captured)}`; } catch {/* */}
    if (line.length > 160) line = line.slice(0, 159) + "…";
    log(line);
  });
  next();
});

// ── Instant health routes — no dependencies, never hang ──────────────────────
app.get("/health", (_req, res) => res.json({ ok: true, service: "TiberClaw" }));
// In production / returns JSON (health check compatible).
// In dev the next() falls through to Vite which serves index.html.
app.get("/", (req, res, next) => {
  if (process.env.NODE_ENV === "development") return next();
  res.status(200).json({ status: "ok", service: "TiberClaw API", version: "1.0" });
});

// ── initBackground — exported so bootstrap.mjs can call it after hand-off ────
export async function initBackground(): Promise<void> {
  const t = () => `[+${((Date.now() - _initStart) / 1000).toFixed(1)}s]`;
  const _initStart = Date.now();
  log(`🚀 Tiber Fantasy – loading routes in background`);

  // Step 1: LLM provider — fire-and-forget, never blocks route mounting.
  // In production the LLM import can stall indefinitely (no error, no resolve),
  // which previously caused steps 2-4 (API routes) to never register.
  import("./llm")
    .then(({ logProviderStatus }) => { logProviderStatus(); log(`${t()} step 1: done`); })
    .catch(() => { /* non-fatal */ });
  log(`${t()} step 1: fired (non-blocking)`);

  log(`${t()} step 2: loading v1 router`);
  const { default: v1Router } = await import("./api/v1/routes");
  app.use("/api/v1", v1Router);
  log(`${t()} step 2: done`);

  log(`${t()} step 3: importing routes module`);
  const { registerRoutes } = await import("./routes");
  log(`${t()} step 3: done`);

  log(`${t()} step 4: calling registerRoutes`);
  await registerRoutes(app);
  log(`${t()} step 4: done`);

  // API 404 catch-all (after all real routes are mounted)
  app.all("/api/*", (_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found" });
  });

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status ?? err?.statusCode ?? 500;
    res.status(status).json({ message: err?.message ?? "Internal Server Error" });
    console.error("Unhandled error:", err);
  });

  // Static assets (production only — dev uses Vite)
  if (process.env.NODE_ENV !== "development") {
    const publicDir = path.resolve(process.cwd(), "dist", "public");
    if (fs.existsSync(publicDir)) {
      app.use(express.static(publicDir));
      const indexHtml = path.join(publicDir, "index.html");
      if (fs.existsSync(indexHtml)) {
        // Guard: never intercept /api routes — those fall through to Express 404
        app.use((req: Request, res: Response, next: NextFunction) => {
          if (req.originalUrl.startsWith("/api")) return next();
          res.sendFile(indexHtml);
        });
      }
      log(`🗂️  Static assets → ${publicDir}`);
    }
  }

  // DB migrations — fire-and-forget
  import("drizzle-orm/node-postgres/migrator").then(async ({ migrate }) => {
    const { db } = await import("./infra/db");
    await migrate(db, { migrationsFolder: "migrations" });
    log("✅ DB migrations applied");
  }).catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    log(msg.includes("already exists") ? "ℹ️  DB schema up-to-date" : `⚠️  Migration: ${msg}`);
  });

  // DB ping — fire-and-forget
  import("./infra/db").then(async ({ pingDb }) => {
    const ok = await pingDb();
    log(ok ? "✅ DB ping ok" : "⚠️  DB ping failed");
  }).catch(() => {});

  // Sleeper scheduler
  try {
    const { startScheduler } = await import("./services/sleeperSyncV2/scheduler");
    startScheduler();
  } catch { /* non-fatal */ }

  log("✅ Background init complete");
}

// ── Dev-only startup ──────────────────────────────────────────────────────────
// Production uses bootstrap.mjs (dist/index.mjs) which imports dist/app.mjs
// and calls initBackground() after handing the socket to Express.
if (process.env.NODE_ENV === "development") {
  const PORT = Number(process.env.PORT ?? 5000);
  (async () => {
    const { default: v1Router } = await import("./api/v1/routes");
    app.use("/api/v1", v1Router);

    const { registerRoutes } = await import("./routes");
    const httpServer = await registerRoutes(app);

    app.all("/api/*", (_req: Request, res: Response) => {
      res.status(404).json({ error: "Not found" });
    });

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err?.status ?? err?.statusCode ?? 500;
      res.status(status).json({ message: err?.message ?? "Internal Server Error" });
      console.error("Unhandled error:", err);
    });

    const { setupVite } = await import("./vite");
    await setupVite(app, httpServer);

    httpServer.listen(PORT, "0.0.0.0", () => {
      log(`[express] serving on port ${PORT}`);
    });
  })().catch(console.error);
}
