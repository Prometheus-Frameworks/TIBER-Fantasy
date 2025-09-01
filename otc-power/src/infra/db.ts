import { Pool } from 'pg';

let pool: Pool;

export async function initDb() {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });
  
  console.log('🗄️ Database pool initialized');
}

export const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),
  getClient: () => pool.connect()
};

export function closeDb() {
  return pool?.end();
}