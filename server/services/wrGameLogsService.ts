import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface GameLog {
  week: number;
  fantasy_points: number;
  snap_pct: number;
  rank: number;
  receiving: {
    targets: number;
    receptions: number;
    yards: number;
    yards_per_target: number;
    yards_per_catch: number;
    touchdowns: number;
  };
  rushing: {
    attempts: number;
    yards: number;
    yards_per_carry: number;
    touchdowns: number;
  };
}

interface WRGameLogPlayer {
  player_name: string;
  position: string;
  team: string;
  game_logs: GameLog[];
}

export class WRGameLogsService {
  private excludedPlayers: Set<string> = new Set();

  constructor() {
    this.loadExcludedPlayers();
  }

  private loadExcludedPlayers(): void {
    try {
      const csvPath = path.join(__dirname, '../data/WR_2024_Ratings_With_Tags.csv');
      if (fs.existsSync(csvPath)) {
        const csvContent = fs.readFileSync(csvPath, 'utf-8');
        const lines = csvContent.trim().split('\n');
        
        // Skip header, extract player names
        lines.slice(1).forEach(line => {
          const playerName = line.split(',')[0].replace(/"/g, '');
          this.excludedPlayers.add(playerName.toLowerCase());
        });
        
        console.log(`📋 Excluding ${this.excludedPlayers.size} players already in top 50 dataset`);
      }
    } catch (error) {
      console.error('Error loading excluded players:', error);
    }
  }

  private isPlayerExcluded(playerName: string): boolean {
    return this.excludedPlayers.has(playerName.toLowerCase());
  }

  private calculateFantasyPoints(receiving: any, rushing: any): number {
    // PPR scoring: 1 point per reception, 0.1 per yard, 6 per TD
    const recPoints = (receiving.receptions || 0) + 
                     (receiving.yards || 0) * 0.1 + 
                     (receiving.touchdowns || 0) * 6;
    
    const rushPoints = (rushing.yards || 0) * 0.1 + 
                      (rushing.touchdowns || 0) * 6;
    
    return parseFloat((recPoints + rushPoints).toFixed(1));
  }

  private calculateYardsPerTarget(yards: number, targets: number): number {
    return targets > 0 ? parseFloat((yards / targets).toFixed(1)) : 0.0;
  }

  private calculateYardsPerCarry(yards: number, attempts: number): number {
    return attempts > 0 ? parseFloat((yards / attempts).toFixed(1)) : 0.0;
  }

  private calculateYardsPerCatch(yards: number, receptions: number): number {
    return receptions > 0 ? parseFloat((yards / receptions).toFixed(1)) : 0.0;
  }

  async fetchSleeperWRGameLogs(): Promise<WRGameLogPlayer[]> {
    console.log('🏈 Fetching 2024 WR game logs from Sleeper API...');
    
    const wrPlayers: WRGameLogPlayer[] = [];
    const processedPlayers = new Set<string>();
    
    try {
      // Fetch weekly stats for weeks 1-17
      for (let week = 1; week <= 17; week++) {
        console.log(`📊 Processing Week ${week} stats...`);
        
        const response = await axios.get(`https://api.sleeper.app/v1/stats/nfl/regular/2024/${week}`);
        const weekStats = response.data;
        
        if (!weekStats) {
          console.log(`⚠️ No data for Week ${week}`);
          continue;
        }
        
        // Process each player in the week
        for (const [playerId, stats] of Object.entries(weekStats)) {
          const playerStats = stats as any;
          
          // Only process WRs with some receiving activity
          if (!playerStats.rec_tgt && !playerStats.rec_rec && !playerStats.rec_yd) {
            continue;
          }
          
          // Get player info from Sleeper players API (cached approach)
          let playerName = `Player_${playerId}`;
          let playerTeam = 'UNK';
          
          try {
            const playersResponse = await axios.get('https://api.sleeper.app/v1/players/nfl');
            const allPlayers = playersResponse.data;
            
            if (allPlayers[playerId]) {
              const playerInfo = allPlayers[playerId];
              if (playerInfo.position === 'WR' && playerInfo.full_name) {
                playerName = playerInfo.full_name;
                playerTeam = playerInfo.team || 'FA';
                
                // Include ALL WRs for comprehensive stats display
                // Note: We want elite WRs to show their game log stats too!
                
                // Find or create player entry
                let playerEntry = wrPlayers.find(p => p.player_name === playerName);
                if (!playerEntry) {
                  playerEntry = {
                    player_name: playerName,
                    position: 'WR',
                    team: playerTeam,
                    game_logs: Array.from({ length: 17 }, (_, i) => ({
                      week: i + 1,
                      fantasy_points: 0.0,
                      snap_pct: 0,
                      rank: 999,
                      receiving: {
                        targets: 0,
                        receptions: 0,
                        yards: 0,
                        yards_per_target: 0.0,
                        yards_per_catch: 0.0,
                        touchdowns: 0
                      },
                      rushing: {
                        attempts: 0,
                        yards: 0,
                        yards_per_carry: 0.0,
                        touchdowns: 0
                      }
                    }))
                  };
                  wrPlayers.push(playerEntry);
                  processedPlayers.add(playerName);
                }
                
                // Update the specific week's data
                const weekIndex = week - 1;
                const gameLog = playerEntry.game_logs[weekIndex];
                
                // Receiving stats
                gameLog.receiving.targets = playerStats.rec_tgt || 0;
                gameLog.receiving.receptions = playerStats.rec_rec || 0;
                gameLog.receiving.yards = playerStats.rec_yd || 0;
                gameLog.receiving.touchdowns = playerStats.rec_td || 0;
                gameLog.receiving.yards_per_target = this.calculateYardsPerTarget(
                  gameLog.receiving.yards, 
                  gameLog.receiving.targets
                );
                gameLog.receiving.yards_per_catch = this.calculateYardsPerCatch(
                  gameLog.receiving.yards, 
                  gameLog.receiving.receptions
                );
                
                // Rushing stats
                gameLog.rushing.attempts = playerStats.rush_att || 0;
                gameLog.rushing.yards = playerStats.rush_yd || 0;
                gameLog.rushing.touchdowns = playerStats.rush_td || 0;
                gameLog.rushing.yards_per_carry = this.calculateYardsPerCarry(
                  gameLog.rushing.yards, 
                  gameLog.rushing.attempts
                );
                
                // Calculate fantasy points
                gameLog.fantasy_points = this.calculateFantasyPoints(
                  gameLog.receiving, 
                  gameLog.rushing
                );
                
                // Snap percentage (estimated based on targets)
                if (gameLog.receiving.targets > 0) {
                  gameLog.snap_pct = Math.min(95, Math.max(25, gameLog.receiving.targets * 5));
                }
              }
            }
          } catch (playerError) {
            // Continue processing even if individual player lookup fails
            continue;
          }
        }
        
        // Add delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // Filter out players with no meaningful activity
      const activeWRs = wrPlayers.filter(player => {
        const totalTargets = player.game_logs.reduce((sum, log) => sum + log.receiving.targets, 0);
        const totalPoints = player.game_logs.reduce((sum, log) => sum + log.fantasy_points, 0);
        return totalTargets >= 5 || totalPoints >= 10; // Minimum activity threshold
      });
      
      console.log(`✅ Successfully processed ${activeWRs.length} WR players with game logs`);
      console.log(`📈 Sample players: ${activeWRs.slice(0, 5).map(p => p.player_name).join(', ')}`);
      
      return activeWRs;
      
    } catch (error) {
      console.error('❌ Error fetching WR game logs:', error);
      return [];
    }
  }

  async saveGameLogsToFile(players: WRGameLogPlayer[]): Promise<void> {
    try {
      const outputPath = path.join(__dirname, '../data/wr_2024_additional_game_logs.json');
      const jsonOutput = JSON.stringify(players, null, 2);
      
      fs.writeFileSync(outputPath, jsonOutput);
      console.log(`💾 Saved ${players.length} WR game logs to: ${outputPath}`);
      
    } catch (error) {
      console.error('❌ Error saving game logs:', error);
    }
  }
}

export const wrGameLogsService = new WRGameLogsService();