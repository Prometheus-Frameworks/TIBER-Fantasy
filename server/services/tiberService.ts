import { db } from '../db';
import { tiberScores, bronzeNflfastrPlays, players } from '../../shared/schema';
import { eq, and, or, lte, sql } from 'drizzle-orm';

interface TiberScore {
  tiberScore: number;
  tier: 'breakout' | 'stable' | 'regression';
  breakdown: {
    firstDownScore: number;
    epaScore: number;
    usageScore: number;
    tdScore: number;
    teamScore: number;
  };
  metrics: {
    firstDownRate: number;
    totalFirstDowns: number;
    epaPerPlay: number;
    snapPercentAvg: number;
    snapTrend: 'rising' | 'stable' | 'falling';
    tdRate: number;
    teamOffenseRank: number;
  };
}

interface PlayerStats {
  firstDownRate: number;
  totalFirstDowns: number;
  epaPerPlay: number;
  snapPercentAvg: number;
  snapTrend: 'rising' | 'stable' | 'falling';
  tdRate: number;
  teamOffenseRank: number;
  totalPlays: number;
  totalTds: number;
}

export class TiberService {
  private readonly WEIGHTS = {
    FIRST_DOWN: 35,  // v1.5: Most predictive metric (0.750 correlation)
    EPA: 25,         // v1.5: Reduced from 40
    USAGE: 25,       // v1.5: Reduced from 30
    TD: 10,          // v1.5: Reduced from 20 (TDs are fluky)
    TEAM: 5,         // v1.5: Reduced from 10
  };

  async calculateTiberScore(nflfastrId: string, week: number, season: number = 2025): Promise<TiberScore> {
    // Get player stats from NFLfastR data
    const playerStats = await this.getPlayerStats(nflfastrId, week, season);
    
    if (!playerStats) {
      throw new Error(`No stats found for player ${nflfastrId} in week ${week}`);
    }

    // Calculate each component (TIBER v1.5 weights: 35/25/25/10/5)
    const firstDownScore = this.calculateFirstDownScore(playerStats);
    const epaScore = this.calculateEpaScore(playerStats);
    const usageScore = this.calculateUsageScore(playerStats);
    const tdScore = this.calculateTdScore(playerStats);
    const teamScore = this.calculateTeamScore(playerStats);

    const totalScore = Math.round(firstDownScore + epaScore + usageScore + tdScore + teamScore);
    const tier = this.getTier(totalScore);

    return {
      tiberScore: totalScore,
      tier,
      breakdown: {
        firstDownScore: Math.round(firstDownScore),
        epaScore: Math.round(epaScore),
        usageScore: Math.round(usageScore),
        tdScore: Math.round(tdScore),
        teamScore: Math.round(teamScore),
      },
      metrics: {
        firstDownRate: playerStats.firstDownRate,
        totalFirstDowns: playerStats.totalFirstDowns,
        epaPerPlay: playerStats.epaPerPlay,
        snapPercentAvg: playerStats.snapPercentAvg,
        snapTrend: playerStats.snapTrend,
        tdRate: playerStats.tdRate,
        teamOffenseRank: playerStats.teamOffenseRank,
      },
    };
  }

