/**
 * FORGE v0.1 - Context Fetcher
 * 
 * Fetches and assembles all required context data for a player
 * from existing services and database tables.
 * 
 * As of v1.1: For season >= 2025, uses Datadive snapshot tables
 * instead of legacy weeklyStats tables when USE_DATADIVE_FORGE is enabled.
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
  weeklyStats,
  silverPlayerWeeklyStats,
  qbEpaAdjusted
} from '@shared/schema';
import { eq, and, desc, sql, lte, gte, sum, count } from 'drizzle-orm';
import {
  USE_DATADIVE_FORGE,
  getSnapshotSeasonStats,
  getEnrichedPlayerWeek,
  enrichedToForgeInput,
  toForgeSeasonStats,
  toForgeAdvancedMetrics,
  getCurrentSnapshot,
  type EnrichedPlayerData
} from '../../../services/datadiveContext';

const playerIdentityService = PlayerIdentityService.getInstance();
const oasisEnvironmentService = new OasisEnvironmentService();

/**
 * Fetch complete context for a player at a given point in the season
 * @param startWeek - Optional start week for filtering (for week range analysis)
 */
export async function fetchContext(
  playerId: string,
  season: number,
  asOfWeek: WeekOrPreseason,
  startWeek?: number
): Promise<ForgeContext> {
  const weekRangeStr = startWeek ? `, startWeek ${startWeek}` : '';
  console.log(`[FORGE/Context] Fetching context for ${playerId}, season ${season}, week ${asOfWeek}${weekRangeStr}`);
  
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
    weeklyStatsData,
    roleMetrics,
    teamEnvironment,
    dvpData,
    injuryStatus,
    xFptsData,
  ] = await Promise.all([
    fetchSeasonStats(identity.canonicalId, season, weekNum, startWeek),
    fetchAdvancedMetrics(identity.canonicalId, position, season),
    fetchWeeklyStats(sleeperId, season, weekNum, startWeek),
    fetchRoleMetrics(identity.canonicalId, position, season),
    identity.nflTeam ? fetchTeamEnvironment(identity.nflTeam) : Promise.resolve(undefined),
    identity.nflTeam ? fetchDvPData(identity.nflTeam, position, season) : Promise.resolve(undefined),
    fetchInjuryStatus(identity.canonicalId),
    fetchXFptsData(identity.canonicalId, season, weekNum, startWeek),
  ]);
  
  // v1.4: Fetch player age for dynasty adjustments
  const playerAge = await fetchPlayerAge(identity.canonicalId);
  
  return {
    playerId: identity.canonicalId,
    playerName: identity.fullName,
    position,
    nflTeam: identity.nflTeam,
    season,
    asOfWeek,
    age: playerAge,
    
    identity: {
      canonicalId: identity.canonicalId,
      sleeperId: sleeperId,
      nflDataPyId: identity.externalIds?.nfl_data_py,
      isActive: identity.isActive,
    },
    
    seasonStats,
    advancedMetrics,
    weeklyStats: weeklyStatsData,
    roleMetrics,
    teamEnvironment,
    dvpData,
    injuryStatus,
    xFptsData,
  };
}

/**
 * Fetch player identity from PlayerIdentityService, enriched with live team status
 */
async function fetchPlayerIdentity(playerId: string) {
  try {
    const identity = await playerIdentityService.getByAnyId(playerId);
    if (!identity) return null;
    
    // Get live team from player_live_status if available (for up-to-date team info)
    const liveStatusResult = await db.execute<{
      current_team: string | null;
      status: string | null;
      is_eligible_for_forge: boolean | null;
    }>(sql`
      SELECT current_team, status, is_eligible_for_forge
      FROM player_live_status
      WHERE canonical_id = ${identity.canonicalId}
      LIMIT 1
    `);
    
    const liveStatus = liveStatusResult.rows[0];
    
    // Override nflTeam with live team if available (handles roster moves like Thielen CAR→PIT)
    if (liveStatus?.current_team) {
      identity.nflTeam = liveStatus.current_team;
    }
    
    return identity;
  } catch (error) {
    console.error(`[FORGE/Context] Error fetching identity for ${playerId}:`, error);
    return null;
  }
}

