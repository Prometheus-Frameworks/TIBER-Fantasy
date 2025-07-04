/**
 * Advanced NFL Offensive Rankings System
 * Integrates with existing Jake Maraia rankings and ECR validation
 * Uses authentic NFL data APIs for bulletproof dynasty valuations
 */

import { spawn } from 'child_process';
import { db } from './db';
import { players } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { getJakeMaraiaDynastyScore, getJakeMaraiaDynastyTier } from './jakeMaraiaRankings';
import { validatePlayerRanking } from './rankingValidation';

export interface AdvancedPlayerMetrics {
  playerId: string;
  playerName: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  
  // Core Performance
  fantasyPointsPPR: number;
  gamesPlayed: number;
  pointsPerGame: number;
  
  // Position-Specific Advanced Metrics
  advancedMetrics: {
    // QB Metrics
    epaPerPlay?: number;
    completionPercentageAboveExpected?: number;
    timeToThrow?: number;
    yardsPerAttempt?: number;
    
    // RB Metrics
    yardsAfterContact?: number;
    averageTimeToLOS?: number;
    yardsPerCarry?: number;
    receivingYPRR?: number;
    
    // WR/TE Metrics
    yardsPerRoute?: number;
    targetShare?: number;
    airYardsShare?: number;
    separation?: number;
    catchRateAboveExpected?: number;
  };
  
  // Composite Scoring
  advancedRank: number;
  compositeScore: number;
  
  // Dynasty Integration
  dynastyValue: number;
  dynastyTier: string;
  confidenceScore: number; // How much data supports the ranking
}

export interface RankingUpdate {
  playerId: number;
  advancedRank: number;
  compositeScore: number;
  advancedMetrics: any;
  confidenceScore: number;
  lastUpdated: Date;
}

class AdvancedNFLRankingsEngine {
  private pythonScriptPath = './server/nflOffenseRankings.py';
  
  /**
   * Execute Python ranking script and integrate with existing system
   */
  async generateAdvancedRankings(): Promise<{
    success: boolean;
    rankings: Record<string, AdvancedPlayerMetrics[]>;
    updatedPlayers: number;
    errors: string[];
  }> {
    const result = {
      success: false,
      rankings: {} as Record<string, AdvancedPlayerMetrics[]>,
      updatedPlayers: 0,
      errors: [] as string[]
    };
    
    try {
      console.log('🏈 Starting advanced NFL rankings generation...');
      
      // Execute Python script
      const pythonResults = await this.executePythonRankings();
      
      if (!pythonResults.success) {
        result.errors.push('Python ranking script failed');
        return result;
      }
      
      // Process results and integrate with existing system
      const processedRankings = await this.processRankingResults(pythonResults.data);
      
      // Update database with new rankings
      const updateCount = await this.updatePlayerRankings(processedRankings);
      
      result.success = true;
      result.rankings = processedRankings;
      result.updatedPlayers = updateCount;
      
      console.log(`✅ Advanced rankings generated: ${updateCount} players updated`);
      
    } catch (error) {
      console.error('❌ Advanced rankings generation failed:', error);
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }
    
    return result;
  }
  
