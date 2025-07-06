/**
 * Fantasy Football Data Pros API Integration
 * Completely free API with no authentication required
 * Historical data back to 1970, weekly fantasy data since 1999
 */

export interface FFDPWeeklyPlayer {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  week: number;
  season: number;
  fantasy_points: number;
  fantasy_points_ppr: number;
  
  // Passing stats
  pass_attempts?: number;
  pass_completions?: number;
  pass_yards?: number;
  pass_touchdowns?: number;
  pass_interceptions?: number;
  
  // Rushing stats
  rush_attempts?: number;
  rush_yards?: number;
  rush_touchdowns?: number;
  
  // Receiving stats
  receptions?: number;
  receiving_yards?: number;
  receiving_touchdowns?: number;
  targets?: number;
}

export interface FFDPSeasonPlayer {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  season: number;
  games_played: number;
  fantasy_points: number;
  fantasy_points_ppr: number;
  fantasy_points_per_game: number;
  fantasy_points_per_game_ppr: number;
  
  // Season totals
  pass_attempts?: number;
  pass_completions?: number;
  pass_yards?: number;
  pass_touchdowns?: number;
  pass_interceptions?: number;
  rush_attempts?: number;
  rush_yards?: number;
  rush_touchdowns?: number;
  receptions?: number;
  receiving_yards?: number;
  receiving_touchdowns?: number;
  targets?: number;
}

export interface FFDPProjection {
  player_id: string;
  player_name: string;
  position: string;
  team: string;
  season: number;
  projected_fantasy_points: number;
  projected_fantasy_points_ppr: number;
  
  // Projected stats
  projected_pass_attempts?: number;
  projected_pass_yards?: number;
  projected_pass_touchdowns?: number;
  projected_rush_attempts?: number;
  projected_rush_yards?: number;
  projected_rush_touchdowns?: number;
  projected_receptions?: number;
  projected_receiving_yards?: number;
  projected_receiving_touchdowns?: number;
  projected_targets?: number;
}

class FantasyFootballDataProAPI {
  private baseUrl = 'https://www.fantasyfootballdatapros.com/api';
  private rateLimitDelay = 500; // 500ms between requests to be respectful

