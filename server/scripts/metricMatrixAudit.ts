import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { Pool } from 'pg';

interface UsageRoute {
  readonly sources?: string[];
  readonly fields_returned?: string[];
}

interface UsageService {
  readonly sources?: string[];
  readonly fields_generated?: string[];
  readonly fields_returned?: string[];
}

interface UsageFeature {
  readonly source_tables?: string[];
  readonly inputs?: string[];
}

interface UsageInventory {
  readonly routes?: UsageRoute[];
  readonly services?: UsageService[];
  readonly features?: Record<string, UsageFeature>;
}

type MetricKind = 'table' | 'view' | 'external' | 'unknown';
type MetricLayer = 'bronze' | 'silver' | 'gold' | 'application' | 'unknown';
type MetricStatus = 'active' | 'deprecated' | 'missing' | 'unknown';

type RefreshMetadata = {
  readonly cadence?: string;
  readonly sla_hours?: number;
  readonly last_updated_field?: string;
};

type MetricSource = {
  readonly name: string;
  readonly kind: MetricKind;
  readonly layer: MetricLayer;
  readonly status: MetricStatus;
  readonly description?: string;
  readonly upstream?: string[];
  readonly fields?: string[];
  readonly provides_metrics?: string[];
  readonly consumed_by?: string[];
  readonly refresh?: RefreshMetadata;
  readonly tags?: string[];
};

type MetricMatrix = {
  readonly sources: MetricSource[];
};

interface TableColumn {
  readonly name: string;
  readonly type?: string;
}

interface TableDefinition {
  readonly description?: string;
  readonly columns?: TableColumn[];
  readonly primary_key?: string[];
  readonly indexes?: string[];
  readonly layer?: MetricLayer;
  readonly entries?: string[];
  readonly upstream?: string[];
}

type TableInventory = Record<string, TableDefinition>;

interface AdvancedAsset {
  readonly name: string;
  readonly kind?: string;
  readonly layer?: string;
  readonly description?: string;
  readonly fields?: string[];
  readonly status?: MetricStatus;
  readonly upstream?: string[];
  readonly tags?: string[];
}

interface AdvancedRegistry {
  readonly assets?: AdvancedAsset[];
}

const VALID_KINDS: readonly MetricKind[] = ['table', 'view', 'external', 'unknown'];
const VALID_LAYERS: readonly MetricLayer[] = ['bronze', 'silver', 'gold', 'application', 'unknown'];

function readJsonFile<T>(relativePath: string): T {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const raw = readFileSync(absolutePath, 'utf8');
  return JSON.parse(raw) as T;
}

function collectUsageSources(usage: UsageInventory): string[] {
  const discovered = new Set<string>();

  (usage.routes ?? []).forEach((route) => {
    (route.sources ?? []).forEach((source) => discovered.add(source));
  });

  (usage.services ?? []).forEach((service) => {
    (service.sources ?? []).forEach((source) => discovered.add(source));
  });

  const featureGroups = usage.features ?? {};
  Object.values(featureGroups).forEach((feature) => {
    (feature.source_tables ?? []).forEach((source) => discovered.add(source));
  });

  return [...discovered].sort();
}

function collectMatrixCoverage(matrix: MetricMatrix): Set<string> {
  const coverage = new Set<string>();

  (matrix.sources ?? []).forEach((source) => {
    coverage.add(source.name);
    (source.upstream ?? []).forEach((upstream) => coverage.add(upstream));
  });

  return coverage;
}

function detectDuplicateScriptKeys(packageJsonRaw: string): string[] {
  const scriptsMatch = packageJsonRaw.match(/"scripts"\s*:\s*{([^}]*)}/s);
  if (!scriptsMatch) return [];

  const scriptsBlock = scriptsMatch[1];
  const keyRegex = /"([^"\n]+)"\s*:/g;
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  let match: RegExpExecArray | null;
  while ((match = keyRegex.exec(scriptsBlock)) !== null) {
    const key = match[1];
    if (seen.has(key)) {
      duplicates.add(key);
    } else {
      seen.add(key);
    }
  }

  return [...duplicates].sort();
}

function detectDuplicateSources(matrix: MetricMatrix): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  (matrix.sources ?? []).forEach((source) => {
    if (seen.has(source.name)) {
      duplicates.add(source.name);
    } else {
      seen.add(source.name);
    }
  });

  return [...duplicates].sort();
}

function findDuplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  values.forEach((value) => {
    if (seen.has(value)) {
      duplicates.add(value);
    } else {
      seen.add(value);
    }
  });

  return [...duplicates].sort();
}

function buildPool(): Pool | undefined {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
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

function validateTableCoverage(
  tables: Array<[string, TableDefinition]>,
  matrix: MetricMatrix,
): {
  missingSources: string[];
  fieldMismatches: Array<{ source: string; missingInMatrix: string[]; extraInMatrix: string[] }>;
  invalidLayers: string[];
  wrongKinds: string[];
} {
  const matrixByName = new Map<string, MetricSource>((matrix.sources ?? []).map((entry) => [entry.name, entry]));
  const missingSources: string[] = [];
  const fieldMismatches: Array<{ source: string; missingInMatrix: string[]; extraInMatrix: string[] }> = [];
  const invalidLayers: string[] = [];
  const wrongKinds: string[] = [];

  tables.forEach(([name, definition]) => {
    const layer = definition.layer;
    if (!layer || !(VALID_LAYERS as readonly string[]).includes(layer) || layer === 'unknown') {
      invalidLayers.push(name);
    }

    const entry = matrixByName.get(name);
    if (!entry) {
      missingSources.push(name);
      return;
    }

    if (entry.kind !== 'table') {
      wrongKinds.push(name);
    }

    const inventoryFields = new Set((definition.columns ?? []).map((column) => column.name));
    const matrixFields = new Set(entry.fields ?? []);

    const missingInMatrix = [...inventoryFields].filter((field) => !matrixFields.has(field)).sort();
    const extraInMatrix = [...matrixFields].filter((field) => !inventoryFields.has(field)).sort();

    if (missingInMatrix.length > 0 || extraInMatrix.length > 0 || entry.fields === undefined) {
      fieldMismatches.push({ source: name, missingInMatrix, extraInMatrix });
    }
  });

  return {
    missingSources: missingSources.sort(),
    fieldMismatches,
    invalidLayers: invalidLayers.sort(),
    wrongKinds: wrongKinds.sort(),
  };
}

function validateRegistry(advanced: AdvancedRegistry): { invalidKinds: string[]; invalidLayers: string[] } {
  const invalidKinds = new Set<string>();
  const invalidLayers = new Set<string>();

  (advanced.assets ?? []).forEach((asset) => {
    if (!asset.kind || !(VALID_KINDS as readonly string[]).includes(asset.kind as MetricKind) || asset.kind === 'table') {
      invalidKinds.add(asset.name);
    }

    if (!asset.layer || !(VALID_LAYERS as readonly string[]).includes(asset.layer as MetricLayer)) {
      invalidLayers.add(asset.name);
    }
  });

  return { invalidKinds: [...invalidKinds].sort(), invalidLayers: [...invalidLayers].sort() };
}

function partitionTableInventory(
  tables: TableInventory,
): { seedable: Array<[string, TableDefinition]>; skipped: string[]; missingColumns: string[] } {
  const seedable: Array<[string, TableDefinition]> = [];
  const skipped: string[] = [];
  const missingColumns: string[] = [];

  Object.entries(tables).forEach(([name, definition]) => {
    if (!definition.columns || definition.columns.length === 0) {
      if ((definition as unknown as { entries?: unknown }).entries) {
        skipped.push(name);
      } else {
        missingColumns.push(name);
      }
      return;
    }

    seedable.push([name, definition]);
  });

  return { seedable, skipped: skipped.sort(), missingColumns: missingColumns.sort() };
}

function validateNonTableFields(
  matrix: MetricMatrix,
): { emptyFieldArrays: string[]; activeMissingFields: string[] } {
  const emptyFieldArrays: string[] = [];
  const activeMissingFields: string[] = [];

  (matrix.sources ?? []).forEach((source) => {
    if (source.kind === 'table') return;

    if (source.fields && source.fields.length === 0) {
      emptyFieldArrays.push(source.name);
    }

    const hasNeedsTag = (source.tags ?? []).includes('needs_field_list');
    if (source.status === 'active' && (!source.fields || source.fields.length === 0)) {
      activeMissingFields.push(source.name);
    } else if (source.status === 'unknown' && hasNeedsTag && source.fields && source.fields.length === 0) {
      emptyFieldArrays.push(source.name);
    }
  });

  return { emptyFieldArrays: emptyFieldArrays.sort(), activeMissingFields: activeMissingFields.sort() };
}

async function validateDbViews(
  matrix: MetricMatrix,
  registry: AdvancedRegistry,
): Promise<{ missingFieldsForExistingViews: string[]; unavailableReason?: string }> {
  const pool = buildPool();
  if (!pool) {
    return { missingFieldsForExistingViews: [], unavailableReason: 'DATABASE_URL not set; skipping DB view validation.' };
  }

  const matrixByName = new Map<string, MetricSource>((matrix.sources ?? []).map((entry) => [entry.name, entry]));
  const viewAssets = (registry.assets ?? []).filter((asset) => asset.kind === 'view');
  const missingFieldsForExistingViews: string[] = [];

  try {
    for (const asset of viewAssets) {
      const columns = await fetchViewColumns(pool, asset.name);
      if (!columns || columns.length === 0) continue;

      const matrixEntry = matrixByName.get(asset.name);
      if (!matrixEntry || !matrixEntry.fields || matrixEntry.fields.length === 0) {
        missingFieldsForExistingViews.push(asset.name);
      }
    }
  } catch (error) {
    return {
      missingFieldsForExistingViews: [],
      unavailableReason: `Database error during view field validation: ${error instanceof Error ? error.message : String(error)}`,
    };
  } finally {
    await pool.end();
  }

  return { missingFieldsForExistingViews: missingFieldsForExistingViews.sort() };
}

async function main(): Promise<void> {
  const usage = readJsonFile<UsageInventory>('docs/metric-matrix/nflfastr_inventory_usage.json');
  const tables = readJsonFile<TableInventory>('docs/metric-matrix/nflfastr_inventory_tables.json');
  const advancedViews = readJsonFile<AdvancedRegistry>('docs/metric-matrix/advanced_views_registry.json');
  const metricMatrix = readJsonFile<MetricMatrix>('docs/metric-matrix/metric_matrix.json');
  const packageJsonRaw = readFileSync(path.resolve(process.cwd(), 'package.json'), 'utf8');

  const usageSources = collectUsageSources(usage);
  const tablePartitions = partitionTableInventory(tables);
  const catalog = new Set<string>([
    ...tablePartitions.seedable.map(([name]) => name),
    ...((advancedViews.assets ?? []).map((asset) => asset.name)),
  ]);

  const matrixCoverage = collectMatrixCoverage(metricMatrix);
  const registryNames = (advancedViews.assets ?? []).map((asset) => asset.name);

  const missingCatalog = usageSources.filter((source) => !catalog.has(source));
  const missingMatrixCoverage = usageSources.filter((source) => !matrixCoverage.has(source));

  const tableCoverage = validateTableCoverage(tablePartitions.seedable, metricMatrix);
  const duplicateScripts = detectDuplicateScriptKeys(packageJsonRaw);
  const duplicateSources = detectDuplicateSources(metricMatrix);
  const registryValidation = validateRegistry(advancedViews);
  const registryDuplicates = findDuplicates(registryNames);
  const registryTableCollisions = [...new Set(registryNames.filter((name) => Object.prototype.hasOwnProperty.call(tables, name)))].sort();
  const nonTableFields = validateNonTableFields(metricMatrix);
  const dbViewValidation = await validateDbViews(metricMatrix, advancedViews);

  const hasFailures =
    missingCatalog.length > 0 ||
    missingMatrixCoverage.length > 0 ||
    tableCoverage.missingSources.length > 0 ||
    tableCoverage.fieldMismatches.length > 0 ||
    tableCoverage.invalidLayers.length > 0 ||
    tableCoverage.wrongKinds.length > 0 ||
    tablePartitions.missingColumns.length > 0 ||
    duplicateScripts.length > 0 ||
    duplicateSources.length > 0 ||
    registryValidation.invalidKinds.length > 0 ||
    registryValidation.invalidLayers.length > 0 ||
    registryDuplicates.length > 0 ||
    registryTableCollisions.length > 0 ||
    nonTableFields.emptyFieldArrays.length > 0 ||
    nonTableFields.activeMissingFields.length > 0 ||
    (dbViewValidation.missingFieldsForExistingViews.length > 0 && !dbViewValidation.unavailableReason);

  if (!hasFailures) {
    if (dbViewValidation.unavailableReason) {
      console.warn(`Metric matrix audit passed, but DB view validation was skipped: ${dbViewValidation.unavailableReason}`);
    }
    console.log('Metric matrix audit passed: usage coverage, inventory alignment, and registry validation succeeded.');
    return;
  }

  console.error('Metric matrix audit failed.');

  if (missingCatalog.length > 0) {
    console.error('\nUncataloged sources (add to tables inventory or advanced_views_registry):');
    missingCatalog.forEach((source) => console.error(`  - ${source}`));
  }

  if (missingMatrixCoverage.length > 0) {
    console.error('\nSources missing metric_matrix.json coverage (must exist as sources or upstream):');
    missingMatrixCoverage.forEach((source) => console.error(`  - ${source}`));
  }

  if (tableCoverage.missingSources.length > 0) {
    console.error('\nInventory tables missing in metric_matrix.json:');
    tableCoverage.missingSources.forEach((source) => console.error(`  - ${source}`));
  }

  if (tableCoverage.fieldMismatches.length > 0) {
    console.error('\nTable field mismatches (matrix fields must equal inventory columns):');
    tableCoverage.fieldMismatches.forEach((issue) => {
      console.error(`  - ${issue.source}`);
      if (issue.missingInMatrix.length > 0) {
        console.error('    Missing in matrix:');
        issue.missingInMatrix.forEach((field) => console.error(`      • ${field}`));
      }
      if (issue.extraInMatrix.length > 0) {
        console.error('    Extra in matrix:');
        issue.extraInMatrix.forEach((field) => console.error(`      • ${field}`));
      }
    });
  }

  if (tableCoverage.invalidLayers.length > 0) {
    console.error('\nTables with missing/invalid layers (cannot be unknown):');
    tableCoverage.invalidLayers.forEach((source) => console.error(`  - ${source}`));
  }

  if (tableCoverage.wrongKinds.length > 0) {
    console.error('\nInventory tables that are not marked kind="table" in metric_matrix.json:');
    tableCoverage.wrongKinds.forEach((source) => console.error(`  - ${source}`));
  }

  if (tablePartitions.missingColumns.length > 0) {
    console.error('\nInventory tables missing column definitions (cannot be seeded or audited):');
    tablePartitions.missingColumns.forEach((source) => console.error(`  - ${source}`));
  }

  if (duplicateSources.length > 0) {
    console.error('\nDuplicate source names found in metric_matrix.json:');
    duplicateSources.forEach((source) => console.error(`  - ${source}`));
  }

  if (nonTableFields.emptyFieldArrays.length > 0) {
    console.error('\nNon-table sources have empty fields arrays (omit fields until known):');
    nonTableFields.emptyFieldArrays.forEach((source) => console.error(`  - ${source}`));
  }

  if (nonTableFields.activeMissingFields.length > 0) {
    console.error('\nNon-table sources marked active must declare fields:');
    nonTableFields.activeMissingFields.forEach((source) => console.error(`  - ${source}`));
  }

  if (dbViewValidation.missingFieldsForExistingViews.length > 0) {
    console.error('\nDatabase views with columns require fields in metric_matrix.json:');
    dbViewValidation.missingFieldsForExistingViews.forEach((source) => console.error(`  - ${source}`));
  } else if (dbViewValidation.unavailableReason) {
    console.warn(`\nDB view validation skipped: ${dbViewValidation.unavailableReason}`);
  }

  if (registryValidation.invalidKinds.length > 0) {
    console.error('\nAdvanced registry assets with invalid kind (must be view, external, or unknown):');
    registryValidation.invalidKinds.forEach((source) => console.error(`  - ${source}`));
  }

  if (registryValidation.invalidLayers.length > 0) {
    console.error('\nAdvanced registry assets with invalid or missing layer:');
    registryValidation.invalidLayers.forEach((source) => console.error(`  - ${source}`));
  }

  if (registryDuplicates.length > 0) {
    console.error('\nDuplicate asset names found in advanced_views_registry.json:');
    registryDuplicates.forEach((source) => console.error(`  - ${source}`));
  }

  if (registryTableCollisions.length > 0) {
    console.error('\nRegistry assets colliding with table names (choose one location for the source):');
    registryTableCollisions.forEach((source) => console.error(`  - ${source}`));
  }

  if (duplicateScripts.length > 0) {
    console.error('\nDuplicate npm scripts found in package.json (ensure keys are unique):');
    duplicateScripts.forEach((script) => console.error(`  - ${script}`));
  }

  process.exitCode = 1;
}

void main();
