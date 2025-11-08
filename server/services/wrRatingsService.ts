import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface WRPlayer {
  player_name: string;
  team: string;
  games_played_x: number;
  total_points: number;
  fpg: number;
  vorp: number;
  rating: number;
  adjusted_rating: number;
  ypc: number;
  ypt: number;
  rush_ypc: number;
  targets: number;
  receptions: number;
  rec_yards: number;
  games_played_y: number;
  archetype_tag: string;
}

export class WRRatingsService {
  private wrPlayers: WRPlayer[] = [];
  private csvPath = path.join(process.cwd(), 'server/data/wr_ratings.csv');

  constructor() {
    this.loadWRData();
  }

  private loadWRData(): void {
    try {
      console.log('📊 Loading WR ratings from CSV...');
      
      if (!fs.existsSync(this.csvPath)) {
        console.warn(`⚠️ CSV file not found: ${this.csvPath}`);
        console.warn('⚠️ WR ratings will not be available. This is non-critical - app will continue.');
        this.wrPlayers = []; // Empty array as fallback
        return;
      }

      const csvContent = fs.readFileSync(this.csvPath, 'utf-8');
      const lines = csvContent.trim().split('\n');
      
      // Skip header row
      const dataLines = lines.slice(1);
      
      this.wrPlayers = dataLines.map(line => {
        const values = this.parseCSVLine(line);
        
        return {
          player_name: values[0],
          team: values[1],
          games_played_x: parseFloat(values[2]) || 0,
          total_points: parseFloat(values[3]) || 0,
          fpg: parseFloat(values[4]) || 0,
          vorp: parseFloat(values[5]) || 0,
          rating: parseFloat(values[6]) || 0,
          adjusted_rating: parseFloat(values[7]) || 0,
          ypc: parseFloat(values[8]) || 0,
          ypt: parseFloat(values[9]) || 0,
          rush_ypc: parseFloat(values[10]) || 0,
          targets: parseFloat(values[11]) || 0,
          receptions: parseFloat(values[12]) || 0,
          rec_yards: parseFloat(values[13]) || 0,
          games_played_y: parseFloat(values[14]) || 0,
          archetype_tag: values[15] || 'balanced'
        };
      });

      console.log(`✅ Loaded ${this.wrPlayers.length} WR players from CSV`);
      
      // Log top 5 players for verification
      const top5 = this.wrPlayers.slice(0, 5);
      console.log('🏆 Top 5 WRs by adjusted_rating:');
      top5.forEach((player, index) => {
        console.log(`  ${index + 1}. ${player.player_name} (${player.team}) - Rating: ${player.adjusted_rating}, FPG: ${player.fpg}`);
      });
      
    } catch (error) {
      console.error('❌ Error loading WR CSV data:', error);
      console.warn('⚠️ WR ratings service will continue without data. This is non-critical.');
      this.wrPlayers = []; // Empty array as fallback
    }
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  // Get all WR players sorted by adjusted_rating
  getAllWRPlayers(): WRPlayer[] {
    return [...this.wrPlayers].sort((a, b) => b.adjusted_rating - a.adjusted_rating);
  }

  // Get specific player by name
  getPlayerByName(playerName: string): WRPlayer | undefined {
    const searchName = playerName.toLowerCase().trim();
    return this.wrPlayers.find(player => 
      player.player_name.toLowerCase().includes(searchName) ||
      searchName.includes(player.player_name.toLowerCase())
    );
  }

  // Get rankings data for /rankings page
  getRankingsData(): Array<{
    name: string;
    team: string;
    rating: number;
    archetype: string;
    fpg: number;
    vorp: number;
  }> {
    return this.getAllWRPlayers().map(player => ({
      name: player.player_name,
      team: player.team,
      rating: player.adjusted_rating,
      archetype: player.archetype_tag,
      fpg: player.fpg,
      vorp: player.vorp
    }));
  }

  // Get player profile data for /player/:id page
  getPlayerProfile(playerName: string): WRPlayer | null {
    const player = this.getPlayerByName(playerName);
    return player || null;
  }

  // Get player stats summary
  getStatsOverview(): {
    total_players: number;
    avg_fpg: number;
    top_rating: number;
    archetype_distribution: Record<string, number>;
  } {
    const total = this.wrPlayers.length;
    const avgFpg = this.wrPlayers.reduce((sum, p) => sum + p.fpg, 0) / total;
    const topRating = Math.max(...this.wrPlayers.map(p => p.adjusted_rating));
    
    const archetypeDistribution: Record<string, number> = {};
    this.wrPlayers.forEach(player => {
      archetypeDistribution[player.archetype_tag] = (archetypeDistribution[player.archetype_tag] || 0) + 1;
    });
    
    return {
      total_players: total,
      avg_fpg: Math.round(avgFpg * 100) / 100,
      top_rating: topRating,
      archetype_distribution: archetypeDistribution
    };
  }
}

// Export singleton instance
export const wrRatingsService = new WRRatingsService();