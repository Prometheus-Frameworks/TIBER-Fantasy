// server/utils/relevance.ts
// Fantasy-aware player filtering system

export interface PlayerRelevance {
  player_id: string;
  name: string;
  team: string;
  pos: string;
  depth_chart_order?: number;
  years_exp?: number;
  status?: string;
  _relevance?: number;
}

// Hand overrides for must-show names who sometimes get weird depth tags
export const ROOKIE_ALLOWLIST: Record<string, [string, string]> = {
  "Marvin Harrison Jr.": ["ARI", "WR"],
  "Rome Odunze": ["CHI", "WR"],
  "Malik Nabers": ["NYG", "WR"],
  "Brock Bowers": ["LV", "TE"],
  "Brian Thomas Jr.": ["JAX", "WR"],
  "Xavier Worthy": ["KC", "WR"],
  "Keon Coleman": ["BUF", "WR"],
  "Ladd McConkey": ["LAC", "WR"],
  "Ricky Pearsall": ["SF", "WR"],
  "Jonathan Brooks": ["CAR", "RB"],
  "Trey Benson": ["ARI", "RB"],
  "Jayden Daniels": ["WSH", "QB"],
  "Caleb Williams": ["CHI", "QB"],
  "Drake Maye": ["NE", "QB"],
  "J.J. McCarthy": ["MIN", "QB"],
  "Bo Nix": ["DEN", "QB"],
  "Michael Penix Jr.": ["ATL", "QB"]
};

export const EXCLUDED_STATUSES = new Set([
  "Practice Squad", 
  "Reserve/Future", 
  "Suspended", 
  "Out (season)", 
  "Non-Football Injury",
  "IR",
  "PUP"
]);

export const DEFAULT_LIMITS = {
  QB: 2,
  RB: 3,
  WR: 4,
  TE: 2
} as const;

export function isExcludedStatus(status: string | undefined): boolean {
  if (!status) return false;
  const statusStr = status.toString().trim().toLowerCase();
  
  const excludedArray = Array.from(EXCLUDED_STATUSES);
  for (const badStatus of excludedArray) {
    if (statusStr.includes(badStatus.toLowerCase())) {
      return true;
    }
  }
  return false;
}

export function rookieBoost(player: PlayerRelevance): number {
  const name = player.name || "";
  
  // Check allowlist first
  if (name in ROOKIE_ALLOWLIST) {
    const [expectedTeam, expectedPos] = ROOKIE_ALLOWLIST[name];
    if (expectedTeam === player.team && expectedPos === player.pos) {
      return 20; // High boost for premium rookies
    }
  }
  
  // General rookie boost for 0 years experience
  const years = player.years_exp;
  if (years === 0) {
    return 10;
  }
  
  return 0;
}

export function relevanceScore(player: PlayerRelevance): number {
  /**
   * Higher = more fantasy-relevant.
   * Signals we have today:
   *   - depth_chart_order (lower better)
   *   - position role (QB,RB,WR,TE only)
   *   - rookie boost for premium prospects
   * Extend later with ADP/roster%/targets per route/etc.
   */
  
  if (!['QB', 'RB', 'WR', 'TE'].includes(player.pos)) {
    return -1;
  }

  if (isExcludedStatus(player.status)) {
    return -1;
  }

  // Base from depth chart: 100 - order (None -> 0)
  let base = 0;
  if (typeof player.depth_chart_order === 'number') {
    base = Math.max(0, 100 - (player.depth_chart_order - 1) * 10); // 1->100, 2->90, 3->80, etc.
  }

  // Position weighting (QB +10, WR/RB +0, TE -5 so fringe TEs lose tiebreaks)
  const posWeight = player.pos === 'QB' ? 10 : 
                   (['WR', 'RB'].includes(player.pos) ? 0 : -5);

  // Rookie hype
  const rookiePoints = rookieBoost(player);

  return base + posWeight + rookiePoints;
}

export function filterTeam(
  players: PlayerRelevance[], 
  limits: Partial<typeof DEFAULT_LIMITS> = {}
): Record<string, PlayerRelevance[]> {
  /**
   * Return {pos: [player objects kept]} pruned by relevance + limits.
   * Always keeps allowlisted rookies for that team/pos.
   */
  
  const finalLimits = { ...DEFAULT_LIMITS, ...limits };
  const buckets: Record<string, PlayerRelevance[]> = {
    QB: [], RB: [], WR: [], TE: []
  };

  // Score and bucket players
  for (const player of players) {
    if (player.pos in buckets && player.team) {
      const score = relevanceScore(player);
      if (score >= 0) {
        player._relevance = score;
        buckets[player.pos].push(player);
      }
    }
  }

  // Sort and trim each position
  for (const [pos, playerList] of Object.entries(buckets)) {
    // Sort by (depth_chart_order, then relevance desc, then name)
    playerList.sort((a, b) => {
      const aOrder = a.depth_chart_order ?? 9999;
      const bOrder = b.depth_chart_order ?? 9999;
      
      if (aOrder !== bOrder) return aOrder - bOrder;
      
      const aRelevance = a._relevance ?? 0;
      const bRelevance = b._relevance ?? 0;
      if (aRelevance !== bRelevance) return bRelevance - aRelevance;
      
      return (a.name || "").localeCompare(b.name || "");
    });

    // Trim to limit, but ensure allowlisted rookies remain
    const limit = finalLimits[pos as keyof typeof DEFAULT_LIMITS] || 0;
    const trimmed = playerList.slice(0, limit);
    
    // Add any allowlisted rookies not already included for this team/pos
    const namesIncluded = new Set(trimmed.map(p => p.name));
    
    for (const player of playerList.slice(limit)) {
      const name = player.name;
      if (name && name in ROOKIE_ALLOWLIST) {
        const [expectedTeam, expectedPos] = ROOKIE_ALLOWLIST[name];
        if (expectedTeam === player.team && expectedPos === player.pos && !namesIncluded.has(name)) {
          trimmed.push(player);
          namesIncluded.add(name);
        }
      }
    }
    
    buckets[pos] = trimmed;
  }

  return buckets;
}