import { PromotedModuleOperatorDetails, appendPromotedModuleOperatorHints } from '@/lib/dataLabPromotedModules';

export interface AgeCurveLabRow {
  playerId: string | null;
  playerName: string;
  team: string | null;
  position: string | null;
  season: number | null;
  age: number | null;
  careerYear: number | null;
  peerBucket: string | null;
  expectedPpg: number | null;
  actualPpg: number | null;
  ppgDelta: number | null;
  trajectoryLabel: string | null;
  ageCurveScore: number | null;
  provenance: {
    provider: string | null;
    sourceName: string | null;
    sourceType: string | null;
    modelVersion: string | null;
    generatedAt: string | null;
    notes: string[];
  };
  rawFields: Record<string, unknown>;
}

export interface AgeCurveLabResponse {
  success: true;
  data: {
    season: number | null;
    availableSeasons: number[];
    rows: AgeCurveLabRow[];
    source: {
      provider: string;
      location: string | null;
      mode: 'api' | 'artifact';
    };
    state: 'ready' | 'empty';
  };
  meta: {
    module: 'age-curve-lab';
    adapter: string;
    readOnly: true;
    fetchedAt: string;
  };
}

export interface AgeCurveLabApiError {
  success: false;
  error: string;
  code?: 'config_error' | 'not_found' | 'invalid_payload' | 'upstream_unavailable' | 'upstream_timeout';
  operator?: PromotedModuleOperatorDetails;
}

export const AGE_CURVE_COLUMNS = [
  { key: 'playerName', label: 'Player' },
  { key: 'team', label: 'Team' },
  { key: 'age', label: 'Age' },
  { key: 'careerYear', label: 'Career Yr' },
  { key: 'expectedPpg', label: 'Expected' },
  { key: 'actualPpg', label: 'Actual' },
  { key: 'ppgDelta', label: 'Delta' },
  { key: 'trajectoryLabel', label: 'Trajectory' },
] as const;

export type AgeCurveColumnKey = (typeof AGE_CURVE_COLUMNS)[number]['key'];
export type AgeCurveSortDirection = 'asc' | 'desc';

export interface AgeCurveSortState {
  key: AgeCurveColumnKey;
  direction: AgeCurveSortDirection;
}

export interface AgeCurveFilters {
  searchQuery?: string;
  team?: string;
  position?: string;
}

export interface AgeCurveDetailField {
  label: string;
  value: string | null;
}

export interface AgeCurveDetailSection {
  id: string;
  title: string;
  fields: AgeCurveDetailField[];
}

