import { PromotedModuleOperatorDetails, appendPromotedModuleOperatorHints } from '@/lib/dataLabPromotedModules';

export interface PointScenarioLabRow {
  scenarioId: string | null;
  scenarioName: string;
  playerId: string | null;
  playerName: string;
  team: string | null;
  position: string | null;
  season: number | null;
  week: number | null;
  baselineProjection: number | null;
  adjustedProjection: number | null;
  delta: number | null;
  confidence: {
    band: string | null;
    label: string | null;
  };
  scenarioType: string | null;
  eventType: string | null;
  notes: string[];
  explanation: string | null;
  provenance: {
    provider: string | null;
    sourceName: string | null;
    sourceType: string | null;
    modelVersion: string | null;
    generatedAt: string | null;
    sourceMetadata: Record<string, unknown>;
  };
  rawFields: Record<string, unknown>;
}

export interface PointScenarioLabResponse {
  success: true;
  data: {
    season: number | null;
    availableSeasons: number[];
    rows: PointScenarioLabRow[];
    source: {
      provider: string;
      location: string | null;
      mode: 'api' | 'artifact';
    };
    state: 'ready' | 'empty';
  };
  meta: {
    module: 'point-scenario-lab';
    adapter: string;
    readOnly: true;
    fetchedAt: string;
  };
}

export interface PointScenarioLabApiError {
  success: false;
  error: string;
  code?: 'config_error' | 'not_found' | 'invalid_payload' | 'upstream_unavailable' | 'upstream_timeout';
  operator?: PromotedModuleOperatorDetails;
}

export const POINT_SCENARIO_COLUMNS = [
  { key: 'playerName', label: 'Player' },
  { key: 'scenarioName', label: 'Scenario' },
  { key: 'baselineProjection', label: 'Baseline' },
  { key: 'adjustedProjection', label: 'Adjusted' },
  { key: 'delta', label: 'Delta' },
  { key: 'confidence', label: 'Confidence' },
] as const;

export type PointScenarioColumnKey = (typeof POINT_SCENARIO_COLUMNS)[number]['key'];
export type PointScenarioSortDirection = 'asc' | 'desc';

export interface PointScenarioSortState {
  key: PointScenarioColumnKey;
  direction: PointScenarioSortDirection;
}

export interface PointScenarioFilters {
  searchQuery?: string;
  eventType?: string;
}

export interface PointScenarioDetailField {
  label: string;
  value: string | null;
}

export interface PointScenarioDetailSection {
  id: string;
  title: string;
  fields: PointScenarioDetailField[];
}

export const DEFAULT_POINT_SCENARIO_SORT: PointScenarioSortState = {
  key: 'delta',
  direction: 'desc',
};

function toTitleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function compareNullableNumbers(left: number | null, right: number | null) {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;
  return left - right;
}

function getSortValue(row: PointScenarioLabRow, key: PointScenarioColumnKey): string | number | null {
  switch (key) {
    case 'playerName':
      return row.playerName;
    case 'scenarioName':
      return row.scenarioName;
    case 'baselineProjection':
      return row.baselineProjection;
    case 'adjustedProjection':
      return row.adjustedProjection;
    case 'delta':
      return row.delta;
    case 'confidence':
      return `${row.confidence.band ?? ''} ${row.confidence.label ?? ''}`.trim();
    default:
      return null;
  }
}

export function buildPointScenarioRowKey(row: PointScenarioLabRow): string {
  return row.scenarioId ?? [row.playerId ?? row.playerName, row.scenarioName, row.eventType ?? 'na', row.season ?? 'na', row.week ?? 'na'].join('::');
}

export function formatProjection(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }

  return value.toFixed(1);
}

export function formatDelta(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }

  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
}

export function formatConfidence(confidence: PointScenarioLabRow['confidence']): string {
  if (!confidence.band && !confidence.label) {
    return '—';
  }

  if (confidence.band && confidence.label) {
    return `${confidence.band} · ${confidence.label}`;
  }

  return confidence.band ?? confidence.label ?? '—';
}

export function getPointScenarioLabErrorMessage(error: PointScenarioLabApiError): string {
  switch (error.code) {
    case 'config_error':
      return 'The Point Scenario Lab source is not configured in this environment.';
    case 'not_found':
      return 'No promoted point-scenario dataset is available for the requested season.';
    case 'invalid_payload':
      return 'The promoted point-scenario payload could not be normalized safely.';
    case 'upstream_timeout':
      return 'The upstream point-scenario source timed out before returning a usable dataset.';
    case 'upstream_unavailable':
      return 'The upstream point-scenario source is currently unavailable.';
    default:
      return error.error || 'Point Scenario Lab is currently unavailable.';
  }
}

