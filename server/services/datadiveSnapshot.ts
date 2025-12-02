import { db } from "../infra/db";
import { eq, and, sql, isNull, count, countDistinct, lte, desc } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import {
  datadiveSnapshotMeta,
  datadivePlayerWeekStaging,
  datadivePlayerSeasonStaging,
  datadiveSnapshotPlayerWeek,
  datadiveSnapshotPlayerSeason,
  weeklyStats,
  silverPlayerWeeklyStats,
  bronzeNflfastrSnapCounts,
  playerIdentityMap,
  type DatadiveSnapshotMeta,
  type DatadiveSnapshotPlayerWeek,
  type DatadiveSnapshotPlayerSeason,
} from "@shared/schema";

interface SnapshotValidation {
  rowCount: number;
  teamCount: number;
  nullPlayerIds: number;
  nullTeamIds: number;
  errors: string[];
}

interface SnapshotResult {
  snapshotId: number;
  season: number;
  week: number;
  rowCount: number;
  teamCount: number;
  validationPassed: boolean;
}

export class DatadiveSnapshotService {
  private readonly MIN_ROWS = 200;
  private readonly MIN_TEAMS = 28;

  async runWeeklySnapshot(
    season: number,
    week: number,
    dataVersion: string = "v1",
    triggeredBy: string = "system"
  ): Promise<SnapshotResult> {
    console.log(`📸 [DataDive] Starting snapshot for ${season} Week ${week}...`);

    try {
      await this.clearStagingData(season, week);

      await this.populateWeeklyStaging(season, week);

      const validation = await this.validateStagingData(season, week);

      if (validation.errors.length > 0) {
        console.error(`❌ [DataDive] Validation failed:`, validation.errors);
        throw new Error(`Snapshot validation failed: ${validation.errors.join("; ")}`);
      }

      const snapshotId = await this.createSnapshot(
        season,
        week,
        dataVersion,
        triggeredBy,
        validation
      );

      await this.copyToSnapshotPlayerWeek(snapshotId, season, week);
      
      // Validate core metrics aren't NULL after snapshot copy
      await this.validateSnapshotCoreMetrics(snapshotId, season, week);

      await this.buildSeasonAggregates(snapshotId, season, week);

      console.log(`✅ [DataDive] Snapshot ${snapshotId} completed successfully`);

      return {
        snapshotId,
        season,
        week,
        rowCount: validation.rowCount,
        teamCount: validation.teamCount,
        validationPassed: true,
      };
    } catch (error) {
      console.error(`❌ [DataDive] Snapshot failed:`, error);
      throw error;
    }
  }

  private async clearStagingData(season: number, week: number): Promise<void> {
    console.log(`🧹 [DataDive] Clearing staging data for ${season} Week ${week}`);

    await db
      .delete(datadivePlayerWeekStaging)
      .where(
        and(
          eq(datadivePlayerWeekStaging.season, season),
          eq(datadivePlayerWeekStaging.week, week)
        )
      );
  }

