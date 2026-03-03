// server/index.ts
import express, { type Request, type Response, type NextFunction } from "express";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
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

// ─── Health — mounted FIRST, responds before anything else is ready ───────────
app.get("/health", (_req, res) => res.json({ ok: true, service: "TiberClaw" }));
app.get("/", (req, res, next) => {
  if (process.env.NODE_ENV === "development") return next();
  const indexHtml = path.join(process.cwd(), "dist", "public", "index.html");
  if (fs.existsSync(indexHtml)) return res.sendFile(indexHtml);
  return res.status(200).json({ status: "ok", service: "TiberClaw API", version: "1.0" });
});

// ─── Startup ──────────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 5000);
const HOST = "0.0.0.0";

// Create HTTP server and START LISTENING IMMEDIATELY.
// Health checks will pass from this point forward.
const server = http.createServer(app);
server.listen({ port: PORT, host: HOST, reusePort: true } as any, () => {
  log(`[express] serving on port ${PORT}`);
});

// Everything after this is background — it does NOT block health checks.
(async () => {
  log("🚀 Starting Tiber Fantasy – initialising routes in background");

  try {
    const { logProviderStatus } = await import("./llm");
    logProviderStatus();
  } catch (e) {
    console.warn("LLM gateway status check skipped:", e);
  }

  // Mount v1 API
  const { default: v1Router } = await import("./api/v1/routes");
  app.use("/api/v1", v1Router);

  // Mount all other routes (this is the slow part — ~5-10s)
  const { registerRoutes } = await import("./routes");
  await registerRoutes(app);

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

  // Static assets (prod) / Vite (dev)
  if (process.env.NODE_ENV === "development") {
    try {
      const { setupVite } = await import("./vite");
      await setupVite(app, server);
      log("⚡ Vite dev middleware mounted");
    } catch (e) {
      console.warn("Vite dev setup failed (continuing):", e);
    }
  } else {
    const publicDir = path.resolve(process.cwd(), "dist", "public");
    if (fs.existsSync(publicDir)) {
      app.use(express.static(publicDir));
      log(`🗂️  Serving static assets from ${publicDir}`);
      const indexHtml = path.join(publicDir, "index.html");
      if (fs.existsSync(indexHtml)) {
        app.use((_req: Request, res: Response) => res.sendFile(indexHtml));
      }
    } else {
      log("ℹ️  No dist/public directory found; API-only mode");
    }
  }

  // DB migrations — fire and forget, fully background
  import("drizzle-orm/node-postgres/migrator").then(async ({ migrate }) => {
    const { db } = await import("./infra/db");
    await migrate(db, { migrationsFolder: "migrations" });
    log("✅ Drizzle migrations applied");
  }).catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("already exists")) {
      log("ℹ️  DB schema up-to-date");
    } else {
      console.warn("⚠️  Migration failed (non-fatal):", msg);
    }
  });

  // DB ping — fire and forget
  import("./infra/db").then(async ({ pingDb }) => {
    const ok = await pingDb();
    log(ok ? "✅ Database ping successful" : "⚠️  DB ping failed");
  }).catch(() => {});

  // Sleeper scheduler
  try {
    const { startScheduler } = await import("./services/sleeperSyncV2/scheduler");
    startScheduler();
  } catch (e) {
    console.warn("Sleeper scheduler init failed (non-fatal):", e);
  }

  log("✅ Background initialisation complete");
})().catch((err) => console.error("Boot error:", err));