/**
 * Fetch season-level stats from playerSeasonFacts, weeklyStats, or playerSeason2024
 * For 2025+, uses NEW enriched weekly data path through getEnrichedPlayerWeek()
 * This ensures all 2025 pro-grade metrics (CPOE, WOPR, RACR, RYOE, etc.) flow through FORGE
 * @param startWeek - Optional start week for week range filtering
 */
async function fetchSeasonStats(
  canonicalId: string, 
  season: number, 
  asOfWeek: number,
  startWeek?: number
): Promise<ForgeContext['seasonStats']> {
  try {
    // For 2025+, use NEW enriched weekly data path (single source of truth)
    // v1.2: Pass startWeek for week range filtering
    if (season >= 2025 && USE_DATADIVE_FORGE) {
      const enrichedData = await getEnrichedPlayerWeek(canonicalId, season, asOfWeek > 0 ? asOfWeek : undefined, startWeek);
      if (enrichedData && enrichedData.gamesPlayed > 0) {
        console.log(`[FORGE/Context] Using enriched weekly data for ${canonicalId}: ${enrichedData.gamesPlayed} games, enrichments: [${enrichedData.enrichmentList.join(', ')}]`);
        const forgeInput = enrichedToForgeInput(enrichedData);
        return toForgeSeasonStats(forgeInput);
      }
      
      // Fallback to old season snapshot if enriched weekly data not available
      const nflDataPyId = await getNflDataPyIdForCanonical(canonicalId);
      if (nflDataPyId) {
        const datadiveStats = await getSnapshotSeasonStats(nflDataPyId, season);
        if (datadiveStats && datadiveStats.gamesPlayed > 0) {
          console.log(`[FORGE/Context] Fallback to Datadive season snapshot for ${canonicalId}: ${datadiveStats.gamesPlayed} games`);
          return toForgeSeasonStats(datadiveStats);
        }
      }
    }
    
    // Fallback to legacy path for 2025+ if Datadive didn't return data
    if (season >= 2025) {
      const weeklyResult = await fetchFromWeeklyStats(canonicalId, season, asOfWeek, startWeek);
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
    const weeklyResult = await fetchFromWeeklyStats(canonicalId, season, asOfWeek, startWeek);
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
 * v1.2: Now computes exact targetShare and opportunityShare from team-level aggregates
 * v1.3: Supports week range filtering for custom date range analysis
 */
async function fetchFromWeeklyStats(
  canonicalId: string,
  season: number,
  asOfWeek: number,
  startWeek?: number
): Promise<ForgeContext['seasonStats'] | null> {
  try {
    const nflDataPyId = await getNflDataPyIdForCanonical(canonicalId);
    if (!nflDataPyId) return null;
    
    // Build week range condition: startWeek <= week <= asOfWeek
    let weekCondition;
    if (startWeek && asOfWeek > 0) {
      // Week range mode: filter to specific week range
      weekCondition = and(
        gte(weeklyStats.week, startWeek),
        lte(weeklyStats.week, asOfWeek)
      );
      console.log(`[FORGE/Context] Week range filter: weeks ${startWeek}-${asOfWeek}`);
    } else if (asOfWeek > 0) {
      // Standard mode: all weeks up to asOfWeek
      weekCondition = lte(weeklyStats.week, asOfWeek);
    } else {
      weekCondition = sql`1=1`;
    }
    
    // First, get player stats including their team and position
    const playerStats = await db
      .select({
        gamesPlayed: count(weeklyStats.week),
        team: weeklyStats.team,
        position: weeklyStats.position,
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
      )
      .groupBy(weeklyStats.team, weeklyStats.position);
    
    if (!playerStats[0] || Number(playerStats[0].gamesPlayed) === 0) {
      return null;
    }
    
    const a = playerStats[0];
    const playerTeam = a.team;
    const playerPosition = a.position;
    const playerTargets = Number(a.totalTargets) || 0;
    const playerRushAtt = Number(a.totalRushAtt) || 0;
    const playerTouches = playerRushAtt + playerTargets;
    
    // Compute exact targetShare by getting team total targets (WR/TE/RB)
    let targetShare: number | undefined = undefined;
    let opportunityShare: number | undefined = undefined;
    
    if (playerTeam) {
      // Get team total targets for targetShare calculation (receiving positions)
      if (playerPosition && ['WR', 'TE', 'RB'].includes(playerPosition)) {
        const teamTargetsResult = await db
          .select({
            totalTargets: sum(weeklyStats.targets),
          })
          .from(weeklyStats)
          .where(
            and(
              eq(weeklyStats.team, playerTeam),
              eq(weeklyStats.season, season),
              weekCondition,
              sql`${weeklyStats.position} IN ('WR', 'TE', 'RB')`
            )
          );
        
        const teamTotalTargets = Number(teamTargetsResult[0]?.totalTargets) || 0;
        if (teamTotalTargets > 0 && playerTargets > 0) {
          targetShare = playerTargets / teamTotalTargets;
          console.log(`[FORGE/Context] Exact targetShare for ${canonicalId}: ${playerTargets}/${teamTotalTargets} = ${(targetShare * 100).toFixed(1)}%`);
        }
      }
      
      // Get team total RB touches for opportunityShare calculation
      if (playerPosition === 'RB') {
        const teamRBTouchesResult = await db
          .select({
            totalRushAtt: sum(weeklyStats.rushAtt),
            totalTargets: sum(weeklyStats.targets),
          })
          .from(weeklyStats)
          .where(
            and(
              eq(weeklyStats.team, playerTeam),
              eq(weeklyStats.season, season),
              weekCondition,
              eq(weeklyStats.position, 'RB')
            )
          );
        
        const teamRBTouches = (Number(teamRBTouchesResult[0]?.totalRushAtt) || 0) + 
                              (Number(teamRBTouchesResult[0]?.totalTargets) || 0);
        if (teamRBTouches > 0 && playerTouches > 0) {
          opportunityShare = playerTouches / teamRBTouches;
          console.log(`[FORGE/Context] Exact opportunityShare for ${canonicalId}: ${playerTouches}/${teamRBTouches} = ${(opportunityShare * 100).toFixed(1)}%`);
        }
      }
    }
    
    console.log(`[FORGE/Context] Using weeklyStats for ${canonicalId}: ${a.gamesPlayed} games, ${a.totalFpPpr} FP`);
    return {
      gamesPlayed: Number(a.gamesPlayed) ?? 0,
      gamesStarted: Number(a.gamesPlayed) ?? 0,
      snapCount: Number(a.totalSnaps) ?? 0,
      snapShare: opportunityShare ?? 0, // Use opportunityShare as snap proxy for RBs
      fantasyPointsPpr: Number(a.totalFpPpr) ?? 0,
      fantasyPointsHalfPpr: Number(a.totalFpHalf) ?? (Number(a.totalFpPpr) ?? 0) * 0.75,
      targets: playerTargets || undefined,
      targetShare: targetShare,
      receptions: Number(a.totalReceptions) ?? undefined,
      receivingYards: Number(a.totalRecYards) ?? undefined,
      receivingTds: Number(a.totalRecTds) ?? undefined,
      rushAttempts: playerRushAtt || undefined,
      rushYards: Number(a.totalRushYards) ?? undefined,
      rushTds: Number(a.totalRushTds) ?? undefined,
      passingYards: Number(a.totalPassYards) ?? undefined,
      passingTds: Number(a.totalPassTds) ?? undefined,
      interceptions: Number(a.totalInt) ?? undefined,
    };
  } catch (error) {
    console.error(`[FORGE/Context] Error fetching from weeklyStats:`, error);
    return null;
  }
}

/**
 * Fetch advanced metrics from enriched weekly data (2025+) or legacy tables
 * For 2025+: Uses enriched weekly data path which includes all pro-grade metrics
 * (CPOE, WOPR, RACR, RYOE, dakota, cushion, xyac_epa, etc.)
 */
async function fetchAdvancedMetrics(
  canonicalId: string,
  position: PlayerPosition,
  season: number
): Promise<ForgeContext['advancedMetrics']> {
  try {
    // For 2025+, use NEW enriched weekly data path (single source of truth)
    if (season >= 2025 && USE_DATADIVE_FORGE) {
      const enrichedData = await getEnrichedPlayerWeek(canonicalId, season);
      if (enrichedData && enrichedData.gamesPlayed > 0) {
        const enriched = enrichedData.enrichedMetrics;
        
        // Build advanced metrics from enriched data
        const metrics: ForgeContext['advancedMetrics'] = {
          yprr: enrichedData.yprr > 0 ? enrichedData.yprr : undefined,
          adot: enrichedData.aDot > 0 ? enrichedData.aDot : undefined,
          epaPerPlay: enrichedData.epaPerPlay !== 0 ? enrichedData.epaPerPlay : undefined,
          yardsPerCarry: enrichedData.yardsPerCarry > 0 ? enrichedData.yardsPerCarry : undefined,
          successRate: enrichedData.successRate > 0 ? enrichedData.successRate : undefined,
          // Position-specific enriched metrics
          ...(position === 'QB' && {
            cpoe: enriched.cpoe ?? undefined,
            dakota: enriched.dakota ?? undefined,
            pacr: enriched.pacr ?? undefined,
            completionPct: enriched.completion_pct ?? undefined,
            pressuredEpa: enriched.pressured_epa_per_dropback ?? undefined,
          }),
          ...((position === 'WR' || position === 'TE') && {
            wopr: enriched.wopr_x ?? undefined,
            racr: enriched.racr ?? undefined,
            targetShare: enrichedData.targetShare,
            airYardsShare: enriched.air_yards_share ?? undefined,
            xyacEpa: enriched.xyac_epa ?? undefined,
            cushion: enriched.cushion_avg ?? undefined,
            separation: enriched.separation_pct ?? undefined,
            slotRate: enriched.slot_rate ?? undefined,
          }),
          ...(position === 'RB' && {
            ryoe: enriched.ryoe_per_carry ?? undefined,
            opportunityShare: enriched.opportunity_share ?? undefined,
            rushShare: enriched.rush_share ?? undefined,
            elusiveRating: enriched.elusive_rating ?? undefined,
            stuffedRate: enriched.stuffed_rate ?? undefined,
            yardsAfterContact: enriched.yco_attempt ?? undefined,
          }),
        };
        
        console.log(`[FORGE/Context] Using enriched advanced metrics for ${canonicalId} (${position})`);
        return metrics;
      }
      
      // Fallback to old Datadive snapshot
      const nflId = await getNflDataPyIdForCanonical(canonicalId);
      if (nflId) {
        const datadiveStats = await getSnapshotSeasonStats(nflId, season);
        if (datadiveStats && datadiveStats.gamesPlayed > 0) {
          const metrics = toForgeAdvancedMetrics(datadiveStats);
          
          // For QBs, ensure we have meaningful epaPerPlay before returning
          // If not, try qb_epa_adjusted table
          if (metrics && position === 'QB' && !metrics.epaPerPlay) {
            const qbEpa = await db
              .select({
                epaPerPlay: qbEpaAdjusted.tiberAdjEpaPerPlay,
                rawEpa: qbEpaAdjusted.rawEpaPerPlay,
              })
              .from(qbEpaAdjusted)
              .where(
                and(
                  eq(qbEpaAdjusted.playerId, nflId),
                  eq(qbEpaAdjusted.season, season)
                )
              )
              .orderBy(desc(qbEpaAdjusted.week))
              .limit(1);
            
            if (qbEpa[0]) {
              const epa = qbEpa[0].epaPerPlay ?? qbEpa[0].rawEpa;
              console.log(`[FORGE/Context] QB epaPerPlay from qb_epa_adjusted for ${canonicalId}: ${epa}`);
              return { ...metrics, epaPerPlay: epa ?? undefined };
            }
          }
          
          if (metrics) {
            console.log(`[FORGE/Context] Fallback to Datadive advanced metrics for ${canonicalId}`);
            return metrics;
          }
        }
      }
    }
    
    // Translate canonical ID to NFL GSIS ID for legacy paths
    const nflId = await getNflDataPyIdForCanonical(canonicalId);
    if (!nflId) {
      return undefined;
    }
    
    // Fallback to silver_player_weekly_stats for 2025+
    if (season >= 2025) {
      const silverStats = await db
        .select({
          totalPassAtt: sum(silverPlayerWeeklyStats.passAttempts),
          totalPassYards: sum(silverPlayerWeeklyStats.passingYards),
          totalPassTds: sum(silverPlayerWeeklyStats.passingTds),
          totalPassingEpa: sum(silverPlayerWeeklyStats.passingEpa),
          totalTargets: sum(silverPlayerWeeklyStats.targets),
          totalRecYards: sum(silverPlayerWeeklyStats.receivingYards),
          totalReceivingEpa: sum(silverPlayerWeeklyStats.receivingEpa),
          totalAirYards: sum(silverPlayerWeeklyStats.airYards),
          totalRushAtt: sum(silverPlayerWeeklyStats.rushAttempts),
          totalRushYards: sum(silverPlayerWeeklyStats.rushingYards),
          totalRushingEpa: sum(silverPlayerWeeklyStats.rushingEpa),
        })
        .from(silverPlayerWeeklyStats)
        .where(
          and(
            eq(silverPlayerWeeklyStats.playerId, nflId),
            eq(silverPlayerWeeklyStats.season, season)
          )
        );
      
      if (silverStats[0] && (Number(silverStats[0].totalPassAtt) > 0 || Number(silverStats[0].totalTargets) > 0)) {
        const s = silverStats[0];
        const passAtt = Number(s.totalPassAtt) || 1;
        const targets = Number(s.totalTargets) || 1;
        const rushAtt = Number(s.totalRushAtt) || 1;
        
        // Calculate EPA per play based on position
        let epaPerPlay: number | undefined;
        if (position === 'QB' && Number(s.totalPassAtt) > 0) {
          epaPerPlay = Number(s.totalPassingEpa) / passAtt;
        } else if ((position === 'WR' || position === 'TE') && Number(s.totalTargets) > 0) {
          epaPerPlay = Number(s.totalReceivingEpa) / targets;
        } else if (position === 'RB') {
          // RB: blend rushing and receiving EPA
          const totalTouches = Number(s.totalRushAtt) + Number(s.totalTargets);
          if (totalTouches > 0) {
            epaPerPlay = (Number(s.totalRushingEpa) + Number(s.totalReceivingEpa)) / totalTouches;
          }
        }
        
        // Calculate AYPA for QBs (air yards per attempt)
        const aypa = position === 'QB' && passAtt > 0 
          ? Number(s.totalPassYards) / passAtt 
          : undefined;
        
        // Calculate yards per carry for RBs
        const yardsPerCarry = position === 'RB' && rushAtt > 0
          ? Number(s.totalRushYards) / rushAtt
          : undefined;
        
        // Calculate YPRR proxy (receiving yards per target) for WR/TE
        const yprr = (position === 'WR' || position === 'TE') && targets > 0
          ? Number(s.totalRecYards) / targets
          : undefined;
        
        // Calculate ADOT proxy (air yards per target)
        const adot = targets > 0 
          ? Number(s.totalAirYards) / targets 
          : undefined;
        
        return {
          epaPerPlay: epaPerPlay ?? undefined,
          aypa: aypa ?? undefined,
          yardsPerCarry: yardsPerCarry ?? undefined,
          yprr: yprr ?? undefined,
          adot: adot ?? undefined,
        };
      }
    }
    
    // Fallback to 2024 tables for historical data
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
    
    // HOTFIX: QB-specific fallback to qb_epa_adjusted table
    if (position === 'QB' && nflId) {
      const qbEpa = await db
        .select({
          epaPerPlay: qbEpaAdjusted.tiberAdjEpaPerPlay,
          rawEpa: qbEpaAdjusted.rawEpaPerPlay,
        })
        .from(qbEpaAdjusted)
        .where(
          and(
            eq(qbEpaAdjusted.playerId, nflId),
            eq(qbEpaAdjusted.season, season)
          )
        )
        .orderBy(desc(qbEpaAdjusted.week))
        .limit(1);
      
      if (qbEpa[0]) {
        const epa = qbEpa[0].epaPerPlay ?? qbEpa[0].rawEpa;
        console.log(`[FORGE/Context] Using qb_epa_adjusted for ${canonicalId}: EPA=${epa}`);
        return {
          epaPerPlay: epa ?? undefined,
        };
      }
    }
    
    return undefined;
  } catch (error) {
    console.error(`[FORGE/Context] Error fetching advanced metrics:`, error);
    return undefined;
  }
}

/**
 * Fetch weekly game logs for trajectory/stability analysis
 * @param startWeek - Optional start week for week range filtering
 */
async function fetchWeeklyStats(
  sleeperId: string,
  season: number,
  asOfWeek: number,
  startWeek?: number
): Promise<ForgeContext['weeklyStats']> {
  try {
    // Build week range condition: startWeek <= week <= asOfWeek
    let weekCondition;
    if (startWeek && asOfWeek > 0) {
      weekCondition = and(
        gte(gameLogs.week, startWeek),
        lte(gameLogs.week, asOfWeek)
      );
    } else if (asOfWeek > 0) {
      weekCondition = lte(gameLogs.week, asOfWeek);
    } else {
      weekCondition = sql`1=1`;
    }
    
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

/**
 * v1.5: Fetch xFPTS (expected fantasy points) data from datadive_expected_fantasy_week
 * Aggregates across the week range to get season totals and FPOE (fantasy points over expected)
 * 
 * NOTE: datadive_expected_fantasy_week uses nflfastr_gsis_id (e.g. "00-0036900") as player_id,
 * so we need to join with player_identity_map to translate canonical_id to gsis_id
 */
async function fetchXFptsData(
  canonicalId: string, 
  season: number, 
  asOfWeek: number,
  startWeek?: number
): Promise<ForgeContext['xFptsData']> {
  try {
    const weekLower = startWeek ?? 1;
    const weekUpper = asOfWeek;
    
    const result = await db.execute<{
      games: number;
      total_actual: number;
      total_xfpts: number;
      total_fpoe: number;
    }>(sql`
      SELECT 
        COUNT(*) as games,
        COALESCE(SUM(dew.actual_ppr), 0) as total_actual,
        COALESCE(SUM(dew.x_ppr_v2), 0) as total_xfpts,
        COALESCE(SUM(dew.xfpgoe_ppr_v2), 0) as total_fpoe
      FROM datadive_expected_fantasy_week dew
      JOIN player_identity_map pim ON dew.player_id = pim.nflfastr_gsis_id
      WHERE pim.canonical_id = ${canonicalId}
        AND dew.season = ${season}
        AND dew.week >= ${weekLower}
        AND dew.week <= ${weekUpper}
    `);
    
    const row = result.rows[0];
    if (!row || Number(row.games) === 0) {
      return undefined;
    }
    
    const games = Number(row.games);
    const totalActual = Number(row.total_actual);
    const totalXFpts = Number(row.total_xfpts);
    const totalFpoe = Number(row.total_fpoe);
    
    return {
      totalXFpts: Math.round(totalXFpts * 10) / 10,
      totalActual: Math.round(totalActual * 10) / 10,
      totalFpoe: Math.round(totalFpoe * 10) / 10,
      avgFpoe: Math.round((totalFpoe / games) * 10) / 10,
      gamesWithData: games,
    };
  } catch (error) {
    console.warn(`[FORGE/Context] ⚠️ Could not fetch xFPTS data for ${canonicalId}:`, error);
    return undefined;
  }
}

/**
 * v1.4: Fetch player age for dynasty adjustments
 * Sources (in priority order):
 * 1. players table (via full_name join with player_identity_map)
 * 2. player_identity_map with birthDate calculation
 * 
 * Returns undefined if age not available (will use neutral multiplier)
 */
async function fetchPlayerAge(canonicalId: string): Promise<number | undefined> {
  try {
    // Join players table via full_name from player_identity_map
    const playersResult = await db.execute<{ age: number | null }>(sql`
      SELECT p.age 
      FROM players p 
      JOIN player_identity_map pim ON p.full_name = pim.full_name 
      WHERE pim.canonical_id = ${canonicalId} AND p.age IS NOT NULL
      LIMIT 1
    `);
    
    if (playersResult.rows[0]?.age) {
      return playersResult.rows[0].age;
    }
    
    // Fallback: Try player_identity_map with birthDate
    const identityResult = await db.execute<{ birth_date: Date | null }>(sql`
      SELECT birth_date FROM player_identity_map 
      WHERE canonical_id = ${canonicalId}
      LIMIT 1
    `);
    
    if (identityResult.rows[0]?.birth_date) {
      const birthDate = new Date(identityResult.rows[0].birth_date);
      const today = new Date();
      const age = Math.floor((today.getTime() - birthDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
      return age;
    }
    
    return undefined;
  } catch (error) {
    console.warn(`[FORGE/Context] ⚠️ Could not fetch age for ${canonicalId}:`, error);
    return undefined;
  }
}

export default fetchContext;
