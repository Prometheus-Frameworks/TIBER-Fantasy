import { z } from 'zod';

export const EXPERT_SIGNAL_SCHEMA_VERSION = 'ffcc.expert-signal.v0.1.0' as const;
export const EXPERT_MOCK_DRAFT_SCHEMA_VERSION = 'ffcc.expert-mock-draft.v0.1.0' as const;

/**
 * Matches the strict RFC3339 instant convention already used by governed
 * contracts in this repository, including Z and explicit UTC offsets.
 */
export const RFC3339_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
export const Rfc3339InstantV0Schema = z
  .string()
  .regex(RFC3339_INSTANT_PATTERN)
  .refine((value) => Number.isFinite(Date.parse(value)), { message: 'invalid RFC3339 instant' });

const opaque = z.string().trim().min(1).max(1024);
const nullableOpaque = opaque.nullable();
const season = z.number().int().min(2000).max(2100);
const week = z.number().int().positive().max(30).nullable();

export const EXPERT_SIGNAL_TYPES = [
  'WEEKLY_RANKING',
  'ROS_RANKING',
  'DYNASTY_RANKING',
  'DEVY_RANKING',
  'TIER',
  'START_SIT',
  'START_OF_WEEK',
  'SLEEPER',
  'FADE_BUST',
  'BREAKOUT',
  'WAIVER_CALL',
  'FAAB_GUIDANCE',
  'TRADE_BUY',
  'TRADE_SELL',
  'TRADE_HOLD',
  'ROOKIE_RANKING',
  'MOCK_DRAFT_PICK',
  'MOCK_DRAFT_ORDER',
  'DRAFT_STRATEGY_CALL',
  'ROLE_INTERPRETATION',
  'INJURY_READINESS_INTERPRETATION',
  'SCHEME_MATCHUP_INTERPRETATION',
  'MARKET_INTERPRETATION',
  'OTHER_TYPED_REVIEW_REQUIRED',
] as const;
export const ExpertSignalTypeV0Schema = z.enum(EXPERT_SIGNAL_TYPES);
export type ExpertSignalTypeV0 = z.infer<typeof ExpertSignalTypeV0Schema>;

export const EXPERT_RATIONALE_TAGS = [
  'ROLE_USAGE',
  'VACATED_OPPORTUNITY',
  'INJURY_READINESS',
  'DEPTH_CHART',
  'QB_CHANGE',
  'OFFENSIVE_LINE',
  'SCHEME_MATCHUP',
  'GAME_ENVIRONMENT',
  'VEGAS_MARKET',
  'WEATHER',
  'TALENT_EFFICIENCY',
  'REGRESSION',
  'TEAM_ENVIRONMENT',
  'ROOKIE_DEVELOPMENT',
  'CONTRACT_TEAM_CONTROL',
  'MARKET_PRICE',
  'ROSTER_CONSTRUCTION',
  'OTHER_TYPED',
] as const;
export const ExpertRationaleTagV0Schema = z.enum(EXPERT_RATIONALE_TAGS);
export type ExpertRationaleTagV0 = z.infer<typeof ExpertRationaleTagV0Schema>;

export const ExpertSignalFormatV0Schema = z.object({
  leagueType: nullableOpaque,
  scoring: nullableOpaque,
  qbMode: nullableOpaque,
  rosterShape: nullableOpaque,
}).strict();
export type ExpertSignalFormatV0 = z.infer<typeof ExpertSignalFormatV0Schema>;

export const ExpertSignalQualityStateV0Schema = z.enum([
  'RAW',
  'VALIDATED',
  'NORMALIZED',
  'DECISION_GRADE',
  'QUARANTINED',
  'REJECTED',
]);
export type ExpertSignalQualityStateV0 = z.infer<typeof ExpertSignalQualityStateV0Schema>;

export const ExpertSignalReadinessStateV0Schema = z.enum([
  'READY',
  'PARTIAL',
  'STALE',
  'CONFLICTING',
  'UNAVAILABLE',
  'IDENTITY_UNRESOLVED',
]);
export type ExpertSignalReadinessStateV0 = z.infer<typeof ExpertSignalReadinessStateV0Schema>;

function epochMillis(value: string): number {
  return Date.parse(value);
}

function addClockOrderingIssues(
  value: { publishedAt: string; retrievedAt: string; knownAt: string },
  ctx: z.RefinementCtx,
): void {
  const publishedAt = epochMillis(value.publishedAt);
  const retrievedAt = epochMillis(value.retrievedAt);
  const knownAt = epochMillis(value.knownAt);

  if (knownAt < publishedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['knownAt'],
      message: 'knownAt cannot precede publishedAt',
    });
  }
  if (knownAt < retrievedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['knownAt'],
      message: 'knownAt cannot precede retrievedAt',
    });
  }
}

