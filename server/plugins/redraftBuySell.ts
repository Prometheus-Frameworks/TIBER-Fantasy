/**
 * Redraft Buy/Sell Brand Plugin
 * 
 * Generates buy/sell recommendations for redraft fantasy players based on:
 * - Performance trajectory (recent trend vs season baseline)
 * - Schedule strength (upcoming matchup difficulty)
 * - Health status (injury risk assessment)
 * - Usage trends (opportunity share evolution)
 */

import { sql } from 'drizzle-orm';
import type { BrandPlugin, BrandContext, BusEvent } from '../../domain/events';
import { normalizeSignal, combineSignals } from '../../domain/events';

export const RedraftBuySellPlugin: BrandPlugin = {
  key: 'redraft',
  name: 'Redraft Buy/Sell Intelligence',
  version: '1.0.0',
  subscribedEvents: ['DATASET.COMMITTED', 'DATASET.ROLL_WEEK'],

  async onEvent(evt: BusEvent, ctx: BrandContext): Promise<void> {
    const { logger, metrics, db } = ctx;
    
    // Only process gold_player_week commits and injury reports
    if (evt.type === 'DATASET.COMMITTED' && 
        !['gold_player_week', 'injury_report', 'gold_player_season'].includes(evt.dataset)) {
      return;
    }

    logger.info('Processing redraft buy/sell signals', { 
      dataset: evt.dataset, 
      season: evt.season, 
      week: evt.week 
    });

    const timer = metrics.begin('redraft_buysell_calculation');
    
    try {
      // Calculate buy/sell signals for relevant players
      const buysSells = await this.calculateBuySellSignals(
        evt.season, 
        evt.week, 
        db, 
        logger
      );

      // Store signals in brand_signals table
      for (const signal of buysSells) {
        await this.storeBuySellSignal(signal, db, logger);
      }

      logger.info(`Generated ${buysSells.length} redraft buy/sell signals`, {
        season: evt.season,
        week: evt.week,
        avgRating: buysSells.length > 0 ? 
          buysSells.reduce((sum, s) => sum + s.buySellRating, 0) / buysSells.length : 50
      });

      timer();

    } catch (error) {
      logger.error('Failed to process redraft buy/sell signals', error, {
        season: evt.season,
        week: evt.week,
        dataset: evt.dataset
      });
      
      metrics.fail('redraft_buysell_calculation', error as Error);
      throw error;
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      return { healthy: true, message: 'Redraft Buy/Sell plugin healthy' };
    } catch (error) {
      return { 
        healthy: false, 
        message: `Health check failed: ${(error as Error).message}` 
      };
    }
  },

  /**
   * Calculate buy/sell signals for redraft players
   */
  async calculateBuySellSignals(
    season: number,
    week: number,
    db: any,
    logger: any
  ): Promise<BuySellSignal[]> {
    
    // Need at least 3 weeks of data for meaningful trends
    if (week < 3) {
      logger.info('Skipping buy/sell for early weeks (need 3+ weeks of data)');
      return [];
    }

    try {
      // Get player performance data with trends
      const playerData = await db.execute(sql`
        WITH player_recent_performance AS (
          -- Last 3 weeks performance
          SELECT 
            gpw.player_id,
            p.first_name || ' ' || p.last_name as player_name,
            p.position,
            p.team,
            AVG(gpw.fantasy_points_ppr) as recent_avg_points,
            AVG(gpw.snap_share) as recent_avg_snaps,
            AVG(gpw.target_share) as recent_avg_targets,
            COUNT(*) as games_in_sample
          FROM gold_player_week gpw
          JOIN players p ON gpw.player_id = p.sleeper_id
          WHERE gpw.season = ${season}
            AND gpw.week BETWEEN ${week - 2} AND ${week}
            AND gpw.fantasy_points_ppr IS NOT NULL
          GROUP BY gpw.player_id, p.first_name, p.last_name, p.position, p.team
        ),
        player_season_baseline AS (
          -- Season-to-date baseline (excluding last 3 weeks)
          SELECT 
            gpw.player_id,
            AVG(gpw.fantasy_points_ppr) as season_avg_points,
            AVG(gpw.snap_share) as season_avg_snaps,
            AVG(gpw.target_share) as season_avg_targets,
            COUNT(*) as season_games
          FROM gold_player_week gpw
          WHERE gpw.season = ${season}
            AND gpw.week < ${week - 2}
            AND gpw.fantasy_points_ppr IS NOT NULL
          GROUP BY gpw.player_id
          HAVING COUNT(*) >= 2 -- At least 2 games for baseline
        ),
        current_week_performance AS (
          -- Most recent week performance
          SELECT 
            gpw.player_id,
            gpw.fantasy_points_ppr as current_points,
            gpw.snap_share as current_snaps,
            gpw.target_share as current_targets
          FROM gold_player_week gpw
          WHERE gpw.season = ${season}
            AND gpw.week = ${week}
        )
        SELECT 
          prp.player_id,
          prp.player_name,
          prp.position,
          prp.team,
          prp.recent_avg_points,
          prp.recent_avg_snaps,
          prp.recent_avg_targets,
          psb.season_avg_points,
          psb.season_avg_snaps,
          psb.season_avg_targets,
          cwp.current_points,
          cwp.current_snaps,
          cwp.current_targets,
          prp.games_in_sample,
          psb.season_games
        FROM player_recent_performance prp
        LEFT JOIN player_season_baseline psb ON prp.player_id = psb.player_id
        LEFT JOIN current_week_performance cwp ON prp.player_id = cwp.player_id
        WHERE prp.games_in_sample = 3 -- Full 3-week sample
          AND (prp.recent_avg_points >= 8 OR psb.season_avg_points >= 8) -- Relevant players only
        ORDER BY 
          CASE 
            WHEN psb.season_avg_points > 0 
            THEN (prp.recent_avg_points - psb.season_avg_points) / psb.season_avg_points
            ELSE prp.recent_avg_points / 10
          END DESC
      `);

      const signals: BuySellSignal[] = [];

      for (const row of playerData.rows) {
        const player = row as any;
        
        // Calculate individual signal components
        const performanceTrend = this.calculatePerformanceTrend(player);
        const scheduleStrength = await this.calculateScheduleStrength(player, season, week, db);
        const healthStatus = await this.calculateHealthStatus(player, season, week, db);
        const usageTrend = this.calculateUsageTrend(player);

        // Combine signals with equal weighting
        const buySellRating = combineSignals([
          { value: performanceTrend, weight: 0.35 },
          { value: scheduleStrength, weight: 0.25 },
          { value: healthStatus, weight: 0.25 },
          { value: usageTrend, weight: 0.15 }
        ]);

        // Determine buy/sell recommendation
        const recommendation = this.getBuySellRecommendation(buySellRating);

        signals.push({
          playerId: player.player_id,
          playerName: player.player_name,
          position: player.position,
          team: player.team,
          season,
          week,
          performanceTrend,
          scheduleStrength,
          healthStatus,
          usageTrend,
          buySellRating: Math.round(buySellRating),
          recommendation,
          meta: {
            components: {
              performanceTrend,
              scheduleStrength,
              healthStatus,
              usageTrend
            },
            confidence: this.calculateConfidence(player),
            dataQuality: 'high',
            lastUpdated: new Date().toISOString(),
            calculation: 'performance_trend(35%) + schedule_strength(25%) + health_status(25%) + usage_trend(15%)'
          }
        });
      }

      // Filter to only meaningful recommendations (strong buy/sell signals)
      return signals.filter(s => s.buySellRating <= 30 || s.buySellRating >= 70);

    } catch (error) {
      logger.error('Error calculating buy/sell signals', error);
      throw error;
    }
  },

  /**
   * Calculate performance trend score (0-100)
   * Higher score = positive trend (BUY signal)
   */
  calculatePerformanceTrend(player: any): number {
    const recentAvg = player.recent_avg_points || 0;
    const seasonAvg = player.season_avg_points || recentAvg;
    
    if (seasonAvg === 0) return 50; // Neutral if no baseline
    
    // Calculate percentage change from season baseline to recent performance
    const trendPercent = ((recentAvg - seasonAvg) / seasonAvg) * 100;
    
    // Normalize to 0-100 scale (assuming -50% to +100% range)
    return normalizeSignal(trendPercent, -50, 100);
  },

  /**
   * Calculate schedule strength score (0-100)
   * Higher score = easier upcoming schedule (BUY signal)
   */
  async calculateScheduleStrength(player: any, season: number, week: number, db: any): Promise<number> {
    try {
      // Get upcoming opponents and their defensive rankings
      const scheduleData = await db.execute(sql`
        WITH upcoming_games AS (
          SELECT 
            s.team,
            s.opponent,
            s.week as game_week
          FROM schedules s
          WHERE s.season = ${season}
            AND s.week BETWEEN ${week + 1} AND ${Math.min(week + 3, 18)} -- Next 3 games
            AND s.team = ${player.team}
        ),
        opponent_defense_ranks AS (
          SELECT 
            ug.game_week,
            ug.opponent,
            COALESCE(dr.points_allowed_rank, 16) as def_rank, -- Default to middle rank
            COALESCE(dr.yards_allowed_rank, 16) as yards_rank
          FROM upcoming_games ug
          LEFT JOIN defense_rankings dr ON ug.opponent = dr.team 
            AND dr.season = ${season}
            AND dr.position = ${player.position}
        )
        SELECT 
          AVG(def_rank) as avg_def_rank,
          AVG(yards_rank) as avg_yards_rank,
          COUNT(*) as games_count
        FROM opponent_defense_ranks
      `);

      if (scheduleData.rows.length === 0 || scheduleData.rows[0].games_count === 0) {
        return 50; // Neutral if no schedule data
      }

      const schedule = scheduleData.rows[0] as any;
      const avgDefRank = schedule.avg_def_rank || 16;
      
      // Convert defensive rank to strength score (lower rank = worse defense = better matchup)
      // Rank 1 (best defense) = 20 points, Rank 32 (worst defense) = 80 points
      return normalizeSignal(32 - avgDefRank, 0, 31) * 60 + 20;

    } catch (error) {
      // Fallback to neutral score if schedule data unavailable
      return 50;
    }
  },

  /**
   * Calculate health status score (0-100)
   * Higher score = healthier player (BUY signal)
   */
  async calculateHealthStatus(player: any, season: number, week: number, db: any): Promise<number> {
    try {
      // Check current injury status
      const injuryData = await db.execute(sql`
        SELECT 
          status,
          severity,
          weeks_out
        FROM injury_tracker it
        WHERE it.player_id = ${player.player_id}
          AND it.season = ${season}
          AND it.week = ${week}
        ORDER BY it.updated_at DESC
        LIMIT 1
      `);

      if (injuryData.rows.length === 0) {
        return 85; // Healthy - high score
      }

      const injury = injuryData.rows[0] as any;
      
      // Score based on injury status
      switch (injury.status) {
        case 'healthy': return 85;
        case 'questionable': return 65;
        case 'doubtful': return 35;
        case 'out': return 20;
        case 'ir': return 10;
        default: return 60;
      }

    } catch (error) {
      // Assume healthy if no injury data
      return 80;
    }
  },

  /**
   * Calculate usage trend score (0-100)
   * Higher score = increasing usage (BUY signal)
   */
  calculateUsageTrend(player: any): number {
    const recentSnaps = player.recent_avg_snaps || 0;
    const seasonSnaps = player.season_avg_snaps || recentSnaps;
    const recentTargets = player.recent_avg_targets || 0;
    const seasonTargets = player.season_avg_targets || recentTargets;
    
    // Calculate snap share trend
    const snapTrend = seasonSnaps > 0 ? 
      ((recentSnaps - seasonSnaps) / seasonSnaps) * 100 : 0;
    
    // Calculate target share trend (for skill positions)
    const targetTrend = seasonTargets > 0 ? 
      ((recentTargets - seasonTargets) / seasonTargets) * 100 : 0;
    
    // Weight target share more heavily for pass catchers
    const weight = ['WR', 'TE'].includes(player.position) ? 0.6 : 0.3;
    const compositeUsage = (snapTrend * (1 - weight)) + (targetTrend * weight);
    
    // Normalize to 0-100 scale (assuming -30% to +50% usage change)
    return normalizeSignal(compositeUsage, -30, 50);
  },

  /**
   * Get buy/sell recommendation based on rating
   */
  getBuySellRecommendation(rating: number): string {
    if (rating >= 80) return 'STRONG_BUY';
    if (rating >= 65) return 'BUY';
    if (rating >= 55) return 'WEAK_BUY';
    if (rating >= 45) return 'HOLD';
    if (rating >= 35) return 'WEAK_SELL';
    if (rating >= 20) return 'SELL';
    return 'STRONG_SELL';
  },

  /**
   * Calculate confidence in recommendation (0-1)
   */
  calculateConfidence(player: any): number {
    let confidence = 0.6; // Base confidence
    
    // Higher confidence with more data points
    if (player.season_games >= 5) confidence += 0.1;
    if (player.games_in_sample >= 3) confidence += 0.1;
    
    // Higher confidence for consistent usage
    if (player.recent_avg_snaps > 0.4) confidence += 0.1;
    
    // Higher confidence for skill positions with targets
    if (['WR', 'TE'].includes(player.position) && player.recent_avg_targets > 0.1) {
      confidence += 0.1;
    }
    
    return Math.min(confidence, 1.0);
  },

  /**
   * Store buy/sell signal in database
   */
  async storeBuySellSignal(signal: BuySellSignal, db: any, logger: any): Promise<void> {
    try {
      // Store main buy/sell rating
      await db.execute(sql`
        INSERT INTO brand_signals (brand, season, week, player_id, signal_key, signal_value, meta)
        VALUES ('redraft', ${signal.season}, ${signal.week}, ${signal.playerId}, 'buy_sell_rating', ${signal.buySellRating}, ${JSON.stringify(signal.meta)})
        ON CONFLICT (brand, season, week, player_id, signal_key)
        DO UPDATE SET 
          signal_value = EXCLUDED.signal_value,
          meta = EXCLUDED.meta,
          updated_at = NOW()
      `);

      // Store recommendation as separate signal
      const recommendationValue = this.getRecommendationValue(signal.recommendation);
      await db.execute(sql`
        INSERT INTO brand_signals (brand, season, week, player_id, signal_key, signal_value, meta)
        VALUES ('redraft', ${signal.season}, ${signal.week}, ${signal.playerId}, 'recommendation', ${recommendationValue}, ${JSON.stringify({ recommendation: signal.recommendation })})
        ON CONFLICT (brand, season, week, player_id, signal_key)
        DO UPDATE SET 
          signal_value = EXCLUDED.signal_value,
          meta = EXCLUDED.meta,
          updated_at = NOW()
      `);

      // Store component signals for analysis
      const components = signal.meta.components;
      if (components) {
        for (const [key, value] of Object.entries(components)) {
          await db.execute(sql`
            INSERT INTO brand_signals (brand, season, week, player_id, signal_key, signal_value, meta)
            VALUES ('redraft', ${signal.season}, ${signal.week}, ${signal.playerId}, ${`redraft_${key}`}, ${value}, ${JSON.stringify({ component: key })})
            ON CONFLICT (brand, season, week, player_id, signal_key)
            DO UPDATE SET 
              signal_value = EXCLUDED.signal_value,
              meta = EXCLUDED.meta,
              updated_at = NOW()
          `);
        }
      }

    } catch (error) {
      logger.error('Failed to store buy/sell signal', error, { 
        playerId: signal.playerId,
        recommendation: signal.recommendation,
        rating: signal.buySellRating
      });
      throw error;
    }
  },

  /**
   * Convert recommendation string to numeric value for storage
   */
  getRecommendationValue(recommendation: string): number {
    const values: Record<string, number> = {
      'STRONG_SELL': 10,
      'SELL': 25,
      'WEAK_SELL': 40,
      'HOLD': 50,
      'WEAK_BUY': 60,
      'BUY': 75,
      'STRONG_BUY': 90
    };
    return values[recommendation] || 50;
  }
};

// Types for buy/sell calculations
interface BuySellSignal {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  season: number;
  week: number;
  performanceTrend: number;
  scheduleStrength: number;
  healthStatus: number;
  usageTrend: number;
  buySellRating: number;
  recommendation: string;
  meta: {
    components: Record<string, number>;
    confidence: number;
    dataQuality: string;
    lastUpdated: string;
    calculation: string;
  };
}