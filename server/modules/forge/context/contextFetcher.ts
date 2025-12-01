/**
 * FORGE v0.1 - Context Fetcher
 * 
 * Fetches and assembles all required context data for a player
 * from existing services and database tables.
 */

import { ForgeContext, PlayerPosition, WeekOrPreseason } from '../types';
import { PlayerIdentityService } from '../../../services/PlayerIdentityService';
import { OasisEnvironmentService } from '../../../services/oasisEnvironmentService';
import { db } from '../../../infra/db';
import { 
  gameLogs, 
  playerSeasonFacts, 
  defenseVsPositionStats,
  playerSeason2024,
  playerAdvanced2024,
  playerIdentityMap,
  weeklyStats
} from '@shared/schema';
import { eq, and, desc, sql, lte, sum, count } from 'drizzle-orm';

const playerIdentityService = PlayerIdentityService.getInstance();
const oasisEnvironmentService = new OasisEnvironmentService();

/**
 * Fetch complete context for a player at a given point in the season
 */
export async function fetchContext(
  playerId: string,
  season: number,
  asOfWeek: WeekOrPreseason
): Promise<ForgeContext> {
  console.log(`[FORGE/Context] Fetching context for ${playerId}, season ${season}, week ${asOfWeek}`);
  
  const identity = await fetchPlayerIdentity(playerId);
  
  if (!identity) {
    throw new Error(`[FORGE] Player not found: ${playerId}`);
  }
  
  const position = identity.position as PlayerPosition;
  if (!['WR', 'RB', 'TE', 'QB'].includes(position)) {
    throw new Error(`[FORGE] Unsupported position: ${position}`);
  }
  
  const weekNum = asOfWeek === 'preseason' ? 0 : asOfWeek;
  
  const sleeperId = identity.externalIds?.sleeper || identity.canonicalId;
  
  const [
    seasonStats,
    advancedMetrics,
    weeklyStats,
    roleMetrics,
    teamEnvironment,
    dvpData,
    injuryStatus,
  ] = await Promise.all([
    fetchSeasonStats(identity.canonicalId, season, weekNum),
    fetchAdvancedMetrics(identity.canonicalId, position, season),
    fetchWeeklyStats(sleeperId, season, weekNum),
    fetchRoleMetrics(identity.canonicalId, position, season),
    identity.nflTeam ? fetchTeamEnvironment(identity.nflTeam) : Promise.resolve(undefined),
    identity.nflTeam ? fetchDvPData(identity.nflTeam, position, season) : Promise.resolve(undefined),
    fetchInjuryStatus(identity.canonicalId),
  ]);
  
  return {
    playerId: identity.canonicalId,
    playerName: identity.fullName,
    position,
    nflTeam: identity.nflTeam,
    season,
    asOfWeek,
    
    identity: {
      canonicalId: identity.canonicalId,
      sleeperId: sleeperId,
      nflDataPyId: identity.externalIds?.nfl_data_py,
      isActive: identity.isActive,
    },
    
    seasonStats,
    advancedMetrics,
    weeklyStats,
    roleMetrics,
    teamEnvironment,
    dvpData,
    injuryStatus,
  };
}

/**
 * Fetch player identity from PlayerIdentityService
 */
async function fetchPlayerIdentity(playerId: string) {
  try {
    const identity = await playerIdentityService.getByAnyId(playerId);
    return identity;
  } catch (error) {
    console.error(`[FORGE/Context] Error fetching identity for ${playerId}:`, error);
    return null;
  }
}

/**
 * Fetch season-level stats from playerSeasonFacts, weeklyStats, or playerSeason2024
 * For 2025+, prefers weeklyStats if it has more games (since playerSeasonFacts may be stale)
 */
