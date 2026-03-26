export interface RookieArtifactRow {
  name: string;
  pos: string;
  player_id?: string | null;
  school?: string | null;
  proj_round?: number | null;
  rookie_rank?: number | null;
  tiber_rookie_alpha?: number | null;
  rookie_tier?: string | null;
  tiber_ras?: number | null;
  tiber_ras_v2?: number | null;
  production_score?: number | null;
  dominator_rating?: number | null;
  college_target_share?: number | null;
  college_ypc?: number | null;
  draft_capital_score?: number | null;
  athleticism_score?: number | null;
  ht?: number | null;
  wt?: number | null;
  forty?: number | null;
  ten?: number | null;
  vert?: number | null;
  broad?: number | null;
  cone?: number | null;
  shuttle?: number | null;
  profile_summary?: string | null;
  identity_note?: string | null;
  board_summary?: string | null;
  [key: string]: unknown;
}

export interface RookieArtifact {
  meta: {
    season: number | null;
    model_name?: string | null;
    model_version?: string | null;
    promoted_at?: string | null;
    generated_at?: string | null;
    [key: string]: unknown;
  };
  players: RookieArtifactRow[];
}

export type RookieSortField =
  | 'tiber_ras_v1'
  | 'tiber_ras_v2'
  | 'player_name'
  | 'proj_round'
  | 'production_score'
  | 'dominator_rating'
  | 'rookie_alpha'
  | 'athleticism_score';

export interface TiberRookieRow {
  rank: number;
  player_id: string | null;
  player_name: string;
  position: string;
  school: string | null;
  proj_round: number | null;
  rookie_rank: number | null;
  rookie_alpha: number | null;
  rookie_tier: string | null;
  tiber_ras_v1: number | null;
  tiber_ras_v2: number | null;
  production_score: number | null;
  dominator_rating: number | null;
  college_target_share: number | null;
  college_ypc: number | null;
  draft_capital_score: number | null;
  athleticism_score: number | null;
  height_inches: number | null;
  weight_lbs: number | null;
  forty_yard_dash: number | null;
  ten_yard_split: number | null;
  vertical_jump: number | null;
  broad_jump: number | null;
  three_cone: number | null;
  short_shuttle: number | null;
  profile_summary: string | null;
  identity_note: string | null;
  board_summary: string | null;
}

export interface TiberRookieBoard {
  season: number;
  count: number;
  model: {
    name: string;
    version: string | null;
    promotedAt: string | null;
    generatedAt: string | null;
    sourcePath: string;
  };
  players: TiberRookieRow[];
}

export type RookieIntegrationErrorCode = 'not_found' | 'invalid_payload' | 'upstream_unavailable' | 'config_error';

export class RookieIntegrationError extends Error {
  readonly code: RookieIntegrationErrorCode;
  readonly status: number;
  readonly cause?: unknown;

  constructor(code: RookieIntegrationErrorCode, message: string, status: number, cause?: unknown) {
    super(message);
    this.name = 'RookieIntegrationError';
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}
