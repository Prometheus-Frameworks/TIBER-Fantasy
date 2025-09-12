// src/data/resolvers/playerResolver.ts
// Resolve "Puka Nacua" → {id, name, team, position} using player index or Sleeper map

export interface BasicPlayer {
  id: string;
  name: string;
  team?: string;
  position: "QB" | "RB" | "WR" | "TE" | "DST" | "K";
}

// In-memory player index for fast name resolution
let _playersByName: Record<string, BasicPlayer> = {};
let _playersById: Record<string, BasicPlayer> = {};

export function loadPlayersIndex(players: BasicPlayer[]) {
  _playersByName = {};
  _playersById = {};
  
  for (const p of players) {
    // Normalize names for better matching
    const normalizedName = p.name.toLowerCase().trim();
    _playersByName[normalizedName] = p;
    _playersById[p.id] = p;
    
    // Add common variations
    const parts = normalizedName.split(' ');
    if (parts.length >= 2) {
      // "first last" format
      const firstLast = `${parts[0]} ${parts[parts.length - 1]}`;
      if (firstLast !== normalizedName) {
        _playersByName[firstLast] = p;
      }
    }
  }
  
  console.log(`[player-resolver] Loaded ${Object.keys(_playersByName).length} player name mappings`);
}

/** Enhanced fuzzy resolution with multiple fallback strategies */
export function resolvePlayer(name: string): BasicPlayer | null {
  if (!name) return null;
  
  const q = name.trim().toLowerCase();
  
  // Exact match
  if (_playersByName[q]) return _playersByName[q];
  
  // StartsWith match
  const startsWithMatch = Object.keys(_playersByName).find(k => k.startsWith(q));
  if (startsWithMatch) return _playersByName[startsWithMatch];
  
  // Contains match (for partial names)
  const containsMatch = Object.keys(_playersByName).find(k => k.includes(q));
  if (containsMatch) return _playersByName[containsMatch];
  
  // Reverse contains (query contains player name)
  const reverseMatch = Object.keys(_playersByName).find(k => q.includes(k));
  if (reverseMatch) return _playersByName[reverseMatch];
  
  return null;
}

/** Get player by ID */
export function getPlayerById(id: string): BasicPlayer | null {
  return _playersById[id] || null;
}

/** Get all loaded players for dropdown population */
export function getAllPlayers(): BasicPlayer[] {
  return Object.values(_playersById);
}

/** Initialize with default NFL players from existing system */
export async function initializeDefaultPlayers() {
  try {
    // Try to get players from existing player pool
    const response = await fetch('/api/player-pool');
    if (response.ok) {
      const data = await response.json();
      const players: BasicPlayer[] = data.players?.map((p: any) => ({
        id: p.id || p.sleeper_id || p.name?.toLowerCase().replace(/\s+/g, '_'),
        name: p.name || p.full_name,
        team: p.team,
        position: p.position,
      })).filter((p: BasicPlayer) => p.name && p.position) || [];
      
      loadPlayersIndex(players);
      return players;
    }
  } catch (error) {
    console.error('[player-resolver] Failed to load from player pool:', error);
  }
  
  // Fallback to minimal set for testing
  const fallbackPlayers: BasicPlayer[] = [
    { id: "josh_allen", name: "Josh Allen", team: "BUF", position: "QB" },
    { id: "lamar_jackson", name: "Lamar Jackson", team: "BAL", position: "QB" },
    { id: "puka_nacua", name: "Puka Nacua", team: "LAR", position: "WR" },
    { id: "cooper_kupp", name: "Cooper Kupp", team: "LAR", position: "WR" },
    { id: "justin_jefferson", name: "Justin Jefferson", team: "MIN", position: "WR" },
    { id: "christian_mccaffrey", name: "Christian McCaffrey", team: "SF", position: "RB" },
    { id: "travis_kelce", name: "Travis Kelce", team: "KC", position: "TE" },
  ];
  
  loadPlayersIndex(fallbackPlayers);
  return fallbackPlayers;
}