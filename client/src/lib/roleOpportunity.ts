import { PromotedModuleOperatorDetails, appendPromotedModuleOperatorHints } from '@/lib/dataLabPromotedModules';

export interface RoleOpportunityLabRow {
  playerId: string;
  playerName: string;
  team: string;
  position: string;
  season: number;
  week: number | null;
  seasonScopeMarker: string | null;
  primaryRole: string;
  roleTags: string[];
  usage: {
    routeParticipation: number | null;
    targetShare: number | null;
    airYardShare: number | null;
    snapShare: number | null;
    usageRate: number | null;
  };
  confidence: {
    score: number | null;
    tier: string | null;
  };
  source: {
    sourceName: string | null;
    sourceType: string | null;
    modelVersion: string | null;
    generatedAt: string | null;
  };
  insights: string[];
  rawFields: Record<string, unknown>;
}

export interface RoleOpportunityLabResponse {
  success: true;
  data: {
    season: number | null;
    week: number | null;
    seasonScopeMarker: string | null;
    availableSeasons: number[];
    rows: RoleOpportunityLabRow[];
    source: {
      provider: string;
      location: string | null;
      mode: 'api' | 'artifact';
    };
    state: 'ready' | 'empty';
  };
  meta: {
    module: 'role-opportunity-lab';
    adapter: string;
    readOnly: true;
    fetchedAt: string;
  };
}

export interface RoleOpportunityLabApiError {
  success: false;
  error: string;
  code?: 'config_error' | 'not_found' | 'invalid_payload' | 'upstream_unavailable' | 'upstream_timeout' | 'ambiguous';
  operator?: PromotedModuleOperatorDetails;
}

export const ROLE_OPPORTUNITY_COLUMNS = [
  { key: 'playerName', label: 'Player' },
  { key: 'team', label: 'Team' },
  { key: 'position', label: 'Pos' },
  { key: 'primaryRole', label: 'Primary Role' },
  { key: 'routeParticipation', label: 'Route %' },
  { key: 'targetShare', label: 'Target %' },
  { key: 'airYardShare', label: 'Air %' },
  { key: 'snapShare', label: 'Snap %' },
  { key: 'confidence', label: 'Confidence' },
] as const;

export type RoleOpportunityColumnKey = (typeof ROLE_OPPORTUNITY_COLUMNS)[number]['key'];
export type RoleOpportunitySortDirection = 'asc' | 'desc';

export interface RoleOpportunitySortState {
  key: RoleOpportunityColumnKey;
  direction: RoleOpportunitySortDirection;
}

export interface RoleOpportunityFilters {
  searchQuery?: string;
  team?: string;
  position?: string;
}

export interface RoleOpportunityDetailField {
  label: string;
  value: string | null;
}

export interface RoleOpportunityDetailSection {
  id: string;
  title: string;
  fields: RoleOpportunityDetailField[];
}

export const DEFAULT_ROLE_OPPORTUNITY_SORT: RoleOpportunitySortState = {
  key: 'targetShare',
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

function getSortValue(row: RoleOpportunityLabRow, key: RoleOpportunityColumnKey): string | number | null {
  switch (key) {
    case 'playerName':
      return row.playerName;
    case 'team':
      return row.team;
    case 'position':
      return row.position;
    case 'primaryRole':
      return row.primaryRole;
    case 'routeParticipation':
      return row.usage.routeParticipation;
    case 'targetShare':
      return row.usage.targetShare;
    case 'airYardShare':
      return row.usage.airYardShare;
    case 'snapShare':
      return row.usage.snapShare;
    case 'confidence':
      return row.confidence.score;
    default:
      return null;
  }
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }

  return `${Math.round(value * 100)}%`;
}

export function formatConfidence(value: number | null | undefined, tier?: string | null): string {
  const score = value == null ? '—' : `${Math.round(value * 100)}%`;
  return tier ? `${score} · ${tier}` : score;
}

export function getRoleOpportunityLabErrorMessage(error: RoleOpportunityLabApiError): string {
  switch (error.code) {
    case 'config_error':
      return 'The Role Opportunity Lab source is not configured in this environment.';
    case 'not_found':
      return 'No promoted role and opportunity dataset is available for the requested view.';
    case 'invalid_payload':
      return 'The promoted role and opportunity payload could not be normalized safely.';
    case 'upstream_timeout':
      return 'The upstream role and opportunity source timed out before returning a usable dataset.';
    case 'upstream_unavailable':
      return 'The upstream role and opportunity source is currently unavailable.';
    default:
      return error.error || 'Role Opportunity Lab is currently unavailable.';
  }
}

