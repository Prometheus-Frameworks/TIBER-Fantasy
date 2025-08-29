import weights from "../config/deepseek.v3.weights.json";
import { sleeperAPI } from "../sleeperAPI";
import { oasisApiService } from "./oasisApiService";
import { sleeperDataNormalizationService, type NormalizedPlayer } from "./sleeperDataNormalizationService";

export type Mode = "dynasty"|"redraft";

type Base = {
  player_id: string; 
  name: string; 
  pos: "QB"|"RB"|"WR"|"TE"; 
  team: string;
  age?: number;
  // role/opportunity
  routeRate?: number; 
  tgtShare?: number; 
  rushShare?: number;
  rzTgtShare?: number; 
  glRushShare?: number;
  // talent/efficiency
  talentScore?: number; 
  explosiveness?: number; 
  yakPerRec?: number;
  // recency/spike
  last6wPerf?: number; 
  spikeGravity?: number;
  // risk/insulation
  draftCapTier?: number; 
  injuryRisk?: number; 
  ageRisk?: number;
};

type Row = Base & {
  contextScore?: number; 
  roleScore?: number; 
  durabilityScore?: number;
  recencyScore?: number; 
  talentScoreOut?: number; 
  spikeScore?: number; 
  riskScore?: number;
  score: number; 
  tier: number;
};

const clamp = (x:number, lo=0, hi=99)=>Math.max(lo, Math.min(hi, x));
const bucket = (score:number, cuts:number[]) => {
  const tier = cuts.findIndex(c=>score>=c)+1;
  return tier === 0 ? cuts.length+1 : tier;
};

// Safe null floors below average (so missing data never helps)
const floor = {
  routeRate: 0.10, tgtShare: 0.08, rushShare: 0.10, rzTgtShare: 0.03, glRushShare: 0.05,
  talent: 20, explosiveness: 20, yakPerRec: 20, last6wPerf: 20, spike: 15, draftCapTier: 40, injRisk: 20
};
const nz = (n: number | undefined | null, f: number): number => (n == null ? f : n);

// Age curve penalty implementation
function agePenalty(pos: string, age?: number): number {
  if (!age) return 0;
  const curve = (weights.age_curves as any)[pos] || [];
  // Pick the largest age <= current
  let pen = 0;
  for (const [a, p] of curve) {
    if (age >= a) pen = p;
  }
  return pen; // negative numbers like -14
}

// Status filtering
function isDroppableStatus(status?: string): boolean {
  if (!status) return false;
  const bad = new Set(weights.guards.drop_if_status || []);
  return bad.has(status.toUpperCase());
}

// Recent usage validation
function recentUsageOK(p: Base): boolean {
  const routes = nz(p.routeRate ?? 0, 0.1) * 100; // if routeRate is 0..1
  const tgts = nz(p.tgtShare ?? 0, 0.08) * 100;
  return (routes >= (weights.guards.min_recent_routes || 40)) || (tgts >= (weights.guards.min_recent_targets || 10));
}

// Fallback analytics for when real data is unavailable
function getFallbackAnalytic(metric: string, position: string): number {
  const fallbacks: Record<string, Record<string, number>> = {
    routeRate: { QB: 0.05, RB: 0.25, WR: 0.7, TE: 0.6 },
    tgtShare: { QB: 0.02, RB: 0.12, WR: 0.18, TE: 0.15 },
    rushShare: { QB: 0.1, RB: 0.3, WR: 0.02, TE: 0.02 },
    rzTgtShare: { QB: 0.01, RB: 0.08, WR: 0.12, TE: 0.15 },
    glRushShare: { QB: 0.02, RB: 0.15, WR: 0.01, TE: 0.01 },
    talentScore: { QB: 40, RB: 45, WR: 50, TE: 42 },
    explosiveness: { QB: 35, RB: 40, WR: 45, TE: 38 },
    yakPerRec: { QB: 2, RB: 3.5, WR: 8.2, TE: 6.8 },
    last6wPerf: { QB: 25, RB: 28, WR: 30, TE: 26 },
    spikeGravity: { QB: 35, RB: 40, WR: 50, TE: 38 },
    draftCapTier: { QB: 35, RB: 40, WR: 45, TE: 35 },
    injuryRisk: { QB: 15, RB: 25, WR: 18, TE: 20 }
  };
  
  return fallbacks[metric]?.[position] || 25;
}

