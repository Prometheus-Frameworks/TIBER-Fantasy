/**
 * Bulletproof NFL Rankings System
 * Integrates with existing Jake Maraia rankings and ECR validation
 * Adds authentic NFL analytics while maintaining system stability
 */

import { db } from './db';
import { players } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { getJakeMaraiaDynastyScore, getJakeMaraiaDynastyTier } from './jakeMaraiaRankings';
import { validatePlayerRanking } from './rankingValidation';

export interface BulletproofRanking {
  playerId: number;
  playerName: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  
  // Existing Dynasty System (Bulletproof Foundation)
  dynastyValue: number;
  dynastyTier: string;
  dynastyRank: number;
  
  // Enhanced Analytics (Built on Stable Base)
  fantasyPoints2024: number;
  projectedPoints2025: number;
  consistencyScore: number;
  marketValue: number;
  
  // Advanced Metrics (When Available)
  advancedMetrics: {
    // Core metrics available for all players
    targetShare?: number;
    snapShare?: number;
    redZoneUsage?: number;
    
    // Position-specific when available
    yardsPerRouteRun?: number;
    yardsAfterContact?: number;
    completionPercentageOverExpected?: number;
    pressureRate?: number;
  };
  
  // System Confidence
  dataQuality: 'High' | 'Medium' | 'Low';
  confidenceScore: number;
  lastUpdated: Date;
}

class BulletproofRankingsEngine {
  
  /**
   * Generate comprehensive rankings using existing stable system
   * Enhanced with authentic NFL data when available
   */
  async generateBulletproofRankings(): Promise<{
    success: boolean;
    rankings: Record<string, BulletproofRanking[]>;
    stats: {
      totalPlayers: number;
      highQualityData: number;
      jakeMaraiaPlayers: number;
      ecrValidatedPlayers: number;
    };
    errors: string[];
  }> {
    
    console.log('🏈 Generating bulletproof NFL rankings...');
    
    const result = {
      success: false,
      rankings: {} as Record<string, BulletproofRanking[]>,
      stats: {
        totalPlayers: 0,
        highQualityData: 0,
        jakeMaraiaPlayers: 0,
        ecrValidatedPlayers: 0
      },
      errors: [] as string[]
    };
    
    try {
      // Get all players from existing database
      const allPlayers = await db.select().from(players);
      console.log(`📊 Processing ${allPlayers.length} players...`);
      
      const positions = ['QB', 'RB', 'WR', 'TE'];
      
      for (const position of positions) {
        const positionPlayers = allPlayers.filter(p => p.position === position);
        const bulletproofRankings: BulletproofRanking[] = [];
        
        for (const player of positionPlayers) {
          try {
            const ranking = await this.createBulletproofRanking(player);
            bulletproofRankings.push(ranking);
            
            // Track data quality statistics
            result.stats.totalPlayers++;
            if (ranking.dataQuality === 'High') result.stats.highQualityData++;
            if (getJakeMaraiaDynastyScore(player.name)) result.stats.jakeMaraiaPlayers++;
            
          } catch (error) {
            console.error(`Error processing ${player.name}:`, error);
            result.errors.push(`${player.name}: ${error}`);
          }
        }
        
        // Sort by dynasty value (our most trusted metric)
        bulletproofRankings.sort((a, b) => b.dynastyValue - a.dynastyValue);
        
        // Assign dynasty ranks within position
        bulletproofRankings.forEach((player, index) => {
          player.dynastyRank = index + 1;
        });
        
        result.rankings[position] = bulletproofRankings;
        console.log(`✅ ${position}: ${bulletproofRankings.length} players ranked`);
      }
      
      result.stats.ecrValidatedPlayers = result.stats.totalPlayers - result.stats.jakeMaraiaPlayers;
      result.success = true;
      
      console.log(`🎯 Bulletproof rankings complete: ${result.stats.totalPlayers} players`);
      
    } catch (error) {
      console.error('❌ Rankings generation failed:', error);
      result.errors.push(`System error: ${error}`);
    }
    
    return result;
  }
  
  /**
   * Create bulletproof ranking for individual player
   */
  private async createBulletproofRanking(player: any): Promise<BulletproofRanking> {
    
    // Foundation: Jake Maraia rankings (most trusted)
    let dynastyValue = getJakeMaraiaDynastyScore(player.name);
    let dynastyTier = getJakeMaraiaDynastyTier(player.name);
    let dataQuality: 'High' | 'Medium' | 'Low' = 'High';
    
    // Fallback: ECR validation for unranked players
    if (dynastyValue === null) {
      const validation = validatePlayerRanking(player.name, player.position, 0);
      dynastyValue = validation.suggestedScore;
      dynastyTier = validation.suggestedTier;
      dataQuality = 'Medium';
    }
    
    // Enhanced metrics from existing database
    const advancedMetrics = this.extractExistingMetrics(player);
    
    // Calculate confidence based on data completeness
    const confidenceScore = this.calculateConfidenceScore(player, dynastyValue !== null);
    
    // Use conservative market value estimation
    const marketValue = this.estimateMarketValue(dynastyValue, player.position);
    
    return {
      playerId: player.id,
      playerName: player.name,
      position: player.position,
      team: player.team,
      
      dynastyValue: dynastyValue || 15,
      dynastyTier: dynastyTier || 'Bench',
      dynastyRank: 999, // Will be set after sorting
      
      fantasyPoints2024: player.avgPoints || 0,
      projectedPoints2025: player.projectedPoints || 0,
      consistencyScore: player.consistency || 50,
      marketValue,
      
      advancedMetrics,
      
      dataQuality,
      confidenceScore,
      lastUpdated: new Date()
    };
  }
  
