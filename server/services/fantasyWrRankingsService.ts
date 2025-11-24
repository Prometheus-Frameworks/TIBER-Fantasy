// server/services/fantasyWrRankingsService.ts
// Fantasy-Focused WR Rankings Layer - sits on top of WR Role Bank v2.0
// Does NOT modify existing role bank computation - purely additive

import { db } from '../infra/db';
import { weeklyStats, wrRoleBank, playerIdentityMap } from '../../shared/schema';
import { sql, eq, and } from 'drizzle-orm';

// ---- Types ----

export interface FantasyWRRankingRow {
  playerId: string;
  playerName: string;
  team: string | null;
  season: number;
  
  // Fantasy-focused scores
  fantasyWRScore: number;
  volumeIndex: number;
  ppgIndex: number;
  spiceIndex: number;
  
  // Supporting metrics
  fantasyPointsPprPerGame: number;
  targetsPerGame: number;
  targetShareAvg: number | null;
  routesPerGame: number | null;
  
  // WR Role Bank context (for reference)
  pureRoleScore: number | null;
  roleScore: number;
  tier: string;
  
  // Raw data
  gamesPlayed: number;
}

// ---- Scaling Functions (0-100) ----

// VolumeIndex components - reuse WR Role Bank scaling logic
function scaleTargetsPerGame(tpg: number): number {
  if (tpg >= 12) return 100;
  if (tpg >= 10) return 90;
  if (tpg >= 8) return 75;
  if (tpg >= 6) return 55;
  if (tpg >= 4) return 35;
  if (tpg >= 2) return 20;
  return 10;
}

function scaleTargetShare(share: number): number {
  if (share >= 0.30) return 100;
  if (share >= 0.27) return 90;
  if (share >= 0.24) return 80;
  if (share >= 0.20) return 65;
  if (share >= 0.15) return 45;
  if (share >= 0.10) return 30;
  return 15;
}

function scaleRoutesPerGame(rpg: number): number {
  if (rpg >= 33) return 100;
  if (rpg >= 30) return 90;
  if (rpg >= 27) return 80;
  if (rpg >= 24) return 65;
  if (rpg >= 20) return 50;
  if (rpg >= 15) return 30;
  return 15;
}

// PPGIndex - fantasy points per game scaling
function scalePPG(ppg: number): number {
  if (ppg >= 22) return 100;
  if (ppg >= 19) return 90;
  if (ppg >= 16) return 80;
  if (ppg >= 13) return 70;
  if (ppg >= 10) return 60;
  if (ppg >= 7) return 50;
  return 40;
}

// ---- Core Computation ----

function computeVolumeIndex(
  targetsPerGame: number,
  targetShareAvg: number | null,
  routesPerGame: number | null
): number {
  const targetsScore = scaleTargetsPerGame(targetsPerGame);
  const shareScore = targetShareAvg !== null ? scaleTargetShare(targetShareAvg) : 50;
  const routesScore = routesPerGame !== null ? scaleRoutesPerGame(routesPerGame) : 50;
  
  return Math.round(0.6 * targetsScore + 0.3 * shareScore + 0.1 * routesScore);
}

function computePPGIndex(fantasyPointsPprPerGame: number): number {
  return scalePPG(fantasyPointsPprPerGame);
}

function computeSpiceIndex(
  highValueUsageScore: number,
  momentumScore: number
): number {
  return Math.round((highValueUsageScore + momentumScore) / 2.0);
}

function computeFantasyWRScore(
  volumeIndex: number,
  ppgIndex: number,
  spiceIndex: number
): number {
  return Math.round(0.6 * volumeIndex + 0.3 * ppgIndex + 0.1 * spiceIndex);
}

// ---- Main Service Function ----