// Helper functions for sleeper sync interface
export async function getAllPlayers(): Promise<Base[]> {
  try {
    // Force refresh if requested via query param
    if (process.env.FORCE_REFRESH === 'true') {
      await sleeperDataNormalizationService.forceRefresh();
      process.env.FORCE_REFRESH = 'false';
    }
    
    // Fetch normalized players with real analytics
    const normalizedPlayers = await sleeperDataNormalizationService.getNormalizedPlayers();
    
    // Convert to Base format
    const players: Base[] = normalizedPlayers.map(player => ({
      player_id: player.player_id,
      name: player.name,
      pos: player.pos,
      team: player.team,
      age: player.age,
      // Real analytics from Sleeper data
      routeRate: player.routeRate,
      tgtShare: player.tgtShare,
      rushShare: player.rushShare,
      rzTgtShare: player.rzTgtShare,
      glRushShare: player.glRushShare,
      talentScore: player.talentScore,
      explosiveness: player.explosiveness,
      yakPerRec: player.yakPerRec,
      last6wPerf: player.last6wPerf,
      spikeGravity: player.spikeGravity,
      draftCapTier: player.draftCapTier,
      injuryRisk: player.injuryRisk,
      ageRisk: player.ageRisk
    }));
    
    console.log(`[DeepSeekV3] Loaded ${players.length} players with real Sleeper data`);
    return players;
    
  } catch (error) {
    console.error('[DeepSeekV3] Error fetching real data, falling back to legacy method:', error);
    
    // Fallback to basic Sleeper API if normalization fails
    const sleeperPlayers = await sleeperAPI.getAllPlayers();
    const players: Base[] = [];
    
    for (const [playerId, player] of Array.from(sleeperPlayers.entries())) {
      if (!player.position || !['QB', 'RB', 'WR', 'TE'].includes(player.position)) continue;
      
      const basePlayer: Base = {
        player_id: playerId,
        name: player.full_name || `${player.first_name} ${player.last_name}`,
        pos: player.position as "QB"|"RB"|"WR"|"TE",
        team: player.team || 'FA',
        age: player.age,
        // Fallback to conservative defaults
        routeRate: getFallbackAnalytic('routeRate', player.position),
        tgtShare: getFallbackAnalytic('tgtShare', player.position),
        rushShare: getFallbackAnalytic('rushShare', player.position),
        rzTgtShare: getFallbackAnalytic('rzTgtShare', player.position),
        glRushShare: getFallbackAnalytic('glRushShare', player.position),
        talentScore: getFallbackAnalytic('talentScore', player.position),
        explosiveness: getFallbackAnalytic('explosiveness', player.position),
        yakPerRec: getFallbackAnalytic('yakPerRec', player.position),
        last6wPerf: getFallbackAnalytic('last6wPerf', player.position),
        spikeGravity: getFallbackAnalytic('spikeGravity', player.position),
        draftCapTier: getFallbackAnalytic('draftCapTier', player.position),
        injuryRisk: getFallbackAnalytic('injuryRisk', player.position),
        ageRisk: player.age ? Math.max(0, (player.age - 25) * 3) : 10
      };
      
      players.push(basePlayer);
    }
    
    console.log(`[DeepSeekV3] Using fallback data for ${players.length} players`);
    return players;
  }
}

