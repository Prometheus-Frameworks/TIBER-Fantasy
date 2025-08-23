import { db } from "../../../db";
import { DEFAULT_WEIGHTS, REPLACEMENT_LINES, type Position, type Format, parseWeights } from "./weights";

interface PlayerInputsRow {
  player_id: string;
  name: string;
  position: string;
  team: string;
  snap_pct?: number;
  routes?: number;
  tprr?: number;
  rush_share?: number;
  target_share?: number;
  goalline_share?: number;
  two_min_share?: number;
  yprr?: number;
  yac_per_rec?: number;
  mtf?: number;
  succ_rate?: number;
  epa_per_play_qb?: number;
  team_epa_play?: number;
  team_pace?: number;
  team_rz_plays?: number;
  team_pass_rate?: number;
  injury_status?: string;
  dnp_weeks_rolling?: number;
  sos_ctx?: number;
}

interface DynastyPlayerRow {
  player_id: string;
  name: string;
  position: string;
  team: string;
  age?: number;
  draft_round?: number;
  draft_pick?: number;
  age_multiplier?: number;
  avg_snap_pct?: number;
  avg_routes?: number;
  avg_tprr?: number;
  avg_rush_share?: number;
  avg_target_share?: number;
  avg_goalline_share?: number;
  avg_two_min_share?: number;
  avg_yprr?: number;
  avg_yac_per_rec?: number;
  avg_mtf?: number;
  avg_succ_rate?: number;
  avg_epa_per_play_qb?: number;
  avg_team_epa_play?: number;
  avg_team_pace?: number;
}

// Helpers
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const pct = (x: number) => Math.round(clamp01(x) * 100);

// Simple percentile utility from array of numbers
function percentileRank(values: number[], v: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a,b)=>a-b);
  let idx = 0;
  while (idx < sorted.length && sorted[idx] <= v) idx++;
  return (idx / sorted.length) * 100;
}

// Fixed VOR calculation function
function computeVORForSlice(scores: number[], position: Position): number[] {
  // Sort scores descending to get proper rankings
  const sortedScores = [...scores].sort((a, b) => b - a);
  
  // Get replacement rank (1-based to 0-based index)
  const replacementRank = REPLACEMENT_LINES[position];
  const replIdx = Math.max(0, Math.min(sortedScores.length - 1, replacementRank - 1));
  const replacementScore = sortedScores[replIdx] || 0;
  
  // Calculate VOR for each player: score - replacement_score
  return scores.map(score => score - replacementScore);
}

// DeepSeek tier clustering: hierarchical, min tier size = 3 (no single-player tiers)
function computeTiers(scores: number[]): number[] {
  if (scores.length === 0) return [];
  if (scores.length < 3) return scores.map(() => 1); // All in tier 1 if < 3 players
  
  const indexed = scores.map((score, idx) => ({ score, idx }));
  indexed.sort((a, b) => b.score - a.score); // Sort by score descending
  
  const tiers: number[] = new Array(scores.length);
  const gaps: Array<{ gap: number, idx: number }> = [];
  
  // Calculate score gaps
  for (let i = 1; i < indexed.length; i++) {
    gaps.push({ 
      gap: indexed[i-1].score - indexed[i].score, 
      idx: i 
    });
  }
  
  // Sort gaps by size (largest first) for natural tier breaks
  gaps.sort((a, b) => b.gap - a.gap);
  
  // Find tier boundaries, ensuring min tier size of 3
  const tierBoundaries = [0]; // Start of tier 1
  let currentTier = 1;
  
  for (const gapInfo of gaps) {
    const potentialBoundary = gapInfo.idx;
    
    // Check if this boundary would create tiers with at least 3 players
    let validBoundary = true;
    const testBoundaries = [...tierBoundaries, potentialBoundary].sort((a, b) => a - b);
    
    for (let i = 0; i < testBoundaries.length; i++) {
      const start = testBoundaries[i];
      const end = testBoundaries[i + 1] || indexed.length;
      const tierSize = end - start;
      
      if (tierSize < 3 && indexed.length >= 6) { // Only enforce min size if we have enough players
        validBoundary = false;
        break;
      }
    }
    
    if (validBoundary && tierBoundaries.length < 4) { // Max 4 tiers
      tierBoundaries.push(potentialBoundary);
    }
  }
  
  tierBoundaries.sort((a, b) => a - b);
  
  // Assign tiers based on boundaries
  for (let i = 0; i < indexed.length; i++) {
    let tier = 1;
    for (let j = 1; j < tierBoundaries.length; j++) {
      if (i >= tierBoundaries[j]) {
        tier = j + 1;
      } else {
        break;
      }
    }
    tiers[indexed[i].idx] = tier;
  }
  
  return tiers;
}

