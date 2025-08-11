import { sleeperAPI } from './sleeperAPI';
import { wrRatingsService } from './services/wrRatingsService';
import { getAllRBProjections } from './services/rbProjectionsService';
import { calculateRBCompassDetailed } from './rbCompassCalculations';
import { calculateRBPopulationStats } from './rbPopulationStats';
import { computeComponents } from './compassCalculations';

export interface UnifiedPlayer {
  id: string;
  name: string;
  team: string;
  pos: 'QB' | 'RB' | 'WR' | 'TE';
  rank: number;
  proj_pts: number;
  tier: string;
  adp?: number;
  vorp?: number;
  compass?: {
    north: number;
    east: number;
    south: number;
    west: number;
    score: number;
  };
  dynasty_score?: number;
  redraft_score?: number;
  usage_score?: number;
  rookie_grade?: string;
  last_updated: string;
}

export interface PlayerPoolMetadata {
  total_players: number;
  by_position: Record<string, number>;
  last_sync: string;
  data_sources: string[];
}

class UnifiedPlayerService {
  private playerPool: Map<string, UnifiedPlayer> = new Map();
  private lastSync: Date | null = null;
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

  async refreshPlayerPool(): Promise<void> {
    console.log('🔄 Refreshing unified player pool...');
    
    const players = new Map<string, UnifiedPlayer>();
    const timestamp = new Date().toISOString();
    
    try {
      // 1. Get base Sleeper player data for all positions
      const sleeperPlayers = await sleeperAPI.getAllPlayers();
      const relevantPlayers = Object.entries(sleeperPlayers)
        .filter(([_, player]: [string, any]) => 
          player && 
          player.position && 
          ['QB', 'RB', 'WR', 'TE'].includes(player.position) && 
          player.team && 
          player.team !== 'FA' &&
          player.search_rank && 
          player.search_rank < 500 // Focus on top fantasy relevant players
        )
        .slice(0, 250); // Increased limit for better coverage

      // 2. Create base player entries from Sleeper (minimal set - just structure)
      let globalRank = 1;
      for (const [playerId, sleeperPlayer] of relevantPlayers.slice(0, 50)) {
        const player: UnifiedPlayer = {
          id: `${sleeperPlayer.position.toLowerCase()}-${sleeperPlayer.player_id || playerId}`,
          name: `${sleeperPlayer.first_name || ''} ${sleeperPlayer.last_name || ''}`.trim(),
          team: sleeperPlayer.team,
          pos: sleeperPlayer.position as 'QB' | 'RB' | 'WR' | 'TE',
          rank: globalRank++,
          proj_pts: 0, // Will be enhanced below
          tier: 'Tier 4', // Default tier
          last_updated: timestamp
        };
        
        players.set(player.id, player);
      }

      // 3. Add QB projections with actual names and realistic scoring
      const topQBNames = [
        'Josh Allen', 'Lamar Jackson', 'Patrick Mahomes', 'Jalen Hurts',
        'Joe Burrow', 'Dak Prescott', 'Tua Tagovailoa', 'Justin Herbert',
        'Jayden Daniels', 'Brock Purdy', 'Anthony Richardson', 'CJ Stroud'
      ];
      
      topQBNames.forEach((qbName, index) => {
        if (index >= 12) return; // Only top 12
        
        const existingQB = Array.from(players.values()).find(p => 
          p.pos === 'QB' && (
            p.name.toLowerCase().includes(qbName.toLowerCase()) ||
            qbName.toLowerCase().includes(p.name.toLowerCase())
          )
        );
        
        let qbPlayer = existingQB;
        if (!qbPlayer) {
          // Create missing QB entries
          qbPlayer = {
            id: `qb-${qbName.toLowerCase().replace(/\s+/g, '-')}`,
            name: qbName,
            team: 'FA',
            pos: 'QB' as const,
            rank: index + 1,
            proj_pts: 380 - (index * 15),
            tier: 'Tier 3',
            last_updated: timestamp
          };
          players.set(qbPlayer.id, qbPlayer);
        } else {
          qbPlayer.proj_pts = 380 - (index * 15); // Josh Allen = 380, declining by 15
          qbPlayer.tier = index < 4 ? 'Tier 1' : index < 8 ? 'Tier 2' : 'Tier 3';
          qbPlayer.rank = index + 1;
        }
        
        qbPlayer.dynasty_score = qbPlayer.proj_pts * 0.7; // QB positional adjustment
      });

      // 4. Enhance with WR data from CSV ratings
      const wrPlayers = wrRatingsService.getAllWRPlayers();
      for (const wrPlayer of wrPlayers.slice(0, 50)) {
        const playerId = `wr-${wrPlayer.player_name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
        
        const existingPlayer = Array.from(players.values())
          .find(p => p.name.toLowerCase() === wrPlayer.player_name.toLowerCase() || p.id === playerId);
        
        if (existingPlayer && existingPlayer.pos === 'WR') {
          existingPlayer.proj_pts = wrPlayer.fantasy_points_per_game * 17 || existingPlayer.proj_pts;
          existingPlayer.tier = wrPlayer.tier || existingPlayer.tier;
          const compass = computeComponents(wrPlayer, 'wr');
          existingPlayer.compass = compass;
          existingPlayer.dynasty_score = compass.score;
        } else {
          // Add new WR player not in Sleeper data
          const compass = computeComponents(wrPlayer, 'wr');
          const newPlayer: UnifiedPlayer = {
            id: playerId,
            name: wrPlayer.player_name,
            team: wrPlayer.team || 'FA',
            pos: 'WR',
            rank: globalRank++,
            proj_pts: wrPlayer.fantasy_points_per_game * 17 || 250,
            tier: wrPlayer.tier || 'Tier 3',
            compass: compass,
            dynasty_score: compass.score,
            last_updated: timestamp
          };
          players.set(newPlayer.id, newPlayer);
        }
      }

      // 5. Enhance with RB projections and compass data
      const rbProjections = getAllRBProjections();
      const rbPopulationStats = await calculateRBPopulationStats();
      
      for (const rbPlayer of rbProjections.slice(0, 30)) {
        const playerId = `rb-${rbPlayer.player.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}`;
        
        const existingPlayer = Array.from(players.values())
          .find(p => p.name.toLowerCase() === rbPlayer.player.toLowerCase() || p.id === playerId);
        
        const compassPayload = {
          rush_attempts: rbPlayer.rush_att || 150,
          receiving_targets: rbPlayer.receptions ? Math.round(rbPlayer.receptions * 1.2) : 25,
          goal_line_carries: rbPlayer.rush_tds || 4,
          age: 26,
          snap_pct: 0.65,
          dynasty_adp: rbPlayer.adp || 50,
          draft_capital: 'Round 2'
        };
        
        const compass = calculateRBCompassDetailed(compassPayload, rbPopulationStats);
        
        if (existingPlayer && existingPlayer.pos === 'RB') {
          existingPlayer.proj_pts = rbPlayer.points || existingPlayer.proj_pts;
          existingPlayer.adp = rbPlayer.adp;
          existingPlayer.compass = compass;
          existingPlayer.dynasty_score = compass.score;
        } else {
          const newPlayer: UnifiedPlayer = {
            id: playerId,
            name: rbPlayer.player,
            team: 'FA',
            pos: 'RB',
            rank: globalRank++,
            proj_pts: rbPlayer.points || 200,
            tier: 'Tier 3',
            adp: rbPlayer.adp,
            compass: compass,
            dynasty_score: compass.score,
            last_updated: timestamp
          };
          players.set(newPlayer.id, newPlayer);
        }
      }

      // 6. Add TE compass data with actual names and realistic scoring
      const topTENames = [
        'Sam LaPorta', 'Trey McBride', 'George Kittle', 'Travis Kelce',
        'Evan Engram', 'Kyle Pitts', 'Mark Andrews', 'Jake Ferguson',
        'David Njoku', 'Dalton Kincaid', 'T.J. Hockenson', 'Brock Bowers',
        'Isaiah Likely', 'Tucker Kraft', 'Cade Otton'
      ];
      
      topTENames.forEach((teName, index) => {
        if (index >= 15) return; // Only top 15
        
        const existingTE = Array.from(players.values()).find(p => 
          p.pos === 'TE' && (
            p.name.toLowerCase().includes(teName.toLowerCase()) ||
            teName.toLowerCase().includes(p.name.toLowerCase())
          )
        );
        
        let tePlayer = existingTE;
        if (!tePlayer) {
          // Create missing TE entries
          tePlayer = {
            id: `te-${teName.toLowerCase().replace(/\s+/g, '-')}`,
            name: teName,
            team: 'FA',
            pos: 'TE' as const,
            rank: index + 1,
            proj_pts: 200 - (index * 8),
            tier: 'Tier 3',
            last_updated: timestamp
          };
          players.set(tePlayer.id, tePlayer);
        } else {
          tePlayer.proj_pts = 200 - (index * 8); // Sam LaPorta = 200, declining by 8
          tePlayer.tier = index < 3 ? 'Tier 1' : index < 8 ? 'Tier 2' : 'Tier 3';
          tePlayer.rank = index + 1;
        }
        
        // Simplified TE compass calculation
        const compass = {
          north: 75 - (index * 3),
          east: 70 - (index * 2),
          south: 80 - (index * 2),
          west: 65 - (index * 3),
          score: 0
        };
        compass.score = (compass.north + compass.east + compass.south + compass.west) / 4;
        tePlayer.compass = compass;
        tePlayer.dynasty_score = compass.score;
      });

      // 7. Calculate VORP and final rankings
      const allPlayersList = Array.from(players.values());
      const positionGroups = {
        QB: allPlayersList.filter(p => p.pos === 'QB'),
        RB: allPlayersList.filter(p => p.pos === 'RB'),
        WR: allPlayersList.filter(p => p.pos === 'WR'),
        TE: allPlayersList.filter(p => p.pos === 'TE')
      };

      // Calculate VORP for each position
      for (const [pos, group] of Object.entries(positionGroups)) {
        const baseline = pos === 'QB' ? 12 : pos === 'TE' ? 12 : 30;
        const baselineScore = group[baseline]?.proj_pts || 0;
        
        group.forEach(player => {
          player.vorp = Math.max(0, player.proj_pts - baselineScore);
          player.redraft_score = player.proj_pts;
        });

        // Final ranking by position
        group.sort((a, b) => b.proj_pts - a.proj_pts);
        group.forEach((player, index) => {
          player.rank = index + 1;
        });
      }

      this.playerPool = players;
      this.lastSync = new Date();
      
      console.log(`✅ Unified player pool refreshed: ${players.size} players`);
      console.log(`   QB: ${positionGroups.QB.length}, RB: ${positionGroups.RB.length}, WR: ${positionGroups.WR.length}, TE: ${positionGroups.TE.length}`);
      
      // Debug log the first few players
      console.log('🏈 Sample players by position:');
      ['QB', 'RB', 'WR', 'TE'].forEach(pos => {
        const posList = allPlayersList.filter(p => p.pos === pos).slice(0, 3);
        console.log(`   ${pos}: ${posList.map(p => p.name).join(', ')}`);
      });
      
    } catch (error) {
      console.error('❌ Error refreshing player pool:', error);
      throw error;
    }
  }

  async getPlayerPool(filters: {
    pos?: string;
    limit?: number;
    search?: string;
    minRank?: number;
    maxRank?: number;
  } = {}): Promise<UnifiedPlayer[]> {
    
    // Auto-refresh if cache is stale
    if (!this.lastSync || Date.now() - this.lastSync.getTime() > this.CACHE_DURATION) {
      await this.refreshPlayerPool();
    }

    let players = Array.from(this.playerPool.values());

    // Apply filters
    if (filters.pos && filters.pos !== 'ALL') {
      players = players.filter(p => p.pos === filters.pos);
    }

    if (filters.search) {
      const search = filters.search.toLowerCase();
      players = players.filter(p => 
        p.name.toLowerCase().includes(search) ||
        p.team.toLowerCase().includes(search)
      );
    }

    if (filters.minRank) {
      players = players.filter(p => p.rank >= filters.minRank!);
    }

    if (filters.maxRank) {
      players = players.filter(p => p.rank <= filters.maxRank!);
    }

    // Sort by position rank, then by projected points
    players.sort((a, b) => {
      if (a.pos !== b.pos) {
        return a.pos.localeCompare(b.pos);
      }
      return a.rank - b.rank;
    });

    // Apply limit
    if (filters.limit) {
      players = players.slice(0, filters.limit);
    }

    return players;
  }

  async getPlayer(id: string): Promise<UnifiedPlayer | null> {
    if (!this.lastSync || Date.now() - this.lastSync.getTime() > this.CACHE_DURATION) {
      await this.refreshPlayerPool();
    }
    
    return this.playerPool.get(id) || null;
  }

  getMetadata(): PlayerPoolMetadata {
    const players = Array.from(this.playerPool.values());
    const byPosition = players.reduce((acc, player) => {
      acc[player.pos] = (acc[player.pos] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total_players: players.length,
      by_position: byPosition,
      last_sync: this.lastSync?.toISOString() || 'Never',
      data_sources: ['Sleeper API', 'WR Ratings CSV', 'RB Projections', 'Compass Calculations']
    };
  }

  async forceRefresh(): Promise<void> {
    this.lastSync = null; // Force refresh
    await this.refreshPlayerPool();
  }
}

export const unifiedPlayerService = new UnifiedPlayerService();