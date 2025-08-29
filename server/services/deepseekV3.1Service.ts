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

// Enhanced percentile calculation with robust fallbacks
function percentileWithinPos(players: BasePlayer[], pos: string, getter: (p: BasePlayer) => number): (v: number) => number {
  const vals = players.filter(p => p.pos === pos).map(getter).filter(v => Number.isFinite(v));
  const sorted = vals.sort((a, b) => a - b);
  
  return (v: number) => {
    if (!sorted.length || !Number.isFinite(v)) return 50;
    let i = 0; 
    while (i < sorted.length && v >= sorted[i]) i++;
    return Math.max(0, Math.min(100, (i / sorted.length) * 100));
  };
}

function computeXfpScore(playersForPos: BasePlayer[], coeffs: Coeffs, allPlayers: BasePlayer[] = []): Array<BasePlayer & { xfp: number | null; xfpScore: number }> {
  // 1) Compute xFP per player with fallbacks
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
    
    let xfp = predictXfp(xfpRow, coeffs);
    
    // Fallback: if xFP failed, estimate from talent score
    if (xfp === null && player.talentScore) {
      xfp = player.talentScore * 0.3; // Rough conversion
    }
    
    // Final fallback: position baseline
    if (xfp === null) {
      const baselines = { WR: 12, RB: 14, TE: 8, QB: 18 };
      xfp = baselines[player.pos] || 10;
    }
    
    return { ...player, xfp };
  });

  if (withXfp.length === 0) {
    return playersForPos.map(p => ({ ...p, xfp: null, xfpScore: 0 }));
  }

  // 2) Bulletproof min-max normalization within position
  const xfpValues = withXfp.map(p => p.xfp!).filter(v => Number.isFinite(v));
  
  if (xfpValues.length === 0) {
    return withXfp.map(p => ({ ...p, xfpScore: 50 })); // Neutral default
  }
  
  const min = Math.min(...xfpValues);
  const max = Math.max(...xfpValues);
  
  // Guard against zero range (all players have same xFP)
  const range = max - min;
  if (range === 0) {
    return withXfp.map(p => ({ ...p, xfpScore: 50 })); // Neutral when no differentiation
  }
  
  // Debug logging for xFP investigation
  if (withXfp.some(p => p.name?.includes("Chase") || p.name?.includes("Jefferson") || p.name?.includes("Puka"))) {
    console.log(`[xFP BOUNDS DEBUG] Position: ${withXfp[0]?.pos}, Players: ${withXfp.length}`);
    console.log(`[xFP BOUNDS DEBUG] Min raw xFP: ${min.toFixed(2)}, Max raw xFP: ${max.toFixed(2)}, Range: ${range.toFixed(2)}`);
    
    const elites = withXfp.filter(p => p.name?.includes("Chase") || p.name?.includes("Jefferson") || p.name?.includes("Puka"));
    console.log(`[xFP BOUNDS DEBUG] Elite WR raw xFP:`, 
      elites.map(p => ({ name: p.name, raw_xfp: p.xfp?.toFixed(2) }))
    );
  }
  
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

  // Strict active player filtering - fix "half-empty vectors" problem
  const ACTIVE_OK = new Set(["Active", "ACT", "PRACTICE_SQUAD", "Probable", "Questionable", ""]);
  const EXCLUDE_STATUS = new Set(["FA", "RET", "SUS", "PUP", "IR", "NFI", "DNR", "HOLDOUT", "Injured Reserve", "Free Agent"]);
  
  const isActivePlayer = (p: BasePlayer): boolean => {
    // Must be fantasy skill position
    if (!p.pos || !['QB', 'RB', 'WR', 'TE'].includes(p.pos)) return false;
    
    // Team assignment check (allow current NFL teams)
    if (!p.team || p.team === 'FA') return false;
    
    // Must have valid production (xFP or talent score)  
    const hasProduction = (p.talentScore && p.talentScore > 0);
    if (!hasProduction) return false;
    
    // Age check: exclude extremely old players unless elite
    if (p.age && p.age > 35 && (!p.talentScore || p.talentScore < 80)) return false;
    
    return true;
  };

  const activePlayers = beforeFilter.filter(isActivePlayer);

  console.log(`[DeepSeek v3.1] After active player filter: ${activePlayers.length} players`);

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

  // Compute xFP scores for each position with cross-position context
  const wrWithXfp = computeXfpScore(positionGroups.WR, coeffs.WR, activePlayers);
  const rbWithXfp = computeXfpScore(positionGroups.RB, coeffs.RB, activePlayers);
  const teWithXfp = computeXfpScore(positionGroups.TE, coeffs.TE, activePlayers);
  const qbWithXfp = computeXfpScore(positionGroups.QB, coeffs.QB, activePlayers);

  // Combine all positions
  const allWithXfp = [...wrWithXfp, ...rbWithXfp, ...teWithXfp, ...qbWithXfp];

  console.log(`[DeepSeek v3.1] Generated xFP scores for ${allWithXfp.length} players`);

  // Import bulletproof combiner
  const { calculateBounds, calculatePlayerScore, combineScore, logScoringDiagnostics } = await import('./bulletproofCombiner.js');

  // Apply v3.1 scoring formula with bulletproof components
  const modeWeights = config.modes[mode];
  
  // Calculate bounds for bulletproof normalization (WR only for now)
  const wrPlayers = allWithXfp.filter(p => p.pos === 'WR');
  const oppBounds = calculateBounds(wrPlayers, p => 
    0.5 * (p.tgtShare * 8 || 0) + 
    0.3 * (p.tgtShare || 0) + 
    0.2 * (p.routeRate || 0)
  );
  const prodBounds = calculateBounds(wrPlayers, p => 
    0.6 * (p.xfpScore || p.season_fpts || 0) + 
    0.4 * (p.season_fpts || 0)
  );
  const bounds = { opp: oppBounds, prod: prodBounds };
  
  console.log(`[BULLETPROOF] WR Bounds - Opp: ${oppBounds.min.toFixed(2)}-${oppBounds.max.toFixed(2)}, Prod: ${prodBounds.min.toFixed(2)}-${prodBounds.max.toFixed(2)}`);
  
  // Calculate position percentiles for all components (legacy approach - will be replaced)
  const talentPercentile = percentileWithinPos(allWithXfp, 'WR', p => p.talentScore || 0);
  const recencyPercentile = percentileWithinPos(allWithXfp, 'WR', p => p.last6wPerf || 0);
  const explosivePercentile = percentileWithinPos(allWithXfp, 'WR', p => p.explosiveness || 0);
  
  const scoredPlayers: ScoredPlayer[] = allWithXfp.map(player => {
    // Calculate dynasty age penalty/bonus
    const agePenalty = mode === 'dynasty' ? calculateDynastyAgePenalty(player.age, player.pos) : 0;
    
    let finalScore: number;
    
    // Use bulletproof combiner for WR, legacy for others (for now)
    if (player.pos === 'WR') {
      finalScore = calculatePlayerScore(player, mode, bounds) + agePenalty;
      
      // Enhanced diagnostic logging for key players  
      if (player.name?.includes("Chase") || player.name?.includes("Jefferson") || 
          player.name?.includes("Puka") || player.name?.includes("Tyreek") || 
          Math.random() < 0.01) {
        console.log(`[BULLETPROOF DEBUG] ${player.name} (${player.pos}, age ${player.age}):`);
        logScoringDiagnostics(player, {
          ageScore: player.pos === 'WR' ? 100 * Math.max(0, Math.min(1, (32 - (player.age || 26)) / (32 - 21))) : 50,
          oppScore: 50, // Placeholder - will be calculated inside bulletproof combiner
          prodScore: 50 // Placeholder - will be calculated inside bulletproof combiner
        }, finalScore);
      }
    } else {
      // Legacy approach for non-WR positions (temporarily)
      const posPercentiles = {
        RB: percentileWithinPos(allWithXfp, 'RB', p => p.talentScore || 0),
        TE: percentileWithinPos(allWithXfp, 'TE', p => p.talentScore || 0),
        QB: percentileWithinPos(allWithXfp, 'QB', p => p.talentScore || 0)
      };
      
      const recencyPercentiles = {
        RB: percentileWithinPos(allWithXfp, 'RB', p => p.last6wPerf || 0),
        TE: percentileWithinPos(allWithXfp, 'TE', p => p.last6wPerf || 0),
        QB: percentileWithinPos(allWithXfp, 'QB', p => p.last6wPerf || 0)
      };
      
      const talentP = Math.max(
        player.xfpScore || 0,
        posPercentiles[player.pos](player.talentScore || 0)
      );
      
      const recencyP = Math.max(
        recencyPercentiles[player.pos](player.last6wPerf || 0),
        posPercentiles[player.pos](player.talentScore || 0)
      );
      
      const contextScore = player.contextScore || 50;
      const riskScore = player.riskScore || calculateRiskScore(player.age, player.pos);
      
      const xfpComponent = (player.xfpScore || 0) * modeWeights.xfp;
      const talentComponent = talentP * modeWeights.talent;
      const recencyComponent = recencyP * modeWeights.recency;
      const contextComponent = contextScore * modeWeights.context;
      const riskComponent = riskScore * modeWeights.risk;
      
      const baseScore = xfpComponent + talentComponent + recencyComponent + contextComponent - riskComponent;
      finalScore = baseScore + agePenalty;
    }

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
        weights: modeWeights,
        // Sanity check flags
        sanity_flags: getSanityFlags(player, finalScore, agePenalty)
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
  
  // Moderate dynasty penalties/bonuses (reduced from ±25 to ±12)
  if (ageDeviation <= -2) return +8;   // Very young: moderate bonus
  if (ageDeviation <= -1) return +4;   // Young: small bonus
  if (ageDeviation <= 1) return 0;     // Prime: neutral
  if (ageDeviation <= 3) return -4;    // Aging: small penalty
  if (ageDeviation <= 5) return -8;    // Old: moderate penalty
  return -12; // Very old: large penalty (30+ for RB/WR, 32+ for TE, 34+ for QB)
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

function getSanityFlags(player: any, finalScore: number, agePenalty: number): string[] {
  const flags: string[] = [];
  
  // Flag 1: Unknown players with very high scores
  const unknownPlayerHighScore = (player.draftCapTier || 50) < 50 && finalScore > 85;
  if (unknownPlayerHighScore) {
    flags.push("unknown_player_elite_score");
  }
  
  // Flag 2: Age bonus overwhelming talent differences
  const ageBonusOverwhelming = agePenalty > 0 && agePenalty > (player.talentScore || 50) * 0.15;
  if (ageBonusOverwhelming) {
    flags.push("age_bonus_overwhelming");
  }
  
  // Flag 3: Low talent score but high final score
  const lowTalentHighScore = (player.talentScore || 50) < 70 && finalScore > 80;
  if (lowTalentHighScore) {
    flags.push("low_talent_high_score");
  }
  
  // Flag 4: xFP inflation check  
  const xfpInflated = (player.xfpScore || 0) > 95 && (player.talentScore || 50) < 80;
  if (xfpInflated) {
    flags.push("xfp_potentially_inflated");
  }
  
  return flags;
}

export async function getModelInfo() {
  return await xfpRepository.getModelInfo();
}