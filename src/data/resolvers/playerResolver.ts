// src/data/resolvers/playerResolver.ts
import { cacheKey, getCache, setCache } from "../cache";

type SleeperPlayer = {
  player_id: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  team?: string;
  position?: string;
  active?: boolean;
};

const ALIASES: Record<string, string> = {
  "hollywood brown": "marquise brown",
  "marquise hollywood brown": "marquise brown", 
  "hollywood": "marquise brown",
  "marquise brown": "marquise brown", // exact match
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
  
  // Boost score for non-kickers when looking for skill position players
  if (p.position && p.position !== 'K' && (n.includes('brown') || n.includes('hollywood'))) {
    score *= 1.2;
  }
  
  return Math.min(score, 1.0); // Cap at 1.0
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
  const db = await loadSleeperMap();

  // If they passed a player_id directly, short-circuit
  if (db[nameOrId]) return db[nameOrId];

  const raw = norm(nameOrId);
  const aliasNorm = ALIASES[raw] ? norm(ALIASES[raw]) : raw;

  // Gather candidates and score
  let best: { p: SleeperPlayer; score: number } | null = null;
  for (const pid in db) {
    const p = db[pid];
    if (!p) continue;
    if (position && p.position && p.position.toUpperCase() !== position.toUpperCase()) continue;
    if (team && p.team && p.team.toUpperCase() !== team.toUpperCase()) continue;

    const s = scoreMatch(aliasNorm, p);
    if (s > 0) {
      if (!best || s > best.score) best = { p, score: s };
      // early exit if perfect
      if (s >= 1.0) break;
    }
  }
  return best?.p ?? null;
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