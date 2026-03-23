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
