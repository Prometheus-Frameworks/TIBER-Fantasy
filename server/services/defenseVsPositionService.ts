import { db } from '../db';
import { bronzeNflfastrPlays, defenseVsPositionStats, playerIdentityMap } from '@shared/schema';
import { and, eq, isNull, isNotNull, sql, desc } from 'drizzle-orm';

interface DvPCalculation {
  defense: string;
  position: string;
  season: number;
  week?: number;
  playsAgainst: number;
  uniquePlayers: number;
  fantasyPtsPPR: number;
  fantasyPtsHalfPPR: number;
  fantasyPtsStandard: number;
  avgEPA: number;
  successRate: number;
  touchdownsAllowed: number;
  totalYardsAllowed: number;
  receptionsAllowed: number;
  targetsAllowed: number;
}

/**
 * Calculate fantasy points for a single play based on scoring format
 */
function calculatePlayFantasyPoints(
  play: any,
  format: 'ppr' | 'half-ppr' | 'standard',
  position: string
): number {
  let points = 0;
  
  const yardsGained = play.yardsGained || 0;
  const isTD = play.touchdown || false;
  const isComplete = play.completePass || false;
  const isPass = play.playType === 'pass';
  const isRush = play.playType === 'run';
  
  // QB scoring (passing + rushing)
  if (position === 'QB') {
    if (isPass) {
      points += (yardsGained / 25);  // 1 pt per 25 passing yards
      if (isTD) points += 4;  // Passing TD = 4 pts
      if (play.interception) points -= 2;  // INT = -2 pts
    }
    if (isRush) {
      points += (yardsGained / 10);  // 1 pt per 10 rushing yards
      if (isTD) points += 6;  // Rushing TD = 6 pts
    }
  }
  
  // RB scoring (rushing + receiving)
  if (position === 'RB') {
    if (isRush) {
      points += (yardsGained / 10);  // 1 pt per 10 rushing yards
      if (isTD) points += 6;  // Rushing TD = 6 pts
    }
    if (isPass && isComplete) {
      points += (yardsGained / 10);  // 1 pt per 10 receiving yards
      if (isTD) points += 6;  // Receiving TD = 6 pts
      
      // Reception bonus
      if (format === 'ppr') points += 1;
      if (format === 'half-ppr') points += 0.5;
    }
  }
  
  // WR/TE scoring (receiving only)
  if ((position === 'WR' || position === 'TE') && isPass && isComplete) {
    points += (yardsGained / 10);  // 1 pt per 10 receiving yards
    if (isTD) points += 6;  // Receiving TD = 6 pts
    
    // Reception bonus
    if (format === 'ppr') points += 1;
    if (format === 'half-ppr') points += 0.5;
  }
  
  return points;
}

/**
 * Calculate fantasy points allowed by all defenses for a specific position
 */
