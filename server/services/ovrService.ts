/**
 * OVR (Overall Rating) Service - Madden-style 1-99 Player Rating System
 * 
 * Aggregates all player inputs through main rankings engine:
 * - RankingsFusionService (xFP + compass scores)
 * - PlayerCompassService (dynasty/redraft)
 * - RatingsEngineService (talent/opportunity/consistency)
 * - TRACKSTAR Environment data
 * 
 * Produces unified 1-99 ratings with position-specific weighting and confidence handling
 */

import fs from 'fs';
import path from 'path';
import { RankingsFusionService } from './rankingsFusionService';
import { PlayerCompassService } from './playerCompassService';
// REMOVED: ratingsEngineService (DEAD_ORPHAN) - ratings now handled by Role Bank
import { teamEnvironmentService } from './teamEnvironmentService';
import { scoreWeeklyOVR, type GameLogRow, type Position as SleeperPosition } from './sleeperOvrScorer';

// Load OVR configuration
const configPath = path.join(process.cwd(), 'config', 'ovr.v1.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

export type Position = "QB" | "RB" | "WR" | "TE";
export type Format = "dynasty" | "redraft";

export interface OVRInput {
  player_id: string;
  name: string;
  position: Position;
  team: string;
  age?: number;
}

export interface OVRResult {
  player_id: string;
  name: string;
  position: Position;
  team: string;
  format: Format;
  
  // Main rating
  ovr: number; // 1-99 Madden scale
  tier: string; // Elite, Star, Starter, Backup, Bench
  position_rank: number;
  
  // Component breakdown
  inputs: {
    fusion_score?: number; // 0-100
    ratings_engine_score?: number; // 0-100
    compass_score?: number; // 0-100
    oasis_environment_score?: number; // 0-100
    age_value_score?: number; // 0-100 (dynasty only)
  };
  
  // Confidence and weights
  confidence: {
    fusion: number; // 0-1
    ratings_engine: number; // 0-1
    compass: number; // 0-1
    oasis_environment: number; // 0-1
    overall: number; // 0-1
  };
  
  weights: {
    fusion: number;
    ratings_engine: number;
    compass: number;
    oasis_environment: number;
    age_value?: number; // dynasty only
  };
  
  // Metadata
  composite_score: number; // 0-100 before Madden curve
  percentile: number; // 0-100 within position cohort
  last_updated: string;
}

export class OVRService {
  private fusionService = new RankingsFusionService();
  private compassService = new PlayerCompassService();
  // REMOVED: ratingsEngine - ratings consolidated into Role Bank system
  private environmentService = teamEnvironmentService;
  
  private cache = new Map<string, OVRResult>();
  private cacheTimestamp = new Map<string, number>();
  
  /**
   * Calculate OVR rating for a single player
   */
  async calculateOVR(input: OVRInput, format: Format): Promise<OVRResult> {
    const cacheKey = `${input.player_id}-${format}`;
    
    // Check cache
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }
    
    // Gather input data from all sources
    const inputData = await this.gatherInputData(input, format);
    
    // Calculate confidence weights
    const confidence = this.calculateConfidence(inputData);
    
    // Calculate position-specific weights
    const weights = this.calculateWeights(input.position, format, confidence);
    
    // Compute composite score
    const compositeScore = this.calculateCompositeScore(inputData, weights);
    
    let finalOVR: number;
    let percentile: number;
    
    // SLEEPER-ONLY MODE: Use direct OVR, skip Madden curve
    if (inputData.sleeper_only && inputData.sleeper_ovr !== undefined) {
      finalOVR = Math.max(1, Math.min(99, Math.round(compositeScore))); // Direct OVR
      percentile = (finalOVR / 99) * 100; // Approximate percentile for display
      console.log(`[OVR] SLEEPER-ONLY final OVR for ${input.name}: ${finalOVR} (no Madden curve)`);
    } else {
      // Traditional approach: Apply Madden curve mapping
      percentile = await this.calculatePercentile(compositeScore, input.position, format);
      const ovr = this.applyMaddenCurve(percentile);
      finalOVR = this.applyProvenEliteFloor(ovr, input, inputData);
    }
    
    const result: OVRResult = {
      player_id: input.player_id,
      name: input.name,
      position: input.position,
      team: input.team,
      format,
      ovr: finalOVR,
      tier: this.getTier(finalOVR),
      position_rank: 0, // Will be calculated in batch processing
      inputs: {
        fusion_score: inputData.fusion_score,
        ratings_engine_score: inputData.ratings_engine_score,
        compass_score: inputData.compass_score,
        oasis_environment_score: inputData.oasis_environment_score,
        age_value_score: inputData.age_value_score
      },
      confidence: {
        fusion: confidence.fusion,
        ratings_engine: confidence.ratings_engine,
        compass: confidence.compass,
        oasis_environment: confidence.oasis_environment,
        overall: confidence.overall
      },
      weights,
      composite_score: compositeScore,
      percentile,
      last_updated: new Date().toISOString()
    };
    
    // Cache result
    this.cache.set(cacheKey, result);
    this.cacheTimestamp.set(cacheKey, Date.now());
    
    return result;
  }
  
  /**
   * Calculate OVR ratings for multiple players (batch processing)
   */
  async calculateBatchOVR(inputs: OVRInput[], format: Format): Promise<OVRResult[]> {
    const results = await Promise.all(
      inputs.map(input => this.calculateOVR(input, format))
    );
    
    // Calculate position ranks within each position group
    const positionGroups = this.groupByPosition(results);
    
    for (const [position, players] of Object.entries(positionGroups)) {
      players.sort((a, b) => b.ovr - a.ovr);
      players.forEach((player, index) => {
        player.position_rank = index + 1;
      });
    }
    
    return results;
  }
  
  /**
   * Try to use Sleeper-based performance scoring for redraft format
   */
  private async trySleeperRedraftScoring(input: OVRInput): Promise<{score: number, debug: any, sub_scores?: any} | null> {
    try {
      // Map position to Sleeper scorer format
      const sleeperPosition = input.position as SleeperPosition;
      if (!['RB', 'WR', 'TE', 'QB'].includes(sleeperPosition)) {
        return null;
      }

      // Try to get real game log data first
      const realGameLog = await this.getRealSleeperGameLog(input, sleeperPosition);
      
      if (realGameLog) {
        // Validate the data makes sense for reported performance
        this.validateGameLogData(realGameLog, input.name);
        
        const result = scoreWeeklyOVR(realGameLog);
        console.log(`[OVR] Real Sleeper data for ${input.name}:`, {
          fpts: realGameLog.fpts,
          targets: realGameLog.targets,
          rec: realGameLog.rec,
          rec_yd: realGameLog.rec_yd,
          snap_pct: realGameLog.snap_pct,
          ovr: result.ovr
        });
        
        return {
          score: result.ovr,
          debug: result,
          sub_scores: result.subs  // Expose detailed sub-scores
        };
      } else {
        // FAIL FAST: No real data available
        console.warn(`[OVR] No real Sleeper data for ${input.name} - FAILING FAST`);
        throw new Error(`DATA MISSING: No real Sleeper performance data for ${input.name}`);
      }
    } catch (error) {
      console.warn(`[OVR] Failed to get Sleeper performance score for ${input.name}:`, error);
      return null;
    }
  }

  /**
   * Get real Sleeper game log data for a player
   */
  private async getRealSleeperGameLog(input: OVRInput, position: SleeperPosition): Promise<GameLogRow | null> {
    try {
      // First, try to get the player's Sleeper ID if we have our internal mapping
      const sleeperPlayerId = await this.getSleeperPlayerId(input);
      if (!sleeperPlayerId) {
        console.warn(`[OVR] No Sleeper player ID found for ${input.name}`);
        return null;
      }

      // Real Sleeper API: Get weekly stats for a specific player
      const sleeperUrl = `https://api.sleeper.com/stats/nfl/player/${sleeperPlayerId}?season=2025&season_type=regular&grouping=week`;
      
      console.log(`[OVR] Fetching real Sleeper data for ${input.name} (ID: ${sleeperPlayerId})`);
      const response = await fetch(sleeperUrl);
      
      if (!response.ok) {
        console.warn(`[OVR] Sleeper API error for ${input.name}: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      
      // Handle real Sleeper API format: object with week numbers as keys
      if (data && typeof data === 'object' && Object.keys(data).length > 0) {
        console.log(`[OVR] Raw Sleeper response for ${input.name}:`, JSON.stringify(data, null, 2));
        
        // Look for Week 3 data using the week key
        const week3Data = data['3'] || data[3];
        if (week3Data && week3Data.stats) {
          console.log(`[OVR] Found Week 3 data for ${input.name}:`, JSON.stringify(week3Data, null, 2));
          return this.convertSleeperDataToGameLogRow(week3Data, input, position);
        } else {
          console.warn(`[OVR] No Week 3 data found for ${input.name} in Sleeper response`);
          console.log(`[OVR] Available weeks:`, Object.keys(data));
          return null;
        }
      }

      console.warn(`[OVR] Invalid or empty Sleeper response for ${input.name}`);
      return null;
    } catch (error) {
      console.warn(`[OVR] Error getting real Sleeper data for ${input.name}:`, error);
      return null;
    }
  }

  /**
   * Get Sleeper player ID from our internal mapping
   */
  private async getSleeperPlayerId(input: OVRInput): Promise<string | null> {
    try {
      // Try the Sleeper API directly for all players
      const response = await fetch('https://api.sleeper.app/v1/players/nfl');
      const data = await response.json();
      
      if (data && typeof data === 'object') {
        // Search through all players for a name match
        for (const [playerId, playerData] of Object.entries(data)) {
          const player = playerData as any;
          const fullName = `${player.first_name || ''} ${player.last_name || ''}`.trim();
          const searchName = player.search_full_name || fullName;
          
          if (
            fullName.toLowerCase() === input.name.toLowerCase() ||
            searchName.toLowerCase() === input.name.toLowerCase() ||
            player.full_name?.toLowerCase() === input.name.toLowerCase() ||
            playerId === input.player_id
          ) {
            console.log(`[OVR] Found Sleeper player ID for ${input.name}: ${playerId}`);
            return playerId;
          }
        }
      }
      
      console.warn(`[OVR] No Sleeper player ID found for ${input.name}`);
      return null;
    } catch (error) {
      console.warn(`[OVR] Error getting Sleeper player ID for ${input.name}:`, error);
      return null;
    }
  }

  /**
   * Convert Sleeper API response to GameLogRow format
   */
  private convertSleeperDataToGameLogRow(sleeperData: any, input: OVRInput, position: SleeperPosition): GameLogRow | null {
    try {
      // Extract stats from the nested structure
      const stats = sleeperData.stats || sleeperData;
      
      const gameLog: GameLogRow = {
        week: sleeperData.week || 3,
        position,
        fpts: stats.pts_half_ppr || stats.pts_std || 0,
        snap_pct: (stats.off_snp && stats.tm_off_snp) ? (stats.off_snp / stats.tm_off_snp * 100) : 0,
      };

      // Position-specific stats using the stats object
      if (position === 'WR' || position === 'TE') {
        gameLog.targets = stats.rec_tgt || 0;
        gameLog.rec = stats.rec || 0;
        gameLog.rec_yd = stats.rec_yd || 0;
        gameLog.rec_tds = stats.rec_td || 0;
      }

      if (position === 'RB') {
        gameLog.rush_att = stats.rush_att || 0;
        gameLog.rush_yd = stats.rush_yd || 0;
        gameLog.rush_tds = stats.rush_td || 0;
        gameLog.targets = stats.rec_tgt || 0;
        gameLog.rec = stats.rec || 0;
        gameLog.rec_yd = stats.rec_yd || 0;
        gameLog.rec_tds = stats.rec_td || 0;
      }

      if (position === 'QB') {
        gameLog.pass_att = sleeperData.pass_att || 0;
        gameLog.pass_yd = sleeperData.pass_yd || 0;
        gameLog.pass_tds = sleeperData.pass_td || 0;
        gameLog.rush_att = sleeperData.rush_att || 0;
        gameLog.rush_yd = sleeperData.rush_yd || 0;
        gameLog.rush_tds = sleeperData.rush_td || 0;
      }

      console.log(`[OVR] Converted Sleeper data for ${input.name}:`, {
        week: gameLog.week,
        fpts: gameLog.fpts,
        targets: gameLog.targets,
        rec: gameLog.rec,
        snap_pct: gameLog.snap_pct
      });

      return gameLog;
    } catch (error) {
      console.warn(`[OVR] Error converting Sleeper data for ${input.name}:`, error);
      return null;
    }
  }

  /**
   * Validate game log data makes sense for the reported performance level
   */
  private validateGameLogData(gameLog: GameLogRow, playerName: string): void {
    // Sanity gate #1: High performers should have high production scores
    if (gameLog.rank_pos && gameLog.rank_pos <= 6 && gameLog.fpts && gameLog.fpts >= 25) {
      const productionScore = Math.min(99, Math.round((gameLog.fpts / 35) * 99));
      if (productionScore < 80) {
        throw new Error(`Sanity check failed for ${playerName}: Rank ${gameLog.rank_pos} with ${gameLog.fpts} points should have production score >= 80, got ${productionScore}`);
      }
    }

    // Sanity gate #2: Top WRs should have reasonable target volume
    if (gameLog.position === 'WR' && gameLog.rank_pos && gameLog.rank_pos <= 8) {
      const totalVolume = (gameLog.rec || 0) + (gameLog.targets || 0);
      if (totalVolume < 5) {
        throw new Error(`Sanity check failed for ${playerName}: Top 8 WR with only ${totalVolume} targets+receptions is unrealistic`);
      }
    }
  }

  /**
   * Gather input data from all rating sources
   */
  private async gatherInputData(input: OVRInput, format: Format) {
    const inputData: any = {};
    
    // NOTE: ratingsEngine removed - Role Bank system now provides position ratings
    // Legacy ratings_engine_score will be omitted from results
    
    try {
      // For REDRAFT: Use SLEEPER-ONLY performance scoring
      if (format === 'redraft') {
        const sleeperResult = await this.trySleeperRedraftScoring(input);
        if (sleeperResult !== null) {
          // DIRECT COUPLING: OVR = performance_score (no blending)
          inputData.sleeper_only = true;
          inputData.sleeper_ovr = sleeperResult.score;
          inputData.sleeper_debug = sleeperResult.debug;
          inputData.compass_score = sleeperResult.score; // For logging compatibility
          inputData.compass_raw = { 
            score: sleeperResult.score, 
            source: 'sleeper_performance',
            format: 'redraft',
            subs: sleeperResult.debug.subs
          };
          console.log(`[OVR] SLEEPER-ONLY performance for ${input.name}: ${sleeperResult.score}`);
          
          // Skip all other data sources for Sleeper-only mode
          return inputData;
        } else {
          // FAIL FAST: Badge as DATA MISSING
          console.error(`[OVR] DATA MISSING for ${input.name} - no real Sleeper data available`);
          inputData.data_missing = true;
          inputData.compass_score = 1; // Minimum score for missing data
          inputData.compass_raw = { 
            score: 1, 
            source: 'data_missing', 
            format: 'redraft',
            error: 'No real Sleeper performance data available'
          };
          return inputData;
        }
      } else {
        // DYNASTY: Use traditional Compass scoring
        const compassResult = await this.compassService.calculateCompass({
          playerId: input.player_id,
          playerName: input.name,
          position: input.position,
          age: input.age || 25,
          team: input.team
        }, format);
        
        if (compassResult) {
          const maxScale = config.normalization.compass_max_scale;
          const multiplier = config.normalization.compass_multiplier;
          inputData.compass_score = compassResult.score <= maxScale 
            ? compassResult.score * multiplier 
            : Math.min(compassResult.score, 100);
          inputData.compass_raw = compassResult;
        }
      }
    } catch (error) {
      console.warn(`[OVR] Failed to get compass score for ${input.name}:`, error);
    }
    
    try {
      // Get TRACKSTAR environment score
      const oasisData = await this.environmentService.getTeamEnvironment(input.team);
      
      if (oasisData) {
        // Average key TRACKSTAR metrics using correct property names
        const metrics = [
          oasisData.environment_score_pct || 50,
          oasisData.pace_pct || 50,
          oasisData.scoring_environment_pct || 50,
          oasisData.red_zone_efficiency_pct || 50
        ];
        
        inputData.oasis_environment_score = metrics.reduce((sum, val) => sum + val, 0) / metrics.length;
        inputData.oasis_raw = oasisData;
      }
    } catch (error) {
      console.warn(`[OVR] Failed to get TRACKSTAR environment score for ${input.team}:`, error);
    }
    
    try {
      // Get Fusion score using appropriate position-specific method
      const fusionPlayer = {
        player_id: input.player_id,
        name: input.name,
        pos: input.position,
        team: input.team,
        age: input.age || 25
      };

      let fusionResults: any[] = [];
      
      // Call position-specific scoring method
      if (input.position === 'WR') {
        fusionResults = await this.fusionService.scoreWRBatch([fusionPlayer], config, format as any);
      } else {
        // For other positions, use the general scorePositionBatch method with required arguments
        fusionResults = await this.fusionService.scorePositionBatch([fusionPlayer], input.position, config, format as any);
      }
      
      if (fusionResults.length > 0) {
        inputData.fusion_score = fusionResults[0].score;
        inputData.fusion_raw = fusionResults[0];
      }
    } catch (error) {
      console.warn(`[OVR] Failed to get fusion score for ${input.name}:`, error);
    }
    
    // Dynasty age value component
    if (format === 'dynasty' && input.age && inputData.ratings_raw?.age_adjusted_value) {
      inputData.age_value_score = inputData.ratings_raw.age_adjusted_value;
    }
    
    console.log(`[OVR] Gathered real data for ${input.name}: Fusion=${inputData.fusion_score || 'N/A'}, Ratings=${inputData.ratings_engine_score || 'N/A'}, Compass=${inputData.compass_score || 'N/A'}, TRACKSTAR=${inputData.oasis_environment_score || 'N/A'}`);
    
    return inputData;
  }
  
  
  /**
   * Calculate confidence weights for each input source
   */
  private calculateConfidence(inputData: any) {
    const confidence = {
      fusion: 0,
      ratings_engine: 0,
      compass: 0,
      oasis_environment: 0,
      overall: 0
    };
    
    // Fusion confidence
    if (inputData.fusion_score !== undefined) {
      confidence.fusion = config.confidence_parameters.fusion.full_data_threshold;
      
      // Penalize if rookie capped or market capped
      if (inputData.fusion_raw?.debug?.north?.rookie_capped) {
        confidence.fusion -= config.confidence_parameters.fusion.rookie_cap_penalty;
      }
      if (inputData.fusion_raw?.debug?.west?.market_capped) {
        confidence.fusion -= config.confidence_parameters.fusion.market_cap_penalty;
      }
    }
    
    // Ratings Engine confidence
    if (inputData.ratings_engine_score !== undefined) {
      confidence.ratings_engine = config.confidence_parameters.ratings_engine.full_data_threshold;
      
      // Check component coverage
      const components = inputData.ratings_raw?.components || {};
      const componentCount = Object.values(components).filter(val => val != null).length;
      if (componentCount < 4) {
        confidence.ratings_engine *= (componentCount / 4);
      }
    }
    
    // Compass confidence
    if (inputData.compass_score !== undefined) {
      confidence.compass = config.confidence_parameters.compass.full_data_threshold;
    }
    
    // TRACKSTAR confidence (based on data freshness)
    if (inputData.oasis_environment_score !== undefined) {
      const freshHours = config.confidence_parameters.oasis_environment.freshness_hours;
      const now = Date.now();
      const dataAge = now - (inputData.oasis_raw?.last_updated || now);
      const ageHours = dataAge / (1000 * 60 * 60);
      
      confidence.oasis_environment = ageHours <= freshHours 
        ? config.confidence_parameters.oasis_environment.fresh_confidence
        : config.confidence_parameters.oasis_environment.stale_confidence;
    }
    
    // Overall confidence is average of available sources
    const availableConfidences = Object.values(confidence).filter(c => c > 0);
    confidence.overall = availableConfidences.length > 0
      ? availableConfidences.reduce((sum, c) => sum + c, 0) / availableConfidences.length
      : 0;
    
    return confidence;
  }
  
  /**
   * Calculate position and format specific weights
   */
  private calculateWeights(position: Position, format: Format, confidence: any) {
    const baseWeights = config.position_weights[format][position];
    const weights = { ...baseWeights };
    
    // Normalize weights based on confidence
    let totalWeight = 0;
    const confidenceAdjustedWeights: any = {};
    
    for (const [source, weight] of Object.entries(weights)) {
      const conf = confidence[source as keyof typeof confidence] || 0;
      confidenceAdjustedWeights[source] = (weight as number) * conf;
      totalWeight += confidenceAdjustedWeights[source];
    }
    
    // Renormalize to sum to 1
    if (totalWeight > 0) {
      for (const source of Object.keys(confidenceAdjustedWeights)) {
        (weights as any)[source] = confidenceAdjustedWeights[source] / totalWeight;
      }
    }
    
    return weights;
  }
  
  /**
   * Calculate weighted composite score (0-100)
   */
  private calculateCompositeScore(inputData: any, weights: any): number {
    // SLEEPER-ONLY MODE: Skip blending, use direct OVR
    if (inputData.sleeper_only && inputData.sleeper_ovr !== undefined) {
      console.log(`[OVR] SLEEPER-ONLY mode: Using direct OVR ${inputData.sleeper_ovr} (no blending)`);
      return inputData.sleeper_ovr; // Direct 1-99 score, no normalization needed
    }

    // DATA MISSING: Return minimum score
    if (inputData.data_missing) {
      console.log(`[OVR] DATA MISSING mode: Using minimum score 1`);
      return 1;
    }

    // Traditional blended approach for dynasty or fallback cases
    let score = 0;
    let totalWeight = 0;
    
    // Add each weighted component
    if (inputData.fusion_score !== undefined && weights.fusion > 0) {
      score += inputData.fusion_score * weights.fusion;
      totalWeight += weights.fusion;
    }
    
    if (inputData.ratings_engine_score !== undefined && weights.ratings_engine > 0) {
      score += inputData.ratings_engine_score * weights.ratings_engine;
      totalWeight += weights.ratings_engine;
    }
    
    if (inputData.compass_score !== undefined && weights.compass > 0) {
      score += inputData.compass_score * weights.compass;
      totalWeight += weights.compass;
    }
    
    if (inputData.oasis_environment_score !== undefined && weights.oasis_environment > 0) {
      score += inputData.oasis_environment_score * weights.oasis_environment;
      totalWeight += weights.oasis_environment;
    }
    
    if (inputData.age_value_score !== undefined && weights.age_value > 0) {
      score += inputData.age_value_score * weights.age_value;
      totalWeight += weights.age_value;
    }
    
    return totalWeight > 0 ? score / totalWeight : 50; // Default to 50 if no data
  }
  
  /**
   * Calculate percentile within position cohort
   */
  private async calculatePercentile(score: number, position: Position, format: Format): Promise<number> {
    // For now, simulate percentile calculation
    // In production, this would query actual player distribution
    
    // Simple simulation: assume normal distribution around 50
    const standardized = (score - 50) / 20; // Assume std dev of 20
    const percentile = this.normalCDF(standardized) * 100;
    
    return Math.max(0, Math.min(100, percentile));
  }
  
  /**
   * Apply Madden curve to convert percentile to 1-99 scale
   */
  private applyMaddenCurve(percentile: number): number {
    const P = percentile / 100; // Convert to 0-1
    
    // Apply non-linear Madden curve: OVR = 1 + 98 * (0.75*P + 0.25*(3*P^2 - 2*P^3))
    const curved = 0.75 * P + 0.25 * (3 * P * P - 2 * P * P * P);
    const ovr = Math.round(1 + 98 * curved);
    
    return Math.max(1, Math.min(99, ovr));
  }
  
  /**
   * Apply proven elite floor if applicable
   */
  private applyProvenEliteFloor(ovr: number, input: OVRInput, inputData: any): number {
    const floors = config.proven_elite_floors[input.position];
    
    // Check if player qualifies for elite floor (high fusion score + high season performance)
    if (inputData.fusion_score >= 90 && inputData.ratings_engine_score >= 85) {
      return Math.max(ovr, floors.elite_floor);
    }
    
    // Check if player qualifies for proven floor (consistent high performance)
    if (inputData.fusion_score >= 80 && inputData.ratings_engine_score >= 75) {
      return Math.max(ovr, floors.proven_floor);
    }
    
    return ovr;
  }
  
  /**
   * Get tier based on OVR rating
   */
  private getTier(ovr: number): string {
    const thresholds = config.madden_curve.target_distribution;
    
    if (ovr >= thresholds.elite_threshold) return "Elite";
    if (ovr >= thresholds.star_threshold) return "Star";
    if (ovr >= thresholds.starter_threshold) return "Starter";
    if (ovr >= thresholds.backup_threshold) return "Backup";
    return "Bench";
  }
  
  /**
   * Group results by position
   */
  private groupByPosition(results: OVRResult[]): { [key: string]: OVRResult[] } {
    return results.reduce((groups, result) => {
      const position = result.position;
      if (!groups[position]) groups[position] = [];
      groups[position].push(result);
      return groups;
    }, {} as { [key: string]: OVRResult[] });
  }
  
  /**
   * Check if cache entry is valid
   */
  private isCacheValid(cacheKey: string): boolean {
    if (!this.cache.has(cacheKey) || !this.cacheTimestamp.has(cacheKey)) {
      return false;
    }
    
    const cacheAge = Date.now() - this.cacheTimestamp.get(cacheKey)!;
    const ttlMs = config.cache_settings.ttl_minutes * 60 * 1000;
    
    return cacheAge < ttlMs;
  }
  
  /**
   * Clear cache (for invalidation)
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheTimestamp.clear();
  }
  
  /**
   * Normal CDF approximation for percentile calculation
   */
  private normalCDF(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }
  
  /**
   * Error function approximation
   */
  private erf(x: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    
    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    
    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    
    return sign * y;
  }
}

// Export singleton instance
export const ovrService = new OVRService();