/**
 * Refined NFL Ranking System
 * Removes artificially inflated rankings and ensures accurate fantasy valuations
 * Integrates with bulletproof rankings and Jake Maraia foundation
 */

import { db } from './db';
import { players } from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';
import { getJakeMaraiaDynastyScore, getJakeMaraiaDynastyTier } from './jakeMaraiaRankings';
import { validatePlayerRanking } from './rankingValidation';
import { spawn } from 'child_process';

export interface RefinedPlayerRanking {
  playerId: number;
  playerName: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  
  // Core Fantasy Metrics
  gamesPlayed: number;
  fantasyPointsPPR: number;
  pointsPerGame: number;
  
  // Volume & Opportunity Metrics
  targets?: number;
  carries?: number;
  attempts?: number;
  
  // Efficiency Metrics
  catchRate?: number;
  yardsPerCarry?: number;
  completionPercentage?: number;
  
  // Refined Scoring
  compositeScore: number;
  normalizedScore: number;
  positionRank: number;
  
  // Quality Assessment
  dataQuality: 'High' | 'Medium' | 'Low';
  isInflated: boolean;
  exclusionReasons: string[];
  
  // Dynasty Integration
  dynastyValue: number;
  dynastyTier: string;
  
  lastRefined: Date;
}

export interface RefinementResults {
  success: boolean;
  totalProcessed: number;
  playersRetained: number;
  playersExcluded: number;
  exclusionsByPosition: Record<string, number>;
  topPlayersByPosition: Record<string, RefinedPlayerRanking[]>;
  exclusionLog: Array<{
    playerName: string;
    position: string;
    ppg: number;
    gamesPlayed: number;
    reasons: string[];
  }>;
  errors: string[];
}

class RefinedRankingEngine {
  private readonly POSITION_THRESHOLDS = {
    QB: { minGames: 8, minAttempts: 150, minPPG: 12.0 },
    RB: { minGames: 8, minCarries: 50, minPPG: 8.0 },
    WR: { minGames: 8, minTargets: 40, minPPG: 6.0 },
    TE: { minGames: 8, minTargets: 30, minPPG: 5.0 }
  };

  /**
   * Execute refined rankings analysis using Python NFL data
   */
  async executeRefinedRankings(): Promise<RefinementResults> {
    console.log('🔧 Starting refined NFL rankings analysis...');
    
    const result: RefinementResults = {
      success: false,
      totalProcessed: 0,
      playersRetained: 0,
      playersExcluded: 0,
      exclusionsByPosition: {},
      topPlayersByPosition: {},
      exclusionLog: [],
      errors: []
    };

    try {
      // Execute Python refined rankings script
      const pythonResults = await this.runPythonRefinement();
      
      if (!pythonResults.success) {
        result.errors.push('Python script execution failed');
        return result;
      }

      // Process Python results and integrate with existing system
      const refinementData = await this.processRefinementResults(pythonResults.data);
      
      // Update database with refined rankings
      await this.updateDatabaseWithRefinedRankings(refinementData);
      
      // Generate final results
      Object.assign(result, refinementData);
      result.success = true;
      
      console.log(`✅ Refined rankings complete: ${result.playersRetained} retained, ${result.playersExcluded} excluded`);
      
    } catch (error) {
      console.error('❌ Refined rankings failed:', error);
      result.errors.push(`System error: ${error}`);
    }

    return result;
  }

