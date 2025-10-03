import { db } from "../../db";
import { 
  playerAdvanced2024, 
  teamDefensiveContext,
  playerIdentityMap,
  injuries,
  schedule
} from "../../../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import type { PlayerInput } from "../startSitEngine";

export interface StartSitPlayerProfile {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  opponent: string | null;
  week: number;
  season: number;
  
  // Data availability flags
  dataAvailability: {
    epaMetrics: boolean;
    defenseContext: boolean;
    injuryStatus: boolean;
    usageMetrics: boolean;
  };
  
  // Core player profile for scoring engine
  playerInput: PlayerInput;
}

/**
 * Build a comprehensive player profile for start/sit analysis
 * Handles missing data gracefully with clear attribution
 */
export async function buildStartSitPlayerProfile(
  playerIdOrName: string,
  week: number,
  opponent: string,
  season: number = 2024
): Promise<StartSitPlayerProfile | null> {
  
  try {
    // Step 1: Resolve player identity - try multiple ID formats
    const playerData = await resolvePlayer(playerIdOrName);
    if (!playerData) {
      console.error(`Player not found: ${playerIdOrName}`);
      return null;
    }

    // Step 2: Get EPA & efficiency metrics (season-long data)
    const epaMetrics = await getEPAMetrics(playerData.nflDataPyId, playerData.playerName);
    
    // Step 3: Get defensive matchup context
    const defenseContext = await getDefenseContext(opponent, season);
    
    // Step 4: Get injury status (if available)
    const injuryStatus = await getInjuryStatus(playerData.canonicalId);
    
    // Step 5: Calculate matchup score from defensive context
    const matchupScore = defenseContext ? calculateMatchupScore(
      defenseContext,
      playerData.position
    ) : null;
    
    // Step 6: Build PlayerInput object for scoring engine
    const playerInput: PlayerInput = {
      id: playerData.id,
      name: playerData.playerName,
      team: playerData.team || undefined,
      position: playerData.position as any,
      opponent,
      
      // Projections - use EPA as proxy for projection quality
      projPoints: epaMetrics?.epaPerPlay ? mapEPAToProjection(epaMetrics.epaPerPlay, playerData.position) : undefined,
      projFloor: epaMetrics?.epaPerPlay ? mapEPAToProjection(epaMetrics.epaPerPlay * 0.7, playerData.position) : null,
      projCeiling: epaMetrics?.epaPerPlay ? mapEPAToProjection(epaMetrics.epaPerPlay * 1.3, playerData.position) : null,
      
      // Usage metrics - from EPA data
      snapPct: undefined, // Not available pre-week
      routeParticipation: undefined,
      targetShare: epaMetrics?.targetShare ? epaMetrics.targetShare * 100 : undefined,
      weightedTouches: undefined,
      rzTouches: undefined,
      
      // Matchup & Environment
      defRankVsPos: matchupScore?.defenseRank,
      oasisMatchupScore: matchupScore?.score,
      impliedTeamTotal: undefined, // Vegas data not available
      olHealthIndex: undefined,
      weatherImpact: undefined,
      
      // Volatility & Trust
      stdevLast5: undefined,
      injuryTag: injuryStatus?.status as any,
      committeeRisk: undefined,
      depthChartThreats: undefined,
      
      // Market / News
      newsHeat: undefined,
      ecrDelta: undefined,
    };
    
    return {
      playerId: playerData.id,
      playerName: playerData.playerName,
      position: playerData.position,
      team: playerData.team || "",
      opponent,
      week,
      season,
      dataAvailability: {
        epaMetrics: !!epaMetrics,
        defenseContext: !!defenseContext,
        injuryStatus: !!injuryStatus,
        usageMetrics: false, // Pre-week usage not available
      },
      playerInput,
    };
    
  } catch (error) {
    console.error(`Error building player profile for ${playerIdOrName}:`, error);
    return null;
  }
}