export async function calculateDefenseVsPosition(
  season: number,
  week?: number
): Promise<void> {
  console.log(`🛡️ [DvP] Calculating defense vs position stats for ${season} week ${week || 'season'}`);
  
  const positions = ['QB', 'RB', 'WR', 'TE'];
  
  for (const position of positions) {
    console.log(`📊 [DvP] Processing ${position}...`);
    
    // Get all plays for this position
    const weekCondition = week ? eq(bronzeNflfastrPlays.week, week) : sql`1=1`;
    
    let playQuery;
    
    if (position === 'QB') {
      // QB = passing plays + QB rushing plays
      playQuery = db
        .select()
        .from(bronzeNflfastrPlays)
        .leftJoin(
          playerIdentityMap,
          sql`(${bronzeNflfastrPlays.passerPlayerId} = ${playerIdentityMap.nflDataPyId} 
               OR ${bronzeNflfastrPlays.rusherPlayerId} = ${playerIdentityMap.nflDataPyId})`
        )
        .where(
          and(
            eq(bronzeNflfastrPlays.season, season),
            weekCondition,
            isNotNull(bronzeNflfastrPlays.defteam),
            sql`(
              (${bronzeNflfastrPlays.playType} = 'pass' AND ${bronzeNflfastrPlays.passerPlayerId} IS NOT NULL)
              OR (${bronzeNflfastrPlays.playType} = 'run' AND ${bronzeNflfastrPlays.rusherPlayerId} IS NOT NULL)
            )`,
            eq(playerIdentityMap.position, 'QB')
          )
        );
    } else if (position === 'RB') {
      // RB = rushing plays + receiving plays where player is RB
      playQuery = db
        .select()
        .from(bronzeNflfastrPlays)
        .leftJoin(
          playerIdentityMap,
          sql`(${bronzeNflfastrPlays.rusherPlayerId} = ${playerIdentityMap.nflDataPyId} 
               OR ${bronzeNflfastrPlays.receiverPlayerId} = ${playerIdentityMap.nflDataPyId})`
        )
        .where(
          and(
            eq(bronzeNflfastrPlays.season, season),
            weekCondition,
            isNotNull(bronzeNflfastrPlays.defteam),
            sql`(
              (${bronzeNflfastrPlays.playType} = 'run' AND ${bronzeNflfastrPlays.rusherPlayerId} IS NOT NULL)
              OR (${bronzeNflfastrPlays.playType} = 'pass' AND ${bronzeNflfastrPlays.receiverPlayerId} IS NOT NULL)
            )`,
            eq(playerIdentityMap.position, 'RB')
          )
        );
    } else {
      // WR/TE = receiving plays only
      playQuery = db
        .select()
        .from(bronzeNflfastrPlays)
        .leftJoin(
          playerIdentityMap,
          eq(bronzeNflfastrPlays.receiverPlayerId, playerIdentityMap.nflDataPyId)
        )
        .where(
          and(
            eq(bronzeNflfastrPlays.season, season),
            weekCondition,
            eq(bronzeNflfastrPlays.playType, 'pass'),
            isNotNull(bronzeNflfastrPlays.receiverPlayerId),
            isNotNull(bronzeNflfastrPlays.defteam),
            eq(playerIdentityMap.position, position)
          )
        );
    }
    
    const plays = await playQuery;
    
    // Group by defense and calculate stats
    const defenseStats = new Map<string, DvPCalculation>();
    
    for (const row of plays) {
      const play = row.bronze_nflfastr_plays;
      const defense = play.defteam!;
      
      if (!defenseStats.has(defense)) {
        defenseStats.set(defense, {
          defense,
          position,
          season,
          week,
          playsAgainst: 0,
          uniquePlayers: 0,
          fantasyPtsPPR: 0,
          fantasyPtsHalfPPR: 0,
          fantasyPtsStandard: 0,
          avgEPA: 0,
          successRate: 0,
          touchdownsAllowed: 0,
          totalYardsAllowed: 0,
          receptionsAllowed: 0,
          targetsAllowed: 0
        });
      }
      
      const stats = defenseStats.get(defense)!;
      
      // Increment counters
      stats.playsAgainst++;
      stats.totalYardsAllowed += play.yardsGained || 0;
      
      if (play.touchdown) stats.touchdownsAllowed++;
      if (play.completePass) stats.receptionsAllowed++;
      if (play.receiverPlayerId) stats.targetsAllowed++;
      
      // Add fantasy points for each format
      stats.fantasyPtsPPR += calculatePlayFantasyPoints(play, 'ppr', position);
      stats.fantasyPtsHalfPPR += calculatePlayFantasyPoints(play, 'half-ppr', position);
      stats.fantasyPtsStandard += calculatePlayFantasyPoints(play, 'standard', position);
      
      // EPA tracking
      if (play.epa !== null) {
        const currentAvg = stats.avgEPA;
        const count = stats.playsAgainst;
        stats.avgEPA = ((currentAvg * (count - 1)) + play.epa) / count;
      }
    }
    
    // Calculate unique players for each defense - position-specific
    for (const [defense, stats] of Array.from(defenseStats.entries())) {
      const uniquePlayerIds = new Set(
        plays
          .filter(row => row.bronze_nflfastr_plays.defteam === defense)
          .map(row => {
            const play = row.bronze_nflfastr_plays;
            
            // Get the actual offensive player based on position
            if (position === 'QB') {
              // For QB, use passer for passes, rusher for runs
              return play.passerPlayerId || play.rusherPlayerId;
            } else if (position === 'RB') {
              // For RB, use rusher for runs, receiver for passes
              return play.rusherPlayerId || play.receiverPlayerId;
            } else {
              // For WR/TE, use receiver only
              return play.receiverPlayerId;
            }
          })
          .filter(Boolean)
      );
      stats.uniquePlayers = uniquePlayerIds.size;
    }
    
    // Convert Map to Array and sort by fantasy points (descending = worst defense)
    const rankedDefenses = Array.from(defenseStats.values())
      .sort((a, b) => b.fantasyPtsPPR - a.fantasyPtsPPR);
    
    // Assign ranks and ratings
    for (let i = 0; i < rankedDefenses.length; i++) {
      const stat = rankedDefenses[i];
      const rank = i + 1;
      
      // Determine matchup quality (1-8 = elite, 9-16 = good, etc.)
      let rating: string;
      if (rank <= 5) rating = 'elite-matchup';  // Top 5 = worst defenses = best matchups
      else if (rank <= 10) rating = 'good';
      else if (rank <= 24) rating = 'neutral';
      else if (rank <= 29) rating = 'tough';
      else rating = 'avoid';
      
      // Calculate per-game averages
      const gamesPlayed = week ? 1 : 5;  // Adjust based on weeks played
      const avgPtsPPR = stat.fantasyPtsPPR / gamesPlayed;
      const avgPtsStandard = stat.fantasyPtsStandard / gamesPlayed;
      
      // Insert or update database
      await db.insert(defenseVsPositionStats)
        .values({
          defenseTeam: stat.defense,
          position: stat.position,
          season: stat.season,
          week: stat.week || null,
          playsAgainst: stat.playsAgainst,
          uniquePlayers: stat.uniquePlayers,
          fantasyPtsPpr: stat.fantasyPtsPPR,
          fantasyPtsHalfPpr: stat.fantasyPtsHalfPPR,
          fantasyPtsStandard: stat.fantasyPtsStandard,
          avgPtsPerGamePpr: avgPtsPPR,
          avgPtsPerGameStandard: avgPtsStandard,
          avgEpaAllowed: stat.avgEPA,
          successRateAllowed: stat.successRate,
          touchdownsAllowed: stat.touchdownsAllowed,
          totalYardsAllowed: stat.totalYardsAllowed,
          receptionsAllowed: stat.receptionsAllowed,
          targetsAllowed: stat.targetsAllowed,
          rankVsPosition: rank,
          dvpRating: rating
        })
        .onConflictDoUpdate({
          target: [
            defenseVsPositionStats.defenseTeam,
            defenseVsPositionStats.position,
            defenseVsPositionStats.season,
            defenseVsPositionStats.week
          ],
          set: {
            playsAgainst: stat.playsAgainst,
            uniquePlayers: stat.uniquePlayers,
            fantasyPtsPpr: stat.fantasyPtsPPR,
            fantasyPtsHalfPpr: stat.fantasyPtsHalfPPR,
            fantasyPtsStandard: stat.fantasyPtsStandard,
            avgPtsPerGamePpr: avgPtsPPR,
            avgPtsPerGameStandard: avgPtsStandard,
            avgEpaAllowed: stat.avgEPA,
            successRateAllowed: stat.successRate,
            touchdownsAllowed: stat.touchdownsAllowed,
            totalYardsAllowed: stat.totalYardsAllowed,
            receptionsAllowed: stat.receptionsAllowed,
            targetsAllowed: stat.targetsAllowed,
            rankVsPosition: rank,
            dvpRating: rating,
            updatedAt: new Date()
          }
        });
      
      console.log(`  ✅ ${stat.defense} vs ${position}: Rank ${rank} (${rating}) - ${avgPtsPPR.toFixed(1)} pts/game`);
    }
  }
  
  console.log(`✅ [DvP] Calculation complete for ${season} week ${week || 'season'}`);
}

