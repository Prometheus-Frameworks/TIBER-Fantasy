import { db } from '../infra/db';
import { playerAttributes, playerIdentityMap, type PlayerAttributes, type InsertPlayerAttributes } from '@shared/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * Player Attributes Service - Manages weekly player attribute data collection and normalization
 * 
 * Implements the proposed attribute sheet system:
 * - Sleeper API: Base stats, injury status, fantasy points
 * - nflfastR: Advanced metrics (EPA, air yards, YAC, sacks)
 * - OASIS: Environment data (opponent, defense rank, pace, implied totals)
 * 
 * Data flows: Bronze (raw) → Silver (normalized) → Gold (scored attributes)
 */
export class AttributesService {
  private cache = new Map<string, PlayerAttributes[]>();
  private cacheTimestamp = new Map<string, number>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  /**
   * Get weekly attributes for a specific player
   */
  async getPlayerWeeklyAttributes(
    otcId: string, 
    season: number, 
    week: number
  ): Promise<PlayerAttributes | null> {
    try {
      const result = await db
        .select()
        .from(playerAttributes)
        .where(
          and(
            eq(playerAttributes.otcId, otcId),
            eq(playerAttributes.season, season),
            eq(playerAttributes.week, week)
          )
        )
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error(`[AttributesService] Error fetching player attributes for ${otcId}:`, error);
      return null;
    }
  }

  /**
   * Get all attributes for a specific week and position
   */
  async getWeeklyAttributes(
    season: number,
    week: number,
    position?: string,
    team?: string,
    limit = 100
  ): Promise<PlayerAttributes[]> {
    const cacheKey = `weekly-${season}-${week}-${position || 'ALL'}-${team || 'ALL'}-${limit}`;
    
    // Check cache
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    try {
      // Build where conditions
      const whereConditions = [
        eq(playerAttributes.season, season),
        eq(playerAttributes.week, week)
      ];

      // Add position filter if specified
      if (position && position !== 'ALL') {
        whereConditions.push(eq(playerAttributes.position, position));
      }

      // Add team filter if specified  
      if (team && team !== 'ALL') {
        whereConditions.push(eq(playerAttributes.team, team));
      }

      const query = db
        .select()
        .from(playerAttributes)
        .where(and(...whereConditions));

      const result = await query
        .orderBy(desc(playerAttributes.fantasyPtsHalfppr))
        .limit(limit);

      // Cache result
      this.cache.set(cacheKey, result);
      this.cacheTimestamp.set(cacheKey, Date.now());

      return result;
    } catch (error) {
      console.error(`[AttributesService] Error fetching weekly attributes:`, error);
      return [];
    }
  }

  /**
   * Get player's season-long attribute history
   */
  async getPlayerSeasonAttributes(
    otcId: string,
    season: number
  ): Promise<PlayerAttributes[]> {
    try {
      const result = await db
        .select()
        .from(playerAttributes)
        .where(
          and(
            eq(playerAttributes.otcId, otcId),
            eq(playerAttributes.season, season)
          )
        )
        .orderBy(desc(playerAttributes.week));

      return result;
    } catch (error) {
      console.error(`[AttributesService] Error fetching season attributes for ${otcId}:`, error);
      return [];
    }
  }