  private async getPlayerStats(nflfastrId: string, week: number, season: number): Promise<PlayerStats | null> {

    // Query NFLfastR data for this player through the current week
    // Use parameterized queries to prevent SQL injection
    const stats = await db
      .select({
        // Receiving stats
        targets: sql<number>`COUNT(CASE WHEN ${bronzeNflfastrPlays.receiverPlayerId} = ${nflfastrId} THEN 1 END)`,
        receptions: sql<number>`COUNT(CASE WHEN ${bronzeNflfastrPlays.receiverPlayerId} = ${nflfastrId} AND ${bronzeNflfastrPlays.completePass} = true THEN 1 END)`,
        receivingEpa: sql<number>`COALESCE(SUM(CASE WHEN ${bronzeNflfastrPlays.receiverPlayerId} = ${nflfastrId} THEN ${bronzeNflfastrPlays.epa} END), 0)`,
        receivingTds: sql<number>`COUNT(CASE WHEN ${bronzeNflfastrPlays.receiverPlayerId} = ${nflfastrId} AND ${bronzeNflfastrPlays.touchdown} = true THEN 1 END)`,
        receivingFirstDowns: sql<number>`COUNT(CASE WHEN ${bronzeNflfastrPlays.receiverPlayerId} = ${nflfastrId} AND ${bronzeNflfastrPlays.firstDownPass} = true THEN 1 END)`,
        
        // Rushing stats
        rushes: sql<number>`COUNT(CASE WHEN ${bronzeNflfastrPlays.rusherPlayerId} = ${nflfastrId} THEN 1 END)`,
        rushingEpa: sql<number>`COALESCE(SUM(CASE WHEN ${bronzeNflfastrPlays.rusherPlayerId} = ${nflfastrId} THEN ${bronzeNflfastrPlays.epa} END), 0)`,
        rushingTds: sql<number>`COUNT(CASE WHEN ${bronzeNflfastrPlays.rusherPlayerId} = ${nflfastrId} AND ${bronzeNflfastrPlays.touchdown} = true THEN 1 END)`,
        rushingFirstDowns: sql<number>`COUNT(CASE WHEN ${bronzeNflfastrPlays.rusherPlayerId} = ${nflfastrId} AND ${bronzeNflfastrPlays.firstDownRush} = true THEN 1 END)`,
        
        // Team context
        teamAbbr: sql<string>`MAX(${bronzeNflfastrPlays.posteam})`,
      })
      .from(bronzeNflfastrPlays)
      .where(
        and(
          eq(bronzeNflfastrPlays.season, season),
          lte(bronzeNflfastrPlays.week, week),
          or(
            eq(bronzeNflfastrPlays.receiverPlayerId, nflfastrId),
            eq(bronzeNflfastrPlays.rusherPlayerId, nflfastrId)
          )
        )
      )
      .execute();

    if (!stats[0] || (Number(stats[0].targets) === 0 && Number(stats[0].rushes) === 0)) {
      return null;
    }

    const data = stats[0];
    const totalPlays = Number(data.targets || 0) + Number(data.rushes || 0);
    const totalEpa = Number(data.receivingEpa || 0) + Number(data.rushingEpa || 0);
    const totalTds = Number(data.receivingTds || 0) + Number(data.rushingTds || 0);
    const totalFirstDowns = Number(data.receivingFirstDowns || 0) + Number(data.rushingFirstDowns || 0);
    const teamAbbr = data.teamAbbr;

    // Calculate EPA per play
    const epaPerPlay = totalPlays > 0 ? totalEpa / totalPlays : 0;
    
    // Calculate TD rate (TDs per 100 plays for better readability)
    const tdRate = totalPlays > 0 ? (totalTds / totalPlays) * 100 : 0;

    // Calculate First Down Rate per Route Run (Ryan Heath's predictive metric: 0.750 correlation)
    // Routes run approximation: targets * 3.5 (industry standard for WR/TE)
    // Elite receivers: 15-17% first down per route run
    const targets = Number(data.targets || 0);
    const routesRun = targets * 3.5; // WRs run ~3.5x more routes than targets
    const receivingFirstDowns = Number(data.receivingFirstDowns || 0);
    const firstDownRate = routesRun > 0 ? receivingFirstDowns / routesRun : 0;

    // Get live snap percentage data from play participation
    const snapData = await this.getPlayerSnapData(nflfastrId, week, season, teamAbbr);
    
    // Get live team offensive rank from EPA data
    const teamData = await this.getTeamOffenseRank(teamAbbr, week, season);

    return {
      firstDownRate,
      totalFirstDowns,
      epaPerPlay,
      snapPercentAvg: snapData.snapPercent,
      snapTrend: snapData.trend,
      tdRate,
      teamOffenseRank: teamData.rank,
      totalPlays,
      totalTds,
    };
  }

