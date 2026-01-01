// server/services/wrAdvancedMetricsService.ts
// Advanced WR Metrics for Admin Sandbox - 8 new analytics dimensions

import { db } from '../infra/db';
import { sql } from 'drizzle-orm';

export interface WRAdvancedMetrics {
  playerId: string;
  
  // Weighted Volume
  weightedTargetsPerGame: number;
  weightedTargetsIndex: number;
  
  // Boom/Bust
  boomRate: number;
  bustRate: number;
  
  // Talent
  talentIndex: number;
  yardsPerTarget: number;
  yardsPerRoute: number;
  
  // Stability
  usageStabilityIndex: number;
  
  // Role Delta
  roleDelta: number;
  recentTargetsPerGame: number;
  seasonTargetsPerGame: number;
  
  // Red Zone Dominance
  redZoneDomScore: number;
  redZoneTargetsPerGame: number;
  endZoneTargetsPerGame: number;
  
  // Energy Index
  energyIndex: number;
  efficiencyTrend: number;
}

// ===== SCALING FUNCTIONS (0-100) =====

function scaleWeightedTargets(wtpg: number): number {
  if (wtpg >= 15) return 100;
  if (wtpg >= 13) return 95;
  if (wtpg >= 11) return 90;
  if (wtpg >= 9) return 80;
  if (wtpg >= 7) return 70;
  if (wtpg >= 5) return 60;
  if (wtpg >= 3) return 50;
  return 40;
}

function scaleYardsPerTarget(ypt: number): number {
  if (ypt >= 11) return 100;
  if (ypt >= 9) return 90;
  if (ypt >= 8) return 80;
  if (ypt >= 7) return 70;
  if (ypt >= 6) return 60;
  if (ypt >= 5) return 50;
  return 40;
}

function scaleYardsPerRoute(yprr: number): number {
  if (yprr >= 2.8) return 100;
  if (yprr >= 2.4) return 90;
  if (yprr >= 2.0) return 80;
  if (yprr >= 1.8) return 70;
  if (yprr >= 1.6) return 60;
  if (yprr >= 1.4) return 50;
  return 40;
}

function scaleRoleDelta(delta: number): number {
  if (delta >= 3) return 100;
  if (delta >= 2) return 90;
  if (delta >= 1) return 80;
  if (delta >= 0) return 65;
  if (delta >= -1) return 50;
  if (delta >= -2) return 40;
  return 30;
}

function scaleRedZoneDom(raw: number): number {
  if (raw >= 4.0) return 100;
  if (raw >= 3.0) return 90;
  if (raw >= 2.0) return 80;
  if (raw >= 1.5) return 70;
  if (raw >= 1.0) return 60;
  if (raw >= 0.5) return 50;
  return 40;
}

function scaleBoomRate(rate: number): number {
  if (rate >= 0.60) return 100;
  if (rate >= 0.45) return 85;
  if (rate >= 0.30) return 70;
  if (rate >= 0.20) return 60;
  return 50;
}

