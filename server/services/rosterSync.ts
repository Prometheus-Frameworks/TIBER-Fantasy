import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

interface SleeperPlayer {
  player_id: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  team?: string;
  position?: string;
  status?: string;
  birth_date?: string;
  college?: string;
  years_exp?: number;
  active?: boolean;
  gsis_id?: string;
  espn_id?: string;
  yahoo_id?: string;
}

interface NFLRosterPlayer {
  season: number;
  team: string;
  position: string;
  player_name: string;
  gsis_id?: string;
  nfl_id?: string;
  pfr_id?: string;
  height?: string;
  weight?: string;
  birth_date?: string;
  college_name?: string;
  depth_chart_order?: number;
  depth_chart_position?: string;
  status?: string;
}

interface MergedPlayer {
  player_id: string;
  name: string;
  team: string;
  pos: string;
  depth_chart_order?: number;
  depth_chart_position?: string;
  source_ids: {
    sleeper?: string;
    gsis?: string;
    espn?: string;
    yahoo?: string;
  };
}

interface RostersByTeam {
  [team: string]: MergedPlayer[];
}

interface DepthCharts {
  [team: string]: {
    [position: string]: string[];
  };
}

interface PlayersIndex {
  [player_id: string]: {
    player_id: string;
    name: string;
    team: string | null;
    pos: string;
    source_ids: {
      sleeper?: string;
      gsis?: string;
      espn?: string;
      yahoo?: string;
    };
  };
}

const SLEEPER_PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl";
const STORAGE_DIR = path.join(process.cwd(), 'storage');

// Team normalization map
const TEAM_MAP: { [key: string]: string } = {
  "JAC": "JAX",
  "WSH": "WAS", 
  "LA": "LAR",
  "ARZ": "ARI"
};

class RosterSyncService {
  private readonly SKILL_POSITIONS = ['QB', 'RB', 'WR', 'TE'];
  private readonly WR_DEPTH_LIMIT = 6;
  private readonly POSITION_DEPTH_LIMITS: { [pos: string]: number } = {
    'WR': 6,
    'RB': 8,
    'TE': 4,
    'QB': 4
  };

  private async ensureStorageDir(): Promise<void> {
    try {
      await fs.access(STORAGE_DIR);
    } catch {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
    }
  }

  private normTeam(team?: string): string | null {
    if (!team) return null;
    const normalized = team.trim().toUpperCase();
    return TEAM_MAP[normalized] || normalized;
  }

  private normName(name?: string): string | null {
    if (!name) return null;
    return name.trim().replace(/\s+/g, ' ');
  }