  private async getPlayerSnapData(
    playerId: string, 
    week: number, 
    season: number,
    teamAbbr: string
  ): Promise<{ snapPercent: number; trend: 'rising' | 'stable' | 'falling' }> {
    // Calculate "effective snap %" from play participation
    // Total team offensive plays vs plays where player was involved
    const teamPlaysResult = await db
      .select({
        totalTeamPlays: sql<number>`COUNT(DISTINCT CONCAT(${bronzeNflfastrPlays.gameId}, '-', ${bronzeNflfastrPlays.playId}))`,
      })
      .from(bronzeNflfastrPlays)
      .where(
        and(
          eq(bronzeNflfastrPlays.season, season),
          lte(bronzeNflfastrPlays.week, week),
          eq(bronzeNflfastrPlays.posteam, teamAbbr),
          sql`${bronzeNflfastrPlays.playType} IN ('pass', 'run')`
        )
      );

    const playerPlaysResult = await db
      .select({
        playerPlays: sql<number>`COUNT(DISTINCT CONCAT(${bronzeNflfastrPlays.gameId}, '-', ${bronzeNflfastrPlays.playId}))`,
      })
      .from(bronzeNflfastrPlays)
      .where(
        and(
          eq(bronzeNflfastrPlays.season, season),
          lte(bronzeNflfastrPlays.week, week),
          or(
            eq(bronzeNflfastrPlays.receiverPlayerId, playerId),
            eq(bronzeNflfastrPlays.rusherPlayerId, playerId),
            eq(bronzeNflfastrPlays.passerPlayerId, playerId)
          )
        )
      );

    const totalTeamPlays = Number(teamPlaysResult[0]?.totalTeamPlays || 0);
    const playerPlays = Number(playerPlaysResult[0]?.playerPlays || 0);

    if (totalTeamPlays === 0) {
      return { snapPercent: 0, trend: 'stable' };
    }

    // Effective snap % = (plays involved in / team's total plays) * 100
    const snapPercent = (playerPlays / totalTeamPlays) * 100;

    // Calculate trend (last 2 weeks vs earlier weeks)
    let trend: 'rising' | 'stable' | 'falling' = 'stable';
    
    if (week >= 3) {
      const recentSnaps = await this.getSnapPercentForWeeks(playerId, week - 1, week, season, teamAbbr);
      const earlySnaps = await this.getSnapPercentForWeeks(playerId, 1, week - 2, season, teamAbbr);
      
      if (earlySnaps > 0) {
        if (recentSnaps > earlySnaps * 1.15) trend = 'rising';
        else if (recentSnaps < earlySnaps * 0.85) trend = 'falling';
      }
    }

    return { snapPercent, trend };
  }

  private async getSnapPercentForWeeks(
    playerId: string, 
    startWeek: number, 
    endWeek: number, 
    season: number,
    teamAbbr: string
  ): Promise<number> {
    const teamPlaysResult = await db
      .select({
        totalPlays: sql<number>`COUNT(DISTINCT CONCAT(${bronzeNflfastrPlays.gameId}, '-', ${bronzeNflfastrPlays.playId}))`,
      })
      .from(bronzeNflfastrPlays)
      .where(
        and(
          eq(bronzeNflfastrPlays.season, season),
          sql`${bronzeNflfastrPlays.week} >= ${startWeek}`,
          sql`${bronzeNflfastrPlays.week} <= ${endWeek}`,
          eq(bronzeNflfastrPlays.posteam, teamAbbr),
          sql`${bronzeNflfastrPlays.playType} IN ('pass', 'run')`
        )
      );

    const playerPlaysResult = await db
      .select({
        playerPlays: sql<number>`COUNT(DISTINCT CONCAT(${bronzeNflfastrPlays.gameId}, '-', ${bronzeNflfastrPlays.playId}))`,
      })
      .from(bronzeNflfastrPlays)
      .where(
        and(
          eq(bronzeNflfastrPlays.season, season),
          sql`${bronzeNflfastrPlays.week} >= ${startWeek}`,
          sql`${bronzeNflfastrPlays.week} <= ${endWeek}`,
          or(
            eq(bronzeNflfastrPlays.receiverPlayerId, playerId),
            eq(bronzeNflfastrPlays.rusherPlayerId, playerId)
          )
        )
      );

    const totalPlays = Number(teamPlaysResult[0]?.totalPlays || 0);
    const playerPlays = Number(playerPlaysResult[0]?.playerPlays || 0);

    return totalPlays > 0 ? (playerPlays / totalPlays) * 100 : 0;
  }

  private async getTeamOffenseRank(
    teamAbbr: string, 
    week: number, 
    season: number
  ): Promise<{ rank: number; avgEpa: number }> {
    // Get EPA per play for all teams through this week
    const teamEpaData = await db
      .select({
        team: bronzeNflfastrPlays.posteam,
        avgEpa: sql<number>`AVG(${bronzeNflfastrPlays.epa})`,
        totalPlays: sql<number>`COUNT(*)`,
      })
      .from(bronzeNflfastrPlays)
      .where(
        and(
          eq(bronzeNflfastrPlays.season, season),
          lte(bronzeNflfastrPlays.week, week),
          sql`${bronzeNflfastrPlays.playType} IN ('pass', 'run')`
        )
      )
      .groupBy(bronzeNflfastrPlays.posteam)
      .execute();

    // Sort by EPA descending to get rankings
    const sortedTeams = teamEpaData
      .map(t => ({
        team: t.team,
        avgEpa: Number(t.avgEpa || 0),
      }))
      .sort((a, b) => b.avgEpa - a.avgEpa);

    // Find rank of target team
    const rank = sortedTeams.findIndex(t => t.team === teamAbbr) + 1;
    const avgEpa = sortedTeams.find(t => t.team === teamAbbr)?.avgEpa || 0;

    return {
      rank: rank || 16, // Default to middle if not found
      avgEpa,
    };
  }

