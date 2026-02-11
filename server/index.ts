// server/index.ts
import express, { type Request, type Response, type NextFunction } from "express";
import path from "node:path";
import fs from "node:fs";
import { attachSignatureHeader } from "./middleware/signature";
import { registerRoutes } from "./routes";

// dumb logger helper so we don't pull extra deps
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
  res.json = (body: unknown, ...args: unknown[]) => {
    captured = body;
    // @ts-expect-error forward
    return origJson(body, ...args);
  };

  res.on("finish", () => {
    if (!pathStr.startsWith("/api")) return;
    const ms = Date.now() - start;
    let line = `${req.method} ${pathStr} ${res.statusCode} in ${ms}ms`;
    try {
      if (captured) line += ` :: ${JSON.stringify(captured)}`;
    } catch {/* ignore */}
    if (line.length > 160) line = line.slice(0, 159) + "…";
    log(line);
  });

  next();
});

// simple health
app.get("/health", (_req, res) => res.json({ ok: true }));

(async () => {
  log("🚀 Starting Tiber Fantasy – quick boot");

  // Log LLM provider availability at startup
  try {
    const { logProviderStatus } = await import("./llm");
    logProviderStatus();
  } catch (e) {
    console.warn("LLM gateway status check skipped:", e);
  }

  // 1) Mount your API routes
  const maybeServer = await registerRoutes(app);

  // 2) Catch-all for unmatched /api/* routes — return JSON 404 instead of SPA HTML
  app.all("/api/*", (_req: Request, res: Response) => {
    res.status(404).json({ error: "Not found", path: _req.originalUrl });
  });

  // 3) Error handler (after routes)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status ?? err?.statusCode ?? 500;
    res.status(status).json({ message: err?.message ?? "Internal Server Error" });
    console.error("Unhandled error:", err);
  });

  // 4) Dev vs Prod assets
  const isDev = process.env.NODE_ENV === "development";

  if (isDev) {
    // DEV-ONLY: dynamically import Vite so esbuild can drop it from the prod bundle
    try {
      const { setupVite } = await import("./vite");
      await setupVite(app, maybeServer);
      log("⚡ Vite dev middleware mounted");
    } catch (e) {
      console.warn("Vite dev setup failed (continuing):", e);
    }
  } else {
    // PROD: serve static files from dist/public if present, no import.meta needed
    const publicDir = path.resolve(process.cwd(), "dist", "public");
    if (fs.existsSync(publicDir)) {
      app.use(express.static(publicDir));
      log(`🗂️  Serving static assets from ${publicDir}`);
    } else {
      log("ℹ️  No dist/public directory found; serving API only");
    }
  }

  // 5) Auto-migrate database (non-fatal, runs in background)
  async function autoMigrate() {
    try {
      log("🔄 Running database migrations...");
      const { migrate } = await import("drizzle-orm/node-postgres/migrator");
      const { db } = await import("./infra/db");
      await migrate(db, { migrationsFolder: "migrations" });
      log("✅ Drizzle migrations applied successfully");
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      // Known issue: pgEnum types like "consensus_format" show "already exists" on subsequent runs.
      // This is expected behavior when schema hasn't changed - Drizzle doesn't track enum state.
      // Use `npm run db:push` for schema changes instead of migrations folder.
      const isEnumExists = errMsg.includes("already exists");
      if (isEnumExists) {
        log("ℹ️  Database schema up-to-date (enum already exists)");
      } else {
        console.warn("⚠️  Drizzle auto-migrate failed (continuing):", errMsg);
      }
    }
  }

  // 6) Verify database connection (non-fatal)
  async function checkDatabase() {
    try {
      const { pingDb } = await import("./infra/db");
      const ok = await pingDb();
      log(ok ? "✅ Database ping successful" : "⚠️  Database ping failed (check connection)");
      return ok;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      console.warn("⚠️  Database ping error (continuing to boot):", errMsg);
      return false;
    }
  }

  // Run DB checks before starting server
  await autoMigrate();
  await checkDatabase();

  // 7) Listen on Render port (or 5000 for local)
  const PORT = Number(process.env.PORT ?? 5000);
  const HOST = "0.0.0.0";

  const httpListener: { listen: (...args: any[]) => any } =
    (maybeServer as any)?.listen ? (maybeServer as any) : (app as any);

  httpListener.listen(
    { port: PORT, host: HOST, reusePort: true } as any,
    () => log(`[express] serving on port ${PORT}`)
  );

  // ---- Sleeper Sync Scheduler (optional background job) ----
  // Enabled via ENABLE_SLEEPER_SYNC=true env flag
  try {
    const { startScheduler } = await import("./services/sleeperSyncV2/scheduler");
    startScheduler();
  } catch (e) {
    console.warn("Sleeper scheduler init failed (non-fatal):", e);
  }
})();