async function fetchSeasonStats(
  canonicalId: string, 
  season: number, 
  asOfWeek: number
): Promise<ForgeContext['seasonStats']> {
  try {
    // For 2025+, check weeklyStats first since playerSeasonFacts may be stale
    if (season >= 2025) {
      const weeklyResult = await fetchFromWeeklyStats(canonicalId, season, asOfWeek);
      if (weeklyResult && weeklyResult.gamesPlayed > 0) {
        return weeklyResult;
      }
    }
    
    const facts = await db
      .select()
      .from(playerSeasonFacts)
      .where(
        and(
          eq(playerSeasonFacts.canonicalPlayerId, canonicalId),
          eq(playerSeasonFacts.season, season)
        )
      )
      .limit(1);
    
    if (facts[0]) {
      const f = facts[0];
      return {
        gamesPlayed: f.gamesPlayed ?? 0,
        gamesStarted: f.gamesStarted ?? 0,
        snapCount: f.snapCount ?? 0,
        snapShare: f.snapShare ?? 0,
        fantasyPointsPpr: f.fantasyPointsPpr ?? 0,
        fantasyPointsHalfPpr: f.fantasyPointsHalfPpr ?? 0,
        targets: f.targets ?? undefined,
        receptions: f.receptions ?? undefined,
        receivingYards: f.receivingYards ?? undefined,
        receivingTds: f.receivingTds ?? undefined,
        rushAttempts: undefined,
        rushYards: f.rushingYards ?? undefined,
        rushTds: f.rushingTds ?? undefined,
        passingAttempts: undefined,
        passingYards: f.passingYards ?? undefined,
        passingTds: f.passingTds ?? undefined,
        interceptions: f.interceptions ?? undefined,
        targetShare: f.targetShare ?? undefined,
        airYards: f.airYards ?? undefined,
        redZoneTargets: f.redZoneTargets ?? undefined,
        redZoneCarries: f.redZoneCarries ?? undefined,
      };
    }
    
    // Fallback: try weeklyStats aggregation for older seasons too
    const weeklyResult = await fetchFromWeeklyStats(canonicalId, season, asOfWeek);
    if (weeklyResult && weeklyResult.gamesPlayed > 0) {
      return weeklyResult;
    }
    
    // Final fallback: playerSeason2024 for 2024 data only
    if (season === 2024) {
      const player2024 = await db
        .select()
        .from(playerSeason2024)
        .where(eq(playerSeason2024.playerId, canonicalId))
        .limit(1);
      
      if (player2024[0]) {
        const p = player2024[0];
        return {
          gamesPlayed: p.games ?? 0,
          gamesStarted: p.games ?? 0,
          snapCount: 0,
          snapShare: 0,
          fantasyPointsPpr: p.fptsPpr ?? 0,
          fantasyPointsHalfPpr: (p.fptsPpr ?? 0) * 0.5 + (p.fpts ?? 0) * 0.5,
          targets: p.targets ?? undefined,
          receptions: p.receptions ?? undefined,
          receivingYards: p.recYards ?? undefined,
          receivingTds: p.recTds ?? undefined,
          rushAttempts: p.rushAtt ?? undefined,
          rushYards: p.rushYards ?? undefined,
          rushTds: p.rushTds ?? undefined,
          passingAttempts: p.att ?? undefined,
          passingYards: p.passYards ?? undefined,
          passingTds: p.passTds ?? undefined,
          interceptions: p.int ?? undefined,
          targetShare: p.targetShare ?? undefined,
          airYards: undefined,
          redZoneTargets: undefined,
          redZoneCarries: undefined,
        };
      }
    }
    
    return {
      gamesPlayed: 0,
      gamesStarted: 0,
      snapCount: 0,
      snapShare: 0,
      fantasyPointsPpr: 0,
      fantasyPointsHalfPpr: 0,
    };
  } catch (error) {
    console.error(`[FORGE/Context] Error fetching season stats:`, error);
    return {
      gamesPlayed: 0,
      gamesStarted: 0,
      snapCount: 0,
      snapShare: 0,
      fantasyPointsPpr: 0,
      fantasyPointsHalfPpr: 0,
    };
  }
}

/**
 * Get nfl_data_py_id (GSIS format) for a canonical player ID from identity map
 */
async function getNflDataPyIdForCanonical(canonicalId: string): Promise<string | null> {
  try {
    const identity = await db
      .select({ nflDataPyId: playerIdentityMap.nflDataPyId })
      .from(playerIdentityMap)
      .where(eq(playerIdentityMap.canonicalId, canonicalId))
      .limit(1);
    
    return identity[0]?.nflDataPyId ?? null;
  } catch (error) {
    console.error(`[FORGE/Context] Error fetching nflDataPyId for ${canonicalId}:`, error);
    return null;
  }
}

/**
 * Fetch and aggregate season stats from weeklyStats table
 */
