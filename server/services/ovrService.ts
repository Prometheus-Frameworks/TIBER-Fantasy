/**
 * OVR (Overall Rating) Service - Madden-style 1-99 Player Rating System
 * 
 * Aggregates all player inputs through main rankings engine:
 * - RankingsFusionService (xFP + compass scores)
 * - PlayerCompassService (dynasty/redraft)
 * - RatingsEngineService (talent/opportunity/consistency)
 * - OASIS Environment data
 * 
 * Produces unified 1-99 ratings with position-specific weighting and confidence handling
 */

import fs from 'fs';
import path from 'path';
import { RankingsFusionService } from './rankingsFusionService';
import { PlayerCompassService } from './playerCompassService';
import { ratingsEngineService } from './ratingsEngineService';
import { oasisEnvironmentService } from './oasisEnvironmentService';
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
  private ratingsEngine = ratingsEngineService;
  private oasisService = oasisEnvironmentService;
  
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
    
    // Apply Madden curve mapping
    const percentile = await this.calculatePercentile(compositeScore, input.position, format);
    const ovr = this.applyMaddenCurve(percentile);
    
    // Apply proven elite floor if applicable
    const finalOVR = this.applyProvenEliteFloor(ovr, input, inputData);
    
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
  private async trySleeperRedraftScoring(input: OVRInput): Promise<number | null> {
    try {
      // Map position to Sleeper scorer format
      const sleeperPosition = input.position as SleeperPosition;
      if (!['RB', 'WR', 'TE', 'QB'].includes(sleeperPosition)) {
        return null;
      }

      // For now, generate a mock game log row based on player context
      // TODO: Replace with real Sleeper game log data when available
      const mockGameLog = this.generateMockGameLogFromContext(input, sleeperPosition);
      
      if (mockGameLog) {
        const result = scoreWeeklyOVR(mockGameLog);
        return result.ovr;
      }
      
      return null;
    } catch (error) {
      console.warn(`[OVR] Failed to get Sleeper performance score for ${input.name}:`, error);
      return null;
    }
  }

  /**
   * Generate mock game log based on player context (temporary until real data integration)
   */
  private generateMockGameLogFromContext(input: OVRInput, position: SleeperPosition): GameLogRow | null {
    // Use team and position context to generate realistic performance estimates
    const eliteTeams = ['KC', 'BUF', 'MIA', 'CIN', 'DAL', 'SF', 'LAR', 'DET'];
    const goodTeams = ['PHI', 'BAL', 'GB', 'TB', 'MIN', 'SEA'];
    const isElite = eliteTeams.includes(input.team);
    const isGood = goodTeams.includes(input.team);
    
    const gameLog: GameLogRow = {
      week: 3,
      position,
      fpts: 0,
      snap_pct: 0,
    };

    if (position === 'WR') {
      // WR performance based on team context
      if (isElite) {
        gameLog.fpts = 12 + Math.random() * 8; // 12-20 points
        gameLog.targets = 6 + Math.random() * 6; // 6-12 targets
        gameLog.rec = Math.floor((gameLog.targets || 8) * 0.7); // ~70% catch rate
        gameLog.rec_yd = 60 + Math.random() * 40; // 60-100 yards
        gameLog.snap_pct = 75 + Math.random() * 20; // 75-95%
      } else if (isGood) {
        gameLog.fpts = 8 + Math.random() * 6; // 8-14 points
        gameLog.targets = 4 + Math.random() * 4; // 4-8 targets
        gameLog.rec = Math.floor((gameLog.targets || 6) * 0.65); // ~65% catch rate
        gameLog.rec_yd = 40 + Math.random() * 30; // 40-70 yards
        gameLog.snap_pct = 60 + Math.random() * 25; // 60-85%
      } else {
        gameLog.fpts = 4 + Math.random() * 6; // 4-10 points
        gameLog.targets = 2 + Math.random() * 4; // 2-6 targets
        gameLog.rec = Math.floor((gameLog.targets || 4) * 0.6); // ~60% catch rate
        gameLog.rec_yd = 20 + Math.random() * 30; // 20-50 yards
        gameLog.snap_pct = 45 + Math.random() * 30; // 45-75%
      }
      gameLog.rec_tds = Math.random() < 0.15 ? 1 : 0; // 15% chance of TD
    } else if (position === 'RB') {
      if (isElite) {
        gameLog.fpts = 10 + Math.random() * 8; // 10-18 points
        gameLog.rush_att = 12 + Math.random() * 8; // 12-20 carries
        gameLog.rush_yd = 50 + Math.random() * 40; // 50-90 yards
        gameLog.targets = 2 + Math.random() * 3; // 2-5 targets
        gameLog.rec = Math.floor((gameLog.targets || 3) * 0.8); // 80% catch rate
        gameLog.snap_pct = 65 + Math.random() * 25; // 65-90%
      } else {
        gameLog.fpts = 6 + Math.random() * 6; // 6-12 points
        gameLog.rush_att = 8 + Math.random() * 6; // 8-14 carries
        gameLog.rush_yd = 30 + Math.random() * 30; // 30-60 yards
        gameLog.targets = 1 + Math.random() * 2; // 1-3 targets
        gameLog.rec = Math.floor((gameLog.targets || 2) * 0.75); // 75% catch rate
        gameLog.snap_pct = 40 + Math.random() * 30; // 40-70%
      }
      gameLog.rush_tds = Math.random() < 0.12 ? 1 : 0; // 12% chance of TD
    }

    return gameLog;
  }

  /**
   * Gather input data from all rating sources
   */
  private async gatherInputData(input: OVRInput, format: Format) {
    const inputData: any = {};
    
    try {
      // Get Ratings Engine score from existing data
      const allRatings = await this.ratingsEngine.getAllRatings();
      const ratingsResult = allRatings.find(r => 
        r.player_id === input.player_id || 
        r.player_name.toLowerCase() === input.name.toLowerCase()
      );
      
      if (ratingsResult) {
        inputData.ratings_engine_score = ratingsResult.overall_rating;
        inputData.ratings_raw = ratingsResult;
      }
    } catch (error) {
      console.warn(`[OVR] Failed to get ratings engine score for ${input.name}:`, error);
    }
    
    try {
      // For REDRAFT: Try Sleeper-based scoring first, fallback to Compass
      if (format === 'redraft') {
        const sleeperScore = await this.trySleeperRedraftScoring(input);
        if (sleeperScore !== null) {
          // Convert Sleeper 1-99 OVR to 0-100 scale for consistency
          inputData.compass_score = Math.min(sleeperScore, 100);
          inputData.compass_raw = { 
            score: sleeperScore, 
            source: 'sleeper_performance', 
            format: 'redraft' 
          };
          console.log(`[OVR] Using Sleeper performance score for ${input.name}: ${sleeperScore}`);
        } else {
          // Fallback to theoretical Compass scoring
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
      // Get OASIS environment score
      const oasisData = await this.oasisService.getTeamEnvironment(input.team);
      
      if (oasisData) {
        // Average key OASIS metrics using correct property names
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
      console.warn(`[OVR] Failed to get OASIS environment score for ${input.team}:`, error);
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
    
    console.log(`[OVR] Gathered real data for ${input.name}: Fusion=${inputData.fusion_score || 'N/A'}, Ratings=${inputData.ratings_engine_score || 'N/A'}, Compass=${inputData.compass_score || 'N/A'}, OASIS=${inputData.oasis_environment_score || 'N/A'}`);
    
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
    
    // OASIS confidence (based on data freshness)
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