  private calculateFirstDownScore(stats: PlayerStats): number {
    // First Down Rate is the most predictive metric (0.750 correlation with future FPG)
    // Elite WRs: 15-17% 1D/RR (Puka Nacua, Rashee Rice)
    // Average: 10-12%
    // Below average: <8%
    const { firstDownRate } = stats;
    
    // Normalize to 0-35 scale
    // 17%+ = 35 points (elite chain-mover, QB trust)
    // 15% = 32 points (very good)
    // 12% = 25 points (above average)
    // 10% = 21 points (average)
    // 8% = 14 points (below average)
    // <6% = 7 points (poor - TD dependent, low quality touches)
    
    if (firstDownRate >= 0.17) return this.WEIGHTS.FIRST_DOWN;
    if (firstDownRate >= 0.15) return this.WEIGHTS.FIRST_DOWN * 0.91;
    if (firstDownRate >= 0.12) return this.WEIGHTS.FIRST_DOWN * 0.71;
    if (firstDownRate >= 0.10) return this.WEIGHTS.FIRST_DOWN * 0.60;
    if (firstDownRate >= 0.08) return this.WEIGHTS.FIRST_DOWN * 0.40;
    if (firstDownRate >= 0.06) return this.WEIGHTS.FIRST_DOWN * 0.30;
    return this.WEIGHTS.FIRST_DOWN * 0.20; // Very poor
  }

  private calculateEpaScore(stats: PlayerStats): number {
    // League average EPA/play for skill positions is ~0.15
    // Top tier is ~0.30+, bottom tier is negative
    const { epaPerPlay } = stats;
    
    // Normalize to 0-25 scale (reduced from 40 in v1.5)
    // 0.30+ EPA = 25 points (elite)
    // 0.20 EPA = 21 points (very good)
    // 0.15 EPA = 16 points (average)
    // 0.10 EPA = 13 points (below average)
    // 0.05 EPA = 9 points (poor)
    // 0.00 EPA = 6 points (bad)
    // Negative EPA = 3 points (terrible)
    
    if (epaPerPlay >= 0.30) return this.WEIGHTS.EPA;
    if (epaPerPlay >= 0.20) return this.WEIGHTS.EPA * 0.85;
    if (epaPerPlay >= 0.15) return this.WEIGHTS.EPA * 0.65;
    if (epaPerPlay >= 0.10) return this.WEIGHTS.EPA * 0.50;
    if (epaPerPlay >= 0.05) return this.WEIGHTS.EPA * 0.35;
    if (epaPerPlay >= 0.00) return this.WEIGHTS.EPA * 0.25;
    return this.WEIGHTS.EPA * 0.10; // Negative EPA
  }

  private calculateUsageScore(stats: PlayerStats): number {
    // Based on snap % and trend
    const { snapPercentAvg, snapTrend } = stats;
    
    let baseScore = 0;
    
    // Snap % scoring
    if (snapPercentAvg >= 80) baseScore = this.WEIGHTS.USAGE * 0.9;
    else if (snapPercentAvg >= 70) baseScore = this.WEIGHTS.USAGE * 0.8;
    else if (snapPercentAvg >= 60) baseScore = this.WEIGHTS.USAGE * 0.7;
    else if (snapPercentAvg >= 50) baseScore = this.WEIGHTS.USAGE * 0.6;
    else if (snapPercentAvg >= 40) baseScore = this.WEIGHTS.USAGE * 0.4;
    else baseScore = this.WEIGHTS.USAGE * 0.2;
    
    // Trend modifier
    if (snapTrend === 'rising') baseScore *= 1.1;
    else if (snapTrend === 'falling') baseScore *= 0.9;
    
    return Math.min(baseScore, this.WEIGHTS.USAGE); // Cap at max
  }