  /**
   * Execute Python NFL data analysis script
   */
  private async executePythonRankings(): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    return new Promise((resolve) => {
      console.log('📊 Fetching NFL data from nflverse...');
      
      const pythonProcess = spawn('python3', [this.pythonScriptPath]);
      let stdout = '';
      let stderr = '';
      
      pythonProcess.stdout.on('data', (data) => {
        stdout += data.toString();
        console.log('Python:', data.toString().trim());
      });
      
      pythonProcess.stderr.on('data', (data) => {
        stderr += data.toString();
        console.error('Python Error:', data.toString().trim());
      });
      
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            // Look for JSON output in stdout
            const jsonMatch = stdout.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const data = JSON.parse(jsonMatch[0]);
              resolve({ success: true, data });
            } else {
              resolve({ success: false, error: 'No JSON output found' });
            }
          } catch (error) {
            resolve({ success: false, error: 'Failed to parse JSON output' });
          }
        } else {
          resolve({ success: false, error: `Python script exited with code ${code}: ${stderr}` });
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
   * Process Python ranking results and integrate with dynasty system
   */
  private async processRankingResults(pythonData: any): Promise<Record<string, AdvancedPlayerMetrics[]>> {
    const processedRankings: Record<string, AdvancedPlayerMetrics[]> = {};
    
    for (const position of ['QB', 'RB', 'WR', 'TE']) {
      const positionData = pythonData[position] || [];
      const processedPlayers: AdvancedPlayerMetrics[] = [];
      
      for (const playerData of positionData) {
        try {
          // Get existing dynasty values
          const jakeScore = getJakeMaraiaDynastyScore(playerData.player_name);
          const jakeTier = getJakeMaraiaDynastyTier(playerData.player_name);
          
          // If not in Jake's rankings, use ECR validation
          let dynastyValue = jakeScore;
          let dynastyTier = jakeTier;
          
          if (jakeScore === null) {
            const validation = validatePlayerRanking(playerData.player_name, position, 0);
            dynastyValue = validation.suggestedScore;
            dynastyTier = validation.suggestedTier;
          }
          
          // Calculate confidence based on data availability
          const confidenceScore = this.calculateConfidenceScore(playerData);
          
          const processedPlayer: AdvancedPlayerMetrics = {
            playerId: playerData.player_id || `${playerData.player_name}_${playerData.team}`,
            playerName: playerData.player_name,
            position: position as 'QB' | 'RB' | 'WR' | 'TE',
            team: playerData.team,
            
            fantasyPointsPPR: playerData.fantasy_points_ppr || 0,
            gamesPlayed: playerData.games_played || 0,
            pointsPerGame: playerData.games_played ? 
              (playerData.fantasy_points_ppr / playerData.games_played) : 0,
            
            advancedMetrics: this.extractAdvancedMetrics(playerData, position),
            
            advancedRank: playerData.rank || 999,
            compositeScore: playerData.composite_score || 0,
            
            dynastyValue: dynastyValue || 15,
            dynastyTier: dynastyTier || 'Bench',
            confidenceScore
          };
          
          processedPlayers.push(processedPlayer);
          
        } catch (error) {
          console.error(`Error processing player ${playerData.player_name}:`, error);
        }
      }
      
      processedRankings[position] = processedPlayers.sort((a, b) => a.advancedRank - b.advancedRank);
    }
    
    return processedRankings;
  }
  
  /**
   * Extract position-specific advanced metrics
   */
  private extractAdvancedMetrics(playerData: any, position: string): any {
    const metrics: any = {};
    
    switch (position) {
      case 'QB':
        metrics.completionPercentageAboveExpected = playerData.completion_percentage_above_expectation;
        metrics.timeToThrow = playerData.avg_time_to_throw;
        metrics.yardsPerAttempt = playerData.yards_per_attempt;
        break;
        
      case 'RB':
        metrics.yardsAfterContact = playerData.avg_yards_after_contact;
        metrics.averageTimeToLOS = playerData.avg_time_to_los;
        metrics.yardsPerCarry = playerData.yards_per_carry;
        break;
        
      case 'WR':
      case 'TE':
        metrics.separation = playerData.avg_separation;
        metrics.catchRateAboveExpected = playerData.catch_percentage_above_expectation;
        metrics.targetShare = playerData.targets / playerData.games_played;
        break;
    }
    
    return metrics;
  }
  
  /**
   * Calculate confidence score based on data completeness
   */
  private calculateConfidenceScore(playerData: any): number {
    let confidence = 0;
    
    // Base confidence from games played
    const gamesPlayed = playerData.games_played || 0;
    confidence += Math.min(gamesPlayed * 5, 40); // Max 40 points for 8+ games
    
    // Confidence from statistical significance
    const attempts = playerData.attempts || playerData.carries || playerData.targets || 0;
    confidence += Math.min(attempts / 10, 30); // Max 30 points for high usage
    
    // Confidence from advanced metrics availability
    const advancedMetricsCount = Object.values(playerData).filter(v => 
      v !== null && v !== undefined && !isNaN(Number(v))
    ).length;
    confidence += Math.min(advancedMetricsCount * 2, 30); // Max 30 points for rich data
    
    return Math.min(confidence, 100);
  }
  
  /**
   * Update database with new rankings
   */
  private async updatePlayerRankings(rankings: Record<string, AdvancedPlayerMetrics[]>): Promise<number> {
    let updateCount = 0;
    
    try {
      for (const position of Object.keys(rankings)) {
        const positionPlayers = rankings[position];
        
        for (const player of positionPlayers) {
          // Find player in database
          const existingPlayers = await db
            .select()
            .from(players)
            .where(
              and(
                eq(players.name, player.playerName),
                eq(players.position, player.position)
              )
            );
          
          if (existingPlayers.length > 0) {
            const existingPlayer = existingPlayers[0];
            
            // Update with advanced rankings
            await db
              .update(players)
              .set({
                advancedRank: player.advancedRank,
                compositeScore: player.compositeScore,
                dynastyValue: player.dynastyValue,
                dynastyTier: player.dynastyTier as any,
                confidenceScore: player.confidenceScore,
                advancedMetrics: player.advancedMetrics,
                lastAdvancedUpdate: new Date()
              })
              .where(eq(players.id, existingPlayer.id));
            
            updateCount++;
          }
        }
      }
      
      console.log(`🔄 Updated ${updateCount} players with advanced rankings`);
      
    } catch (error) {
      console.error('❌ Database update failed:', error);
      throw error;
    }
    
    return updateCount;
  }
  
  /**
   * Get current advanced rankings for a position
   */
  async getAdvancedRankings(position?: string): Promise<AdvancedPlayerMetrics[]> {
    try {
      const whereClause = position ? eq(players.position, position) : undefined;
      
      const playerData = await db
        .select()
        .from(players)
        .where(whereClause)
        .orderBy(players.advancedRank);
      
      return playerData.map(p => ({
        playerId: p.externalId || p.id.toString(),
        playerName: p.name,
        position: p.position as 'QB' | 'RB' | 'WR' | 'TE',
        team: p.team,
        fantasyPointsPPR: p.avgPoints,
        gamesPlayed: 17, // Default season games
        pointsPerGame: p.avgPoints,
        advancedMetrics: p.advancedMetrics || {},
        advancedRank: p.advancedRank || 999,
        compositeScore: p.compositeScore || 0,
        dynastyValue: p.dynastyValue || 15,
        dynastyTier: p.dynastyTier || 'Bench',
        confidenceScore: p.confidenceScore || 50
      }));
      
    } catch (error) {
      console.error('❌ Failed to get advanced rankings:', error);
      return [];
    }
  }
  
  /**
   * Validate ranking integrity
   */
  async validateRankingIntegrity(): Promise<{
    isValid: boolean;
    issues: string[];
    stats: {
      totalPlayers: number;
      playersWithAdvancedRanks: number;
      averageConfidence: number;
    };
  }> {
    const issues: string[] = [];
    
    try {
      const allPlayers = await db.select().from(players);
      const playersWithAdvanced = allPlayers.filter(p => p.advancedRank && p.advancedRank < 999);
      
      // Check for ranking gaps
      const positions = ['QB', 'RB', 'WR', 'TE'];
      for (const pos of positions) {
        const posPlayers = playersWithAdvanced.filter(p => p.position === pos);
        const ranks = posPlayers.map(p => p.advancedRank).sort((a, b) => a! - b!);
        
        for (let i = 1; i < ranks.length; i++) {
          if (ranks[i]! - ranks[i-1]! > 1) {
            issues.push(`${pos}: Ranking gap between ${ranks[i-1]} and ${ranks[i]}`);
          }
        }
      }
      
      // Check confidence scores
      const lowConfidencePlayers = playersWithAdvanced.filter(p => 
        (p.confidenceScore || 0) < 30
      );
      
      if (lowConfidencePlayers.length > 0) {
        issues.push(`${lowConfidencePlayers.length} players have low confidence scores (<30)`);
      }
      
      const avgConfidence = playersWithAdvanced.reduce((sum, p) => 
        sum + (p.confidenceScore || 0), 0
      ) / Math.max(playersWithAdvanced.length, 1);
      
      return {
        isValid: issues.length === 0,
        issues,
        stats: {
          totalPlayers: allPlayers.length,
          playersWithAdvancedRanks: playersWithAdvanced.length,
          averageConfidence: avgConfidence
        }
      };
      
    } catch (error) {
      return {
        isValid: false,
        issues: [`Validation failed: ${error}`],
        stats: { totalPlayers: 0, playersWithAdvancedRanks: 0, averageConfidence: 0 }
      };
    }
  }
}

export const advancedNFLRankings = new AdvancedNFLRankingsEngine();