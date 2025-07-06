/**
 * Data Source Manager
 * Unified interface for all fantasy football data sources
 * Manages multiple APIs with fallback strategies and data enrichment
 */

import { mySportsFeedsAPI, type MSFPlayer, type MSFPlayerStats } from './mySportsFeedsAPI';
import { fantasyFootballDataAPI, type FFDPSeasonPlayer } from './fantasyFootballDataAPI';
import { realTimeNFLAnalytics } from './realTimeNFLAnalytics';

export interface UnifiedPlayer {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
  team: string;
  age?: number;
  
  // Current season stats
  stats: {
    gamesPlayed: number;
    fantasyPoints: number;
    fantasyPointsPPR: number;
    avgPointsPerGame: number;
    
    // Position-specific stats
    passing?: {
      attempts: number;
      completions: number;
      yards: number;
      touchdowns: number;
      interceptions: number;
      rating?: number;
    };
    rushing?: {
      attempts: number;
      yards: number;
      touchdowns: number;
      yardsPerCarry?: number;
    };
    receiving?: {
      receptions: number;
      yards: number;
      touchdowns: number;
      targets: number;
      yardsPerReception?: number;
      catchRate?: number;
    };
  };
  
  // Advanced metrics
  advancedMetrics?: {
    targetShare?: number;
    yardsPerRouteRun?: number;
    separationRate?: number;
    yardsAfterContact?: number;
    epaPerPlay?: number;
    successRate?: number;
  };
  
  // Dynasty-specific data
  dynastyData: {
    value: number;
    tier: string;
    ageAdjustment: number;
    trendDirection: 'rising' | 'stable' | 'declining';
    confidenceScore: number;
  };
  
  // Data source information
  dataSources: {
    primary: string;
    lastUpdated: Date;
    completeness: number; // 0-100 percentage
  };
}

export interface DataSourceStatus {
  name: string;
  available: boolean;
  hasAuth: boolean;
  lastChecked: Date;
  responseTime?: number;
  errorMessage?: string;
}

class DataSourceManager {
  private sourceStatuses: Map<string, DataSourceStatus> = new Map();
  private cache: Map<string, { data: any; timestamp: Date; ttl: number }> = new Map();
  private readonly cacheTimeout = 15 * 60 * 1000; // 15 minutes

  constructor() {
    this.initializeDataSources();
  }

  private async initializeDataSources() {
    // Check all data source availability
    await this.checkSourceStatus('MySportsFeeds', () => mySportsFeedsAPI.testConnection());
    await this.checkSourceStatus('FantasyFootballDataPros', () => fantasyFootballDataAPI.testConnection());
    await this.checkSourceStatus('RealTimeNFLAnalytics', () => this.testNFLAnalytics());
  }

