import weights from "../config/deepseek.v3.weights.json";
import { sleeperAPI } from "../sleeperAPI";
import { oasisApiService } from "./oasisApiService";

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

// Helper functions for sleeper sync interface
export async function getAllPlayers(): Promise<Base[]> {
  const sleeperPlayers = await sleeperAPI.getAllPlayers();
  const players: Base[] = [];
  
  for (const [playerId, player] of Array.from(sleeperPlayers.entries())) {
    if (!player.position || !['QB', 'RB', 'WR', 'TE'].includes(player.position)) continue;
    
    // Convert sleeper player to our format with sample analytics data
    // Note: In production, these would come from actual analytics services
    const basePlayer: Base = {
      player_id: playerId,
      name: player.full_name || `${player.first_name} ${player.last_name}`,
      pos: player.position as "QB"|"RB"|"WR"|"TE",
      team: player.team || 'FA',
      age: player.age,
      // Sample analytics (would be real data in production)
      routeRate: Math.random() * 0.8 + 0.1, // 0.1-0.9
      tgtShare: Math.random() * 0.3 + 0.05, // 0.05-0.35
      rushShare: Math.random() * 0.4 + 0.05, // 0.05-0.45
      rzTgtShare: Math.random() * 0.2 + 0.02, // 0.02-0.22
      glRushShare: Math.random() * 0.3 + 0.05, // 0.05-0.35
      talentScore: Math.random() * 100, // 0-100
      explosiveness: Math.random() * 100, // 0-100
      yakPerRec: Math.random() * 15 + 2, // 2-17
      last6wPerf: Math.random() * 100, // 0-100
      spikeGravity: Math.random() * 100, // 0-100
      draftCapTier: Math.random() * 100, // 0-100
      injuryRisk: Math.random() * 50, // 0-50
      ageRisk: player.age ? Math.max(0, (player.age - 25) * 10) : 0 // Age penalty
    };
    
    players.push(basePlayer);
  }
  
  return players;
}

export async function getAdpMap(): Promise<Record<string, number>> {
  // Generate sample ADP data for testing
  // In production, this would integrate with actual ADP sources
  const sampleAdp: Record<string, number> = {};
  
  // Add ADP data for top 100 players to ensure sufficient test data
  for (let i = 1; i <= 100; i++) {
    const playerId = i.toString();
    sampleAdp[playerId] = i + Math.floor(Math.random() * 20) - 10; // Realistic ADP spread
  }
  
  return sampleAdp;
}

export async function getSyncHealth(): Promise<boolean> {
  try {
    const players = await sleeperAPI.getAllPlayers();
    return players.size > 0;
  } catch {
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