export async function computeRedraftWeek(
  season: number, 
  week: number, 
  position: Position, 
  weightsOverride?: string
): Promise<number> {
  // 1) Pull inputs for this week + position
  // Try direct template string approach for Neon compatibility
  const query = `SELECT i.*, p.name
     FROM player_inputs i
     JOIN player_profile p ON p.player_id = i.player_id
     WHERE i.season = ${season} AND i.week = ${week} AND i.position = '${position}'`;
  
  const rows = await db.execute(query);

  if (!rows.rows.length) return 0;

  const data = rows.rows.map((row: any) => ({
    player_id: row.player_id,
    name: row.name,
    ...row
  } as PlayerInputsRow));

  // 2) Derive components
  const oppVals = data.map(r => {
    // Position-aware opportunity proxy
    if (position === "RB") return clamp01(0.6*(r.rush_share||0) + 0.4*(r.target_share||0));
    if (position === "WR" || position === "TE") return clamp01(0.6*(r.routes||0)/40 + 0.4*(r.tprr||0));
    if (position === "QB") return clamp01((r.team_pass_rate||0) + 0.2);
    return 0;
  });

  const effVals = data.map(r => {
    if (position === "RB") return clamp01(0.5*(r.succ_rate||0) + 0.5*((r.yac_per_rec||0)/6));
    if (position === "WR" || position === "TE") return clamp01((r.yprr||0)/3);
    if (position === "QB") return clamp01(((r.epa_per_play_qb||0)+0.3)/0.6);
    return 0;
  });

  const roleVals = data.map(r => 
    clamp01(0.5*(r.snap_pct||0)/100 + 0.25*(r.goalline_share||0) + 0.25*(r.two_min_share||0))
  );
  
  const teamVals = data.map(r => 
    clamp01(0.5*((r.team_epa_play||0)+0.25)/0.5 + 0.5*(r.team_pace||0)/70)
  );
  
  const healthVals = data.map(r => {
    const dnp = r.dnp_weeks_rolling||0;
    const inj = (r.injury_status||'healthy').toLowerCase();
    let penalty = 0;
    if (inj === 'questionable') penalty = -5;
    if (inj === 'out') penalty = -10;
    penalty += Math.min(-20, penalty - dnp * 3); // Cap health penalty at -20
    return Math.max(-20, Math.min(5, penalty)); // DeepSeek spec: cap at -20
  });
  
  const sosVals = data.map(r => clamp01((r.sos_ctx||50)/100));

  // 3) Percentile within position for main components
  const oppPct = data.map((_, i)=>percentileRank(oppVals, oppVals[i]));
  const effPct = data.map((_, i)=>percentileRank(effVals, effVals[i]));
  const rolePct= data.map((_, i)=>percentileRank(roleVals, roleVals[i]));
  const teamPct= data.map((_, i)=>percentileRank(teamVals, teamVals[i]));
  const sosPct = data.map((_, i)=>percentileRank(sosVals, sosVals[i]));

  const w = parseWeights(weightsOverride, 'redraft', position) as any;

  // 4) Composite 0..100
  const scores = data.map((r, i) => {
    const base =
      w.opp * oppPct[i] +
      w.eff * effPct[i] +
      w.role* rolePct[i] +
      w.team* teamPct[i] +
      w.sos * sosPct[i];

    // Health as additive adjustment (DeepSeek spec: direct additive)
    const healthAdj = healthVals[i]; // Already capped at -20 to +5
    return Math.max(0, Math.min(100, base + healthAdj));
  });

  // 5) VOR (value over replacement) by position - FIXED
  const vors = computeVORForSlice(scores, position);

  // 6) Tiers
  const tiers = computeTiers(scores);

  // 7) Persist to database
  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    await db.execute(
      `INSERT INTO player_scores
         (player_id, season, week, format, position, score, vor, tier, weights_json, debug_json)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (player_id, season, week, format)
       DO UPDATE SET 
         score = $11, vor = $12, tier = $13, weights_json = $14, debug_json = $15`,
      [
      r.player_id, season, week, 'redraft', position,
      scores[i], vors[i], tiers[i], 
      JSON.stringify(w),
      JSON.stringify({
        opp_pct: Math.round(oppPct[i]),
        eff_pct: Math.round(effPct[i]),
        role_pct: Math.round(rolePct[i]),
        team_pct: Math.round(teamPct[i]),
        sos_pct: Math.round(sosPct[i]),
        health_adj: Math.round(healthVals[i] * 100) / 100,
        opp_weighted: Math.round((w.opp * oppPct[i]) * 100) / 100,
        eff_weighted: Math.round((w.eff * effPct[i]) * 100) / 100,
        role_weighted: Math.round((w.role * rolePct[i]) * 100) / 100,
        team_weighted: Math.round((w.team * teamPct[i]) * 100) / 100,
        sos_weighted: Math.round((w.sos * sosPct[i]) * 100) / 100,
        health_weighted: Math.round((w.health * healthVals[i]) * 100) / 100,
        calc_check: Math.round(((w.opp * oppPct[i]) + (w.eff * effPct[i]) + (w.role * rolePct[i]) + (w.team * teamPct[i]) + (w.sos * sosPct[i]) + (w.health * healthVals[i])) * 100) / 100,
        final_score: Math.round(scores[i] * 100) / 100,
        weights: w
      }),
      // Conflict resolution values
        scores[i], vors[i], tiers[i], 
        JSON.stringify(w),
        JSON.stringify({
          opp_pct: Math.round(oppPct[i]),
          eff_pct: Math.round(effPct[i]),
          role_pct: Math.round(rolePct[i]),
          team_pct: Math.round(teamPct[i]),
          sos_pct: Math.round(sosPct[i]),
          health_adj: Math.round(healthVals[i] * 100) / 100,
          opp_weighted: Math.round((w.opp * oppPct[i]) * 100) / 100,
          eff_weighted: Math.round((w.eff * effPct[i]) * 100) / 100,
          role_weighted: Math.round((w.role * rolePct[i]) * 100) / 100,
          team_weighted: Math.round((w.team * teamPct[i]) * 100) / 100,
          sos_weighted: Math.round((w.sos * sosPct[i]) * 100) / 100,
          health_weighted: Math.round((w.health * healthVals[i]) * 100) / 100,
          calc_check: Math.round(((w.opp * oppPct[i]) + (w.eff * effPct[i]) + (w.role * rolePct[i]) + (w.team * teamPct[i]) + (w.sos * sosPct[i]) + (w.health * healthVals[i])) * 100) / 100,
          final_score: Math.round(scores[i] * 100) / 100,
          weights: w
        })
      ]
    );
  }

  return data.length;
}

