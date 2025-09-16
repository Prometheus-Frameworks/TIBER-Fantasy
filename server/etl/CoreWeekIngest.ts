/**
 * Core Week Ingest ETL Pipeline for Trade Advice System
 * Orchestrates weekly data ingestion to populate player_week_facts table
 * 
 * Data Sources:
 * - NFL-Data-Py: Snap counts, targets, rush attempts, fantasy points
 * - ECR Service: Expert consensus rankings 
 * - Sleeper API: ADP data and player info
 * 
 * Output: Populates player_week_facts table with weekly player statistics
 */

import { z } from 'zod';
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db';
import { playerWeekFacts, players, type InsertPlayerWeekFacts } from '@shared/schema';
import { getCurrentNFLWeek } from '../cron/weeklyUpdate';

// Configuration constants
const COVERAGE_REQUIREMENTS = {
  QB: 32,
  RB: 96, 
  WR: 160,
  TE: 64
} as const;

const CURRENT_SEASON = 2025;
const NFL_TEAMS = [
  'ARI', 'ATL', 'BAL', 'BUF', 'CAR', 'CHI', 'CIN', 'CLE', 'DAL', 'DEN',
  'DET', 'GB', 'HOU', 'IND', 'JAX', 'KC', 'LV', 'LAC', 'LAR', 'MIA',
  'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SF', 'SEA', 'TB', 'TEN', 'WAS'
];

// Data validation schemas
const PlayerStatsSchema = z.object({
  player_id: z.string(),
  name: z.string(),
  position: z.enum(['QB', 'RB', 'WR', 'TE']),
  team: z.string(),
  snap_count: z.number().optional(),
  snap_share: z.number().optional(),
  routes_per_game: z.number().optional(),
  targets_per_game: z.number().optional(),
  rush_attempts: z.number().optional(),
  fantasy_points_ppr: z.number().optional(),
  red_zone_touches: z.number().optional(),
  epa_per_play: z.number().optional(),
  yards_per_route_run: z.number().optional(),
  yac_per_attempt: z.number().optional(),
  missed_tackles_forced: z.number().optional(),
});

const ECRDataSchema = z.object({
  player_id: z.string(),
  name: z.string(),
  position: z.enum(['QB', 'RB', 'WR', 'TE']),
  ecr_rank: z.number(),
  ecr_7d_delta: z.number().optional(),
});

const ADPDataSchema = z.object({
  player_id: z.string(),
  name: z.string(), 
  position: z.enum(['QB', 'RB', 'WR', 'TE']),
  adp_rank: z.number(),
  rostered_percent: z.number().optional(),
  started_percent: z.number().optional(),
});

export interface IngestResult {
  week: number;
  season: number;
  playersProcessed: number;
  positionCoverage: Record<string, number>;
  dataQuality: {
    nflStatsCount: number;
    ecrCount: number;
    adpCount: number;
    crossReferenceRate: number;
  };
  errors: string[];
  warnings: string[];
  duration: number;
}

export class CoreWeekIngestETL {
  
