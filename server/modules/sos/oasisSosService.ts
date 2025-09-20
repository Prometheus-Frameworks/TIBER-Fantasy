import { oasisEnvironmentService } from '../../services/oasisEnvironmentService';
import type { Position, WeeklySOS, ROSItem } from './sos.types';
import { db } from '../../db';
import { schedule } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * OASIS-Enhanced Strength of Schedule Service
 * 
 * Projects early season (2025) SOS using OASIS team environment data
 * when historical DVP data is not yet available.
 */

export interface OasisDefensiveProjection {
  team: string;
  position: Position;
  projected_fpa: number; // Projected fantasy points allowed
  environment_tier: 'elite' | 'good' | 'average' | 'poor';
  confidence: number; // 0-100 confidence in projection
  oasis_factors: {
    scoring_environment: number;
    pace_factor: number;
    red_zone_efficiency: number;
    qb_stability: number;
    ol_grade: number;
  };
}

export class OasisSosService {
  private static instance: OasisSosService;
  private projectionCache = new Map<string, OasisDefensiveProjection[]>();
  private cacheTTL = 1 * 60 * 60 * 1000; // 1 hour
  private cacheTimestamps = new Map<string, number>();

  static getInstance(): OasisSosService {
    if (!OasisSosService.instance) {
      OasisSosService.instance = new OasisSosService();
    }
    return OasisSosService.instance;
  }

  /**
   * Generate OASIS-based defensive projections for all teams
   */
  async generateDefensiveProjections(season: number, position: Position): Promise<OasisDefensiveProjection[]> {
    const cacheKey = `${season}-${position}`;
    
    // Check cache first
    if (this.isCacheValid(cacheKey)) {
      const cached = this.projectionCache.get(cacheKey);
      if (cached) {
        console.debug(`[OASIS-SOS] Cache hit for ${season} ${position}`);
        return cached;
      }
    }

    console.info(`[OASIS-SOS] Generating defensive projections for ${season} ${position}`);

    try {
      // Get OASIS team data for all 32 teams
      const teamIds = ['BUF', 'KC', 'SF', 'MIA', 'DAL', 'NYG', 'PHI', 'WAS', 'MIN', 'DET', 'GB', 'CHI', 
                       'TB', 'NO', 'ATL', 'CAR', 'LAR', 'SEA', 'ARI', 'SF', 'BAL', 'CIN', 'CLE', 'PIT',
                       'HOU', 'IND', 'JAX', 'TEN', 'DEN', 'LV', 'LAC', 'NYJ'];
      const allTeams = [];
      for (const teamId of teamIds) {
        const teamEnv = await oasisEnvironmentService.getTeamEnvironment(teamId);
        if (teamEnv) {
          allTeams.push({...teamEnv, teamId});
        }
      }
      const projections: OasisDefensiveProjection[] = [];

      for (const teamEnv of allTeams) {
        const projection = await this.calculateDefensiveProjection(teamEnv.teamId, position, teamEnv);
        projections.push(projection);
      }

      // Cache the results
      this.projectionCache.set(cacheKey, projections);
      this.cacheTimestamps.set(cacheKey, Date.now());

      console.info(`[OASIS-SOS] Generated ${projections.length} defensive projections for ${position}`);
      return projections;

    } catch (error) {
      console.error(`[OASIS-SOS] Error generating defensive projections:`, error);
      return [];
    }
  }

  /**
   * Calculate defensive projection for a specific team using OASIS data
   */
  private async calculateDefensiveProjection(
    teamId: string, 
    position: Position, 
    teamEnv: any
  ): Promise<OasisDefensiveProjection> {
    // Base fantasy points allowed - league average by position
    const baselineFPA = this.getPositionBaseline(position);
    
    // OASIS-based adjustments
    const oasisFactors = {
      scoring_environment: teamEnv.scoring_environment || 50,
      pace_factor: teamEnv.pace || 65,
      red_zone_efficiency: teamEnv.red_zone_efficiency || 50,
      qb_stability: teamEnv.qb_stability || 50,
      ol_grade: teamEnv.ol_grade || 50
    };

    // Calculate defensive strength based on OASIS offensive environment
    // Better offensive environment = easier to score against = higher FPA
    const defensiveProjection = this.calculatePositionSpecificProjection(
      baselineFPA, 
      position, 
      oasisFactors
    );

    const environmentTier = this.determineEnvironmentTier(oasisFactors.scoring_environment);
    const confidence = this.calculateConfidence(teamEnv);

    return {
      team: teamId,
      position,
      projected_fpa: Math.round(defensiveProjection * 100) / 100,
      environment_tier: environmentTier,
      confidence,
      oasis_factors: oasisFactors
    };
  }

