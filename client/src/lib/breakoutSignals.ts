export interface BreakoutSignalComponents {
  usage: number | null;
  efficiency: number | null;
  development: number | null;
  stability: number | null;
  cohort: number | null;
  role: number | null;
  penalty: number | null;
}

export interface BreakoutSignalRow {
  candidateRank: number | null;
  finalSignalScore: number | null;
  playerName: string;
  playerId: string | null;
  team: string | null;
  season: number | null;
  bestRecipeName: string | null;
  breakoutLabelDefault: string | null;
  breakoutContext: string | null;
  components: BreakoutSignalComponents;
  rawFields: Record<string, string | null>;
}

export interface BreakoutRecipeSummary {
  bestRecipeName: string;
  season: number | null;
  validationScore: number | null;
  winRate: number | null;
  hitRate: number | null;
  candidateCount: number | null;
  summary: string | null;
  generatedAt: string | null;
  modelVersion: string | null;
}

export interface BreakoutSignalsResponse {
  success: true;
  data: {
    season: number;
    availableSeasons: number[];
    rows: BreakoutSignalRow[];
    bestRecipeSummary: BreakoutRecipeSummary;
    source: {
      provider: 'signal-validation-model';
      exportDirectory: string;
    };
    state: 'ready' | 'empty';
  };
  meta: {
    module: 'wr-breakout-lab';
    adapter: string;
    readOnly: true;
    fetchedAt: string;
  };
}

export interface BreakoutSignalsApiError {
  success: false;
  error: string;
  code?: 'config_error' | 'not_found' | 'invalid_payload' | 'malformed_export' | 'upstream_unavailable';
}

export const BREAKOUT_SIGNAL_COLUMNS = [
  { key: 'candidateRank', label: 'Rank' },
  { key: 'playerName', label: 'Player' },
  { key: 'finalSignalScore', label: 'Signal Score' },
  { key: 'bestRecipeName', label: 'Best Recipe' },
  { key: 'usage', label: 'Usage' },
  { key: 'efficiency', label: 'Efficiency' },
  { key: 'development', label: 'Development' },
  { key: 'stability', label: 'Stability' },
  { key: 'cohort', label: 'Cohort' },
  { key: 'role', label: 'Role' },
  { key: 'penalty', label: 'Penalty' },
  { key: 'breakoutLabelDefault', label: 'Breakout Context' },
] as const;

export type BreakoutSignalColumnKey = (typeof BREAKOUT_SIGNAL_COLUMNS)[number]['key'];
export type BreakoutSignalSortDirection = 'asc' | 'desc';

export interface BreakoutSignalSortState {
  key: BreakoutSignalColumnKey;
  direction: BreakoutSignalSortDirection;
}

export interface BreakoutSignalQuickFilters {
  topN: 'all' | 10 | 25;
  breakoutOnly: boolean;
  highRoleOnly: boolean;
  highCohortOnly: boolean;
}

export interface BreakoutDetailField {
  label: string;
  value: string | null;
}

export interface BreakoutDetailSection {
  id: string;
  title: string;
  description: string;
  fields: BreakoutDetailField[];
}

export const DEFAULT_BREAKOUT_SORT: BreakoutSignalSortState = {
  key: 'candidateRank',
  direction: 'asc',
};

export const DEFAULT_BREAKOUT_FILTERS: BreakoutSignalQuickFilters = {
  topN: 'all',
  breakoutOnly: false,
  highRoleOnly: false,
  highCohortOnly: false,
};

const HIGH_SIGNAL_THRESHOLD = 80;
const DETAIL_FIELD_LABEL_OVERRIDES: Record<string, string> = {
  player_name: 'Player name',
  player_id: 'Player ID',
  gsis_id: 'GSIS ID',
  player_gsis_id: 'Player GSIS ID',
  candidate_rank: 'Candidate rank',
  final_signal_score: 'Final signal score',
  best_recipe_name: 'Best recipe',
  recipe_name: 'Recipe name',
  top_recipe_name: 'Top recipe name',
  breakout_label_default: 'Breakout label',
  breakout_context: 'Breakout context',
  breakout_context_default: 'Breakout context default',
  breakout_context_label: 'Breakout context label',
  breakout_note: 'Breakout note',
  breakout_reason: 'Breakout reason',
  breakout_description: 'Breakout description',
  usage_signal: 'Usage signal',
  efficiency_signal: 'Efficiency signal',
  development_signal: 'Development signal',
  stability_signal: 'Stability signal',
  cohort_signal: 'Cohort signal',
  role_signal: 'Role signal',
  penalty_signal: 'Penalty signal',
  team: 'Team',
  team_id: 'Team',
  team_abbr: 'Team',
  season: 'Season',
  generated_at: 'Generated at',
  model_version: 'Model version',
};

