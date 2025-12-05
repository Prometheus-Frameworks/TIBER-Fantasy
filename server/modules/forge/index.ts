/**
 * FORGE v0.1 - Module Index
 * Football Oriented Recursive Grading Engine
 * 
 * A self-contained, read-only scoring module that provides:
 * - Position-specific alpha scores (0-100) for WR/RB/TE/QB
 * - Sub-scores: volume, efficiency, roleLeverage, stability, contextFit
 * - Trajectory: rising | flat | declining
 * - Confidence: 0-100 reliability score
 * 
 * Usage:
 * ```typescript
 * import { forgeService } from './modules/forge';
 * 
 * const score = await forgeService.getForgeScoreForPlayer('tyreek_hill', 2024, 17);
 * console.log(score.alpha); // 87.3
 * ```
 */

export { forgeService } from './forgeService';
export type { ForgeBatchQuery as ForgeServiceBatchQuery } from './forgeService';
export type { IForgeService } from './types';

export { getForgeBatch, getForgeScoreForPlayer } from './forgeGateway';
export type { ForgeBatchQuery, ForgeBatchResult } from './forgeGateway';

export type {
  ForgeScore,
  ForgeSubScores,
  ForgeContext,
  ForgeFeatureBundle,
  ForgeFeatureBundleBase,
  PlayerPosition,
  WeekOrPreseason,
  Trajectory,
  AlphaWeights,
  ForgePosition,
  ForgeTrajectory,
} from './types';

export { 
  ALPHA_WEIGHTS, 
  TRAJECTORY_THRESHOLDS, 
  CONFIDENCE_CONFIG, 
  MISSING_DATA_CAPS,
  EFFICIENCY_CAPS,
  TIBER_TIERS_2025,
  TIER_MOVER_RULES,
} from './types';

export type { TiberTierLevel, TiberTierAssignment } from './types';

export {
  assignTier,
  assignSimpleTier,
  applyMoverRules,
  getTierThresholds,
  getTierLabel,
  getTierColor,
} from './tiberTiers';

export { registerForgeRoutes } from './routes';
export { default as forgeRouter } from './routes';

export { createForgeSnapshot } from './forgeSnapshot';
export type { ForgeSnapshotOptions, ForgeSnapshotMeta } from './forgeSnapshot';

export { calculateAlphaScore } from './alphaEngine';

export { fetchContext } from './context/contextFetcher';

export { buildWRFeatures } from './features/wrFeatures';
export { buildRBFeatures } from './features/rbFeatures';
export { buildTEFeatures } from './features/teFeatures';
export { buildQBFeatures } from './features/qbFeatures';
