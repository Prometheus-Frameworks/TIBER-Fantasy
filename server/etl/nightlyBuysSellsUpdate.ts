/**
 * Nightly ETL Pipeline for Buys/Sells Trade Advice Computation
 * Runs after player data updates to generate fresh trade recommendations
 */
import { computeBuysSellsForAllPositions } from '../compute';
import { db } from '../db';
import { getCurrentNFLWeek } from '../cron/weeklyUpdate';

interface ProcessingResult {
  week: number;
  season: number;
  totalRecords: number;
  positionsProcessed: string[];
  formatsProcessed: string[];
  errors: string[];
  duration: number;
}

export class NightlyBuysSellsETL {
  private readonly CURRENT_SEASON = 2025;
  private readonly POSITIONS = ['QB', 'RB', 'WR', 'TE'];
  private readonly FORMATS = ['redraft', 'dynasty'] as const;
  private readonly PPR_SETTINGS = ['ppr', 'half', 'standard'] as const;

  /**
   * Main nightly processing entry point
   * Computes Buys/Sells for all positions and formats
   */
  async processNightlyBuysSells(): Promise<ProcessingResult> {
    const startTime = Date.now();
    const currentWeek = parseInt(getCurrentNFLWeek());
    const season = this.CURRENT_SEASON;
    
    console.log(`🌙 Starting nightly Buys/Sells computation for Week ${currentWeek}, Season ${season}...`);
    
    const result: ProcessingResult = {
      week: currentWeek,
      season,
      totalRecords: 0,
      positionsProcessed: [],
      formatsProcessed: [],
      errors: [],
      duration: 0
    };

    try {
      // Verify we have fresh player data before computing
      await this.verifyPlayerDataFreshness(season, currentWeek);
      
      // Process all combinations of positions, formats, and PPR settings
      await this.processAllCombinations(currentWeek, season, result);
      
      // Generate summary statistics
      await this.generateSummaryStats(currentWeek, season);
      
      result.duration = Date.now() - startTime;
      console.log(`✅ Nightly Buys/Sells computation completed in ${result.duration}ms`);
      console.log(`📊 Processed ${result.totalRecords} total recommendations across ${result.positionsProcessed.length} positions`);
      
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);
      result.duration = Date.now() - startTime;
      
      console.error(`❌ Nightly Buys/Sells computation failed:`, error);
      throw error;
    }
  }

  /**
   * Process all combinations of positions, formats, and PPR settings
   */
  private async processAllCombinations(
    week: number, 
    season: number, 
    result: ProcessingResult
  ): Promise<void> {
    console.log('🔄 Processing all position/format/PPR combinations...');
    
    const totalCombinations = this.POSITIONS.length * this.FORMATS.length * this.PPR_SETTINGS.length;
    let processed = 0;

    for (const position of this.POSITIONS) {
      console.log(`📍 Processing position: ${position}`);
      
      for (const format of this.FORMATS) {
        for (const ppr of this.PPR_SETTINGS) {
          try {
            processed++;
            console.log(`   └─ ${format}/${ppr} (${processed}/${totalCombinations})`);
            
            // Import and run the compute function for this specific combination
            const { computeBuysSellsForWeek } = await import('../compute');
            const records = await computeBuysSellsForWeek(week, position, format, ppr, season);
            
            if (records && records.length > 0) {
              result.totalRecords += records.length;
              console.log(`      ✓ Generated ${records.length} recommendations`);
            } else {
              console.log(`      ⚠️ No data available for ${position} ${format} ${ppr}`);
            }
            
            // Track successful processing
            if (!result.positionsProcessed.includes(position)) {
              result.positionsProcessed.push(position);
            }
            if (!result.formatsProcessed.includes(`${format}/${ppr}`)) {
              result.formatsProcessed.push(`${format}/${ppr}`);
            }

          } catch (error) {
            const errorMsg = `${position}/${format}/${ppr}: ${error instanceof Error ? error.message : 'Unknown error'}`;
            result.errors.push(errorMsg);
            console.error(`   ❌ Failed to process ${position}/${format}/${ppr}:`, error);
            // Continue processing other combinations
          }
        }
      }
    }
  }

  /**
   * Verify that we have fresh player data before computing recommendations
   */
  private async verifyPlayerDataFreshness(season: number, week: number): Promise<void> {
    console.log('🔍 Verifying player data freshness...');
    
    try {
      // Check if we have recent player week facts data
      const { playerWeekFacts } = await import('@shared/schema');
      const { count } = await import('drizzle-orm');
      const { eq, and } = await import('drizzle-orm');
      
      const recentDataQuery = await db
        .select({ count: count() })
        .from(playerWeekFacts)
        .where(
          and(
            eq(playerWeekFacts.season, season),
            eq(playerWeekFacts.week, week)
          )
        );
      
      const recordCount = recentDataQuery[0]?.count || 0;
      
      if (recordCount === 0) {
        const warningMsg = `⚠️ No player week facts found for Season ${season}, Week ${week}. Buys/Sells computation may use stale data.`;
        console.warn(warningMsg);
        // Continue processing but log the warning
      } else {
        console.log(`✓ Found ${recordCount} player records for current week`);
      }
      
    } catch (error) {
      console.warn('⚠️ Could not verify player data freshness:', error);
      // Continue processing despite verification failure
    }
  }

  /**
   * Generate summary statistics after processing
   */
  private async generateSummaryStats(season: number, week: number): Promise<void> {
    console.log('📈 Generating summary statistics...');
    
    try {
      const { buysSells } = await import('@shared/schema');
      const { count, avg } = await import('drizzle-orm');
      const { eq, and, sql } = await import('drizzle-orm');
      
      // Get total recommendations count
      const totalQuery = await db
        .select({ count: count() })
        .from(buysSells)
        .where(
          and(
            eq(buysSells.season, season),
            eq(buysSells.week, week)
          )
        );
      
      // Get average confidence score
      const avgConfidenceQuery = await db
        .select({ avgConfidence: avg(buysSells.confidence) })
        .from(buysSells)
        .where(
          and(
            eq(buysSells.season, season),
            eq(buysSells.week, week)
          )
        );
      
      // Get verdict distribution
      const verdictDistQuery = await db
        .select({
          verdict: buysSells.verdict,
          count: count()
        })
        .from(buysSells)
        .where(
          and(
            eq(buysSells.season, season),
            eq(buysSells.week, week)
          )
        )
        .groupBy(buysSells.verdict);
      
      const totalRecommendations = totalQuery[0]?.count || 0;
      const avgConfidence = avgConfidenceQuery[0]?.avgConfidence || 0;
      
      console.log(`📊 Summary for Week ${week}:`);
      console.log(`   Total Recommendations: ${totalRecommendations}`);
      console.log(`   Average Confidence: ${Number(avgConfidence).toFixed(3)}`);
      console.log(`   Verdict Distribution:`);
      
      for (const row of verdictDistQuery) {
        console.log(`      ${row.verdict}: ${row.count}`);
      }
      
    } catch (error) {
      console.warn('⚠️ Could not generate summary statistics:', error);
    }
  }

  /**
   * Manual trigger for processing a specific week
   */
  async processSpecificWeek(week: number, season: number = this.CURRENT_SEASON): Promise<ProcessingResult> {
    console.log(`🎯 Manual trigger: Processing Week ${week}, Season ${season}`);
    
    const startTime = Date.now();
    const result: ProcessingResult = {
      week,
      season,
      totalRecords: 0,
      positionsProcessed: [],
      formatsProcessed: [],
      errors: [],
      duration: 0
    };

    try {
      // Use the batch function for specific week processing
      await computeBuysSellsForAllPositions(week, season);
      
      // Generate summary stats
      await this.generateSummaryStats(week, season);
      
      result.duration = Date.now() - startTime;
      console.log(`✅ Manual processing completed for Week ${week} in ${result.duration}ms`);
      
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);
      result.duration = Date.now() - startTime;
      
      console.error(`❌ Manual processing failed for Week ${week}:`, error);
      throw error;
    }
  }

  /**
   * Health check for the processing system
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details: any }> {
    try {
      const currentWeek = parseInt(getCurrentNFLWeek());
      const season = this.CURRENT_SEASON;
      
      // Check if we have recent recommendations
      const { buysSells } = await import('@shared/schema');
      const { count } = await import('drizzle-orm');
      const { eq, and, gte } = await import('drizzle-orm');
      
      const recentRecsQuery = await db
        .select({ count: count() })
        .from(buysSells)
        .where(
          and(
            eq(buysSells.season, season),
            gte(buysSells.week, currentWeek - 1) // Check current and previous week
          )
        );
      
      const recentCount = recentRecsQuery[0]?.count || 0;
      
      if (recentCount === 0) {
        return {
          status: 'unhealthy',
          details: {
            message: 'No recent Buys/Sells recommendations found',
            currentWeek,
            season,
            recentCount
          }
        };
      } else if (recentCount < 100) { // Expect at least 100 recommendations per week
        return {
          status: 'degraded',
          details: {
            message: 'Low number of recent recommendations',
            currentWeek,
            season,
            recentCount
          }
        };
      } else {
        return {
          status: 'healthy',
          details: {
            message: 'Buys/Sells processing system is healthy',
            currentWeek,
            season,
            recentCount
          }
        };
      }
      
    } catch (error) {
      return {
        status: 'unhealthy',
        details: {
          message: 'Health check failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
}

// Export singleton instance for use in cron jobs and API endpoints
export const nightlyBuysSellsETL = new NightlyBuysSellsETL();