const DETAIL_SECTIONS = [
  {
    id: 'ranking-summary',
    title: 'Ranking summary',
    description: 'Snapshot of the promoted rank, recipe, and top-line score shown in the table.',
    fields: [
      ['candidateRank', 'Candidate rank'],
      ['playerName', 'Player'],
      ['team', 'Team'],
      ['season', 'Season'],
      ['finalSignalScore', 'Final signal score'],
      ['bestRecipeName', 'Best recipe'],
    ] as const,
  },
  {
    id: 'signal-components',
    title: 'Signal components',
    description: 'Read-only component values passed through from the promoted signal card.',
    fields: [
      ['usage', 'Usage'],
      ['efficiency', 'Efficiency'],
      ['development', 'Development'],
      ['stability', 'Stability'],
      ['cohort', 'Cohort'],
      ['role', 'Role'],
      ['penalty', 'Penalty'],
    ] as const,
  },
  {
    id: 'breakout-context',
    title: 'Breakout context',
    description: 'Operator-facing breakout labels and context copied from the export.',
    fields: [
      ['breakoutLabelDefault', 'Breakout label'],
      ['breakoutContext', 'Breakout context'],
    ] as const,
    rawPrefixes: ['breakout_'],
  },
  {
    id: 'cohort-role-context',
    title: 'Cohort / role context',
    description: 'Extra export fields related to role, cohort, archetype, and neighboring comparison context.',
    rawPatterns: ['cohort', 'role', 'archetype', 'comparison'],
  },
  {
    id: 'raw-export-metadata',
    title: 'Raw export metadata',
    description: 'Low-level export fields kept visible for inspection without enabling edits or rescoring.',
    rawFallback: true,
  },
] as const;

export function formatSignalValue(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }

  return Math.abs(value) >= 10 ? value.toFixed(0) : value.toFixed(1);
}

export function formatShareValue(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value)) {
    return null;
  }

  return `${Math.round(value * 100)}%`;
}

export function buildBestRecipeBadge(summary: BreakoutRecipeSummary): string[] {
  const parts = [summary.bestRecipeName];

  if (summary.validationScore != null) {
    parts.push(`Validation ${formatShareValue(summary.validationScore)}`);
  }

  if (summary.winRate != null) {
    parts.push(`Win ${formatShareValue(summary.winRate)}`);
  }

  if (summary.hitRate != null) {
    parts.push(`Hit ${formatShareValue(summary.hitRate)}`);
  }

  return parts;
}

export function getBreakoutSignalsErrorMessage(error?: BreakoutSignalsApiError | null): string {
  if (!error) {
    return 'Unable to load WR breakout signals right now.';
  }

  switch (error.code) {
    case 'not_found':
      return 'No Signal-Validation-Model export was found for this season yet.';
    case 'malformed_export':
    case 'invalid_payload':
      return 'The Signal-Validation-Model export is malformed, so TIBER is refusing to display it.';
    case 'config_error':
      return 'The WR Breakout Lab export directory is not configured in this environment.';
    default:
      return error.error;
  }
}

export function getBreakoutSignalsStateHints(error?: BreakoutSignalsApiError | null): string[] {
  switch (error?.code) {
    case 'not_found':
      return [
        'Confirm the promoted season export exists in the configured Signal-Validation-Model export directory.',
        'Expected files: wr_player_signal_cards_{season}.csv and wr_best_recipe_summary.json.',
        'TIBER remains read-only here and will not backfill or regenerate missing exports locally.',
      ];
    case 'malformed_export':
    case 'invalid_payload':
      return [
        'Inspect the promoted CSV/JSON export for missing required fields or malformed values.',
        'TIBER is intentionally blocking display because the exported contract failed validation.',
        'Fix the upstream export in Signal-Validation-Model, then reload this lab view.',
      ];
    case 'config_error':
      return [
        'Set SIGNAL_VALIDATION_EXPORTS_DIR or mount the default ./data/signal-validation directory.',
        'TIBER will not infer alternate export locations for this read-only module.',
      ];
    case 'upstream_unavailable':
      return [
        'The read-only adapter could not read the promoted export from disk right now.',
        'Retry after the export mount is healthy; TIBER will not mutate or repair upstream files.',
      ];
    default:
      return [
        'This module stays read-only: no local rescoring, no mutation, and no raw export editing happens in TIBER.',
      ];
  }
}