export async function computeDynastySeason(
  season: number, 
  position: Position, 
  weightsOverride?: string
): Promise<number> {
  // Dynasty compute: aggregate season data + age curves + 3-year projections
  const rows = await db.execute(
    `SELECT 
       p.player_id, p.name, p.position, p.team, p.age,
       p.draft_round, p.draft_pick,
       AVG(i.snap_pct) as avg_snap_pct,
       AVG(i.routes) as avg_routes,
       AVG(i.tprr) as avg_tprr,
       AVG(i.rush_share) as avg_rush_share,
       AVG(i.target_share) as avg_target_share,
       AVG(i.goalline_share) as avg_goalline_share,
       AVG(i.two_min_share) as avg_two_min_share,
       AVG(i.yprr) as avg_yprr,
       AVG(i.yac_per_rec) as avg_yac_per_rec,
       AVG(i.mtf) as avg_mtf,
       AVG(i.succ_rate) as avg_succ_rate,
       AVG(i.epa_per_play_qb) as avg_epa_per_play_qb,
       AVG(i.team_epa_play) as avg_team_epa_play,
       AVG(i.team_pace) as avg_team_pace,
       COALESCE(ac.multiplier, 1.0) as age_multiplier
     FROM player_profile p
     LEFT JOIN player_inputs i ON p.player_id = i.player_id AND i.season = ?
     LEFT JOIN age_curves ac ON p.position = ac.position AND CAST(p.age AS INTEGER) = ac.age
     WHERE p.position = ?
     GROUP BY p.player_id, p.name, p.position, p.team, p.age, p.draft_round, p.draft_pick, ac.multiplier
     HAVING COUNT(i.player_id) > 0`,
    [season, position]
  );

  if (!rows.rows.length) return 0;

  const data = rows.rows.map((row: any) => ({ ...row } as DynastyPlayerRow));

  // Dynasty components - DeepSeek 3-year projection with proper decay
  const proj3Vals = data.map(r => {
    // Base current season projection from opportunity and efficiency
    const oppScore = (r.avg_snap_pct||0)/100 * 0.6 + (r.avg_target_share||0) * 0.4;
    const effScore = (r.avg_yprr||0)/3 * 0.6 + (r.avg_succ_rate||0) * 0.4;
    const currentProj = clamp01((oppScore + effScore) / 2);
    
    // 3-year projection: 60% year1, 25% year2, 15% year3
    // Apply aging decay: year 2 = 95%, year 3 = 85% of current
    const year1 = currentProj * 0.60;
    const year2 = currentProj * 0.95 * 0.25;
    const year3 = currentProj * 0.85 * 0.15;
    
    return clamp01(year1 + year2 + year3);
  });

  const ageVals = data.map(r => r.age_multiplier || 1.0);
  
  const roleVals = data.map(r => 
    clamp01(0.5*(r.avg_snap_pct||0)/100 + 0.25*(r.avg_goalline_share||0) + 0.25*(r.avg_two_min_share||0))
  );
  
  const effVals = data.map(r => {
    if (position === "RB") return clamp01(0.5*(r.avg_succ_rate||0) + 0.5*((r.avg_yac_per_rec||0)/6));
    if (position === "WR" || position === "TE") return clamp01((r.avg_yprr||0)/3);
    if (position === "QB") return clamp01(((r.avg_epa_per_play_qb||0)+0.3)/0.6);
    return 0;
  });
  
  const teamVals = data.map(r => 
    clamp01(0.5*((r.avg_team_epa_play||0)+0.25)/0.5 + 0.5*(r.avg_team_pace||0)/70)
  );

  const pedVals = data.map(r => {
    // Prospect pedigree: draft capital + breakout age proxy
    const draftScore = r.draft_round ? clamp01(1 - (r.draft_round - 1) / 7) : 0.3;
    const ageScore = r.age ? clamp01(1 - (r.age - 21) / 5) : 0.5;
    return clamp01(0.6 * draftScore + 0.4 * ageScore);
  });

  // Percentile normalization
  const proj3Pct = data.map((_, i)=>percentileRank(proj3Vals, proj3Vals[i]));
  const agePct = data.map((_, i)=>percentileRank(ageVals, ageVals[i]));
  const rolePct = data.map((_, i)=>percentileRank(roleVals, roleVals[i]));
  const effPct = data.map((_, i)=>percentileRank(effVals, effVals[i]));
  const teamPct = data.map((_, i)=>percentileRank(teamVals, teamVals[i]));
  const pedPct = data.map((_, i)=>percentileRank(pedVals, pedVals[i]));

  const w = parseWeights(weightsOverride, 'dynasty', position) as any;

  // Dynasty composite score
  const scores = data.map((r, i) => {
    const base =
      w.proj3 * proj3Pct[i] +
      w.age * agePct[i] +
      w.role * rolePct[i] +
      w.eff * effPct[i] +
      w.team * teamPct[i] +
      w.ped * pedPct[i];

    return Math.max(0, Math.min(100, base));
  });

  // VOR and tiers - FIXED
  const vors = computeVORForSlice(scores, position);
  const tiers = computeTiers(scores);

  // Persist to database
  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    await db.execute(
      `INSERT INTO player_scores
         (player_id, season, week, format, position, score, vor, tier, weights_json, debug_json)
       VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (player_id, season, week, format)
       DO UPDATE SET 
         score = $10, vor = $11, tier = $12, weights_json = $13, debug_json = $14`,
      [
      r.player_id, season, 'dynasty', position,
      scores[i], vors[i], tiers[i], 
      JSON.stringify(w),
      JSON.stringify({
        proj3_pct: Math.round(proj3Pct[i]),
        age_pct: Math.round(agePct[i]),
        role_pct: Math.round(rolePct[i]),
        eff_pct: Math.round(effPct[i]),
        team_pct: Math.round(teamPct[i]),
        ped_pct: Math.round(pedPct[i]),
        proj3_weighted: Math.round((w.proj3 * proj3Pct[i]) * 100) / 100,
        age_weighted: Math.round((w.age * agePct[i]) * 100) / 100,
        role_weighted: Math.round((w.role * rolePct[i]) * 100) / 100,
        eff_weighted: Math.round((w.eff * effPct[i]) * 100) / 100,
        team_weighted: Math.round((w.team * teamPct[i]) * 100) / 100,
        ped_weighted: Math.round((w.ped * pedPct[i]) * 100) / 100,
        calc_check: Math.round(((w.proj3 * proj3Pct[i]) + (w.age * agePct[i]) + (w.role * rolePct[i]) + (w.eff * effPct[i]) + (w.team * teamPct[i]) + (w.ped * pedPct[i])) * 100) / 100,
        final_score: Math.round(scores[i] * 100) / 100,
        weights: w
      }),
      // Conflict resolution values
        scores[i], vors[i], tiers[i], 
        JSON.stringify(w),
        JSON.stringify({
          proj3_pct: Math.round(proj3Pct[i]),
          age_pct: Math.round(agePct[i]),
          role_pct: Math.round(rolePct[i]),
          eff_pct: Math.round(effPct[i]),
          team_pct: Math.round(teamPct[i]),
          ped_pct: Math.round(pedPct[i]),
          proj3_weighted: Math.round((w.proj3 * proj3Pct[i]) * 100) / 100,
          age_weighted: Math.round((w.age * agePct[i]) * 100) / 100,
          role_weighted: Math.round((w.role * rolePct[i]) * 100) / 100,
          eff_weighted: Math.round((w.eff * effPct[i]) * 100) / 100,
          team_weighted: Math.round((w.team * teamPct[i]) * 100) / 100,
          ped_weighted: Math.round((w.ped * pedPct[i]) * 100) / 100,
          calc_check: Math.round(((w.proj3 * proj3Pct[i]) + (w.age * agePct[i]) + (w.role * rolePct[i]) + (w.eff * effPct[i]) + (w.team * teamPct[i]) + (w.ped * pedPct[i])) * 100) / 100,
          final_score: Math.round(scores[i] * 100) / 100,
          weights: w
        })
      ]
    );
  }

  return data.length;
}