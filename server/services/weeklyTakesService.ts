import { db } from '../db';
import { 
  defenseVP, 
  qbEpaAdjusted, 
  rbEpaAdjusted,
  rbContextMetrics,
  gameLogs,
  playerUsage,
  players
} from '@shared/schema';
import { eq, desc, and, sql, gte } from 'drizzle-orm';

interface WeeklyTake {
  player: string;
  insight: string;
  position: 'QB' | 'RB' | 'WR' | 'TE';
}

export class WeeklyTakesService {
  /**
   * Generate weekly takes based on matchup data and performance metrics
   */
  async generateWeeklyTakes(week: number = 7, season: number = 2025): Promise<{
    qb: WeeklyTake[];
    rb: WeeklyTake[];
    wr: WeeklyTake[];
    te: WeeklyTake[];
  }> {
    console.log(`📝 [Weekly Takes] Generating takes for Week ${week}, ${season}...`);

    const takes = {
      qb: await this.generateQBTakes(week, season),
      rb: await this.generateRBTakes(week, season),
      wr: await this.generateWRTakes(week, season),
      te: await this.generateTETakes(week, season)
    };

    console.log(`✅ [Weekly Takes] Generated ${takes.qb.length + takes.rb.length + takes.wr.length + takes.te.length} total takes`);
    
    return takes;
  }

  /**
   * Generate QB takes based on EPA and pressure metrics
   */
  private async generateQBTakes(week: number, season: number): Promise<WeeklyTake[]> {
    const takes: WeeklyTake[] = [];

    try {
      // Get top QBs by adjusted EPA (season totals)
      const topQBs = await db
        .select()
        .from(qbEpaAdjusted)
        .where(and(
          eq(qbEpaAdjusted.season, season),
          sql`${qbEpaAdjusted.week} IS NULL` // Season totals
        ))
        .orderBy(desc(qbEpaAdjusted.tiberAdjEpaPerPlay))
        .limit(10);

      // Elite QB take
      if (topQBs.length > 0) {
        const elite = topQBs[0];
        if (elite.tiberAdjEpaPerPlay !== null && elite.tiberAdjEpaPerPlay !== undefined) {
          takes.push({
            player: elite.playerName || 'Unknown',
            insight: `Elite ${elite.tiberAdjEpaPerPlay.toFixed(3)} adjusted EPA/play - Consistent QB1 upside every week`,
            position: 'QB'
          });
        }
      }

      // Pressure performance QB
      const pressureQB = topQBs.find(qb => qb.pressureAdjustment && Math.abs(qb.pressureAdjustment) > 0.025);
      if (pressureQB && pressureQB.pressureAdjustment) {
        const isPressureGood = pressureQB.pressureAdjustment > 0;
        takes.push({
          player: pressureQB.playerName || 'Unknown',
          insight: `${isPressureGood ? 'Thrives under pressure' : 'Struggles vs blitz'} - ${isPressureGood ? '+' : ''}${pressureQB.pressureAdjustment.toFixed(3)} pressure EPA adjustment`,
          position: 'QB'
        });
      }

      // YAC performance QB
      const yacQB = topQBs.find(qb => qb.yacAdjustment && qb.yacAdjustment < -0.03);
      if (yacQB && yacQB.yacAdjustment) {
        takes.push({
          player: yacQB.playerName || 'Unknown',
          insight: `Receivers creating big YAC - ${yacQB.yacAdjustment.toFixed(3)} YAC adjustment boosts efficiency`,
          position: 'QB'
        });
      }

    } catch (error) {
      console.error('Error generating QB takes:', error);
    }

    return takes;
  }