export async function getFantasyWRRankings(
  season: number,
  options: {
    minScore?: number;
    limit?: number;
    offset?: number;
  } = {}
): Promise<FantasyWRRankingRow[]> {
  const { minScore, limit, offset } = options;

  // Step 1: Get all WR Role Bank data for the season
  const roleBank = await db
    .select({
      playerId: wrRoleBank.playerId,
      season: wrRoleBank.season,
      gamesPlayed: wrRoleBank.gamesPlayed,
      targetsPerGame: wrRoleBank.targetsPerGame,
      targetShareAvg: wrRoleBank.targetShareAvg,
      routesPerGame: wrRoleBank.routesPerGame,
      highValueUsageScore: wrRoleBank.highValueUsageScore,
      momentumScore: wrRoleBank.momentumScore,
      pureRoleScore: wrRoleBank.pureRoleScore,
      roleScore: wrRoleBank.roleScore,
      tier: wrRoleBank.roleTier,
    })
    .from(wrRoleBank)
    .where(eq(wrRoleBank.season, season));

  // Step 2: Aggregate fantasy points per game from weekly_stats
  // IMPORTANT: Join with player_identity_map to use authoritative position data
  // (weekly_stats.position has incorrect data - RBs labeled as "WR")
  const fantasyStatsRaw = await db
    .select({
      playerId: weeklyStats.playerId,
      totalFantasyPoints: sql<number>`SUM(COALESCE(${weeklyStats.fantasyPointsPpr}, 0))`,
      gamesWithStats: sql<number>`COUNT(*) FILTER (WHERE ${weeklyStats.fantasyPointsPpr} > 0)`,
    })
    .from(weeklyStats)
    .innerJoin(
      playerIdentityMap,
      eq(weeklyStats.playerId, playerIdentityMap.nflDataPyId)
    )
    .where(
      and(
        eq(weeklyStats.season, season),
        eq(playerIdentityMap.position, 'WR')  // Use authoritative position from player_identity_map
      )
    )
    .groupBy(weeklyStats.playerId);

  // Create a map for fast lookup
  const fantasyStatsMap = new Map(
    fantasyStatsRaw.map((row: any) => [
      row.playerId,
      {
        totalFantasyPoints: Number(row.totalFantasyPoints) || 0,
        gamesWithStats: Number(row.gamesWithStats) || 0,
      },
    ])
  );

  // Step 3: Get player identity data
  const playerIdentities = await db
    .select({
      playerId: playerIdentityMap.nflDataPyId,
      playerName: playerIdentityMap.fullName,
      team: playerIdentityMap.nflTeam,
    })
    .from(playerIdentityMap)
    .where(eq(playerIdentityMap.position, 'WR'));

  const identityMap = new Map(
    playerIdentities.map((row: any) => [
      row.playerId,
      {
        playerName: row.playerName,
        team: row.team,
      },
    ])
  );

  // Step 4: Compute Fantasy WR Scores for each player
  const results: FantasyWRRankingRow[] = [];

  for (const rb of roleBank) {
    const fantasyStats = fantasyStatsMap.get(rb.playerId) || { totalFantasyPoints: 0, gamesWithStats: 0 };
    const identity = identityMap.get(rb.playerId) || { playerName: 'Unknown', team: null };

    // Use games_played from role bank, fallback to games_with_stats if needed
    const gamesPlayed = rb.gamesPlayed || fantasyStats.gamesWithStats || 0;
    
    if (gamesPlayed === 0) {
      continue; // Skip players with no games
    }

    const totalFantasyPoints = fantasyStats.totalFantasyPoints || 0;
    const fantasyPointsPprPerGame = totalFantasyPoints / gamesPlayed;

    // Compute indices
    const volumeIndex = computeVolumeIndex(
      rb.targetsPerGame,
      rb.targetShareAvg,
      rb.routesPerGame
    );

    const ppgIndex = computePPGIndex(fantasyPointsPprPerGame);

    const spiceIndex = computeSpiceIndex(
      rb.highValueUsageScore,
      rb.momentumScore
    );

    const fantasyWRScore = computeFantasyWRScore(
      volumeIndex,
      ppgIndex,
      spiceIndex
    );

    // Apply minScore filter if provided
    if (minScore !== undefined && fantasyWRScore < minScore) {
      continue;
    }

    results.push({
      playerId: rb.playerId,
      playerName: identity.playerName,
      team: identity.team,
      season: rb.season,
      fantasyWRScore,
      volumeIndex,
      ppgIndex,
      spiceIndex,
      fantasyPointsPprPerGame: Number(fantasyPointsPprPerGame.toFixed(2)),
      targetsPerGame: rb.targetsPerGame,
      targetShareAvg: rb.targetShareAvg,
      routesPerGame: rb.routesPerGame,
      pureRoleScore: rb.pureRoleScore,
      roleScore: rb.roleScore,
      tier: rb.tier,
      gamesPlayed,
    });
  }

  // Step 5: Sort by FantasyWRScore descending
  results.sort((a, b) => b.fantasyWRScore - a.fantasyWRScore);

  // Step 6: Apply pagination
  if (offset !== undefined || limit !== undefined) {
    const start = offset || 0;
    const end = limit ? start + limit : undefined;
    return results.slice(start, end);
  }

  return results;
}