  /**
   * Position-specific baseline fantasy points allowed
   */
  private getPositionBaseline(position: Position): number {
    switch (position) {
      case 'QB': return 18.5; // Average QB points allowed
      case 'RB': return 15.2; // Average RB points allowed  
      case 'WR': return 13.8; // Average WR points allowed
      case 'TE': return 9.5;  // Average TE points allowed
      default: return 14.0;
    }
  }

  /**
   * Calculate position-specific defensive projection
   */
  private calculatePositionSpecificProjection(
    baseline: number,
    position: Position,
    factors: any
  ): number {
    let projectedFPA = baseline;

    switch (position) {
      case 'QB':
        // QB performance correlates with team pace and scoring environment
        const qbPaceAdj = (factors.pace_factor - 65) / 65 * 0.15; // ±15% pace adjustment
        const qbScoreAdj = (factors.scoring_environment - 50) / 50 * 0.20; // ±20% scoring adjustment
        projectedFPA *= (1 + qbPaceAdj + qbScoreAdj);
        break;

      case 'RB':
        // RB performance correlates with red zone efficiency and OL grade
        const rbRzAdj = (factors.red_zone_efficiency - 50) / 50 * 0.25; // ±25% red zone adjustment
        const rbOlAdj = (factors.ol_grade - 50) / 50 * 0.15; // ±15% OL adjustment
        projectedFPA *= (1 + rbRzAdj + rbOlAdj);
        break;

      case 'WR':
      case 'TE':
        // WR/TE performance correlates with QB stability and pace
        const wrQbAdj = (factors.qb_stability - 50) / 50 * 0.20; // ±20% QB stability adjustment
        const wrPaceAdj = (factors.pace_factor - 65) / 65 * 0.10; // ±10% pace adjustment
        projectedFPA *= (1 + wrQbAdj + wrPaceAdj);
        break;
    }

    // Ensure reasonable bounds
    return Math.max(baseline * 0.6, Math.min(baseline * 1.4, projectedFPA));
  }

  /**
   * Determine environment tier based on scoring environment
   */
  private determineEnvironmentTier(scoringEnv: number): 'elite' | 'good' | 'average' | 'poor' {
    if (scoringEnv >= 80) return 'elite';
    if (scoringEnv >= 65) return 'good';
    if (scoringEnv >= 35) return 'average';
    return 'poor';
  }

  /**
   * Calculate confidence in projection based on data completeness
   */
  private calculateConfidence(teamEnv: any): number {
    let confidence = 70; // Base confidence

    // Boost confidence for teams with complete OASIS data
    if (teamEnv.scoring_environment && teamEnv.pace && teamEnv.red_zone_efficiency) {
      confidence += 20;
    }

    if (teamEnv.qb_stability && teamEnv.ol_grade) {
      confidence += 10;
    }

    return Math.min(100, confidence);
  }

