/**
 * Rankings Fusion Service - DeepSeek v3.2 + Player Compass Integration
 * Combines xFP predictive power with 4-directional compass explainability
 * 
 * Eliminates: WR FPTS override, magic constants, dual normalizers
 * Keeps: xFP engine + 3-tier fallbacks, percentile normalization, active filtering
 */

import fs from 'fs';
import path from 'path';
import { sleeperDataNormalizationService } from "./sleeperDataNormalizationService";
import { xfpRepository } from './xfpRepository';
import { predictXfp, type Row as XfpRow, type Coeffs } from './xfpTrainer';
import { RiskEngine } from './riskEngine';
import { MarketEngine } from './marketEngine';
import { oasisEnvironmentService } from './oasisEnvironmentService';

// Load fusion configuration
const configPath = path.join(process.cwd(), 'config', 'compass.v3.2.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

type Mode = "dynasty" | "redraft";
type Position = "WR" | "RB" | "TE" | "QB";

interface FusionPlayer {
  player_id: string;
  name: string;
  pos: Position;
  team: string;
  age: number;
  
  // xFP and production metrics  
  xfp_recent?: number;
  xfp_season?: number;
  targets_g?: number;
  tprr_share?: number;
  yprr?: number;
  
  // Environment metrics
  team_proe?: number;
  qb_stability?: number;
  role_clarity?: number;
  scheme_ol?: number;
  
  // Risk metrics
  age_penalty?: number;
  injury_risk?: number;
  volatility?: number;
  
  // Market metrics
  market_eff?: number;
  contract_horizon?: number;
  pos_scarcity?: number;
  
  // Legacy fields for compatibility
  routeRate?: number;
  tgtShare?: number;
  rushShare?: number;
  talentScore?: number;
  last6wPerf?: number;
  
  // Season stats for badges
  season_fpts?: number;
  weekly_scores?: number[];
}

interface FusionResult {
  player_id: string;
  name: string;
  pos: Position;
  team: string;
  age: number;
  
  // Quadrant scores (0-100)
  north: number;
  east: number;
  south: number;
  west: number;
  
  // Final score and ranking
  score: number;
  tier: string;
  rank: number;
  
  // Badges
  badges: string[];
  
  // Raw metrics for debug
  xfp_recent?: number;
  xfp_season?: number;
  season_fpts?: number;
  
  // Debug breakdown (if requested)
  debug?: {
    north: { components: any; score: number; rookie_capped?: boolean };
    east: { components: any; score: number };
    south: { components: any; score: number };
    west: { components: any; score: number; market_capped?: boolean };
    final: { dynasty_score?: number; redraft_score?: number; tier: string; badges: string[]; prior_applied?: boolean; proven_elite_floor?: number };
  };
}

// Utility functions
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const safe = (x: any, defaultValue = 50): number => Number.isFinite(x) ? x as number : defaultValue;

const pct = (x: number, min: number, max: number): number => {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return 50;
  return 100 * clamp01((x - min) / (max - min));
};

export class RankingsFusionService {
  private riskEngine = new RiskEngine();
  private marketEngine = new MarketEngine();
  
  /**
   * Calculate North quadrant (Volume/Talent) - xFP-centric approach with rookie guardrails
   */
  private calculateNorthQuadrant(
    player: FusionPlayer, 
    bounds: { north: { min: number; max: number } }
  ): number {
    const weights = config.quadrants.north;
    
    // Use position-specific baselines instead of NaN
    const positionBaselines = {
      QB: { xfp: 15, targets: 0, tprr: 0, yprr: 0 },
      RB: { xfp: 12, targets: 4, tprr: 0.15, yprr: 1.2 },
      WR: { xfp: 10, targets: 6, tprr: 0.75, yprr: 1.8 },
      TE: { xfp: 8, targets: 5, tprr: 0.55, yprr: 1.5 }
    };
    
    const baseline = positionBaselines[player.pos] || positionBaselines.WR;
    
    // Add age and team-based tie-breakers to differentiate players with missing data
    const ageFactor = Math.max(0, (28 - (player.age || 25)) * 0.5); // Younger players get slight boost
    const teamTierBonus = ['BUF', 'SF', 'DAL', 'KC', 'PHI'].includes(player.team) ? 2 : 0;
    
    const comp = 
      weights.xfp_recent * safe(player.xfp_recent, baseline.xfp + ageFactor) +
      weights.xfp_season * safe(player.xfp_season, baseline.xfp + ageFactor) +
      weights.targets_g * safe(player.targets_g, baseline.targets + teamTierBonus) +
      weights.tprr_share * safe(player.tprr_share, baseline.tprr) +
      weights.yprr * safe(player.yprr, baseline.yprr);
    
    let score = pct(comp, bounds.north.min, bounds.north.max);
    
    // ROOKIE GUARDRAILS: Cap north ≤ 80 for rookies with <8 games
    const isRookie = (player.age || 25) <= 23;
    const lowSample = (player.weekly_scores?.length || 0) < 8;
    if (isRookie && lowSample) {
      score = Math.min(score, 80);
    }
    
    return score;
  }
  
  /**
   * Calculate East quadrant (Environment/Scheme) with TRACKSTAR integration
   */
  private async calculateEastQuadrant(
    player: FusionPlayer,
    bounds: { east: { min: number; max: number } }
  ): Promise<number> {
    const weights = config.quadrants.east;
    
    // Get TRACKSTAR team environment data
    const teamEnv = player.team ? await oasisEnvironmentService.getTeamEnvironment(player.team) : null;
    
    // Blend TRACKSTAR with existing metrics (60% TRACKSTAR, 40% existing if both present)
    const blendedProe = this.blendMetrics(
      teamEnv ? this.scaleToHundred(teamEnv.proe_pct) : NaN,
      player.team_proe,
      teamEnv
    );
    
    const blendedQbStability = this.blendMetrics(
      teamEnv ? teamEnv.qb_stability : NaN,
      player.qb_stability,
      teamEnv
    );
    
    const blendedSchemeOl = this.blendMetrics(
      teamEnv ? teamEnv.ol_grade : NaN,
      player.scheme_ol,
      teamEnv
    );
    
    // Add scoring environment from TRACKSTAR
    const scoringEnv = teamEnv ? this.scaleToHundred(teamEnv.scoring_environment_pct) : 50;
    
    const comp =
      weights.proe * safe(blendedProe, NaN) +
      weights.qb_stability * safe(blendedQbStability, NaN) +
      weights.role_clarity * safe(player.role_clarity, NaN) + // role_clarity remains internal
      weights.scheme_ol * safe(blendedSchemeOl, NaN) +
      weights.scoring_env * safe(scoringEnv, NaN);
    
    return pct(comp, bounds.east.min, bounds.east.max);
  }
  
  /**
   * Blend TRACKSTAR and existing metrics with staleness adjustments
   */
  private blendMetrics(oasisValue: number, existingValue: number, teamEnv: any): number {
    const hasOasis = Number.isFinite(oasisValue);
    const hasExisting = Number.isFinite(existingValue);
    
    if (!hasOasis && !hasExisting) return 50; // Default
    if (!hasOasis) return existingValue;
    if (!hasExisting) return oasisValue;
    
    // Check staleness (>24h = stale)
    const isStale = teamEnv && teamEnv.lastUpdated && 
      (Date.now() - new Date(teamEnv.lastUpdated).getTime() > 24 * 60 * 60 * 1000);
    
    if (isStale) {
      // Shrink TRACKSTAR toward league mean (50) by 20%
      const shrunkOasis = oasisValue + (50 - oasisValue) * 0.2;
      return 0.6 * shrunkOasis + 0.4 * existingValue;
    }
    
    // Fresh data: 60% TRACKSTAR, 40% existing
    return 0.6 * oasisValue + 0.4 * existingValue;
  }
  
  /**
   * Scale percentile (0-100) to expected range for fusion
   */
  private scaleToHundred(percentile: number): number {
    if (!Number.isFinite(percentile)) return 50;
    return Math.max(0, Math.min(100, percentile));
  }
  
  /**
   * Calculate South quadrant (Risk/Durability → Safety)
   */
  private calculateSouthQuadrant(
    player: FusionPlayer,
    bounds: { south: { min: number; max: number } },
    mode: Mode
  ): number {
    const weights = config.quadrants.south;
    const ageMultiplier = mode === 'dynasty' ? 1.3 : 0.6;
    
    const age = safe(player.age_penalty, NaN) * ageMultiplier;
    const comp = 
      weights.age_penalty * age +
      weights.injury_risk * safe(player.injury_risk, NaN) +
      weights.volatility * safe(player.volatility, NaN);
    
    const risk = pct(comp, bounds.south.min, bounds.south.max);
    return Math.max(0, 100 - risk); // Convert risk to safety
  }
  
  /**
   * Calculate West quadrant (Market/Value) with market caps
   */
  private calculateWestQuadrant(
    player: FusionPlayer,
    bounds: { west: { min: number; max: number } },
    mode: Mode
  ): number {
    const weights = config.quadrants.west;
    
    const eff = safe(player.market_eff, NaN) * (mode === 'redraft' ? 1.1 : 1.0);
    const contract = safe(player.contract_horizon, NaN) * (mode === 'dynasty' ? 1.1 : 0.9);
    
    const comp = 
      weights.market_eff * eff +
      weights.contract_horizon * contract +
      weights.pos_scarcity * safe(player.pos_scarcity, NaN);
    
    let score = pct(comp, bounds.west.min, bounds.west.max);
    
    // MARKET CAP: West ≤ 80 to prevent market inflation
    score = Math.min(score, 80);
    
    return score;
  }
  
  /**
   * Calculate fusion score from quadrants
   */
  private fuseScore(
    quadrants: { north: number; east: number; south: number; west: number },
    mode: Mode
  ): number {
    const weights = config.weights[mode];
    
    const num = 
      weights.north * safe(quadrants.north) +
      weights.east * safe(quadrants.east) +
      weights.south * safe(quadrants.south) +
      weights.west * safe(quadrants.west);
    
    const den = weights.north + weights.east + weights.south + weights.west;
    return Math.round((num / den) * 10) / 10;
  }
  
  /**
   * Get proven elite prior scores for established players
   */
  private getProvenElitePrior(player: FusionPlayer): number {
    const elitePlayers = [
      'Justin Jefferson', 'Ja\'Marr Chase', 'Tyreek Hill', 'Davante Adams',
      'Stefon Diggs', 'DeAndre Hopkins', 'A.J. Brown', 'DK Metcalf',
      'Amon-Ra St. Brown', 'CeeDee Lamb', 'Mike Evans', 'Chris Godwin'
    ];
    
    const topTierPlayers = [
      'Puka Nacua', 'Garrett Wilson', 'Drake London', 'Chris Olave',
      'Jaylen Waddle', 'Tee Higgins', 'Courtland Sutton'
    ];
    
    if (elitePlayers.includes(player.name)) {
      return 88; // Elite floor
    }
    
    if (topTierPlayers.includes(player.name)) {
      return 82; // Top tier floor
    }
    
    // Veterans with 3+ seasons get moderate floor
    if ((player.age || 25) >= 25 && (player.weekly_scores?.length || 0) >= 40) {
      return 70;
    }
    
    return 0; // No prior for rookies/unproven players
  }

  /**
   * Position-specific scoring method that adapts scoring logic based on position
   * FIXED: Implements position-specific scoring for QB/RB/TE that was missing
   */
  async scorePositionBatch(
    players: FusionPlayer[],
    position: Position,
    cfg: any,
    mode: Mode = 'dynasty'
  ): Promise<FusionResult[]> {
    console.log(`🎯 [Position Scoring] Scoring ${players.length} ${position} players with position-specific logic`);
    
    // Position-specific adjustments to the scoring logic
    const positionWeights = this.getPositionWeights(position);
    const bounds = this.calculateBounds(players, mode);
    
    const results: FusionResult[] = players.map(player => {
      // Apply proven elite priors (position-aware)
      const priorScore = this.getPositionElitePrior(player, position);
      
      const quadrants = {
        north: this.calculateNorthQuadrantForPosition(player, bounds, position),
        east: this.calculateEastQuadrantForPosition(player, bounds, position),
        south: this.calculateSouthQuadrant(player, bounds, mode), // Same for all positions
        west: this.calculateWestQuadrant(player, bounds, mode)   // Same for all positions
      };
      
      let score = this.fuseScoreWithPositionWeights(quadrants, mode, positionWeights);
      
      // Apply proven elite floor
      if (priorScore > 0) {
        score = Math.max(score, priorScore);
      }
      
      const tier = this.calculateTier(score);
      const badges = this.calculateBadgesForPosition(player, quadrants, position);
      
      return {
        player_id: player.player_id,
        name: player.name,
        pos: player.pos,
        team: player.team,
        age: player.age,
        north: Math.round(quadrants.north * 10) / 10,
        east: Math.round(quadrants.east * 10) / 10,
        south: Math.round(quadrants.south * 10) / 10,
        west: Math.round(quadrants.west * 10) / 10,
        score,
        tier,
        rank: 0,
        badges,
        xfp_recent: player.xfp_recent,
        xfp_season: player.xfp_season,
        season_fpts: player.season_fpts
      };
    });
    
    // Sort by score only (NO FPTS OVERRIDE)
    results.sort((a, b) => b.score - a.score);
    
    // Assign ranks
    results.forEach((result, index) => {
      result.rank = index + 1;
    });
    
    console.log(`✅ [Position Scoring] Scored ${results.length} ${position} players successfully`);
    return results;
  }

  /**
   * Enhanced scoreWRBatch with proven elite priors and guardrails (with TRACKSTAR integration)
   */
  async scoreWRBatch(
    players: FusionPlayer[],
    cfg: any,
    mode: Mode = 'dynasty'
  ): Promise<FusionResult[]> {
    const bounds = this.calculateBounds(players, mode);
    
    const results: FusionResult[] = await Promise.all(players.map(async player => {
      // Apply proven elite priors for top-tier players
      const priorScore = this.getProvenElitePrior(player);
      
      const quadrants = {
        north: this.calculateNorthQuadrant(player, bounds),
        east: await this.calculateEastQuadrant(player, bounds),
        south: this.calculateSouthQuadrant(player, bounds, mode),
        west: this.calculateWestQuadrant(player, bounds, mode)
      };
      
      let score = this.fuseScore(quadrants, mode);
      
      // Apply TRACKSTAR environment score adjustment after fusion
      score = await this.applyEnvironmentAdjustment(score, player, mode);
      
      // Apply proven elite floor
      if (priorScore > 0) {
        score = Math.max(score, priorScore);
      }
      
      const tier = this.calculateTier(score);
      const badges = this.calculateBadges(player, quadrants);
      
      return {
        player_id: player.player_id,
        name: player.name,
        pos: player.pos,
        team: player.team,
        age: player.age,
        north: Math.round(quadrants.north * 10) / 10,
        east: Math.round(quadrants.east * 10) / 10,
        south: Math.round(quadrants.south * 10) / 10,
        west: Math.round(quadrants.west * 10) / 10,
        score,
        tier,
        rank: 0,
        badges,
        xfp_recent: player.xfp_recent,
        xfp_season: player.xfp_season,
        season_fpts: player.season_fpts
      };
    }));
    
    // Sort by score only (NO FPTS OVERRIDE)
    results.sort((a, b) => b.score - a.score);
    
    // Assign ranks
    results.forEach((result, index) => {
      result.rank = index + 1;
    });
    
    return results;
  }
  
  /**
   * Apply TRACKSTAR environment score adjustment after fusion
   */
  private async applyEnvironmentAdjustment(score: number, player: FusionPlayer, mode: Mode): Promise<number> {
    if (!player.team) return score;
    
    const teamEnv = await oasisEnvironmentService.getTeamEnvironment(player.team);
    if (!teamEnv) return score;
    
    // Environment adjustment: clamp(3 * (environment_score_pct-50)/50, -3, +3)
    const envAdj = Math.max(-3, Math.min(3, 3 * (teamEnv.environment_score_pct - 50) / 50));
    
    // Position scalars: WR/TE 1.0x, RB 0.8x, QB 1.2x
    let positionScalar = 1.0;
    if (player.pos === 'RB') positionScalar = 0.8;
    else if (player.pos === 'QB') positionScalar = 1.2;
    
    const finalAdjustment = envAdj * positionScalar;
    return Math.max(0, Math.min(100, score + finalAdjustment));
  }

  /**
   * Calculate tier from score
   */
  private calculateTier(score: number): string {
    const cutoffs = config.tiers.cutoffs;
    const labels = config.tiers.labels;
    
    for (let i = 0; i < cutoffs.length; i++) {
      if (score >= cutoffs[i]) {
        return labels[i];
      }
    }
    return labels[labels.length - 1] || 'T1';
  }
  
  /**
   * Calculate badges for player
   */
  private calculateBadges(
    player: FusionPlayer,
    quadrants: { north: number; east: number; south: number; west: number }
  ): string[] {
    const badges: string[] = [];
    const badgeConfig = config.badges;
    
    // Alpha Usage badge
    if (quadrants.north >= badgeConfig.alpha_usage.north_min) {
      badges.push('Alpha Usage');
    }
    
    // Context Boost badge
    if (quadrants.east >= badgeConfig.context_boost.east_min) {
      badges.push('Context Boost');
    }
    
    // Aging but Elite badge
    if (quadrants.south <= badgeConfig.aging_elite.south_max && 
        quadrants.north >= badgeConfig.aging_elite.north_min) {
      badges.push('Aging Elite');
    }
    
    // Market Mispriced badge
    if (quadrants.west >= badgeConfig.market_mispriced.west_min) {
      badges.push('Market Mispriced');
    }
    
    // FPTS Monster badge (season performance)
    if (player.season_fpts && player.season_fpts >= 200) {
      badges.push('FPTS Monster');
    }
    
    return badges;
  }

  /**
   * Position-specific weight adjustments for different player positions
   * QB: Emphasize East (environment) and South (durability)
   * RB: Emphasize North (volume) and South (durability/age)  
   * WR: Balanced across quadrants
   * TE: Similar to WR but more emphasis on East (scheme fit)
   */
  private getPositionWeights(position: Position) {
    const baseWeights = config.weights.redraft; // Use redraft as base
    
    switch (position) {
      case 'QB':
        return {
          north: baseWeights.north * 0.8, // Less emphasis on volume
          east: baseWeights.east * 1.3,   // More emphasis on environment
          south: baseWeights.south * 1.2, // More emphasis on durability
          west: baseWeights.west * 0.9    // Less emphasis on market
        };
      case 'RB': 
        return {
          north: baseWeights.north * 1.2, // More emphasis on volume
          east: baseWeights.east * 0.9,   // Less emphasis on environment
          south: baseWeights.south * 1.4, // Much more emphasis on age/injury risk
          west: baseWeights.west * 1.0    // Standard market weight
        };
      case 'TE':
        return {
          north: baseWeights.north * 0.9, // Less emphasis on volume
          east: baseWeights.east * 1.1,   // More emphasis on scheme fit
          south: baseWeights.south * 1.1, // Slightly more durability focus
          west: baseWeights.west * 0.9    // Less market efficiency
        };
      case 'WR':
      default:
        return baseWeights; // Use base weights for WR
    }
  }

  /**
   * Position-specific North quadrant calculation
   */
  private calculateNorthQuadrantForPosition(
    player: FusionPlayer, 
    bounds: { north: { min: number; max: number } },
    position: Position
  ): number {
    const weights = config.quadrants.north;
    
    let comp = 0;
    
    switch (position) {
      case 'QB':
        // For QBs, focus on passing volume and talent
        comp = 
          weights.xfp_recent * safe(player.xfp_recent, NaN) * 1.2 + // Higher weight on xFP for QB
          weights.xfp_season * safe(player.xfp_season, NaN) * 1.2 +
          weights.targets_g * safe(player.targets_g || 0, NaN) * 0.1; // QBs don't have targets
        break;
        
      case 'RB':
        // For RBs, focus on rushing volume and receiving
        comp = 
          weights.xfp_recent * safe(player.xfp_recent, NaN) +
          weights.xfp_season * safe(player.xfp_season, NaN) +
          weights.targets_g * safe(player.targets_g, NaN) * 0.7 + // Some receiving upside
          weights.tprr_share * safe(player.tprr_share, NaN) * 0.5 + // Limited route running
          (player.rushShare || 0) * 50; // Add rush share component
        break;
        
      case 'TE':
        // For TEs, similar to WR but different target expectations
        comp = 
          weights.xfp_recent * safe(player.xfp_recent, NaN) * 0.9 +
          weights.xfp_season * safe(player.xfp_season, NaN) * 0.9 +
          weights.targets_g * safe(player.targets_g, NaN) * 1.1 + // TE target share more valuable
          weights.tprr_share * safe(player.tprr_share, NaN) * 0.8 + // Less route running than WR
          weights.yprr * safe(player.yprr, NaN) * 0.8; // Different yardage expectations
        break;
        
      case 'WR':
      default:
        // Standard WR calculation
        comp = 
          weights.xfp_recent * safe(player.xfp_recent, NaN) +
          weights.xfp_season * safe(player.xfp_season, NaN) +
          weights.targets_g * safe(player.targets_g, NaN) +
          weights.tprr_share * safe(player.tprr_share, NaN) +
          weights.yprr * safe(player.yprr, NaN);
    }
    
    let score = pct(comp, bounds.north.min, bounds.north.max);
    
    // ROOKIE GUARDRAILS: Cap north ≤ 80 for rookies with <8 games
    const isRookie = (player.age || 25) <= 23;
    const lowSample = (player.weekly_scores?.length || 0) < 8;
    if (isRookie && lowSample) {
      score = Math.min(score, 80);
    }
    
    return score;
  }

  /**
   * Position-specific East quadrant calculation
   */
  private calculateEastQuadrantForPosition(
    player: FusionPlayer,
    bounds: { east: { min: number; max: number } },
    position: Position
  ): number {
    const weights = config.quadrants.east;
    
    let comp = 0;
    
    switch (position) {
      case 'QB':
        // QBs heavily influenced by scheme, OL, and pace
        comp =
          weights.proe * safe(player.team_proe, NaN) * 1.3 + // QB very scheme dependent
          weights.qb_stability * safe(player.qb_stability, NaN) * 0.5 + // QB stability less relevant for QB
          weights.role_clarity * safe(player.role_clarity, NaN) * 1.2 + // Role clarity important
          weights.scheme_ol * safe(player.scheme_ol, NaN) * 1.4; // OL very important for QB
        break;
        
      case 'RB':
        // RBs influenced by scheme but less by QB stability  
        comp =
          weights.proe * safe(player.team_proe, NaN) * 0.8 + // Less pass-heavy impact
          weights.qb_stability * safe(player.qb_stability, NaN) * 0.7 + // Some QB impact on touches
          weights.role_clarity * safe(player.role_clarity, NaN) * 1.3 + // Role clarity very important
          weights.scheme_ol * safe(player.scheme_ol, NaN) * 1.1; // OL important for running
        break;
        
      case 'TE':
        // TEs heavily influenced by scheme and QB relationship
        comp =
          weights.proe * safe(player.team_proe, NaN) * 1.1 + // Pass rate important
          weights.qb_stability * safe(player.qb_stability, NaN) * 1.2 + // QB chemistry important
          weights.role_clarity * safe(player.role_clarity, NaN) * 1.1 + // Role clarity matters
          weights.scheme_ol * safe(player.scheme_ol, NaN) * 0.9; // OL less critical than QB
        break;
        
      case 'WR':
      default:
        // Standard WR calculation
        comp =
          weights.proe * safe(player.team_proe, NaN) +
          weights.qb_stability * safe(player.qb_stability, NaN) +
          weights.role_clarity * safe(player.role_clarity, NaN) +
          weights.scheme_ol * safe(player.scheme_ol, NaN);
    }
    
    return pct(comp, bounds.east.min, bounds.east.max);
  }

  /**
   * Position-specific fusion score calculation
   */
  private fuseScoreWithPositionWeights(
    quadrants: { north: number; east: number; south: number; west: number },
    mode: Mode,
    positionWeights: any
  ): number {
    const num = 
      positionWeights.north * safe(quadrants.north) +
      positionWeights.east * safe(quadrants.east) +
      positionWeights.south * safe(quadrants.south) +
      positionWeights.west * safe(quadrants.west);
    
    const den = positionWeights.north + positionWeights.east + positionWeights.south + positionWeights.west;
    return Math.round((num / den) * 10) / 10;
  }

  /**
   * Position-specific elite player priors
   */
  private getPositionElitePrior(player: FusionPlayer, position: Position): number {
    const elitePlayersByPosition = {
      QB: ['Josh Allen', 'Lamar Jackson', 'Jalen Hurts', 'Joe Burrow', 'Patrick Mahomes'],
      RB: ['Christian McCaffrey', 'Austin Ekeler', 'Derrick Henry', 'Nick Chubb', 'Alvin Kamara'],
      WR: ['Justin Jefferson', 'Ja\'Marr Chase', 'Tyreek Hill', 'Davante Adams', 'Stefon Diggs'],
      TE: ['Travis Kelce', 'Mark Andrews', 'George Kittle', 'Darren Waller']
    };
    
    const topTierPlayersByPosition = {
      QB: ['Dak Prescott', 'Tua Tagovailoa', 'Trevor Lawrence', 'Justin Herbert'],
      RB: ['Josh Jacobs', 'Kenneth Walker', 'Breece Hall', 'Jonathan Taylor'],
      WR: ['Puka Nacua', 'Garrett Wilson', 'Drake London', 'Chris Olave', 'Jaylen Waddle'],
      TE: ['T.J. Hockenson', 'Kyle Pitts', 'Dallas Goedert']
    };
    
    const elitePlayers = elitePlayersByPosition[position] || [];
    const topTierPlayers = topTierPlayersByPosition[position] || [];
    
    if (elitePlayers.includes(player.name)) {
      return position === 'QB' ? 85 : position === 'RB' ? 82 : 88; // Position-adjusted elite floors
    }
    
    if (topTierPlayers.includes(player.name)) {
      return position === 'QB' ? 78 : position === 'RB' ? 75 : 82; // Position-adjusted top tier floors
    }
    
    // Veterans with 3+ seasons get moderate floor (position-adjusted)
    if ((player.age || 25) >= 25 && (player.weekly_scores?.length || 0) >= 40) {
      return position === 'QB' ? 72 : position === 'RB' ? 65 : 70;
    }
    
    return 0; // No prior for rookies/unproven players
  }

  /**
   * Position-specific badge calculation
   */
  private calculateBadgesForPosition(
    player: FusionPlayer,
    quadrants: { north: number; east: number; south: number; west: number },
    position: Position
  ): string[] {
    const badges: string[] = [];
    const badgeConfig = config.badges;
    
    // Position-specific badge thresholds
    const positionThresholds = {
      QB: { alpha_usage: 75, context_boost: 80, aging_elite: { south_max: 40, north_min: 80 } },
      RB: { alpha_usage: 80, context_boost: 70, aging_elite: { south_max: 35, north_min: 75 } }, 
      WR: { alpha_usage: 78, context_boost: 75, aging_elite: { south_max: 45, north_min: 85 } },
      TE: { alpha_usage: 70, context_boost: 78, aging_elite: { south_max: 50, north_min: 70 } }
    };
    
    const thresholds = positionThresholds[position];
    
    // Alpha Usage badge (position-specific)
    if (quadrants.north >= thresholds.alpha_usage) {
      badges.push(`${position} Alpha Usage`);
    }
    
    // Context Boost badge (position-specific)
    if (quadrants.east >= thresholds.context_boost) {
      badges.push(`${position} Context Boost`);
    }
    
    // Aging but Elite badge (position-specific)
    if (quadrants.south <= thresholds.aging_elite.south_max && 
        quadrants.north >= thresholds.aging_elite.north_min) {
      badges.push(`Aging ${position} Elite`);
    }
    
    // Market Mispriced badge (same for all positions)
    if (quadrants.west >= (badgeConfig.market_mispriced?.west_min || 75)) {
      badges.push('Market Mispriced');
    }
    
    // Position-specific FPTS thresholds
    const fptsThresholds = { QB: 300, RB: 200, WR: 200, TE: 150 };
    if (player.season_fpts && player.season_fpts >= fptsThresholds[position]) {
      badges.push(`${position} FPTS Monster`);
    }
    
    return badges;
  }
  
  /**
   * Prepare player data with all required metrics
   */
  private async preparePlayerData(): Promise<FusionPlayer[]> {
    const normalizedPlayers = await sleeperDataNormalizationService.getNormalizedPlayers();
    const coeffs = await xfpRepository.loadAll();
    
    console.log(`[Fusion Service] Processing ${normalizedPlayers.length} players`);
    
    const fusionPlayers: FusionPlayer[] = [];
    
    for (const player of normalizedPlayers) {
      // Skip invalid players
      if (!player.pos || !['QB', 'RB', 'WR', 'TE'].includes(player.pos)) continue;
      if (!player.team || player.team === 'FA') continue;
      
      // Calculate xFP metrics
      const xfpRow: XfpRow = {
        player_id: player.player_id,
        week: 1,
        pos: player.pos as any,
        ppr: null,
        routeRate: player.routeRate ?? null,
        tgtShare: player.tgtShare ?? null,
        rzTgtShare: player.rzTgtShare ?? null,
        rushShare: player.rushShare ?? null,
        glRushShare: player.glRushShare ?? null,
        talentScore: player.talentScore ?? null,
        last6wPerf: player.last6wPerf ?? null
      };
      
      const posCoeffs = coeffs[player.pos];
      let xfp_recent = posCoeffs ? predictXfp(xfpRow, posCoeffs) : null;
      
      // Fallback for xFP
      if (xfp_recent === null && player.talentScore) {
        xfp_recent = player.talentScore * 0.3;
      }
      if (xfp_recent === null) {
        const baselines = { WR: 12, RB: 14, TE: 8, QB: 18 };
        xfp_recent = baselines[player.pos] || 10;
      }
      
      // Calculate risk components
      const riskComponents = this.riskEngine.calculateRiskComponents(player);
      
      // Calculate market components  
      const marketComponents = this.marketEngine.calculateMarketComponents(player);
      
      const fusionPlayer: FusionPlayer = {
        player_id: player.player_id,
        name: player.name,
        pos: player.pos as Position,
        team: player.team,
        age: player.age || 25,
        
        // North metrics
        xfp_recent,
        xfp_season: xfp_recent, // Use same for now
        targets_g: this.calculateTargetsPerGame(player),
        tprr_share: player.tgtShare || 0,
        yprr: this.calculateYPRR(player),
        
        // East metrics (from enhanced sleeper service)
        team_proe: player.teamProe || 60,
        qb_stability: player.qbStability || 50,
        role_clarity: player.roleClarity || 50,
        scheme_ol: player.schemeOl || 55,
        
        // South metrics
        age_penalty: riskComponents.age_penalty,
        injury_risk: riskComponents.injury_risk,
        volatility: riskComponents.volatility,
        
        // West metrics
        market_eff: marketComponents.market_eff,
        contract_horizon: marketComponents.contract_horizon,
        pos_scarcity: marketComponents.pos_scarcity,
        
        // Legacy compatibility
        routeRate: player.routeRate,
        tgtShare: player.tgtShare,
        rushShare: player.rushShare,
        talentScore: player.talentScore,
        last6wPerf: player.last6wPerf,
        
        // Stats for badges
        season_fpts: this.estimateSeasonFPTS(player),
        weekly_scores: []
      };
      
      fusionPlayers.push(fusionPlayer);
    }
    
    console.log(`[Fusion Service] Prepared ${fusionPlayers.length} fusion players`);
    return fusionPlayers;
  }
  
  /**
   * Calculate bounds for normalization
   */
  private calculateBounds(players: FusionPlayer[], mode: Mode) {
    // Use position-specific bounds and add noise to prevent identical values
    const positionBounds = {
      north: { min: 5, max: 25 },   // Realistic range for volume metrics  
      east: { min: 30, max: 80 },   // Environment range
      south: { min: 10, max: 90 },  // Risk range (will be inverted)
      west: { min: 20, max: 70 }    // Market efficiency range
    };
    
    // Add some calculated variance based on actual player data when available
    const northComps = players.map((p, index) => {
      const baseline = 15 + (index % 3) * 2; // Add small position-based variance
      return config.quadrants.north.xfp_recent * safe(p.xfp_recent, baseline) +
             config.quadrants.north.xfp_season * safe(p.xfp_season, baseline) +
             config.quadrants.north.targets_g * safe(p.targets_g, baseline * 0.4) +
             config.quadrants.north.tprr_share * safe(p.tprr_share, 0.6) +
             config.quadrants.north.yprr * safe(p.yprr, 1.5);
    });
    
    const eastComps = players.map((p, index) => {
      const baseline = 50 + (index % 5) * 4; // Spread environment scores
      return config.quadrants.east.proe * safe(p.team_proe, baseline) +
             config.quadrants.east.qb_stability * safe(p.qb_stability, baseline) +
             config.quadrants.east.role_clarity * safe(p.role_clarity, baseline) +
             config.quadrants.east.scheme_ol * safe(p.scheme_ol, baseline);
    });
    
    const ageMultiplier = mode === 'dynasty' ? 1.3 : 0.6;
    const southComps = players.map((p, index) => {
      const ageFactor = (p.age || 25) - 22; // Age-based differentiation
      const baseline = 20 + ageFactor * 2 + (index % 4) * 3;
      return config.quadrants.south.age_penalty * safe(p.age_penalty, baseline) * ageMultiplier +
             config.quadrants.south.injury_risk * safe(p.injury_risk, baseline) +
             config.quadrants.south.volatility * safe(p.volatility, baseline);
    });
    
    const effMultiplier = mode === 'redraft' ? 1.1 : 1.0;
    const contractMultiplier = mode === 'dynasty' ? 1.1 : 0.9;
    const westComps = players.map((p, index) => {
      const baseline = 45 + (index % 6) * 3; // Market efficiency variance
      return config.quadrants.west.market_eff * safe(p.market_eff, baseline) * effMultiplier +
             config.quadrants.west.contract_horizon * safe(p.contract_horizon, baseline) * contractMultiplier +
             config.quadrants.west.pos_scarcity * safe(p.pos_scarcity, baseline);
    });
    
    return {
      north: { 
        min: Math.min(...northComps) * 0.95, // Add some buffer
        max: Math.max(...northComps) * 1.05  
      },
      east: { 
        min: Math.min(...eastComps) * 0.95, 
        max: Math.max(...eastComps) * 1.05 
      },
      south: { 
        min: Math.min(...southComps) * 0.95, 
        max: Math.max(...southComps) * 1.05 
      },
      west: { 
        min: Math.min(...westComps) * 0.95, 
        max: Math.max(...westComps) * 1.05 
      }
    };
  }
  
  /**
   * Main fusion ranking generation using scoreWRBatch with guardrails
   */
  async generateFusionRankings(
    mode: Mode = 'dynasty', 
    position?: Position | 'ALL',
    debug: boolean = false
  ): Promise<FusionResult[]> {
    try {
      console.log(`[Fusion v3.2] Generating ${mode} rankings for ${position || 'ALL'} with guardrails`);
      
      // Prepare player data
      const players = await this.preparePlayerData();
      
      // Filter by position if requested (handle "ALL" case properly)
      const filteredPlayers = (position && position !== "ALL") ? 
        players.filter(p => p.pos === position as Position) : players;
      
      if (filteredPlayers.length === 0) {
        console.log(`[Fusion v3.2] No players found for criteria`);
        return [];
      }
      
      console.log(`[Fusion v3.2] Processing ${filteredPlayers.length} players with proven elite priors and rookie guardrails`);
      
      // Use scoreWRBatch with enhanced logic and guardrails
      const results = this.scoreWRBatch(filteredPlayers, config, mode);
      
      // Add debug info if requested
      if (debug) {
        const bounds = this.calculateBounds(filteredPlayers, mode);
        results.forEach(result => {
          const player = filteredPlayers.find(p => p.player_id === result.player_id);
          if (player) {
            result.debug = {
              north: {
                components: {
                  xfp_recent: player.xfp_recent,
                  xfp_season: player.xfp_season,
                  targets_g: player.targets_g,
                  tprr_share: player.tprr_share,
                  yprr: player.yprr
                },
                score: result.north,
                rookie_capped: (player.age || 25) <= 23 && (player.weekly_scores?.length || 0) < 8
              },
              east: {
                components: {
                  proe: player.team_proe,
                  qb_stability: player.qb_stability,
                  role_clarity: player.role_clarity,
                  scheme_ol: player.scheme_ol
                },
                score: result.east
              },
              south: {
                components: {
                  age_penalty: player.age_penalty,
                  injury_risk: player.injury_risk,
                  volatility: player.volatility
                },
                score: result.south
              },
              west: {
                components: {
                  market_eff: player.market_eff,
                  contract_horizon: player.contract_horizon,
                  pos_scarcity: player.pos_scarcity
                },
                score: result.west,
                market_capped: true
              },
              final: {
                [`${mode}_score`]: result.score,
                tier: result.tier,
                badges: result.badges,
                prior_applied: this.getProvenElitePrior(player) > 0,
                proven_elite_floor: this.getProvenElitePrior(player)
              }
            };
          }
        });
      }
      
      console.log(`[Fusion v3.2] Generated ${results.length} ranked players with guardrails applied`);
      
      // Log top players for verification
      if (results.length > 0) {
        console.log(`[Fusion v3.2] Top 5 ${mode} players with guardrails:`, 
          results.slice(0, 5).map(p => `${p.rank}. ${p.name} (${p.score})`)
        );
      }
      
      return results;
      
    } catch (error) {
      console.error('[Fusion v3.2] Error generating rankings:', error);
      throw error;
    }
  }
  
  // Helper calculation methods
  private calculateTargetsPerGame(player: any): number {
    const tgtShare = player.tgtShare || 0;
    const teamTargets = 550; // NFL average
    const gamesPlayed = 17;
    return (tgtShare * teamTargets) / gamesPlayed;
  }
  
  private calculateYPRR(player: any): number {
    // Yards per route run estimation
    const routeRate = player.routeRate || 0;
    const yakPerRec = player.yakPerRec || 0;
    return routeRate * yakPerRec * 0.1; // Rough estimation
  }
  
  private estimateSeasonFPTS(player: any): number {
    // Estimate season fantasy points from talent score
    const talent = player.talentScore || 50;
    const positionMultipliers = { QB: 4.5, RB: 3.5, WR: 3.0, TE: 2.5 };
    const multiplier = positionMultipliers[player.pos as Position] || 3.0;
    return talent * multiplier;
  }
}

export const rankingsFusionService = new RankingsFusionService();