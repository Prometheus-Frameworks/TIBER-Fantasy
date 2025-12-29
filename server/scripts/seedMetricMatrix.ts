import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

type Kind = 'table' | 'view' | 'external' | 'unknown';
type Layer = 'bronze' | 'silver' | 'gold' | 'application' | 'unknown';
type Status = 'active' | 'deprecated' | 'missing' | 'unknown';

type Refresh = {
  readonly cadence?: string;
  readonly sla_hours?: number;
  readonly last_updated_field?: string;
};

type MetricSource = {
  readonly name: string;
  readonly kind: Kind;
  readonly layer: Layer;
  readonly status: Status;
  readonly description?: string;
  readonly upstream?: string[];
  readonly fields?: string[];
  readonly provides_metrics?: string[];
  readonly consumed_by?: string[];
  readonly refresh?: Refresh;
  readonly tags?: string[];
};

type TableColumn = {
  readonly name: string;
  readonly type?: string;
};

type TableDefinition = {
  readonly description?: string;
  readonly columns?: TableColumn[];
  readonly primary_key?: string[];
  readonly indexes?: string[];
  readonly layer?: Layer;
  readonly entries?: string[];
  readonly upstream?: string[];
};

type TableInventory = Record<string, TableDefinition>;

type AdvancedAsset = {
  readonly name: string;
  readonly kind?: string;
  readonly layer?: string;
  readonly description?: string;
  readonly fields?: string[];
  readonly status?: Status;
  readonly upstream?: string[];
  readonly tags?: string[];
  readonly provides_metrics?: string[];
  readonly consumed_by?: string[];
  readonly refresh?: Refresh;
};

type AdvancedRegistry = {
  readonly assets?: AdvancedAsset[];
};

type MetricMatrix = {
  readonly $schema: string;
  readonly sources: MetricSource[];
};

const MATRIX_PATH = path.resolve(process.cwd(), 'docs/metric-matrix/metric_matrix.json');

const VALID_KINDS: readonly Kind[] = ['table', 'view', 'external', 'unknown'];
const VALID_LAYERS: readonly Layer[] = ['bronze', 'silver', 'gold', 'application', 'unknown'];

function readJsonFile<T>(relativePath: string): T {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  const raw = readFileSync(absolutePath, 'utf8');
  return JSON.parse(raw) as T;
}

function normalizeFields(columns?: TableColumn[]): string[] {
  if (!columns) return [];
  return Array.from(new Set(columns.map((column) => column.name))).sort();
}

function normalizeArray(values?: string[]): string[] | undefined {
  if (!values) return undefined;
  return Array.from(new Set(values)).sort();
}

function normalizeOptionalFields(values?: string[]): string[] | undefined {
  if (!values || values.length === 0) return undefined;
  return Array.from(new Set(values)).sort();
}

function mergeArrays(primary?: string[], secondary?: string[]): string[] | undefined {
  const merged = [...(primary ?? []), ...(secondary ?? [])];
  if (merged.length === 0) return undefined;
  return Array.from(new Set(merged)).sort();
}

function assertLayer(name: string, layer: string | undefined, scope: string): Layer {
  if (!layer) {
    throw new Error(`${scope} ${name} is missing a required layer value.`);
  }

  if ((VALID_LAYERS as readonly string[]).includes(layer)) {
    return layer as Layer;
  }

  throw new Error(`${scope} ${name} has invalid layer '${layer}'. Allowed: ${VALID_LAYERS.join(', ')}`);
}

function normalizeKind(name: string, provided?: string): Kind {
  if (provided === 'table') {
    throw new Error(`Asset ${name} has invalid kind 'table'. Allowed: view, external, unknown.`);
  }

  if (provided && (VALID_KINDS as readonly string[]).includes(provided)) {
    return provided as Kind;
  }

  throw new Error(`Asset ${name} has invalid kind '${provided ?? 'undefined'}'. Allowed: view, external, unknown.`);
}

function readExistingMatrix(): MetricMatrix {
  if (!existsSync(MATRIX_PATH)) {
    return { $schema: './metric_matrix.schema.json', sources: [] };
  }

  return readJsonFile<MetricMatrix>('docs/metric-matrix/metric_matrix.json');
}

