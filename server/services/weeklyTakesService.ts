import { db } from '../db';
import { defenseVP, qbEpaAdjusted } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

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
      // Get top QBs by adjusted EPA
      const topQBs = await db
        .select()
        .from(qbEpaAdjusted)
        .where(eq(qbEpaAdjusted.season, 2025))
        .orderBy(desc(qbEpaAdjusted.tiberAdjEpaPerPlay))
        .limit(8);

      // Generate takes for elite QBs
      if (topQBs.length > 0) {
        const elite = topQBs[0];
        if (elite.tiberAdjEpaPerPlay && elite.tiberAdjEpaPerPlay > 0.25) {
          takes.push({
            player: elite.playerName || 'Unknown',
            insight: `Elite EPA efficiency ${elite.tiberAdjEpaPerPlay.toFixed(3)}, consistent QB1 upside`,
            position: 'QB'
          });
        }

        // Check for pressure performance
        if (topQBs.length > 1) {
          const pressureQB = topQBs[1];
          if (pressureQB.pressureAdjustment && Math.abs(pressureQB.pressureAdjustment) > 0.02) {
            const pressureDesc = pressureQB.pressureAdjustment > 0 ? 'excels under pressure' : 'struggles vs blitz';
            takes.push({
              player: pressureQB.playerName || 'Unknown',
              insight: `${pressureDesc} (${pressureQB.pressureAdjustment > 0 ? '+' : ''}${pressureQB.pressureAdjustment.toFixed(3)} EPA)`,
              position: 'QB'
            });
          }
        }

        // Add a strategic QB take
        takes.push({
          player: 'Streaming Options',
          insight: 'Target QBs facing bottom-5 pass defenses this week',
          position: 'QB'
        });
      }

    } catch (error) {
      console.error('Error generating QB takes:', error);
    }

    return takes;
  }

  /**
   * Generate RB takes based on usage and matchup data
   */
  private async generateRBTakes(week: number, season: number): Promise<WeeklyTake[]> {
    const takes: WeeklyTake[] = [];

    takes.push({
      player: 'Pass-Catching RBs',
      insight: 'Target RBs with 15%+ target share in negative game scripts',
      position: 'RB'
    });

    takes.push({
      player: 'Zone Scheme Backs',
      insight: 'Zone-blocking teams allow higher YPC, check DvP rush rankings',
      position: 'RB'
    });

    takes.push({
      player: 'Goal-Line Backs',
      insight: 'Red zone specialists in favorable matchups for TD upside',
      position: 'RB'
    });

    return takes;
  }

  /**
   * Generate WR takes based on target data and coverage metrics
   */
  private async generateWRTakes(week: number, season: number): Promise<WeeklyTake[]> {
    const takes: WeeklyTake[] = [];

    try {
      // Get DvP data for WR matchups
      const wrMatchups = await db
        .select()
        .from(defenseVP)
        .where(eq(defenseVP.position, 'WR'))
        .orderBy(desc(defenseVP.fpAllowed))
        .limit(5);

      if (wrMatchups.length > 0) {
        const softestDefense = wrMatchups[0];
        takes.push({
          player: 'WR Matchup Targets',
          insight: `${softestDefense.defTeam} allows ${softestDefense.fpAllowed?.toFixed(1)} FPG to WRs`,
          position: 'WR'
        });
      }

      // Strategic WR takes
      takes.push({
        player: 'Slot Receivers',
        insight: 'Target slot WRs vs zone-heavy defenses for high target floor',
        position: 'WR'
      });

      takes.push({
        player: 'Deep Threats',
        insight: 'High aDOT receivers in single-high safety matchups',
        position: 'WR'
      });

    } catch (error) {
      console.error('Error generating WR takes:', error);
    }

    return takes;
  }

  /**
   * Generate TE takes based on coverage schemes and target data
   */
  private async generateTETakes(week: number, season: number): Promise<WeeklyTake[]> {
    const takes: WeeklyTake[] = [];

    try {
      // Get DvP data for TE matchups
      const teMatchups = await db
        .select()
        .from(defenseVP)
        .where(eq(defenseVP.position, 'TE'))
        .orderBy(desc(defenseVP.fpAllowed))
        .limit(3);

      if (teMatchups.length > 0) {
        const softestDefense = teMatchups[0];
        takes.push({
          player: 'TE Matchup Targets',
          insight: `${softestDefense.defTeam} allows ${softestDefense.fpAllowed?.toFixed(1)} FPG to TEs`,
          position: 'TE'
        });
      }

      // Strategic TE takes
      takes.push({
        player: 'Elite TEs',
        insight: 'Target hogs with 20%+ target share, high floor plays',
        position: 'TE'
      });

      takes.push({
        player: 'Streaming TEs',
        insight: 'TEs vs Cover 3 defenses excel in middle seam',
        position: 'TE'
      });

    } catch (error) {
      console.error('Error generating TE takes:', error);
    }

    return takes;
  }
}

export const weeklyTakesService = new WeeklyTakesService();
