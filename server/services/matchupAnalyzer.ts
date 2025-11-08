/**
 * Player Matchup Intelligence System
 * 
 * Analyzes player usage patterns against defensive matchups to generate
 * confidence-scored start/sit recommendations for fantasy football.
 */

import { db } from '../infra/db';
import { sql, eq, and, desc } from 'drizzle-orm';
import { 
  playerUsage, 
  teamDefensiveContext, 
  teamCoverageMatchups,
  teamReceiverAlignmentMatchups,
  schedule,
  playerIdentityMap 
} from '../../shared/schema';

interface PlayerUsageData {
  playerId: string;
  playerName?: string;
  week: number;
  season: number;
  position?: string;
  team?: string;
  
  // WR metrics
  routesTotal?: number | null;
  routesOutside?: number | null;
  routesSlot?: number | null;
  alignmentOutsidePct?: number | null;
  alignmentSlotPct?: number | null;
  
  // General metrics
  targets?: number | null;
  targetSharePct?: number | null;
  snapSharePct?: number | null;
  
  // RB metrics
  carriesGap?: number | null;
  carriesZone?: number | null;
  carriesTotal?: number | null;
}

interface DefensiveMatchup {
  opponent: string;
  defenseRank?: string;
  
  // From team_defensive_context
  passEpaAllowed?: number | null;
  rushEpaAllowed?: number | null;
  pressureRateGenerated?: number | null;
  
  // From team_coverage_matchups
  coverageBreakdown?: {
    zoneCoveragePct?: number | null;
    manCoveragePct?: number | null;
    twoHighCoveragePct?: number | null;
    singleHighCoveragePct?: number | null;
    fpPerDbZone?: number | null;
    fpPerDbMan?: number | null;
  };
  
  // From team_receiver_alignment_matchups
  alignmentMatchup?: {
    fantasyPointsOutside?: number | null;
    fantasyPointsSlot?: number | null;
    fantasyPointsTight?: number | null;
  };
}

interface MatchupAnalysis {
  playerId: string;
  playerName: string;
  position: string;
  week: number;
  season: number;
  
  // Player context
  usage: PlayerUsageData;
  
  // Opponent context
  opponent: string;
  defensiveMatchup: DefensiveMatchup;
  
  // Analysis
  recommendation: 'START' | 'SIT' | 'FLEX' | 'MONITOR';
  confidenceScore: number; // 0-100
  reasoning: string[];
  exploits: string[];
  concerns: string[];
  
  // Key stats
  projectedPoints?: number;
  matchupScore: number; // 0-100, higher is better
}

/**
 * Calculate matchup score for WR based on alignment
 */
function calculateWRMatchupScore(
  usage: PlayerUsageData,
  defensive: DefensiveMatchup
): { score: number; reasoning: string[] } {
  const reasoning: string[] = [];
  let score = 50; // Neutral baseline
  
  const outsidePct = usage.alignmentOutsidePct || 0;
  const slotPct = usage.alignmentSlotPct || 0;
  const outsideFpg = defensive.alignmentMatchup?.fantasyPointsOutside || 0;
  const slotFpg = defensive.alignmentMatchup?.fantasyPointsSlot || 0;
  
  // Alignment matchup scoring
  if (outsidePct > 60 && outsideFpg > 12) {
    score += 15;
    reasoning.push(`Strong outside alignment (${outsidePct.toFixed(0)}%) vs defense allowing ${outsideFpg.toFixed(1)} FPG to outside WRs`);
  } else if (outsidePct > 60 && outsideFpg < 8) {
    score -= 10;
    reasoning.push(`Heavy outside usage (${outsidePct.toFixed(0)}%) vs tough outside coverage (${outsideFpg.toFixed(1)} FPG allowed)`);
  }
  
  if (slotPct > 40 && slotFpg > 12) {
    score += 15;
    reasoning.push(`Significant slot usage (${slotPct.toFixed(0)}%) vs defense allowing ${slotFpg.toFixed(1)} FPG to slot WRs`);
  }
  
  // Target share boost
  const targetShare = usage.targetSharePct || 0;
  if (targetShare > 25) {
    score += 10;
    reasoning.push(`Elite target share (${targetShare.toFixed(1)}%) ensures volume`);
  } else if (targetShare < 15) {
    score -= 8;
    reasoning.push(`Low target share (${targetShare.toFixed(1)}%) limits upside`);
  }
  
  // Coverage type analysis
  const coverage = defensive.coverageBreakdown;
  if (coverage) {
    if (coverage.twoHighCoveragePct && coverage.twoHighCoveragePct > 50 && slotPct > 30) {
      score += 8;
      reasoning.push(`Two-high shell defense (${coverage.twoHighCoveragePct.toFixed(0)}% rate) favors slot receivers`);
    }
    
    if (coverage.manCoveragePct && coverage.manCoveragePct > 40 && coverage.fpPerDbMan && coverage.fpPerDbMan > 15) {
      score += 7;
      reasoning.push(`Man coverage struggles (${coverage.fpPerDbMan.toFixed(1)} FPDB allowed)`);
    }
  }
  
  // Cap score at 0-100
  return { score: Math.max(0, Math.min(100, score)), reasoning };
}