  private async makeRequest(endpoint: string): Promise<any> {
    try {
      // Rate limiting to be respectful to free API
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Prometheus Fantasy Analytics Platform'
        }
      });

      if (!response.ok) {
        throw new Error(`FFDP API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Fantasy Football Data Pros API request failed:', error);
      throw error;
    }
  }

  /**
   * Get weekly player data for a specific season and week
   */
  async getWeeklyData(season: number, week: number): Promise<FFDPWeeklyPlayer[]> {
    try {
      const data = await this.makeRequest(`/players/${season}/${week}`);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error(`Error fetching weekly data for ${season} week ${week}:`, error);
      return [];
    }
  }

  /**
   * Get season totals for all players in a given year
   */
  async getSeasonData(season: number): Promise<FFDPSeasonPlayer[]> {
    try {
      const data = await this.makeRequest(`/players/${season}/all`);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error(`Error fetching season data for ${season}:`, error);
      return [];
    }
  }

  /**
   * Get projections for current season
   */
  async getProjections(season: number): Promise<FFDPProjection[]> {
    try {
      const data = await this.makeRequest(`/projections`);
      return Array.isArray(data) ? data : [];
    } catch (error) {
      console.error(`Error fetching projections for ${season}:`, error);
      return [];
    }
  }

  /**
   * Get historical data for a specific player across multiple seasons
   */
  async getPlayerHistory(playerName: string, startSeason: number = 2020, endSeason: number = 2024): Promise<FFDPSeasonPlayer[]> {
    try {
      const allSeasons = [];
      
      for (let season = startSeason; season <= endSeason; season++) {
        const seasonData = await this.getSeasonData(season);
        const playerData = seasonData.filter(player => 
          player.player_name.toLowerCase().includes(playerName.toLowerCase())
        );
        allSeasons.push(...playerData);
      }
      
      return allSeasons;
    } catch (error) {
      console.error(`Error fetching player history for ${playerName}:`, error);
      return [];
    }
  }

  /**
   * Get top performers by position for a season
   */
  async getTopPerformers(season: number, position: string, limit: number = 20): Promise<FFDPSeasonPlayer[]> {
    try {
      const seasonData = await this.getSeasonData(season);
      
      return seasonData
        .filter(player => player.position === position.toUpperCase())
        .sort((a, b) => b.fantasy_points_ppr - a.fantasy_points_ppr)
        .slice(0, limit);
    } catch (error) {
      console.error(`Error fetching top performers for ${position} in ${season}:`, error);
      return [];
    }
  }

  /**
   * Calculate advanced metrics from basic stats
   */
  calculateAdvancedMetrics(player: FFDPSeasonPlayer): {
    targetShare?: number;
    receptionsPerTarget?: number;
    yardsPerReception?: number;
    yardsPerCarry?: number;
    touchdownRate?: number;
    consistency?: number;
  } {
    const metrics: any = {};

    // Receiving metrics
    if (player.targets && player.targets > 0) {
      metrics.receptionsPerTarget = player.receptions ? player.receptions / player.targets : 0;
      
      // Estimate team targets (rough approximation)
      const estimatedTeamTargets = player.targets / 0.25; // Assume 25% target share for calculation
      metrics.targetShare = (player.targets / estimatedTeamTargets) * 100;
    }

    if (player.receptions && player.receiving_yards) {
      metrics.yardsPerReception = player.receiving_yards / player.receptions;
    }

    // Rushing metrics
    if (player.rush_attempts && player.rush_attempts > 0) {
      metrics.yardsPerCarry = player.rush_yards ? player.rush_yards / player.rush_attempts : 0;
    }

    // Touchdown rate
    const totalTouchdowns = (player.pass_touchdowns || 0) + (player.rush_touchdowns || 0) + (player.receiving_touchdowns || 0);
    const totalOpportunities = (player.pass_attempts || 0) + (player.rush_attempts || 0) + (player.targets || 0);
    if (totalOpportunities > 0) {
      metrics.touchdownRate = (totalTouchdowns / totalOpportunities) * 100;
    }

    return metrics;
  }

  /**
   * Get breakout candidates based on efficiency metrics
   */
  async getBreakoutCandidates(season: number): Promise<Array<FFDPSeasonPlayer & { metrics: any; breakoutScore: number }>> {
    try {
      const seasonData = await this.getSeasonData(season);
      
      return seasonData
        .filter(player => player.games_played >= 8) // Minimum games played
        .map(player => {
          const metrics = this.calculateAdvancedMetrics(player);
          
          // Calculate breakout score based on efficiency vs opportunity
          let breakoutScore = 0;
          
          // High efficiency, low volume = breakout potential
          if (metrics.yardsPerReception && metrics.yardsPerReception > 12) breakoutScore += 2;
          if (metrics.yardsPerCarry && metrics.yardsPerCarry > 4.5) breakoutScore += 2;
          if (metrics.receptionsPerTarget && metrics.receptionsPerTarget > 0.65) breakoutScore += 2;
          if (metrics.touchdownRate && metrics.touchdownRate > 5) breakoutScore += 2;
          
          // Lower volume players with high efficiency
          if (player.targets && player.targets < 80 && metrics.yardsPerReception && metrics.yardsPerReception > 15) {
            breakoutScore += 3;
          }
          
          return {
            ...player,
            metrics,
            breakoutScore
          };
        })
        .filter(player => player.breakoutScore >= 4)
        .sort((a, b) => b.breakoutScore - a.breakoutScore);
    } catch (error) {
      console.error('Error calculating breakout candidates:', error);
      return [];
    }
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const data = await this.makeRequest('/players/2019/1');
      return {
        success: Array.isArray(data) && data.length > 0,
        message: 'Fantasy Football Data Pros API connection successful'
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }
}

export const fantasyFootballDataAPI = new FantasyFootballDataProAPI();