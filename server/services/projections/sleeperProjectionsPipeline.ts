import { sleeperSourceManager, ProjectionSource, SleeperPlayer, SleeperProjection, LeagueMatchupPlayer } from './sleeperSourceManager';
import Fuse from 'fuse.js';

export interface PlayerProjection {
  player_name: string;
  position: string;
  team: string;
  projected_fpts: number;
  receptions: number;
  player_id: string;
  birthdate?: string;
  stats: any;
}

/**
 * Unified Sleeper projections pipeline with dynamic source switching
 */
export class SleeperProjectionsPipeline {
  private fuse: Fuse<any> | null = null;

  /**
   * Initialize Fuse.js for deduplication
   */
  private initializeFuse(players: Record<string, SleeperPlayer>) {
    const playerList = Object.entries(players).map(([id, player]) => ({
      id,
      name: player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim(),
      position: player.position,
      team: player.team
    }));

    this.fuse = new Fuse(playerList, {
      keys: ['name', 'position', 'team'],
      threshold: 0.3,
      includeScore: true
    });
  }

  /**
   * Deduplicate players using Fuse.js
   */
  private deduplicatePlayers(projections: PlayerProjection[]): PlayerProjection[] {
    if (!this.fuse) return projections;

    const uniquePlayers = new Map<string, PlayerProjection>();
    const processedNames = new Set<string>();

    for (const player of projections) {
      const playerKey = `${player.player_name}-${player.position}-${player.team}`;
      
      if (processedNames.has(playerKey)) continue;
      processedNames.add(playerKey);

      // Find potential duplicates
      const searchResults = this.fuse.search(player.player_name);
      const duplicates = searchResults
        .filter(result => result.score! < 0.3)
        .map(result => result.item);

      if (duplicates.length > 1) {
        // Keep the one with highest projected_fpts
        const bestPlayer = duplicates.reduce((best, current) => {
          const currentPlayer = projections.find(p => p.player_id === current.id);
          const bestPlayerData = projections.find(p => p.player_id === best.id);
          
          if (!currentPlayer || !bestPlayerData) return best;
          
          return currentPlayer.projected_fpts > bestPlayerData.projected_fpts ? current : best;
        });

        const bestProjection = projections.find(p => p.player_id === bestPlayer.id);
        if (bestProjection) {
          uniquePlayers.set(playerKey, bestProjection);
        }
      } else {
        uniquePlayers.set(playerKey, player);
      }
    }

    console.log(`🔄 Deduplicated ${projections.length} → ${uniquePlayers.size} players`);
    return Array.from(uniquePlayers.values());
  }

  /**
   * Get projected fantasy points based on league format
   */
  private getProjectedPoints(
    projection: SleeperProjection | LeagueMatchupPlayer, 
    format: string,
    sourceType: 'season' | 'league'
  ): number {
    if (sourceType === 'league') {
      // League projections use starters_points directly
      return (projection as LeagueMatchupPlayer).starters_points || 0;
    }

    // Seasonal projections use Sleeper's native scoring
    const seasonalProj = projection as SleeperProjection;
    
    switch (format) {
      case 'ppr':
        return seasonalProj.pts_ppr || 0;
      case 'half-ppr':
        return seasonalProj.pts_half_ppr || 0;
      case 'standard':
        return seasonalProj.pts_std || 0;
      default:
        return seasonalProj.pts_ppr || seasonalProj.pts_half_ppr || seasonalProj.pts_std || 0;
    }
  }

  /**
   * Main pipeline: fetch, process, and return projections
   */
  async getProjections(
    source: ProjectionSource = { type: 'season' },
    format: string = 'ppr',
    position?: string
  ): Promise<PlayerProjection[]> {
    console.log(`🚀 Starting Sleeper projections pipeline: ${source.type} source, ${format} format`);
    
    try {
      // Step 1: Fetch data with dynamic source switching
      const { players, projections, sourceType } = await sleeperSourceManager.getProjections(source);
      
      // Step 2: Initialize Fuse for deduplication
      this.initializeFuse(players);
      
      // Step 3: Map projections to unified format
      const mappedProjections: PlayerProjection[] = [];
      
      for (const [playerId, projection] of Object.entries(projections)) {
        const player = players[playerId];
        
        if (!player || !['QB', 'RB', 'WR', 'TE'].includes(player.position)) {
          continue;
        }

        // Position filtering
        if (position && position !== 'all' && player.position !== position) {
          continue;
        }

        const playerName = player.full_name || `${player.first_name || ''} ${player.last_name || ''}`.trim();
        const projectedPts = this.getProjectedPoints(projection, format, sourceType);
        
        // Only include players with meaningful projections
        if (projectedPts > 0) {
          mappedProjections.push({
            player_name: playerName,
            position: player.position,
            team: player.team || 'FA',
            projected_fpts: projectedPts,
            receptions: sourceType === 'season' ? (projection as SleeperProjection).rec || 0 : 0,
            player_id: playerId,
            birthdate: player.birth_date,
            stats: projection
          });
        }
      }

      console.log(`📊 Mapped ${mappedProjections.length} fantasy-relevant players`);
      
      // Step 4: Deduplicate using Fuse.js
      const deduplicatedProjections = this.deduplicatePlayers(mappedProjections);
      
      // Step 5: Sort by projected points (descending)
      const sortedProjections = deduplicatedProjections.sort((a, b) => b.projected_fpts - a.projected_fpts);
      
      console.log(`✅ Pipeline complete: ${sortedProjections.length} final projections`);
      console.log(`📡 Source: ${sourceType}, Format: ${format}, Position: ${position || 'all'}`);
      
      return sortedProjections;
      
    } catch (error) {
      console.error('❌ Sleeper projections pipeline failed:', error);
      throw error;
    }
  }

  /**
   * Get cache status
   */
  getCacheStatus() {
    return sleeperSourceManager.getCacheStatus();
  }

  /**
   * Clear cached data for fresh fetches
   */
  clearCache(): void {
    sleeperSourceManager.clearCache();
    console.log('🧹 Sleeper projections pipeline cache cleared');
  }
}

export const sleeperProjectionsPipeline = new SleeperProjectionsPipeline();