/**
 * Get defense vs position stats for matchup analysis
 */
export async function getDefenseVsPosition(
  position?: string,
  season: number = 2025,
  week?: number
) {
  const conditions = [eq(defenseVsPositionStats.season, season)];
  
  if (position) {
    conditions.push(eq(defenseVsPositionStats.position, position));
  }
  
  if (week !== undefined) {
    conditions.push(eq(defenseVsPositionStats.week, week));
  } else {
    conditions.push(isNull(defenseVsPositionStats.week));
  }
  
  return db
    .select()
    .from(defenseVsPositionStats)
    .where(and(...conditions))
    .orderBy(defenseVsPositionStats.rankVsPosition);
}

/**
 * Get matchup rating for a specific player's upcoming opponent
 */
export async function getMatchupRating(
  position: string,
  opponentDefense: string,
  season: number = 2025,
  week?: number
): Promise<{
  rating: string;
  rank: number;
  avgPtsAllowed: number;
  projectedBoost: number;
} | null> {
  const conditions = [
    eq(defenseVsPositionStats.season, season),
    eq(defenseVsPositionStats.position, position),
    eq(defenseVsPositionStats.defenseTeam, opponentDefense)
  ];
  
  if (week !== undefined) {
    conditions.push(eq(defenseVsPositionStats.week, week));
  } else {
    conditions.push(isNull(defenseVsPositionStats.week));
  }
  
  const [stats] = await db
    .select()
    .from(defenseVsPositionStats)
    .where(and(...conditions))
    .limit(1);
  
  if (!stats) {
    return null;
  }
  
  // Calculate projected boost based on rank
  let projectedBoost = 0;
  if (stats.rankVsPosition && stats.rankVsPosition <= 5) projectedBoost = 15;
  else if (stats.rankVsPosition && stats.rankVsPosition <= 10) projectedBoost = 8;
  else if (stats.rankVsPosition && stats.rankVsPosition <= 24) projectedBoost = 0;
  else if (stats.rankVsPosition && stats.rankVsPosition <= 29) projectedBoost = -8;
  else projectedBoost = -15;
  
  return {
    rating: stats.dvpRating || 'neutral',
    rank: stats.rankVsPosition || 99,
    avgPtsAllowed: stats.avgPtsPerGamePpr || 0,
    projectedBoost
  };
}
