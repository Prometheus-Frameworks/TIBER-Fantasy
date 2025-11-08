import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Configure Neon to handle connection errors gracefully
neonConfig.useSecureWebSocket = true;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Optimized connection pool for Neon serverless with better error handling
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Increase from default 10 for concurrent requests
  idleTimeoutMillis: 10000, // Close idle connections after 10s (Neon serverless benefits from shorter timeouts)
  connectionTimeoutMillis: 5000, // Increase timeout to 5s to handle transient issues
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Log pool stats every 5 minutes in development
if (process.env.NODE_ENV === "development") {
  setInterval(() => {
    console.log("📊 Pool stats:", {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    });
  }, 300000);
}

// Handle pool errors gracefully without crashing
pool.on("error", (err) => {
  // Suppress WebSocket-related errors that are transient
  if (err.message && err.message.includes("WebSocket")) {
    console.warn(
      "⚠️  Transient database connection warning (auto-retry enabled)",
    );
  } else {
    console.error("❌ Unexpected pool error:", err);
  }
});

export const db = drizzle({ client: pool, schema });
