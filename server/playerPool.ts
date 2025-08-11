import { readFileSync } from 'fs';
import { join } from 'path';

export interface PlayerPoolEntry {
  id: string;
  name: string;
  team: string;
  pos: string;
  aliases: string[];
}

export interface PlayerIndex {
  [id: string]: {
    name: string;
    team: string;
    pos: string;
  };
}

class PlayerPoolService {
  private pool: PlayerPoolEntry[] = [];
  private index: PlayerIndex = {};
  private loaded = false;

  constructor() {
    this.loadData();
  }

  private loadData() {
    try {
      const poolPath = join(process.cwd(), 'data', 'player_pool.json');
      const indexPath = join(process.cwd(), 'data', 'player_index.json');
      
      this.pool = JSON.parse(readFileSync(poolPath, 'utf-8'));
      this.index = JSON.parse(readFileSync(indexPath, 'utf-8'));
      this.loaded = true;
      
      console.log(`✅ Player pool loaded: ${this.pool.length} players`);
    } catch (error) {
      console.error('❌ Failed to load player pool:', error);
      // Fallback to empty arrays
      this.pool = [];
      this.index = {};
    }
  }

  getAllPlayers(): PlayerPoolEntry[] {
    return this.pool;
  }

  getPlayerById(id: string): PlayerPoolEntry | undefined {
    return this.pool.find(p => p.id === id);
  }

  searchPlayers(query: string, position?: string, limit = 50): PlayerPoolEntry[] {
    if (!query || query.length < 2) return [];
    
    const searchTerm = query.toLowerCase().normalize().trim();
    
    return this.pool
      .filter(player => {
        // Filter by position if specified
        if (position && player.pos !== position.toUpperCase()) return false;
        
        // Search in name, team, and aliases
        const matches = [
          player.name.toLowerCase().normalize(),
          player.team.toLowerCase().normalize(),
          player.id.toLowerCase(),
          ...player.aliases.map(a => a.toLowerCase().normalize())
        ];
        
        return matches.some(field => field.includes(searchTerm));
      })
      .slice(0, limit);
  }

  getPlayersByTeam(team: string): PlayerPoolEntry[] {
    const teamCode = team.toUpperCase();
    return this.pool.filter(p => p.team === teamCode);
  }

  getPlayersByPosition(position: string): PlayerPoolEntry[] {
    const pos = position.toUpperCase();
    return this.pool.filter(p => p.pos === pos);
  }

  // Quick lookup using the index
  quickLookup(id: string) {
    return this.index[id];
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  reload(): void {
    console.log('🔄 Reloading player pool...');
    this.loadData();
  }

  getStats() {
    const stats: Record<string, number> = {};
    for (const player of this.pool) {
      stats[player.pos] = (stats[player.pos] || 0) + 1;
    }
    return {
      total: this.pool.length,
      positions: stats,
      lastLoaded: this.loaded ? new Date().toISOString() : null
    };
  }
}

// Export singleton instance
export const playerPoolService = new PlayerPoolService();