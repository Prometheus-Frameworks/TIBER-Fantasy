import { db } from '../db';
import { tiberScores, bronzeNflfastrPlays, players } from '../../shared/schema';
import { eq, and, lte, sql } from 'drizzle-orm';

interface TiberScore {
  tiberScore: number;
  tier: 'breakout' | 'stable' | 'regression';
  breakdown: {
    epaScore: number;
    usageScore: number;
    tdScore: number;
    teamScore: number;
  };
  metrics: {
    epaPerPlay: number;
    snapPercentAvg: number;
    snapTrend: 'rising' | 'stable' | 'falling';
    tdRate: number;
    teamOffenseRank: number;
  };
}

interface PlayerStats {
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
    EPA: 40,
    USAGE: 30,
    TD: 20,
    TEAM: 10,
  };

  async calculateTiberScore(nflfastrId: string, week: number, season: number = 2025): Promise<TiberScore> {
    // Get player stats from NFLfastR data
    const playerStats = await this.getPlayerStats(nflfastrId, week, season);
    
    if (!playerStats) {
      throw new Error(`No stats found for player ${nflfastrId} in week ${week}`);
    }

    // Calculate each component
    const epaScore = this.calculateEpaScore(playerStats);
    const usageScore = this.calculateUsageScore(playerStats);
    const tdScore = this.calculateTdScore(playerStats);
    const teamScore = this.calculateTeamScore(playerStats);

    const totalScore = Math.round(epaScore + usageScore + tdScore + teamScore);
    const tier = this.getTier(totalScore);

    return {
      tiberScore: totalScore,
      tier,
      breakdown: {
        epaScore: Math.round(epaScore),
        usageScore: Math.round(usageScore),
        tdScore: Math.round(tdScore),
        teamScore: Math.round(teamScore),
      },
      metrics: {
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
    const stats = await db
      .select({
        // Receiving stats
        targets: sql<number>`COUNT(CASE WHEN ${bronzeNflfastrPlays.receiverPlayerId} = ${sql.raw(`'${nflfastrId}'`)} THEN 1 END)`,
        receptions: sql<number>`COUNT(CASE WHEN ${bronzeNflfastrPlays.receiverPlayerId} = ${sql.raw(`'${nflfastrId}'`)} AND ${bronzeNflfastrPlays.completePass} = true THEN 1 END)`,
        receivingEpa: sql<number>`COALESCE(SUM(CASE WHEN ${bronzeNflfastrPlays.receiverPlayerId} = ${sql.raw(`'${nflfastrId}'`)} THEN ${bronzeNflfastrPlays.epa} END), 0)`,
        receivingTds: sql<number>`COUNT(CASE WHEN ${bronzeNflfastrPlays.receiverPlayerId} = ${sql.raw(`'${nflfastrId}'`)} AND ${bronzeNflfastrPlays.touchdown} = true THEN 1 END)`,
        
        // Rushing stats
        rushes: sql<number>`COUNT(CASE WHEN ${bronzeNflfastrPlays.rusherPlayerId} = ${sql.raw(`'${nflfastrId}'`)} THEN 1 END)`,
        rushingEpa: sql<number>`COALESCE(SUM(CASE WHEN ${bronzeNflfastrPlays.rusherPlayerId} = ${sql.raw(`'${nflfastrId}'`)} THEN ${bronzeNflfastrPlays.epa} END), 0)`,
        rushingTds: sql<number>`COUNT(CASE WHEN ${bronzeNflfastrPlays.rusherPlayerId} = ${sql.raw(`'${nflfastrId}'`)} AND ${bronzeNflfastrPlays.touchdown} = true THEN 1 END)`,
        
        // Team context
        teamAbbr: sql<string>`MAX(${bronzeNflfastrPlays.posteam})`,
      })
      .from(bronzeNflfastrPlays)
      .where(
        and(
          eq(bronzeNflfastrPlays.season, season),
          lte(bronzeNflfastrPlays.week, week),
          sql`(${bronzeNflfastrPlays.receiverPlayerId} = ${sql.raw(`'${nflfastrId}'`)} OR ${bronzeNflfastrPlays.rusherPlayerId} = ${sql.raw(`'${nflfastrId}'`)})`
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

    // Calculate EPA per play
    const epaPerPlay = totalPlays > 0 ? totalEpa / totalPlays : 0;
    
    // Calculate TD rate (TDs per 100 plays for better readability)
    const tdRate = totalPlays > 0 ? (totalTds / totalPlays) * 100 : 0;

    // TODO: Add snap % data (need to join with snap count data)
    // For MVP, use placeholder values based on play volume
    const snapPercentAvg = totalPlays > 20 ? 70 : totalPlays > 10 ? 50 : 30;
    const snapTrend: 'rising' | 'stable' | 'falling' = 'stable';
    const teamOffenseRank = 16; // Placeholder

    return {
      epaPerPlay,
      snapPercentAvg,
      snapTrend,
      tdRate,
      teamOffenseRank,
      totalPlays,
      totalTds,
    };
  }

  private calculateEpaScore(stats: PlayerStats): number {
    // League average EPA/play for skill positions is ~0.15
    // Top tier is ~0.30+, bottom tier is negative
    const { epaPerPlay } = stats;
    
    // Normalize to 0-40 scale
    // 0.30+ EPA = 40 points (elite)
    // 0.20 EPA = 34 points (very good)
    // 0.15 EPA = 26 points (average)
    // 0.10 EPA = 20 points (below average)
    // 0.05 EPA = 14 points (poor)
    // 0.00 EPA = 10 points (bad)
    // Negative EPA = 4 points (terrible)
    
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
    // Get all active players with Sleeper IDs
    const activePlayers = await db
      .select({ id: players.id, name: players.name })
      .from(players)
      .where(sql`${players.sleeperId} IS NOT NULL`)
      .limit(100) // Limit for MVP testing
      .execute();

    console.log(`📊 Calculating TIBER scores for ${activePlayers.length} players (Week ${week})...`);

    let successCount = 0;
    let failCount = 0;

    for (const player of activePlayers) {
      try {
        const score = await this.calculateTiberScore(player.id, week, season);
        
        // Save to database
        await db.insert(tiberScores).values({
          playerId: player.id,
          week,
          season,
          tiberScore: score.tiberScore,
          tier: score.tier,
          epaScore: score.breakdown.epaScore,
          usageScore: score.breakdown.usageScore,
          tdScore: score.breakdown.tdScore,
          teamScore: score.breakdown.teamScore,
          epaPerPlay: score.metrics.epaPerPlay,
          snapPercentAvg: score.metrics.snapPercentAvg,
          snapPercentTrend: score.metrics.snapTrend,
          tdRate: score.metrics.tdRate,
          teamOffenseRank: score.metrics.teamOffenseRank,
        }).onConflictDoUpdate({
          target: [tiberScores.playerId, tiberScores.week, tiberScores.season],
          set: {
            tiberScore: score.tiberScore,
            tier: score.tier,
            epaScore: score.breakdown.epaScore,
            usageScore: score.breakdown.usageScore,
            tdScore: score.breakdown.tdScore,
            teamScore: score.breakdown.teamScore,
            calculatedAt: new Date(),
          },
        });
        
        console.log(`✅ ${player.name}: TIBER ${score.tiberScore} (${score.tier})`);
        successCount++;
      } catch (error) {
        console.log(`❌ ${player.name}: No data - ${error instanceof Error ? error.message : 'Unknown error'}`);
        failCount++;
      }
    }

    console.log(`\n📈 TIBER calculation complete!`);
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
  }
}

export const tiberService = new TiberService();
