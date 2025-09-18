import { queryClient } from './queryClient';

export interface PlayerPoolEntry {
  id: string;
  name: string;
  team: string;
  pos: string;
  aliases: string[];
}

export interface PlayerPoolFilters {
  pos?: string;
  team?: string;
  search?: string;
  limit?: number;
}

// In-memory player index cache
let playerIndex: Record<string, { name: string; team: string; pos: string }> = {};
let indexLoaded = false;

// Load player index once on boot
async function loadPlayerIndex() {
  if (indexLoaded) return;
  
  try {
    const response = await fetch('/data/player_index.json');
    if (response.ok) {
      playerIndex = await response.json();
      indexLoaded = true;
      console.log(`✅ Player index loaded: ${Object.keys(playerIndex).length} entries`);
    }
  } catch (error) {
    console.warn('Failed to load player index:', error);
    // Fallback: try to load from API
    try {
      const response = await fetch('/api/player-pool?limit=1000');
      const data = await response.json();
      
      if (data.ok && data.data) {
        playerIndex = {};
        for (const player of data.data) {
          playerIndex[player.id] = {
            name: player.name,
            team: player.team,
            pos: player.pos
          };
        }
        indexLoaded = true;
        console.log(`✅ Player index loaded from API: ${Object.keys(playerIndex).length} entries`);
      }
    } catch (apiError) {
      console.error('Failed to load player index from API:', apiError);
    }
  }
}

// Initialize on import
loadPlayerIndex();

/**
 * Get player name by ID - essential utility used everywhere
 */
export function nameOf(id: string): string {
  if (!indexLoaded) {
    console.warn(`nameOf(${id}) called before index loaded`);
    return id; // Fallback to ID
  }
  
  const player = playerIndex[id];
  return player ? player.name : id;
}

/**
 * Get player info by ID
 */
export function playerOf(id: string): { name: string; team: string; pos: string } | null {
  if (!indexLoaded) return null;
  return playerIndex[id] || null;
}

/**
 * API client for player pool
 */
export const api = {
  async playerPool(filters: PlayerPoolFilters = {}): Promise<PlayerPoolEntry[]> {
    const params = new URLSearchParams();
    
    if (filters.pos) params.append('pos', filters.pos);
    if (filters.team) params.append('team', filters.team);
    if (filters.search) params.append('search', filters.search);
    if (filters.limit) params.append('limit', filters.limit.toString());
    
    const response = await fetch(`/api/player-pool?${params}`);
    const data = await response.json();
    
    if (!data.ok) {
      throw new Error(data.error || 'Failed to fetch player pool');
    }
    
    return data.data;
  },

  async getPlayer(id: string): Promise<PlayerPoolEntry | null> {
    try {
      const response = await fetch(`/api/players/${id}`);
      const data = await response.json();
      return data.ok ? data.data : null;
    } catch (error) {
      console.error(`Failed to get player ${id}:`, error);
      return null;
    }
  },

  async resolvePlayer(id: string): Promise<PlayerPoolEntry | null> {
    // First try exact match
    let player = await this.getPlayer(id);
    if (player) return player;

    // If not found, try to find by name matching
    try {
      // Convert ranking-style IDs to search terms
      // e.g. "ja-marr-chase" -> ["ja", "marr", "chase"]
      const searchTerms = id.toLowerCase()
        .replace(/['-]/g, ' ')
        .split(/\s+/)
        .filter(term => term.length > 1);
      
      if (searchTerms.length > 0) {
        // Search for players that match the name pattern
        const searchQuery = searchTerms.join(' ');
        const allPlayers = await this.playerPool({ search: searchQuery, limit: 50 });
        
        // Try to find exact name match first
        for (const candidate of allPlayers) {
          const candidateName = candidate.name.toLowerCase().replace(/[^\w\s]/g, '');
          const searchName = searchTerms.join(' ').replace(/[^\w\s]/g, '');
          
          if (candidateName.includes(searchName) || searchName.includes(candidateName)) {
            console.log(`✅ Resolved player ID "${id}" -> "${candidate.id}" (${candidate.name})`);
            return candidate;
          }
          
          // Also check aliases
          for (const alias of candidate.aliases) {
            if (alias.toLowerCase().includes(searchName) || searchName.includes(alias.toLowerCase())) {
              console.log(`✅ Resolved player ID "${id}" via alias -> "${candidate.id}" (${candidate.name})`);
              return candidate;
            }
          }
        }
      }
      
      console.warn(`❌ Could not resolve player ID: ${id}`);
      return null;
    } catch (error) {
      console.error(`Failed to resolve player ${id}:`, error);
      return null;
    }
  },

  async rebuildPool(): Promise<boolean> {
    try {
      const response = await fetch('/api/player-pool/rebuild', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.ok) {
        // Invalidate all player pool queries
        queryClient.invalidateQueries({ queryKey: ['/api/player-pool'] });
        queryClient.invalidateQueries({ queryKey: ['/api/players'] });
        
        // Reload index
        indexLoaded = false;
        await loadPlayerIndex();
        
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to rebuild player pool:', error);
      return false;
    }
  }
};

/**
 * React hook for player pool with caching
 */
export function usePlayerPool(filters: PlayerPoolFilters = {}) {
  const queryKey = ['/api/player-pool', filters];
  
  return {
    queryKey,
    queryFn: () => api.playerPool(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (renamed from cacheTime)
  };
}

/**
 * Ensure index is loaded (call this in App.tsx)
 */
export async function ensurePlayerIndexLoaded(): Promise<void> {
  if (!indexLoaded) {
    await loadPlayerIndex();
  }
}