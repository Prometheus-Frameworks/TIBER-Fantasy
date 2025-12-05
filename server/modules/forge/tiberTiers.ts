/**
 * Tiber Tiers - Position-specific tier classification system
 * 
 * Flagship feature for FORGE v0.2 ranking engine.
 * Provides stable tier assignments with weekly mover constraints.
 * 
 * Tier Definitions:
 * - T1: Elite - Top-tier fantasy asset
 * - T2: Quality Starter - Reliable weekly starter
 * - T3: Flex/Depth - Flex-worthy with upside
 * - T4: Rosterable - Benchable, situational plays
 * - T5: Waiver Wire - Stream or drop candidate
 */

import { 
  PlayerPosition, 
  TiberTierLevel, 
  TiberTierAssignment,
  TIBER_TIERS_2025,
  TIER_MOVER_RULES 
} from './types';

/**
 * Get the tier thresholds for a given position
 */
export function getTierThresholds(position: PlayerPosition): { T1: number; T2: number; T3: number; T4: number } {
  return TIBER_TIERS_2025[position];
}

/**
 * Assign a tier based on Alpha score and position
 */
export function assignTier(alpha: number, position: PlayerPosition): TiberTierLevel {
  const thresholds = getTierThresholds(position);
  
  if (alpha >= thresholds.T1) return 'T1';
  if (alpha >= thresholds.T2) return 'T2';
  if (alpha >= thresholds.T3) return 'T3';
  if (alpha >= thresholds.T4) return 'T4';
  return 'T5';
}

/**
 * Get tier numeric value for comparison (T1=1, T5=5)
 */
export function tierToNumber(tier: TiberTierLevel): number {
  const map: Record<TiberTierLevel, number> = {
    'T1': 1, 'T2': 2, 'T3': 3, 'T4': 4, 'T5': 5
  };
  return map[tier];
}

/**
 * Get tier from numeric value
 */
export function numberToTier(num: number): TiberTierLevel {
  const map: Record<number, TiberTierLevel> = {
    1: 'T1', 2: 'T2', 3: 'T3', 4: 'T4', 5: 'T5'
  };
  return map[Math.max(1, Math.min(5, num))] ?? 'T5';
}

interface MoverContext {
  seasonAlpha: number;
  matchupBoost: number;
  teamOffensiveEpaRank?: number;  // 1=best, 32=worst
  projectedSnapShare?: number;    // 0-1
  previousTier?: TiberTierLevel;
}

/**
 * Apply weekly mover rules to constrain tier changes
 * 
 * Rules:
 * - Max ±1 tier move per week
 * - Max ±10 Alpha points from matchup boost/penalty
 * - Bottom-8 offense → max +4 boost
 * - Projected snaps < 60% → zero upward adjustment
 * - True elites (season Alpha ≥ 85) → max -6 points (never drop out of T1)
 */
export function applyMoverRules(
  position: PlayerPosition,
  context: MoverContext
): TiberTierAssignment {
  const { 
    seasonAlpha, 
    matchupBoost, 
    teamOffensiveEpaRank, 
    projectedSnapShare,
    previousTier 
  } = context;
  
  const isElite = seasonAlpha >= TIER_MOVER_RULES.ELITE_THRESHOLD;
  let constrainedBoost = matchupBoost;
  let moveConstrained = false;
  
  // Rule: Max ±10 points from matchup
  constrainedBoost = Math.max(
    TIER_MOVER_RULES.MAX_MATCHUP_PENALTY,
    Math.min(TIER_MOVER_RULES.MAX_MATCHUP_BOOST, constrainedBoost)
  );
  
  // Rule: Bottom-8 offense → max +4 boost
  if (teamOffensiveEpaRank && teamOffensiveEpaRank >= 25) {
    if (constrainedBoost > TIER_MOVER_RULES.BOTTOM_OFFENSE_MAX_BOOST) {
      constrainedBoost = TIER_MOVER_RULES.BOTTOM_OFFENSE_MAX_BOOST;
      moveConstrained = true;
    }
  }
  
  // Rule: Low snap projection → zero upward adjustment
  if (projectedSnapShare !== undefined && 
      projectedSnapShare < TIER_MOVER_RULES.LOW_SNAP_PROJECTION_THRESHOLD) {
    if (constrainedBoost > 0) {
      constrainedBoost = 0;
      moveConstrained = true;
    }
  }
  
  // Calculate weekly alpha
  let weeklyAlpha = seasonAlpha + constrainedBoost;
  
  // Rule: True elites max -6 points (never drop out of T1)
  if (isElite && weeklyAlpha < seasonAlpha - TIER_MOVER_RULES.ELITE_MAX_DROP) {
    weeklyAlpha = seasonAlpha - TIER_MOVER_RULES.ELITE_MAX_DROP;
    moveConstrained = true;
  }
  
  // Ensure elites never drop below T1 threshold
  if (isElite) {
    const t1Threshold = getTierThresholds(position).T1;
    if (weeklyAlpha < t1Threshold) {
      weeklyAlpha = t1Threshold;
      moveConstrained = true;
    }
  }
  
  // Assign tiers
  const newTier = assignTier(weeklyAlpha, position);
  
  // Rule: Max ±1 tier move per week
  let tierChange: number | undefined;
  if (previousTier) {
    const prevTierNum = tierToNumber(previousTier);
    const newTierNum = tierToNumber(newTier);
    tierChange = prevTierNum - newTierNum; // Positive = improved, negative = dropped
    
    if (Math.abs(tierChange) > TIER_MOVER_RULES.MAX_TIER_CHANGE_PER_WEEK) {
      const constrainedTierNum = prevTierNum - Math.sign(tierChange);
      const constrainedTier = numberToTier(constrainedTierNum);
      
      return {
        tier: constrainedTier,
        alpha: seasonAlpha,
        weeklyAlpha,
        previousTier,
        tierChange: Math.sign(tierChange),
        isElite,
        moveConstrained: true,
      };
    }
  }
  
  return {
    tier: newTier,
    alpha: seasonAlpha,
    weeklyAlpha,
    previousTier,
    tierChange,
    isElite,
    moveConstrained,
  };
}

/**
 * Simple tier assignment without mover rules (for initial/season view)
 */
export function assignSimpleTier(
  alpha: number,
  position: PlayerPosition
): TiberTierAssignment {
  const tier = assignTier(alpha, position);
  const isElite = alpha >= TIER_MOVER_RULES.ELITE_THRESHOLD;
  
  return {
    tier,
    alpha,
    isElite,
    moveConstrained: false,
  };
}

/**
 * Get tier description/label
 */
export function getTierLabel(tier: TiberTierLevel): string {
  const labels: Record<TiberTierLevel, string> = {
    'T1': 'Elite',
    'T2': 'Quality Starter',
    'T3': 'Flex/Depth',
    'T4': 'Rosterable',
    'T5': 'Waiver Wire',
  };
  return labels[tier];
}

/**
 * Get tier color for UI
 */
export function getTierColor(tier: TiberTierLevel): string {
  const colors: Record<TiberTierLevel, string> = {
    'T1': '#ffd700',  // Gold
    'T2': '#4ade80',  // Green
    'T3': '#60a5fa',  // Blue
    'T4': '#a78bfa',  // Purple
    'T5': '#9ca3af',  // Gray
  };
  return colors[tier];
}

export {
  TIBER_TIERS_2025,
  TIER_MOVER_RULES,
};
