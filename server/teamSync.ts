import type { Player, InsertPlayer } from "@shared/schema";
import { sportsDataAPI } from "./sportsdata";

// Fantasy platform sync interfaces
interface ESPNPlayer {
  id: number;
  fullName: string;
  defaultPositionId: number;
  eligibleSlots: number[];
  proTeamId: number;
}

interface ESPNTeam {
  roster?: {
    entries: Array<{
      playerId: number;
      lineupSlotId: number;
      playerPoolEntry: {
        player: ESPNPlayer;
      };
    }>;
  };
}

interface SleeperPlayer {
  player_id: string;
  full_name: string;
  position: string;
  team: string;
  status: string;
}

interface YahooPlayer {
  player_key: string;
  name: {
    full: string;
  };
  editorial_player_key: string;
  display_position: string;
  editorial_team_abbr: string;
}

export interface TeamSyncData {
  platform: "espn" | "yahoo" | "sleeper" | "manual";
  leagueId?: string;
  teamId?: string;
  players: Array<{
    name: string;
    position: string;
    team: string;
    isStarter: boolean;
  }>;
  teamName?: string;
  record?: string;
  totalPoints?: number;
}

export class TeamSyncService {
  
  // ESPN Fantasy sync
  async syncESPNTeam(leagueId: string, teamId: string, season: number = 2024): Promise<TeamSyncData> {
    try {
      const url = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${leagueId}?view=mTeam&view=mRoster`;
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`);
      }

      const data = await response.json();
      const team = data.teams?.find((t: any) => t.id.toString() === teamId);
      
      if (!team) {
        throw new Error(`Team ${teamId} not found in league ${leagueId}`);
      }

      // Convert ESPN roster to our format
      const players = team.roster?.entries?.map((entry: any) => {
        const player = entry.playerPoolEntry.player;
        return {
          name: player.fullName,
          position: this.espnPositionToString(player.defaultPositionId),
          team: this.espnTeamIdToAbbr(player.proTeamId),
          isStarter: entry.lineupSlotId < 20 // ESPN starter slots are typically 0-19
        };
      }) || [];