  /**
   * Execute Python NFL refined rankings script
   */
  private async runPythonRefinement(): Promise<{ success: boolean; data?: any; error?: string }> {
    return new Promise((resolve) => {
      const pythonProcess = spawn('python3', ['./server/nflRefinedRankings.py']);
      
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('NFL Refinement:', data.toString().trim());
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            // Try to parse JSON output from Python script
            const jsonMatch = stdout.match(/\{[\s\S]*\}/);
            const data = jsonMatch ? JSON.parse(jsonMatch[0]) : { rankings: {}, exclusions: [] };
            
            resolve({ success: true, data });
          } catch (error) {
            resolve({ success: false, error: `JSON parse error: ${error}` });
          }
        } else {
          resolve({ success: false, error: stderr || `Process exit code: ${code}` });
        }
      });
      
      // Timeout after 5 minutes
      setTimeout(() => {
        pythonProcess.kill();
        resolve({ success: false, error: 'Python script timeout' });
      }, 300000);
    });
  }

  /**
   * Process Python refinement results and integrate with dynasty system
   */
  private async processRefinementResults(pythonData: any): Promise<Partial<RefinementResults>> {
    console.log('📊 Processing refined ranking results...');
    
    const positions = ['QB', 'RB', 'WR', 'TE'];
    const topPlayersByPosition: Record<string, RefinedPlayerRanking[]> = {};
    const exclusionsByPosition: Record<string, number> = {};
    
    let totalRetained = 0;
    let totalExcluded = 0;
    
    // Process exclusions
    const exclusionLog = (pythonData.exclusions || []).map((exclusion: any) => ({
      playerName: exclusion.player_name,
      position: exclusion.position,
      ppg: exclusion.ppg,
      gamesPlayed: exclusion.games_played,
      reasons: [exclusion.reason]
    }));
    
    // Process rankings by position
    for (const position of positions) {
      const positionRankings = pythonData.rankings?.[position] || [];
      const refinedPlayers: RefinedPlayerRanking[] = [];
      
      for (const playerData of positionRankings) {
        const refinedPlayer = await this.createRefinedPlayerRanking(playerData, position);
        refinedPlayers.push(refinedPlayer);
        totalRetained++;
      }
      
      topPlayersByPosition[position] = refinedPlayers;
      
      // Count exclusions by position
      const positionExclusions = exclusionLog.filter(e => e.position === position).length;
      exclusionsByPosition[position] = positionExclusions;
      totalExcluded += positionExclusions;
    }
    
    return {
      playersRetained: totalRetained,
      playersExcluded: totalExcluded,
      exclusionsByPosition,
      topPlayersByPosition,
      exclusionLog
    };
  }

  /**
   * Create refined player ranking with dynasty integration
   */
  private async createRefinedPlayerRanking(
    playerData: any, 
    position: string
  ): Promise<RefinedPlayerRanking> {
    
    // Get dynasty values from existing system
    const dynastyValue = getJakeMaraiaDynastyScore(playerData.player_name) || 15;
    const dynastyTier = getJakeMaraiaDynastyTier(playerData.player_name) || 'Bench';
    
    // Check for artificial inflation patterns
    const inflationCheck = this.detectArtificialInflation(playerData, position);
    
    return {
      playerId: 0, // Will be mapped from database
      playerName: playerData.player_name,
      position: position as 'QB' | 'RB' | 'WR' | 'TE',
      team: playerData.team,
      
      gamesPlayed: playerData.games_played,
      fantasyPointsPPR: playerData.total_fantasy_points,
      pointsPerGame: playerData.ppg,
      
      targets: playerData.targets,
      carries: playerData.rushing_yards ? Math.floor(playerData.rushing_yards / 4) : undefined,
      attempts: playerData.passing_yards ? Math.floor(playerData.passing_yards / 7) : undefined,
      
      catchRate: playerData.targets > 0 ? (playerData.receptions / playerData.targets) : undefined,
      yardsPerCarry: playerData.carries > 0 ? (playerData.rushing_yards / playerData.carries) : undefined,
      completionPercentage: playerData.attempts > 0 ? (playerData.completions / playerData.attempts) : undefined,
      
      compositeScore: playerData.composite_score || 0,
      normalizedScore: playerData.composite_score || 0,
      positionRank: playerData.rank,
      
      dataQuality: this.assessDataQuality(playerData),
      isInflated: inflationCheck.isInflated,
      exclusionReasons: inflationCheck.reasons,
      
      dynastyValue,
      dynastyTier,
      
      lastRefined: new Date()
    };
  }

  /**
   * Detect artificial inflation in player rankings
   */
  private detectArtificialInflation(playerData: any, position: string): { isInflated: boolean; reasons: string[] } {
    const reasons: string[] = [];
    let isInflated = false;
    
    const thresholds = this.POSITION_THRESHOLDS[position as keyof typeof this.POSITION_THRESHOLDS];
    
    // Check for identical scores (red flag for artificial inflation)
    if (playerData.composite_score === 64.0) {
      reasons.push('Suspicious identical score (64.0)');
      isInflated = true;
    }
    
    // Check PPG vs composite score mismatch
    if (playerData.ppg < thresholds.minPPG && playerData.composite_score > 50) {
      reasons.push(`Low PPG (${playerData.ppg}) with high score (${playerData.composite_score})`);
      isInflated = true;
    }
    
    // Check sample size issues
    if (playerData.games_played < 6 && playerData.composite_score > 60) {
      reasons.push(`Limited sample size (${playerData.games_played} games)`);
      isInflated = true;
    }
    
    // Check efficiency red flags
    if (position === 'WR' || position === 'TE') {
      if (playerData.targets > 0) {
        const catchRate = playerData.receptions / playerData.targets;
        if (catchRate < 0.4 && playerData.composite_score > 40) {
          reasons.push(`Poor catch rate (${(catchRate * 100).toFixed(1)}%)`);
          isInflated = true;
        }
      }
    }
    
    return { isInflated, reasons };
  }

  /**
   * Assess data quality based on available metrics
   */
  private assessDataQuality(playerData: any): 'High' | 'Medium' | 'Low' {
    let qualityScore = 0;
    
    // Games played
    if (playerData.games_played >= 12) qualityScore += 3;
    else if (playerData.games_played >= 8) qualityScore += 2;
    else qualityScore += 1;
    
    // Statistical completeness
    const hasTargets = playerData.targets > 0;
    const hasRushing = playerData.rushing_yards > 0;
    const hasPassing = playerData.passing_yards > 0;
    
    if (hasTargets || hasRushing || hasPassing) qualityScore += 2;
    
    // Consistency
    if (playerData.ppg > 10) qualityScore += 2;
    else if (playerData.ppg > 5) qualityScore += 1;
    
    if (qualityScore >= 6) return 'High';
    if (qualityScore >= 4) return 'Medium';
    return 'Low';
  }

  /**
   * Update database with refined rankings
   */
  private async updateDatabaseWithRefinedRankings(refinementData: Partial<RefinementResults>): Promise<void> {
    console.log('💾 Updating database with refined rankings...');
    
    try {
      // This would update your players table with refined metrics
      // For now, we'll log the intended updates
      
      for (const [position, playerList] of Object.entries(refinementData.topPlayersByPosition || {})) {
        console.log(`📊 ${position}: ${playerList.length} refined players`);
        
        for (const player of playerList.slice(0, 5)) { // Top 5 per position
          console.log(`  ${player.positionRank}. ${player.playerName} - Score: ${player.normalizedScore}`);
        }
      }
      
    } catch (error) {
      console.error('Database update failed:', error);
      throw error;
    }
  }

  /**
   * Get refined rankings for specific position
   */
  async getRefinedRankings(position?: string): Promise<RefinedPlayerRanking[]> {
    try {
      // This would fetch from your refined rankings cache/database
      // For now, return empty array as placeholder
      return [];
    } catch (error) {
      console.error('Failed to get refined rankings:', error);
      return [];
    }
  }

  /**
   * Validate refined ranking system health
   */
  async validateRefinedSystem(): Promise<{
    isHealthy: boolean;
    checks: {
      pythonEnvironment: boolean;
      nflDataAccess: boolean;
      dynastyIntegration: boolean;
      refinementLogic: boolean;
    };
    stats: {
      totalPlayersInSystem: number;
      refinedPlayers: number;
      excludedPlayers: number;
      dataQualityDistribution: Record<string, number>;
    };
    issues: string[];
  }> {
    
    const issues: string[] = [];
    const checks = {
      pythonEnvironment: false,
      nflDataAccess: false,
      dynastyIntegration: false,
      refinementLogic: false
    };
    
    try {
      // Test Python environment
      const pythonTest = await this.runPythonRefinement();
      checks.pythonEnvironment = pythonTest.success;
      if (!pythonTest.success) {
        issues.push('Python NFL data environment not accessible');
      }
      
      // Test dynasty integration
      const joshAllenScore = getJakeMaraiaDynastyScore('Josh Allen');
      checks.dynastyIntegration = joshAllenScore === 98;
      if (!checks.dynastyIntegration) {
        issues.push('Dynasty ranking integration failure');
      }
      
      // Test refinement logic
      const testInflation = this.detectArtificialInflation({
        composite_score: 64.0,
        ppg: 5.2,
        games_played: 4,
        targets: 20,
        receptions: 6
      }, 'WR');
      checks.refinementLogic = testInflation.isInflated;
      
      return {
        isHealthy: Object.values(checks).every(Boolean),
        checks,
        stats: {
          totalPlayersInSystem: 0, // Would fetch from database
          refinedPlayers: 0,
          excludedPlayers: 0,
          dataQualityDistribution: { High: 0, Medium: 0, Low: 0 }
        },
        issues
      };
      
    } catch (error) {
      issues.push(`System validation failed: ${error}`);
      return {
        isHealthy: false,
        checks,
        stats: { totalPlayersInSystem: 0, refinedPlayers: 0, excludedPlayers: 0, dataQualityDistribution: {} },
        issues
      };
    }
  }
}

export const refinedRankingEngine = new RefinedRankingEngine();