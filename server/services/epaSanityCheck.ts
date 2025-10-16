/**
 * EPA Sanity Check Service
 * Validates our EPA calculations against Ben Baldwin's adjusted EPA methodology
 */

import { db } from '../db';
import { qbEpaReference, qbContextMetrics, qbEpaAdjusted } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

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
  'S. Darnold': 'S.Darnold',
  'D. Prescott': 'D.Prescott',
  'J. Goff': 'J.Goff',
  'J. Love': 'J.Love',
  'D. Jones': 'D.Jones',
  'D. Maye': 'D.Maye',
  'B. Mayfield': 'B.Mayfield',
  'L. Jackson': 'L.Jackson',
  'S. Rattler': 'S.Rattler',
  'J. Herbert': 'J.Herbert',
  'M. Stafford': 'M.Stafford',
  'C. Stroud': 'C.Stroud',
  'P. Mahomes': 'P.Mahomes',
  'J. Allen': 'J.Allen',
  'J. Daniels': 'J.Daniels',
  'J. Dart': 'J.Dart',
  'T. Tagovailoa': 'T.Tagovailoa',
  'T. Lawrence': 'T.Lawrence',
  'J. Flacco': 'J.Flacco',
  'M. Jones': 'M.Jones',
  'A. Rodgers': 'A.Rodgers',
  'J. Hurts': 'J.Hurts',
  'K. Murray': 'K.Murray',
  'B. Young': 'B.Young',
  'C. Wentz': 'C.Wentz',
  'R. Wilson': 'R.Wilson',
  'J. Browning': 'J.Browning',
  'M. Penix': 'M.Penix',
  'J. Fields': 'J.Fields',
  'D. Gabriel': 'D.Gabriel',
  'B. Nix': 'B.Nix',
  'G. Smith': 'G.Smith',
  'C. Ward': 'C.Ward',
  'C. Williams': 'C.Williams',
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
   * Calculate Tiber Adjusted EPA using context metrics
   * 
   * Formula mirrors Ben Baldwin's methodology:
   * Adjusted EPA = Raw EPA + (drop_adjustment + pressure_adjustment + yac_adjustment + def_adjustment)
   */
  async calculateTiberAdjustedEpa(season: number = 2025): Promise<void> {
    console.log(`📊 [Tiber EPA] Calculating adjusted EPA for ${season}...`);
    
    // Get all QBs with context metrics
    const qbsWithContext = await db
      .select()
      .from(qbContextMetrics)
      .where(eq(qbContextMetrics.season, season));
    
    // Get Baldwin reference data for raw EPA
    const baldwinReference = await this.getAllBaldwinReference(season);
    
    console.log(`🔍 [Tiber EPA] Found ${qbsWithContext.length} QBs with context metrics`);
    console.log(`🔍 [Tiber EPA] Found ${baldwinReference.length} Baldwin reference QBs`);
    
    for (const qb of qbsWithContext) {
      try {
        // Find corresponding Baldwin reference for raw EPA
        const baldwinData = baldwinReference.find(b => b.playerId === qb.playerId);
        
        if (!baldwinData) {
          console.warn(`⚠️  No Baldwin reference found for ${qb.playerName}, skipping`);
          continue;
        }
        
        const rawEpa = baldwinData.rawEpaPerPlay;
        
        // Calculate adjustments based on context
        const dropAdjustment = (qb.dropRate || 0) * 0.15;  // Penalize high drop rates
        const pressureAdjustment = (qb.pressureRate || 0) * -0.12;  // Reward handling pressure
        const yacAdjustment = (qb.yacDelta || 0) * 0.002;  // Adjust for receiver YAC contribution
        const defAdjustment = (qb.avgDefEpaFaced || 0) * -0.08;  // Adjust for defensive strength
        
        const totalAdjustment = dropAdjustment + pressureAdjustment + yacAdjustment + defAdjustment;
        const adjEpa = rawEpa + totalAdjustment;
        
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
        
      } catch (error) {
        console.warn(`⚠️  Failed to calculate Tiber EPA for ${qb.playerName}:`, error);
      }
    }
    
    console.log(`✅ [Tiber EPA] Calculated adjusted EPA for ${qbsWithContext.length} QBs`);
  }

  /**
   * Compare Tiber's adjusted EPA with Ben Baldwin's reference
   */
  async compareWithBaldwin(season: number = 2025): Promise<any[]> {
    console.log(`🔬 [EPA Compare] Comparing Tiber vs Baldwin for ${season}...`);
    
    // Get all QBs from Baldwin reference
    const baldwinData = await this.getAllBaldwinReference(season);
    
    // Get Tiber's adjusted EPA
    const tiberData = await db
      .select()
      .from(qbEpaAdjusted)
      .where(eq(qbEpaAdjusted.season, season));
    
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
        difference: tiber && tiber.tiberAdjEpaPerPlay && baldwin.adjEpaPerPlay
          ? tiber.tiberAdjEpaPerPlay - baldwin.adjEpaPerPlay
          : null,
      };
    });
    
    return comparisons;
  }
}

export const epaSanityCheckService = new EPASanityCheckService();
