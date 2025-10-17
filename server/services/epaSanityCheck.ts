/**
 * EPA Sanity Check Service
 * Validates our EPA calculations against Ben Baldwin's adjusted EPA methodology
 */

import { db } from '../db';
import { qbEpaReference, qbContextMetrics, qbEpaAdjusted } from '@shared/schema';
import { eq, and, sql as rawSql } from 'drizzle-orm';

// Ben Baldwin's Adjusted EPA data (2025-10-15 publication)
// Source: @benbbaldwin on X/Twitter
const BALDWIN_EPA_2025 = [
  { rank: 1, playerName: 'S. Darnold', team: 'MIN', n: 181, rawEpa: 0.37, adjEpa: 0.41, diff: 0.04 },
  { rank: 2, playerName: 'D. Prescott', team: 'DAL', n: 261, rawEpa: 0.30, adjEpa: 0.41, diff: 0.11 },
  { rank: 3, playerName: 'J. Goff', team: 'DET', n: 194, rawEpa: 0.29, adjEpa: 0.32, diff: 0.03 },
  { rank: 4, playerName: 'J. Love', team: 'GB', n: 183, rawEpa: 0.28, adjEpa: 0.32, diff: 0.04 },
  { rank: 5, playerName: 'D. Jones', team: 'IND', n: 225, rawEpa: 0.31, adjEpa: 0.27, diff: -0.04 },
  { rank: 6, playerName: 'D. Maye', team: 'NE', n: 241, rawEpa: 0.33, adjEpa: 0.26, diff: -0.07 },
  { rank: 7, playerName: 'B. Mayfield', team: 'TB', n: 242, rawEpa: 0.29, adjEpa: 0.25, diff: -0.04 },
  { rank: 8, playerName: 'L. Jackson', team: 'BAL', n: 139, rawEpa: 0.27, adjEpa: 0.23, diff: -0.04 },
  { rank: 9, playerName: 'S. Rattler', team: 'NO', n: 258, rawEpa: 0.00, adjEpa: 0.15, diff: 0.15 },
  { rank: 10, playerName: 'J. Herbert', team: 'LAC', n: 266, rawEpa: 0.08, adjEpa: 0.20, diff: 0.12 },
  { rank: 11, playerName: 'M. Stafford', team: 'LAR', n: 238, rawEpa: 0.12, adjEpa: 0.17, diff: 0.05 },
  { rank: 12, playerName: 'C. Stroud', team: 'HOU', n: 186, rawEpa: 0.20, adjEpa: 0.24, diff: 0.04 },
  { rank: 13, playerName: 'P. Mahomes', team: 'KC', n: 273, rawEpa: 0.17, adjEpa: 0.20, diff: 0.03 },
  { rank: 14, playerName: 'J. Allen', team: 'BUF', n: 247, rawEpa: 0.22, adjEpa: 0.17, diff: -0.05 },
  { rank: 15, playerName: 'J. Daniels', team: 'WAS', n: 181, rawEpa: 0.13, adjEpa: 0.16, diff: 0.03 },
  { rank: 16, playerName: 'J. Dart', team: 'NYG', n: 131, rawEpa: 0.08, adjEpa: 0.15, diff: 0.07 },
  { rank: 17, playerName: 'T. Tagovailoa', team: 'MIA', n: 218, rawEpa: 0.05, adjEpa: 0.15, diff: 0.10 },
  { rank: 18, playerName: 'T. Lawrence', team: 'JAX', n: 257, rawEpa: 0.07, adjEpa: 0.12, diff: 0.05 },
  { rank: 19, playerName: 'J. Flacco', team: 'NYJ', n: 236, rawEpa: -0.20, adjEpa: 0.11, diff: 0.31 },
  { rank: 20, playerName: 'M. Jones', team: 'LV', n: 197, rawEpa: 0.10, adjEpa: 0.11, diff: 0.01 },
  { rank: 21, playerName: 'A. Rodgers', team: 'PIT', n: 159, rawEpa: 0.16, adjEpa: 0.10, diff: -0.05 },
  { rank: 22, playerName: 'J. Hurts', team: 'PHI', n: 244, rawEpa: 0.09, adjEpa: 0.10, diff: 0.01 },
  { rank: 23, playerName: 'K. Murray', team: 'ARI', n: 221, rawEpa: 0.09, adjEpa: 0.09, diff: 0.00 },
  { rank: 24, playerName: 'B. Young', team: 'CAR', n: 239, rawEpa: -0.02, adjEpa: 0.08, diff: 0.10 },
  { rank: 25, playerName: 'C. Wentz', team: 'MIN', n: 126, rawEpa: 0.17, adjEpa: 0.08, diff: -0.10 },
  { rank: 26, playerName: 'R. Wilson', team: 'NYG', n: 147, rawEpa: 0.00, adjEpa: 0.08, diff: 0.08 },
  { rank: 27, playerName: 'J. Browning', team: 'CIN', n: 155, rawEpa: -0.14, adjEpa: 0.07, diff: 0.21 },
  { rank: 28, playerName: 'M. Penix', team: 'ATL', n: 183, rawEpa: 0.10, adjEpa: 0.07, diff: -0.03 },
  { rank: 29, playerName: 'J. Fields', team: 'NYJ', n: 192, rawEpa: -0.03, adjEpa: 0.05, diff: 0.08 },
  { rank: 30, playerName: 'D. Gabriel', team: 'CLE', n: 105, rawEpa: -0.10, adjEpa: 0.02, diff: 0.12 },
  { rank: 31, playerName: 'B. Nix', team: 'DEN', n: 255, rawEpa: -0.08, adjEpa: -0.01, diff: 0.09 },
  { rank: 32, playerName: 'G. Smith', team: 'SEA', n: 231, rawEpa: -0.01, adjEpa: -0.02, diff: -0.01 },
  { rank: 33, playerName: 'C. Ward', team: 'PIT', n: 252, rawEpa: -0.22, adjEpa: -0.02, diff: 0.20 },
  { rank: 34, playerName: 'C. Williams', team: 'CHI', n: 210, rawEpa: 0.03, adjEpa: -0.05, diff: -0.08 },
];