export const DEFAULT_AGE_CURVE_SORT: AgeCurveSortState = {
  key: 'ppgDelta',
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

function getSortValue(row: AgeCurveLabRow, key: AgeCurveColumnKey): string | number | null {
  switch (key) {
    case 'playerName':
      return row.playerName;
    case 'team':
      return row.team;
    case 'age':
      return row.age;
    case 'careerYear':
      return row.careerYear;
    case 'expectedPpg':
      return row.expectedPpg;
    case 'actualPpg':
      return row.actualPpg;
    case 'ppgDelta':
      return row.ppgDelta;
    case 'trajectoryLabel':
      return row.trajectoryLabel;
    default:
      return null;
  }
}

export function formatPpg(value: number | null | undefined): string {
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

export function formatAge(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }

  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

export function getAgeCurveLabErrorMessage(error: AgeCurveLabApiError): string {
  switch (error.code) {
    case 'config_error':
      return 'The Age Curve Lab source is not configured in this environment.';
    case 'not_found':
      return 'No promoted age-curve dataset is available for the requested season.';
    case 'invalid_payload':
      return 'The promoted age-curve payload could not be normalized safely.';
    case 'upstream_timeout':
      return 'The upstream age-curve source timed out before returning a usable dataset.';
    case 'upstream_unavailable':
      return 'The upstream age-curve source is currently unavailable.';
    default:
      return error.error || 'Age Curve Lab is currently unavailable.';
  }
}

export function getAgeCurveStateHints(error: AgeCurveLabApiError | null): string[] {
  const baseHints = !error
    ? [
      'This lab is read only and exists to explain developmental context, not to generate new predictions inside TIBER-Fantasy.',
      'TIBER-Fantasy is only normalizing promoted ARC outputs for inspection and trustable review.',
    ]
    : (() => {
  switch (error.code) {
    case 'config_error':
      return [
        'Configure either the ARC compatibility endpoint or the stable exported artifact before enabling this promoted module.',
        'Keep the adapter read only; do not rebuild age-curve logic inside TIBER-Fantasy.',
      ];
    case 'not_found':
      return [
        'Confirm that the promoted ARC export or compatibility endpoint includes rows for the requested season.',
        'If the upstream is season-scoped, retry without assuming extra segmentation fields that are not exported yet.',
      ];
    case 'invalid_payload':
      return [
        'Inspect the promoted ARC payload for missing player identity, season, or expected-vs-actual fields.',
        'Keep malformed developmental-context rows off the product surface until the upstream contract is corrected.',
      ];
    default:
      return [
        'Retry after the upstream ARC dependency is available again.',
        'This page should remain read only even when the source is degraded.',
      ];
    }
      })();

  return appendPromotedModuleOperatorHints(baseHints, error?.operator);
}

export function filterAgeCurveRows(rows: AgeCurveLabRow[], filters: AgeCurveFilters = {}): AgeCurveLabRow[] {
  const normalizedSearch = filters.searchQuery?.trim().toLowerCase();

  return rows.filter((row) => {
    if (filters.team && filters.team !== 'ALL' && row.team !== filters.team) {
      return false;
    }

    if (filters.position && filters.position !== 'ALL' && row.position !== filters.position) {
      return false;
    }

    if (normalizedSearch) {
      const haystack = [
        row.playerName,
        row.playerId ?? '',
        row.peerBucket ?? '',
        row.trajectoryLabel ?? '',
        row.team ?? '',
        row.position ?? '',
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

export function sortAgeCurveRows(rows: AgeCurveLabRow[], sortState: AgeCurveSortState): AgeCurveLabRow[] {
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
      comparison = (right.ageCurveScore ?? Number.NEGATIVE_INFINITY) - (left.ageCurveScore ?? Number.NEGATIVE_INFINITY);
    }

    if (comparison === 0) {
      comparison = left.playerName.localeCompare(right.playerName);
    }

    return sortState.direction === 'asc' ? comparison : comparison * -1;
  });
}

export function buildAgeCurveDetailSections(row: AgeCurveLabRow): AgeCurveDetailSection[] {
  const developmentalFields: AgeCurveDetailField[] = [
    { label: 'Player', value: row.playerName },
    { label: 'Player ID', value: row.playerId },
    { label: 'Team', value: row.team },
    { label: 'Position', value: row.position },
    { label: 'Season', value: row.season != null ? String(row.season) : null },
    { label: 'Age', value: formatAge(row.age) },
    { label: 'Career year', value: row.careerYear != null ? String(row.careerYear) : null },
    { label: 'Peer bucket', value: row.peerBucket },
  ];

  const productionFields: AgeCurveDetailField[] = [
    { label: 'Expected PPG', value: formatPpg(row.expectedPpg) },
    { label: 'Actual PPG', value: formatPpg(row.actualPpg) },
    { label: 'PPG delta', value: formatDelta(row.ppgDelta) },
    { label: 'Trajectory label', value: row.trajectoryLabel },
    { label: 'Age curve score', value: formatPpg(row.ageCurveScore) },
  ];

  const provenanceFields: AgeCurveDetailField[] = [
    { label: 'Provider', value: row.provenance.provider },
    { label: 'Source name', value: row.provenance.sourceName },
    { label: 'Source type', value: row.provenance.sourceType },
    { label: 'Model version', value: row.provenance.modelVersion },
    { label: 'Generated at', value: row.provenance.generatedAt },
    { label: 'Notes', value: row.provenance.notes.length ? row.provenance.notes.join(' · ') : null },
  ];

  const rawFields: AgeCurveDetailField[] = Object.entries(row.rawFields)
    .map(([key, value]) => ({
      label: toTitleCase(key),
      value: value == null ? null : typeof value === 'string' ? value : JSON.stringify(value),
    }))
    .sort((left, right) => left.label.localeCompare(right.label));

  return [
    { id: 'developmental-context', title: 'Developmental context', fields: developmentalFields },
    { id: 'expected-vs-actual', title: 'Expected vs actual', fields: productionFields },
    { id: 'provenance', title: 'Provenance', fields: provenanceFields },
    { id: 'raw-payload', title: 'Full promoted payload', fields: rawFields },
  ];
}
