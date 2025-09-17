// src/data/resolvers/playerResolver.ts
import { cacheKey, getCache, setCache } from "../cache";
// Note: Import path will be resolved at runtime since server services are available
// This is a cross-boundary import that works in the full-stack setup

type SleeperPlayer = {
  player_id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  team?: string;
  position?: string;
  active?: boolean;
  status?: string; // e.g. "Active", "Injured", "Inactive", etc.
  years_exp?: number; // older retired guys tend to have >10 and no team
};

const ALIASES: Record<string, string> = {
  "marquise brown": "hollywood brown", // Marquise "Hollywood" Brown
  "marquise hollywood brown": "hollywood brown", 
  "hollywood": "hollywood brown",
  "hollywood brown": "hollywood brown", // exact match
  "jaylen warren": "jaylen warren", // exact match
  "juju": "juju smith-schuster",
  "puka": "puka nacua",
  "puka nacua": "puka nacua",
  // add more common nicknames as needed
};

function norm(s?: string) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isActive(p: SleeperPlayer) {
  // Must be explicitly active or have Active status
  const activeStatus = p.active === true || p.status?.toLowerCase() === "active";
  // Exclude explicitly inactive players
  const notInactive = p.status?.toLowerCase() !== "inactive";
  return activeStatus && notInactive;
}

function scoreMatch(needle: string, p: SleeperPlayer) {
  const n = needle;
  const names = [
    norm(p.full_name),
    norm(p.first_name + " " + p.last_name),
    norm(p.last_name + " " + p.first_name),
    norm(p.first_name),
    norm(p.last_name),
  ];
  
  let score = 0;
  for (const cand of names) {
    if (!cand) continue;
    if (cand === n) {
      // Exact match - highest priority
      score = Math.max(score, 1.0);
    } else if (cand.includes(n) && cand.length <= n.length + 3) {
      // Close partial match
      score = Math.max(score, 0.95);
    } else if (cand.includes(n)) {
      // Partial match
      score = Math.max(score, 0.8);
    } else if (n.includes(cand) && cand.length >= 4) {
      // Query contains candidate name (only if candidate is substantial)
      score = Math.max(score, 0.75);
    }
  }
  
  // Position-based scoring boosts
  if (p.position && score > 0) {
    // Boost skill position players over kickers/linemen
    if (['QB', 'RB', 'WR', 'TE'].includes(p.position)) {
      score *= 1.3;
    } else if (p.position === 'K' || p.position === 'DEF') {
      // Slight penalty for kickers and defenses in common name searches
      score *= 0.8;
    }
    
    // Extra boost for specific name patterns
    if (p.position !== 'K' && (n.includes('brown') || n.includes('hollywood'))) {
      score *= 1.2;
    }
  }
  
  // Team context boost - active players on teams are more likely to be searched
  if (p.team && p.team.trim() !== '' && score > 0) {
    score *= 1.1;
  }
  
  return Math.min(score, 1.5); // Allow scores above 1.0 for better differentiation
}

async function loadSleeperMap(): Promise<Record<string, SleeperPlayer>> {
  const key = cacheKey(["sleeper", "players", "map"]);
  const cached = getCache<Record<string, SleeperPlayer>>(key);
  if (cached) {
    console.log(`[playerResolver] Using cached Sleeper data with ${Object.keys(cached).length} players`);
    return cached;
  }

  console.log("[playerResolver] Fetching Sleeper players database...");
  // Sleeper public players JSON
  const url = "https://api.sleeper.app/v1/players/nfl";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`sleeper_players_fetch_failed ${res.status}`);
  const data = (await res.json()) as Record<string, SleeperPlayer>;
  console.log(`[playerResolver] Loaded ${Object.keys(data).length} players from Sleeper API`);
  setCache(key, data, 60 * 60 * 1000); // 1h
  return data;
}

/** Resolve a human name (with optional team/pos) to a Sleeper player object */
export async function resolvePlayer(
  nameOrId: string,
  team?: string,
  position?: string
): Promise<SleeperPlayer | null> {
  try {
    // Try Identity Service first for enhanced resolution
    const identityResult = await resolvePlayerViaIdentityService(nameOrId, team, position);
    if (identityResult) {
      return identityResult;
    }
  } catch (error) {
    console.warn('[playerResolver] Identity service fallback to legacy resolver:', error);
  }

  // Fall back to legacy resolution method
  return await resolvePlayerLegacy(nameOrId, team, position);
}