export function getRoleOpportunityStateHints(error: RoleOpportunityLabApiError | null): string[] {
  const baseHints = !error
    ? [
      'This lab is read only and shows deployment and usage context promoted from an upstream source.',
      'TIBER-Fantasy is not recomputing role scores here; it is only normalizing the promoted payload for inspection.',
    ]
    : (() => {
  switch (error.code) {
    case 'config_error':
      return [
        'Set the upstream API or exported artifact path before enabling this promoted module.',
        'Keep the adapter in read-only mode; do not backfill or recompute role logic inside TIBER-Fantasy.',
      ];
    case 'not_found':
      return [
        'Confirm that TIBER-Data compatibility views or the promoted artifact include role and opportunity rows for the requested season.',
        'If the dataset is season scoped, retry without a week-specific assumption.',
      ];
    case 'invalid_payload':
      return [
        'Inspect the promoted upstream payload for missing required identity, role, or usage fields.',
        'Keep malformed rows out of product surfaces until the upstream contract is corrected.',
      ];
    default:
      return [
        'Retry after the upstream dependency is available again.',
        'This page should remain read only even when the source is degraded.',
      ];
    }
      })();

  return appendPromotedModuleOperatorHints(baseHints, error?.operator);
}

export function filterRoleOpportunityRows(rows: RoleOpportunityLabRow[], filters: RoleOpportunityFilters = {}): RoleOpportunityLabRow[] {
  const normalizedSearch = filters.searchQuery?.trim().toLowerCase();

  return rows.filter((row) => {
    if (filters.team && filters.team !== 'ALL' && row.team !== filters.team) {
      return false;
    }

    if (filters.position && filters.position !== 'ALL' && row.position !== filters.position) {
      return false;
    }

    if (normalizedSearch) {
      const haystack = `${row.playerName} ${row.playerId} ${row.primaryRole} ${row.roleTags.join(' ')}`.toLowerCase();
      if (!haystack.includes(normalizedSearch)) {
        return false;
      }
    }

    return true;
  });
}

export function sortRoleOpportunityRows(rows: RoleOpportunityLabRow[], sortState: RoleOpportunitySortState): RoleOpportunityLabRow[] {
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

export function buildRoleOpportunityDetailSections(row: RoleOpportunityLabRow): RoleOpportunityDetailSection[] {
  const usageFields: RoleOpportunityDetailField[] = [
    { label: 'Route participation', value: formatPercent(row.usage.routeParticipation) },
    { label: 'Target share', value: formatPercent(row.usage.targetShare) },
    { label: 'Air yard share', value: formatPercent(row.usage.airYardShare) },
    { label: 'Snap share', value: formatPercent(row.usage.snapShare) },
    { label: 'Usage rate', value: formatPercent(row.usage.usageRate) },
  ];

  const provenanceFields: RoleOpportunityDetailField[] = [
    { label: 'Confidence', value: formatConfidence(row.confidence.score, row.confidence.tier) },
    { label: 'Source name', value: row.source.sourceName },
    { label: 'Source type', value: row.source.sourceType },
    { label: 'Model version', value: row.source.modelVersion },
    { label: 'Generated at', value: row.source.generatedAt },
  ];

  const rawFields = Object.entries(row.rawFields)
    .filter(([, value]) => value != null && value !== '')
    .slice(0, 12)
    .map(([key, value]) => ({ label: toTitleCase(key), value: Array.isArray(value) ? value.join(', ') : String(value) }));

  return [
    {
      id: 'identity-role',
      title: 'Identity & role',
      fields: [
        { label: 'Player', value: row.playerName },
        { label: 'Player ID', value: row.playerId },
        { label: 'Team', value: row.team },
        { label: 'Position', value: row.position },
        { label: 'Primary role', value: row.primaryRole },
        { label: 'Role tags', value: row.roleTags.length ? row.roleTags.join(', ') : '—' },
        { label: 'Scope', value: row.week != null ? `Week ${row.week}` : (row.seasonScopeMarker ?? 'Season') },
      ],
    },
    {
      id: 'usage-opportunity',
      title: 'Usage & opportunity',
      fields: usageFields,
    },
    {
      id: 'provenance',
      title: 'Confidence & provenance',
      fields: provenanceFields,
    },
    {
      id: 'raw-fields',
      title: 'Full promoted payload',
      fields: rawFields,
    },
  ];
}