export const ExpertSignalEventV0Schema = z.object({
  schemaVersion: z.literal(EXPERT_SIGNAL_SCHEMA_VERSION),
  signalId: opaque,
  sourceId: opaque,
  analystId: nullableOpaque,
  publisherId: opaque,
  sourceTraceRef: opaque,
  publishedAt: Rfc3339InstantV0Schema,
  retrievedAt: Rfc3339InstantV0Schema,
  knownAt: Rfc3339InstantV0Schema,
  season,
  week,
  horizon: opaque,
  format: ExpertSignalFormatV0Schema,
  signalType: ExpertSignalTypeV0Schema,
  subjectPlayerIds: z.array(opaque),
  subjectTeamIds: z.array(opaque),
  rawPositionOrTier: nullableOpaque,
  normalizedDirection: z.enum(['UP', 'DOWN', 'NEUTRAL', 'MIXED']).nullable(),
  strengthIfExplicit: z.union([opaque, z.number().finite()]).nullable(),
  rationaleTags: z.array(ExpertRationaleTagV0Schema),
  summaryParaphrase: opaque,
  independenceCluster: nullableOpaque,
  sourcePolicyRef: opaque,
  qualityState: ExpertSignalQualityStateV0Schema,
  readinessState: ExpertSignalReadinessStateV0Schema,
  correctionOf: nullableOpaque,
  supersedes: nullableOpaque,
  warnings: z.array(opaque),
}).strict().superRefine((value, ctx) => {
  addClockOrderingIssues(value, ctx);

  if (value.correctionOf === value.signalId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['correctionOf'],
      message: 'signal cannot correct itself',
    });
  }
  if (value.supersedes === value.signalId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['supersedes'],
      message: 'signal cannot supersede itself',
    });
  }
});
export type ExpertSignalEventV0 = z.infer<typeof ExpertSignalEventV0Schema>;

export const ExpertMockDraftPickV0Schema = z.object({
  overallPick: z.number().int().positive(),
  round: z.number().int().positive(),
  slot: z.number().int().positive(),
  playerId: opaque,
  position: nullableOpaque,
  rationaleTags: z.array(ExpertRationaleTagV0Schema),
}).strict();
export type ExpertMockDraftPickV0 = z.infer<typeof ExpertMockDraftPickV0Schema>;

export const ExpertMockDraftLeagueFormatV0Schema = z.object({
  teams: z.number().int().positive().max(64).nullable(),
  qbMode: nullableOpaque,
  scoring: nullableOpaque,
  rosterShape: nullableOpaque,
}).strict();
export type ExpertMockDraftLeagueFormatV0 = z.infer<typeof ExpertMockDraftLeagueFormatV0Schema>;

export const ExpertMockDraftSnapshotV0Schema = z.object({
  schemaVersion: z.literal(EXPERT_MOCK_DRAFT_SCHEMA_VERSION),
  snapshotId: opaque,
  sourceId: opaque,
  analystIds: z.array(opaque),
  publishedAt: Rfc3339InstantV0Schema,
  retrievedAt: Rfc3339InstantV0Schema,
  knownAt: Rfc3339InstantV0Schema,
  mockType: z.enum(['redraft', 'dynasty_startup', 'rookie', 'best_ball', 'nfl', 'other_typed']),
  leagueFormat: ExpertMockDraftLeagueFormatV0Schema,
  participantType: z.enum(['expert_only', 'mixed', 'single_analyst', 'panel', 'unknown']),
  picks: z.array(ExpertMockDraftPickV0Schema),
  coverageStatus: z.enum(['COMPLETE', 'PARTIAL', 'UNKNOWN']),
  sourcePolicyRef: opaque,
  independenceCluster: nullableOpaque,
  warnings: z.array(opaque),
}).strict().superRefine((value, ctx) => {
  addClockOrderingIssues(value, ctx);

  const overallPicks = new Set<number>();
  const coordinates = new Set<string>();
  const playerIds = new Set<string>();

  value.picks.forEach((pick, index) => {
    if (overallPicks.has(pick.overallPick)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['picks', index, 'overallPick'],
        message: 'duplicate overallPick',
      });
    }
    overallPicks.add(pick.overallPick);

    const coordinate = `${pick.round}:${pick.slot}`;
    if (coordinates.has(coordinate)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['picks', index],
        message: 'duplicate round/slot coordinate',
      });
    }
    coordinates.add(coordinate);

    if (playerIds.has(pick.playerId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['picks', index, 'playerId'],
        message: 'duplicate playerId in mock snapshot',
      });
    }
    playerIds.add(pick.playerId);
  });
});
export type ExpertMockDraftSnapshotV0 = z.infer<typeof ExpertMockDraftSnapshotV0Schema>;
