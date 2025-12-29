import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import pg from 'pg';

const { Pool } = pg;

interface AdvancedAsset {
  name: string;
  kind?: string;
  layer?: string;
  description?: string;
  fields?: string[];
  status?: string;
  upstream?: string[];
  tags?: string[];
}

interface AdvancedRegistry {
  assets?: AdvancedAsset[];
}

function readJsonFile<T>(relativePath: string): T {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const raw = readFileSync(absolutePath, 'utf8');
  return JSON.parse(raw) as T;
}

function writeJsonFile(relativePath: string, data: unknown): void {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const json = JSON.stringify(data, null, 2) + '\n';
  writeFileSync(absolutePath, json, 'utf8');
}

async function fetchViewColumns(pool: pg.Pool, viewName: string): Promise<string[] | null> {
  try {
    const result = await pool.query<{ column_name: string }>(
      `SELECT column_name 
       FROM information_schema.columns 
       WHERE table_name = $1 
       ORDER BY ordinal_position`,
      [viewName]
    );
    if (result.rows.length === 0) {
      return null;
    }
    return result.rows.map((row) => row.column_name).sort();
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const registryPath = 'docs/metric-matrix/advanced_views_registry.json';
  const registry = readJsonFile<AdvancedRegistry>(registryPath);

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.log('DATABASE_URL not set. Skipping DB-based field sync.');
    console.log('Registry sync complete (no changes made).');
    return;
  }

  const pool = new Pool({ connectionString: databaseUrl });
  let updated = 0;

  try {
    await pool.query('SELECT 1');
    console.log('Connected to database.');
  } catch (err) {
    console.warn('Could not connect to database. Skipping DB-based field sync.');
    console.warn('Error:', err instanceof Error ? err.message : String(err));
    await pool.end();
    return;
  }

  const assets = registry.assets ?? [];

  for (const asset of assets) {
    if (asset.kind !== 'view') {
      continue;
    }

    const columns = await fetchViewColumns(pool, asset.name);
    if (columns === null) {
      console.log(`  View "${asset.name}" not found in DB or no columns.`);
      continue;
    }

    const existingFields = asset.fields ?? [];
    const existingSet = new Set(existingFields);
    const columnsSet = new Set(columns);

    const isSame =
      existingFields.length === columns.length &&
      existingFields.every((f) => columnsSet.has(f)) &&
      columns.every((c) => existingSet.has(c));

    if (!isSame) {
      asset.fields = columns;
      updated++;
      console.log(`  Updated fields for "${asset.name}": ${columns.length} columns`);
    }
  }

  await pool.end();

  if (updated > 0) {
    writeJsonFile(registryPath, registry);
    console.log(`\nRegistry sync complete. Updated ${updated} view(s).`);
  } else {
    console.log('\nRegistry sync complete. No changes needed.');
  }
}

void main();
