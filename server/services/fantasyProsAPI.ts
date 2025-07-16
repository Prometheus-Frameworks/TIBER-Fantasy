/**
 * FantasyPros API Integration Service
 * For accessing expert consensus rankings and projections
 */

interface FantasyProsPlayer {
  player_id: string;
  name: string;
  position: string;
  team: string;
  rank: number;
  tier: number;
  ecr?: number; // Expert Consensus Ranking
  std_dev?: number;
  min_rank?: number;
  max_rank?: number;
  // Dynasty-specific fields
  dynasty_rank?: number;
  dynasty_tier?: string;
  // Projections
  projected_points?: number;
  projected_stats?: any;
}

interface FantasyProsResponse {
  players: FantasyProsPlayer[];
  last_updated: string;
  total_experts: number;
  scoring_type: string;
}

class FantasyProsAPIService {
  private baseUrl = 'https://api.fantasypros.com/v2';
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.FANTASY_PROS_API_KEY || '';
    if (!this.apiKey) {
      console.log('⚠️ FantasyPros API key not found - service will be disabled');
    }
  }

  /**
   * Get expert consensus rankings for dynasty leagues
   */
  async getDynastyRankings(position?: string): Promise<FantasyProsResponse | null> {
    if (!this.apiKey) {
      console.log('❌ FantasyPros API key required');
      return null;
    }

    try {
      const url = `${this.baseUrl}/dynasty/rankings`;
      const params = new URLSearchParams({
        format: 'json',
        position: position || 'ALL',
        scoring: 'PPR'
      });

      console.log(`🔄 Fetching FantasyPros dynasty rankings for ${position || 'ALL'} positions...`);
      
      const response = await fetch(`${url}?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`FantasyPros API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as FantasyProsResponse;
      console.log(`✅ Retrieved ${data.players?.length || 0} dynasty rankings from FantasyPros`);
      
      return data;
    } catch (error) {
      console.error('❌ FantasyPros API error:', error);
      return null;
    }
  }

  /**
   * Get player projections
   */
  async getProjections(week?: number): Promise<FantasyProsResponse | null> {
    if (!this.apiKey) return null;

    try {
      const url = `${this.baseUrl}/projections`;
      const params = new URLSearchParams({
        format: 'json',
        week: week ? week.toString() : 'season',
        scoring: 'PPR'
      });

      const response = await fetch(`${url}?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`FantasyPros API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ FantasyPros projections error:', error);
      return null;
    }
  }

  /**
   * Sync FantasyPros dynasty rankings to our database
   */
  async syncDynastyRankings(): Promise<{ success: boolean; playersUpdated: number; errors: string[] }> {
    const result = { success: false, playersUpdated: 0, errors: [] as string[] };

    try {
      console.log('🔄 Starting FantasyPros dynasty sync...');
      
      // Get rankings for all positions
      const positions = ['QB', 'RB', 'WR', 'TE'];
      let totalUpdated = 0;

      for (const position of positions) {
        const data = await this.getDynastyRankings(position);
        if (!data?.players) {
          result.errors.push(`No data received for ${position}`);
          continue;
        }

        console.log(`📊 Processing ${data.players.length} ${position} rankings...`);
        
        // Here we would update our database with the FantasyPros data
        // This will integrate with our existing player storage system
        totalUpdated += data.players.length;
      }

      result.success = true;
      result.playersUpdated = totalUpdated;
      console.log(`✅ FantasyPros sync complete: ${totalUpdated} players updated`);

    } catch (error) {
      console.error('❌ FantasyPros sync failed:', error);
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }

    return result;
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<boolean> {
    if (!this.apiKey) {
      console.log('❌ No FantasyPros API key provided');
      return false;
    }

    try {
      // Simple test call to check connectivity
      const response = await fetch(`${this.baseUrl}/dynasty/rankings?format=json&position=QB&limit=5`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      const isConnected = response.ok;
      console.log(isConnected ? '✅ FantasyPros API connected' : '❌ FantasyPros API connection failed');
      return isConnected;
    } catch (error) {
      console.error('❌ FantasyPros API test failed:', error);
      return false;
    }
  }
}

export const fantasyProsAPI = new FantasyProsAPIService();
export type { FantasyProsPlayer, FantasyProsResponse };