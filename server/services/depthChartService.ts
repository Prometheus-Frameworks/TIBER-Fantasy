import { SportsDataAPI } from '../sportsdata';

export interface MainPlayerSystemEntry {
  player_id: string;
  name: string;
  position: string;
  team: string;
  depth_chart_slot: string;
  depth_score: number;
}

interface DepthChartPlayer {
  DepthChartID: number;
  TeamID: number;
  PlayerID: number;
  Name: string;
  PositionCategory: string;
  Position: string;
  DepthOrder: number;
  Updated: string;
}

interface DepthChartTeam {
  TeamID: number;
  Offense: DepthChartPlayer[];
  Defense: DepthChartPlayer[];
  SpecialTeams: DepthChartPlayer[];
}

export class DepthChartService {
  private sportsDataAPI = new SportsDataAPI();
  private teamCodeMap: { [key: number]: string } = {
    1: 'ARI', 2: 'ATL', 3: 'BAL', 4: 'BUF', 5: 'CAR', 6: 'CHI', 7: 'CIN', 8: 'CLE',
    9: 'DAL', 10: 'DEN', 11: 'DET', 12: 'GB', 13: 'HOU', 14: 'IND', 15: 'JAX',
    16: 'KC', 17: 'LV', 18: 'LAC', 19: 'LAR', 20: 'MIA', 21: 'MIN', 22: 'NE',
    23: 'NO', 24: 'NYG', 25: 'NYJ', 26: 'PHI', 27: 'PIT', 28: 'SEA', 29: 'SF',
    30: 'TB', 31: 'TEN', 32: 'WAS'
  };

  private async fetchLiveDepthCharts(): Promise<DepthChartTeam[]> {
    try {
      console.log('🔍 [MPS] Fetching live NFL depth charts from SportsDataIO...');
      
      if (!process.env.SPORTSDATA_API_KEY) {
        throw new Error('SPORTSDATA_API_KEY environment variable not found');
      }
      
      const response = await fetch(`https://api.sportsdata.io/v3/nfl/scores/json/DepthCharts?key=${process.env.SPORTSDATA_API_KEY}`);
      
      if (!response.ok) {
        throw new Error(`SportsData API error: ${response.status} ${response.statusText}`);
      }
      
      const depthCharts: DepthChartTeam[] = await response.json();
      console.log(`📊 [MPS] Successfully fetched depth charts for ${depthCharts.length} teams`);
      return depthCharts;
    } catch (error) {
      console.error('❌ [MPS_API_FAILURE_NO_FEED_DETECTED] Failed to fetch depth charts:', error);
      throw error;
    }
  }

  private generatePlayerID(name: string, teamCode: string): string {
    // Convert name to lowercase-hyphenated format
    const cleanName = name.toLowerCase()
      .replace(/[^a-zA-Z\s]/g, '') // Remove non-letters except spaces
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    
    return `${cleanName}_${teamCode.toLowerCase()}`;
  }

  private getDepthSlot(position: string, depthOrder: number): string {
    const validPositions = ['QB', 'RB', 'WR', 'TE'];
    
    if (!validPositions.includes(position)) {
      return `${position}${depthOrder}`; // Fallback for other positions
    }
    
    return `${position}${depthOrder}`;
  }

  private calculateDepthScore(position: string, depthOrder: number): number {
    // Scoring system as specified in TIBER requirements
    switch (depthOrder) {
      case 1: return 1.0; // WR1/RB1/QB1/TE1
      case 2: return 0.8; // WR2/RB2/QB2/TE2  
      case 3: return 0.5; // WR3/RB3/QB3/TE3
      case 4: return 0.3; // WR4/RB4/QB4/TE4
      default: return 0.1; // Deeper depth chart positions
    }
  }

  public async generateMainPlayerSystem(): Promise<MainPlayerSystemEntry[]> {
    try {
      console.log('🚀 [MPS] Starting MainPlayerSystem.json generation...');
      
      const depthCharts = await this.fetchLiveDepthCharts();
      const mainPlayerSystem: MainPlayerSystemEntry[] = [];

      for (const teamData of depthCharts) {
        const teamCode = this.teamCodeMap[teamData.TeamID] || 'UNK';
        
        // Process offensive players only (fantasy relevant positions)
        for (const player of teamData.Offense) {
          const fantasyPositions = ['QB', 'RB', 'WR', 'TE'];
          
          if (fantasyPositions.includes(player.Position)) {
            const entry: MainPlayerSystemEntry = {
              player_id: this.generatePlayerID(player.Name, teamCode),
              name: player.Name,
              position: player.Position,
              team: teamCode,
              depth_chart_slot: this.getDepthSlot(player.Position, player.DepthOrder),
              depth_score: this.calculateDepthScore(player.Position, player.DepthOrder)
            };
            
            mainPlayerSystem.push(entry);
          }
        }
      }

      // Sort by depth_score (highest to lowest), then by team
      mainPlayerSystem.sort((a, b) => {
        if (b.depth_score !== a.depth_score) {
          return b.depth_score - a.depth_score;
        }
        return a.team.localeCompare(b.team);
      });

      console.log(`✅ [MPS_LIVE_UPDATE_SUCCESS] Generated MainPlayerSystem with ${mainPlayerSystem.length} players`);
      console.log(`📈 [MPS] Breakdown: ${mainPlayerSystem.filter(p => p.depth_score === 1.0).length} starters, ${mainPlayerSystem.filter(p => p.depth_score === 0.8).length} second-string`);
      
      return mainPlayerSystem;
    } catch (error) {
      console.error('❌ [MPS_API_FAILURE_NO_FEED_DETECTED] MainPlayerSystem generation failed:', error);
      throw error;
    }
  }

  public async saveMainPlayerSystem(): Promise<void> {
    try {
      const mainPlayerSystem = await this.generateMainPlayerSystem();
      
      // Save to JSON file
      const fs = await import('fs/promises');
      await fs.writeFile(
        'MainPlayerSystem.json',
        JSON.stringify(mainPlayerSystem, null, 2)
      );
      
      console.log('💾 [MPS] MainPlayerSystem.json saved successfully');
      console.log(`📊 [MPS] Total players: ${mainPlayerSystem.length}`);
      
      // Log position breakdown
      const positionBreakdown = mainPlayerSystem.reduce((acc, player) => {
        acc[player.position] = (acc[player.position] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('📋 [MPS] Position breakdown:', positionBreakdown);
    } catch (error) {
      console.error('❌ [MPS] Failed to save MainPlayerSystem.json:', error);
      throw error;
    }
  }
}

export const depthChartService = new DepthChartService();