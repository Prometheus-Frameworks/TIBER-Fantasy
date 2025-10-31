// server/index.ts
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { attachSignatureHeader } from "./middleware/signature";
import { OTC_SIGNATURE } from "../shared/otcSignature";

// Avoid unused-import errors in strict builds
void OTC_SIGNATURE;

const app = express();

// ---- Core middleware ----
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(attachSignatureHeader);

// ---- Lightweight request logger for /api responses ----
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson: any, ...args: any[]) {
    capturedJsonResponse = bodyJson as Record<string, any>;
    // @ts-expect-error – preserving original signature
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    if (!path.startsWith("/api")) return;

    const duration = Date.now() - start;
    let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
    if (capturedJsonResponse) {
      try {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      } catch {
        // ignore serialization failures
      }
    }
    if (logLine.length > 80) logLine = logLine.slice(0, 79) + "…";
    log(logLine);
  });

  next();
});

// ---- Health endpoint (keep it dead simple) ----
app.get("/health", (_req, res) => res.json({ ok: true }));

(async () => {
  console.log("🚀 Starting Tiber Fantasy (quick boot mode)…");

  // 1) Register routes first. If registerRoutes creates/returns an http.Server, use that to listen.
  //    Otherwise, we’ll create one from the Express app.
  const server = await registerRoutes(app);

  // 2) Error handler (must be after route registration)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err?.status || err?.statusCode || 500;
    const message = err?.message || "Internal Server Error";
    res.status(status).json({ message });
    // Surface to logs
    console.error("Unhandled app error:", err);
  });

  // 3) Dev vs Prod assets
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // 4) Listen using Render's assigned PORT (fallback 5000 for local/replit)
  const PORT = Number(process.env.PORT ?? 5000);
  const HOST = "0.0.0.0";

  // If registerRoutes returned an http.Server, use it; otherwise fall back to app.listen()
  const httpListener: { listen: (...args: any[]) => any } = (server as any)
    ?.listen
    ? (server as any)
    : (app as any);

  httpListener.listen(PORT, HOST, async () => {
    log(`serving on port ${PORT}`);

    // ---------------------------
    // Background initialization
    // ---------------------------

    // Schema drift detection (non-blocking)
    (async () => {
      try {
        console.log("🔒 Starting schema drift detection (background)...");
        const { schemaDriftService } = await import(
          "./services/SchemaDriftService"
        );
        const configValidation = schemaDriftService.validateConfig();

        if (!configValidation.valid) {
          console.error(
            "❌ Schema service configuration issues:",
            configValidation.issues,
          );
          if (configValidation.issues.some((i) => i.includes("DATABASE_URL"))) {
            console.warn(
              "⚠️ DATABASE_URL issue detected. Skipping drift check.",
            );
            return;
          } else {
            configValidation.issues.forEach((issue) =>
              console.warn("⚠️", issue),
            );
          }
        }

        await schemaDriftService.checkAndMigrateOnBoot();
        console.log("✅ Schema drift detection completed");
      } catch (error) {
        console.error(
          "💥 Schema drift detection failed (non-blocking):",
          error,
        );
        console.warn("⚠️ App continues with existing schema.");
      }
    })();

    // Backend spine services (non-blocking)
    (async () => {
      try {
        console.log("🚀 Initializing backend spine services…");
        const { sleeperSyncService } = await import(
          "./services/sleeperSyncService"
        );
        const { logsProjectionsService } = await import(
          "./services/logsProjectionsService"
        );
        const { ratingsEngineService } = await import(
          "./services/ratingsEngineService"
        );

        await Promise.all([
          logsProjectionsService.loadSampleData(),
          ratingsEngineService.generateSampleRatings(),
        ]);

        await sleeperSyncService.syncPlayers(); // best effort
        console.log("✅ Backend spine services initialized");
      } catch (error) {
        console.warn("⚠️ Backend spine initialization warning:", error);
      }
    })();

    // Cron jobs (non-blocking)
    (async () => {
      try {
        console.log("🕒 Initializing nightly processing and cron jobs…");
        const { setupAllCronJobs } = await import("./cron/weeklyUpdate");
        setupAllCronJobs();
        console.log("✅ Nightly processing and cron jobs initialized");
      } catch (error) {
        console.warn("⚠️ Cron job initialization warning:", error);
      }
    })();

    // UPH Scheduler (non-blocking)
    (async () => {
      try {
        console.log("📅 Initializing UPH Nightly Scheduler…");
        const { uphScheduler } = await import("./services/UPHScheduler");
        await uphScheduler.initialize();
        console.log("✅ UPH Nightly Scheduler initialized successfully");
      } catch (error) {
        console.warn("⚠️ UPH Scheduler initialization warning:", error);
      }
    })();

    // Brand Signals Brain (non-blocking)
    (async () => {
      try {
        console.log("🧠 Initializing Brand Signals Brain…");
        const { bootstrapBrandSignals } = await import(
          "./services/BrandSignalsBootstrap"
        );
        await bootstrapBrandSignals();
        console.log("✅ Brand Signals Brain initialized successfully");
      } catch (error) {
        console.warn("⚠️ Brand Signals Brain initialization warning:", error);
      }
    })();

    // Player resolver (non-blocking)
    (async () => {
      try {
        const { initializeDefaultPlayers } = await import(
          "../src/data/resolvers/playerResolver"
        );
        await initializeDefaultPlayers();
        console.log("✅ Player resolver initialized");
      } catch (error) {
        console.error("⚠️ Failed to initialize player resolver:", error);
      }
    })();
  });
})();
