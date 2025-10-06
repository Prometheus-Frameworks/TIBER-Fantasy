/**
 * Player Comparison Service
 * 
 * Compare two players side-by-side with usage stats and opponent matchup analysis
 */

import { db } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import { 
  playerUsage, 
  teamDefensiveContext,
  teamReceiverAlignmentMatchups,
  schedule,
  playerIdentityMap 
} from '../../shared/schema';

interface PlayerUsageWithWeek {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  week: number;
  season: number;
  dataWeek: number; // Actual week of data (may be different if fallback)
  dataContext: string; // e.g., "Week 5 bye", "Week 5 injured"
  
  // WR usage
  targets?: number;
  targetSharePct?: number;
  alignmentOutsidePct?: number;
  alignmentSlotPct?: number;
  routesTotal?: number;
  
  // RB usage
  carriesTotal?: number;
  carriesGap?: number;
  carriesZone?: number;
  
  // General
  snapSharePct?: number;
}

interface OpponentDefense {
  opponent: string;
  week: number;
  
  // Alignment-based FPG allowed
  outsideWrFpgAllowed?: number;
  slotWrFpgAllowed?: number;
  teFpgAllowed?: number;
  
  // EPA metrics
  passEpaAllowed?: number;
  rushEpaAllowed?: number;
  
  // Defensive rank context
  defenseRank?: string;
}

interface ComparisonVerdict {
  recommendation: string; // "Lean Player A", "Lean Player B", "Coin flip"
  confidence: string; // "High", "Medium", "Low"
  keyFactors: string[];
}

interface PlayerComparison {
  player1: {
    usage: PlayerUsageWithWeek;
    opponent: OpponentDefense;
  };
  player2: {
    usage: PlayerUsageWithWeek;
    opponent: OpponentDefense;
  };
  verdict: ComparisonVerdict;
  generatedAt: string;
}

/**
 * Get most recent usage data for a player (with fallback)
 */
async function getPlayerUsageWithFallback(
  playerId: string,
  targetWeek: number,
  season: number = 2025
): Promise<PlayerUsageWithWeek | null> {
  try {
    // Get player identity
    const playerData = await db
      .select()
      .from(playerIdentityMap)
      .where(eq(playerIdentityMap.canonicalId, playerId))
      .limit(1);
    
    if (playerData.length === 0) return null;
    
    const player = playerData[0];
    
    // Try to get data for target week first
    let usageData = await db
      .select()
      .from(playerUsage)
      .where(
        and(
          eq(playerUsage.playerId, playerId),
          eq(playerUsage.week, targetWeek),
          eq(playerUsage.season, season)
        )
      )
      .limit(1);
    
    let dataContext = "";
    let actualWeek = targetWeek;
    
    // If no data for target week, fall back to most recent week
    if (usageData.length === 0) {
      usageData = await db
        .select()
        .from(playerUsage)
        .where(
          and(
            eq(playerUsage.playerId, playerId),
            eq(playerUsage.season, season)
          )
        )
        .orderBy(desc(playerUsage.week))
        .limit(1);
      
      if (usageData.length === 0) {
        return null; // No data at all
      }
      
      actualWeek = usageData[0].week;
      const weeksOld = targetWeek - actualWeek;
      
      // Determine context
      if (weeksOld === 1) {
        dataContext = `Week ${targetWeek} bye/injured`;
      } else if (weeksOld > 1) {
        dataContext = `${weeksOld} weeks old data`;
      }
    }
    
    const usage = usageData[0];
    
    return {
      playerId,
      playerName: player.fullName,
      position: player.position,
      team: player.nflTeam || '',
      week: targetWeek,
      season,
      dataWeek: actualWeek,
      dataContext,
      targets: usage.targets ?? undefined,
      targetSharePct: usage.targetSharePct ?? undefined,
      alignmentOutsidePct: usage.alignmentOutsidePct ?? undefined,
      alignmentSlotPct: usage.alignmentSlotPct ?? undefined,
      routesTotal: usage.routesTotal ?? undefined,
      carriesTotal: usage.carriesTotal ?? undefined,
      carriesGap: usage.carriesGap ?? undefined,
      carriesZone: usage.carriesZone ?? undefined,
      snapSharePct: usage.snapSharePct ?? undefined,
    };
  } catch (error) {
    console.error('Error getting player usage:', error);
    return null;
  }
}

