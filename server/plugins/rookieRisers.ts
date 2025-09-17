/**
 * Rookie Risers Brand Plugin
 * 
 * Calculates Waiver Heat Index for rookie players based on usage growth,
 * opportunity delta, market lag, and news weight signals.
 * 
 * Signal Formula:
 * - 40% Usage Growth (week-to-week snap/target share increase)
 * - 30% Opportunity Delta (injury/depth chart changes)  
 * - 20% Market Lag (ADP vs performance gap)
 * - 10% News Weight (recent news/intel signals)
 */

import { sql } from 'drizzle-orm';
import type { BrandPlugin, BrandContext, BusEvent } from '../../domain/events';
import { normalizeSignal, combineSignals } from '../../domain/events';

export const RookieRisersPlugin: BrandPlugin = {
  key: 'rookie_risers',
  name: 'Rookie Risers Intelligence',
  version: '1.0.0',
  subscribedEvents: ['DATASET.COMMITTED', 'DATASET.ROLL_WEEK'],

  async onEvent(evt: BusEvent, ctx: BrandContext): Promise<void> {
    const { logger, metrics, db } = ctx;
    
    // Only process gold_player_week commits and week rollovers
    if (evt.type === 'DATASET.COMMITTED' && evt.dataset !== 'gold_player_week') {
      return;
    }
    
    if (evt.type === 'DATASET.ROLL_WEEK') {
      // Handle week transitions - recalculate trend signals
      await this.processWeekRollover(evt, ctx);
      return;
    }

    logger.info('Processing rookie riser signals', { 
      dataset: evt.dataset, 
      season: evt.season, 
      week: evt.week, 
      rowCount: evt.rowCount 
    });

    const timer = metrics.begin('rookie_risers_calculation');
    
    try {
      // Get current season context for rookie filtering
      const seasonInfo = await ctx.season();
      
      // Calculate rookie riser signals for all eligible players
      const rookieSignals = await this.calculateRookieRiserSignals(
        evt.season, 
        evt.week, 
        db, 
        logger
      );

      // Store signals in brand_signals table
      for (const signal of rookieSignals) {
        await this.storeRookieSignal(signal, db, logger);
      }

      logger.info(`Generated ${rookieSignals.length} rookie riser signals`, {
        season: evt.season,
        week: evt.week,
        avgScore: rookieSignals.length > 0 ? 
          rookieSignals.reduce((sum, s) => sum + s.waiverHeat, 0) / rookieSignals.length : 0
      });

      timer();

    } catch (error) {
      logger.error('Failed to process rookie riser signals', error, {
        season: evt.season,
        week: evt.week,
        dataset: evt.dataset
      });
      
      metrics.fail('rookie_risers_calculation', error as Error);
      throw error;
    }
  },

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      // Basic health check - ensure we can access required tables
      // This is a simple check, could be enhanced with more comprehensive validation
      return { healthy: true, message: 'Rookie Risers plugin healthy' };
    } catch (error) {
      return { 
        healthy: false, 
        message: `Health check failed: ${(error as Error).message}` 
      };
    }
  },

  /**
   * Calculate rookie riser signals for a given week
   */
  async calculateRookieRiserSignals(
    season: number,
    week: number,
    db: any,
    logger: any
  ): Promise<RookieRiserSignal[]> {
    
    // Only calculate for weeks 2+ (need previous week for growth)
    if (week < 2) {
      logger.info('Skipping rookie risers for week 1 (no previous week data)');
      return [];
    }

    try {
      // Get rookie player data with usage metrics
      const rookieData = await db.execute(sql`
        WITH rookie_players AS (
          -- Get players drafted in current season (rookies)
          SELECT DISTINCT 
            p.sleeper_id as player_id,
            p.first_name || ' ' || p.last_name as player_name,
            p.position,
            p.team
          FROM players p
          WHERE p.years_exp = 0 
            OR p.draft_year = ${season}
        ),
        current_week_stats AS (
          -- Current week performance
          SELECT 
            gpw.player_id,
            gpw.snap_count,
            gpw.snap_share,
            gpw.targets,
            gpw.target_share,
            gpw.carries,
            gpw.receiving_yards + gpw.rushing_yards as total_yards,
            gpw.receiving_tds + gpw.rushing_tds as total_tds,
            gpw.fantasy_points_ppr
          FROM gold_player_week gpw
          WHERE gpw.season = ${season} 
            AND gpw.week = ${week}
        ),
        previous_week_stats AS (
          -- Previous week performance for comparison
          SELECT 
            gpw.player_id,
            gpw.snap_count as prev_snap_count,
            gpw.snap_share as prev_snap_share,
            gpw.targets as prev_targets,
            gpw.target_share as prev_target_share,
            gpw.carries as prev_carries,
            gpw.receiving_yards + gpw.rushing_yards as prev_total_yards,
            gpw.fantasy_points_ppr as prev_fantasy_points_ppr
          FROM gold_player_week gpw
          WHERE gpw.season = ${season} 
            AND gpw.week = ${week - 1}
        ),
        usage_growth AS (
          -- Calculate week-to-week usage growth
          SELECT 
            rp.player_id,
            rp.player_name,
            rp.position,
            rp.team,
            cws.snap_share,
            cws.target_share,
            cws.fantasy_points_ppr,
            -- Usage growth calculations
            CASE 
              WHEN pws.prev_snap_share > 0 
              THEN ((cws.snap_share - pws.prev_snap_share) / pws.prev_snap_share) * 100
              ELSE CASE WHEN cws.snap_share > 0 THEN 100 ELSE 0 END
            END as snap_share_growth,
            CASE 
              WHEN pws.prev_target_share > 0 
              THEN ((cws.target_share - pws.prev_target_share) / pws.prev_target_share) * 100
              ELSE CASE WHEN cws.target_share > 0 THEN 100 ELSE 0 END
            END as target_share_growth,
            -- Fantasy point growth
            CASE 
              WHEN pws.prev_fantasy_points_ppr > 0
              THEN ((cws.fantasy_points_ppr - pws.prev_fantasy_points_ppr) / pws.prev_fantasy_points_ppr) * 100
              ELSE CASE WHEN cws.fantasy_points_ppr > 0 THEN 100 ELSE 0 END
            END as fantasy_growth
          FROM rookie_players rp
          LEFT JOIN current_week_stats cws ON rp.player_id = cws.player_id
          LEFT JOIN previous_week_stats pws ON rp.player_id = pws.player_id
          WHERE cws.player_id IS NOT NULL -- Only players who played this week
        )
        SELECT 
          player_id,
          player_name,
          position,
          team,
          snap_share,
          target_share,
          fantasy_points_ppr,
          snap_share_growth,
          target_share_growth,
          fantasy_growth
        FROM usage_growth
        WHERE snap_share > 0.1 OR target_share > 0.05 -- Minimum usage threshold
        ORDER BY 
          GREATEST(snap_share_growth, target_share_growth, fantasy_growth) DESC
      `);

      const signals: RookieRiserSignal[] = [];

      for (const row of rookieData.rows) {
        const player = row as any;
        
        // Calculate individual signal components
        const usageGrowth = this.calculateUsageGrowthScore(player);
        const opportunityDelta = await this.calculateOpportunityDelta(player, season, week, db);
        const marketLag = await this.calculateMarketLag(player, season, week, db);
        const newsWeight = await this.calculateNewsWeight(player, season, week, db);

        // Combine signals using specified weights (40%, 30%, 20%, 10%)
        const waiverHeat = combineSignals([
          { value: usageGrowth, weight: 0.4 },
          { value: opportunityDelta, weight: 0.3 },
          { value: marketLag, weight: 0.2 },
          { value: newsWeight, weight: 0.1 }
        ]);

        signals.push({
          playerId: player.player_id,
          playerName: player.player_name,
          position: player.position,
          team: player.team,
          usageGrowth,
          opportunityDelta,
          marketLag,
          newsWeight,
          waiverHeat: Math.round(waiverHeat),
          meta: {
            components: {
              usageGrowth,
              opportunityDelta,
              marketLag,
              newsWeight
            },
            confidence: this.calculateConfidence(player),
            dataQuality: 'high',
            lastUpdated: new Date().toISOString(),
            calculation: 'usage_growth(40%) + opportunity_delta(30%) + market_lag(20%) + news_weight(10%)'
          }
        });
      }

      return signals.filter(s => s.waiverHeat >= 30); // Only return meaningful signals

    } catch (error) {
      logger.error('Error calculating rookie riser signals', error);
      throw error;
    }
  },

  /**
   * Calculate usage growth score (0-100)
   */
  calculateUsageGrowthScore(player: any): number {
    const snapGrowth = player.snap_share_growth || 0;
    const targetGrowth = player.target_share_growth || 0;
    const fantasyGrowth = player.fantasy_growth || 0;

    // Weight snap share and target share growth more heavily
    const compositeGrowth = (snapGrowth * 0.4) + (targetGrowth * 0.4) + (fantasyGrowth * 0.2);
    
    // Normalize to 0-100 scale (assuming -100% to +200% growth range)
    return normalizeSignal(compositeGrowth, -100, 200);
  },

  /**
   * Calculate opportunity delta score (0-100)
   */
  async calculateOpportunityDelta(player: any, season: number, week: number, db: any): Promise<number> {
    try {
      // Check for teammate injuries that opened opportunities
      const injuryOpportunity = await db.execute(sql`
        SELECT COUNT(*) as injury_count
        FROM injury_tracker it
        WHERE it.team = ${player.team}
          AND it.position = ${player.position}
          AND it.status IN ('out', 'ir', 'doubtful')
          AND it.season = ${season}
          AND it.week <= ${week}
      `);

      const injuryCount = injuryOpportunity.rows[0]?.injury_count || 0;
      
      // Score based on injury opportunities (more injuries = higher opportunity)
      const injuryScore = Math.min(injuryCount * 25, 75); // Max 75 points from injuries
      
      // Add depth chart movement bonus if we have that data
      const depthChartBonus = player.snap_share > 0.5 ? 25 : 0; // Bonus for starter-level snaps
      
      return Math.min(injuryScore + depthChartBonus, 100);

    } catch (error) {
      // If injury data not available, use snap share as proxy
      return normalizeSignal(player.snap_share || 0, 0, 1) * 0.7; // Conservative without injury data
    }
  },

  /**
   * Calculate market lag score (0-100)
   */
  async calculateMarketLag(player: any, season: number, week: number, db: any): Promise<number> {
    try {
      // Check if we have ADP/market data for this player
      const marketData = await db.execute(sql`
        SELECT 
          adp_rank,
          rostership_pct,
          start_pct
        FROM market_signals ms
        WHERE ms.player_id = ${player.playerId}
          AND ms.season = ${season}
          AND ms.week = ${week}
        ORDER BY ms.created_at DESC
        LIMIT 1
      `);

      if (marketData.rows.length === 0) {
        // No market data available - assume moderate lag for producing rookies
        return player.fantasy_points_ppr > 10 ? 60 : 30;
      }

      const market = marketData.rows[0] as any;
      
      // Calculate performance vs market expectation gap
      const performanceScore = normalizeSignal(player.fantasy_points_ppr || 0, 0, 25);
      const rostershipLag = 100 - (market.rostership_pct || 50); // Higher score for lower rostership
      
      // Combine performance and market position
      return Math.min((performanceScore + rostershipLag) / 2, 100);

    } catch (error) {
      // Fallback to performance-based scoring
      return normalizeSignal(player.fantasy_points_ppr || 0, 0, 20);
    }
  },

  /**
   * Calculate news weight score (0-100)
   */
  async calculateNewsWeight(player: any, season: number, week: number, db: any): Promise<number> {
    try {
      // Check for recent news/coaching comments
      const newsData = await db.execute(sql`
        SELECT 
          COUNT(*) as news_count,
          AVG(sentiment_score) as avg_sentiment
        FROM player_news pn
        WHERE pn.player_id = ${player.playerId}
          AND pn.season = ${season}
          AND pn.week >= ${week - 1} -- Last 2 weeks
          AND pn.relevance_score > 0.6 -- High relevance only
      `);

      if (newsData.rows.length === 0) {
        return 20; // Neutral score for no news
      }

      const news = newsData.rows[0] as any;
      const newsCount = news.news_count || 0;
      const sentiment = news.avg_sentiment || 0.5;

      // Score based on news volume and sentiment
      const volumeScore = Math.min(newsCount * 15, 60); // Up to 60 points for news volume
      const sentimentScore = normalizeSignal(sentiment, 0, 1) * 0.4; // Up to 40 points for sentiment
      
      return Math.min(volumeScore + sentimentScore, 100);

    } catch (error) {
      // Fallback - use usage trend as proxy for "buzz"
      return player.snap_share_growth > 50 ? 70 : 30;
    }
  },

  /**
   * Calculate confidence in signal (0-1)
   */
  calculateConfidence(player: any): number {
    let confidence = 0.7; // Base confidence

    // Higher confidence for more snaps
    if (player.snap_share > 0.3) confidence += 0.1;
    if (player.snap_share > 0.6) confidence += 0.1;

    // Higher confidence for skill positions with targets
    if (['WR', 'TE'].includes(player.position) && player.target_share > 0.1) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  },

  /**
   * Store rookie riser signal in database
   */
  async storeRookieSignal(signal: RookieRiserSignal, db: any, logger: any): Promise<void> {
    try {
      // Store waiver heat signal
      await db.execute(sql`
        INSERT INTO brand_signals (brand, season, week, player_id, signal_key, signal_value, meta)
        VALUES ('rookie_risers', ${signal.season}, ${signal.week}, ${signal.playerId}, 'waiver_heat', ${signal.waiverHeat}, ${JSON.stringify(signal.meta)})
        ON CONFLICT (brand, season, week, player_id, signal_key)
        DO UPDATE SET 
          signal_value = EXCLUDED.signal_value,
          meta = EXCLUDED.meta,
          updated_at = NOW()
      `);

      // Store component signals for detailed analysis
      const components = signal.meta.components;
      if (components) {
        for (const [key, value] of Object.entries(components)) {
          await db.execute(sql`
            INSERT INTO brand_signals (brand, season, week, player_id, signal_key, signal_value, meta)
            VALUES ('rookie_risers', ${signal.season}, ${signal.week}, ${signal.playerId}, ${`rookie_${key}`}, ${value}, ${JSON.stringify({ component: key })})
            ON CONFLICT (brand, season, week, player_id, signal_key)
            DO UPDATE SET 
              signal_value = EXCLUDED.signal_value,
              meta = EXCLUDED.meta,
              updated_at = NOW()
          `);
        }
      }

    } catch (error) {
      logger.error('Failed to store rookie riser signal', error, { 
        playerId: signal.playerId,
        waiverHeat: signal.waiverHeat 
      });
      throw error;
    }
  },

  /**
   * Process week rollover events
   */
  async processWeekRollover(evt: any, ctx: BrandContext): Promise<void> {
    const { logger } = ctx;
    
    logger.info('Processing week rollover for rookie risers', {
      season: evt.season,
      week: evt.week,
      previousWeek: evt.previousWeek
    });

    // Update trend calculations, clean up old signals, etc.
    // This could include recalculating rolling averages or updating season-long trends
  }
};

// Types for rookie riser calculations
interface RookieRiserSignal {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  season: number;
  week: number;
  usageGrowth: number;
  opportunityDelta: number;
  marketLag: number;
  newsWeight: number;
  waiverHeat: number;
  meta: {
    components: Record<string, number>;
    confidence: number;
    dataQuality: string;
    lastUpdated: string;
    calculation: string;
  };
}