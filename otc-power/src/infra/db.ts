// /src/infra/db.ts
import { Pool } from 'pg';

export let db: Pool;

export async function initDb() {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  db = new Pool({ connectionString: url, max: 10 });
  // basic health check
  await db.query('select 1');
  return db;
}

// Helper: typed query
export async function q<T = any>(text: string, params?: any[]): Promise<{ rows: T[] }> {
  if (!db) await initDb();
  // @ts-ignore
  return db.query(text, params);
}