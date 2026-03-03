// server/index.ts
import express, { type Request, type Response, type NextFunction } from "express";
import path from "node:path";
import fs from "node:fs";
import { attachSignatureHeader } from "./middleware/signature";

const log = (...args: any[]) => console.log(...args);

const app = express();

// ---- core middleware ----
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(attachSignatureHeader);

// ---- tiny API logger (only /api/*) ----
app.use((req, res, next) => {
  const start = Date.now();
  const pathStr = req.path;
  let captured: unknown;
  const origJson = res.json.bind(res);
  // @ts-expect-error preserve original signature
  res.json = (body: unknown, ...rest: unknown[]) => {
    captured = body;
    // @ts-expect-error forward
    return origJson(body, ...rest);
  };
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

// ─── Health — registered synchronously, responds before anything else loads ──
// Cloud Run / Replit hit these during startup. They must work immediately.
app.get("/health", (_req, res) => res.json({ ok: true, service: "TiberClaw" }));
app.get("/", (req, res, next) => {
  if (process.env.NODE_ENV === "development") return next();
  const indexHtml = path.join(process.cwd(), "dist", "public", "index.html");
  if (fs.existsSync(indexHtml)) return res.sendFile(indexHtml);
  return res.status(200).json({ status: "ok", service: "TiberClaw API", version: "1.0" });
});

// ─── Bind the port FIRST — everything else is background ─────────────────────
// app.listen() returns only after the OS has assigned the port. The callback
// fires on the event loop once the bind is complete, so any health check
// arriving after this point will get a 200 from the handlers above.
const PORT = Number(process.env.PORT ?? 5000);

app.listen(PORT, "0.0.0.0", () => {
  log(`[express] serving on port ${PORT} ✓`);

  // All expensive init runs here — port is already accepting connections.
  initBackground().catch((err) => console.error("Boot init error:", err));
});

// ─── Background initialisation (runs after port is bound) ────────────────────
async function initBackground() {
  log("🚀 Tiber Fantasy – loading routes in background");

  try {
    const { logProviderStatus } = await import("./llm");
    logProviderStatus();
  } catch { /* non-fatal */ }

  // Mount all routes
  const { default: v1Router } = await import("./api/v1/routes");
  app.use("/api/v1", v1Router);

  const { registerRoutes } = await import("./routes");
  const maybeServer = await registerRoutes(app);

  // Catch-all for unmatched /api/*
  app.all("/api/*", (_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found", path: _req.originalUrl });
  });

  // Error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status ?? err?.statusCode ?? 500;
    res.status(status).json({ message: err?.message ?? "Internal Server Error" });
    console.error("Unhandled error:", err);
  });

  // Static assets / Vite
  if (process.env.NODE_ENV === "development") {
    try {
      const { setupVite } = await import("./vite");
      await setupVite(app, maybeServer);
      log("⚡ Vite dev middleware mounted");
    } catch (e) {
      console.warn("Vite dev setup failed:", e);
    }
  } else {
    const publicDir = path.resolve(process.cwd(), "dist", "public");
    if (fs.existsSync(publicDir)) {
      app.use(express.static(publicDir));
      const indexHtml = path.join(publicDir, "index.html");
      if (fs.existsSync(indexHtml)) {
        // SPA fallback for deep routes (/ already handled above)
        app.use((_req: Request, res: Response) => res.sendFile(indexHtml));
      }
      log(`🗂️  Serving static assets from ${publicDir}`);
    }
  }

  // DB migrations — fully fire-and-forget
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