/**
 * Get opponent defensive stats for a specific week
 */
async function getOpponentDefense(
  playerTeam: string,
  week: number,
  season: number = 2025
): Promise<OpponentDefense | null> {
  try {
    // Find opponent from schedule
    const games = await db
      .select()
      .from(schedule)
      .where(
        and(
          eq(schedule.season, season),
          eq(schedule.week, week),
          sql`(${schedule.home} = ${playerTeam} OR ${schedule.away} = ${playerTeam})`
        )
      )
      .limit(1);
    
    if (games.length === 0) return null;
    
    const game = games[0];
    const opponent = game.home === playerTeam ? game.away : game.home;
    
    // Get defensive context
    const defContext = await db
      .select()
      .from(teamDefensiveContext)
      .where(eq(teamDefensiveContext.team, opponent))
      .limit(1);
    
    // Get alignment matchups
    const alignmentData = await db
      .select()
      .from(teamReceiverAlignmentMatchups)
      .where(eq(teamReceiverAlignmentMatchups.team, opponent))
      .limit(1);
    
    return {
      opponent,
      week,
      passEpaAllowed: defContext[0]?.passEpaAllowed ?? undefined,
      rushEpaAllowed: defContext[0]?.rushEpaAllowed ?? undefined,
      outsideWrFpgAllowed: alignmentData[0]?.defOutsideWrFpgAllowed ?? undefined,
      slotWrFpgAllowed: alignmentData[0]?.defSlotFpgAllowed ?? undefined,
      teFpgAllowed: alignmentData[0]?.defTeFpgAllowed ?? undefined,
    };
  } catch (error) {
    console.error('Error getting opponent defense:', error);
    return null;
  }
}

/**
 * Generate comparison verdict based on usage and matchup data
 */