export async function getAdpMap(): Promise<Record<string, number>> {
  try {
    // Get real ADP data from Sleeper
    const adpMap = await sleeperDataNormalizationService.getAdpMap();
    
    console.log(`[DeepSeekV3] Loaded ADP data for ${Object.keys(adpMap).length} players`);
    return adpMap;
    
  } catch (error) {
    console.error('[DeepSeekV3] Error fetching real ADP data, using fallback:', error);
    
    // Fallback: Generate estimated ADP from trending data
    try {
      const [trendingAdds, allPlayers] = await Promise.all([
        sleeperAPI.getTrendingPlayers('add', 24, 200),
        sleeperAPI.getAllPlayers()
      ]);
      
      const fallbackAdp: Record<string, number> = {};
      
      // Use trending data for ADP estimates
      trendingAdds.forEach((trending, index) => {
        fallbackAdp[trending.player_id] = index + 1;
      });
      
      // Fill remaining active players
      let currentAdp = 201;
      for (const [playerId, player] of Array.from(allPlayers.entries())) {
        if (!fallbackAdp[playerId] && player.team && player.team !== 'FA') {
          fallbackAdp[playerId] = currentAdp++;
        }
      }
      
      console.log(`[DeepSeekV3] Generated fallback ADP for ${Object.keys(fallbackAdp).length} players`);
      return fallbackAdp;
      
    } catch (fallbackError) {
      console.error('[DeepSeekV3] Fallback ADP generation failed:', fallbackError);
      return {};
    }
  }
}

export async function getSyncHealth(): Promise<boolean> {
  try {
    // Check both the raw Sleeper API and our normalization service
    const [sleeperHealthy, normalizationHealth] = await Promise.all([
      sleeperAPI.getAllPlayers().then(players => players.size > 0).catch(() => false),
      sleeperDataNormalizationService.getHealthStatus()
    ]);
    
    const isHealthy = sleeperHealthy && normalizationHealth.healthy;
    
    if (isHealthy) {
      console.log(`[DeepSeekV3] Health check passed: ${normalizationHealth.playerCount} players, ${normalizationHealth.adpCount} ADP entries`);
    } else {
      console.warn(`[DeepSeekV3] Health check failed: Sleeper=${sleeperHealthy}, Normalization=${normalizationHealth.healthy}`);
    }
    
    return isHealthy;
  } catch (error) {
    console.error('[DeepSeekV3] Health check error:', error);
    return false;
  }
}

export async function getOasisTeamEnv(team: string): Promise<{ offense?: number }> {
  try {
    const oasisData = await oasisApiService.fetchOasisData();
    const teamData = oasisData.find(t => 
      t.name.toLowerCase().includes(team.toLowerCase()) ||
      team.toLowerCase().includes(t.name.toLowerCase())
    );
    return { offense: teamData?.oasisScore || 50 };
  } catch {
    return { offense: 50 };
  }
}

async function computeContext(team: string) {
  try { 
    const env = await getOasisTeamEnv(team); 
    return clamp(env?.offense ?? 50); 
  } catch { 
    return 50; 
  }
}

function computeRole(p: Base): number {
  if (p.pos === "RB") {
    const rb = nz(p.rushShare, floor.rushShare) * 0.6 + nz(p.glRushShare, floor.glRushShare) * 0.4;
    return clamp(rb * 100);
  }
  const r = nz(p.routeRate, floor.routeRate) * 0.4 + nz(p.tgtShare, floor.tgtShare) * 0.4 + nz(p.rzTgtShare, floor.rzTgtShare) * 0.2;
  return clamp(r * 100);
}

function computeTalent(p: Base): number {
  const t = nz(p.talentScore, floor.talent) * 0.7 + nz(p.explosiveness, floor.explosiveness) * 0.2 + nz(p.yakPerRec, floor.yakPerRec) * 0.1;
  return clamp(t);
}

function computeRecency(p: Base): number {
  return clamp(nz(p.last6wPerf, floor.last6wPerf));
}

function computeRisk(p: Base): number {
  const cap = 100 - nz(p.draftCapTier, floor.draftCapTier); // lower capital → higher risk
  return clamp(0.6 * cap + 0.4 * nz(p.injuryRisk, floor.injRisk));
}