function formatDetailLabel(field: string): string {
  if (DETAIL_FIELD_LABEL_OVERRIDES[field]) {
    return DETAIL_FIELD_LABEL_OVERRIDES[field];
  }

  return field
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function normalizeTextValue(value: string | number | null): string | null {
  if (value == null) {
    return null;
  }

  return typeof value === 'number' ? String(value) : value;
}

function getSortValue(row: BreakoutSignalRow, key: BreakoutSignalColumnKey): number | string | null {
  switch (key) {
    case 'candidateRank':
      return row.candidateRank;
    case 'playerName':
      return row.playerName;
    case 'finalSignalScore':
      return row.finalSignalScore;
    case 'bestRecipeName':
      return row.bestRecipeName;
    case 'usage':
      return row.components.usage;
    case 'efficiency':
      return row.components.efficiency;
    case 'development':
      return row.components.development;
    case 'stability':
      return row.components.stability;
    case 'cohort':
      return row.components.cohort;
    case 'role':
      return row.components.role;
    case 'penalty':
      return row.components.penalty;
    case 'breakoutLabelDefault':
      return row.breakoutLabelDefault;
    default:
      return null;
  }
}

function compareNullable(left: number | string | null, right: number | string | null): number {
  if (left == null && right == null) return 0;
  if (left == null) return 1;
  if (right == null) return -1;

  if (typeof left === 'number' && typeof right === 'number') {
    return left - right;
  }

  return String(left).localeCompare(String(right), undefined, { sensitivity: 'base' });
}

export function sortBreakoutSignalRows(rows: BreakoutSignalRow[], sort: BreakoutSignalSortState): BreakoutSignalRow[] {
  return [...rows].sort((left, right) => {
    const base = compareNullable(getSortValue(left, sort.key), getSortValue(right, sort.key));
    if (base !== 0) {
      return sort.direction === 'asc' ? base : -base;
    }

    return compareNullable(left.candidateRank, right.candidateRank)
      || compareNullable(right.finalSignalScore, left.finalSignalScore)
      || left.playerName.localeCompare(right.playerName);
  });
}

export function filterBreakoutSignalRows(
  rows: BreakoutSignalRow[],
  options: { searchQuery?: string; filters?: BreakoutSignalQuickFilters } = {},
): BreakoutSignalRow[] {
  const query = options.searchQuery?.trim().toLowerCase() ?? '';
  const filters = options.filters ?? DEFAULT_BREAKOUT_FILTERS;

  return rows.filter((row) => {
    if (query) {
      const combined = [row.playerName, row.team ?? '', row.bestRecipeName ?? '', row.breakoutLabelDefault ?? '']
        .join(' ')
        .toLowerCase();

      if (!combined.includes(query)) {
        return false;
      }
    }

    if (filters.topN !== 'all' && (row.candidateRank == null || row.candidateRank > filters.topN)) {
      return false;
    }

    if (filters.breakoutOnly && !row.breakoutLabelDefault) {
      return false;
    }

    if (filters.highRoleOnly && (row.components.role == null || row.components.role < HIGH_SIGNAL_THRESHOLD)) {
      return false;
    }

    if (filters.highCohortOnly && (row.components.cohort == null || row.components.cohort < HIGH_SIGNAL_THRESHOLD)) {
      return false;
    }

    return true;
  });
}

export function buildBreakoutDetailSections(row: BreakoutSignalRow): BreakoutDetailSection[] {
  const consumedRawFields = new Set<string>();

  const sections = DETAIL_SECTIONS.map((section) => {
    const directFields = 'fields' in section
      ? section.fields
          .map(([key, label]) => {
            if (key in row.components) {
              return {
                label,
                value: normalizeTextValue(row.components[key as keyof BreakoutSignalComponents]),
              } satisfies BreakoutDetailField;
            }

            return {
              label,
              value: normalizeTextValue(row[key as keyof BreakoutSignalRow] as string | number | null),
            } satisfies BreakoutDetailField;
          })
          .filter((field) => field.value != null)
      : [];

    const rawEntries = Object.entries(row.rawFields)
      .filter(([field, value]) => {
        if (value == null || consumedRawFields.has(field)) {
          return false;
        }

        const matchesPrefix = 'rawPrefixes' in section && section.rawPrefixes?.some((prefix) => field.startsWith(prefix));
        const matchesPattern = 'rawPatterns' in section && section.rawPatterns?.some((pattern) => field.includes(pattern));
        const isFallback = 'rawFallback' in section && section.rawFallback;

        if (!matchesPrefix && !matchesPattern && !isFallback) {
          return false;
        }

        consumedRawFields.add(field);
        return true;
      })
      .map(([field, value]) => ({
        label: formatDetailLabel(field),
        value,
      }));

    const uniqueFields = [...directFields, ...rawEntries].filter((field, index, list) => {
      const firstIndex = list.findIndex((candidate) => candidate.label === field.label && candidate.value === field.value);
      return firstIndex === index;
    });

    return {
      id: section.id,
      title: section.title,
      description: section.description,
      fields: uniqueFields,
    } satisfies BreakoutDetailSection;
  }).filter((section) => section.fields.length > 0);

  return sections;
}