export function getPointScenarioStateHints(error: PointScenarioLabApiError | null): string[] {
  const baseHints = !error
    ? [
      'This lab is read only and exists to inspect scenario-based point outcomes, not to publish final weekly rankings inside TIBER-Fantasy.',
      'TIBER-Fantasy is only normalizing promoted Point-prediction-Model outputs for inspection and trustable review.',
    ]
    : (() => {
  switch (error.code) {
    case 'config_error':
      return [
        'Configure either the Point-prediction-Model compatibility endpoint or the stable exported artifact before enabling this promoted module.',
        'Keep the adapter read only; do not rebuild scenario logic inside TIBER-Fantasy.',
      ];
    case 'not_found':
      return [
        'Confirm that the promoted point-scenario export or compatibility endpoint includes rows for the requested season.',
        'If the upstream is week-scoped, retry without assuming filters that are not exported yet.',
      ];
    case 'invalid_payload':
      return [
        'Inspect the promoted point-scenario payload for missing scenario names, player identity, or projection fields.',
        'Keep malformed scenario rows off the product surface until the upstream contract is corrected.',
      ];
    default:
      return [
        'Retry after the upstream point-scenario dependency is available again.',
        'This page should remain read only even when the source is degraded.',
      ];
    }
      })();

  return appendPromotedModuleOperatorHints(baseHints, error?.operator);
}

export function filterPointScenarioRows(rows: PointScenarioLabRow[], filters: PointScenarioFilters = {}): PointScenarioLabRow[] {
  const normalizedSearch = filters.searchQuery?.trim().toLowerCase();

  return rows.filter((row) => {
    if (filters.eventType && filters.eventType !== 'ALL' && row.eventType !== filters.eventType) {
      return false;
    }

    if (normalizedSearch) {
      const haystack = [
        row.playerName,
        row.playerId ?? '',
        row.scenarioName,
        row.scenarioType ?? '',
        row.eventType ?? '',
        row.team ?? '',
        row.position ?? '',
        row.explanation ?? '',
        row.notes.join(' '),
      ]
        .join(' ')
        .toLowerCase();

      if (!haystack.includes(normalizedSearch)) {
        return false;
      }
    }

    return true;
  });
}

export function sortPointScenarioRows(rows: PointScenarioLabRow[], sortState: PointScenarioSortState): PointScenarioLabRow[] {
  return [...rows].sort((left, right) => {
    const leftValue = getSortValue(left, sortState.key);
    const rightValue = getSortValue(right, sortState.key);

    let comparison = 0;

    if (typeof leftValue === 'string' || typeof rightValue === 'string') {
      comparison = String(leftValue ?? '').localeCompare(String(rightValue ?? ''));
    } else {
      comparison = compareNullableNumbers(leftValue as number | null, rightValue as number | null);
    }

    if (comparison === 0) {
      comparison = left.playerName.localeCompare(right.playerName);
    }

    return sortState.direction === 'asc' ? comparison : comparison * -1;
  });
}

export function buildPointScenarioDetailSections(row: PointScenarioLabRow): PointScenarioDetailSection[] {
  const scenarioFields: PointScenarioDetailField[] = [
    { label: 'Scenario', value: row.scenarioName },
    { label: 'Scenario ID', value: row.scenarioId },
    { label: 'Scenario type', value: row.scenarioType },
    { label: 'Event type', value: row.eventType },
    { label: 'Season / week', value: row.week != null ? `${row.season ?? '—'} · Week ${row.week}` : row.season != null ? String(row.season) : null },
  ];

  const playerFields: PointScenarioDetailField[] = [
    { label: 'Player', value: row.playerName },
    { label: 'Player ID', value: row.playerId },
    { label: 'Team', value: row.team },
    { label: 'Position', value: row.position },
  ];

  const projectionFields: PointScenarioDetailField[] = [
    { label: 'Baseline projection', value: formatProjection(row.baselineProjection) },
    { label: 'Adjusted projection', value: formatProjection(row.adjustedProjection) },
    { label: 'Delta', value: formatDelta(row.delta) },
    { label: 'Confidence', value: formatConfidence(row.confidence) },
  ];

  const explanationFields: PointScenarioDetailField[] = [
    { label: 'Explanation', value: row.explanation },
    { label: 'Notes', value: row.notes.length ? row.notes.join(' · ') : null },
  ];

  const provenanceFields: PointScenarioDetailField[] = [
    { label: 'Provider', value: row.provenance.provider },
    { label: 'Source name', value: row.provenance.sourceName },
    { label: 'Source type', value: row.provenance.sourceType },
    { label: 'Model version', value: row.provenance.modelVersion },
    { label: 'Generated at', value: row.provenance.generatedAt },
    {
      label: 'Source metadata',
      value: Object.keys(row.provenance.sourceMetadata).length ? JSON.stringify(row.provenance.sourceMetadata) : null,
    },
  ];

  const rawFields: PointScenarioDetailField[] = Object.entries(row.rawFields)
    .map(([key, value]) => ({
      label: toTitleCase(key),
      value: value == null ? null : typeof value === 'string' ? value : JSON.stringify(value),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));

  return [
    { id: 'scenario-context', title: 'Scenario context', fields: scenarioFields },
    { id: 'player-context', title: 'Player context', fields: playerFields },
    { id: 'projection-shift', title: 'Projection shift', fields: projectionFields },
    { id: 'explanation', title: 'Explanation', fields: explanationFields },
    { id: 'provenance', title: 'Provenance', fields: provenanceFields },
    { id: 'raw-payload', title: 'Full promoted payload', fields: rawFields },
  ];
}