  /**
   * Generate OASIS-powered weekly SOS for early 2025 season
   */
  async generateOasisWeeklySOS(
    position: Position,
    week: number,
    season: number = 2025
  ): Promise<WeeklySOS[]> {
    console.info(`[OASIS-SOS] Generating weekly SOS for ${position} ${season} Week ${week}`);

    try {
      // Get schedule for the week
      const games = await this.getWeekGames(season, week);
      if (!games.length) {
        console.warn(`[OASIS-SOS] No schedule data for ${season} Week ${week}`);
        return [];
      }

      // Get defensive projections
      const defensiveProjections = await this.generateDefensiveProjections(season, position);
      if (!defensiveProjections.length) {
        console.warn(`[OASIS-SOS] No defensive projections available for ${position}`);
        return [];
      }

      // Create projection map
      const projectionMap = new Map<string, OasisDefensiveProjection>();
      defensiveProjections.forEach(proj => projectionMap.set(proj.team, proj));

      // Calculate SOS scores using percentile scaling
      const allProjectedFPA = defensiveProjections.map(p => p.projected_fpa);
      const results: WeeklySOS[] = [];

      for (const game of games) {
        // Home team facing away defense
        const awayDefProjection = projectionMap.get(game.away);
        if (awayDefProjection) {
          const sosScore = this.percentileScale(allProjectedFPA, awayDefProjection.projected_fpa);
          results.push({
            team: game.home,
            position,
            week,
            opponent: game.away,
            sos_score: sosScore,
            tier: this.getTier(sosScore)
          });
        }

        // Away team facing home defense
        const homeDefProjection = projectionMap.get(game.home);
        if (homeDefProjection) {
          const sosScore = this.percentileScale(allProjectedFPA, homeDefProjection.projected_fpa);
          results.push({
            team: game.away,
            position,
            week,
            opponent: game.home,
            sos_score: sosScore,
            tier: this.getTier(sosScore)
          });
        }
      }

      console.info(`[OASIS-SOS] Generated ${results.length} weekly SOS entries for ${position} ${season} Week ${week}`);
      return results;

    } catch (error) {
      console.error(`[OASIS-SOS] Error generating weekly SOS:`, error);
      return [];
    }
  }

  /**
   * Generate OASIS-powered ROS SOS for early 2025 season
   */
  async generateOasisROSSOS(
    position: Position,
    startWeek: number = 1,
    window: number = 5,
    season: number = 2025
  ): Promise<ROSItem[]> {
    console.info(`[OASIS-SOS] Generating ROS SOS for ${position} ${season} weeks ${startWeek}-${startWeek + window - 1}`);

    const weeks = Array.from({length: window}, (_, i) => startWeek + i);
    const allWeeklyResults: WeeklySOS[] = [];

    // Collect weekly SOS for all weeks in window
    for (const week of weeks) {
      const weeklyResults = await this.generateOasisWeeklySOS(position, week, season);
      allWeeklyResults.push(...weeklyResults);
    }

    // Group by team and calculate averages
    const teamResults = new Map<string, WeeklySOS[]>();
    allWeeklyResults.forEach(result => {
      if (!teamResults.has(result.team)) {
        teamResults.set(result.team, []);
      }
      teamResults.get(result.team)!.push(result);
    });

    const rosItems: ROSItem[] = [];
    teamResults.forEach((results, team) => {
      const avgScore = Math.round(
        results.reduce((sum, r) => sum + r.sos_score, 0) / results.length
      );

      rosItems.push({
        team,
        position,
        weeks,
        avg_score: avgScore,
        tier: this.getTier(avgScore)
      });
    });

    // Sort by average score (descending = easier schedules first)
    rosItems.sort((a, b) => b.avg_score - a.avg_score);

    console.info(`[OASIS-SOS] Generated ROS SOS for ${rosItems.length} teams`);
    return rosItems;
  }

  /**
   * Get games for a specific week
   */
  private async getWeekGames(season: number, week: number) {
    try {
      const games = await db
        .select()
        .from(schedule)
        .where(
          and(
            eq(schedule.season, season),
            eq(schedule.week, week)
          )
        );

      if (games.length > 0) {
        return games;
      }
    } catch (error) {
      console.warn(`[OASIS-SOS] Could not fetch schedule for ${season} Week ${week}:`, error);
    }
    
    // Return sample schedule for early 2025 if database doesn't have it yet
    if (season === 2025 && week <= 3) {
      console.info(`[OASIS-SOS] Using sample schedule for ${season} Week ${week}`);
      return this.getSampleSchedule(week);
    }
    
    console.warn(`[OASIS-SOS] No schedule data available for ${season} Week ${week}`);
    return [];
  }

