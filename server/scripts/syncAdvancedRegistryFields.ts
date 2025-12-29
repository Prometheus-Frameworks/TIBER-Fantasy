import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { Pool } from 'pg';

type Kind = 'view' | 'external' | 'unknown' | 'table';
type Layer = 'bronze' | 'silver' | 'gold' | 'application' | 'unknown';
type Status = 'active' | 'deprecated' | 'missing' | 'unknown';

type AdvancedAsset = {
  readonly name: string;
  readonly kind?: Kind;
  readonly layer?: Layer;
  readonly description?: string;
  readonly fields?: string[];
  readonly status?: Status;
  readonly upstream?: string[];
  readonly tags?: string[];
  readonly provides_metrics?: string[];
  readonly consumed_by?: string[];
  readonly refresh?: {
    readonly cadence?: string;
    readonly sla_hours?: number;
    readonly last_updated_field?: string;
  };
};

type AdvancedRegistry = {
  readonly assets?: AdvancedAsset[];
};

const REGISTRY_PATH = path.resolve(process.cwd(), 'docs/metric-matrix/advanced_views_registry.json');

function readRegistry(): AdvancedRegistry {
  const raw = readFileSync(REGISTRY_PATH, 'utf8');
  return JSON.parse(raw) as AdvancedRegistry;
}

function writeRegistry(registry: AdvancedRegistry): void {
  const output = JSON.stringify(registry, null, 2);
  writeFileSync(REGISTRY_PATH, `${output}\n`, 'utf8');
}

function normalizeList(values?: string[]): string[] | undefined {
  if (!values) return undefined;
  const deduped = Array.from(new Set(values));
  if (deduped.length === 0) return undefined;
  return deduped.sort();
}

function buildPool(): Pool | undefined {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn('DATABASE_URL is not set; skipping advanced registry field sync.');
    return undefined;
  }

  const isProd = process.env.NODE_ENV === 'production';
  return new Pool({
    connectionString,
    ssl: isProd ? { rejectUnauthorized: false } : false,
  });
}

async function fetchViewColumns(pool: Pool, viewName: string): Promise<string[] | null> {
  const viewResult = await pool.query<{ table_schema: string }>(
    `
      SELECT table_schema
      FROM information_schema.views
      WHERE table_name = $1
      LIMIT 1;
    `,
    [viewName],
  );

  if (viewResult.rowCount === 0) {
    return null;
  }

  const tableSchema = viewResult.rows[0]?.table_schema ?? 'public';
  const columnsResult = await pool.query<{ column_name: string }>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = $1 AND table_schema = $2
      ORDER BY ordinal_position;
    `,
    [viewName, tableSchema],
  );

  return columnsResult.rows.map((row) => row.column_name);
}

function cleanTags(existing?: string[], removeTag?: string): string[] | undefined {
  const filtered = (existing ?? []).filter((tag) => tag !== removeTag);
  return normalizeList(filtered);
}

async function main(): Promise<void> {
  const pool = buildPool();
  if (!pool) return;

  const registry = readRegistry();
  const assets = registry.assets ?? [];

  let updated = false;

  try {
    for (let i = 0; i < assets.length; i += 1) {
      const asset = assets[i];
      if (asset.kind !== 'view') continue;

      const fieldsNormalized = normalizeList(asset.fields);
      if (fieldsNormalized && fieldsNormalized.length > 0) {
        assets[i] = { ...asset, fields: fieldsNormalized };
        continue;
      }

      const columns = await fetchViewColumns(pool, asset.name);
      if (columns && columns.length > 0) {
        const tags = cleanTags(asset.tags, 'needs_field_list');
        assets[i] = {
          ...asset,
          fields: normalizeList(columns),
          status: asset.status === 'unknown' ? 'active' : asset.status,
          tags,
        };
        updated = true;
        console.log(`Synced fields for view '${asset.name}' from database metadata.`);
      } else {
        console.warn(`No columns found for view '${asset.name}'. Keeping fields undefined.`);
      }
    }
  } catch (error) {
    console.warn(
      `Database unavailable or query failed while syncing advanced registry: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return;
  } finally {
    await pool.end();
  }

  if (updated) {
    writeRegistry({ assets });
    console.log('advanced_views_registry.json updated with database field metadata.');
  } else {
    console.log('No registry updates were necessary.');
  }
}

void main();