/**
 * Calculate matchup score for RB
 */
function calculateRBMatchupScore(
  usage: PlayerUsageData,
  defensive: DefensiveMatchup
): { score: number; reasoning: string[] } {
  const reasoning: string[] = [];
  let score = 50; // Neutral baseline
  
  const rushEpa = defensive.rushEpaAllowed || 0;
  const totalCarries = usage.carriesTotal || 0;
  
  // Volume is king for RBs
  if (totalCarries > 15) {
    score += 15;
    reasoning.push(`High-volume lead back (${totalCarries} carries last week)`);
  } else if (totalCarries < 8) {
    score -= 12;
    reasoning.push(`Limited carry volume (${totalCarries} carries) in committee`);
  }
  
  // Rush EPA allowed
  if (rushEpa > 0.05) {
    score += 12;
    reasoning.push(`Opponent allows +${rushEpa.toFixed(3)} rush EPA/play (poor run defense)`);
  } else if (rushEpa < -0.05) {
    score -= 10;
    reasoning.push(`Opponent allows ${rushEpa.toFixed(3)} rush EPA/play (elite run defense)`);
  }
  
  // Pressure rate (affects pass-catching RBs)
  const pressureRate = defensive.pressureRateGenerated || 0;
  if (pressureRate > 30 && (usage.targets || 0) > 3) {
    score += 8;
    reasoning.push(`High pressure rate (${pressureRate.toFixed(1)}%) creates checkdown opportunities`);
  }
  
  // Cap score at 0-100
  return { score: Math.max(0, Math.min(100, score)), reasoning };
}

/**
 * Generate recommendation based on matchup score
 */
function generateRecommendation(score: number, position: string): {
  recommendation: 'START' | 'SIT' | 'FLEX' | 'MONITOR';
  confidence: number;
} {
  if (score >= 70) {
    return { recommendation: 'START', confidence: score };
  } else if (score >= 55) {
    return { recommendation: 'FLEX', confidence: score };
  } else if (score >= 40) {
    return { recommendation: 'MONITOR', confidence: 100 - score };
  } else {
    return { recommendation: 'SIT', confidence: 100 - score };
  }
}

/**
 * Main function: Analyze player matchup for a given week
 */