async function fetchFromWeeklyStats(
  canonicalId: string,
  season: number,
  asOfWeek: number
): Promise<ForgeContext['seasonStats'] | null> {
  try {
    const nflDataPyId = await getNflDataPyIdForCanonical(canonicalId);
    if (!nflDataPyId) return null;
    
    const weekCondition = asOfWeek > 0 
      ? lte(weeklyStats.week, asOfWeek)
      : sql`1=1`;
    
    const aggregated = await db
      .select({
        gamesPlayed: count(weeklyStats.week),
        totalSnaps: sum(weeklyStats.snaps),
        totalFpPpr: sum(weeklyStats.fantasyPointsPpr),
        totalFpHalf: sum(weeklyStats.fantasyPointsHalf),
        totalTargets: sum(weeklyStats.targets),
        totalReceptions: sum(weeklyStats.rec),
        totalRecYards: sum(weeklyStats.recYd),
        totalRecTds: sum(weeklyStats.recTd),
        totalRushAtt: sum(weeklyStats.rushAtt),
        totalRushYards: sum(weeklyStats.rushYd),
        totalRushTds: sum(weeklyStats.rushTd),
        totalPassYards: sum(weeklyStats.passYd),
        totalPassTds: sum(weeklyStats.passTd),
        totalInt: sum(weeklyStats.int),
      })
      .from(weeklyStats)
      .where(
        and(
          eq(weeklyStats.playerId, nflDataPyId),
          eq(weeklyStats.season, season),
          weekCondition
        )
      );
    
    if (aggregated[0] && Number(aggregated[0].gamesPlayed) > 0) {
      const a = aggregated[0];
      console.log(`[FORGE/Context] Using weeklyStats for ${canonicalId}: ${a.gamesPlayed} games, ${a.totalFpPpr} FP`);
      return {
        gamesPlayed: Number(a.gamesPlayed) ?? 0,
        gamesStarted: Number(a.gamesPlayed) ?? 0,
        snapCount: Number(a.totalSnaps) ?? 0,
        snapShare: 0,
        fantasyPointsPpr: Number(a.totalFpPpr) ?? 0,
        fantasyPointsHalfPpr: Number(a.totalFpHalf) ?? (Number(a.totalFpPpr) ?? 0) * 0.75,
        targets: Number(a.totalTargets) ?? undefined,
        receptions: Number(a.totalReceptions) ?? undefined,
        receivingYards: Number(a.totalRecYards) ?? undefined,
        receivingTds: Number(a.totalRecTds) ?? undefined,
        rushAttempts: Number(a.totalRushAtt) ?? undefined,
        rushYards: Number(a.totalRushYards) ?? undefined,
        rushTds: Number(a.totalRushTds) ?? undefined,
        passingYards: Number(a.totalPassYards) ?? undefined,
        passingTds: Number(a.totalPassTds) ?? undefined,
        interceptions: Number(a.totalInt) ?? undefined,
      };
    }
    
    return null;
  } catch (error) {
    console.error(`[FORGE/Context] Error fetching from weeklyStats:`, error);
    return null;
  }
}

/**
 * Fetch advanced metrics from playerAdvanced2024 or similar
 * Note: These tables use NFL GSIS IDs, not canonical IDs, so we translate first
 */
async function fetchAdvancedMetrics(
  canonicalId: string,
  position: PlayerPosition,
  season: number
): Promise<ForgeContext['advancedMetrics']> {
  try {
    // Translate canonical ID to NFL GSIS ID for 2024 tables
    const nflId = await getNflDataPyIdForCanonical(canonicalId);
    if (!nflId) {
      return undefined;
    }
    
    const advanced = await db
      .select()
      .from(playerAdvanced2024)
      .where(eq(playerAdvanced2024.playerId, nflId))
      .limit(1);
    
    if (advanced[0]) {
      const a = advanced[0];
      return {
        yprr: a.yprr ?? undefined,
        adot: a.adot ?? undefined,
        racr: a.racr ?? undefined,
        wopr: a.wopr ?? undefined,
        epaPerPlay: a.epaPerPlay ?? undefined,
        aypa: a.aypa ?? undefined,
      };
    }
    
    const player2024 = await db
      .select()
      .from(playerSeason2024)
      .where(eq(playerSeason2024.playerId, nflId))
      .limit(1);
    
    if (player2024[0]) {
      const p = player2024[0];
      return {
        yprr: p.yprr ?? undefined,
        adot: p.adot ?? undefined,
        racr: p.racr ?? undefined,
        wopr: p.wopr ?? undefined,
        epaPerPlay: p.epaPerPlay ?? undefined,
        aypa: p.aypa ?? undefined,
        yardsPerCarry: p.rushYpc ?? undefined,
      };
    }
    
    return undefined;
  } catch (error) {
    console.error(`[FORGE/Context] Error fetching advanced metrics:`, error);
    return undefined;
  }
}

/**
 * Fetch weekly game logs for trajectory/stability analysis
 */
