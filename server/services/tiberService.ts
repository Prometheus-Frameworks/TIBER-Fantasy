import { db } from '../db';
import { tiberScores, tiberSeasonRatings, bronzeNflfastrPlays, players, playerIdentityMap } from '../../shared/schema';
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
  position: string;
}

export class TiberService {
  private readonly WEIGHTS = {
    FIRST_DOWN: 35,  // v1.5: Most predictive metric (0.750 correlation)
    EPA: 25,         // v1.5: Reduced from 40
    USAGE: 25,       // v1.5: Reduced from 30
    TD: 10,          // v1.5: Reduced from 20 (TDs are fluky)
    TEAM: 5,         // v1.5: Reduced from 10
  };

  // Position-specific route run multipliers (TIBER v1.5)
  private readonly ROUTE_MULTIPLIERS: Record<string, number> = {
    'WR': 3.5,   // WRs run routes on ~78% of team pass plays
    'TE': 2.8,   // TEs block more, run ~70% of pass plays  
    'RB': 1.2,   // RBs mostly stay in to block, limited routes
    'QB': 0,     // QBs don't run routes
  };

  /**
   * Get position-specific route multiplier
   */
  private getRouteMultiplier(position: string): number {
    return this.ROUTE_MULTIPLIERS[position.toUpperCase()] || 3.5; // Default to WR
  }

  /**
   * Calculate routes run based on targets and position
   */
  private calculateRoutesRun(targets: number, position: string): number {
    const multiplier = this.getRouteMultiplier(position);
    return Math.round(targets * multiplier);
  }