function generateVerdict(
  player1Usage: PlayerUsageWithWeek,
  player1Defense: OpponentDefense,
  player2Usage: PlayerUsageWithWeek,
  player2Defense: OpponentDefense
): ComparisonVerdict {
  const factors: string[] = [];
  let player1Score = 50;
  let player2Score = 50;
  
  // Compare target share (WR)
  if (player1Usage.targetSharePct && player2Usage.targetSharePct) {
    const diff = player1Usage.targetSharePct - player2Usage.targetSharePct;
    if (Math.abs(diff) > 5) {
      if (diff > 0) {
        player1Score += 10;
        factors.push(`${player1Usage.playerName} has higher target share (${player1Usage.targetSharePct.toFixed(1)}% vs ${player2Usage.targetSharePct.toFixed(1)}%)`);
      } else {
        player2Score += 10;
        factors.push(`${player2Usage.playerName} has higher target share (${player2Usage.targetSharePct.toFixed(1)}% vs ${player1Usage.targetSharePct.toFixed(1)}%)`);
      }
    }
  }
  
  // Compare alignment vs opponent (WR)
  if (player1Usage.alignmentOutsidePct && player1Defense.outsideWrFpgAllowed &&
      player2Usage.alignmentOutsidePct && player2Defense.outsideWrFpgAllowed) {
    
    // Player 1 outside matchup
    const p1OutsideAdvantage = (player1Usage.alignmentOutsidePct / 100) * (player1Defense.outsideWrFpgAllowed - 10);
    const p2OutsideAdvantage = (player2Usage.alignmentOutsidePct / 100) * (player2Defense.outsideWrFpgAllowed - 10);
    
    if (p1OutsideAdvantage > p2OutsideAdvantage + 2) {
      player1Score += 8;
      factors.push(`${player1Usage.playerName}'s opponent allows ${player1Defense.outsideWrFpgAllowed.toFixed(1)} FPG to outside WRs (${player1Usage.alignmentOutsidePct.toFixed(0)}% outside usage)`);
    } else if (p2OutsideAdvantage > p1OutsideAdvantage + 2) {
      player2Score += 8;
      factors.push(`${player2Usage.playerName}'s opponent allows ${player2Defense.outsideWrFpgAllowed.toFixed(1)} FPG to outside WRs (${player2Usage.alignmentOutsidePct.toFixed(0)}% outside usage)`);
    }
  }
  
  // Compare carries (RB)
  if (player1Usage.carriesTotal && player2Usage.carriesTotal) {
    const diff = player1Usage.carriesTotal - player2Usage.carriesTotal;
    if (Math.abs(diff) > 5) {
      if (diff > 0) {
        player1Score += 12;
        factors.push(`${player1Usage.playerName} has higher volume (${player1Usage.carriesTotal} carries vs ${player2Usage.carriesTotal})`);
      } else {
        player2Score += 12;
        factors.push(`${player2Usage.playerName} has higher volume (${player2Usage.carriesTotal} carries vs ${player1Usage.carriesTotal})`);
      }
    }
  }
  
  // Compare rush EPA allowed (RB)
  if (player1Defense.rushEpaAllowed && player2Defense.rushEpaAllowed) {
    if (player1Defense.rushEpaAllowed > player2Defense.rushEpaAllowed + 0.02) {
      player1Score += 8;
      factors.push(`${player1Usage.playerName} faces softer run defense (+${player1Defense.rushEpaAllowed.toFixed(3)} rush EPA allowed)`);
    } else if (player2Defense.rushEpaAllowed > player1Defense.rushEpaAllowed + 0.02) {
      player2Score += 8;
      factors.push(`${player2Usage.playerName} faces softer run defense (+${player2Defense.rushEpaAllowed.toFixed(3)} rush EPA allowed)`);
    }
  }
  
  // Add data freshness warnings
  if (player1Usage.dataContext) {
    factors.push(`⚠️ ${player1Usage.playerName}: Week ${player1Usage.dataWeek} data (${player1Usage.dataContext})`);
  }
  if (player2Usage.dataContext) {
    factors.push(`⚠️ ${player2Usage.playerName}: Week ${player2Usage.dataWeek} data (${player2Usage.dataContext})`);
  }
  
  // Generate recommendation
  const scoreDiff = Math.abs(player1Score - player2Score);
  let recommendation: string;
  let confidence: string;
  
  if (scoreDiff < 5) {
    recommendation = "Coin flip";
    confidence = "Low";
  } else if (scoreDiff < 15) {
    recommendation = player1Score > player2Score 
      ? `Lean ${player1Usage.playerName}` 
      : `Lean ${player2Usage.playerName}`;
    confidence = "Medium";
  } else {
    recommendation = player1Score > player2Score 
      ? `Lean ${player1Usage.playerName}` 
      : `Lean ${player2Usage.playerName}`;
    confidence = "High";
  }
  
  // Limit to top 4 factors
  return {
    recommendation,
    confidence,
    keyFactors: factors.slice(0, 4),
  };
}

/**
 * Main function: Compare two players for a specific week
 */
export async function comparePlayers(
  player1Id: string,
  player2Id: string,
  targetWeek: number,
  season: number = 2025
): Promise<PlayerComparison | null> {
  try {
    // Get usage data for both players (with fallback)
    const [player1Usage, player2Usage] = await Promise.all([
      getPlayerUsageWithFallback(player1Id, targetWeek - 1, season), // Previous week usage
      getPlayerUsageWithFallback(player2Id, targetWeek - 1, season),
    ]);
    
    if (!player1Usage || !player2Usage) {
      return null;
    }
    
    // Get opponent defense for target week
    const [player1Defense, player2Defense] = await Promise.all([
      getOpponentDefense(player1Usage.team, targetWeek, season),
      getOpponentDefense(player2Usage.team, targetWeek, season),
    ]);
    
    if (!player1Defense || !player2Defense) {
      return null;
    }
    
    // Generate verdict
    const verdict = generateVerdict(player1Usage, player1Defense, player2Usage, player2Defense);
    
    return {
      player1: {
        usage: player1Usage,
        opponent: player1Defense,
      },
      player2: {
        usage: player2Usage,
        opponent: player2Defense,
      },
      verdict,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error comparing players:', error);
    return null;
  }
}