  private makeSitePlayerId(sleeperId?: string, gsisId?: string, name?: string): string {
    if (sleeperId) return `sleeper:${sleeperId}`;
    if (gsisId) return `gsis:${gsisId}`;
    // Fallback to name-based slug
    const slug = (name || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `slug:${slug}`;
  }

  private fuzzyMatch(sleeperPlayers: SleeperPlayer[], nflPlayers: NFLRosterPlayer[]): Map<number, NFLRosterPlayer | null> {
    const matches = new Map<number, NFLRosterPlayer | null>();
    
    // Build name index for NFL players
    const nflByName = new Map<string, NFLRosterPlayer>();
    nflPlayers.forEach(player => {
      const name = this.normName(player.player_name)?.toLowerCase();
      if (name) {
        nflByName.set(name, player);
      }
    });

    // Match Sleeper players to NFL players
    sleeperPlayers.forEach((sleeperPlayer, index) => {
      const sleeperName = this.normName(sleeperPlayer.full_name)?.toLowerCase();
      if (!sleeperName) {
        matches.set(index, null);
        return;
      }

      // Exact match first
      if (nflByName.has(sleeperName)) {
        matches.set(index, nflByName.get(sleeperName)!);
        return;
      }

      // Simple fuzzy matching - look for partial matches
      let bestMatch: NFLRosterPlayer | null = null;
      let bestScore = 0;

      for (const [nflName, nflPlayer] of Array.from(nflByName.entries())) {
        // Simple similarity score based on common words
        const sleeperWords = sleeperName.split(' ');
        const nflWords = nflName.split(' ');
        const commonWords = sleeperWords.filter(word => nflWords.includes(word));
        const score = commonWords.length / Math.max(sleeperWords.length, nflWords.length);

        if (score > bestScore && score > 0.7) {
          bestScore = score;
          bestMatch = nflPlayer;
        }
      }

      matches.set(index, bestMatch);
    });

    return matches;
  }

  async fetchSleeperPlayers(): Promise<SleeperPlayer[]> {
    const response = await axios.get(SLEEPER_PLAYERS_URL, { timeout: 60000 });
    const playersObj = response.data;
    
    const players: SleeperPlayer[] = [];
    for (const [playerId, playerData] of Object.entries(playersObj)) {
      if (typeof playerData === 'object' && playerData !== null) {
        const player = playerData as any;
        players.push({
          player_id: playerId,
          full_name: player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim(),
          first_name: player.first_name,
          last_name: player.last_name,
          team: player.team,
          position: player.position,
          status: player.status,
          birth_date: player.birth_date,
          college: player.college,
          years_exp: player.years_exp,
          active: player.active,
          gsis_id: player.gsis_id,
          espn_id: player.espn_id,
          yahoo_id: player.yahoo_id,
        });
      }
    }
    
    return players;
  }

  async fetchNFLRosters(season: number = 2025): Promise<NFLRosterPlayer[]> {
    // This would integrate with the existing NFL-Data-Py service
    // For now, return empty array - this will be populated by the Python integration
    return [];
  }

  async syncRosters(season: number = 2025): Promise<{
    status: string;
    season: number;
    teams: number;
    playersIndexed: number;
  }> {
    await this.ensureStorageDir();

    console.log('🔄 Starting roster sync...');
    
    const [sleeperPlayers, nflPlayers] = await Promise.all([
      this.fetchSleeperPlayers(),
      this.fetchNFLRosters(season)
    ]);

    console.log(`📊 Fetched ${sleeperPlayers.length} Sleeper players, ${nflPlayers.length} NFL roster players`);

    // Match players between sources
    const matches = this.fuzzyMatch(sleeperPlayers, nflPlayers);

    const rostersByTeam: RostersByTeam = {};
    const playersIndex: PlayersIndex = {};

    sleeperPlayers.forEach((sleeperPlayer, index) => {
      const match = matches.get(index);
      const name = this.normName(sleeperPlayer.full_name);
      const pos = sleeperPlayer.position;
      const sleeperTeam = this.normTeam(sleeperPlayer.team);

      // Use NFL data team if available, else Sleeper team
      let team: string | null;
      let depthOrder: number | undefined;
      let depthPos: string | undefined;
      let gsisId: string | undefined;

      if (match) {
        team = this.normTeam(match.team) || sleeperTeam;
        depthOrder = match.depth_chart_order;
        depthPos = match.depth_chart_position;
        gsisId = match.gsis_id;
      } else {
        team = sleeperTeam;
        gsisId = sleeperPlayer.gsis_id;
      }

      const playerId = this.makeSitePlayerId(sleeperPlayer.player_id, gsisId || undefined, name);

      // Always add to players index
      playersIndex[playerId] = {
        player_id: playerId,
        name: name || 'Unknown',
        team: team || null,
        pos: pos || 'UNKNOWN',
        source_ids: {
          sleeper: sleeperPlayer.player_id,
          gsis: gsisId,
          espn: sleeperPlayer.espn_id,
          yahoo: sleeperPlayer.yahoo_id
        }
      };

      // Only add to team rosters if we have a team and it's a skill position
      if (team && name && pos && this.SKILL_POSITIONS.includes(pos)) {
        const mergedPlayer: MergedPlayer = {
          player_id: playerId,
          name,
          team,
          pos,
          depth_chart_order: depthOrder,
          depth_chart_position: depthPos,
          source_ids: {
            sleeper: sleeperPlayer.player_id,
            gsis: gsisId,
            espn: sleeperPlayer.espn_id,
            yahoo: sleeperPlayer.yahoo_id
          }
        };

        if (!rostersByTeam[team]) {
          rostersByTeam[team] = [];
        }
        rostersByTeam[team].push(mergedPlayer);
      }
    });

    // Build depth charts
    const depthCharts: DepthCharts = {};
    for (const [team, players] of Object.entries(rostersByTeam)) {
      const positionGroups: { [pos: string]: MergedPlayer[] } = {};
      
      players.forEach(player => {
        if (!positionGroups[player.pos]) {
          positionGroups[player.pos] = [];
        }
        positionGroups[player.pos].push(player);
      });

      // Sort by depth chart order, then by name, and apply position limits
      const teamDepth: { [pos: string]: string[] } = {};
      for (const [pos, posPlayers] of Object.entries(positionGroups)) {
        // Only include skill positions
        if (!this.SKILL_POSITIONS.includes(pos)) continue;
        
        posPlayers.sort((a, b) => {
          const aOrder = a.depth_chart_order ?? 9999;
          const bOrder = b.depth_chart_order ?? 9999;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return a.name.localeCompare(b.name);
        });
        
        // Apply position depth limits
        const limit = this.POSITION_DEPTH_LIMITS[pos] || 10;
        const limitedPlayers = posPlayers.slice(0, limit);
        teamDepth[pos] = limitedPlayers.map(p => p.player_id);
      }
      depthCharts[team] = teamDepth;
    }

    // Write files
    const rostersPath = path.join(STORAGE_DIR, 'rosters.json');
    const depthPath = path.join(STORAGE_DIR, 'depth_charts.json');
    const indexPath = path.join(STORAGE_DIR, 'players_index.json');

    await Promise.all([
      fs.writeFile(rostersPath, JSON.stringify(rostersByTeam, null, 2)),
      fs.writeFile(depthPath, JSON.stringify(depthCharts, null, 2)),
      fs.writeFile(indexPath, JSON.stringify(playersIndex, null, 2))
    ]);

    console.log(`✅ Roster sync complete: ${Object.keys(rostersByTeam).length} teams, ${Object.keys(playersIndex).length} players indexed`);

    return {
      status: 'ok',
      season,
      teams: Object.keys(rostersByTeam).length,
      playersIndexed: Object.keys(playersIndex).length
    };
  }

  async getRosters(): Promise<RostersByTeam> {
    const rostersPath = path.join(STORAGE_DIR, 'rosters.json');
    try {
      const data = await fs.readFile(rostersPath, 'utf-8');
      const allRosters = JSON.parse(data);
      
      // Filter for skill positions only and apply depth limits
      const filteredRosters: RostersByTeam = {};
      for (const [team, players] of Object.entries(allRosters)) {
        const skillPlayers = (players as MergedPlayer[]).filter(p => 
          this.SKILL_POSITIONS.includes(p.pos)
        );
        
        // Group by position and apply limits
        const positionGroups: { [pos: string]: MergedPlayer[] } = {};
        skillPlayers.forEach(player => {
          if (!positionGroups[player.pos]) {
            positionGroups[player.pos] = [];
          }
          positionGroups[player.pos].push(player);
        });
        
        // Apply position limits
        const limitedPlayers: MergedPlayer[] = [];
        for (const [pos, posPlayers] of Object.entries(positionGroups)) {
          const limit = this.POSITION_DEPTH_LIMITS[pos] || 10;
          limitedPlayers.push(...posPlayers.slice(0, limit));
        }
        
        filteredRosters[team] = limitedPlayers;
      }
      
      return filteredRosters;
    } catch (error) {
      throw new Error('No rosters synced yet');
    }
  }

  async getDepthCharts(): Promise<DepthCharts> {
    const depthPath = path.join(STORAGE_DIR, 'depth_charts.json');
    try {
      const data = await fs.readFile(depthPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      throw new Error('No depth charts synced yet');
    }
  }

  async getPlayersIndex(): Promise<PlayersIndex> {
    const indexPath = path.join(STORAGE_DIR, 'players_index.json');
    try {
      const data = await fs.readFile(indexPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      throw new Error('No players index synced yet');
    }
  }
}

export const rosterSyncService = new RosterSyncService();