  private async populateWeeklyStaging(season: number, week: number): Promise<void> {
    console.log(`📥 [DataDive] Populating staging from weekly_stats...`);

    const weeklyData = await db
      .select()
      .from(weeklyStats)
      .where(
        and(
          eq(weeklyStats.season, season),
          eq(weeklyStats.week, week)
        )
      );

    console.log(`📊 [DataDive] Found ${weeklyData.length} rows in weekly_stats`);

    // Load player_identity_map for canonical names and positions
    const identityData = await db
      .select({
        nflDataPyId: playerIdentityMap.nflDataPyId,
        fullName: playerIdentityMap.fullName,
        position: playerIdentityMap.position,
      })
      .from(playerIdentityMap)
      .where(sql`${playerIdentityMap.nflDataPyId} IS NOT NULL`);

    // Create lookup map by nfl_data_py_id
    const identityMap = new Map<string, { fullName: string; position: string | null }>();
    for (const identity of identityData) {
      if (identity.nflDataPyId) {
        identityMap.set(identity.nflDataPyId, {
          fullName: identity.fullName,
          position: identity.position,
        });
      }
    }
    console.log(`📊 [DataDive] Loaded ${identityMap.size} player identities for canonical mapping`);

    // Load snap counts from bronze_nflfastr_snap_counts
    const snapCounts = await db
      .select()
      .from(bronzeNflfastrSnapCounts)
      .where(
        and(
          eq(bronzeNflfastrSnapCounts.season, season),
          eq(bronzeNflfastrSnapCounts.week, week)
        )
      );

    const snapMap = new Map<string, { snaps: number; snapPct: number }>();
    for (const snap of snapCounts) {
      if (snap.player && snap.offenseSnaps) {
        snapMap.set(snap.player.toLowerCase(), {
          snaps: snap.offenseSnaps || 0,
          snapPct: snap.offensePct || 0,
        });
      }
    }
    console.log(`📊 [DataDive] Loaded ${snapMap.size} snap counts`);

    // Aggregate advanced receiving metrics from play-by-play data
    const receivingPbp = await db.execute(sql`
      SELECT 
        receiver_player_id as player_id,
        SUM(air_yards) as total_air_yards,
        SUM(yards_after_catch) as total_yac,
        SUM(epa) as total_epa,
        COUNT(*) as play_count,
        SUM(CASE WHEN epa > 0 THEN 1 ELSE 0 END) as success_count
      FROM bronze_nflfastr_plays
      WHERE season = ${season} AND week = ${week} AND receiver_player_id IS NOT NULL
      GROUP BY receiver_player_id
    `);
    
    const receivingAdvMap = new Map<string, { 
      airYards: number; 
      yac: number; 
      totalEpa: number; 
      playCount: number; 
      successCount: number 
    }>();
    for (const row of (receivingPbp as any).rows || []) {
      receivingAdvMap.set(row.player_id, {
        airYards: Number(row.total_air_yards) || 0,
        yac: Number(row.total_yac) || 0,
        totalEpa: Number(row.total_epa) || 0,
        playCount: Number(row.play_count) || 0,
        successCount: Number(row.success_count) || 0,
      });
    }
    console.log(`📊 [DataDive] Loaded ${receivingAdvMap.size} receiving advanced metrics from PBP`);

    // Aggregate advanced rushing metrics from play-by-play data
    const rushingPbp = await db.execute(sql`
      SELECT 
        rusher_player_id as player_id,
        SUM(epa) as total_epa,
        COUNT(*) as play_count,
        SUM(CASE WHEN epa > 0 THEN 1 ELSE 0 END) as success_count
      FROM bronze_nflfastr_plays
      WHERE season = ${season} AND week = ${week} AND rusher_player_id IS NOT NULL
      GROUP BY rusher_player_id
    `);

    const rushingAdvMap = new Map<string, { 
      totalEpa: number; 
      playCount: number; 
      successCount: number 
    }>();
    for (const row of (rushingPbp as any).rows || []) {
      rushingAdvMap.set(row.player_id, {
        totalEpa: Number(row.total_epa) || 0,
        playCount: Number(row.play_count) || 0,
        successCount: Number(row.success_count) || 0,
      });
    }
    console.log(`📊 [DataDive] Loaded ${rushingAdvMap.size} rushing advanced metrics from PBP`);

    // Load silver data as fallback (may be empty for recent weeks)
    const silverData = await db
      .select()
      .from(silverPlayerWeeklyStats)
      .where(
        and(
          eq(silverPlayerWeeklyStats.season, season),
          eq(silverPlayerWeeklyStats.week, week)
        )
      );

    const silverMap = new Map<string, typeof silverData[0]>();
    for (const row of silverData) {
      silverMap.set(row.playerId, row);
    }
    console.log(`📊 [DataDive] Loaded ${silverMap.size} silver stats (fallback)`);

    let identityMatchCount = 0;
    let identityMissCount = 0;

    const stagingRows = weeklyData.map((row) => {
      const snapInfo = snapMap.get(row.playerName?.toLowerCase() || "");
      const silver = silverMap.get(row.playerId);
      const recAdv = receivingAdvMap.get(row.playerId);
      const rushAdv = rushingAdvMap.get(row.playerId);
      
      // Get canonical name and position from identity map
      const identity = identityMap.get(row.playerId);
      if (identity) {
        identityMatchCount++;
      } else {
        identityMissCount++;
      }
      
      // Use identity map for canonical data, fallback to weekly_stats
      const playerName = identity?.fullName || row.playerName;
      const position = identity?.position?.toUpperCase() || row.position?.toUpperCase() || null;

      const routes = row.routes || 0;
      const targets = row.targets || 0;
      const recYards = row.recYd || 0;
      const snaps = snapInfo?.snaps || row.snaps || 0;
      const rushAtt = row.rushAtt || 0;
      const rushYd = row.rushYd || 0;

      const tprr = routes > 0 ? targets / routes : null;
      const yprr = routes > 0 ? recYards / routes : null;
      const ypc = rushAtt > 0 ? rushYd / rushAtt : null;
      
      // Advanced receiving metrics from PBP (preferred) or silver (fallback)
      const airYards = recAdv?.airYards ?? silver?.airYards ?? 0;
      const yac = recAdv?.yac ?? silver?.yac ?? 0;
      const aDot = targets > 0 ? airYards / targets : null;
      
      // EPA per target (receiving)
      const recEpa = recAdv?.totalEpa ?? (silver?.receivingEpa ? Number(silver.receivingEpa) : null);
      const epaPerTarget = recEpa !== null && targets > 0 ? recEpa / targets : null;
      
      // Success rate = successful plays / total plays (EPA > 0 = success)
      const recPlayCount = recAdv?.playCount ?? 0;
      const recSuccessCount = recAdv?.successCount ?? 0;
      const successRate = recPlayCount > 0 ? recSuccessCount / recPlayCount : null;
      
      // Rush EPA
      const rushEpa = rushAdv?.totalEpa ?? (silver?.rushingEpa ? Number(silver.rushingEpa) : null);
      const rushEpaPerPlay = rushEpa !== null && rushAtt > 0 ? rushEpa / rushAtt : null;

      return {
        season,
        week,
        playerId: row.playerId,
        playerName,
        teamId: row.team,
        position,
        snaps,
        snapShare: snapInfo?.snapPct || null,
        routes,
        routeRate: snaps > 0 ? routes / snaps : null,
        targets,
        targetShare: null,
        receptions: row.rec || 0,
        recYards,
        recTds: row.recTd || 0,
        aDot,
        airYards,
        yac,
        tprr,
        yprr,
        epaPerPlay: epaPerTarget,
        epaPerTarget,
        successRate,
        rushAttempts: rushAtt,
        rushYards: rushYd,
        rushTds: row.rushTd || 0,
        yardsPerCarry: ypc,
        rushEpaPerPlay,
        fptsStd: row.fantasyPointsStd || 0,
        fptsHalf: row.fantasyPointsHalf || 0,
        fptsPpr: row.fantasyPointsPpr || 0,
      };
    });
    
    console.log(`📊 [DataDive] Identity map matches: ${identityMatchCount}, misses: ${identityMissCount}`);

    if (stagingRows.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < stagingRows.length; i += chunkSize) {
        const chunk = stagingRows.slice(i, i + chunkSize);
        await db.insert(datadivePlayerWeekStaging).values(chunk);
      }
    }