async function fetchWeeklyStats(
  sleeperId: string,
  season: number,
  asOfWeek: number
): Promise<ForgeContext['weeklyStats']> {
  try {
    const weekCondition = asOfWeek > 0 
      ? lte(gameLogs.week, asOfWeek)
      : sql`1=1`;
    
    const logs = await db
      .select({
        week: gameLogs.week,
        fantasyPointsPpr: gameLogs.fantasyPointsPpr,
        targets: gameLogs.targets,
        receptions: gameLogs.receptions,
        rushAttempts: gameLogs.rushAttempts,
      })
      .from(gameLogs)
      .where(
        and(
          eq(gameLogs.sleeperId, sleeperId),
          eq(gameLogs.season, season),
          eq(gameLogs.seasonType, 'REG'),
          weekCondition
        )
      )
      .orderBy(desc(gameLogs.week));
    
    return logs.map(log => ({
      week: log.week,
      fantasyPointsPpr: log.fantasyPointsPpr ?? 0,
      snapShare: undefined,
      targets: log.targets ?? undefined,
      receptions: log.receptions ?? undefined,
      rushAttempts: log.rushAttempts ?? undefined,
    }));
  } catch (error) {
    console.error(`[FORGE/Context] Error fetching weekly stats:`, error);
    return [];
  }
}

/**
 * Fetch role-specific metrics
 * TODO: Wire to actual snap/route data when available
 */
async function fetchRoleMetrics(
  canonicalId: string,
  position: PlayerPosition,
  season: number
): Promise<ForgeContext['roleMetrics']> {
  try {
    const player2024 = await db
      .select()
      .from(playerSeason2024)
      .where(eq(playerSeason2024.playerId, canonicalId))
      .limit(1);
    
    if (player2024[0]) {
      const p = player2024[0];
      const games = p.games || 1;
      
      if (position === 'WR' || position === 'TE') {
        const routes = p.routes ?? 0;
        const routeRate = routes > 0 ? Math.min(1, routes / (games * 35)) : undefined;
        
        return {
          routeRate,
          slotRate: undefined,
          deepTargetShare: undefined,
          redZoneRouteShare: undefined,
        };
      }
      
      if (position === 'RB') {
        return {
          backfieldTouchShare: undefined,
          goalLineWorkRate: undefined,
          thirdDownSnapPct: undefined,
          receivingWorkRate: undefined,
        };
      }
      
      if (position === 'QB') {
        return {
          designedRushShare: undefined,
          goalLineRushShare: undefined,
        };
      }
    }
    
    return undefined;
  } catch (error) {
    console.error(`[FORGE/Context] Error fetching role metrics:`, error);
    return undefined;
  }
}

/**
 * Fetch team environment data from OASIS
 */
async function fetchTeamEnvironment(
  team: string
): Promise<ForgeContext['teamEnvironment']> {
  try {
    const env = await oasisEnvironmentService.getTeamEnvironment(team);
    
    if (env) {
      return {
        team: env.team,
        passAttemptsPerGame: undefined,
        rushAttemptsPerGame: undefined,
        pace: env.pace,
        proe: env.proe,
        olGrade: env.ol_grade,
        qbStability: env.qb_stability,
        redZoneEfficiency: env.red_zone_efficiency,
        scoringEnvironment: env.scoring_environment,
        pacePct: env.pace_pct,
        proePct: env.proe_pct,
        olGradePct: env.ol_grade_pct,
      };
    }
    
    return undefined;
  } catch (error) {
    console.error(`[FORGE/Context] Error fetching team environment:`, error);
    return undefined;
  }
}

/**
 * Fetch Defense vs Position data for matchup context
 */
async function fetchDvPData(
  playerTeam: string,
  position: PlayerPosition,
  season: number
): Promise<ForgeContext['dvpData']> {
  try {
    const dvpStats = await db
      .select({
        defenseTeam: defenseVsPositionStats.defenseTeam,
        fantasyPtsPpr: defenseVsPositionStats.fantasyPtsPpr,
        avgPtsPerGamePpr: defenseVsPositionStats.avgPtsPerGamePpr,
      })
      .from(defenseVsPositionStats)
      .where(
        and(
          eq(defenseVsPositionStats.position, position),
          eq(defenseVsPositionStats.season, season)
        )
      )
      .orderBy(desc(defenseVsPositionStats.fantasyPtsPpr));
    
    if (dvpStats.length === 0) {
      return undefined;
    }
    
    const rankedDefenses = dvpStats.map((d, idx) => ({
      team: d.defenseTeam,
      rank: idx + 1,
      ptsAllowed: d.fantasyPtsPpr ?? 0,
    }));
    
    return {
      position,
      fantasyPtsAllowedPpr: rankedDefenses[0]?.ptsAllowed ?? 0,
      rank: 16,
    };
  } catch (error) {
    console.error(`[FORGE/Context] Error fetching DvP data:`, error);
    return undefined;
  }
}

/**
 * Fetch injury status for the player
 * TODO: Wire to actual injury tracking table
 */
async function fetchInjuryStatus(
  canonicalId: string
): Promise<ForgeContext['injuryStatus']> {
  return {
    hasRecentInjury: false,
    gamesMissedLast2Years: 0,
  };
}

export default fetchContext;
