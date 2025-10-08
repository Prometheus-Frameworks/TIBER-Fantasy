import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Optimized connection pool for Neon serverless
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20, // Increase from default 10 for concurrent requests
  idleTimeoutMillis: 10000, // Close idle connections after 10s (Neon serverless benefits from shorter timeouts)
  connectionTimeoutMillis: 2000, // Fail fast if pool exhausted
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Log pool stats every 5 minutes in development
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    console.log('📊 Pool stats:', {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount
    });
  }, 300000);
}

// Alert on unexpected pool errors
pool.on('error', (err) => {
  console.error('❌ Unexpected pool error:', err);
});

export const db = drizzle({ client: pool, schema });