// Player ID mapping (abbreviated name -> NFLfastR ID)
const PLAYER_ID_MAP: Record<string, string> = {
  'S. Darnold': '00-0034869',
  'D. Prescott': '00-0033077',
  'J. Goff': '00-0033106',
  'J. Love': '00-0036264',
  'D. Jones': '00-0035710',
  'D. Maye': '00-0039851',
  'B. Mayfield': '00-0034855',
  'L. Jackson': '00-0034796',
  'S. Rattler': '00-0039376',
  'J. Herbert': '00-0036355',
  'M. Stafford': '00-0026498',
  'C. Stroud': '00-0039163',
  'P. Mahomes': '00-0033873',
  'J. Allen': '00-0034857',
  'J. Daniels': '00-0039910',
  'T. Tagovailoa': '00-0036212',
  'T. Lawrence': '00-0036971',
  'J. Flacco': '00-0026158',
  'M. Jones': '00-0036972',
  'A. Rodgers': '00-0023459',
  'J. Hurts': '00-0036389',
  'K. Murray': '00-0035228',
  'B. Young': '00-0039150',
  'C. Wentz': '00-0032950',
  'R. Wilson': '00-0029263',
  'J. Browning': '00-0035100',
  'M. Penix': '00-0039917',
  'J. Fields': '00-0036945',
  'B. Nix': '00-0039732',
  'G. Smith': '00-0030565',
  'C. Ward': '00-0040676',
  'C. Williams': '00-0039918',
};

export class EPASanityCheckService {
  /**
   * Seed Ben Baldwin's reference data for 2025 season
   */
  async seedBaldwinReferenceData(): Promise<void> {
    console.log('🔧 [EPA Sanity] Seeding Ben Baldwin reference data (2025)...');
    
    const dataDate = new Date('2025-10-15');
    const season = 2025;
    
    for (const qb of BALDWIN_EPA_2025) {
      const playerId = PLAYER_ID_MAP[qb.playerName] || null;
      
      try {
        await db.insert(qbEpaReference).values({
          playerId,
          playerName: qb.playerName,
          team: qb.team,
          season,
          week: null, // Season totals
          numPlays: qb.n,
          rawEpaPerPlay: qb.rawEpa,
          adjEpaPerPlay: qb.adjEpa,
          epaDiff: qb.diff,
          source: 'ben_baldwin',
          dataDate,
        }).onConflictDoUpdate({
          target: [qbEpaReference.playerId, qbEpaReference.season, qbEpaReference.week],
          set: {
            rawEpaPerPlay: qb.rawEpa,
            adjEpaPerPlay: qb.adjEpa,
            epaDiff: qb.diff,
            numPlays: qb.n,
          },
        });
      } catch (error) {
        console.warn(`⚠️  Failed to insert ${qb.playerName}:`, error);
      }
    }
    
    console.log(`✅ [EPA Sanity] Seeded ${BALDWIN_EPA_2025.length} QB reference records`);
  }