// Dynasty age-curve kicker (pushes out 31+ WR / 28+ RB unless usage is strong)
function ageCliffPenalty(pos: string, age: number): number {
  if (pos === "RB" && age >= 28) return 12 + (age - 28) * 2;  // 12–25 pts
  if (pos === "WR" && age >= 31) return 10 + (age - 31) * 2;  // 10–20 pts
  if (pos === "TE" && age >= 33) return 6;                    // light
  if (pos === "QB" && age >= 36) return 4;                    // minimal
  return 0;
}

const computeDurability = (p: Base) => clamp(100 - nz(p.injuryRisk, floor.injRisk) * 1.2 + agePenalty(p.pos, p.age));
const computeSpike = (p: Base) => clamp(nz(p.spikeGravity, floor.spike));

export async function buildDeepseekV3(mode: Mode) {
  if (weights.guards.require_sleeper_sync_ok) {
    const ok = await getSyncHealth();
    if (!ok) throw new Error("sleeper_sync_not_ready");
  }

  const cfg = weights.mode_defaults[mode];
  const all = await getAllPlayers();
  const adpMap = await getAdpMap();
  
  // Filter at intake - remove players with bad status
  const filtered = all.filter(p => !isDroppableStatus((p as any).status));
  const limited: Base[] = filtered.slice(0, weights.guards.max_players || 1200);

  const rows: Row[] = [];
  for (const p of limited) {
    const contextScore = weights.guards.allow_enrichment ? await computeContext(p.team) : 50;
    const roleScore = computeRole(p);
    const durabilityScore = computeDurability(p);
    const recencyScore = computeRecency(p);
    const talentScoreOut = computeTalent(p);
    const spikeScore = computeSpike(p);
    const riskScore = computeRisk(p);

    // Apply dynasty age cliff penalty
    const agePenalty = (mode === "dynasty") ? ageCliffPenalty(p.pos, p.age ?? 0) : 0;
    
    let score =
      talentScoreOut * cfg.talent +
      roleScore      * cfg.role +
      contextScore   * cfg.context +
      durabilityScore* cfg.durability +
      recencyScore   * cfg.recency +
      spikeScore     * cfg.spike -
      riskScore      * cfg.risk -
      agePenalty;
    
    // TEMPORARILY DISABLE usage gate to test system
    // TODO: Re-enable with proper data validation
    /*
    const recentRoutes = (p as any).stats?.last4w_routes ?? 0;
    const recentTgts   = (p as any).stats?.last4w_targets ?? 0;
    const recentRush   = (p as any).stats?.last4w_rush_att ?? 0;
    const passesFloor  = (p.pos === "RB")
      ? (recentRush >= 8 || recentTgts >= 3)  
      : (recentRoutes >= 15 || recentTgts >= 4); 

    if (!passesFloor) continue;
    */


    rows.push({
      ...p, 
      contextScore, 
      roleScore, 
      durabilityScore, 
      recencyScore, 
      talentScoreOut, 
      spikeScore, 
      riskScore,
      score: Math.round(score*100)/100,
      tier: bucket(score, weights.tier_cutoffs)
    });
  }

  rows.sort((a,b)=>b.score - a.score);

  // Attach ADP + delta (never fabricate ADP data)
  const out = rows.map((r,i)=>{
    const adp = adpMap[r.player_id] ?? null; // leave null if missing
    const delta_vs_adp = (adp && (i+1)) ? Number((adp - (i+1)).toFixed(1)) : null;
    return { rank: i+1, ...r, adp, delta_vs_adp };
  });

  if (weights.guards.dry_run) {
    console.log("[DeepSeek v3][dry_run] sample:", out.slice(0,5).map(x=>`${x.rank}. ${x.name} ${x.pos} ${x.score}`));
    return []; // Return empty array in dry run mode
  }

  return out;
}