  /**
   * Create or update player attributes for a specific week
   */
  async upsertPlayerAttributes(data: InsertPlayerAttributes): Promise<PlayerAttributes | null> {
    try {
      const result = await db
        .insert(playerAttributes)
        .values(data)
        .onConflictDoUpdate({
          target: [playerAttributes.season, playerAttributes.week, playerAttributes.otcId],
          set: {
            team: data.team,
            position: data.position,
            playerName: data.playerName,
            nflId: data.nflId,
            sleeperId: data.sleeperId,
            
            // Rushing stats
            carries: data.carries,
            rushingYards: data.rushingYards,
            rushingTds: data.rushingTds,
            
            // Receiving stats
            targets: data.targets,
            receptions: data.receptions,
            receivingYards: data.receivingYards,
            receivingTds: data.receivingTds,
            
            // Fantasy points
            fantasyPtsHalfppr: data.fantasyPtsHalfppr,
            fantasyPtsPpr: data.fantasyPtsPpr,
            fantasyPtsStandard: data.fantasyPtsStandard,
            
            // Advanced metrics
            airYards: data.airYards,
            yac: data.yac,
            aDOT: data.aDOT,
            epaTotal: data.epaTotal,
            epaPerPlay: data.epaPerPlay,
            
            // Context/Environment
            opposingTeam: data.opposingTeam,
            opponentDefRank: data.opponentDefRank,
            gamePace: data.gamePace,
            impliedTotal: data.impliedTotal,
            depthPosition: data.depthPosition,
            snapPercentage: data.snapPercentage,
            targetShare: data.targetShare,
            teamPlays: data.teamPlays,
            injuryStatus: data.injuryStatus,
            questionable: data.questionable,
            
            updatedAt: new Date()
          }
        })
        .returning();

      // Clear cache
      this.clearCache();

      if (result.length === 0) {
        throw new Error('Upsert failed - no rows returned');
      }
      
      return result[0];
    } catch (error) {
      console.error(`[AttributesService] Error upserting player attributes:`, error);
      throw error; // Re-throw to propagate error
    }
  }

