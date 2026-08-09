import { z } from 'zod';

/**
 * Rankings v2 canonical public contract scaffold.
 *
 * Scope:
 * - Defines the stable response/item shape for public Rankings v2 outputs.
 * - Allows nullable/optional fields for data that is not populated yet.
 * - Does not imply that every current rankings surface already conforms.
 */
export const RANKINGS_V2_CONTRACT_VERSION = 'v2-scaffold-2026-04-02' as const;

export const rankingsV2StatusTags = ['CANONICAL', 'LEGACY', 'EXPERIMENTAL', 'INTERNAL_ONLY'] as const;
export type RankingsSurfaceStatus = (typeof rankingsV2StatusTags)[number];

export const rankingsV2ModeSchema = z.enum(['weekly', 'ros', 'dynasty', 'rookie', 'bestball', 'custom']);
export type RankingsV2Mode = z.infer<typeof rankingsV2ModeSchema>;

export const rankingsV2LensSchema = z.enum([
  'lineup_decision',
  'roster_optimization',
  'asset_value',
  'rookie_evaluation',
  'portfolio_spike_week',
  'custom',
]);
export type RankingsV2Lens = z.infer<typeof rankingsV2LensSchema>;

export const rankingsV2HorizonSchema = z.enum([
  'week',
  'rest_of_season',
  'multi_year',
  'draft_window',
  'season_tournament',
  'custom',
]);
export type RankingsV2Horizon = z.infer<typeof rankingsV2HorizonSchema>;

export const rankingsV2SourceLayerSchema = z.enum([
  'player_performance_role',
  'forge',
  'context',
  'promoted_artifact',
  'confidence_stability',
  'consensus_market',
  'manual_override',
]);