  /**
   * Generate RB takes based on EPA and usage context
   */
  private async generateRBTakes(week: number, season: number): Promise<WeeklyTake[]> {
    const takes: WeeklyTake[] = [];

    try {
      // Try current season first, fallback to 2024
      let rbEpaData = await db
        .select()
        .from(rbEpaAdjusted)
        .where(and(
          eq(rbEpaAdjusted.season, season),
          sql`${rbEpaAdjusted.week} IS NULL` // Season totals
        ))
        .orderBy(desc(rbEpaAdjusted.tiberAdjEpaPerPlay))
        .limit(15);

      // Fallback to 2024 if no 2025 data
      if (rbEpaData.length === 0 && season === 2025) {
        rbEpaData = await db
          .select()
          .from(rbEpaAdjusted)
          .where(and(
            eq(rbEpaAdjusted.season, 2024),
            sql`${rbEpaAdjusted.week} IS NULL`
          ))
          .orderBy(desc(rbEpaAdjusted.tiberAdjEpaPerPlay))
          .limit(15);
      }

      // Get RB context metrics
      let rbContext = await db
        .select()
        .from(rbContextMetrics)
        .where(and(
          eq(rbContextMetrics.season, season),
          sql`${rbContextMetrics.week} IS NULL` // Season totals
        ))
        .limit(15);

      // Fallback to 2024
      if (rbContext.length === 0 && season === 2025) {
        rbContext = await db
          .select()
          .from(rbContextMetrics)
          .where(and(
            eq(rbContextMetrics.season, 2024),
            sql`${rbContextMetrics.week} IS NULL`
          ))
          .limit(15);
      }

      // Elite EPA RB
      if (rbEpaData.length > 0) {
        const elite = rbEpaData[0];
        if (elite.tiberAdjEpaPerPlay !== null && elite.tiberAdjEpaPerPlay !== undefined) {
          takes.push({
            player: elite.playerName || 'Unknown',
            insight: `${elite.tiberAdjEpaPerPlay.toFixed(3)} adjusted EPA/play - Elite efficiency in committee backfield`,
            position: 'RB'
          });
        }
      }

      // Target share RB (pass-catching back)
      const receivingRB = rbContext.find(rb => rb.targetShare && rb.targetShare > 0.15);
      if (receivingRB && receivingRB.targetShare && receivingRB.targets) {
        takes.push({
          player: receivingRB.playerName || 'Unknown',
          insight: `${(receivingRB.targetShare * 100).toFixed(1)}% team target share, ${receivingRB.targets} targets - PPR upside in negative game scripts`,
          position: 'RB'
        });
      }

      // Goal line specialist
      const glRB = rbContext.find(rb => rb.glCarries && rb.glCarries >= 5);
      if (glRB && glRB.glCarries && glRB.glTouchdowns !== null) {
        takes.push({
          player: glRB.playerName || 'Unknown',
          insight: `${glRB.glCarries} goal-line carries, ${glRB.glTouchdowns || 0} GL TDs - Red zone specialist for TD upside`,
          position: 'RB'
        });
      }

    } catch (error) {
      console.error('Error generating RB takes:', error);
    }

    return takes;
  }

