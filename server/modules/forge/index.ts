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
export type { IForgeService } from './types';

export type {
  ForgeScore,
  ForgeSubScores,
  ForgeContext,
  ForgeFeatureBundle,
  PlayerPosition,
  WeekOrPreseason,
  Trajectory,
  AlphaWeights,
} from './types';

export { ALPHA_WEIGHTS, TRAJECTORY_THRESHOLDS, CONFIDENCE_CONFIG, MISSING_DATA_CAPS } from './types';

export { registerForgeRoutes } from './routes';
export { default as forgeRouter } from './routes';

export { calculateAlphaScore } from './alphaEngine';

export { fetchContext } from './context/contextFetcher';

export { buildWRFeatures } from './features/wrFeatures';
export { buildRBFeatures } from './features/rbFeatures';
export { buildTEFeatures } from './features/teFeatures';
export { buildQBFeatures } from './features/qbFeatures';
