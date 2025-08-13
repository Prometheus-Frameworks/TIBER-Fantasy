// /server/adp/sleeper.ts
import { z } from "zod";

const SleeperRow = z.object({
  player_id: z.string(),
  adp: z.number().nullable().optional(),
  adp_ppr: z.number().nullable().optional(),
  count: z.number().int().nonnegative().optional(),
  // extra fields ignored
});
type SleeperRow = z.infer<typeof SleeperRow>;

export type AdpRecord = {
  playerId: string;
  adp: number | null;         // PPR ADP if present, else adp
  samples: number;            // count
  fetchedAt: string;          // ISO
  format: "1qb" | "superflex";
};

// Note: This schema was for non-existent ADP endpoints
// Keeping for future reference when real ADP data becomes available
async function fetchJson(url: string): Promise<SleeperRow[]> {
  const res = await fetch(url, { headers: { "accept": "application/json" } });
  if (!res.ok) throw new Error(`Sleeper fetch failed ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) throw new Error("Sleeper: unexpected payload");
  return data.map((r) => SleeperRow.parse(r));
}

// Note: Sleeper doesn't provide direct ADP endpoints - using mock data for now
// Real implementation would aggregate draft pick data from multiple leagues
export async function fetchSleeperAdpQB(
  format: "1qb" | "superflex" = "1qb",
  season = 2025
): Promise<Map<string, AdpRecord>> {
  console.log(`📡 [SLEEPER-ADP] Fetching QB ADP data for ${format} format, season ${season}`);
  
  // Step 1: Get all NFL players from Sleeper
  const playersResponse = await fetch("https://api.sleeper.app/v1/players/nfl");
  if (!playersResponse.ok) {
    throw new Error(`Sleeper players fetch failed ${playersResponse.status}`);
  }
  
  const allPlayers = await playersResponse.json();
  const now = new Date().toISOString();
  const map = new Map<string, AdpRecord>();
  
  // Step 2: Filter for QBs and create mock ADP data
  // In a real implementation, this would aggregate draft data from multiple leagues
  const qbPlayers = Object.entries(allPlayers).filter(([_, player]: [string, any]) => 
    player.position === 'QB' && player.active === true
  );
  
  console.log(`🏈 [SLEEPER-ADP] Found ${qbPlayers.length} active QBs`);
  
  // Mock ADP data based on player metadata (replace with real aggregation later)
  qbPlayers.forEach(([playerId, player]: [string, any], index) => {
    // Generate mock ADP based on various factors
    const baseAdp = generateMockADP(player, format, index);
    const samples = Math.floor(Math.random() * 1000) + 100; // Mock sample size
    
    map.set(playerId, {
      playerId,
      adp: baseAdp,
      samples,
      fetchedAt: now,
      format
    });
  });
  
  console.log(`✅ [SLEEPER-ADP] Generated ADP data for ${map.size} QBs`);
  return map;
}

// Helper function to generate mock ADP (replace with real aggregation)
function generateMockADP(player: any, format: "1qb" | "superflex", index: number): number {
  // Higher draft position players get better (lower) ADP
  let baseAdp = 50 + (index * 5);
  
  // Adjust for superflex (QBs valued higher)
  if (format === "superflex") {
    baseAdp = baseAdp * 0.6; // QBs go much earlier in superflex
  }
  
  // Add some variance
  const variance = (Math.random() - 0.5) * 20;
  
  return Math.max(1, Math.round(baseAdp + variance));
}

export type AdpTierContext = {
  playerId: string;
  adp: number | null;
  priorTier: 1|2|3|4;
  samples: number;
  isStale: boolean;
  fetchedAt: string;
  format: "1qb"|"superflex";
};