  /**
   * Generate WR takes based on target data, usage, and matchups
   */
  private async generateWRTakes(week: number, season: number): Promise<WeeklyTake[]> {
    const takes: WeeklyTake[] = [];

    try {
      // Get recent game logs (last 3 weeks) for target leaders
      const recentWeeks = [week - 1, week - 2, week - 3].filter(w => w > 0);
      
      let recentGameLogs = await db
        .select({
          sleeperId: gameLogs.sleeperId,
          avgTargets: sql<number>`AVG(${gameLogs.targets})`.as('avg_targets'),
          totalTargets: sql<number>`SUM(${gameLogs.targets})`.as('total_targets'),
          avgReceptions: sql<number>`AVG(${gameLogs.receptions})`.as('avg_receptions'),
          avgRecYards: sql<number>`AVG(${gameLogs.recYards})`.as('avg_rec_yards'),
        })
        .from(gameLogs)
        .innerJoin(players, eq(gameLogs.playerId, players.id))
        .where(and(
          eq(gameLogs.season, season),
          sql`${gameLogs.week} IN (${sql.join(recentWeeks, sql`, `)})`,
          eq(players.position, 'WR'),
          gte(gameLogs.targets, 5)
        ))
        .groupBy(gameLogs.sleeperId)
        .orderBy(desc(sql`AVG(${gameLogs.targets})`))
        .limit(20);

      // Fallback to 2024 data if no 2025 game logs
      if (recentGameLogs.length === 0 && season === 2025) {
        const fallbackWeeks = [13, 14, 15]; // Use weeks 13-15 from 2024
        recentGameLogs = await db
          .select({
            sleeperId: gameLogs.sleeperId,
            avgTargets: sql<number>`AVG(${gameLogs.targets})`.as('avg_targets'),
            totalTargets: sql<number>`SUM(${gameLogs.targets})`.as('total_targets'),
            avgReceptions: sql<number>`AVG(${gameLogs.receptions})`.as('avg_receptions'),
            avgRecYards: sql<number>`AVG(${gameLogs.recYards})`.as('avg_rec_yards'),
          })
          .from(gameLogs)
          .innerJoin(players, eq(gameLogs.playerId, players.id))
          .where(and(
            eq(gameLogs.season, 2024),
            sql`${gameLogs.week} IN (${sql.join(fallbackWeeks, sql`, `)})`,
            eq(players.position, 'WR'),
            gte(gameLogs.targets, 5)
          ))
          .groupBy(gameLogs.sleeperId)
          .orderBy(desc(sql`AVG(${gameLogs.targets})`))
          .limit(20);
      }

      // Get player usage data for alignment splits
      const usageData = await db
        .select()
        .from(playerUsage)
        .where(and(
          eq(playerUsage.season, season),
          gte(playerUsage.week, week - 3)
        ))
        .limit(20);

      // Get DvP data for WR matchups
      const wrMatchups = await db
        .select()
        .from(defenseVP)
        .where(eq(defenseVP.position, 'WR'))
        .orderBy(desc(defenseVP.fpAllowed))
        .limit(5);

      // Target leader take
      if (recentGameLogs.length > 0) {
        const leader = recentGameLogs[0];
        const playerInfo = await this.getPlayerInfo(leader.sleeperId);
        if (playerInfo && leader.avgTargets) {
          const avgTargets = Number(leader.avgTargets);
          takes.push({
            player: playerInfo.name,
            insight: `${avgTargets.toFixed(1)} targets per game last 3 weeks - Volume-based WR1 floor`,
            position: 'WR'
          });
        }
      }

      // Slot receiver take
      const slotWR = usageData.find(u => u.alignmentSlotPct && u.alignmentSlotPct > 0.75);
      if (slotWR && slotWR.alignmentSlotPct && slotWR.targetSharePct) {
        const playerInfo = await this.getPlayerInfo(slotWR.sleeperId || '');
        if (playerInfo) {
          takes.push({
            player: playerInfo.name,
            insight: `${(slotWR.alignmentSlotPct * 100).toFixed(0)}% slot rate, ${(slotWR.targetSharePct * 100).toFixed(1)}% target share - High floor vs zone coverage`,
            position: 'WR'
          });
        }
      }

      // Matchup-based WR take
      if (wrMatchups.length > 0 && recentGameLogs.length > 1) {
        const softestDefense = wrMatchups[0];
        const wr2 = recentGameLogs[1];
        const playerInfo = await this.getPlayerInfo(wr2.sleeperId);
        if (playerInfo && wr2.avgTargets) {
          takes.push({
            player: playerInfo.name,
            insight: `${softestDefense.defTeam} allows ${softestDefense.fpAllowed?.toFixed(1)} FPG to WRs - ${wr2.avgTargets.toFixed(1)} targets/game in soft matchup`,
            position: 'WR'
          });
        }
      }

    } catch (error) {
      console.error('Error generating WR takes:', error);
    }

    return takes;
  }