/** New enhanced resolution via PlayerIdentityService */
async function resolvePlayerViaIdentityService(
  nameOrId: string,
  team?: string,
  position?: string
): Promise<SleeperPlayer | null> {
  try {
    // Dynamically import the service at runtime to avoid build-time dependency issues
    const { playerIdentityService } = await import("../../../server/services/PlayerIdentityService");
    
    // 1. Try direct ID lookup first
    const identityPlayer = await playerIdentityService.getByAnyId(nameOrId);
    if (identityPlayer && identityPlayer.externalIds.sleeper) {
      const db = await loadSleeperMap();
      return db[identityPlayer.externalIds.sleeper] || null;
    }

    // 2. Try name-based search with position filter
    const nameMatches = await playerIdentityService.searchByName(nameOrId, position);
    if (nameMatches.length > 0) {
      // Filter by team if provided
      let bestMatch = nameMatches[0];
      if (team) {
        const teamMatches = nameMatches.filter((m: any) => 
          m.nflTeam?.toLowerCase() === team.toLowerCase()
        );
        if (teamMatches.length > 0) {
          bestMatch = teamMatches[0];
        }
      }

      // Get Sleeper player from canonical ID
      const canonicalPlayer = await playerIdentityService.getByCanonicalId(bestMatch.canonicalId);
      if (canonicalPlayer && canonicalPlayer.externalIds.sleeper) {
        const db = await loadSleeperMap();
        return db[canonicalPlayer.externalIds.sleeper] || null;
      }
    }

    return null;
  } catch (error) {
    // If identity service is not available, return null to fall back to legacy method
    console.warn('[playerResolver] Identity service not available:', error);
    return null;
  }
}

/** Legacy resolution method - unchanged for backward compatibility */
async function resolvePlayerLegacy(
  nameOrId: string,
  team?: string,
  position?: string
): Promise<SleeperPlayer | null> {
  const db = await loadSleeperMap();

  // If they passed a player_id directly, short-circuit
  if (db[nameOrId]) return db[nameOrId];

  const raw = norm(nameOrId);
  const aliasNorm = ALIASES[raw] ? norm(ALIASES[raw]) : raw;

  // Gather candidates and score
  let candidates: { p: SleeperPlayer; score: number }[] = [];
  for (const pid in db) {
    const p = db[pid];
    if (!p) continue;

    // HARD filters first
    if (position && p.position && p.position.toUpperCase() !== position.toUpperCase()) continue;
    if (team && p.team && p.team.toUpperCase() !== team.toUpperCase()) continue;

    // Score the match first
    const s = scoreMatch(aliasNorm, p);
    if (s <= 0) continue; // Skip if no match

    // Prefer active/current players but don't exclude inactive ones entirely
    let adjustedScore = s;
    if (isActive(p)) {
      adjustedScore *= 1.5; // Boost active players significantly
    } else {
      adjustedScore *= 0.3; // Heavy penalty for inactive players
    }

    candidates.push({ p, score: adjustedScore });
  }

  // Sort by score descending and return the best match
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.p ?? null;
}

// Legacy interface for backward compatibility
export interface BasicPlayer {
  id: string;
  name: string;
  team?: string;
  position: "QB" | "RB" | "WR" | "TE" | "DST" | "K";
}

// Convert Sleeper player to BasicPlayer format
function sleeperToBasic(p: SleeperPlayer): BasicPlayer {
  return {
    id: p.player_id,
    name: p.full_name || `${p.first_name} ${p.last_name}`.trim(),
    team: p.team,
    position: p.position as any || "WR"
  };
}

// Legacy sync version for backward compatibility
export function resolvePlayerSync(name: string): BasicPlayer | null {
  console.warn("[playerResolver] Using deprecated sync version. Use async resolvePlayer instead.");
  return null;
}

/** Get player by ID */
export async function getPlayerById(id: string): Promise<BasicPlayer | null> {
  const db = await loadSleeperMap();
  const player = db[id];
  return player ? sleeperToBasic(player) : null;
}

/** Get all loaded players for dropdown population */
export async function getAllPlayers(): Promise<BasicPlayer[]> {
  const db = await loadSleeperMap();
  return Object.values(db)
    .filter(p => p.active !== false)
    .map(sleeperToBasic);
}

// Backward compatibility - maintain local index alongside Sleeper data
let _localPlayersIndex: BasicPlayer[] = [];

/** Load additional players into local index (for backward compatibility) */
export function loadPlayersIndex(players: BasicPlayer[]) {
  _localPlayersIndex = players;
  console.log(`[player-resolver] Loaded ${players.length} player name mappings to local index`);
}

/** Initialize with default NFL players from existing system */
export async function initializeDefaultPlayers() {
  try {
    // Pre-load the Sleeper database
    await loadSleeperMap();
    console.log("✅ Player resolver initialized");
  } catch (error) {
    console.error("[player-resolver] Failed to initialize:", error);
  }
}