      return {
        platform: "espn",
        leagueId,
        teamId,
        players,
        teamName: team.name || `Team ${teamId}`,
        record: team.record ? `${team.record.overall.wins}-${team.record.overall.losses}` : "0-0",
        totalPoints: team.record?.overall?.pointsFor || 0
      };

    } catch (error) {
      console.error("ESPN sync error:", error);
      throw new Error(`Failed to sync ESPN team: ${error}`);
    }
  }

  // Sleeper Fantasy sync
  async syncSleeperTeam(leagueId: string, userId: string): Promise<TeamSyncData> {
    try {
      // Get league info
      const leagueUrl = `https://api.sleeper.app/v1/league/${leagueId}`;
      const leagueResponse = await fetch(leagueUrl);
      
      if (!leagueResponse.ok) {
        if (leagueResponse.status === 404) {
          throw new Error(`League not found. Please verify the League ID "${leagueId}" is correct. Sleeper League IDs are usually shorter (like "123456789").`);
        }
        throw new Error(`Sleeper league API error: ${leagueResponse.status}`);
      }

      const leagueData = await leagueResponse.json();
      if (!leagueData) {
        throw new Error(`League not found. Please verify the League ID "${leagueId}" is correct. Sleeper League IDs are usually shorter (like "123456789").`);
      }

      // Get user's roster
      const rostersUrl = `https://api.sleeper.app/v1/league/${leagueId}/rosters`;
      const rostersResponse = await fetch(rostersUrl);
      
      if (!rostersResponse.ok) {
        throw new Error(`Sleeper rosters API error: ${rostersResponse.status}`);
      }

      const rosters = await rostersResponse.json();
      const userRoster = rosters.find((r: any) => r.owner_id === userId);
      
      if (!userRoster) {
        throw new Error(`User ${userId} not found in league ${leagueId}`);
      }

      // Get player info
      const playersUrl = `https://api.sleeper.app/v1/players/nfl`;
      const playersResponse = await fetch(playersUrl);
      const allPlayers = await playersResponse.json();

      // Map roster player IDs to player info
      const players = userRoster.players?.map((playerId: string) => {
        const player = allPlayers[playerId];
        if (!player) return null;
        
        return {
          name: player.full_name,
          position: player.position,
          team: player.team || "FA",
          isStarter: userRoster.starters?.includes(playerId) || false
        };
      }).filter(Boolean) || [];

      return {
        platform: "sleeper",
        leagueId,
        teamId: userId,
        players,
        teamName: `Team ${userId}`,
        record: "0-0", // Sleeper doesn't provide easy record access
        totalPoints: userRoster.settings?.fpts || 0
      };

    } catch (error) {
      console.error("Sleeper sync error:", error);
      throw new Error(`Failed to sync Sleeper team: ${error}`);
    }
  }

  // Yahoo Fantasy sync (requires OAuth - placeholder for now)
  async syncYahooTeam(leagueId: string, teamId: string, accessToken: string): Promise<TeamSyncData> {
    throw new Error("Yahoo sync requires OAuth authentication. Please use manual import for now.");
  }

  // Manual team import via player names
  async syncManualTeam(playerNames: string[], teamName: string): Promise<TeamSyncData> {
    const players = await Promise.all(
      playerNames.map(async (name) => {
        // Try to find player in our database first
        const normalizedName = name.trim();
        
        return {
          name: normalizedName,
          position: "FLEX", // Default, user can adjust
          team: "UNK",
          isStarter: true
        };
      })
    );

    return {
      platform: "manual",
      players,
      teamName,
      record: "0-0",
      totalPoints: 0
    };
  }

  // Match synced players with our database players
  async matchPlayersToDatabase(syncData: TeamSyncData): Promise<Array<{ player: Player | null, syncPlayer: any, confidence: number }>> {
    const matches = [];
    
    for (const syncPlayer of syncData.players) {
      // Try to find matching player in database using SportsDataIO data
      const dbPlayers = await this.searchPlayerByName(syncPlayer.name);
      
      let bestMatch = null;
      let confidence = 0;
      
      if (dbPlayers.length > 0) {
        // Simple name matching for now - could be enhanced with fuzzy matching
        for (const dbPlayer of dbPlayers) {
          const nameMatch = this.calculateNameSimilarity(syncPlayer.name, dbPlayer.name);
          const teamMatch = syncPlayer.team === dbPlayer.team ? 0.3 : 0;
          const positionMatch = syncPlayer.position === dbPlayer.position ? 0.2 : 0;
          
          const totalConfidence = nameMatch + teamMatch + positionMatch;
          
          if (totalConfidence > confidence) {
            confidence = totalConfidence;
            bestMatch = dbPlayer;
          }
        }
      }
      
      matches.push({
        player: bestMatch,
        syncPlayer,
        confidence
      });
    }
    
    return matches;
  }

  private async searchPlayerByName(name: string): Promise<Player[]> {
    // This would search our database - simplified for now
    // In real implementation, would use fuzzy search
    return [];
  }

  private calculateNameSimilarity(name1: string, name2: string): number {
    // Simple similarity calculation - could use Levenshtein distance
    const lower1 = name1.toLowerCase();
    const lower2 = name2.toLowerCase();
    
    if (lower1 === lower2) return 0.5;
    if (lower1.includes(lower2) || lower2.includes(lower1)) return 0.3;
    
    return 0;
  }

  private espnPositionToString(positionId: number): string {
    const positions: { [key: number]: string } = {
      1: "QB",
      2: "RB",
      3: "WR",
      4: "TE",
      5: "K",
      16: "DST"
    };
    
    return positions[positionId] || "FLEX";
  }

  private espnTeamIdToAbbr(teamId: number): string {
    const teams: { [key: number]: string } = {
      1: "ATL", 2: "BUF", 3: "CHI", 4: "CIN", 5: "CLE", 6: "DAL", 7: "DEN", 8: "DET",
      9: "GB", 10: "TEN", 11: "IND", 12: "KC", 13: "LV", 14: "LAR", 15: "MIA", 16: "MIN",
      17: "NE", 18: "NO", 19: "NYG", 20: "NYJ", 21: "PHI", 22: "ARI", 23: "PIT", 24: "LAC",
      25: "SF", 26: "SEA", 27: "TB", 28: "WAS", 29: "CAR", 30: "JAX", 33: "BAL", 34: "HOU"
    };
    
    return teams[teamId] || "FA";
  }
}

export const teamSyncService = new TeamSyncService();