export const rankingsV2SourceStackItemSchema = z.object({
  layer: rankingsV2SourceLayerSchema,
  source: z.string(),
  asOf: z.string().datetime().nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type RankingsV2SourceStackItem = z.infer<typeof rankingsV2SourceStackItemSchema>;

export const rankingsV2PillarNoteSchema = z.object({
  pillar: z.string(),
  note: z.string().nullable().optional(),
  impact: z.enum(['up', 'down', 'neutral']).nullable().optional(),
});
export type RankingsV2PillarNote = z.infer<typeof rankingsV2PillarNoteSchema>;

export const rankingsV2ExplanationPillarIdSchema = z.enum(['volume', 'efficiency', 'teamContext', 'stability']);
export type RankingsV2ExplanationPillarId = z.infer<typeof rankingsV2ExplanationPillarIdSchema>;

export const rankingsV2ExplanationPillarSchema = z.object({
  id: rankingsV2ExplanationPillarIdSchema,
  value: z.number().nullable().optional(),
  impact: z.enum(['up', 'down', 'neutral']).nullable().optional(),
  note: z.string().nullable().optional(),
});
export type RankingsV2ExplanationPillar = z.infer<typeof rankingsV2ExplanationPillarSchema>;

export const rankingsV2RiskSignalSchema = z.object({
  type: z.literal('football_lens_issue'),
  message: z.string(),
});
export type RankingsV2RiskSignal = z.infer<typeof rankingsV2RiskSignalSchema>;

export const rankingsV2ContextAdjustmentSchema = z.object({
  label: z.string(),
  direction: z.enum(['up', 'down', 'neutral']).nullable().optional(),
  magnitude: z.number().nullable().optional(),
  note: z.string().nullable().optional(),
});
export type RankingsV2ContextAdjustment = z.infer<typeof rankingsV2ContextAdjustmentSchema>;

export const rankingsV2ItemExplanationSchema = z.object({
  placementSummary: z.string().nullable().optional(),
  // First phase-2 implementation step: typed pillar/risk structure lives under explanation.
  pillars: z.array(rankingsV2ExplanationPillarSchema).default([]),
  riskSignals: z.array(rankingsV2RiskSignalSchema).default([]),
  pillarNotes: z.array(rankingsV2PillarNoteSchema).default([]),
  contextAdjustments: z.array(rankingsV2ContextAdjustmentSchema).default([]),
  fragilityNotes: z.array(z.string()).default([]),
  sustainabilityNotes: z.array(z.string()).default([]),
});
export type RankingsV2ItemExplanation = z.infer<typeof rankingsV2ItemExplanationSchema>;

export const rankingsV2TrustSchema = z.object({
  confidence: z.number().min(0).max(100).nullable().optional(),
  asOf: z.string().datetime().nullable().optional(),
  freshnessNote: z.string().nullable().optional(),
  sampleNote: z.string().nullable().optional(),
  stabilityNote: z.string().nullable().optional(),
});
export type RankingsV2Trust = z.infer<typeof rankingsV2TrustSchema>;

// Phase-1 transitional bridge for /tiers-style consumers.
// Phase-2 explanation-surface policy: see docs/architecture/TIBER_RANKINGS_V2_EXPLANATION_SURFACE.md
export const rankingsV2ItemUiMetaSchema = z.object({
  subscores: z
    .object({
      volume: z.number().nullable().optional(),
      efficiency: z.number().nullable().optional(),
      teamContext: z.number().nullable().optional(),
      stability: z.number().nullable().optional(),
    })
    .default({}),
  confidence: z.number().min(0).max(100).nullable().optional(),
  gamesPlayed: z.number().nullable().optional(),
  trajectory: z.enum(['rising', 'flat', 'declining']).nullable().optional(),
  footballLensIssues: z.array(z.string()).nullable().optional(),
  lensAdjustment: z.number().nullable().optional(),
});
export type RankingsV2ItemUiMeta = z.infer<typeof rankingsV2ItemUiMetaSchema>;

/**
 * Per-item identity envelope (Fantasy #308).
 *
 * `playerId` on a ranking item is the **canonical public key** and nothing else.
 * The producer's own identifier is preserved here as typed provenance rather
 * than being allowed to masquerade as the public key — which is what produced
 * the `/player/00-0036963` → "Player Not Found" regression.
 *
 * `linkable: false` means the consumer must render the row but must not build a
 * player deep link from it.
 */
export const rankingsV2ItemIdentitySchema = z.object({
  status: z.enum(['canonical', 'resolved', 'unresolved']),
  canonicalId: z.string().nullable(),
  sourceId: z.string(),
  sourceType: z.enum(['canonical', 'gsis', 'unknown']),
  reason: z.string().nullable(),
  linkable: z.boolean(),
});
export type RankingsV2ItemIdentity = z.infer<typeof rankingsV2ItemIdentitySchema>;

/** Cohort-level identity coverage, reported alongside every ranking response. */
export const rankingsV2IdentityCoverageSchema = z.object({
  total: z.number(),
  canonical: z.number(),
  resolved: z.number(),
  unresolved: z.number(),
  ambiguous: z.number(),
  coverageRatio: z.number(),
  byReason: z.record(z.string(), z.number()),
});
export type RankingsV2IdentityCoverage = z.infer<typeof rankingsV2IdentityCoverageSchema>;

const rankingsV2ItemSchema = z.object({
  rank: z.number().int().positive(),
  /**
   * The canonical public key, or **null** when identity could not be resolved.
   *
   * It is never a raw producer/source identifier: the contract says this field
   * is canonical-only, so an unresolved row carries null here and keeps its
   * producer key in `identity.sourceId` (Fantasy #308).
   */
  playerId: z.string().nullable(),
  playerName: z.string(),
  position: z.string().nullable().optional(),
  team: z.string().nullable().optional(),
  tier: z.string().nullable().optional(),
  score: z.number().nullable().optional(),
  value: z.number().nullable().optional(),
  explanation: rankingsV2ItemExplanationSchema,
  trust: rankingsV2TrustSchema,
  uiMeta: rankingsV2ItemUiMetaSchema.optional(),
  identity: rankingsV2ItemIdentitySchema,
});
export type RankingsV2Item = z.infer<typeof rankingsV2ItemSchema>;

export const rankingsV2ResponseSchema = z.object({
  contractVersion: z.literal(RANKINGS_V2_CONTRACT_VERSION),
  mode: rankingsV2ModeSchema,
  lens: rankingsV2LensSchema,
  horizon: rankingsV2HorizonSchema,
  asOf: z.string().datetime(),
  sourceStack: z.array(rankingsV2SourceStackItemSchema),
  items: z.array(rankingsV2ItemSchema),
  trust: rankingsV2TrustSchema,
  identityCoverage: rankingsV2IdentityCoverageSchema,
});
export type RankingsV2Response = z.infer<typeof rankingsV2ResponseSchema>;