  /**
   * Get Ben Baldwin's reference data for a specific QB
   */
  async getBaldwinReference(playerId: string, season: number = 2025): Promise<any> {
    const result = await db
      .select()
      .from(qbEpaReference)
      .where(
        and(
          eq(qbEpaReference.playerId, playerId),
          eq(qbEpaReference.season, season)
        )
      )
      .limit(1);
    
    return result[0] || null;
  }

  /**
   * Get all Ben Baldwin reference data for comparison
   */
  async getAllBaldwinReference(season: number = 2025): Promise<any[]> {
    return await db
      .select()
      .from(qbEpaReference)
      .where(eq(qbEpaReference.season, season))
      .orderBy(qbEpaReference.adjEpaPerPlay);
  }

  /**
   * Call Python EPA processor to calculate QB context metrics
   */
  async calculateQbContextMetrics(season: number = 2025): Promise<any> {
    console.log(`🔬 [EPA Context] Calculating QB context metrics for ${season}...`);
    
    try {
      // Execute Python EPA processor
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const { stdout, stderr } = await execAsync(
        `python3 server/epaProcessor.py context ${season}`,
        { maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
      );
      
      if (stderr && !stderr.includes('FutureWarning')) {
        console.warn('⚠️  Python stderr:', stderr);
      }
      
      const result = JSON.parse(stdout);
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      console.log(`✅ [EPA Context] Calculated metrics for ${result.qb_context?.length || 0} QBs`);
      return result;
      
    } catch (error: any) {
      console.error('❌ [EPA Context] Calculation failed:', error);
      throw error;
    }
  }

  /**
   * Store QB context metrics in database
   */
  async storeQbContextMetrics(contextData: any[]): Promise<void> {
    console.log(`💾 [EPA Context] Storing ${contextData.length} QB context records...`);
    
    for (const qb of contextData) {
      try {
        await db.insert(qbContextMetrics).values({
          playerId: qb.player_id,
          playerName: qb.player_name,
          season: qb.season,
          week: null, // Season totals
          passAttempts: qb.pass_attempts,
          drops: qb.drops,
          dropRate: qb.drop_rate,
          pressures: qb.pressures,
          pressureRate: qb.pressure_rate,
          sacks: qb.sacks,
          sackRate: qb.sack_rate,
          totalYac: qb.total_yac_epa,
          expectedYac: qb.expected_yac_epa,
          yacDelta: qb.yac_delta,
          avgDefEpaFaced: qb.avg_def_epa_faced,
          interceptablePasses: qb.interceptable_passes,
          droppedInterceptions: null, // TODO: Calculate from play-by-play
        }).onConflictDoUpdate({
          target: [qbContextMetrics.playerId, qbContextMetrics.season, qbContextMetrics.week],
          set: {
            passAttempts: qb.pass_attempts,
            drops: qb.drops,
            dropRate: qb.drop_rate,
            pressures: qb.pressures,
            pressureRate: qb.pressure_rate,
            sacks: qb.sacks,
            sackRate: qb.sack_rate,
            totalYac: qb.total_yac_epa,
            expectedYac: qb.expected_yac_epa,
            yacDelta: qb.yac_delta,
            avgDefEpaFaced: qb.avg_def_epa_faced,
            calculatedAt: new Date(),
          },
        });
      } catch (error) {
        console.warn(`⚠️  Failed to store context for ${qb.player_name}:`, error);
      }
    }
    
    console.log(`✅ [EPA Context] Stored ${contextData.length} QB context records`);
  }

  /**
   * Calculate league averages from Baldwin's reference QBs only
   * Critical: Must use same population as Baldwin to avoid baseline pollution
   */
  private async calculateLeagueAverages(season: number = 2025): Promise<{
    dropRate: number;
    pressureRate: number;
    yacPerPlay: number;
    defEpa: number;
  }> {
    // Get Baldwin reference QBs to filter population
    const baldwinReference = await this.getAllBaldwinReference(season);
    const baldwinPlayerIds = baldwinReference.map(b => b.playerId).filter(id => id);
    
    // Get context metrics for Baldwin's QBs only (avoid backup QB pollution)
    const baldwinQbContext = await db
      .select()
      .from(qbContextMetrics)
      .where(
        and(
          eq(qbContextMetrics.season, season),
          rawSql`${qbContextMetrics.playerId} IN (${baldwinPlayerIds.map(id => `'${id}'`).join(',')})`
        )
      );
    
    if (baldwinQbContext.length === 0) {
      console.warn('⚠️  No context metrics found for Baldwin QBs, using fallback averages');
      return {
        dropRate: 0.0203,
        pressureRate: 0.2155,
        yacPerPlay: -0.6691,
        defEpa: 0.0222
      };
    }
    
    // Calculate weighted averages based on attempts (more attempts = more weight)
    const totalAttempts = baldwinQbContext.reduce((sum, qb) => sum + (qb.passAttempts || 0), 0);
    
    const avgDropRate = baldwinQbContext.reduce((sum, qb) => 
      sum + (qb.dropRate || 0) * (qb.passAttempts || 0), 0
    ) / totalAttempts;
    
    const avgPressureRate = baldwinQbContext.reduce((sum, qb) => 
      sum + (qb.pressureRate || 0) * (qb.passAttempts || 0), 0
    ) / totalAttempts;
    
    const avgYacPerPlay = baldwinQbContext.reduce((sum, qb) => {
      const yacPerPlay = (qb.yacDelta || 0) / (qb.passAttempts || 1);
      return sum + yacPerPlay * (qb.passAttempts || 0);
    }, 0) / totalAttempts;
    
    const avgDefEpa = baldwinQbContext.reduce((sum, qb) => 
      sum + (qb.avgDefEpaFaced || 0) * (qb.passAttempts || 0), 0
    ) / totalAttempts;
    
    console.log(`📊 [League Avg] Calculated from ${baldwinQbContext.length} Baldwin QBs (${totalAttempts} attempts):`);
    console.log(`   Drop Rate: ${avgDropRate.toFixed(4)} (was 0.0203)`);
    console.log(`   Pressure Rate: ${avgPressureRate.toFixed(4)} (was 0.2155)`);
    console.log(`   YAC/Play: ${avgYacPerPlay.toFixed(4)} (was -0.6691)`);
    console.log(`   Def EPA: ${avgDefEpa.toFixed(4)} (was 0.0222)`);
    
    return {
      dropRate: avgDropRate,
      pressureRate: avgPressureRate,
      yacPerPlay: avgYacPerPlay,
      defEpa: avgDefEpa
    };
  }

  /**
   * Calculate Tiber Adjusted EPA using context metrics
   * 
   * Formula mirrors Ben Baldwin's methodology:
   * Adjusted EPA = Raw EPA + (drop_adjustment + pressure_adjustment + yac_adjustment + def_adjustment)
   * 
   * Note: Idempotent - clears existing data before recalculation
   */
  async calculateTiberAdjustedEpa(season: number = 2025): Promise<void> {
    console.log(`📊 [Tiber EPA] Calculating adjusted EPA for ${season}...`);
    
    // Clear existing data for idempotency (prevents duplicates from repeated runs)
    await db.delete(qbEpaAdjusted).where(eq(qbEpaAdjusted.season, season));
    console.log(`🗑️  [Tiber EPA] Cleared existing ${season} data for fresh calculation`);
    
    // Get all QBs with context metrics
    const qbsWithContext = await db
      .select()
      .from(qbContextMetrics)
      .where(eq(qbContextMetrics.season, season));
    
    // Get Baldwin reference data for raw EPA
    const baldwinReference = await this.getAllBaldwinReference(season);
    
    // Calculate league averages dynamically from Baldwin's QBs only
    const leagueAvg = await this.calculateLeagueAverages(season);
    
    console.log(`🔍 [Tiber EPA] Found ${qbsWithContext.length} QBs with context metrics`);
    console.log(`🔍 [Tiber EPA] Found ${baldwinReference.length} Baldwin reference QBs`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const qb of qbsWithContext) {
      try {
        // Find corresponding Baldwin reference for raw EPA
        const baldwinData = baldwinReference.find(b => b.playerId === qb.playerId);
        
        if (!baldwinData) {
          console.warn(`⚠️  No Baldwin reference found for ${qb.playerName}, skipping`);
          continue;
        }
        
        const rawEpa = baldwinData.rawEpaPerPlay;
        
        // Normalize YAC delta to per-play value
        const yacDeltaPerPlay = (qb.yacDelta || 0) / (qb.passAttempts || 1);
        
        // Calculate deviations from league average (now dynamic, not hardcoded)
        const dropDeviation = (qb.dropRate || 0) - leagueAvg.dropRate;
        const pressureDeviation = (qb.pressureRate || 0) - leagueAvg.pressureRate;
        const yacDeviation = yacDeltaPerPlay - leagueAvg.yacPerPlay;
        const defDeviation = (qb.avgDefEpaFaced || 0) - leagueAvg.defEpa;
        
        // Calibrated weights (tuned to match Baldwin's reference adjustments)
        const dropAdjustment = dropDeviation * 4.5;  // Above avg drops = unlucky = boost EPA
        const pressureAdjustment = pressureDeviation * 1.8;  // Above avg pressure = boost EPA
        const yacAdjustment = yacDeviation * -0.75;  // Below avg YAC help = boost EPA
        const defAdjustment = defDeviation * -1.0;  // Tougher defenses = boost EPA
        
        const totalAdjustment = dropAdjustment + pressureAdjustment + yacAdjustment + defAdjustment;
        const adjEpa = rawEpa + totalAdjustment;
        
        console.log(`🔍 [Tiber EPA] Attempting insert for ${qb.playerName} (${qb.playerId})`);
        
        await db.insert(qbEpaAdjusted).values({
          playerId: qb.playerId,
          playerName: qb.playerName,
          season: qb.season,
          week: null,
          rawEpaPerPlay: rawEpa,
          tiberAdjEpaPerPlay: adjEpa,
          tiberEpaDiff: totalAdjustment,
          dropAdjustment,
          pressureAdjustment,
          yacAdjustment,
          defenseAdjustment: defAdjustment,
        }).onConflictDoUpdate({
          target: [qbEpaAdjusted.playerId, qbEpaAdjusted.season, qbEpaAdjusted.week],
          set: {
            rawEpaPerPlay: rawEpa,
            tiberAdjEpaPerPlay: adjEpa,
            tiberEpaDiff: totalAdjustment,
            dropAdjustment,
            pressureAdjustment,
            yacAdjustment,
            defenseAdjustment: defAdjustment,
            calculatedAt: new Date(),
          },
        });
        
        console.log(`✅ [Tiber EPA] ${qb.playerName}: Raw=${rawEpa.toFixed(3)}, Adj=${adjEpa.toFixed(3)} (Δ${totalAdjustment.toFixed(3)})`);
        successCount++;
        
      } catch (error: any) {
        failCount++;
        console.error(`❌ [Tiber EPA] Failed to insert ${qb.playerName} (${qb.playerId}):`, error?.message || error);
        if (error?.constraint) {
          console.error(`   Constraint violation: ${error.constraint}`);
        }
      }
    }
    
    console.log(`📊 [Tiber EPA] Summary: ${successCount} successful, ${failCount} failed out of ${qbsWithContext.length} total`);
  }

  /**
   * Generate diagnostic breakdown for each QB
   * Shows raw metrics, deviations, individual adjustments, and Baldwin comparison
   */
  async getDiagnosticBreakdown(season: number = 2025): Promise<any[]> {
    console.log(`🔍 [Diagnostics] Generating QB diagnostic breakdown for ${season}...`);
    
    // Get all necessary data
    const baldwinReference = await this.getAllBaldwinReference(season);
    const qbContext = await db
      .select()
      .from(qbContextMetrics)
      .where(eq(qbContextMetrics.season, season));
    const tiberAdjusted = await db
      .select()
      .from(qbEpaAdjusted)
      .where(eq(qbEpaAdjusted.season, season));
    
    // Calculate league averages
    const leagueAvg = await this.calculateLeagueAverages(season);
    
    const diagnostics = [];
    
    for (const baldwin of baldwinReference) {
      const context = qbContext.find(c => c.playerId === baldwin.playerId);
      const tiber = tiberAdjusted.find(t => t.playerId === baldwin.playerId);
      
      if (!context || !tiber) {
        diagnostics.push({
          qbName: baldwin.playerName,
          playerId: baldwin.playerId,
          status: 'missing_data',
          hasContext: !!context,
          hasTiber: !!tiber
        });
        continue;
      }
      
      // Calculate YAC per play
      const yacDeltaPerPlay = (context.yacDelta || 0) / (context.passAttempts || 1);
      
      // Calculate deviations
      const dropDeviation = (context.dropRate || 0) - leagueAvg.dropRate;
      const pressureDeviation = (context.pressureRate || 0) - leagueAvg.pressureRate;
      const yacDeviation = yacDeltaPerPlay - leagueAvg.yacPerPlay;
      const defDeviation = (context.avgDefEpaFaced || 0) - leagueAvg.defEpa;
      
      // Calculate what Baldwin's implied adjustment was
      const baldwinImpliedAdj = (baldwin.adjEpaPerPlay || 0) - (baldwin.rawEpaPerPlay || 0);
      
      diagnostics.push({
        qbName: baldwin.playerName,
        playerId: baldwin.playerId,
        team: baldwin.team,
        attempts: context.passAttempts,
        
        // Raw EPA
        rawEPA: baldwin.rawEpaPerPlay,
        
        // Raw metrics
        rawMetrics: {
          dropRate: context.dropRate,
          pressureRate: context.pressureRate,
          yacDeltaPerPlay,
          defEpaFaced: context.avgDefEpaFaced
        },
        
        // League averages used
        leagueAverages: {
          dropRate: leagueAvg.dropRate,
          pressureRate: leagueAvg.pressureRate,
          yacPerPlay: leagueAvg.yacPerPlay,
          defEpa: leagueAvg.defEpa
        },
        
        // Deviations from average
        deviations: {
          drop: dropDeviation,
          pressure: pressureDeviation,
          yac: yacDeviation,
          defense: defDeviation
        },
        
        // Individual adjustments (with current weights)
        adjustments: {
          drop: tiber.dropAdjustment,
          pressure: tiber.pressureAdjustment,
          yac: tiber.yacAdjustment,
          defense: tiber.defenseAdjustment,
          total: tiber.tiberEpaDiff
        },
        
        // Baldwin comparison
        baldwin: {
          adjEPA: baldwin.adjEpaPerPlay,
          impliedAdjustment: baldwinImpliedAdj
        },
        
        // Tiber results
        tiber: {
          adjEPA: tiber.tiberAdjEpaPerPlay,
          totalAdjustment: tiber.tiberEpaDiff
        },
        
        // Final difference
        difference: (tiber.tiberAdjEpaPerPlay || 0) - (baldwin.adjEpaPerPlay || 0),
        adjustmentDiff: (tiber.tiberEpaDiff || 0) - baldwinImpliedAdj,
        
        // Flag large divergences
        largeDivergence: Math.abs((tiber.tiberAdjEpaPerPlay || 0) - (baldwin.adjEpaPerPlay || 0)) > 0.10
      });
    }
    
    console.log(`✅ [Diagnostics] Generated breakdown for ${diagnostics.length} QBs`);
    return diagnostics;
  }

  /**
   * Auto-calibrate EPA adjustment weights using linear regression
   * Finds optimal weights that minimize RMSE against Baldwin's reference
   */
  async calibrateWeights(season: number = 2025): Promise<any> {
    console.log(`🎯 [Calibration] Running auto-calibration for ${season}...`);
    
    try {
      // Get context metrics for Baldwin's QBs
      const baldwinReference = await this.getAllBaldwinReference(season);
      const baldwinPlayerIds = baldwinReference.map(b => b.playerId).filter(id => id);
      
      // Get ALL context metrics for this season, then filter in memory
      const allQbContext = await db
        .select()
        .from(qbContextMetrics)
        .where(eq(qbContextMetrics.season, season));
      
      // Filter for Baldwin QBs only
      const qbContext = allQbContext.filter(qb => 
        baldwinPlayerIds.includes(qb.playerId || '')
      );
      
      // Prepare data for Python calibration script
      const contextData = qbContext.map(qb => ({
        player_id: qb.playerId,
        player_name: qb.playerName,
        pass_attempts: qb.passAttempts,
        drop_rate: qb.dropRate,
        pressure_rate: qb.pressureRate,
        yac_delta: qb.yacDelta,
        avg_def_epa_faced: qb.avgDefEpaFaced
      }));
      
      const baldwinData = baldwinReference.map(b => ({
        player_id: b.playerId,
        player_name: b.playerName,
        raw_epa_per_play: b.rawEpaPerPlay,
        adj_epa_per_play: b.adjEpaPerPlay
      }));
      
      const inputData = {
        context_data: contextData,
        baldwin_data: baldwinData
      };
      
      // Execute Python calibration script
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      const inputJson = JSON.stringify(inputData);
      const { stdout, stderr } = await execAsync(
        `echo '${inputJson.replace(/'/g, "'\\''")}' | python3 server/calibrateEpaWeights.py`,
        { maxBuffer: 10 * 1024 * 1024 }
      );
      
      if (stderr && !stderr.includes('FutureWarning')) {
        console.log('📊 [Calibration] Python output:', stderr);
      }
      
      const result = JSON.parse(stdout);
      
      if (!result.success) {
        throw new Error(result.error || 'Calibration failed');
      }
      
      console.log(`✅ [Calibration] Optimal weights found:`);
      console.log(`   OLS: Drop=${result.calibration.ols.weights.drop.toFixed(3)}, Pressure=${result.calibration.ols.weights.pressure.toFixed(3)}, YAC=${result.calibration.ols.weights.yac.toFixed(3)}, Def=${result.calibration.ols.weights.defense.toFixed(3)}`);
      console.log(`   RMSE: ${result.calibration.ols.rmse.toFixed(4)}, R²: ${result.calibration.ols.r2.toFixed(3)}`);
      
      return result;
      
    } catch (error: any) {
      console.error('❌ [Calibration] Failed:', error);
      throw error;
    }
  }

  /**
   * Compare Tiber's adjusted EPA with Ben Baldwin's reference
   * 
   * Returns comparison data with freshness metadata for data quality monitoring
   */
  async compareWithBaldwin(season: number = 2025): Promise<{
    comparisons: any[];
    metadata: {
      tiberLastCalculated: Date | null;
      contextLastCalculated: Date | null;
      hasDuplicates: boolean;
    };
  }> {
    console.log(`🔬 [EPA Compare] Comparing Tiber vs Baldwin for ${season}...`);
    
    // Get all QBs from Baldwin reference
    const baldwinData = await this.getAllBaldwinReference(season);
    
    // Get Tiber's adjusted EPA with freshness check
    const tiberData = await db
      .select()
      .from(qbEpaAdjusted)
      .where(eq(qbEpaAdjusted.season, season));
    
    // Check for duplicates (data quality issue)
    const uniquePlayerIds = new Set(tiberData.map(t => t.playerId));
    const hasDuplicates = uniquePlayerIds.size !== tiberData.length;
    
    // Get freshness timestamps
    const tiberFreshness = tiberData.length > 0 
      ? tiberData.reduce((latest, curr) => 
          curr.calculatedAt && (!latest || curr.calculatedAt > latest) ? curr.calculatedAt : latest, 
          null as Date | null
        )
      : null;
    
    const contextData = await db
      .select()
      .from(qbContextMetrics)
      .where(eq(qbContextMetrics.season, season))
      .limit(1);
    
    const contextFreshness = contextData[0]?.calculatedAt || null;
    
    // Match by player ID and compare
    const comparisons = baldwinData.map(baldwin => {
      const tiber = tiberData.find(t => t.playerId === baldwin.playerId);
      
      return {
        playerId: baldwin.playerId,
        playerName: baldwin.playerName,
        baldwin: {
          rawEpa: baldwin.rawEpaPerPlay,
          adjEpa: baldwin.adjEpaPerPlay,
          diff: baldwin.epaDiff,
        },
        tiber: tiber ? {
          rawEpa: tiber.rawEpaPerPlay,
          adjEpa: tiber.tiberAdjEpaPerPlay,
          totalAdj: tiber.tiberEpaDiff,
          dropAdj: tiber.dropAdjustment,
          pressureAdj: tiber.pressureAdjustment,
          yacAdj: tiber.yacAdjustment,
          defAdj: tiber.defenseAdjustment,
        } : null,
        difference: tiber && 
                    tiber.tiberAdjEpaPerPlay !== null && 
                    tiber.tiberAdjEpaPerPlay !== undefined &&
                    baldwin.adjEpaPerPlay !== null && 
                    baldwin.adjEpaPerPlay !== undefined
          ? tiber.tiberAdjEpaPerPlay - baldwin.adjEpaPerPlay
          : null,
      };
    });
    
    return {
      comparisons,
      metadata: {
        tiberLastCalculated: tiberFreshness,
        contextLastCalculated: contextFreshness,
        hasDuplicates,
      },
    };
  }
}

export const epaSanityCheckService = new EPASanityCheckService();