  /**
   * Collect and merge attributes for a specific week from all data sources
   */
  async collectWeeklyAttributes(season: number, week: number): Promise<{
    success: boolean;
    processedPlayers: number;
    errors: string[];
  }> {
    console.log(`[AttributesService] Starting attribute collection for ${season} Week ${week}`);
    
    const result = {
      success: true,
      processedPlayers: 0,
      errors: [] as string[]
    };

    try {
      // Step 1: Get player list from identity map
      const players = await db
        .select({
          otcId: playerIdentityMap.canonicalId,
          position: playerIdentityMap.position,
          sleeperId: playerIdentityMap.sleeperId,
          nflTeam: playerIdentityMap.nflTeam
        })
        .from(playerIdentityMap)
        .where(eq(playerIdentityMap.isActive, true));

      console.log(`[AttributesService] Found ${players.length} active players to process`);

      // Step 2: Process each player (start with Sleeper data only for MVP)
      for (const player of players) {
        try {
          await this.collectPlayerAttributes(player, season, week);
          result.processedPlayers++;
        } catch (error) {
          const errorMsg = `Failed to process ${player.otcId}: ${error}`;
          console.error(`[AttributesService] ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      }

      console.log(`[AttributesService] Completed: ${result.processedPlayers}/${players.length} players processed`);
      
      if (result.errors.length > 0) {
        result.success = false;
        console.warn(`[AttributesService] ${result.errors.length} errors occurred during collection`);
      }

    } catch (error) {
      console.error(`[AttributesService] Fatal error during attribute collection:`, error);
      result.success = false;
      result.errors.push(`Fatal error: ${error}`);
    }

    return result;
  }

  /**
   * Collect attributes for a single player from available sources
   */
  private async collectPlayerAttributes(
    player: { otcId: string; position: string; sleeperId: string | null; nflTeam: string | null },
    season: number,
    week: number
  ): Promise<void> {
    // Initialize attribute object with base data
    const attributes: InsertPlayerAttributes = {
      season,
      week,
      otcId: player.otcId,
      team: player.nflTeam || 'FA',
      position: player.position,
      
      // Player identification
      playerName: null,
      nflId: null,
      sleeperId: null,
      
      // Initialize all fields as null (will be filled by data sources)
      carries: null,
      rushingYards: null,
      rushingTds: null,
      targets: null,
      receptions: null,
      receivingYards: null,
      receivingTds: null,
      fantasyPtsHalfppr: null,
      fantasyPtsPpr: null,
      fantasyPtsStandard: null,
      airYards: null,
      yac: null,
      aDOT: null,
      epaTotal: null,
      epaPerPlay: null,
      opposingTeam: null,
      opponentDefRank: null,
      gamePace: null,
      impliedTotal: null,
      depthPosition: null,
      snapPercentage: null,
      targetShare: null,
      teamPlays: null,
      injuryStatus: null,
      questionable: null
    };

    // Step 1 - Collect Sleeper data (game logs, injury status, fantasy points)
    await this.collectSleeperData(attributes, season, week);

    // TODO: Step 2 - Collect nflfastR data (EPA, air yards, YAC, sacks taken) 
    // TODO: Step 3 - Collect OASIS data (opponent team, defensive rank, pace, implied totals)
    
    // Upsert the attributes
    try {
      await this.upsertPlayerAttributes(attributes);
    } catch (error) {
      console.error(`[AttributesService] Failed to upsert attributes for ${player.otcId}:`, error);
      throw error; // Re-throw to be caught by outer error handling
    }
  }

  /**
   * Collect Sleeper API data for a player
   */
  private async collectSleeperData(attributes: InsertPlayerAttributes, season: number, week: number): Promise<void> {
    try {
      // Get player identity mapping
      const identity = await this.getPlayerIdentity(attributes.otcId);
      if (!identity?.sleeperId) {
        console.log(`[AttributesService] No Sleeper ID found for ${attributes.otcId}`);
        return;
      }

      // Fetch Sleeper stats for the specific week
      const sleeperStats = await this.fetchSleeperWeeklyStats(identity.sleeperId, season, week);
      if (!sleeperStats) {
        console.log(`[AttributesService] No Sleeper stats found for ${identity.sleeperId} Week ${week}`);
        return;
      }

      // Map Sleeper data to our schema
      attributes.injuryStatus = sleeperStats.injury_status || null;

      // Basic stats from Sleeper
      attributes.targets = sleeperStats.rec_tgt || null;
      attributes.receptions = sleeperStats.rec || null;
      attributes.receivingYards = sleeperStats.rec_yd || null;
      attributes.receivingTds = sleeperStats.rec_td || null;
      attributes.carries = sleeperStats.rush_att || null;
      attributes.rushingYards = sleeperStats.rush_yd || null;
      attributes.rushingTds = sleeperStats.rush_td || null;
      // Fantasy points
      attributes.fantasyPtsHalfppr = sleeperStats.pts_half_ppr || null;
      attributes.passCmp = sleeperStats.pass_cmp || null;
      attributes.passYd = sleeperStats.pass_yd || null;
      attributes.passTd = sleeperStats.pass_td || null;
      attributes.passInt = sleeperStats.pass_int || null;
      attributes.fumblesLost = sleeperStats.fum_lost || null;
      attributes.twoPtMade = sleeperStats.pass_2pt || sleeperStats.rec_2pt || sleeperStats.rush_2pt || null;

      // Fantasy points calculation (using standard scoring for now)
      const fantasyPts = this.calculateFantasyPoints(sleeperStats);
      attributes.fantasyPtsHalfppr = fantasyPts;

      console.log(`[AttributesService] Sleeper data collected for ${identity.name}: ${fantasyPts} pts`);

    } catch (error) {
      console.error(`[AttributesService] Error collecting Sleeper data:`, error);
    }
  }

  /**
   * Get player identity from the player identity map
   */
  private async getPlayerIdentity(otcId: string): Promise<any> {
    try {
      const result = await db
        .select()
        .from(playerIdentityMap)
        .where(eq(playerIdentityMap.canonicalId, otcId))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      console.error(`[AttributesService] Error fetching player identity for ${otcId}:`, error);
      return null;
    }
  }

  /**
   * Fetch weekly stats from Sleeper API
   */
  private async fetchSleeperWeeklyStats(sleeperId: string, season: number, week: number): Promise<any> {
    try {
      const response = await fetch(`https://api.sleeper.app/v1/stats/nfl/regular/${season}/${week}`);
      if (!response.ok) {
        throw new Error(`Sleeper API error: ${response.status}`);
      }

      const data = await response.json();
      return data[sleeperId] || null;
    } catch (error) {
      console.error(`[AttributesService] Error fetching Sleeper stats:`, error);
      return null;
    }
  }

  /**
   * Calculate fantasy points using half-PPR scoring
   */
  private calculateFantasyPoints(stats: any): number {
    const passingYds = stats.pass_yd || 0;
    const passingTds = stats.pass_td || 0;
    const passingInt = stats.pass_int || 0;
    const rushingYds = stats.rush_yd || 0;
    const rushingTds = stats.rush_td || 0;
    const receivingYds = stats.rec_yd || 0;
    const receivingTds = stats.rec_td || 0;
    const receptions = stats.rec || 0;
    const fumbles = stats.fum_lost || 0;

    // Half PPR scoring (0.5 pts per reception)
    const halfPpr = (
      (passingYds * 0.04) + // 1 pt per 25 yards
      (passingTds * 4) +
      (passingInt * -2) +
      (rushingYds * 0.1) + // 1 pt per 10 yards
      (rushingTds * 6) +
      (receivingYds * 0.1) + // 1 pt per 10 yards
      (receivingTds * 6) +
      (receptions * 0.5) + // Half PPR
      (fumbles * -2)
    );

    return Math.round(halfPpr * 100) / 100;
  }

  /**
   * Calculate derived attributes (like aDOT from air_yards/targets)
   */
  private calculateDerivedAttributes(attributes: Partial<InsertPlayerAttributes>): void {
    // Calculate aDOT (Average Depth of Target) if we have air_yards and targets
    if (attributes.airYards !== null && attributes.airYards !== undefined && 
        attributes.targets !== null && attributes.targets !== undefined && attributes.targets > 0) {
      attributes.aDOT = attributes.airYards / attributes.targets;
    }

    // Calculate EPA per play if we have EPA total and play counts
    if (attributes.epaTotal !== null && attributes.epaTotal !== undefined &&
        attributes.teamPlays !== null && attributes.teamPlays !== undefined && attributes.teamPlays > 0) {
      attributes.epaPerPlay = attributes.epaTotal / attributes.teamPlays;
    }
  }

  /**
   * Cache management
   */
  private isCacheValid(key: string): boolean {
    const timestamp = this.cacheTimestamp.get(key);
    if (!timestamp) return false;
    
    return Date.now() - timestamp < this.CACHE_TTL_MS;
  }

  private clearCache(): void {
    this.cache.clear();
    this.cacheTimestamp.clear();
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(season: number, week: number): Promise<{
    totalPlayers: number;
    byPosition: Record<string, number>;
    latestUpdate: Date | null;
    completenessScore: number;
  }> {
    try {
      const players = await this.getWeeklyAttributes(season, week, undefined, undefined, 1000);
      
      const byPosition: Record<string, number> = {};
      let latestUpdate: Date | null = null;
      let nonNullFields = 0;
      let totalFields = 0;

      for (const player of players) {
        // Count by position
        byPosition[player.position] = (byPosition[player.position] || 0) + 1;
        
        // Track latest update
        if (!latestUpdate || (player.updatedAt && player.updatedAt > latestUpdate)) {
          latestUpdate = player.updatedAt;
        }
        
        // Calculate completeness (count non-null statistical fields)
        const statFields = [
          player.passAtt, player.passCmp, player.passYd, player.passTd, player.passInt,
          player.rushAtt, player.rushYd, player.rushTd,
          player.targets, player.receptions, player.recYd, player.recTd,
          player.airYards, player.yac, player.epaTotal,
          player.fantasyPtsHalfppr
        ];
        
        statFields.forEach(field => {
          totalFields++;
          if (field !== null) nonNullFields++;
        });
      }

      const completenessScore = totalFields > 0 ? (nonNullFields / totalFields) * 100 : 0;

      return {
        totalPlayers: players.length,
        byPosition,
        latestUpdate,
        completenessScore: Math.round(completenessScore * 100) / 100
      };
    } catch (error) {
      console.error(`[AttributesService] Error getting processing stats:`, error);
      return {
        totalPlayers: 0,
        byPosition: {},
        latestUpdate: null,
        completenessScore: 0
      };
    }
  }
}

export const attributesService = new AttributesService();