  /**
   * Sample schedule for early 2025 weeks (fallback)
   */
  private getSampleSchedule(week: number) {
    // Comprehensive sample schedule for early 2025 weeks
    const scheduleData = {
      1: [
        { season: 2025, week, home: 'BUF', away: 'KC' },
        { season: 2025, week, home: 'SF', away: 'MIA' },
        { season: 2025, week, home: 'DAL', away: 'NYG' },
        { season: 2025, week, home: 'PHI', away: 'WAS' },
        { season: 2025, week, home: 'GB', away: 'CHI' },
        { season: 2025, week, home: 'DET', away: 'MIN' },
        { season: 2025, week, home: 'TB', away: 'NO' },
        { season: 2025, week, home: 'ATL', away: 'CAR' },
        { season: 2025, week, home: 'LAR', away: 'SEA' },
        { season: 2025, week, home: 'ARI', away: 'LV' },
        { season: 2025, week, home: 'BAL', away: 'CIN' },
        { season: 2025, week, home: 'CLE', away: 'PIT' },
        { season: 2025, week, home: 'HOU', away: 'IND' },
        { season: 2025, week, home: 'JAX', away: 'TEN' },
        { season: 2025, week, home: 'DEN', away: 'LAC' },
        { season: 2025, week, home: 'NYJ', away: 'NE' }
      ],
      2: [
        { season: 2025, week, home: 'KC', away: 'MIA' },
        { season: 2025, week, home: 'BUF', away: 'SF' },
        { season: 2025, week, home: 'NYG', away: 'PHI' },
        { season: 2025, week, home: 'WAS', away: 'DAL' },
        { season: 2025, week, home: 'CHI', away: 'DET' },
        { season: 2025, week, home: 'MIN', away: 'GB' },
        { season: 2025, week, home: 'NO', away: 'ATL' },
        { season: 2025, week, home: 'CAR', away: 'TB' },
        { season: 2025, week, home: 'SEA', away: 'ARI' },
        { season: 2025, week, home: 'LV', away: 'LAR' },
        { season: 2025, week, home: 'CIN', away: 'CLE' },
        { season: 2025, week, home: 'PIT', away: 'BAL' },
        { season: 2025, week, home: 'IND', away: 'JAX' },
        { season: 2025, week, home: 'TEN', away: 'HOU' },
        { season: 2025, week, home: 'LAC', away: 'NYJ' },
        { season: 2025, week, home: 'NE', away: 'DEN' }
      ],
      3: [
        { season: 2025, week, home: 'MIA', away: 'DAL' },
        { season: 2025, week, home: 'SF', away: 'KC' },
        { season: 2025, week, home: 'BUF', away: 'NYG' },
        { season: 2025, week, home: 'PHI', away: 'MIN' },
        { season: 2025, week, home: 'WAS', away: 'CHI' },
        { season: 2025, week, home: 'DET', away: 'GB' },
        { season: 2025, week, home: 'TB', away: 'CAR' },
        { season: 2025, week, home: 'ATL', away: 'NO' },
        { season: 2025, week, home: 'LAR', away: 'ARI' },
        { season: 2025, week, home: 'SEA', away: 'LV' },
        { season: 2025, week, home: 'BAL', away: 'PIT' },
        { season: 2025, week, home: 'CIN', away: 'CLE' },
        { season: 2025, week, home: 'HOU', away: 'JAX' },
        { season: 2025, week, home: 'IND', away: 'TEN' },
        { season: 2025, week, home: 'DEN', away: 'LAC' },
        { season: 2025, week, home: 'NYJ', away: 'NE' }
      ]
    };

    const games = scheduleData[week as keyof typeof scheduleData] || scheduleData[3];
    console.info(`[OASIS-SOS] Using sample schedule for Week ${week} with ${games.length} games`);
    return games;
  }

  /**
   * Percentile scaling (0-100)
   */
  private percentileScale(values: number[], value: number): number {
    if (!values.length) return 50;
    
    const sorted = [...values].sort((a, b) => a - b);
    let rank = 0;
    
    for (let i = 0; i < sorted.length; i++) {
      if (value >= sorted[i]) rank = i + 1;
      else break;
    }
    
    return Math.round((rank / sorted.length) * 100);
  }

  /**
   * Get tier based on SOS score
   */
  private getTier(score: number): 'green' | 'yellow' | 'red' {
    if (score >= 67) return 'green';
    if (score >= 33) return 'yellow';
    return 'red';
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(key: string): boolean {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return false;
    return (Date.now() - timestamp) < this.cacheTTL;
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache(): void {
    this.projectionCache.clear();
    this.cacheTimestamps.clear();
    console.info('[OASIS-SOS] Cache cleared');
  }
}

export const oasisSosService = OasisSosService.getInstance();