/**
 * Resolve player across multiple ID formats
 */
async function resolvePlayer(playerIdOrName: string) {
  // Try exact match in player_advanced_2024 (nfl-data-py ID)
  const advancedPlayer = await db
    .select()
    .from(playerAdvanced2024)
    .where(eq(playerAdvanced2024.playerId, playerIdOrName))
    .limit(1);
  
  if (advancedPlayer.length > 0) {
    return {
      id: advancedPlayer[0].playerId!,
      playerName: advancedPlayer[0].playerName!,
      position: advancedPlayer[0].position!,
      team: advancedPlayer[0].team!,
      nflDataPyId: advancedPlayer[0].playerId!,
      canonicalId: null,
    };
  }
  
  // Try fuzzy name match in player_advanced_2024
  const nameMatch = await db
    .select()
    .from(playerAdvanced2024)
    .where(sql`LOWER(${playerAdvanced2024.playerName}) LIKE LOWER(${`%${playerIdOrName}%`})`)
    .limit(1);
  
  if (nameMatch.length > 0) {
    return {
      id: nameMatch[0].playerId!,
      playerName: nameMatch[0].playerName!,
      position: nameMatch[0].position!,
      team: nameMatch[0].team!,
      nflDataPyId: nameMatch[0].playerId!,
      canonicalId: null,
    };
  }
  
  // Try canonical ID map
  const canonicalPlayer = await db
    .select()
    .from(playerIdentityMap)
    .where(eq(playerIdentityMap.canonicalId, playerIdOrName))
    .limit(1);
  
  if (canonicalPlayer.length > 0) {
    // Look up EPA data by name
    const epaLookup = await db
      .select()
      .from(playerAdvanced2024)
      .where(sql`LOWER(${playerAdvanced2024.playerName}) = LOWER(${canonicalPlayer[0].fullName})`)
      .limit(1);
    
    return {
      id: canonicalPlayer[0].canonicalId,
      playerName: canonicalPlayer[0].fullName,
      position: canonicalPlayer[0].position!,
      team: canonicalPlayer[0].nflTeam!,
      nflDataPyId: epaLookup[0]?.playerId || null,
      canonicalId: canonicalPlayer[0].canonicalId,
    };
  }
  
  return null;
}

/**
 * Get EPA and efficiency metrics for player
 */
async function getEPAMetrics(nflDataPyId: string | null, playerName: string) {
  if (!nflDataPyId) {
    // Try name-based lookup
    const nameMatch = await db
      .select()
      .from(playerAdvanced2024)
      .where(sql`LOWER(${playerAdvanced2024.playerName}) = LOWER(${playerName})`)
      .limit(1);
    
    if (nameMatch.length === 0) return null;
    
    return {
      epaPerPlay: nameMatch[0].epaPerPlay ? Number(nameMatch[0].epaPerPlay) : null,
      targetShare: nameMatch[0].targetShare ? Number(nameMatch[0].targetShare) : null,
      adot: nameMatch[0].adot ? Number(nameMatch[0].adot) : null,
      yprr: nameMatch[0].yprr ? Number(nameMatch[0].yprr) : null,
      wopr: nameMatch[0].wopr ? Number(nameMatch[0].wopr) : null,
    };
  }
  
  const metrics = await db
    .select()
    .from(playerAdvanced2024)
    .where(eq(playerAdvanced2024.playerId, nflDataPyId))
    .limit(1);
  
  if (metrics.length === 0) return null;
  
  return {
    epaPerPlay: metrics[0].epaPerPlay ? Number(metrics[0].epaPerPlay) : null,
    targetShare: metrics[0].targetShare ? Number(metrics[0].targetShare) : null,
    adot: metrics[0].adot ? Number(metrics[0].adot) : null,
    yprr: metrics[0].yprr ? Number(metrics[0].yprr) : null,
    wopr: metrics[0].wopr ? Number(metrics[0].wopr) : null,
  };
}