export async function analyzePlayerMatchup(
  playerId: string,
  week: number,
  season: number = 2024
): Promise<MatchupAnalysis | null> {
  try {
    // 1. Fetch player identity
    const playerIdentity = await db
      .select()
      .from(playerIdentityMap)
      .where(eq(playerIdentityMap.canonicalId, playerId))
      .limit(1);
    
    if (playerIdentity.length === 0) {
      console.error(`Player not found: ${playerId}`);
      return null;
    }
    
    const player = playerIdentity[0];
    const position = player.position || 'UNKNOWN';
    const team = player.nflTeam || '';
    
    // 2. Fetch player usage data
    const usageData = await db
      .select()
      .from(playerUsage)
      .where(
        and(
          eq(playerUsage.playerId, playerId),
          eq(playerUsage.week, week),
          eq(playerUsage.season, season)
        )
      )
      .limit(1);
    
    if (usageData.length === 0) {
      console.log(`No usage data found for ${player.fullName} (Week ${week})`);
      return null;
    }
    
    const usage = usageData[0];
    
    // 3. Find opponent from schedule
    const games = await db
      .select()
      .from(schedule)
      .where(
        and(
          eq(schedule.season, season),
          eq(schedule.week, week),
          sql`(${schedule.home} = ${team} OR ${schedule.away} = ${team})`
        )
      )
      .limit(1);
    
    if (games.length === 0) {
      console.log(`No game found for ${team} in Week ${week}`);
      return null;
    }
    
    const game = games[0];
    const opponent = game.home === team ? game.away : game.home;
    
    // 4. Fetch defensive matchup data
    const defContext = await db
      .select()
      .from(teamDefensiveContext)
      .where(eq(teamDefensiveContext.team, opponent))
      .limit(1);
    
    const coverageData = await db
      .select()
      .from(teamCoverageMatchups)
      .where(eq(teamCoverageMatchups.team, opponent))
      .limit(1);
    
    const alignmentData = await db
      .select()
      .from(teamReceiverAlignmentMatchups)
      .where(eq(teamReceiverAlignmentMatchups.team, opponent))
      .limit(1);
    
    const defensiveMatchup: DefensiveMatchup = {
      opponent,
      passEpaAllowed: defContext[0]?.passEpaAllowed ?? undefined,
      rushEpaAllowed: defContext[0]?.rushEpaAllowed ?? undefined,
      pressureRateGenerated: defContext[0]?.pressureRateGenerated ?? undefined,
      coverageBreakdown: coverageData[0] ? {
        zoneCoveragePct: coverageData[0].defZonePct ?? undefined,
        manCoveragePct: coverageData[0].defManPct ?? undefined,
        twoHighCoveragePct: coverageData[0].defTwoHighPct ?? undefined,
        singleHighCoveragePct: coverageData[0].defOneHighPct ?? undefined,
        fpPerDbZone: coverageData[0].offZoneFpdb ?? undefined,
        fpPerDbMan: coverageData[0].offManFpdb ?? undefined,
      } : undefined,
      alignmentMatchup: alignmentData[0] ? {
        fantasyPointsOutside: alignmentData[0].defOutsideWrFpgAllowed ?? undefined,
        fantasyPointsSlot: alignmentData[0].defSlotFpgAllowed ?? undefined,
        fantasyPointsTight: alignmentData[0].defTeFpgAllowed ?? undefined,
      } : undefined,
    };
    
    // 5. Calculate matchup score based on position
    let matchupResult: { score: number; reasoning: string[] };
    
    if (position === 'WR') {
      matchupResult = calculateWRMatchupScore(usage, defensiveMatchup);
    } else if (position === 'RB') {
      matchupResult = calculateRBMatchupScore(usage, defensiveMatchup);
    } else {
      // Default for TE/QB (can be expanded later)
      matchupResult = { score: 50, reasoning: ['Position-specific analysis not yet implemented'] };
    }
    
    // 6. Generate recommendation
    const { recommendation, confidence } = generateRecommendation(matchupResult.score, position);
    
    // 7. Extract exploits and concerns
    const exploits = matchupResult.reasoning.filter(r => 
      r.includes('allowing') || r.includes('favors') || r.includes('Elite') || r.includes('High-volume')
    );
    const concerns = matchupResult.reasoning.filter(r => 
      r.includes('tough') || r.includes('Limited') || r.includes('Low') || r.includes('elite run defense')
    );
    
    return {
      playerId,
      playerName: player.fullName || playerId,
      position,
      week,
      season,
      usage,
      opponent,
      defensiveMatchup,
      recommendation,
      confidenceScore: confidence,
      reasoning: matchupResult.reasoning,
      exploits,
      concerns,
      matchupScore: matchupResult.score,
    };
    
  } catch (error) {
    console.error('Error analyzing player matchup:', error);
    return null;
  }
}

/**
 * Get top weekly exploits by position
 */
export async function getWeeklyExploits(
  week: number,
  season: number = 2024,
  position: 'WR' | 'RB' | 'TE' = 'WR',
  limit: number = 10
): Promise<MatchupAnalysis[]> {
  try {
    // Get all players for this position with usage data
    const players = await db
      .select()
      .from(playerUsage)
      .innerJoin(
        playerIdentityMap,
        eq(playerUsage.playerId, playerIdentityMap.canonicalId)
      )
      .where(
        and(
          eq(playerUsage.week, week),
          eq(playerUsage.season, season),
          eq(playerIdentityMap.position, position)
        )
      )
      .limit(200); // Process top 200 players
    
    const analyses: MatchupAnalysis[] = [];
    
    // Analyze each player
    for (const { player_usage, player_identity_map } of players) {
      const analysis = await analyzePlayerMatchup(
        player_identity_map.canonicalId,
        week,
        season
      );
      
      if (analysis) {
        analyses.push(analysis);
      }
    }
    
    // Sort by matchup score descending
    analyses.sort((a, b) => b.matchupScore - a.matchupScore);
    
    return analyses.slice(0, limit);
    
  } catch (error) {
    console.error('Error getting weekly exploits:', error);
    return [];
  }
}
