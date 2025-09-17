import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { attachSignatureHeader } from "./middleware/signature";
import { OTC_SIGNATURE } from "../shared/otcSignature";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(attachSignatureHeader);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize backend spine services with sample data
  try {
    console.log('🚀 Initializing backend spine services...');
    
    const { sleeperSyncService } = await import('./services/sleeperSyncService');
    const { logsProjectionsService } = await import('./services/logsProjectionsService');  
    const { ratingsEngineService } = await import('./services/ratingsEngineService');
    
    await Promise.all([
      logsProjectionsService.loadSampleData(),
      ratingsEngineService.generateSampleRatings()
    ]);
    
    // Attempt initial Sleeper sync (will fallback to cache gracefully)
    await sleeperSyncService.syncPlayers();
    
    console.log('✅ Backend spine services initialized');
  } catch (error) {
    console.warn('⚠️ Backend spine initialization warning:', error);
  }

  // Initialize nightly processing and cron jobs
  try {
    console.log('🕒 Initializing nightly processing and cron jobs...');
    
    const { setupAllCronJobs } = await import('./cron/weeklyUpdate');
    setupAllCronJobs();
    
    console.log('✅ Nightly processing and cron jobs initialized');
  } catch (error) {
    console.warn('⚠️ Cron job initialization warning:', error);
  }

  // Initialize UPH Nightly Scheduler
  try {
    console.log('📅 Initializing UPH Nightly Scheduler...');
    
    const { uphScheduler } = await import('./services/UPHScheduler');
    await uphScheduler.initialize();
    
    console.log('✅ UPH Nightly Scheduler initialized successfully');
  } catch (error) {
    console.warn('⚠️ UPH Scheduler initialization warning:', error);
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, async () => {
    log(`serving on port ${port}`);
    
    // Initialize player resolver after server is running
    try {
      const { initializeDefaultPlayers } = await import('../src/data/resolvers/playerResolver');
      await initializeDefaultPlayers();
      console.log('✅ Player resolver initialized');
    } catch (error) {
      console.error('⚠️ Failed to initialize player resolver:', error);
    }
  });
})();