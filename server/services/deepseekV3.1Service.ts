import fs from 'fs';
import path from 'path';
import { sleeperDataNormalizationService } from "./sleeperDataNormalizationService";
import { xfpRepository } from './xfpRepository';
import { predictXfp, type Row as XfpRow, type Coeffs } from './xfpTrainer';

// Load v3.1 configuration
const configPath = path.join(process.cwd(), 'config', 'deepseek.v3.1.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

type Mode = "dynasty" | "redraft";
type Position = "WR" | "RB" | "TE" | "QB";

interface BasePlayer {
  player_id: string;
  name: string;
  pos: Position;
  team: string;
  age: number;
  
  // Normalized data fields from Sleeper for xFP calculation
  routeRate?: number;
  tgtShare?: number;
  rushShare?: number;
  rzTgtShare?: number;
  glRushShare?: number;
  talentScore?: number;
  explosiveness?: number;
  yakPerRec?: number;
  last6wPerf?: number;
  spikeGravity?: number;
  draftCapTier?: number;
  injuryRisk?: number;
  ageRisk?: number;
  
  // Legacy scores (reduced weight in v3.1)
  contextScore?: number;
  riskScore?: number;
}

interface ScoredPlayer extends BasePlayer {
  xfp: number | null;
  xfpScore: number;
  score: number;
  tier: number;
  rank: number;
}

function normalize01(x: number, min: number, max: number): number {
  if (max <= min) return 0.5;
  return Math.max(0, Math.min(1, (x - min) / (max - min)));
}

function pctScale01to100(p: number): number {
  return Math.round(Math.max(0, Math.min(1, p)) * 100);
}

function passesMinUsage(player: BasePlayer): boolean {
  const minUsage = config.min_usage[player.pos] ?? 0.1;
  const minSnaps = config.min_snaps_per_game;
  
  const snapsOk = (player.snapsPerGame ?? 0) >= minSnaps;
  
  switch (player.pos) {
    case "WR":
    case "TE":
      return (player.routeRate ?? 0) >= minUsage && snapsOk;
    case "RB":
      return ((player.rushShare ?? 0) >= minUsage || (player.routeRate ?? 0) >= minUsage) && snapsOk;
    case "QB":
      return (player.dropbacks ?? 0) >= minUsage * (player.games ?? 1);
    default:
      return false;
  }
}

function computeXfpScore(playersForPos: BasePlayer[], coeffs: Coeffs): Array<BasePlayer & { xfp: number | null; xfpScore: number }> {
  // 1) Compute xFP per player
  const withXfp = playersForPos.map(player => {
    const xfpRow: XfpRow = {
      player_id: player.player_id,
      week: 1, // Not used for prediction
      pos: player.pos as any,
      ppr: null, // Not needed for prediction
      // Use normalized data fields from Sleeper service - debug field access
      routeRate: player.routeRate ?? null,
      tgtShare: player.tgtShare ?? null,
      rzTgtShare: player.rzTgtShare ?? null,
      rushShare: player.rushShare ?? null,
      glRushShare: player.glRushShare ?? null,
      talentScore: player.talentScore ?? null,
      last6wPerf: player.last6wPerf ?? null
    };
    
    const xfp = predictXfp(xfpRow, coeffs);
    return { ...player, xfp };
  }).filter(p => p.xfp !== null);

  if (withXfp.length === 0) {
    return playersForPos.map(p => ({ ...p, xfp: null, xfpScore: 0 }));
  }

  // 2) Normalize within position to 0-100 scale
  const xfpValues = withXfp.map(p => p.xfp!);
  const min = Math.min(...xfpValues);
  const max = Math.max(...xfpValues);
  
  return withXfp.map(p => ({
    ...p,
    xfpScore: pctScale01to100(normalize01(p.xfp!, min, max))
  }));
}

function getTier(score: number): number {
  const cutoffs = config.tiers.cutoffs;
  for (let i = 0; i < cutoffs.length; i++) {
    if (score >= cutoffs[i]) return i + 1;
  }
  return cutoffs.length + 1;
}

export async function buildDeepseekV3_1(mode: Mode, debug: boolean = false): Promise<ScoredPlayer[]> {
  // Note: Health check removed for now - can be added back when getSyncHealth is properly exported

  // Load normalized players and coefficients
  const basePlayers = await sleeperDataNormalizationService.getNormalizedPlayers();
  const coeffs = await xfpRepository.loadAll();

  console.log(`[DeepSeek v3.1] Processing ${basePlayers.length} base players`);
  console.log(`[DeepSeek v3.1] Sample player data:`, basePlayers.slice(0, 2).map(p => ({
    name: p.name, 
    pos: p.pos, 
    team: p.team,
    available_fields: Object.keys(p).slice(0, 20)
  })));
  console.log(`[DeepSeek v3.1] Sample WR data:`, basePlayers.filter(p => p.pos === 'WR').slice(0, 1).map(p => p));

  // Convert all players to BasePlayer format with correct field mapping
  const beforeFilter = basePlayers.map((p: any) => ({
    player_id: p.player_id,
    name: p.name,
    pos: p.pos,
    team: p.team,
    age: p.age,
    // Map normalized fields directly from Sleeper service
    routeRate: p.routeRate,
    tgtShare: p.tgtShare,
    rushShare: p.rushShare,
    rzTgtShare: p.rzTgtShare,
    glRushShare: p.glRushShare,
    talentScore: p.talentScore,
    explosiveness: p.explosiveness,
    yakPerRec: p.yakPerRec,
    last6wPerf: p.last6wPerf,
    spikeGravity: p.spikeGravity,
    draftCapTier: p.draftCapTier,
    injuryRisk: p.injuryRisk,
    ageRisk: p.ageRisk,
    contextScore: p.contextScore,
    riskScore: p.riskScore
  }));

  console.log(`[DeepSeek v3.1] After mapping: ${beforeFilter.length} players`);

  const activePlayers = beforeFilter.filter((p: BasePlayer) => p.pos && ['WR', 'RB', 'TE', 'QB'].includes(p.pos)); // Basic filter for valid positions only

  console.log(`[DeepSeek v3.1] After position filter: ${activePlayers.length} players`);

  // Group by position for xFP calculation
  const positionGroups: Record<Position, BasePlayer[]> = {
    WR: [],
    RB: [],
    TE: [],
    QB: []
  };

  activePlayers.forEach((p: any) => {
    if (positionGroups[p.pos as Position]) {
      positionGroups[p.pos as Position].push(p);
    }
  });

  // Compute xFP scores for each position
  const wrWithXfp = computeXfpScore(positionGroups.WR, coeffs.WR);
  const rbWithXfp = computeXfpScore(positionGroups.RB, coeffs.RB);
  const teWithXfp = computeXfpScore(positionGroups.TE, coeffs.TE);
  const qbWithXfp = computeXfpScore(positionGroups.QB, coeffs.QB);

  // Combine all positions
  const allWithXfp = [...wrWithXfp, ...rbWithXfp, ...teWithXfp, ...qbWithXfp];

  console.log(`[DeepSeek v3.1] Generated xFP scores for ${allWithXfp.length} players`);

  // Apply v3.1 scoring formula with dynasty age adjustments
  const modeWeights = config.modes[mode];
  const scoredPlayers: ScoredPlayer[] = allWithXfp.map(player => {
    // Calculate dynasty age penalty/bonus
    const agePenalty = mode === 'dynasty' ? calculateDynastyAgePenalty(player.age, player.pos) : 0;
    
    // Fix undefined components with proper calculations
    const contextScore = player.contextScore || 50;
    const riskScore = player.riskScore || calculateRiskScore(player.age, player.pos);
    
    // Component calculations for debug
    const xfpComponent = (player.xfpScore || 0) * modeWeights.xfp;
    const talentComponent = (player.talentScore || 50) * modeWeights.talent;
    const recencyComponent = (player.last6wPerf || 50) * modeWeights.recency;
    const contextComponent = contextScore * modeWeights.context;
    const riskComponent = riskScore * modeWeights.risk;
    
    const baseScore = xfpComponent + talentComponent + recencyComponent + contextComponent - riskComponent;
    const finalScore = baseScore + agePenalty;

    const result: any = {
      ...player,
      score: Math.round(finalScore * 100) / 100,
      tier: getTier(finalScore),
      rank: 0, // Will be set after sorting
      agePenalty: mode === 'dynasty' ? agePenalty : undefined
    };

    // Add debug breakdown if requested
    if (debug) {
      result.debug = {
        xfp: Math.round((player.xfpScore || 0) * 100) / 100,
        talent: Math.round((player.talentScore || 50) * 100) / 100,
        recency: Math.round((player.last6wPerf || 50) * 100) / 100,
        context: Math.round(contextScore * 100) / 100,
        risk: Math.round(riskScore * 100) / 100,
        components: {
          xfp_weighted: Math.round(xfpComponent * 100) / 100,
          talent_weighted: Math.round(talentComponent * 100) / 100,
          recency_weighted: Math.round(recencyComponent * 100) / 100,
          context_weighted: Math.round(contextComponent * 100) / 100,
          risk_weighted: Math.round(riskComponent * 100) / 100
        },
        base_score: Math.round(baseScore * 100) / 100,
        age_penalty: agePenalty,
        final_score: Math.round(finalScore * 100) / 100,
        weights: modeWeights
      };
    }

    return result;
  });

  // Sort by score and assign ranks
  scoredPlayers.sort((a, b) => b.score - a.score);
  scoredPlayers.forEach((player, index) => {
    player.rank = index + 1;
  });

  console.log(`[DeepSeek v3.1] Final rankings: ${scoredPlayers.length} players`);
  
  return scoredPlayers;
}

function calculateDynastyAgePenalty(age: number, position: Position): number {
  if (!age) return 0;
  
  // Dynasty age curves by position (penalties for older players, bonuses for young)
  const dynastyAgeTargets = {
    QB: 27,  // QBs peak later
    RB: 24,  // RBs decline fastest  
    WR: 25,  // WRs peak in mid-20s
    TE: 26   // TEs peak slightly later
  };
  
  const targetAge = dynastyAgeTargets[position] || 25;
  const ageDeviation = age - targetAge;
  
  // Aggressive dynasty penalties/bonuses
  if (ageDeviation <= -2) return +15;  // Very young: big bonus
  if (ageDeviation <= -1) return +8;   // Young: bonus
  if (ageDeviation <= 1) return 0;     // Prime: neutral
  if (ageDeviation <= 3) return -8;    // Aging: penalty
  if (ageDeviation <= 5) return -15;   // Old: big penalty
  return -25; // Very old: massive penalty (30+ for RB/WR, 32+ for TE, 34+ for QB)
}

function calculateRiskScore(age: number, position: Position): number {
  if (!age) return 25; // Default risk for unknown age
  
  // Risk increases with age
  let riskScore = 15; // Base risk
  
  // Position-specific age risk
  const ageRiskThresholds = {
    RB: 28,  // RBs age quickly
    WR: 30,  // WRs age moderately
    TE: 31,  // TEs age slower  
    QB: 33   // QBs age slowest
  };
  
  const threshold = ageRiskThresholds[position] || 30;
  if (age > threshold) {
    riskScore += (age - threshold) * 5; // +5 risk per year over threshold
  }
  
  return Math.min(riskScore, 50); // Cap at 50
}

export async function getModelInfo() {
  return await xfpRepository.getModelInfo();
}