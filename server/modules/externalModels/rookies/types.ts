import { z } from 'zod';

export const rookieArtifactRowSchema = z.object({
  name: z.string().min(1),
  pos: z.string().min(1),
  player_id: z.string().min(1).nullable().optional(),
  school: z.string().min(1).nullable().optional(),
  proj_round: z.number().int().min(1).max(10).nullable().optional(),
  rookie_rank: z.number().int().positive().nullable().optional(),
  tiber_rookie_alpha: z.number().finite().nullable().optional(),
  rookie_tier: z.string().min(1).nullable().optional(),
  tiber_ras: z.number().finite().nullable().optional(),
  tiber_ras_v2: z.number().finite().nullable().optional(),
  production_score: z.number().finite().nullable().optional(),
  dominator_rating: z.number().finite().nullable().optional(),
  college_target_share: z.number().finite().nullable().optional(),
  college_ypc: z.number().finite().nullable().optional(),
  draft_capital_score: z.number().finite().nullable().optional(),
  athleticism_score: z.number().finite().nullable().optional(),
  ht: z.number().finite().nullable().optional(),
  wt: z.number().finite().nullable().optional(),
  forty: z.number().finite().nullable().optional(),
  ten: z.number().finite().nullable().optional(),
  vert: z.number().finite().nullable().optional(),
  broad: z.number().finite().nullable().optional(),
  cone: z.number().finite().nullable().optional(),
  shuttle: z.number().finite().nullable().optional(),
  profile_summary: z.string().nullable().optional(),
  identity_note: z.string().nullable().optional(),
  board_summary: z.string().nullable().optional(),
}).passthrough();

export const rookieArtifactSchema = z.object({
  meta: z.object({
    season: z.number().int().min(2000).max(2100).nullable().optional(),
    model_name: z.string().optional(),
    model_version: z.string().optional(),
    promoted_at: z.string().optional(),
    generated_at: z.string().optional(),
  }).passthrough(),
  players: z.array(rookieArtifactRowSchema).min(1),
}).passthrough();

export type RookieArtifact = z.infer<typeof rookieArtifactSchema>;

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