  /**
   * Main entry point for weekly data ingestion
   */
  async ingestWeeklyData(week?: number, season: number = CURRENT_SEASON): Promise<IngestResult> {
    const startTime = Date.now();
    const targetWeek = week || parseInt(getCurrentNFLWeek());
    
    console.log(`🔄 Starting Core Week Ingest for Week ${targetWeek}, Season ${season}...`);
    
    const result: IngestResult = {
      week: targetWeek,
      season,
      playersProcessed: 0,
      positionCoverage: { QB: 0, RB: 0, WR: 0, TE: 0 },
      dataQuality: { nflStatsCount: 0, ecrCount: 0, adpCount: 0, crossReferenceRate: 0 },
      errors: [],
      warnings: [],
      duration: 0
    };

    try {
      // Step 1: Fetch data from all sources
      console.log('📊 Step 1: Fetching data from sources...');
      const [nflStats, ecrData, adpData] = await Promise.all([
        this.fetchNFLStats(targetWeek, season),
        this.fetchECRData(),
        this.fetchADPData()
      ]);

      result.dataQuality.nflStatsCount = nflStats.length;
      result.dataQuality.ecrCount = ecrData.length;
      result.dataQuality.adpCount = adpData.length;

      // Step 2: Cross-reference and merge data sources
      console.log('🔗 Step 2: Cross-referencing and merging data...');
      const mergedPlayerFacts = await this.mergeDataSources(nflStats, ecrData, adpData, targetWeek, season);
      
      // Step 3: Validate data quality and coverage
      console.log('✅ Step 3: Validating data quality...');
      await this.validateDataQuality(mergedPlayerFacts, result);

      // Step 4: Compute advanced metrics 
      console.log('🧮 Step 4: Computing advanced metrics...');
      const enrichedPlayerFacts = await this.computeAdvancedMetrics(mergedPlayerFacts, targetWeek, season);

      // Step 5: Upsert to database
      console.log('💾 Step 5: Upserting to player_week_facts table...');
      await this.upsertPlayerWeekFacts(enrichedPlayerFacts);
      
      result.playersProcessed = enrichedPlayerFacts.length;
      
      // Update position coverage counts
      for (const playerFact of enrichedPlayerFacts) {
        if (playerFact.position in result.positionCoverage) {
          result.positionCoverage[playerFact.position]++;
        }
      }
      
      result.dataQuality.crossReferenceRate = this.calculateCrossReferenceRate(mergedPlayerFacts);
      result.duration = Date.now() - startTime;
      
      console.log(`✅ Core Week Ingest completed successfully!`);
      console.log(`   📊 Processed ${result.playersProcessed} players`);
      console.log(`   📈 Position coverage: QB:${result.positionCoverage.QB}, RB:${result.positionCoverage.RB}, WR:${result.positionCoverage.WR}, TE:${result.positionCoverage.TE}`);
      console.log(`   ⏱️ Duration: ${result.duration}ms`);
      
      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMessage);
      result.duration = Date.now() - startTime;
      
      console.error(`❌ Core Week Ingest failed:`, error);
      throw error;
    }
  }

  /**
   * Fetch NFL statistics via NFL-Data-Py integration
   * Simulates real NFL data for now with realistic distributions
   */
  private async fetchNFLStats(week: number, season: number): Promise<z.infer<typeof PlayerStatsSchema>[]> {
    console.log(`   🏈 Fetching NFL stats for Week ${week}...`);
    
    try {
      // For now, generate realistic mock data based on known active players
      // In production, this would call the actual NFL-Data-Py service
      const mockStats = await this.generateMockNFLStats(week, season);
      
      // Validate the data
      const validatedStats = mockStats.map(stat => PlayerStatsSchema.parse(stat));
      
      console.log(`   ✅ Fetched ${validatedStats.length} NFL player stats`);
      return validatedStats;
      
    } catch (error) {
      console.error(`   ❌ Failed to fetch NFL stats:`, error);
      throw new Error(`NFL stats fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch ECR (Expert Consensus Rankings) data
   */
  private async fetchECRData(): Promise<z.infer<typeof ECRDataSchema>[]> {
    console.log(`   📊 Fetching ECR rankings...`);
    
    try {
      // Import ECR service to get current rankings
      const { ECRService } = await import('../services/ecrService');
      
      // Get ECR data for all positions
      const ecrResults: z.infer<typeof ECRDataSchema>[] = [];
      
      // Sample ECR data based on the service's current data
      const positions = ['QB', 'RB', 'WR', 'TE'] as const;
      
      for (const position of positions) {
        // Extract ECR data from the service's predefined rankings
        const positionRankings = await this.getECRForPosition(position);
        ecrResults.push(...positionRankings);
      }
      
      const validatedECR = ecrResults.map(ecr => ECRDataSchema.parse(ecr));
      
      console.log(`   ✅ Fetched ${validatedECR.length} ECR rankings`);
      return validatedECR;
      
    } catch (error) {
      console.error(`   ❌ Failed to fetch ECR data:`, error);
      throw new Error(`ECR fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch ADP data from Sleeper API
   */
  private async fetchADPData(): Promise<z.infer<typeof ADPDataSchema>[]> {
    console.log(`   💰 Fetching ADP data from Sleeper...`);
    
    try {
      // Import Sleeper services
      const { sleeperSyncService } = await import('../services/sleeperSyncService');
      
      // Get trending and active players to build ADP dataset
      const adpResults = await this.buildADPDataset();
      
      const validatedADP = adpResults.map(adp => ADPDataSchema.parse(adp));
      
      console.log(`   ✅ Fetched ${validatedADP.length} ADP data points`);
      return validatedADP;
      
    } catch (error) {
      console.error(`   ❌ Failed to fetch ADP data:`, error);
      throw new Error(`ADP fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Merge data from all sources using name/position matching
   */
  private async mergeDataSources(
    nflStats: z.infer<typeof PlayerStatsSchema>[],
    ecrData: z.infer<typeof ECRDataSchema>[],
    adpData: z.infer<typeof ADPDataSchema>[],
    week: number,
    season: number
  ): Promise<Partial<InsertPlayerWeekFacts>[]> {
    console.log(`   🔗 Merging ${nflStats.length} NFL stats, ${ecrData.length} ECR, ${adpData.length} ADP records...`);
    
    const playerFactsMap = new Map<string, Partial<InsertPlayerWeekFacts>>();
    
    // Start with NFL stats as the primary data source
    for (const nflStat of nflStats) {
      const key = `${nflStat.name}_${nflStat.position}_${nflStat.team}`;
      
      playerFactsMap.set(key, {
        playerId: nflStat.player_id,
        season,
        week,
        position: nflStat.position,
        
        // NFL Stats mapping
        snapShare: nflStat.snap_share || 0,
        routesPerGame: nflStat.routes_per_game || 0,
        targetsPerGame: nflStat.targets_per_game || 0,
        rzTouches: nflStat.red_zone_touches || 0,
        epaPerPlay: nflStat.epa_per_play || 0,
        yprr: nflStat.yards_per_route_run || 0,
        yacPerAtt: nflStat.yac_per_attempt || 0,
        mtfPerTouch: nflStat.missed_tackles_forced || 0,
        
        // Initialize other fields
        usageNow: 0,
        talent: 0,
        environment: 0,
        availability: 1,
        marketAnchor: 0,
        powerScore: 0,
        confidence: 0.5,
        flags: [],
      });
    }
    
    // Merge ECR data
    for (const ecr of ecrData) {
      const key = `${ecr.name}_${ecr.position}`;
      
      // Find matching player by name and position
      for (const [playerKey, playerFact] of Array.from(playerFactsMap.entries())) {
        if (playerKey.includes(`${ecr.name}_${ecr.position}`)) {
          playerFact.ecr7dDelta = ecr.ecr_7d_delta || 0;
          // Use ECR rank to help compute market gaps later
          break;
        }
      }
    }
    
    // Merge ADP data
    for (const adp of adpData) {
      const key = `${adp.name}_${adp.position}`;
      
      // Find matching player by name and position
      for (const [playerKey, playerFact] of Array.from(playerFactsMap.entries())) {
        if (playerKey.includes(`${adp.name}_${adp.position}`)) {
          playerFact.adpRank = Math.round(adp.adp_rank);
          playerFact.rostered7dDelta = 0; // Will be computed from trends
          playerFact.started7dDelta = 0;
          break;
        }
      }
    }
    
    const mergedFacts = Array.from(playerFactsMap.values());
    console.log(`   ✅ Merged data for ${mergedFacts.length} players`);
    
    return mergedFacts;
  }

  /**
   * Validate data quality and coverage requirements
   */
  private async validateDataQuality(
    playerFacts: Partial<InsertPlayerWeekFacts>[],
    result: IngestResult
  ): Promise<void> {
    console.log(`   ✅ Validating data quality for ${playerFacts.length} players...`);
    
    // Check position coverage
    const positionCounts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
    
    for (const playerFact of playerFacts) {
      if (playerFact.position && playerFact.position in positionCounts) {
        positionCounts[playerFact.position]++;
      }
    }
    
    // Validate coverage requirements
    for (const [position, count] of Object.entries(positionCounts)) {
      const required = COVERAGE_REQUIREMENTS[position as keyof typeof COVERAGE_REQUIREMENTS];
      if (count < required) {
        result.warnings.push(`${position} coverage below minimum: ${count}/${required}`);
        console.warn(`   ⚠️ ${position} coverage below minimum: ${count}/${required}`);
      } else {
        console.log(`   ✅ ${position} coverage adequate: ${count}/${required}`);
      }
    }
    
    // Check for data completeness
    const playersWithADP = playerFacts.filter(p => p.adpRank).length;
    const playersWithSnaps = playerFacts.filter(p => p.snapShare && p.snapShare > 0).length;
    
    if (playersWithADP < playerFacts.length * 0.6) {
      result.warnings.push(`Low ADP coverage: ${playersWithADP}/${playerFacts.length} players`);
    }
    
    if (playersWithSnaps < playerFacts.length * 0.4) {
      result.warnings.push(`Low snap data coverage: ${playersWithSnaps}/${playerFacts.length} players`);
    }
    
    console.log(`   📊 Data quality: ${playersWithADP} players with ADP, ${playersWithSnaps} with snap data`);
  }

  /**
   * Compute advanced metrics and scores
   */
  private async computeAdvancedMetrics(
    playerFacts: Partial<InsertPlayerWeekFacts>[],
    week: number,
    season: number
  ): Promise<InsertPlayerWeekFacts[]> {
    console.log(`   🧮 Computing advanced metrics for ${playerFacts.length} players...`);
    
    const enrichedFacts: InsertPlayerWeekFacts[] = [];
    
    for (const playerFact of playerFacts) {
      if (!playerFact.playerId || !playerFact.position) continue;
      
      // Compute usage score (normalized 0-100)
      const usageNow = this.computeUsageScore(playerFact);
      
      // Compute talent score based on efficiency metrics
      const talent = this.computeTalentScore(playerFact);
      
      // Compute environment score (team context)
      const environment = this.computeEnvironmentScore(playerFact);
      
      // Compute market anchor (ADP vs performance gap)
      const marketAnchor = this.computeMarketAnchor(playerFact);
      
      // Compute overall power score
      const powerScore = (usageNow * 0.4 + talent * 0.3 + environment * 0.2 + marketAnchor * 0.1);
      
      // Compute confidence based on data quality
      const confidence = this.computeConfidence(playerFact);
      
      // Set risk factors
      const flags = this.computeRiskFlags(playerFact);
      
      const enrichedPlayerFact: InsertPlayerWeekFacts = {
        playerId: playerFact.playerId,
        season,
        week,
        position: playerFact.position,
        
        // Core scores
        usageNow,
        talent,
        environment,
        availability: playerFact.availability || 1,
        marketAnchor,
        powerScore,
        confidence,
        flags,
        
        // Advanced metrics (with defaults)
        adpRank: playerFact.adpRank || null,
        snapShare: playerFact.snapShare || 0,
        routesPerGame: playerFact.routesPerGame || 0,
        targetsPerGame: playerFact.targetsPerGame || 0,
        rzTouches: playerFact.rzTouches || 0,
        epaPerPlay: playerFact.epaPerPlay || 0,
        yprr: playerFact.yprr || 0,
        yacPerAtt: playerFact.yacPerAtt || 0,
        mtfPerTouch: playerFact.mtfPerTouch || 0,
        teamProe: this.getTeamPROE(playerFact.position),
        paceRankPercentile: Math.random() * 100, // Mock for now
        olTier: Math.floor(Math.random() * 5) + 1, // Mock OL tier 1-5
        sosNext2: (Math.random() - 0.5) * 2, // Mock SOS -1 to 1
        injuryPracticeScore: Math.random(), // Mock injury score 0-1
        committeeIndex: Math.random(), // Mock committee index 0-1
        coachVolatility: Math.random(), // Mock coach volatility 0-1
        ecr7dDelta: playerFact.ecr7dDelta || 0,
        byeWeek: false, // Mock for now
        rostered7dDelta: playerFact.rostered7dDelta || 0,
        started7dDelta: playerFact.started7dDelta || 0,
      };
      
      enrichedFacts.push(enrichedPlayerFact);
    }
    
    console.log(`   ✅ Computed advanced metrics for ${enrichedFacts.length} players`);
    return enrichedFacts;
  }

  /**
   * Upsert player week facts to database using composite primary key
   */
  private async upsertPlayerWeekFacts(playerFacts: InsertPlayerWeekFacts[]): Promise<void> {
    console.log(`   💾 Upserting ${playerFacts.length} player week facts...`);
    
    let upsertCount = 0;
    let errorCount = 0;
    
    for (const playerFact of playerFacts) {
      try {
        // Use INSERT ... ON CONFLICT for upsert with composite primary key
        await db
          .insert(playerWeekFacts)
          .values(playerFact)
          .onConflictDoUpdate({
            target: [playerWeekFacts.playerId, playerWeekFacts.season, playerWeekFacts.week],
            set: {
              position: playerFact.position,
              usageNow: playerFact.usageNow,
              talent: playerFact.talent,
              environment: playerFact.environment,
              availability: playerFact.availability,
              marketAnchor: playerFact.marketAnchor,
              powerScore: playerFact.powerScore,
              confidence: playerFact.confidence,
              flags: playerFact.flags,
              adpRank: playerFact.adpRank,
              snapShare: playerFact.snapShare,
              routesPerGame: playerFact.routesPerGame,
              targetsPerGame: playerFact.targetsPerGame,
              rzTouches: playerFact.rzTouches,
              epaPerPlay: playerFact.epaPerPlay,
              yprr: playerFact.yprr,
              yacPerAtt: playerFact.yacPerAtt,
              mtfPerTouch: playerFact.mtfPerTouch,
              teamProe: playerFact.teamProe,
              paceRankPercentile: playerFact.paceRankPercentile,
              olTier: playerFact.olTier,
              sosNext2: playerFact.sosNext2,
              injuryPracticeScore: playerFact.injuryPracticeScore,
              committeeIndex: playerFact.committeeIndex,
              coachVolatility: playerFact.coachVolatility,
              ecr7dDelta: playerFact.ecr7dDelta,
              byeWeek: playerFact.byeWeek,
              rostered7dDelta: playerFact.rostered7dDelta,
              started7dDelta: playerFact.started7dDelta,
              lastUpdate: sql`now()`,
            }
          });
        
        upsertCount++;
        
      } catch (error) {
        console.error(`   ❌ Failed to upsert player ${playerFact.playerId}:`, error);
        errorCount++;
      }
    }
    
    console.log(`   ✅ Upserted ${upsertCount} players (${errorCount} errors)`);
    
    if (errorCount > 0) {
      throw new Error(`Failed to upsert ${errorCount} players`);
    }
  }

  // Helper methods for metric computation
  private computeUsageScore(playerFact: Partial<InsertPlayerWeekFacts>): number {
    const snapShare = playerFact.snapShare || 0;
    const targets = playerFact.targetsPerGame || 0;
    const routes = playerFact.routesPerGame || 0;
    
    // Normalize usage based on position
    switch (playerFact.position) {
      case 'RB':
        return Math.min(100, (snapShare * 60) + (playerFact.rzTouches || 0) * 5);
      case 'WR':
      case 'TE':
        return Math.min(100, (targets * 8) + (routes * 0.5) + (playerFact.rzTouches || 0) * 3);
      case 'QB':
        return Math.min(100, snapShare * 80);
      default:
        return 0;
    }
  }

  private computeTalentScore(playerFact: Partial<InsertPlayerWeekFacts>): number {
    const epa = playerFact.epaPerPlay || 0;
    const yprr = playerFact.yprr || 0;
    const yac = playerFact.yacPerAtt || 0;
    const mtf = playerFact.mtfPerTouch || 0;
    
    // Normalize based on position expectations
    return Math.min(100, Math.max(0, 
      (epa * 50) + (yprr * 2) + (yac * 3) + (mtf * 10) + 30
    ));
  }

  private computeEnvironmentScore(playerFact: Partial<InsertPlayerWeekFacts>): number {
    // Mock environment score - in production would factor in:
    // - Team pace, O-line quality, QB play, coaching
    return Math.random() * 40 + 40; // Range 40-80
  }

  private computeMarketAnchor(playerFact: Partial<InsertPlayerWeekFacts>): number {
    // Mock market anchor - in production would compute ADP vs performance gap
    return Math.random() * 100;
  }

  private computeConfidence(playerFact: Partial<InsertPlayerWeekFacts>): number {
    let confidence = 0.5;
    
    // Boost confidence based on data availability
    if (playerFact.snapShare && playerFact.snapShare > 0) confidence += 0.2;
    if (playerFact.targetsPerGame && playerFact.targetsPerGame > 0) confidence += 0.1;
    if (playerFact.adpRank) confidence += 0.1;
    if (playerFact.epaPerPlay !== undefined) confidence += 0.1;
    
    return Math.min(1, confidence);
  }

  private computeRiskFlags(playerFact: Partial<InsertPlayerWeekFacts>): string[] {
    const flags: string[] = [];
    
    // Add risk flags based on metrics
    if ((playerFact.snapShare || 0) < 0.3) flags.push('LOW_SNAPS');
    if ((playerFact.adpRank || 999) > 200) flags.push('DEEP_SLEEPER');
    
    return flags;
  }

  private getTeamPROE(position: string): number {
    // Mock team PROE (Projected Remaining Offensive Efficiency)
    return Math.random() * 20 - 10; // Range -10 to 10
  }

  private calculateCrossReferenceRate(playerFacts: Partial<InsertPlayerWeekFacts>[]): number {
    const playersWithMultipleSources = playerFacts.filter(p => 
      p.snapShare && p.adpRank && p.epaPerPlay !== undefined
    ).length;
    
    return playerFacts.length > 0 ? playersWithMultipleSources / playerFacts.length : 0;
  }

  // Mock data generators (replace with real API calls in production)
  private async generateMockNFLStats(week: number, season: number): Promise<z.infer<typeof PlayerStatsSchema>[]> {
    // Generate realistic mock data for testing
    const mockStats: z.infer<typeof PlayerStatsSchema>[] = [];
    
    // Sample QBs
    const qbs = [
      { name: 'Josh Allen', team: 'BUF' },
      { name: 'Lamar Jackson', team: 'BAL' },
      { name: 'Jayden Daniels', team: 'WAS' },
      { name: 'Joe Burrow', team: 'CIN' },
      { name: 'Jalen Hurts', team: 'PHI' },
    ];
    
    // Sample RBs
    const rbs = [
      { name: 'Bijan Robinson', team: 'ATL' },
      { name: 'Saquon Barkley', team: 'PHI' },
      { name: 'Jahmyr Gibbs', team: 'DET' },
      { name: 'Derrick Henry', team: 'BAL' },
      { name: 'Christian McCaffrey', team: 'SF' },
      { name: 'Jonathan Taylor', team: 'IND' },
      { name: 'De\'Von Achane', team: 'MIA' },
      { name: 'Kyren Williams', team: 'LAR' },
      { name: 'Josh Jacobs', team: 'GB' },
      { name: 'Breece Hall', team: 'NYJ' },
    ];
    
    // Sample WRs  
    const wrs = [
      { name: 'CeeDee Lamb', team: 'DAL' },
      { name: 'Tyreek Hill', team: 'MIA' },
      { name: 'Amon-Ra St. Brown', team: 'DET' },
      { name: 'A.J. Brown', team: 'PHI' },
      { name: 'Ja\'Marr Chase', team: 'CIN' },
      { name: 'Davante Adams', team: 'NYJ' },
      { name: 'Mike Evans', team: 'TB' },
      { name: 'DeVonta Smith', team: 'PHI' },
      { name: 'Puka Nacua', team: 'LAR' },
      { name: 'DK Metcalf', team: 'SEA' },
    ];
    
    // Sample TEs
    const tes = [
      { name: 'Travis Kelce', team: 'KC' },
      { name: 'Sam LaPorta', team: 'DET' },
      { name: 'Trey McBride', team: 'ARI' },
      { name: 'George Kittle', team: 'SF' },
      { name: 'Mark Andrews', team: 'BAL' },
    ];
    
    // Generate mock stats for each position
    qbs.forEach((qb, i) => {
      mockStats.push({
        player_id: `qb_${i + 1}`,
        name: qb.name,
        position: 'QB',
        team: qb.team,
        snap_count: Math.floor(Math.random() * 20) + 50,
        snap_share: Math.random() * 0.3 + 0.7,
        fantasy_points_ppr: Math.random() * 15 + 10,
        epa_per_play: Math.random() * 0.4 - 0.1,
      });
    });
    
    rbs.forEach((rb, i) => {
      mockStats.push({
        player_id: `rb_${i + 1}`,
        name: rb.name,
        position: 'RB',
        team: rb.team,
        snap_count: Math.floor(Math.random() * 30) + 20,
        snap_share: Math.random() * 0.6 + 0.2,
        rush_attempts: Math.floor(Math.random() * 15) + 5,
        fantasy_points_ppr: Math.random() * 20 + 5,
        red_zone_touches: Math.floor(Math.random() * 5),
        epa_per_play: Math.random() * 0.3 - 0.1,
      });
    });
    
    wrs.forEach((wr, i) => {
      mockStats.push({
        player_id: `wr_${i + 1}`,
        name: wr.name,
        position: 'WR',
        team: wr.team,
        snap_count: Math.floor(Math.random() * 40) + 30,
        snap_share: Math.random() * 0.5 + 0.4,
        routes_per_game: Math.floor(Math.random() * 20) + 15,
        targets_per_game: Math.floor(Math.random() * 8) + 3,
        fantasy_points_ppr: Math.random() * 18 + 4,
        yards_per_route_run: Math.random() * 1.5 + 0.8,
        yac_per_attempt: Math.random() * 2 + 1,
        epa_per_play: Math.random() * 0.4 - 0.1,
      });
    });
    
    tes.forEach((te, i) => {
      mockStats.push({
        player_id: `te_${i + 1}`,
        name: te.name,
        position: 'TE',
        team: te.team,
        snap_count: Math.floor(Math.random() * 35) + 25,
        snap_share: Math.random() * 0.4 + 0.4,
        routes_per_game: Math.floor(Math.random() * 15) + 10,
        targets_per_game: Math.floor(Math.random() * 6) + 2,
        fantasy_points_ppr: Math.random() * 12 + 3,
        yards_per_route_run: Math.random() * 1.2 + 0.6,
        red_zone_touches: Math.floor(Math.random() * 3),
        epa_per_play: Math.random() * 0.3 - 0.1,
      });
    });
    
    return mockStats;
  }

  private async getECRForPosition(position: 'QB' | 'RB' | 'WR' | 'TE'): Promise<z.infer<typeof ECRDataSchema>[]> {
    // Mock ECR data based on current rankings
    const ecrData: z.infer<typeof ECRDataSchema>[] = [];
    
    const positionMocks = {
      QB: [
        { name: 'Josh Allen', ecr_rank: 1.2 },
        { name: 'Lamar Jackson', ecr_rank: 1.8 },
        { name: 'Jayden Daniels', ecr_rank: 2.5 },
        { name: 'Joe Burrow', ecr_rank: 3.1 },
        { name: 'Jalen Hurts', ecr_rank: 3.8 },
      ],
      RB: [
        { name: 'Bijan Robinson', ecr_rank: 1.2 },
        { name: 'Saquon Barkley', ecr_rank: 2.0 },
        { name: 'Jahmyr Gibbs', ecr_rank: 3.0 },
        { name: 'Derrick Henry', ecr_rank: 4.5 },
        { name: 'Christian McCaffrey', ecr_rank: 5.8 },
        { name: 'Jonathan Taylor', ecr_rank: 6.5 },
        { name: 'De\'Von Achane', ecr_rank: 7.8 },
        { name: 'Kyren Williams', ecr_rank: 8.9 },
        { name: 'Josh Jacobs', ecr_rank: 10.2 },
        { name: 'Breece Hall', ecr_rank: 11.8 },
      ],
      WR: [
        { name: 'CeeDee Lamb', ecr_rank: 1.5 },
        { name: 'Tyreek Hill', ecr_rank: 2.1 },
        { name: 'Amon-Ra St. Brown', ecr_rank: 2.8 },
        { name: 'A.J. Brown', ecr_rank: 3.2 },
        { name: 'Ja\'Marr Chase', ecr_rank: 3.9 },
        { name: 'Davante Adams', ecr_rank: 4.5 },
        { name: 'Mike Evans', ecr_rank: 5.2 },
        { name: 'DeVonta Smith', ecr_rank: 6.1 },
        { name: 'Puka Nacua', ecr_rank: 6.8 },
        { name: 'DK Metcalf', ecr_rank: 7.5 },
      ],
      TE: [
        { name: 'Travis Kelce', ecr_rank: 1.3 },
        { name: 'Sam LaPorta', ecr_rank: 2.1 },
        { name: 'Trey McBride', ecr_rank: 2.9 },
        { name: 'George Kittle', ecr_rank: 3.5 },
        { name: 'Mark Andrews', ecr_rank: 4.2 },
      ]
    };
    
    const mockData = positionMocks[position] || [];
    
    mockData.forEach((player, i) => {
      ecrData.push({
        player_id: `${position.toLowerCase()}_${i + 1}`,
        name: player.name,
        position,
        ecr_rank: player.ecr_rank,
        ecr_7d_delta: Math.floor(Math.random() * 6) - 3, // -3 to +3
      });
    });
    
    return ecrData;
  }

  private async buildADPDataset(): Promise<z.infer<typeof ADPDataSchema>[]> {
    // Mock ADP data with realistic ranges
    const adpData: z.infer<typeof ADPDataSchema>[] = [];
    
    // QB ADP ranges (typically drafted later)
    const qbNames = ['Josh Allen', 'Lamar Jackson', 'Jayden Daniels', 'Joe Burrow', 'Jalen Hurts'];
    qbNames.forEach((name, i) => {
      adpData.push({
        player_id: `qb_${i + 1}`,
        name,
        position: 'QB',
        adp_rank: 24 + i * 12, // QBs typically go rounds 2-6
        rostered_percent: Math.random() * 30 + 60,
        started_percent: Math.random() * 20 + 40,
      });
    });
    
    // RB ADP (early picks)
    const rbNames = ['Bijan Robinson', 'Saquon Barkley', 'Jahmyr Gibbs', 'Derrick Henry', 'Christian McCaffrey', 'Jonathan Taylor', 'De\'Von Achane', 'Kyren Williams', 'Josh Jacobs', 'Breece Hall'];
    rbNames.forEach((name, i) => {
      adpData.push({
        player_id: `rb_${i + 1}`,
        name,
        position: 'RB',
        adp_rank: 3 + i * 8, // Top RBs go early
        rostered_percent: Math.random() * 20 + 70,
        started_percent: Math.random() * 25 + 50,
      });
    });
    
    // WR ADP (mixed throughout)
    const wrNames = ['CeeDee Lamb', 'Tyreek Hill', 'Amon-Ra St. Brown', 'A.J. Brown', 'Ja\'Marr Chase', 'Davante Adams', 'Mike Evans', 'DeVonta Smith', 'Puka Nacua', 'DK Metcalf'];
    wrNames.forEach((name, i) => {
      adpData.push({
        player_id: `wr_${i + 1}`,
        name,
        position: 'WR',
        adp_rank: 8 + i * 6, // WRs spread throughout
        rostered_percent: Math.random() * 25 + 65,
        started_percent: Math.random() * 30 + 45,
      });
    });
    
    // TE ADP (later rounds typically)
    const teNames = ['Travis Kelce', 'Sam LaPorta', 'Trey McBride', 'George Kittle', 'Mark Andrews'];
    teNames.forEach((name, i) => {
      adpData.push({
        player_id: `te_${i + 1}`,
        name,
        position: 'TE',
        adp_rank: 18 + i * 15, // TEs typically later
        rostered_percent: Math.random() * 35 + 55,
        started_percent: Math.random() * 35 + 40,
      });
    });
    
    return adpData;
  }

  /**
   * Health check for the ingestion system
   */
  async healthCheck(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details: any }> {
    try {
      const currentWeek = parseInt(getCurrentNFLWeek());
      const season = CURRENT_SEASON;
      
      // Check if we have recent player week facts
      const { count } = await import('drizzle-orm');
      const { eq, and, gte } = await import('drizzle-orm');
      
      const recentDataQuery = await db
        .select({ count: count() })
        .from(playerWeekFacts)
        .where(
          and(
            eq(playerWeekFacts.season, season),
            gte(playerWeekFacts.week, currentWeek - 1) // Check current and previous week
          )
        );
      
      const recentCount = recentDataQuery[0]?.count || 0;
      
      if (recentCount === 0) {
        return {
          status: 'unhealthy',
          details: {
            message: 'No recent player week facts found',
            currentWeek,
            season,
            recentCount
          }
        };
      } else if (recentCount < 200) { // Expect at least 200 player facts per week
        return {
          status: 'degraded',
          details: {
            message: 'Low number of recent player facts',
            currentWeek,
            season,
            recentCount
          }
        };
      } else {
        return {
          status: 'healthy',
          details: {
            message: 'Core Week Ingest system healthy',
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

// Export singleton instance
export const coreWeekIngestETL = new CoreWeekIngestETL();