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
   * Gather input data from all rating sources (using mock data for demo)
   */
  private async gatherInputData(input: OVRInput, format: Format) {
    const inputData: any = {};
    
    // Generate realistic mock scores based on player name/position for demonstration
    const mockData = this.generateMockPlayerData(input, format);
    
    inputData.fusion_score = mockData.fusion_score;
    inputData.ratings_engine_score = mockData.ratings_engine_score;
    inputData.compass_score = mockData.compass_score;
    inputData.oasis_environment_score = mockData.oasis_environment_score;
    
    if (format === 'dynasty') {
      inputData.age_value_score = mockData.age_value_score;
    }
    
    console.log(`[OVR] Generated mock data for ${input.name}: Fusion=${mockData.fusion_score}, Ratings=${mockData.ratings_engine_score}, Compass=${mockData.compass_score}, OASIS=${mockData.oasis_environment_score}`);
    
    return inputData;
  }
  
  /**
   * Generate realistic mock data for demonstration
   */
  private generateMockPlayerData(input: OVRInput, format: Format) {
    // Elite players (deterministic based on name for consistency)
    const elitePlayers = ['Josh Allen', 'Lamar Jackson', 'Christian McCaffrey', 'Saquon Barkley', 'Tyreek Hill', 'Travis Kelce'];
    const isElite = elitePlayers.some(name => input.name.includes(name));
    
    // Generate base scores with position-specific adjustments
    let baseScore = 50;
    
    if (isElite) {
      baseScore = 85 + Math.random() * 10; // 85-95 for elite players
    } else {
      baseScore = 60 + Math.random() * 25; // 60-85 for other players
    }
    
    // Position-specific variance
    const positionAdjustments = {
      'QB': { fusion: 5, ratings: 8, compass: -2, oasis: 3 },
      'RB': { fusion: -3, ratings: 5, compass: 7, oasis: -1 },
      'WR': { fusion: 8, ratings: -2, compass: 5, oasis: 2 },
      'TE': { fusion: 2, ratings: 3, compass: -1, oasis: 4 }
    };
    
    const adj = positionAdjustments[input.position];
    
    // Team environment boost for top teams
    const topTeams = ['KC', 'BUF', 'SF', 'PHI', 'BAL', 'DET'];
    const teamBoost = topTeams.includes(input.team) ? 5 : 0;
    
    return {
      fusion_score: Math.max(30, Math.min(95, baseScore + adj.fusion + teamBoost + (Math.random() - 0.5) * 10)),
      ratings_engine_score: Math.max(25, Math.min(100, baseScore + adj.ratings + teamBoost + (Math.random() - 0.5) * 8)),
      compass_score: Math.max(35, Math.min(90, baseScore + adj.compass + teamBoost + (Math.random() - 0.5) * 12)),
      oasis_environment_score: Math.max(40, Math.min(85, baseScore + adj.oasis + teamBoost + (Math.random() - 0.5) * 6)),
      age_value_score: format === 'dynasty' ? Math.max(20, Math.min(95, 100 - (input.age || 25) * 2.5 + (Math.random() - 0.5) * 10)) : undefined
    };
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