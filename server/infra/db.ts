// server/infra/db.ts - Render PostgreSQL connection with SSL support
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

const connStr = process.env.DATABASE_URL;
if (!connStr) {
  throw new Error("DATABASE_URL is not set. Ensure the database is provisioned.");
}

const isProd = process.env.NODE_ENV === "production";

// Create connection pool with SSL
// rejectUnauthorized: false — encrypts the connection but skips CA chain verification,
// which is required for managed cloud databases (Neon/Replit) from Cloud Run containers.
const pool = new Pool({
  connectionString: connStr,
  ssl: isProd ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000, // 15s — Neon can take time to wake from suspend
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Handle pool errors gracefully without crashing
pool.on('error', (err) => {
  console.error('❌ Unexpected pool error (non-fatal):', err.message);
});

// Log pool stats in development
if (!isProd) {
  setInterval(() => {
    console.log('📊 Pool stats:', {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount
    });
  }, 300000); // Every 5 minutes
}

export const dbPool = pool;
export const db = drizzle(pool, { schema });

// Sanity check function for boot-time verification
export async function pingDb(): Promise<boolean> {
  try {
    const result = await pool.query("SELECT 1 as ok");
    return result.rows?.[0]?.ok === 1;
  } catch (error) {
    console.error('❌ DB ping failed:', error instanceof Error ? error.message : error);
    return false;
  }
}