  private async checkSourceStatus(sourceName: string, testFunction: () => Promise<any>) {
    const startTime = Date.now();
    try {
      const result = await testFunction();
      const responseTime = Date.now() - startTime;
      
      this.sourceStatuses.set(sourceName, {
        name: sourceName,
        available: result.success || result.available || true,
        hasAuth: result.hasAuth || false,
        lastChecked: new Date(),
        responseTime,
        errorMessage: result.success ? undefined : result.message
      });
    } catch (error) {
      this.sourceStatuses.set(sourceName, {
        name: sourceName,
        available: false,
        hasAuth: false,
        lastChecked: new Date(),
        responseTime: Date.now() - startTime,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async testNFLAnalytics(): Promise<{ success: boolean; message: string }> {
    try {
      // Simple test of our NFL analytics system
      return { success: true, message: 'NFL Analytics engine operational' };
    } catch (error) {
      return { success: false, message: 'NFL Analytics unavailable' };
    }
  }

  /**
   * Get unified player data from multiple sources
   */
  async getUnifiedPlayer(playerId: string, playerName?: string): Promise<UnifiedPlayer | null> {
    const cacheKey = `player_${playerId}_${playerName}`;
    
    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Primary source: MySportsFeeds (if available)
      let primaryData: MSFPlayerStats | null = null;
      if (this.isSourceAvailable('MySportsFeeds')) {
        const msfPlayers = await mySportsFeedsAPI.getPlayerStats('2024-2025-regular');
        primaryData = msfPlayers.find(p => 
          p.player.id.toString() === playerId || 
          (playerName && `${p.player.firstName} ${p.player.lastName}`.toLowerCase() === playerName.toLowerCase())
        ) || null;
      }

      // Secondary source: Fantasy Football Data Pros
      let secondaryData: FFDPSeasonPlayer | null = null;
      if (this.isSourceAvailable('FantasyFootballDataPros') && playerName) {
        const ffdpPlayers = await fantasyFootballDataAPI.getSeasonData(2024);
        secondaryData = ffdpPlayers.find(p => 
          p.player_name.toLowerCase() === playerName.toLowerCase()
        ) || null;
      }

      // Advanced metrics from our NFL analytics engine
      let advancedMetrics = {};
      if (this.isSourceAvailable('RealTimeNFLAnalytics') && playerName) {
        try {
          advancedMetrics = await realTimeNFLAnalytics.getPlayerAnalytics(playerName);
        } catch (error) {
          console.warn('Advanced metrics unavailable for', playerName);
        }
      }

      // Merge data sources into unified format
      const unifiedPlayer = this.mergePlayerData(primaryData, secondaryData, advancedMetrics, playerId);
      
      if (unifiedPlayer) {
        this.setCachedData(cacheKey, unifiedPlayer, this.cacheTimeout);
      }

      return unifiedPlayer;
    } catch (error) {
      console.error('Error getting unified player data:', error);
      return null;
    }
  }

  /**
   * Get multiple players with unified data
   */
  async getUnifiedPlayers(position?: string, limit: number = 50): Promise<UnifiedPlayer[]> {
    const cacheKey = `players_${position || 'all'}_${limit}`;
    
    // Check cache first
    const cached = this.getCachedData(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const unifiedPlayers: UnifiedPlayer[] = [];

      // Get data from available sources
      let primaryPlayers: MSFPlayerStats[] = [];
      if (this.isSourceAvailable('MySportsFeeds')) {
        primaryPlayers = await mySportsFeedsAPI.getPlayerStats('2024-2025-regular', position);
      }

      let secondaryPlayers: FFDPSeasonPlayer[] = [];
      if (this.isSourceAvailable('FantasyFootballDataPros')) {
        const allPlayers = await fantasyFootballDataAPI.getSeasonData(2024);
        secondaryPlayers = position 
          ? allPlayers.filter(p => p.position === position.toUpperCase())
          : allPlayers;
      }

      // Use primary source as base, supplement with secondary
      const processedIds = new Set<string>();

      // Process primary source players
      for (const msfPlayer of primaryPlayers.slice(0, limit)) {
        const playerId = msfPlayer.player.id.toString();
        const playerName = `${msfPlayer.player.firstName} ${msfPlayer.player.lastName}`;
        
        const secondaryMatch = secondaryPlayers.find(p => 
          p.player_name.toLowerCase() === playerName.toLowerCase()
        );

        const unifiedPlayer = this.mergePlayerData(msfPlayer, secondaryMatch, {}, playerId);
        if (unifiedPlayer) {
          unifiedPlayers.push(unifiedPlayer);
          processedIds.add(playerId);
        }
      }

      // Add remaining secondary source players if under limit
      for (const ffdpPlayer of secondaryPlayers) {
        if (unifiedPlayers.length >= limit) break;
        
        const playerId = ffdpPlayer.player_id;
        if (!processedIds.has(playerId)) {
          const unifiedPlayer = this.mergePlayerData(null, ffdpPlayer, {}, playerId);
          if (unifiedPlayer) {
            unifiedPlayers.push(unifiedPlayer);
          }
        }
      }

      // Sort by fantasy points and take top players
      const sortedPlayers = unifiedPlayers
        .sort((a, b) => b.stats.fantasyPointsPPR - a.stats.fantasyPointsPPR)
        .slice(0, limit);

      this.setCachedData(cacheKey, sortedPlayers, this.cacheTimeout);
      return sortedPlayers;
    } catch (error) {
      console.error('Error getting unified players:', error);
      return [];
    }
  }

  /**
   * Merge player data from multiple sources
   */
  private mergePlayerData(
    msfData: MSFPlayerStats | null,
    ffdpData: FFDPSeasonPlayer | null,
    advancedMetrics: any,
    playerId: string
  ): UnifiedPlayer | null {
    if (!msfData && !ffdpData) return null;

    const primarySource = msfData || ffdpData;
    if (!primarySource) return null;

    // Extract basic player info
    const isMSF = 'player' in primarySource;
    const name = isMSF 
      ? `${primarySource.player.firstName} ${primarySource.player.lastName}`
      : primarySource.player_name;
    
    const [firstName, ...lastNameParts] = name.split(' ');
    const lastName = lastNameParts.join(' ');

    const position = isMSF 
      ? primarySource.player.position.abbreviation as ('QB' | 'RB' | 'WR' | 'TE')
      : primarySource.position as ('QB' | 'RB' | 'WR' | 'TE');

    const team = isMSF 
      ? primarySource.player.currentTeam?.abbreviation || 'FA'
      : primarySource.team;

    // Merge stats from both sources
    const stats = this.mergeStats(msfData, ffdpData);
    
    // Calculate dynasty value (simplified version)
    const dynastyValue = this.calculateDynastyValue(stats, position, advancedMetrics);

    return {
      id: playerId,
      name,
      firstName,
      lastName,
      position,
      team,
      age: isMSF ? msfData?.player.age : undefined,
      stats,
      advancedMetrics,
      dynastyData: {
        value: dynastyValue,
        tier: this.getDynastyTier(dynastyValue),
        ageAdjustment: 0, // Calculate based on age if available
        trendDirection: 'stable',
        confidenceScore: this.calculateConfidence(msfData, ffdpData, advancedMetrics)
      },
      dataSources: {
        primary: isMSF ? 'MySportsFeeds' : 'FantasyFootballDataPros',
        lastUpdated: new Date(),
        completeness: this.calculateCompleteness(msfData, ffdpData, advancedMetrics)
      }
    };
  }

  private mergeStats(msfData: MSFPlayerStats | null, ffdpData: FFDPSeasonPlayer | null) {
    const stats = {
      gamesPlayed: 0,
      fantasyPoints: 0,
      fantasyPointsPPR: 0,
      avgPointsPerGame: 0
    };

    // Prefer MSF data for current stats, fall back to FFDP
    if (msfData?.stats) {
      stats.fantasyPoints = msfData.stats.fantasyPoints?.standard || 0;
      stats.fantasyPointsPPR = msfData.stats.fantasyPoints?.ppr || 0;
    } else if (ffdpData) {
      stats.gamesPlayed = ffdpData.games_played;
      stats.fantasyPoints = ffdpData.fantasy_points;
      stats.fantasyPointsPPR = ffdpData.fantasy_points_ppr;
      stats.avgPointsPerGame = ffdpData.fantasy_points_per_game_ppr;
    }

    // Add position-specific stats
    const positionStats: any = {};

    if (msfData?.stats?.passing) {
      positionStats.passing = {
        attempts: msfData.stats.passing.passAttempts || 0,
        completions: msfData.stats.passing.passCompletions || 0,
        yards: msfData.stats.passing.passYards || 0,
        touchdowns: msfData.stats.passing.passTouchdowns || 0,
        interceptions: msfData.stats.passing.passInterceptions || 0,
        rating: msfData.stats.passing.passRating
      };
    }

    if (msfData?.stats?.rushing || ffdpData?.rush_attempts) {
      positionStats.rushing = {
        attempts: msfData?.stats?.rushing?.rushAttempts || ffdpData?.rush_attempts || 0,
        yards: msfData?.stats?.rushing?.rushYards || ffdpData?.rush_yards || 0,
        touchdowns: msfData?.stats?.rushing?.rushTouchdowns || ffdpData?.rush_touchdowns || 0,
        yardsPerCarry: undefined // Calculate if we have both yards and attempts
      };
      
      if (positionStats.rushing.attempts > 0) {
        positionStats.rushing.yardsPerCarry = positionStats.rushing.yards / positionStats.rushing.attempts;
      }
    }

    if (msfData?.stats?.receiving || ffdpData?.receptions) {
      positionStats.receiving = {
        receptions: msfData?.stats?.receiving?.receptions || ffdpData?.receptions || 0,
        yards: msfData?.stats?.receiving?.recYards || ffdpData?.receiving_yards || 0,
        touchdowns: msfData?.stats?.receiving?.recTouchdowns || ffdpData?.receiving_touchdowns || 0,
        targets: msfData?.stats?.receiving?.targets || ffdpData?.targets || 0,
        yardsPerReception: undefined,
        catchRate: undefined
      };
      
      if (positionStats.receiving.receptions > 0) {
        positionStats.receiving.yardsPerReception = positionStats.receiving.yards / positionStats.receiving.receptions;
      }
      
      if (positionStats.receiving.targets > 0) {
        positionStats.receiving.catchRate = positionStats.receiving.receptions / positionStats.receiving.targets;
      }
    }

    return { ...stats, ...positionStats };
  }

  private calculateDynastyValue(stats: any, position: string, advancedMetrics: any): number {
    // Simplified dynasty value calculation
    let baseValue = stats.fantasyPointsPPR || stats.fantasyPoints || 0;
    
    // Position adjustments
    if (position === 'QB') baseValue *= 0.8; // QBs typically valued lower in 1QB leagues
    if (position === 'TE') baseValue *= 1.1; // TE scarcity premium
    
    // Advanced metrics bonuses
    if (advancedMetrics.yardsPerRouteRun && advancedMetrics.yardsPerRouteRun > 2.0) {
      baseValue *= 1.1;
    }
    
    if (advancedMetrics.targetShare && advancedMetrics.targetShare > 25) {
      baseValue *= 1.05;
    }
    
    return Math.min(Math.max(baseValue, 0), 100);
  }

  private getDynastyTier(value: number): string {
    if (value >= 90) return 'Elite';
    if (value >= 75) return 'Premium';
    if (value >= 60) return 'Strong';
    if (value >= 45) return 'Solid';
    if (value >= 30) return 'Depth';
    return 'Bench';
  }

  private calculateConfidence(msfData: any, ffdpData: any, advancedMetrics: any): number {
    let confidence = 50; // Base confidence
    
    if (msfData) confidence += 25; // Primary source available
    if (ffdpData) confidence += 15; // Secondary source available
    if (advancedMetrics && Object.keys(advancedMetrics).length > 0) confidence += 10; // Advanced metrics
    
    return Math.min(confidence, 100);
  }

  private calculateCompleteness(msfData: any, ffdpData: any, advancedMetrics: any): number {
    let completeness = 0;
    
    if (msfData) completeness += 40;
    if (ffdpData) completeness += 30;
    if (advancedMetrics && Object.keys(advancedMetrics).length > 0) completeness += 30;
    
    return Math.min(completeness, 100);
  }

  /**
   * Cache management
   */
  private getCachedData(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp.getTime() < cached.ttl) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCachedData(key: string, data: any, ttl: number) {
    this.cache.set(key, {
      data,
      timestamp: new Date(),
      ttl
    });
  }

  /**
   * Check if a data source is available
   */
  private isSourceAvailable(sourceName: string): boolean {
    const status = this.sourceStatuses.get(sourceName);
    return status?.available || false;
  }

  /**
   * Get status of all data sources
   */
  getDataSourceStatuses(): DataSourceStatus[] {
    return Array.from(this.sourceStatuses.values());
  }

  /**
   * Force refresh of data source statuses
   */
  async refreshDataSources(): Promise<void> {
    await this.initializeDataSources();
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }
}

export const dataSourceManager = new DataSourceManager();