  /**
   * Generate TE takes based on target data and matchups
   */
  private async generateTETakes(week: number, season: number): Promise<WeeklyTake[]> {
    const takes: WeeklyTake[] = [];

    try {
      // Get recent TE game logs
      const recentWeeks = [week - 1, week - 2, week - 3].filter(w => w > 0);
      
      let teGameLogs = await db
        .select({
          sleeperId: gameLogs.sleeperId,
          avgTargets: sql<number>`AVG(${gameLogs.targets})`.as('avg_targets'),
          totalTargets: sql<number>`SUM(${gameLogs.targets})`.as('total_targets'),
          avgReceptions: sql<number>`AVG(${gameLogs.receptions})`.as('avg_receptions'),
          avgRecYards: sql<number>`AVG(${gameLogs.recYards})`.as('avg_rec_yards'),
          avgFantasyPts: sql<number>`AVG(${gameLogs.fantasyPointsPpr})`.as('avg_fantasy_pts'),
        })
        .from(gameLogs)
        .innerJoin(players, eq(gameLogs.playerId, players.id))
        .where(and(
          eq(gameLogs.season, season),
          sql`${gameLogs.week} IN (${sql.join(recentWeeks, sql`, `)})`,
          eq(players.position, 'TE'),
          gte(gameLogs.targets, 3)
        ))
        .groupBy(gameLogs.sleeperId)
        .orderBy(desc(sql`AVG(${gameLogs.targets})`))
        .limit(15);

      // Fallback to 2024 data if no 2025 game logs
      if (teGameLogs.length === 0 && season === 2025) {
        const fallbackWeeks = [13, 14, 15]; // Use weeks 13-15 from 2024
        teGameLogs = await db
          .select({
            sleeperId: gameLogs.sleeperId,
            avgTargets: sql<number>`AVG(${gameLogs.targets})`.as('avg_targets'),
            totalTargets: sql<number>`SUM(${gameLogs.targets})`.as('total_targets'),
            avgReceptions: sql<number>`AVG(${gameLogs.receptions})`.as('avg_receptions'),
            avgRecYards: sql<number>`AVG(${gameLogs.recYards})`.as('avg_rec_yards'),
            avgFantasyPts: sql<number>`AVG(${gameLogs.fantasyPointsPpr})`.as('avg_fantasy_pts'),
          })
          .from(gameLogs)
          .innerJoin(players, eq(gameLogs.playerId, players.id))
          .where(and(
            eq(gameLogs.season, 2024),
            sql`${gameLogs.week} IN (${sql.join(fallbackWeeks, sql`, `)})`,
            eq(players.position, 'TE'),
            gte(gameLogs.targets, 3)
          ))
          .groupBy(gameLogs.sleeperId)
          .orderBy(desc(sql`AVG(${gameLogs.targets})`))
          .limit(15);
      }

      // Get DvP data for TE matchups
      const teMatchups = await db
        .select()
        .from(defenseVP)
        .where(eq(defenseVP.position, 'TE'))
        .orderBy(desc(defenseVP.fpAllowed))
        .limit(5);

      // Elite TE take (target leader)
      if (teGameLogs.length > 0) {
        const elite = teGameLogs[0];
        const playerInfo = await this.getPlayerInfo(elite.sleeperId);
        if (playerInfo && elite.avgTargets) {
          const avgTargets = Number(elite.avgTargets);
          takes.push({
            player: playerInfo.name,
            insight: `${avgTargets.toFixed(1)} targets per game last 3 weeks - Elite TE1 with high floor`,
            position: 'TE'
          });
        }
      }

      // Usage-based TE (consistent producer)
      if (teGameLogs.length > 1 && teGameLogs[1].avgFantasyPts && teGameLogs[1].avgTargets) {
        const te2 = teGameLogs[1];
        const playerInfo = await this.getPlayerInfo(te2.sleeperId);
        if (playerInfo) {
          const avgTargets = Number(te2.avgTargets);
          const avgFantasyPts = Number(te2.avgFantasyPts);
          takes.push({
            player: playerInfo.name,
            insight: `${avgTargets.toFixed(1)} targets/game, ${avgFantasyPts.toFixed(1)} PPR points - Consistent TE production`,
            position: 'TE'
          });
        }
      }

      // Matchup-based streaming TE
      if (teMatchups.length > 0 && teGameLogs.length > 2) {
        const softestDefense = teMatchups[0];
        const streamTE = teGameLogs[2];
        const playerInfo = await this.getPlayerInfo(streamTE.sleeperId);
        if (playerInfo && streamTE.avgTargets) {
          const avgTargets = Number(streamTE.avgTargets);
          takes.push({
            player: playerInfo.name,
            insight: `${softestDefense.defTeam} allows ${softestDefense.fpAllowed?.toFixed(1)} FPG - ${avgTargets.toFixed(1)} targets, streaming TE option`,
            position: 'TE'
          });
        }
      }

    } catch (error) {
      console.error('Error generating TE takes:', error);
    }

    return takes;
  }

  /**
   * Helper to get player name from Sleeper ID
   */
  private async getPlayerInfo(sleeperId: string): Promise<{ name: string; position: string } | null> {
    try {
      const player = await db
        .select({
          firstName: players.firstName,
          lastName: players.lastName,
          position: players.position
        })
        .from(players)
        .where(eq(players.sleeperId, sleeperId))
        .limit(1);

      if (player.length > 0) {
        const p = player[0];
        // Format as "F. LastName" for conciseness
        const firstName = p.firstName ? `${p.firstName.charAt(0)}.` : '';
        const lastName = p.lastName || 'Unknown';
        return {
          name: `${firstName} ${lastName}`,
          position: p.position || 'Unknown'
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching player info:', error);
      return null;
    }
  }
}

export const weeklyTakesService = new WeeklyTakesService();