  /**
   * Extract existing metrics from database
   */
  private extractExistingMetrics(player: any): any {
    return {
      targetShare: player.targetShare,
      snapShare: player.snapCount ? (player.snapCount / 1000) * 100 : undefined,
      redZoneUsage: player.redZoneTargets,
      yardsPerRouteRun: player.yardsPerRouteRun,
      yardsAfterContact: player.yardsAfterContact,
      // Add more metrics as available in database
    };
  }
  
  /**
   * Calculate confidence score based on available data
   */
  private calculateConfidenceScore(player: any, hasJakeRanking: boolean): number {
    let confidence = 0;
    
    // Base confidence from ranking source
    if (hasJakeRanking) {
      confidence += 50; // High confidence from expert rankings
    } else {
      confidence += 25; // Medium confidence from ECR validation
    }
    
    // Confidence from fantasy production data
    if (player.avgPoints > 0) confidence += 20;
    if (player.consistency > 60) confidence += 10;
    
    // Confidence from advanced metrics
    const metricsCount = [
      player.targetShare,
      player.snapCount,
      player.redZoneTargets,
      player.yardsPerRouteRun
    ].filter(m => m !== null && m !== undefined).length;
    
    confidence += Math.min(metricsCount * 5, 20);
    
    return Math.min(confidence, 100);
  }
  
  /**
   * Estimate market value based on dynasty value and position
   */
  private estimateMarketValue(dynastyValue: number, position: string): number {
    const positionMultipliers = {
      'QB': 1.0,    // Standard baseline
      'RB': 0.9,    // Slightly lower due to shorter careers
      'WR': 1.1,    // Premium for consistent production
      'TE': 0.8     // Lower market value generally
    };
    
    const multiplier = positionMultipliers[position as keyof typeof positionMultipliers] || 1.0;
    return Math.round(dynastyValue * multiplier);
  }
  
  /**
   * Get rankings for specific position
   */
  async getBulletproofRankings(position?: string): Promise<BulletproofRanking[]> {
    try {
      const allPlayers = await db.select().from(players);
      const filteredPlayers = position ? 
        allPlayers.filter(p => p.position === position) : 
        allPlayers;
      
      const rankings: BulletproofRanking[] = [];
      
      for (const player of filteredPlayers) {
        const ranking = await this.createBulletproofRanking(player);
        rankings.push(ranking);
      }
      
      return rankings.sort((a, b) => b.dynastyValue - a.dynastyValue);
      
    } catch (error) {
      console.error('Failed to get bulletproof rankings:', error);
      return [];
    }
  }
  
  /**
   * Validate ranking system integrity
   */
  async validateSystem(): Promise<{
    isHealthy: boolean;
    checks: {
      jakeMaraiaIntegration: boolean;
      ecrValidation: boolean;
      databaseConnectivity: boolean;
      playerDataQuality: boolean;
    };
    stats: {
      totalPlayers: number;
      rankedPlayers: number;
      dataQualityDistribution: Record<string, number>;
    };
    issues: string[];
  }> {
    
    const issues: string[] = [];
    const checks = {
      jakeMaraiaIntegration: false,
      ecrValidation: false,
      databaseConnectivity: false,
      playerDataQuality: false
    };
    
    try {
      // Test database connectivity
      const allPlayers = await db.select().from(players);
      checks.databaseConnectivity = true;
      
      // Test Jake Maraia integration
      const joshAllenScore = getJakeMaraiaDynastyScore('Josh Allen');
      checks.jakeMaraiaIntegration = joshAllenScore === 98;
      if (!checks.jakeMaraiaIntegration) {
        issues.push('Jake Maraia integration failure');
      }
      
      // Test ECR validation
      const validation = validatePlayerRanking('Unknown Player', 'QB', 0);
      checks.ecrValidation = validation.suggestedScore <= 30;
      if (!checks.ecrValidation) {
        issues.push('ECR validation not working properly');
      }
      
      // Check data quality
      const qualityDistribution = { High: 0, Medium: 0, Low: 0 };
      let rankedPlayers = 0;
      
      for (const player of allPlayers.slice(0, 50)) { // Sample check
        const ranking = await this.createBulletproofRanking(player);
        qualityDistribution[ranking.dataQuality]++;
        if (ranking.dynastyValue > 15) rankedPlayers++;
      }
      
      checks.playerDataQuality = qualityDistribution.High > 0;
      if (!checks.playerDataQuality) {
        issues.push('No high-quality player data found');
      }
      
      return {
        isHealthy: Object.values(checks).every(Boolean),
        checks,
        stats: {
          totalPlayers: allPlayers.length,
          rankedPlayers,
          dataQualityDistribution: qualityDistribution
        },
        issues
      };
      
    } catch (error) {
      issues.push(`System validation failed: ${error}`);
      return {
        isHealthy: false,
        checks,
        stats: { totalPlayers: 0, rankedPlayers: 0, dataQualityDistribution: {} },
        issues
      };
    }
  }
}

export const bulletproofRankings = new BulletproofRankingsEngine();