function scaleEfficiencyTrend(delta: number): number {
  if (delta >= 0.40) return 100;
  if (delta >= 0.25) return 85;
  if (delta >= 0.10) return 75;
  if (delta >= 0.00) return 65;
  if (delta >= -0.10) return 50;
  if (delta >= -0.25) return 40;
  return 30;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ===== MAIN CALCULATION FUNCTION =====

export async function calculateWRAdvancedMetrics(
  season: number,
  minGames: number = 4,
  momentumScoreMap?: Map<string, number>,
  qualifiedPlayerIds?: string[]
): Promise<Map<string, WRAdvancedMetrics>> {
  
  // Step 1: Get weekly stats for WRs (optionally filtered to qualified players only)
  const weeklyStatsQuery = qualifiedPlayerIds && qualifiedPlayerIds.length > 0
    ? await db.execute(sql`
        SELECT 
          ws.player_id,
          ws.week,
          ws.targets,
          ws.routes,
          ws.rec_yd,
          ws.fantasy_points_ppr
        FROM weekly_stats ws
        INNER JOIN player_identity_map pim ON (pim.gsis_id = ws.player_id OR pim.nfl_data_py_id = ws.player_id)
        WHERE ws.season = ${season}
          AND pim.position = 'WR'
          AND ws.targets IS NOT NULL
          AND ws.player_id = ANY(ARRAY[${sql.raw(qualifiedPlayerIds.map(id => `'${id}'`).join(','))}])
        ORDER BY ws.player_id, ws.week
      `)
    : await db.execute(sql`
        SELECT 
          ws.player_id,
          ws.week,
          ws.targets,
          ws.routes,
          ws.rec_yd,
          ws.fantasy_points_ppr
        FROM weekly_stats ws
        INNER JOIN player_identity_map pim ON (pim.gsis_id = ws.player_id OR pim.nfl_data_py_id = ws.player_id)
        WHERE ws.season = ${season}
          AND pim.position = 'WR'
          AND ws.targets IS NOT NULL
        ORDER BY ws.player_id, ws.week
      `);
  
  const weeklyData = weeklyStatsQuery.rows as {
    player_id: string;
    week: number;
    targets: number;
    routes: number;
    rec_yd: number;
    fantasy_points_ppr: number;
  }[];
  
  // Step 2: Get deep & red zone targets from bronze_nflfastr_plays (optionally filtered)
  const playDataQuery = qualifiedPlayerIds && qualifiedPlayerIds.length > 0
    ? await db.execute(sql`
        SELECT 
          receiver_player_id as player_id,
          COUNT(*) FILTER (WHERE air_yards >= 20) as deep_targets,
          COUNT(*) FILTER (WHERE (raw_data->>'yardline_100')::numeric <= 20) as rz_targets,
          COUNT(*) FILTER (WHERE (raw_data->>'yardline_100')::numeric <= 10 OR (raw_data->>'pass_touchdown')::numeric = 1) as ez_targets
        FROM bronze_nflfastr_plays
        WHERE season = ${season}
          AND receiver_player_id IS NOT NULL
          AND play_type = 'pass'
          AND receiver_player_id = ANY(ARRAY[${sql.raw(qualifiedPlayerIds.map(id => `'${id}'`).join(','))}])
        GROUP BY receiver_player_id
      `)
    : await db.execute(sql`
        SELECT 
          receiver_player_id as player_id,
          COUNT(*) FILTER (WHERE air_yards >= 20) as deep_targets,
          COUNT(*) FILTER (WHERE (raw_data->>'yardline_100')::numeric <= 20) as rz_targets,
          COUNT(*) FILTER (WHERE (raw_data->>'yardline_100')::numeric <= 10 OR (raw_data->>'pass_touchdown')::numeric = 1) as ez_targets
        FROM bronze_nflfastr_plays
        WHERE season = ${season}
          AND receiver_player_id IS NOT NULL
          AND play_type = 'pass'
        GROUP BY receiver_player_id
      `);
  
  const playData = playDataQuery.rows as {
    player_id: string;
    deep_targets: number;
    rz_targets: number;
    ez_targets: number;
  }[];
  
  const playDataMap = new Map<string, typeof playData[0]>();
  playData.forEach(row => playDataMap.set(row.player_id, row));
  
  // Step 3: Group weekly data by player
  type WeeklyRow = typeof weeklyData[0];
  const playerWeeks = new Map<string, WeeklyRow[]>();
  weeklyData.forEach(row => {
    if (!playerWeeks.has(row.player_id)) {
      playerWeeks.set(row.player_id, []);
    }
    playerWeeks.get(row.player_id)!.push(row);
  });
  
  // Step 4: Calculate metrics for each player
  const results = new Map<string, WRAdvancedMetrics>();
  
  for (const [playerId, weeks] of Array.from(playerWeeks.entries())) {
    const gamesPlayed = weeks.length;
    if (gamesPlayed < minGames) continue;
    
    const playStats = playDataMap.get(playerId);
    const deepTargets = playStats?.deep_targets || 0;
    const rzTargets = playStats?.rz_targets || 0;
    const ezTargets = playStats?.ez_targets || 0;
    
    // Calculate aggregates
    const totalTargets = weeks.reduce((sum, w) => sum + (w.targets || 0), 0);
    const totalRoutes = weeks.reduce((sum, w) => sum + (w.routes || 0), 0);
    const totalRecYards = weeks.reduce((sum, w) => sum + (w.rec_yd || 0), 0);
    const totalFantasyPts = weeks.reduce((sum, w) => sum + (w.fantasy_points_ppr || 0), 0);
    
    const targetsPerGame = totalTargets / gamesPlayed;
    const routesPerGame = totalRoutes / gamesPlayed;
    const deepTargetsPerGame = deepTargets / gamesPlayed;
    const rzTargetsPerGame = rzTargets / gamesPlayed;
    const ezTargetsPerGame = ezTargets / gamesPlayed;
    
    // 1. WEIGHTED VOLUME
    const weightedTargetsPerGame = targetsPerGame + (0.75 * deepTargetsPerGame) + (1.25 * rzTargetsPerGame);
    const weightedTargetsIndex = scaleWeightedTargets(weightedTargetsPerGame);
    
    // 2. BOOM/BUST RATES
    const boomGames = weeks.filter(w => (w.fantasy_points_ppr || 0) >= 18).length;
    const bustGames = weeks.filter(w => (w.fantasy_points_ppr || 0) < 8).length;
    const boomRate = gamesPlayed > 0 ? boomGames / gamesPlayed : 0;
    const bustRate = gamesPlayed > 0 ? bustGames / gamesPlayed : 0;
    
    // 3. TALENT INDEX
    const yardsPerTarget = totalTargets > 0 ? totalRecYards / totalTargets : 0;
    const yardsPerRoute = totalRoutes > 0 ? totalRecYards / totalRoutes : 0;
    const yptIndex = scaleYardsPerTarget(yardsPerTarget);
    const yprrIndex = scaleYardsPerRoute(yardsPerRoute);
    const talentIndex = Math.round(0.5 * yptIndex + 0.5 * yprrIndex);
    
    // 4. USAGE STABILITY INDEX
    const targetsArray = weeks.map(w => w.targets || 0);
    const routesArray = weeks.map(w => w.routes || 0);
    const targetsMean = targetsArray.reduce((a, b) => a + b, 0) / targetsArray.length;
    const routesMean = routesArray.reduce((a, b) => a + b, 0) / routesArray.length;
    const targetsVariance = targetsArray.reduce((sum, val) => sum + Math.pow(val - targetsMean, 2), 0) / targetsArray.length;
    const routesVariance = routesArray.reduce((sum, val) => sum + Math.pow(val - routesMean, 2), 0) / routesArray.length;
    const targetsStd = Math.sqrt(targetsVariance);
    const routesStd = Math.sqrt(routesVariance);
    const rawStability = 100 - (targetsStd * 5) - (routesStd * 2);
    const usageStabilityIndex = clamp(Math.round(rawStability), 40, 100);
    
    // 5. ROLE DELTA (recent 3 weeks vs season average)
    const recentWeeks = weeks.slice(-3);
    const recentTargets = recentWeeks.reduce((sum, w) => sum + (w.targets || 0), 0);
    const recentTargetsPerGame = recentWeeks.length > 0 ? recentTargets / recentWeeks.length : targetsPerGame;
    const deltaTargets = recentTargetsPerGame - targetsPerGame;
    const roleDelta = scaleRoleDelta(deltaTargets);
    
    // 6. RED ZONE DOMINANCE
    const rawDom = (rzTargetsPerGame * 1.2) + (ezTargetsPerGame * 2.5);
    const redZoneDomScore = scaleRedZoneDom(rawDom);
    
    // 7. EFFICIENCY TREND (recent 3 weeks vs season)
    const seasonPPRperTarget = totalTargets > 0 ? totalFantasyPts / totalTargets : 0;
    const recentFantasyPts = recentWeeks.reduce((sum, w) => sum + (w.fantasy_points_ppr || 0), 0);
    const recentTargetsTotal = recentWeeks.reduce((sum, w) => sum + (w.targets || 0), 0);
    const recentPPRperTarget = recentTargetsTotal > 0 ? recentFantasyPts / recentTargetsTotal : seasonPPRperTarget;
    const efficiencyTrend = recentPPRperTarget - seasonPPRperTarget;
    
    // 8. ENERGY INDEX (boom + role delta + efficiency trend + momentum)
    const boomIndex = scaleBoomRate(boomRate);
    const efficiencyTrendIndex = scaleEfficiencyTrend(efficiencyTrend);
    
    // Blend momentum from role bank if available
    const momentumScore = momentumScoreMap?.get(playerId) ?? 50; // Default 50 if not found
    
    // Final blend: 25% boom + 25% role delta + 25% efficiency trend + 25% momentum
    const energyIndex = Math.round(
      0.25 * boomIndex + 
      0.25 * roleDelta + 
      0.25 * efficiencyTrendIndex + 
      0.25 * momentumScore
    );
    
    results.set(playerId, {
      playerId,
      weightedTargetsPerGame: Math.round(weightedTargetsPerGame * 10) / 10,
      weightedTargetsIndex,
      boomRate: Math.round(boomRate * 100) / 100,
      bustRate: Math.round(bustRate * 100) / 100,
      talentIndex,
      yardsPerTarget: Math.round(yardsPerTarget * 10) / 10,
      yardsPerRoute: Math.round(yardsPerRoute * 100) / 100,
      usageStabilityIndex,
      roleDelta,
      recentTargetsPerGame: Math.round(recentTargetsPerGame * 10) / 10,
      seasonTargetsPerGame: Math.round(targetsPerGame * 10) / 10,
      redZoneDomScore,
      redZoneTargetsPerGame: Math.round(rzTargetsPerGame * 10) / 10,
      endZoneTargetsPerGame: Math.round(ezTargetsPerGame * 10) / 10,
      energyIndex,
      efficiencyTrend: Math.round(efficiencyTrend * 100) / 100
    });
  }
  
  return results;
}