function dedupeAndSortSources(sources: MetricSource[]): MetricSource[] {
  return sources
    .map((source) => ({
      ...source,
      fields: source.fields && source.fields.length > 0 ? [...new Set(source.fields)].sort() : undefined,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function mergeTableSource(name: string, definition: TableDefinition, existing?: MetricSource): MetricSource {
  const layer = assertLayer(name, definition.layer, 'Table');
  const fields = normalizeFields(definition.columns);

  const description = existing?.description && existing.description.trim().length > 0 ? existing.description : definition.description;

  return {
    name,
    kind: 'table',
    layer,
    status: existing?.status ?? 'active',
    description,
    fields,
    upstream: mergeArrays(definition.upstream as string[] | undefined, existing?.upstream),
    provides_metrics: normalizeArray(existing?.provides_metrics),
    consumed_by: normalizeArray(existing?.consumed_by),
    refresh: existing?.refresh,
    tags: normalizeArray(existing?.tags),
  };
}

function mergeAdvancedSource(asset: AdvancedAsset, existing?: MetricSource): MetricSource {
  const kind = normalizeKind(asset.name, asset.kind);
  const layer = assertLayer(asset.name, asset.layer, 'Asset');

  const registryFields = normalizeOptionalFields(asset.fields);
  const existingFields = normalizeOptionalFields(existing?.fields);
  const fields = registryFields ?? existingFields;

  const mergedTags = mergeArrays(asset.tags, existing?.tags);
  const mergedUpstream = asset.upstream ? mergeArrays(asset.upstream, existing?.upstream) : normalizeArray(existing?.upstream);

  const missingFields = !fields || fields.length === 0;
  const tagsWithNeeds = missingFields ? mergeArrays([...(mergedTags ?? []), 'needs_field_list']) : mergedTags;
  const status = missingFields ? 'unknown' : asset.status ?? existing?.status ?? 'active';

  const description = existing?.description && existing.description.trim().length > 0 ? existing.description : asset.description;

  return {
    name: asset.name,
    kind,
    layer,
    status,
    description,
    ...(fields ? { fields } : {}),
    upstream: mergedUpstream,
    provides_metrics: normalizeArray(asset.provides_metrics ?? existing?.provides_metrics),
    consumed_by: normalizeArray(asset.consumed_by ?? existing?.consumed_by),
    refresh: asset.refresh ?? existing?.refresh,
    tags: tagsWithNeeds,
  };
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

function collectTableEntries(tables: TableInventory): Array<[string, TableDefinition]> {
  const entries: Array<[string, TableDefinition]> = [];

  Object.entries(tables).forEach(([name, definition]) => {
    if (!definition.columns || definition.columns.length === 0) {
      console.warn(`Skipping table inventory entry '${name}' because no columns are defined (treated as grouping/non-table).`);
      return;
    }

    entries.push([name, definition]);
  });

  return entries;
}

function ensureNoDuplicateNames(tableInventory: TableInventory, registry: AdvancedRegistry, existing: MetricMatrix): void {
  const tableNames = Object.entries(tableInventory)
    .filter(([, definition]) => Array.isArray(definition.columns) && definition.columns.length > 0)
    .map(([name]) => name);
  const registryNames = (registry.assets ?? []).map((asset) => asset.name);
  const matrixNames = (existing.sources ?? []).map((source) => source.name);

  const registryDuplicates = findDuplicates(registryNames);
  if (registryDuplicates.length > 0) {
    throw new Error(`Duplicate asset names in registry: ${registryDuplicates.join(', ')}`);
  }

  const overlapping = [...new Set(registryNames.filter((name) => tableNames.includes(name)))];
  if (overlapping.length > 0) {
    throw new Error(`Source name collisions between tables and registry: ${overlapping.sort().join(', ')}`);
  }

  const matrixDuplicates = findDuplicates(matrixNames);
  if (matrixDuplicates.length > 0) {
    throw new Error(`Duplicate source names detected in existing metric matrix: ${matrixDuplicates.join(', ')}`);
  }
}

function main(): void {
  const tables = readJsonFile<TableInventory>('docs/metric-matrix/nflfastr_inventory_tables.json');
  const advancedRegistry = readJsonFile<AdvancedRegistry>('docs/metric-matrix/advanced_views_registry.json');
  const existingMatrix = readExistingMatrix();
  const existingByName = new Map<string, MetricSource>((existingMatrix.sources ?? []).map((source) => [source.name, source]));

  ensureNoDuplicateNames(tables, advancedRegistry, existingMatrix);

  const tableSources = collectTableEntries(tables).map(([name, definition]) => mergeTableSource(name, definition, existingByName.get(name)));

  const advancedSources = (advancedRegistry.assets ?? []).map((asset) => mergeAdvancedSource(asset, existingByName.get(asset.name)));

  const matrix: MetricMatrix = {
    $schema: './metric_matrix.schema.json',
    sources: dedupeAndSortSources([...tableSources, ...advancedSources]),
  };

  const output = JSON.stringify(matrix, null, 2);
  writeFileSync(MATRIX_PATH, `${output}\n`, 'utf8');
  console.log('metric_matrix.json merged from inventories and existing matrix.');
}

main();
