/**
 * RB EPA Context Check Service
 * Calculates adjusted EPA for RBs using position-specific context metrics
 * Similar to QB sanity check but with RB-relevant factors
 */

import { db } from '../infra/db';
import { rbContextMetrics, rbEpaAdjusted } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export class RBContextCheckService {
  /**
   * Call Python RB context processor to calculate metrics
   */
  async calculateRbContextMetrics(season: number = 2024): Promise<any> {
    console.log(`🏃 [RB Context] Calculating RB context metrics for ${season}...`);
    
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const { stdout, stderr } = await execAsync(
        `python3 server/rbContextProcessor.py ${season}`,
        { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
      );
      
      if (stderr && !stderr.includes('FutureWarning') && !stderr.includes('Loading play-by-play')) {
        console.warn('⚠️  Python stderr:', stderr);
      }
      
      const result = JSON.parse(stdout);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      console.log(`✅ [RB Context] Calculated metrics for ${result.rb_context.length} RBs`);
      return result;
      
    } catch (error: any) {
      console.error(`❌ [RB Context] Failed to calculate metrics:`, error.message);
      throw error;
    }
  }

  /**
   * Store RB context metrics in database
   * Idempotent - clears existing data before storing
   */
  async storeRbContextMetrics(season: number = 2024): Promise<void> {
    console.log(`💾 [RB Context] Storing RB context metrics for ${season}...`);
    
    // Calculate metrics from Python processor
    const result = await this.calculateRbContextMetrics(season);
    const contextData = result.rb_context || [];
    
    // Clear existing data for idempotency
    await db.delete(rbContextMetrics).where(eq(rbContextMetrics.season, season));
    console.log(`🗑️  [RB Context] Cleared existing ${season} data`);
    
    // Store each RB's context metrics
    for (const rb of contextData) {
      try {
        await db.insert(rbContextMetrics).values({
          playerId: rb.player_id,
          playerName: rb.player_name,
          season: rb.season,
          week: null, // Season totals
          rushAttempts: rb.rush_attempts,
          boxCount8Plus: rb.box_count_8_plus,
          boxCountRate: rb.box_count_rate,
          yardsBeforeContact: rb.yards_before_contact,
          yardsAfterContact: rb.yards_after_contact,
          ybcRate: rb.ybc_rate,
          brokenTackles: rb.broken_tackles,
          brokenTackleRate: rb.broken_tackle_rate,
          targets: rb.targets,
          receptions: rb.receptions,
          targetShare: rb.target_share,
          glCarries: rb.gl_carries,
          glTouchdowns: rb.gl_touchdowns,
          glConversionRate: rb.gl_conversion_rate,
          avgDefEpaFaced: rb.avg_def_epa_faced,
          calculatedAt: new Date(),
        }).onConflictDoUpdate({
          target: [rbContextMetrics.playerId, rbContextMetrics.season, rbContextMetrics.week],
          set: {
            rushAttempts: rb.rush_attempts,
            boxCount8Plus: rb.box_count_8_plus,
            boxCountRate: rb.box_count_rate,
            yardsBeforeContact: rb.yards_before_contact,
            yardsAfterContact: rb.yards_after_contact,
            ybcRate: rb.ybc_rate,
            brokenTackles: rb.broken_tackles,
            brokenTackleRate: rb.broken_tackle_rate,
            targets: rb.targets,
            receptions: rb.receptions,
            targetShare: rb.target_share,
            glCarries: rb.gl_carries,
            glTouchdowns: rb.gl_touchdowns,
            glConversionRate: rb.gl_conversion_rate,
            avgDefEpaFaced: rb.avg_def_epa_faced,
            calculatedAt: new Date(),
          },
        });
      } catch (error) {
        console.warn(`⚠️  Failed to store context for ${rb.player_name}:`, error);
      }
    }
    
    console.log(`✅ [RB Context] Stored ${contextData.length} RB context records`);
  }

  /**
   * Calculate Tiber Adjusted EPA for RBs using context metrics
   * 
   * Formula uses RB-specific factors:
   * Adjusted EPA = Raw EPA + (box_count_adj + ybc_adj + broken_tackle_adj + target_share_adj + gl_adj + def_adj)
   * 
   * Note: Idempotent - clears existing data before recalculation
   */
  async calculateTiberAdjustedEpa(season: number = 2024): Promise<void> {
    console.log(`📊 [Tiber RB EPA] Calculating adjusted EPA for ${season}...`);
    
    // Clear existing data for idempotency
    await db.delete(rbEpaAdjusted).where(eq(rbEpaAdjusted.season, season));
    console.log(`🗑️  [Tiber RB EPA] Cleared existing ${season} data for fresh calculation`);
    
    // Get all RBs with context metrics
    const rbsWithContext = await db
      .select()
      .from(rbContextMetrics)
      .where(eq(rbContextMetrics.season, season));
    
    console.log(`🔍 [Tiber RB EPA] Found ${rbsWithContext.length} RBs with context metrics`);
    
    // Get raw EPA from Python processor (separate call for EPA data)
    let rbEpaData: any[] = [];
    try {
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const { stdout } = await execAsync(
        `python3 server/epaProcessor.py ${season}`,
        { maxBuffer: 10 * 1024 * 1024 }
      );
      
      const result = JSON.parse(stdout);
      rbEpaData = result.rb_epa || [];
    } catch (error) {
      console.error(`❌ [Tiber RB EPA] Failed to get EPA data:`, error);
      return;
    }
    
    let successCount = 0;
    let failCount = 0;
    
    for (const rb of rbsWithContext) {
      try {
        // Find corresponding EPA data
        const epaData = rbEpaData.find(e => e.rusher_player_id === rb.playerId);
        
        if (!epaData) {
          console.warn(`⚠️  No EPA data found for ${rb.playerName}, skipping`);
          continue;
        }
        
        const rawEpa = epaData.rush_epa_per_play;
        
        // Calculate adjustments based on RB context
        // League averages (estimated from 2024 season data)
        const LEAGUE_AVG_BOX_COUNT_RATE = 0.35;  // ~35% of carries vs 8+ defenders
        const LEAGUE_AVG_YBC = 2.1;  // Average yards before contact
        const LEAGUE_AVG_BROKEN_TACKLE_RATE = 0.06;  // ~6% broken tackle rate
        const LEAGUE_AVG_TARGET_SHARE = 0.08;  // ~8% of team targets for RBs
        const LEAGUE_AVG_GL_CONVERSION = 0.45;  // ~45% TD rate on goal line carries
        const LEAGUE_AVG_DEF_EPA = 0.02;  // Similar to QB baseline
        
        // Calculate deviations from league average
        const boxCountDeviation = (rb.boxCountRate || LEAGUE_AVG_BOX_COUNT_RATE) - LEAGUE_AVG_BOX_COUNT_RATE;
        const ybcDeviation = (rb.yardsBeforeContact || LEAGUE_AVG_YBC) - LEAGUE_AVG_YBC;
        const brokenTackleDeviation = (rb.brokenTackleRate || LEAGUE_AVG_BROKEN_TACKLE_RATE) - LEAGUE_AVG_BROKEN_TACKLE_RATE;
        const targetShareDeviation = (rb.targetShare || LEAGUE_AVG_TARGET_SHARE) - LEAGUE_AVG_TARGET_SHARE;
        const glConversionDeviation = (rb.glConversionRate || LEAGUE_AVG_GL_CONVERSION) - LEAGUE_AVG_GL_CONVERSION;
        const defDeviation = (rb.avgDefEpaFaced || LEAGUE_AVG_DEF_EPA) - LEAGUE_AVG_DEF_EPA;
        
        // Calibrated weights for RB adjustments
        // Higher box count = harder to run = boost EPA
        const boxCountAdjustment = boxCountDeviation * 0.8;
        
        // Lower YBC = worse O-line = boost EPA  
        const ybcAdjustment = ybcDeviation * -0.05;
        
        // Higher broken tackles = individual talent masking opportunity = reduce EPA boost
        const brokenTackleAdjustment = brokenTackleDeviation * -1.2;
        
        // Lower target share = less receiving help = could indicate rushing-focused back
        const targetShareAdjustment = targetShareDeviation * 0.3;
        
        // Lower GL conversion = worse TD luck/opportunity = boost EPA
        const glAdjustment = glConversionDeviation * -0.4;
        
        // Tougher defenses faced = boost EPA
        const defAdjustment = defDeviation * -1.0;
        
        const totalAdjustment = boxCountAdjustment + ybcAdjustment + brokenTackleAdjustment + 
                                targetShareAdjustment + glAdjustment + defAdjustment;
        const adjEpa = rawEpa + totalAdjustment;
        
        await db.insert(rbEpaAdjusted).values({
          playerId: rb.playerId,
          playerName: rb.playerName,
          season: rb.season,
          week: null,
          rawEpaPerPlay: rawEpa,
          tiberAdjEpaPerPlay: adjEpa,
          tiberEpaDiff: totalAdjustment,
          boxCountAdjustment,
          ybcAdjustment,
          brokenTackleAdjustment,
          targetShareAdjustment,
          glAdjustment,
          defenseAdjustment: defAdjustment,
        }).onConflictDoUpdate({
          target: [rbEpaAdjusted.playerId, rbEpaAdjusted.season, rbEpaAdjusted.week],
          set: {
            rawEpaPerPlay: rawEpa,
            tiberAdjEpaPerPlay: adjEpa,
            tiberEpaDiff: totalAdjustment,
            boxCountAdjustment,
            ybcAdjustment,
            brokenTackleAdjustment,
            targetShareAdjustment,
            glAdjustment,
            defenseAdjustment: defAdjustment,
            calculatedAt: new Date(),
          },
        });
        
        console.log(`✅ [Tiber RB EPA] ${rb.playerName}: Raw=${rawEpa.toFixed(3)}, Adj=${adjEpa.toFixed(3)} (Δ${totalAdjustment.toFixed(3)})`);
        successCount++;
        
      } catch (error: any) {
        failCount++;
        console.error(`❌ [Tiber RB EPA] Failed to insert ${rb.playerName}:`, error?.message || error);
      }
    }
    
    console.log(`📊 [Tiber RB EPA] Summary: ${successCount} successful, ${failCount} failed out of ${rbsWithContext.length} total`);
  }

  /**
   * Get RB context comparison data for display
   * Returns RBs with raw EPA, adjusted EPA, and context breakdowns
   */
  async getRbContextComparison(season: number = 2024): Promise<{
    comparisons: any[];
    summary: {
      totalRbs: number;
      avgRawEpa: number;
      avgAdjEpa: number;
      avgDifference: number;
    };
    dataQuality: {
      contextLastCalculated: Date | null;
      adjustedLastCalculated: Date | null;
      hasDuplicates: boolean;
      isStale: boolean;
    };
  }> {
    console.log(`🔬 [RB Compare] Getting RB context comparison for ${season}...`);
    
    // Get context metrics
    const contextData = await db
      .select()
      .from(rbContextMetrics)
      .where(eq(rbContextMetrics.season, season));
    
    // Get adjusted EPA
    const adjustedData = await db
      .select()
      .from(rbEpaAdjusted)
      .where(eq(rbEpaAdjusted.season, season));
    
    // Check data quality
    const uniquePlayerIds = new Set(adjustedData.map(a => a.playerId));
    const hasDuplicates = uniquePlayerIds.size !== adjustedData.length;
    
    const contextFreshness = contextData.length > 0
      ? contextData.reduce((latest, curr) => 
          curr.calculatedAt && (!latest || curr.calculatedAt > latest) ? curr.calculatedAt : latest,
          null as Date | null
        )
      : null;
    
    const adjustedFreshness = adjustedData.length > 0
      ? adjustedData.reduce((latest, curr) =>
          curr.calculatedAt && (!latest || curr.calculatedAt > latest) ? curr.calculatedAt : latest,
          null as Date | null
        )
      : null;
    
    // Check if data is stale (>24 hours old)
    const now = new Date();
    const isStale = !adjustedFreshness || (now.getTime() - adjustedFreshness.getTime()) > 24 * 60 * 60 * 1000;
    
    // Build comparisons
    const comparisons = adjustedData.map(adj => {
      const context = contextData.find(c => c.playerId === adj.playerId);
      
      return {
        playerId: adj.playerId,
        playerName: adj.playerName,
        rawEpa: adj.rawEpaPerPlay,
        adjustedEpa: adj.tiberAdjEpaPerPlay,
        totalAdjustment: adj.tiberEpaDiff,
        adjustments: {
          boxCount: adj.boxCountAdjustment,
          ybc: adj.ybcAdjustment,
          brokenTackle: adj.brokenTackleAdjustment,
          targetShare: adj.targetShareAdjustment,
          goalLine: adj.glAdjustment,
          defense: adj.defenseAdjustment,
        },
        context: context ? {
          rushAttempts: context.rushAttempts,
          boxCountRate: context.boxCountRate,
          yardsBeforeContact: context.yardsBeforeContact,
          brokenTackleRate: context.brokenTackleRate,
          targetShare: context.targetShare,
          glConversionRate: context.glConversionRate,
        } : null,
      };
    });
    
    // Calculate summary stats
    const totalRbs = comparisons.length;
    const avgRawEpa = comparisons.reduce((sum, c) => sum + (c.rawEpa || 0), 0) / totalRbs;
    const avgAdjEpa = comparisons.reduce((sum, c) => sum + (c.adjustedEpa || 0), 0) / totalRbs;
    const avgDifference = comparisons.reduce((sum, c) => sum + Math.abs(c.totalAdjustment || 0), 0) / totalRbs;
    
    return {
      comparisons,
      summary: {
        totalRbs,
        avgRawEpa: parseFloat(avgRawEpa.toFixed(3)),
        avgAdjEpa: parseFloat(avgAdjEpa.toFixed(3)),
        avgDifference: parseFloat(avgDifference.toFixed(3)),
      },
      dataQuality: {
        contextLastCalculated: contextFreshness,
        adjustedLastCalculated: adjustedFreshness,
        hasDuplicates,
        isStale,
      },
    };
  }

  /**
   * Run full RB context check workflow
   */
  async runFullRbContextCheck(season: number = 2024): Promise<void> {
    console.log(`🚀 [RB Context] Running full RB context check workflow for ${season}...`);
    
    try {
      // Step 1: Calculate and store context metrics
      await this.storeRbContextMetrics(season);
      
      // Step 2: Calculate adjusted EPA
      await this.calculateTiberAdjustedEpa(season);
      
      console.log(`✅ [RB Context] Full workflow completed successfully`);
    } catch (error: any) {
      console.error(`❌ [RB Context] Workflow failed:`, error.message);
      throw error;
    }
  }
}

// Export singleton instance
export const rbContextCheckService = new RBContextCheckService();
