import { z } from 'zod';

export const forgeCompareModeSchema = z.enum(['redraft', 'dynasty', 'bestball']);
export const forgeCanonicalModeSchema = z.enum(['redraft', 'dynasty', 'best_ball']);
export const forgePositionSchema = z.enum(['QB', 'RB', 'WR', 'TE']);
export const forgeWeekSchema = z.union([
  z.number().int().min(1).max(25),
  z.literal('season'),
]);

export const forgeComparisonRequestSchema = z.object({
  playerId: z.string().min(1),
  position: forgePositionSchema,
  season: z.number().int().min(2000).max(2100),
  week: forgeWeekSchema.default('season'),
  mode: forgeCompareModeSchema.default('redraft'),
  includeSourceMeta: z.boolean().optional().default(true),
  includeRawCanonical: z.boolean().optional().default(false),
});

export type TiberForgeComparisonRequest = z.infer<typeof forgeComparisonRequestSchema>;
export type TiberForgeMode = z.infer<typeof forgeCompareModeSchema>;
export type TiberForgePosition = z.infer<typeof forgePositionSchema>;
export type TiberForgeWeek = z.infer<typeof forgeWeekSchema>;

const canonicalIssueSchema = z.object({
  code: z.string().min(1),
  severity: z.enum(['info', 'warn', 'block']),
  message: z.string().min(1),
});

const canonicalEvaluationResultSchema = z.object({
  player_id: z.string().min(1),
  player_name: z.string().min(1),
  position: forgePositionSchema,
  team: z.string().min(1).nullable().optional(),
  season: z.number().int().min(2000).max(2100),
  week: forgeWeekSchema,
  mode: forgeCanonicalModeSchema,
  score: z.object({
    alpha: z.number().finite(),
    tier: z.string().min(1),
    tier_rank: z.number().int().positive().nullable().optional(),
    confidence: z.number().finite().min(0).max(1),
  }),
  components: z.object({
    volume: z.number().finite(),
    efficiency: z.number().finite(),
    team_context: z.number().finite(),
    stability: z.number().finite(),
  }),
  metadata: z.object({
    games_sampled: z.number().int().min(0),
    position_rank: z.number().int().positive().nullable().optional(),
    status: z.enum(['ok', 'partial', 'not_found', 'unsupported_position', 'error']),
    issues: z.array(canonicalIssueSchema).default([]),
  }),
  source_meta: z.object({
    data_window: z.object({
      season: z.number().int().min(2000).max(2100),
      through_week: forgeWeekSchema,
    }),
    coverage: z.object({
      advanced_metrics: z.boolean(),
      snap_data: z.boolean(),
      team_context: z.boolean(),
      matchup_context: z.boolean(),
    }),
    inputs_used: z.object({
      profile: z.string().min(1),
      source_count: z.number().int().min(0),
    }),
  }).optional(),
});

export const canonicalForgeEvaluationResponseSchema = z.object({
  request: z.object({
    season: z.number().int().min(2000).max(2100),
    week: forgeWeekSchema,
    mode: forgeCanonicalModeSchema,
    player_count: z.number().int().min(1),
  }),
  service_meta: z.object({
    service: z.string().min(1),
    contract_version: z.string().min(1),
    model_version: z.string().min(1),
    calibration_version: z.string().min(1),
    generated_at: z.string().datetime(),
  }),
  results: z.array(canonicalEvaluationResultSchema),
  errors: z.array(z.unknown()).default([]),
});

export type CanonicalForgeEvaluationResponse = z.infer<typeof canonicalForgeEvaluationResponseSchema>;
export type CanonicalForgeEvaluationResult = z.infer<typeof canonicalEvaluationResultSchema>;

export type ForgeIntegrationErrorCode =
  | 'config_error'
  | 'upstream_unavailable'
  | 'upstream_timeout'
  | 'invalid_payload'
  | 'invalid_request'
  | 'not_found'
  | 'unsupported';

export class ForgeIntegrationError extends Error {
  readonly code: ForgeIntegrationErrorCode;
  readonly status: number;
  readonly cause?: unknown;

  constructor(code: ForgeIntegrationErrorCode, message: string, status: number, cause?: unknown) {
    super(message);
    this.name = 'ForgeIntegrationError';
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

export interface ForgeClientConfig {
  baseUrl?: string;
  timeoutMs?: number;
  endpointPath?: string;
  enabled?: boolean;
}

export interface TiberForgeIssue {
  code: string;
  severity: 'info' | 'warn' | 'block';
  message: string;
}

export interface TiberForgeEvaluation {
  playerId: string;
  playerName: string;
  position: TiberForgePosition;
  team: string | null;
  season: number;
  week: TiberForgeWeek;
  mode: TiberForgeMode;
  score: {
    alpha: number;
    tier: string;
    tierRank: number | null;
    confidence: number | null;
  };
  components: {
    volume: number;
    efficiency: number;
    teamContext: number;
    stability: number;
  };
  metadata: {
    gamesSampled: number;
    positionRank: number | null;
    status: 'ok' | 'partial' | 'not_found' | 'unsupported_position' | 'error';
    issues: TiberForgeIssue[];
  };
  source: {
    provider: 'legacy-forge' | 'external-forge';
    modelVersion: string;
    contractVersion?: string;
    calibrationVersion?: string;
    generatedAt: string;
    dataWindow?: {
      season: number;
      throughWeek: TiberForgeWeek;
    };
    coverage?: {
      advancedMetrics: boolean;
      snapData: boolean;
      teamContext: boolean;
      matchupContext: boolean;
    };
    inputsUsed?: {
      profile: string;
      sourceCount: number;
    };
  };
  rawCanonical?: CanonicalForgeEvaluationResult;
}

export interface TiberForgeComparisonSide {
  available: boolean;
  data?: TiberForgeEvaluation;
  error?: {
    category: ForgeIntegrationErrorCode | 'legacy_error';
    message: string;
  };
}

export type ForgeParityStatus = 'close' | 'drift' | 'unavailable' | 'not_comparable';

export interface TiberForgeComparisonResult {
  request: TiberForgeComparisonRequest;
  legacy: TiberForgeComparisonSide;
  external: TiberForgeComparisonSide;
  comparison: {
    scoreDelta?: number;
    componentDeltas?: Record<'volume' | 'efficiency' | 'teamContext' | 'stability', number>;
    confidenceDelta?: number | null;
    notes: string[];
    parityStatus: ForgeParityStatus;
  };
}
