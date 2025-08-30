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
    north: { components: any; score: number };
    east: { components: any; score: number };
    south: { components: any; score: number };
    west: { components: any; score: number };
    final: { dynasty_score?: number; redraft_score?: number; tier: string; badges: string[] };
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
   * Calculate North quadrant (Volume/Talent) - xFP-centric approach
   */
  private calculateNorthQuadrant(
    player: FusionPlayer, 
    bounds: { north: { min: number; max: number } }
  ): number {
    const weights = config.quadrants.north;
    
    const comp = 
      weights.xfp_recent * safe(player.xfp_recent, NaN) +
      weights.xfp_season * safe(player.xfp_season, NaN) +
      weights.targets_g * safe(player.targets_g, NaN) +
      weights.tprr_share * safe(player.tprr_share, NaN) +
      weights.yprr * safe(player.yprr, NaN);
    
    return pct(comp, bounds.north.min, bounds.north.max);
  }
  
  /**
   * Calculate East quadrant (Environment/Scheme)
   */
  private calculateEastQuadrant(
    player: FusionPlayer,
    bounds: { east: { min: number; max: number } }
  ): number {
    const weights = config.quadrants.east;
    
    const comp =
      weights.proe * safe(player.team_proe, NaN) +
      weights.qb_stability * safe(player.qb_stability, NaN) +
      weights.role_clarity * safe(player.role_clarity, NaN) +
      weights.scheme_ol * safe(player.scheme_ol, NaN);
    
    return pct(comp, bounds.east.min, bounds.east.max);
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
   * Calculate West quadrant (Market/Value)
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
    
    return pct(comp, bounds.west.min, bounds.west.max);
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
    const northComps = players.map(p => 
      config.quadrants.north.xfp_recent * safe(p.xfp_recent, NaN) +
      config.quadrants.north.xfp_season * safe(p.xfp_season, NaN) +
      config.quadrants.north.targets_g * safe(p.targets_g, NaN) +
      config.quadrants.north.tprr_share * safe(p.tprr_share, NaN) +
      config.quadrants.north.yprr * safe(p.yprr, NaN)
    ).filter(v => Number.isFinite(v));
    
    const eastComps = players.map(p =>
      config.quadrants.east.proe * safe(p.team_proe, NaN) +
      config.quadrants.east.qb_stability * safe(p.qb_stability, NaN) +
      config.quadrants.east.role_clarity * safe(p.role_clarity, NaN) +
      config.quadrants.east.scheme_ol * safe(p.scheme_ol, NaN)
    ).filter(v => Number.isFinite(v));
    
    const ageMultiplier = mode === 'dynasty' ? 1.3 : 0.6;
    const southComps = players.map(p =>
      config.quadrants.south.age_penalty * safe(p.age_penalty, NaN) * ageMultiplier +
      config.quadrants.south.injury_risk * safe(p.injury_risk, NaN) +
      config.quadrants.south.volatility * safe(p.volatility, NaN)
    ).filter(v => Number.isFinite(v));
    
    const effMultiplier = mode === 'redraft' ? 1.1 : 1.0;
    const contractMultiplier = mode === 'dynasty' ? 1.1 : 0.9;
    const westComps = players.map(p =>
      config.quadrants.west.market_eff * safe(p.market_eff, NaN) * effMultiplier +
      config.quadrants.west.contract_horizon * safe(p.contract_horizon, NaN) * contractMultiplier +
      config.quadrants.west.pos_scarcity * safe(p.pos_scarcity, NaN)
    ).filter(v => Number.isFinite(v));
    
    return {
      north: { 
        min: northComps.length ? Math.min(...northComps) : 0, 
        max: northComps.length ? Math.max(...northComps) : 100 
      },
      east: { 
        min: eastComps.length ? Math.min(...eastComps) : 0, 
        max: eastComps.length ? Math.max(...eastComps) : 100 
      },
      south: { 
        min: southComps.length ? Math.min(...southComps) : 0, 
        max: southComps.length ? Math.max(...southComps) : 100 
      },
      west: { 
        min: westComps.length ? Math.min(...westComps) : 0, 
        max: westComps.length ? Math.max(...westComps) : 100 
      }
    };
  }
  
  /**
   * Main fusion ranking generation
   */
  async generateFusionRankings(
    mode: Mode = 'dynasty', 
    position?: Position,
    debug: boolean = false
  ): Promise<FusionResult[]> {
    try {
      console.log(`[Fusion v3.2] Generating ${mode} rankings for ${position || 'ALL'}`);
      
      // Prepare player data
      const players = await this.preparePlayerData();
      
      // Filter by position if requested
      const filteredPlayers = position ? 
        players.filter(p => p.pos === position) : players;
      
      if (filteredPlayers.length === 0) {
        console.log(`[Fusion v3.2] No players found for criteria`);
        return [];
      }
      
      // Calculate normalization bounds
      const bounds = this.calculateBounds(filteredPlayers, mode);
      
      console.log(`[Fusion v3.2] Normalization bounds:`, bounds);
      
      // Calculate quadrant scores for all players
      const results: FusionResult[] = filteredPlayers.map(player => {
        const quadrants = {
          north: this.calculateNorthQuadrant(player, bounds),
          east: this.calculateEastQuadrant(player, bounds),
          south: this.calculateSouthQuadrant(player, bounds, mode),
          west: this.calculateWestQuadrant(player, bounds, mode)
        };
        
        const score = this.fuseScore(quadrants, mode);
        const tier = this.calculateTier(score);
        const badges = this.calculateBadges(player, quadrants);
        
        const result: FusionResult = {
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
          rank: 0, // Will be set after sorting
          badges,
          xfp_recent: player.xfp_recent,
          xfp_season: player.xfp_season,
          season_fpts: player.season_fpts
        };
        
        // Add debug breakdown if requested
        if (debug) {
          result.debug = {
            north: {
              components: {
                xfp_recent: player.xfp_recent,
                xfp_season: player.xfp_season,
                targets_g: player.targets_g,
                tprr_share: player.tprr_share,
                yprr: player.yprr
              },
              score: quadrants.north
            },
            east: {
              components: {
                proe: player.team_proe,
                qb_stability: player.qb_stability,
                role_clarity: player.role_clarity,
                scheme_ol: player.scheme_ol
              },
              score: quadrants.east
            },
            south: {
              components: {
                age_penalty: player.age_penalty,
                injury_risk: player.injury_risk,
                volatility: player.volatility
              },
              score: quadrants.south
            },
            west: {
              components: {
                market_eff: player.market_eff,
                contract_horizon: player.contract_horizon,
                pos_scarcity: player.pos_scarcity
              },
              score: quadrants.west
            },
            final: {
              [`${mode}_score`]: score,
              tier,
              badges
            }
          };
        }
        
        return result;
      });
      
      // Sort by score (NO FPTS OVERRIDE - this was the bug!)
      results.sort((a, b) => b.score - a.score);
      
      // Assign ranks
      results.forEach((result, index) => {
        result.rank = index + 1;
      });
      
      console.log(`[Fusion v3.2] Generated ${results.length} ranked players`);
      
      // Log top players for verification
      if (results.length > 0) {
        console.log(`[Fusion v3.2] Top 5 ${mode} players:`, 
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