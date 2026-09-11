/** Retrospective evidence only; operator judgment lives outside this contract. */
export type HistoricalMetric = { total: number | null; mean: number | null; nonnull_weeks: number; recorded_weeks: number };
export type HistoricalPlayer = {
  player_id: string;
  status: 'available' | 'unavailable';
  reason: string | null;
  identity: { tiber_player_id: string; confidence: string; match_method: string } | null;
  observed: { weeks: number[]; historical_teams: string[]; historical_positions: string[]; usage_conflict_weeks: number[]; usage_missing_weeks: number[] } | null;
  derived: Record<string, HistoricalMetric>;
};
export type HistoricalEvidence = {
  schema_version: 'tiber_draft_review_historical_v1';
  status: 'available' | 'unavailable';
  reason: string | null;
  window: { season: number; week_start: number; week_end: number; period_basis: string };
  provenance: {
    producer_repo: string; producer_commit: string;
    sources: Array<{ path: string; sha256: string }>;
    operator_acceptance: string;
    team_identity_admission?: {
      path: string; sha256: string; operator_acceptance: string; player_ids: string[];
      receipt_stage: string; consumer_authorization: string; consumer_authorization_scope: string;
      baseline_producer_commit: string; baseline_identity_sha256: string; limitations: string[];
    };
    source_acquired_at: null; source_updated_at: null; original_release_hash: null; package_version: null;
    transform: string;
    attribution: { name: string; source_url: string; license: string; license_url: string; notice: string };
  } | null;
  limitations: string[];
  unavailable_metrics: Record<string, null>;
  forecast: { status: 'unavailable'; fabricated_values: false };
  players: HistoricalPlayer[];
};
export const HISTORICAL_METRICS = [
  ['targets', 'Targets'], ['receptions', 'Receptions'], ['rushing_attempts', 'Carries'],
  ['receiving_yards', 'Receiving yards'], ['receiving_tds', 'Receiving TDs'],
  ['rushing_yards', 'Rushing yards'], ['rushing_tds', 'Rushing TDs'],
  ['passing_yards', 'Passing yards'], ['passing_tds', 'Passing TDs'], ['interceptions', 'Interceptions'],
  ['target_share', 'Average weekly target share'], ['air_yards_share', 'Average weekly air-yards share'],
] as const;