  private calculateTdScore(stats: PlayerStats): number {
    // TD regression analysis
    const { tdRate, totalPlays } = stats;
    
    // League average TD rate by position:
    // WR: ~10-12%, RB: ~8-10%, TE: ~8-10%
    // For simplicity, use 10% as universal average
    const leagueAvgTdRate = 10;
    
    // If TD rate is way above average, regression risk is high
    if (tdRate > leagueAvgTdRate * 1.5) {
      // Unsustainable (15%+ TD rate)
      return this.WEIGHTS.TD * 0.2;
    } else if (tdRate > leagueAvgTdRate * 1.2) {
      // Slightly high (12-15% TD rate)
      return this.WEIGHTS.TD * 0.6;
    } else if (tdRate >= leagueAvgTdRate * 0.8) {
      // Sustainable range (8-12% TD rate)
      return this.WEIGHTS.TD * 1.0;
    } else {
      // Below average (<8% TD rate) - room for positive regression
      return this.WEIGHTS.TD * 0.7;
    }
  }

  private calculateTeamScore(stats: PlayerStats): number {
    // Team offense context
    const { teamOffenseRank } = stats;
    
    // Top 10 offense = 10 points
    // 11-20 = 7 points
    // 21-32 = 4 points
    if (teamOffenseRank <= 10) return this.WEIGHTS.TEAM;
    if (teamOffenseRank <= 20) return this.WEIGHTS.TEAM * 0.7;
    return this.WEIGHTS.TEAM * 0.4;
  }

  private getTier(score: number): 'breakout' | 'stable' | 'regression' {
    if (score >= 80) return 'breakout';
    if (score >= 50) return 'stable';
    return 'regression';
  }

  // Batch calculation for all players
  async calculateAllScores(week: number, season: number = 2025): Promise<void> {
    console.log(`🧠 TIBER Batch Calculation - Week ${week}, ${season} Season\n`);

    // Get all players who have NFLfastR data for this week
    const activePlayers = await db
      .selectDistinct({
        nflfastrId: sql<string>`COALESCE(${bronzeNflfastrPlays.receiverPlayerId}, ${bronzeNflfastrPlays.rusherPlayerId})`,
      })
      .from(bronzeNflfastrPlays)
      .where(
        and(
          eq(bronzeNflfastrPlays.season, season),
          lte(bronzeNflfastrPlays.week, week),
          sql`${bronzeNflfastrPlays.playType} IN ('pass', 'run')`
        )
      )
      .execute();

    console.log(`Found ${activePlayers.length} players with data in Week ${week}\n`);

    let calculated = 0;
    let errors = 0;

    for (const player of activePlayers) {
      if (!player.nflfastrId) continue;

      try {
        const score = await this.calculateTiberScore(player.nflfastrId, week, season);
        
        // Save to tiber_scores table (without playerId since we don't have mapping yet)
        await db.insert(tiberScores).values({
          playerId: null,
          nflfastrId: player.nflfastrId,
          week,
          season,
          tiberScore: score.tiberScore,
          tier: score.tier,
          firstDownScore: score.breakdown.firstDownScore,
          epaScore: score.breakdown.epaScore,
          usageScore: score.breakdown.usageScore,
          tdScore: score.breakdown.tdScore,
          teamScore: score.breakdown.teamScore,
          firstDownRate: score.metrics.firstDownRate,
          totalFirstDowns: score.metrics.totalFirstDowns,
          epaPerPlay: score.metrics.epaPerPlay,
          snapPercentAvg: score.metrics.snapPercentAvg,
          snapPercentTrend: score.metrics.snapTrend,
          teamOffenseRank: score.metrics.teamOffenseRank,
        }).onConflictDoUpdate({
          target: [tiberScores.nflfastrId, tiberScores.week, tiberScores.season],
          set: {
            tiberScore: score.tiberScore,
            tier: score.tier,
            firstDownScore: score.breakdown.firstDownScore,
            epaScore: score.breakdown.epaScore,
            usageScore: score.breakdown.usageScore,
            tdScore: score.breakdown.tdScore,
            teamScore: score.breakdown.teamScore,
            firstDownRate: score.metrics.firstDownRate,
            totalFirstDowns: score.metrics.totalFirstDowns,
            epaPerPlay: score.metrics.epaPerPlay,
            snapPercentAvg: score.metrics.snapPercentAvg,
            snapPercentTrend: score.metrics.snapTrend,
            teamOffenseRank: score.metrics.teamOffenseRank,
            calculatedAt: new Date(),
          },
        });

        calculated++;
        console.log(`✅ ${player.nflfastrId}: TIBER ${score.tiberScore} (${score.tier})`);

      } catch (error) {
        errors++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.log(`❌ ${player.nflfastrId}: ${errorMessage}`);
      }
    }

    console.log(`\n📊 Batch Complete: ${calculated} calculated, ${errors} errors\n`);
  }
}

export const tiberService = new TiberService();
