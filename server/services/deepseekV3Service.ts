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

function computeRole(p: Base) {
  const r = (p.routeRate??0)*0.4 + (p.tgtShare??0)*0.4 + (p.rzTgtShare??0)*0.2;
  const rb = (p.rushShare??0)*0.6 + (p.glRushShare??0)*0.4;
  if (p.pos==="RB") return clamp(rb*100);
  if (p.pos==="TE") return clamp(r*95);
  return clamp(r*100);
}

const computeDurability = (p: Base) => clamp(100 - (p.injuryRisk??20)*1.2 - (p.ageRisk??0)*0.8);
const computeRecency = (p: Base) => clamp(p.last6wPerf??0);
const computeRisk = (p: Base) => clamp(0.6*(100-(p.draftCapTier??50)) + 0.4*(p.injuryRisk??20)); // higher=worse
const computeTalent = (p: Base) => clamp((p.talentScore??0)*0.7 + (p.explosiveness??0)*0.2 + (p.yakPerRec??0)*0.1);
const computeSpike = (p: Base) => clamp(p.spikeGravity??0);

export async function buildDeepseekV3(mode: Mode) {
  if (weights.guards.require_sleeper_sync_ok) {
    const ok = await getSyncHealth();
    if (!ok) throw new Error("sleeper_sync_not_ready");
  }

  const cfg = weights.mode_defaults[mode];
  const all = await getAllPlayers();
  const adpMap = await getAdpMap();
  const limited: Base[] = all.slice(0, weights.guards.max_players);

  const rows: Row[] = [];
  for (const p of limited) {
    const [contextScore, roleScore, durabilityScore, recencyScore, talentScoreOut, spikeScore, riskScore] = await Promise.all([
      weights.guards.allow_enrichment ? computeContext(p.team) : Promise.resolve(50),
      Promise.resolve(computeRole(p)),
      Promise.resolve(computeDurability(p)),
      Promise.resolve(computeRecency(p)),
      Promise.resolve(computeTalent(p)),
      Promise.resolve(computeSpike(p)),
      Promise.resolve(computeRisk(p))
    ]);

    const score =
      talentScoreOut * cfg.talent +
      roleScore      * cfg.role +
      contextScore   * cfg.context +
      durabilityScore* cfg.durability +
      recencyScore   * cfg.recency +
      spikeScore     * cfg.spike -
      riskScore      * cfg.risk;

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

  // Attach ADP + delta
  const out = rows.map((r,i)=>{
    const adp = adpMap[r.player_id] ?? null;
    const delta_vs_adp = adp ? Math.round((adp - (i+1))*10)/10 : null;
    return { rank: i+1, ...r, adp, delta_vs_adp };
  });

  if (weights.guards.dry_run) {
    console.log("[DeepSeek v3][dry_run] sample:", out.slice(0,5).map(x=>`${x.rank}. ${x.name} ${x.pos} ${x.score}`));
  }

  return out;
}