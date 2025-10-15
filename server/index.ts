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
  // Quick startup: register routes and open port FIRST
  // Move heavy initialization tasks AFTER port opens for faster deployment
  console.log('🚀 Starting Tiber Fantasy - Quick boot mode');
  
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
    
    // PORT IS OPEN - Now run background initialization tasks asynchronously
    // This allows deployment to succeed while heavy tasks complete in background
    
    // Schema drift detection (non-blocking background task)
    (async () => {
      try {
        console.log('🔒 Starting schema drift detection (background)...');
        
        const { schemaDriftService } = await import('./services/SchemaDriftService');
        
        // Validate environment configuration first
        const configValidation = schemaDriftService.validateConfig();
        if (!configValidation.valid) {
          console.error('❌ Schema service configuration issues:', configValidation.issues);
          if (configValidation.issues.some(issue => issue.includes('DATABASE_URL'))) {
            console.warn('⚠️ DATABASE_URL issue detected. Schema drift check will be skipped.');
            return;
          } else {
            // Log warnings but continue
            configValidation.issues.forEach(issue => console.warn('⚠️', issue));
          }
        }
        
        // Run boot-time drift check and auto-migration
        await schemaDriftService.checkAndMigrateOnBoot();
        
        console.log('✅ Schema drift detection completed');
      } catch (error) {
        console.error('💥 Schema drift detection failed (non-blocking)');
        console.error('Error details:', error);
        console.warn('⚠️ App continues to run with existing schema. Monitor for schema-related errors.');
      }
    })();
    
    // Backend spine services initialization (non-blocking)
    (async () => {
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
    })();
    
    // Cron jobs initialization (non-blocking)
    (async () => {
      try {
        console.log('🕒 Initializing nightly processing and cron jobs...');
        
        const { setupAllCronJobs } = await import('./cron/weeklyUpdate');
        setupAllCronJobs();
        
        console.log('✅ Nightly processing and cron jobs initialized');
      } catch (error) {
        console.warn('⚠️ Cron job initialization warning:', error);
      }
    })();
    
    // UPH Scheduler initialization (non-blocking)
    (async () => {
      try {
        console.log('📅 Initializing UPH Nightly Scheduler...');
        
        const { uphScheduler } = await import('./services/UPHScheduler');
        await uphScheduler.initialize();
        
        console.log('✅ UPH Nightly Scheduler initialized successfully');
      } catch (error) {
        console.warn('⚠️ UPH Scheduler initialization warning:', error);
      }
    })();
    
    // Brand Signals Brain initialization (non-blocking)
    (async () => {
      try {
        console.log('🧠 Initializing Brand Signals Brain...');
        
        const { bootstrapBrandSignals } = await import('./services/BrandSignalsBootstrap');
        await bootstrapBrandSignals();
        
        console.log('✅ Brand Signals Brain initialized successfully');
      } catch (error) {
        console.warn('⚠️ Brand Signals Brain initialization warning:', error);
      }
    })();
    
    // Player resolver initialization (non-blocking)
    (async () => {
      try {
        const { initializeDefaultPlayers } = await import('../src/data/resolvers/playerResolver');
        await initializeDefaultPlayers();
        console.log('✅ Player resolver initialized');
      } catch (error) {
        console.error('⚠️ Failed to initialize player resolver:', error);
      }
    })();
  });
})();