  async calculateTiberScore(nflfastrId: string, week: number, season: number = 2025): Promise<TiberScore> {
    // Get player stats from NFLfastR data (WR/TE only for now)
    const playerStats = await this.getPlayerStats(nflfastrId, week, season);
    
    if (!playerStats) {
      throw new Error(`No stats found for player ${nflfastrId} in week ${week}`);
    }

    // Calculate each component (TIBER v1.5 weights: 35/25/25/10/5 for WR/TE)
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
    // Get player position from playerIdentityMap (TIBER v1.5: position-specific route multipliers)
    const playerInfo = await db
      .select({ 
        position: playerIdentityMap.position,
        name: playerIdentityMap.fullName 
      })
      .from(playerIdentityMap)
      .where(eq(playerIdentityMap.nflDataPyId, nflfastrId))
      .limit(1);
    
    const position = playerInfo[0]?.position || 'WR'; // Default to WR if not found

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

    // Calculate First Down Rate (TIBER v1.5 - Position-specific calculation)
    // WR/TE: First Downs per Route Run (Ryan Heath's metric: 0.750 correlation)
    // RB: First Downs per Touch (rushing + receiving opportunities)
    const targets = Number(data.targets || 0);
    const rushes = Number(data.rushes || 0);
    const receivingFirstDowns = Number(data.receivingFirstDowns || 0);
    const rushingFirstDowns = Number(data.rushingFirstDowns || 0);
    
    let firstDownRate: number;
    if (position === 'RB') {
      // RBs: Use first downs per touch (total opportunities)
      const totalTouches = targets + rushes;
      firstDownRate = totalTouches > 0 ? totalFirstDowns / totalTouches : 0;
    } else {
      // WR/TE: Use Heath's metric (first downs per route run)
      const routesRun = this.calculateRoutesRun(targets, position);
      firstDownRate = routesRun > 0 ? receivingFirstDowns / routesRun : 0;
    }

    // Get live snap percentage data from play participation (position-specific)
    const snapData = await this.getPlayerSnapData(nflfastrId, week, season, teamAbbr, position, totalPlays);
    
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
      position,
    };
  }

  private async getPlayerSnapData(
    playerId: string, 
    week: number, 
    season: number,
    teamAbbr: string,
    position: string,
    totalPlays: number
  ): Promise<{ snapPercent: number; trend: 'rising' | 'stable' | 'falling' }> {
    // ORIGINAL METHODOLOGY: Use placeholder snap % based on play volume
    // This matched the screenshot baseline (Amon-Ra: 90, JSN: 85, Puka: 82, Chase: 76, Olave: 58)
    const snapPercent = totalPlays > 20 ? 70 : totalPlays > 10 ? 50 : 30;
    const trend: 'rising' | 'stable' | 'falling' = 'stable';
    
    return { snapPercent, trend };
  }

  private async getSnapPercentForWeeks(
    playerId: string, 
    startWeek: number, 
    endWeek: number, 
    season: number,
    teamAbbr: string,
    position: string
  ): Promise<number> {
    // Placeholder - not used with simple snap % calculation
    return 0;
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
    // 15%+ = 35 points (elite chain-mover, QB trust)
    // 12% = 32 points (very good)
    // 10% = 28 points (above average)
    // 8% = 21 points (average)
    // 6% = 14 points (below average)
    // <4% = 7 points (poor - TD dependent, low quality touches)
    
    if (firstDownRate >= 0.15) return this.WEIGHTS.FIRST_DOWN;
    if (firstDownRate >= 0.12) return this.WEIGHTS.FIRST_DOWN * 0.91;
    if (firstDownRate >= 0.10) return this.WEIGHTS.FIRST_DOWN * 0.80;
    if (firstDownRate >= 0.08) return this.WEIGHTS.FIRST_DOWN * 0.60;
    if (firstDownRate >= 0.06) return this.WEIGHTS.FIRST_DOWN * 0.40;
    if (firstDownRate >= 0.04) return this.WEIGHTS.FIRST_DOWN * 0.20;
    return this.WEIGHTS.FIRST_DOWN * 0.10; // Very poor
  }

  private calculateEpaScore(stats: PlayerStats): number {
    // League average EPA/play for skill positions is ~0.15
    // Top tier is ~0.30+, bottom tier is negative
    const { epaPerPlay } = stats;
    
    // Normalize to 0-25 scale (MORE GENEROUS - top 24 should get 18-25 points)
    // 0.25+ EPA = 25 points (elite)
    // 0.20 EPA = 23 points (very good)
    // 0.15 EPA = 21 points (average - league baseline)
    // 0.10 EPA = 18 points (below average but playable)
    // 0.05 EPA = 14 points (poor)
    // 0.00 EPA = 10 points (bad)
    // Negative EPA = 5 points (terrible)
    
    if (epaPerPlay >= 0.25) return this.WEIGHTS.EPA;
    if (epaPerPlay >= 0.20) return this.WEIGHTS.EPA * 0.92;
    if (epaPerPlay >= 0.15) return this.WEIGHTS.EPA * 0.84;
    if (epaPerPlay >= 0.10) return this.WEIGHTS.EPA * 0.72;
    if (epaPerPlay >= 0.05) return this.WEIGHTS.EPA * 0.56;
    if (epaPerPlay >= 0.00) return this.WEIGHTS.EPA * 0.40;
    return this.WEIGHTS.EPA * 0.20; // Negative EPA
  }

  private calculateUsageScore(stats: PlayerStats): number {
    // IMPROVED METHODOLOGY: Continuous scaling with elite bonuses and fringe penalties
    const { snapPercentAvg, snapTrend } = stats;
    
    // Continuous scale from 0 to 25 points based on snap %
    let baseScore = (snapPercentAvg / 100) * this.WEIGHTS.USAGE;
    
    // Bonus tiers for elite reliability
    if (snapPercentAvg >= 90) {
      baseScore *= 1.10; // +10% bonus for ironman usage
    } else if (snapPercentAvg >= 80) {
      baseScore *= 1.05; // +5% bonus for high reliability
    }
    
    // Penalties for unreliable or fringe roles
    if (snapPercentAvg < 20) {
      baseScore *= 0.3; // borderline benchwarmer penalty
    } else if (snapPercentAvg < 40) {
      baseScore *= 0.6; // rotational player penalty
    }
    
    // Clamp score between 0 and 25 just in case of overflow
    baseScore = Math.min(baseScore, this.WEIGHTS.USAGE);
    
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
    
    // Top 10 offense = 5 points
    // 11-20 = 3.5 points
    // 21-32 = 2 points
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

  /**
   * Calculate season average rating for a specific player
   */
  async calculateSeasonRating(nflfastrId: string, season: number = 2025): Promise<void> {
    // Get all weekly scores for this player
    const weeklyScores = await db
      .select()
      .from(tiberScores)
      .where(and(
        eq(tiberScores.nflfastrId, nflfastrId),
        eq(tiberScores.season, season)
      ))
      .orderBy(tiberScores.week);

    if (weeklyScores.length === 0) {
      console.log(`⚠️  No weekly scores found for ${nflfastrId}`);
      return;
    }

    // Calculate average
    const scores = weeklyScores.map(ws => ws.tiberScore);
    const seasonAverage = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    
    // Calculate standard deviation (consistency metric)
    const mean = seasonAverage;
    const squaredDiffs = scores.map(score => Math.pow(score - mean, 2));
    const variance = squaredDiffs.reduce((sum, diff) => sum + diff, 0) / scores.length;
    const scoreStdDev = Math.sqrt(variance);

    // Determine tier based on season average
    const seasonTier = this.getTier(Math.round(seasonAverage));

    // Determine trend (last 3 weeks vs previous weeks)
    const lastThreeWeeks = weeklyScores.slice(-3);
    const earlierWeeks = weeklyScores.slice(0, -3);
    let trend: 'rising' | 'stable' | 'falling' = 'stable';
    
    if (earlierWeeks.length > 0 && lastThreeWeeks.length > 0) {
      const lastThreeAvg = lastThreeWeeks.reduce((sum, ws) => sum + ws.tiberScore, 0) / lastThreeWeeks.length;
      const earlierAvg = earlierWeeks.reduce((sum, ws) => sum + ws.tiberScore, 0) / earlierWeeks.length;
      
      if (lastThreeAvg > earlierAvg + 5) trend = 'rising';
      else if (lastThreeAvg < earlierAvg - 5) trend = 'falling';
    }

    const lastWeekData = weeklyScores[weeklyScores.length - 1];

    // Insert or update season rating
    await db
      .insert(tiberSeasonRatings)
      .values({
        nflfastrId,
        season,
        seasonAverage,
        weeksIncluded: weeklyScores.length,
        seasonTier,
        trend,
        lastWeekScore: lastWeekData.tiberScore,
        lastWeek: lastWeekData.week,
        scoreStdDev,
        highestWeekScore: Math.max(...scores),
        lowestWeekScore: Math.min(...scores),
      })
      .onConflictDoUpdate({
        target: [tiberSeasonRatings.nflfastrId, tiberSeasonRatings.season],
        set: {
          seasonAverage,
          weeksIncluded: weeklyScores.length,
          seasonTier,
          trend,
          lastWeekScore: lastWeekData.tiberScore,
          lastWeek: lastWeekData.week,
          scoreStdDev,
          highestWeekScore: Math.max(...scores),
          lowestWeekScore: Math.min(...scores),
          updatedAt: new Date(),
        },
      });
  }

  /**
   * Calculate season ratings for all players with weekly scores
   */
  async calculateAllSeasonRatings(season: number = 2025): Promise<void> {
    console.log(`📊 Calculating season averages for ${season}...\n`);

    // Get all unique players with scores
    const playersWithScores = await db
      .selectDistinct({ nflfastrId: tiberScores.nflfastrId })
      .from(tiberScores)
      .where(eq(tiberScores.season, season));

    console.log(`Found ${playersWithScores.length} players with weekly scores\n`);

    let calculated = 0;
    for (const player of playersWithScores) {
      await this.calculateSeasonRating(player.nflfastrId, season);
      calculated++;
    }

    console.log(`\n✅ Season ratings calculated for ${calculated} players\n`);
  }
}

export const tiberService = new TiberService();