/**
 * Get defensive context for opponent team
 */
async function getDefenseContext(opponent: string, season: number) {
  // Use most recent week's data (Week 4 for now)
  const latestWeek = await db
    .select()
    .from(teamDefensiveContext)
    .where(and(
      eq(teamDefensiveContext.team, opponent.toUpperCase()),
      eq(teamDefensiveContext.season, season)
    ))
    .orderBy(sql`${teamDefensiveContext.week} DESC`)
    .limit(1);
  
  if (latestWeek.length === 0) return null;
  
  return {
    team: latestWeek[0].team,
    passEpaAllowed: Number(latestWeek[0].passEpaAllowed),
    rushEpaAllowed: Number(latestWeek[0].rushEpaAllowed),
    pressureRate: Number(latestWeek[0].pressureRateGenerated),
    week: latestWeek[0].week,
  };
}

/**
 * Get injury status if available
 */
async function getInjuryStatus(canonicalId: string | null) {
  if (!canonicalId) return null;
  
  try {
    const injuryData = await db
      .select()
      .from(injuries)
      .where(eq(injuries.canonicalPlayerId, canonicalId))
      .orderBy(sql`${injuries.reportedAt} DESC`)
      .limit(1);
    
    if (injuryData.length === 0) return null;
    
    return {
      status: mapInjuryStatus(injuryData[0].status),
      bodyPart: injuryData[0].bodyPart,
    };
  } catch {
    return null;
  }
}

/**
 * Calculate matchup score from defensive context
 */
function calculateMatchupScore(defenseContext: any, position: string) {
  // Higher EPA allowed = easier matchup
  let baseScore = 50;
  
  if (position === "QB" || position === "WR" || position === "TE") {
    // Pass-catcher matchup
    const epaScore = (defenseContext.passEpaAllowed + 0.2) / 0.4 * 50; // Normalize to 0-100
    baseScore = Math.max(0, Math.min(100, epaScore + 50));
  } else if (position === "RB") {
    // Rush matchup + pass-catching
    const rushScore = (defenseContext.rushEpaAllowed + 0.2) / 0.4 * 40;
    const passScore = (defenseContext.passEpaAllowed + 0.2) / 0.4 * 10;
    baseScore = Math.max(0, Math.min(100, rushScore + passScore + 50));
  }
  
  // Pressure rate affects QB negatively
  if (position === "QB") {
    baseScore -= defenseContext.pressureRate * 30; // High pressure = bad matchup
  }
  
  // Convert to defense rank (1-32 scale, inverted)
  const defenseRank = Math.round((100 - baseScore) / 100 * 31 + 1);
  
  return {
    score: Math.round(baseScore),
    defenseRank,
  };
}

/**
 * Map EPA to fantasy point projection
 */
function mapEPAToProjection(epa: number, position: string): number {
  // EPA typically ranges from -0.5 to 3.0 for top performers
  // Map to fantasy points (5-25 range for skill positions)
  
  const normalized = Math.max(-0.5, Math.min(3.5, epa));
  
  if (position === "QB") {
    // QBs: 12-28 point range
    return 12 + ((normalized + 0.5) / 4.0) * 16;
  } else if (position === "RB") {
    // RBs: 8-22 point range
    return 8 + ((normalized + 0.5) / 4.0) * 14;
  } else {
    // WR/TE: 6-20 point range
    return 6 + ((normalized + 0.5) / 4.0) * 14;
  }
}

/**
 * Map injury status to start/sit tags
 */
function mapInjuryStatus(status: string | null): "OUT" | "D" | "Q" | "P" | null {
  if (!status) return null;
  
  const s = status.toLowerCase();
  if (s.includes("out") || s === "ir") return "OUT";
  if (s.includes("doubtful")) return "D";
  if (s.includes("questionable")) return "Q";
  if (s.includes("probable")) return "P";
  
  return null;
}