    console.log(`📊 [DataDive] Inserted ${stagingRows.length} rows into staging`);
  }

  private async validateStagingData(
    season: number,
    week: number
  ): Promise<SnapshotValidation> {
    console.log(`🔍 [DataDive] Validating staging data...`);

    const [rowResult] = await db
      .select({ count: count() })
      .from(datadivePlayerWeekStaging)
      .where(
        and(
          eq(datadivePlayerWeekStaging.season, season),
          eq(datadivePlayerWeekStaging.week, week)
        )
      );
    const rowCount = rowResult?.count || 0;

    const [teamResult] = await db
      .select({ count: countDistinct(datadivePlayerWeekStaging.teamId) })
      .from(datadivePlayerWeekStaging)
      .where(
        and(
          eq(datadivePlayerWeekStaging.season, season),
          eq(datadivePlayerWeekStaging.week, week)
        )
      );
    const teamCount = teamResult?.count || 0;

    const [nullPlayerResult] = await db
      .select({ count: count() })
      .from(datadivePlayerWeekStaging)
      .where(
        and(
          eq(datadivePlayerWeekStaging.season, season),
          eq(datadivePlayerWeekStaging.week, week),
          isNull(datadivePlayerWeekStaging.playerId)
        )
      );
    const nullPlayerIds = nullPlayerResult?.count || 0;

    const [nullTeamResult] = await db
      .select({ count: count() })
      .from(datadivePlayerWeekStaging)
      .where(
        and(
          eq(datadivePlayerWeekStaging.season, season),
          eq(datadivePlayerWeekStaging.week, week),
          isNull(datadivePlayerWeekStaging.teamId)
        )
      );
    const nullTeamIds = nullTeamResult?.count || 0;

    const errors: string[] = [];

    if (rowCount < this.MIN_ROWS) {
      errors.push(`Row count ${rowCount} is below minimum ${this.MIN_ROWS}`);
    }

    if (teamCount < this.MIN_TEAMS) {
      errors.push(`Team count ${teamCount} is below minimum ${this.MIN_TEAMS}`);
    }

    if (nullPlayerIds > 0) {
      errors.push(`Found ${nullPlayerIds} rows with null player_id`);
    }

    console.log(`📊 [DataDive] Validation: ${rowCount} rows, ${teamCount} teams, ${errors.length} errors`);

    return {
      rowCount,
      teamCount,
      nullPlayerIds,
      nullTeamIds,
      errors,
    };
  }

  private async createSnapshot(
    season: number,
    week: number,
    dataVersion: string,
    triggeredBy: string,
    validation: SnapshotValidation
  ): Promise<number> {
    console.log(`📝 [DataDive] Creating snapshot metadata...`);

    // Prevent duplicate official snapshots: mark any existing official snapshots for this week as non-official
    const existingOfficial = await db
      .select({ id: datadiveSnapshotMeta.id })
      .from(datadiveSnapshotMeta)
      .where(
        and(
          eq(datadiveSnapshotMeta.season, season),
          eq(datadiveSnapshotMeta.week, week),
          eq(datadiveSnapshotMeta.isOfficial, true)
        )
      );

    if (existingOfficial.length > 0) {
      console.log(`⚠️ [DataDive] Found ${existingOfficial.length} existing official snapshot(s) for ${season} Week ${week}, marking as non-official`);
      await db
        .update(datadiveSnapshotMeta)
        .set({ isOfficial: false })
        .where(
          and(
            eq(datadiveSnapshotMeta.season, season),
            eq(datadiveSnapshotMeta.week, week),
            eq(datadiveSnapshotMeta.isOfficial, true)
          )
        );
    }

    const [result] = await db
      .insert(datadiveSnapshotMeta)
      .values({
        season,
        week,
        dataVersion,
        isOfficial: true,
        rowCount: validation.rowCount,
        teamCount: validation.teamCount,
        validationPassed: validation.errors.length === 0,
        validationErrors:
          validation.errors.length > 0 ? validation.errors.join("; ") : null,
        triggeredBy,
      })
      .returning({ id: datadiveSnapshotMeta.id });

    console.log(`📝 [DataDive] Created snapshot with ID ${result.id}`);
    return result.id;
  }

  private async copyToSnapshotPlayerWeek(
    snapshotId: number,
    season: number,
    week: number
  ): Promise<void> {
    console.log(`📋 [DataDive] Copying staging to snapshot_player_week...`);

    const stagingData = await db
      .select()
      .from(datadivePlayerWeekStaging)
      .where(
        and(
          eq(datadivePlayerWeekStaging.season, season),
          eq(datadivePlayerWeekStaging.week, week)
        )
      );

    const snapshotRows = stagingData.map((row) => ({
      snapshotId,
      season: row.season,
      week: row.week,
      playerId: row.playerId,
      playerName: row.playerName,
      teamId: row.teamId,
      position: row.position,
      snaps: row.snaps,
      snapShare: row.snapShare,
      routes: row.routes,
      routeRate: row.routeRate,
      targets: row.targets,
      targetShare: row.targetShare,
      receptions: row.receptions,
      recYards: row.recYards,
      recTds: row.recTds,
      aDot: row.aDot,
      airYards: row.airYards,
      yac: row.yac,
      tprr: row.tprr,
      yprr: row.yprr,
      epaPerPlay: row.epaPerPlay,
      epaPerTarget: row.epaPerTarget,
      successRate: row.successRate,
      rushAttempts: row.rushAttempts,
      rushYards: row.rushYards,
      rushTds: row.rushTds,
      yardsPerCarry: row.yardsPerCarry,
      rushEpaPerPlay: row.rushEpaPerPlay,
      fptsStd: row.fptsStd,
      fptsHalf: row.fptsHalf,
      fptsPpr: row.fptsPpr,
    }));

    if (snapshotRows.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < snapshotRows.length; i += chunkSize) {
        const chunk = snapshotRows.slice(i, i + chunkSize);
        await db.insert(datadiveSnapshotPlayerWeek).values(chunk);
      }
    }

    console.log(`📋 [DataDive] Copied ${snapshotRows.length} rows to snapshot`);
  }

  private async validateSnapshotCoreMetrics(
    snapshotId: number,
    season: number,
    week: number
  ): Promise<void> {
    console.log(`🔍 [DataDive] Validating core metrics for snapshot ${snapshotId}...`);
    
    // Check staging data for NULLs before coercion (more accurate check)
    const stagingValidation = await db.execute(sql`
      SELECT 
        COUNT(*) AS total_rows,
        COUNT(*) FILTER (WHERE fpts_ppr IS NULL) AS null_fpts_ppr,
        COUNT(*) FILTER (WHERE routes IS NULL) AS null_routes,
        COUNT(*) FILTER (WHERE targets IS NULL) AS null_targets,
        COUNT(*) FILTER (WHERE snaps IS NULL) AS null_snaps,
        COUNT(*) FILTER (WHERE receptions IS NULL) AS null_receptions
      FROM datadive_player_week_staging
      WHERE season = ${season} AND week = ${week};
    `);
    
    const row = (stagingValidation as any).rows[0];
    const totalRows = Number(row?.total_rows) || 0;
    const nullFptsPpr = Number(row?.null_fpts_ppr) || 0;
    const nullRoutes = Number(row?.null_routes) || 0;
    const nullTargets = Number(row?.null_targets) || 0;
    const nullSnaps = Number(row?.null_snaps) || 0;
    const nullReceptions = Number(row?.null_receptions) || 0;
    
    console.log(`📊 [DataDive] Core metric staging validation: ${totalRows} rows, nulls: fptsPpr=${nullFptsPpr}, routes=${nullRoutes}, targets=${nullTargets}, snaps=${nullSnaps}, receptions=${nullReceptions}`);
    
    const errors: string[] = [];
    if (nullFptsPpr > 0) errors.push(`${nullFptsPpr} rows with NULL fpts_ppr`);
    if (nullRoutes > 0) errors.push(`${nullRoutes} rows with NULL routes`);
    if (nullTargets > 0) errors.push(`${nullTargets} rows with NULL targets`);
    if (nullSnaps > 0) errors.push(`${nullSnaps} rows with NULL snaps`);
    if (nullReceptions > 0) errors.push(`${nullReceptions} rows with NULL receptions`);
    
    if (errors.length > 0) {
      console.warn(`⚠️ [DataDive] Core metric nulls detected in staging (continuing): ${errors.join(', ')}`);
    } else {
      console.log(`✅ [DataDive] All core metrics validated in staging - no NULLs`);
    }
  }

  private async buildSeasonAggregates(
    snapshotId: number,
    season: number,
    throughWeek: number
  ): Promise<void> {
    console.log(`📊 [DataDive] Building season aggregates through Week ${throughWeek}...`);

    const allWeeklyData = await db
      .select()
      .from(datadiveSnapshotPlayerWeek)
      .where(
        and(
          eq(datadiveSnapshotPlayerWeek.season, season),
          lte(datadiveSnapshotPlayerWeek.week, throughWeek)
        )
      );

    const playerAggregates = new Map<
      string,
      {
        playerId: string;
        playerName: string;
        teamId: string | null;
        position: string | null;
        gamesPlayed: number;
        totalSnaps: number;
        snapShares: number[];
        totalRoutes: number;
        routeRates: number[];
        totalTargets: number;
        targetShares: number[];
        totalReceptions: number;
        totalRecYards: number;
        totalRecTds: number;
        aDots: number[];
        totalAirYards: number;
        totalYac: number;
        tprrs: number[];
        yprrs: number[];
        epas: number[];
        successRates: number[];
        totalRushAttempts: number;
        totalRushYards: number;
        totalRushTds: number;
        ypcs: number[];
        totalFptsStd: number;
        totalFptsHalf: number;
        totalFptsPpr: number;
      }
    >();

    // Helper to check if value is defined (not null/undefined)
    const isDefined = (val: any): val is number => val !== null && val !== undefined;
    
    for (const row of allWeeklyData) {
      const existing = playerAggregates.get(row.playerId);
      
      // Only count as a game played if player had snaps > 0 or routes > 0 (actually participated)
      const snaps = row.snaps ?? 0;
      const routes = row.routes ?? 0;
      const countAsGame = snaps > 0 || routes > 0;

      if (existing) {
        if (countAsGame) existing.gamesPlayed++;
        existing.totalSnaps += snaps;
        if (isDefined(row.snapShare)) existing.snapShares.push(row.snapShare);
        existing.totalRoutes += routes;
        if (isDefined(row.routeRate)) existing.routeRates.push(row.routeRate);
        existing.totalTargets += row.targets ?? 0;
        if (isDefined(row.targetShare)) existing.targetShares.push(row.targetShare);
        existing.totalReceptions += row.receptions ?? 0;
        existing.totalRecYards += row.recYards ?? 0;
        existing.totalRecTds += row.recTds ?? 0;
        if (isDefined(row.aDot)) existing.aDots.push(row.aDot);
        existing.totalAirYards += row.airYards ?? 0;
        existing.totalYac += row.yac ?? 0;
        if (isDefined(row.tprr)) existing.tprrs.push(row.tprr);
        if (isDefined(row.yprr)) existing.yprrs.push(row.yprr);
        if (isDefined(row.epaPerPlay)) existing.epas.push(row.epaPerPlay);
        if (isDefined(row.successRate)) existing.successRates.push(row.successRate);
        existing.totalRushAttempts += row.rushAttempts ?? 0;
        existing.totalRushYards += row.rushYards ?? 0;
        existing.totalRushTds += row.rushTds ?? 0;
        if (isDefined(row.yardsPerCarry)) existing.ypcs.push(row.yardsPerCarry);
        existing.totalFptsStd += row.fptsStd ?? 0;
        existing.totalFptsHalf += row.fptsHalf ?? 0;
        existing.totalFptsPpr += row.fptsPpr ?? 0;
        existing.teamId = row.teamId;
      } else {
        playerAggregates.set(row.playerId, {
          playerId: row.playerId,
          playerName: row.playerName,
          teamId: row.teamId,
          position: row.position,
          gamesPlayed: countAsGame ? 1 : 0,
          totalSnaps: snaps,
          snapShares: isDefined(row.snapShare) ? [row.snapShare] : [],
          totalRoutes: routes,
          routeRates: isDefined(row.routeRate) ? [row.routeRate] : [],
          totalTargets: row.targets ?? 0,
          targetShares: isDefined(row.targetShare) ? [row.targetShare] : [],
          totalReceptions: row.receptions ?? 0,
          totalRecYards: row.recYards ?? 0,
          totalRecTds: row.recTds ?? 0,
          aDots: isDefined(row.aDot) ? [row.aDot] : [],
          totalAirYards: row.airYards ?? 0,
          totalYac: row.yac ?? 0,
          tprrs: isDefined(row.tprr) ? [row.tprr] : [],
          yprrs: isDefined(row.yprr) ? [row.yprr] : [],
          epas: isDefined(row.epaPerPlay) ? [row.epaPerPlay] : [],
          successRates: isDefined(row.successRate) ? [row.successRate] : [],
          totalRushAttempts: row.rushAttempts ?? 0,
          totalRushYards: row.rushYards ?? 0,
          totalRushTds: row.rushTds ?? 0,
          ypcs: isDefined(row.yardsPerCarry) ? [row.yardsPerCarry] : [],
          totalFptsStd: row.fptsStd ?? 0,
          totalFptsHalf: row.fptsHalf ?? 0,
          totalFptsPpr: row.fptsPpr ?? 0,
        });
      }
    }

    const avg = (arr: number[]) =>
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;

    const seasonRows = Array.from(playerAggregates.values()).map((agg) => ({
      snapshotId,
      season,
      throughWeek,
      playerId: agg.playerId,
      playerName: agg.playerName,
      teamId: agg.teamId,
      position: agg.position,
      gamesPlayed: agg.gamesPlayed,
      totalSnaps: agg.totalSnaps,
      avgSnapShare: avg(agg.snapShares),
      totalRoutes: agg.totalRoutes,
      avgRouteRate: avg(agg.routeRates),
      totalTargets: agg.totalTargets,
      avgTargetShare: avg(agg.targetShares),
      totalReceptions: agg.totalReceptions,
      totalRecYards: agg.totalRecYards,
      totalRecTds: agg.totalRecTds,
      avgAdot: avg(agg.aDots),
      totalAirYards: agg.totalAirYards,
      totalYac: agg.totalYac,
      avgTprr: avg(agg.tprrs),
      avgYprr: avg(agg.yprrs),
      avgEpaPerPlay: avg(agg.epas),
      avgSuccessRate: avg(agg.successRates),
      totalRushAttempts: agg.totalRushAttempts,
      totalRushYards: agg.totalRushYards,
      totalRushTds: agg.totalRushTds,
      avgYpc: avg(agg.ypcs),
      totalFptsStd: agg.totalFptsStd,
      totalFptsHalf: agg.totalFptsHalf,
      totalFptsPpr: agg.totalFptsPpr,
      avgFptsPerGame:
        agg.gamesPlayed > 0 ? agg.totalFptsPpr / agg.gamesPlayed : null,
    }));

    if (seasonRows.length > 0) {
      const chunkSize = 100;
      for (let i = 0; i < seasonRows.length; i += chunkSize) {
        const chunk = seasonRows.slice(i, i + chunkSize);
        await db.insert(datadiveSnapshotPlayerSeason).values(chunk);
      }
    }

    console.log(
      `📊 [DataDive] Created ${seasonRows.length} season aggregate rows`
    );
  }

  async getLatestOfficialSnapshot(): Promise<DatadiveSnapshotMeta | null> {
    const [result] = await db
      .select()
      .from(datadiveSnapshotMeta)
      .where(eq(datadiveSnapshotMeta.isOfficial, true))
      .orderBy(desc(datadiveSnapshotMeta.snapshotAt))
      .limit(1);

    return result || null;
  }

  async getSnapshotPlayerWeek(
    snapshotId: number,
    filters?: {
      playerId?: string;
      playerName?: string;
      teamId?: string;
      position?: string;
      minRoutes?: number;
      minSnaps?: number;
    }
  ): Promise<DatadiveSnapshotPlayerWeek[]> {
    let query = db
      .select()
      .from(datadiveSnapshotPlayerWeek)
      .where(eq(datadiveSnapshotPlayerWeek.snapshotId, snapshotId));

    const results = await query;

    let filtered = results;
    if (filters) {
      filtered = results.filter((row) => {
        if (filters.playerId && row.playerId !== filters.playerId) return false;
        if (
          filters.playerName &&
          !row.playerName.toLowerCase().includes(filters.playerName.toLowerCase())
        )
          return false;
        if (filters.teamId && row.teamId !== filters.teamId) return false;
        if (filters.position && row.position !== filters.position) return false;
        if (filters.minRoutes && (row.routes || 0) < filters.minRoutes)
          return false;
        if (filters.minSnaps && (row.snaps || 0) < filters.minSnaps) return false;
        return true;
      });
    }

    return filtered;
  }

  async getSnapshotPlayerSeason(
    playerId: string,
    season: number
  ): Promise<DatadiveSnapshotPlayerSeason | null> {
    const [result] = await db
      .select()
      .from(datadiveSnapshotPlayerSeason)
      .where(
        and(
          eq(datadiveSnapshotPlayerSeason.playerId, playerId),
          eq(datadiveSnapshotPlayerSeason.season, season)
        )
      )
      .orderBy(desc(datadiveSnapshotPlayerSeason.throughWeek))
      .limit(1);

    return result || null;
  }

  async getTableCounts(): Promise<{
    snapshotMeta: number;
    snapshotPlayerWeek: number;
    snapshotPlayerSeason: number;
    weekStaging: number;
    seasonStaging: number;
  }> {
    const [meta] = await db.select({ count: count() }).from(datadiveSnapshotMeta);
    const [week] = await db.select({ count: count() }).from(datadiveSnapshotPlayerWeek);
    const [season] = await db.select({ count: count() }).from(datadiveSnapshotPlayerSeason);
    const [weekStage] = await db.select({ count: count() }).from(datadivePlayerWeekStaging);
    const [seasonStage] = await db.select({ count: count() }).from(datadivePlayerSeasonStaging);

    return {
      snapshotMeta: meta?.count || 0,
      snapshotPlayerWeek: week?.count || 0,
      snapshotPlayerSeason: season?.count || 0,
      weekStaging: weekStage?.count || 0,
      seasonStaging: seasonStage?.count || 0,
    };
  }
}

export const datadiveSnapshotService = new DatadiveSnapshotService();
