import { db } from '../../infra/db';
import { sql } from 'drizzle-orm';

export type CheckStatus = 'healthy' | 'warning' | 'critical' | 'skipped' | 'info';

export interface AuditCheck {
  key: string;
  status: CheckStatus;
  value?: number;
  details: Record<string, unknown>;
}

export interface FeatureAuditResult {
  status: 'healthy' | 'warning' | 'critical';
  generatedAt: string;
  checks: AuditCheck[];
}

interface AuditParams {
  season?: number;
  week?: number;
  playerId?: string;
}

async function checkRosterBridgeCoverage(): Promise<AuditCheck> {
  try {
    // Branch A: Check if any active league exists (use user_league_preferences like ownershipService)
    const leagueResult = await db.execute(sql`
      SELECT ulp.active_league_id as league_id
      FROM user_league_preferences ulp
      JOIN leagues l ON l.id = ulp.active_league_id
      WHERE ulp.user_id = 'default_user'
        AND l.platform = 'sleeper'
      LIMIT 1
    `);
    
    if ((leagueResult.rows as any[]).length === 0) {
      // Branch A: No active league => SKIPPED
      return {
        key: 'identity.roster_bridge_coverage',
        status: 'skipped',
        details: { 
          note: 'No active league selected/connected.',
          actionHint: 'Connect a Sleeper league to enable roster bridge coverage check.'
        }
      };
    }
    
    const leagueId = (leagueResult.rows as any[])[0].league_id;
    
    // Get diagnostic info: team count and sample teams
    const teamsResult = await db.execute(sql`
      SELECT 
        id as team_id,
        COALESCE(jsonb_array_length(players), 0) as players_count
      FROM league_teams
      WHERE league_id = ${leagueId}
      ORDER BY id
      LIMIT 10
    `);
    
    const allTeams = teamsResult.rows as { team_id: string; players_count: number }[];
    const teamCount = allTeams.length;
    const sampleTeams = allTeams.slice(0, 3).map(t => ({
      teamId: t.team_id,
      playersCount: parseInt(String(t.players_count)) || 0
    }));
    
    // Get roster coverage data
    const rosterResult = await db.execute(sql`
      WITH roster_sleeper_ids AS (
        SELECT DISTINCT jsonb_array_elements_text(players) as sleeper_id
        FROM league_teams
        WHERE league_id = ${leagueId}
          AND players IS NOT NULL
          AND jsonb_array_length(players) > 0
      ),
      mapped_ids AS (
        SELECT 
          r.sleeper_id,
          p.canonical_id
        FROM roster_sleeper_ids r
        LEFT JOIN player_identity_map p ON p.sleeper_id = r.sleeper_id
      )
      SELECT 
        COUNT(*) as total,
        COUNT(DISTINCT sleeper_id) as unique_ids,
        COUNT(canonical_id) as mapped,
        array_agg(sleeper_id) FILTER (WHERE canonical_id IS NULL) as unmapped_ids
      FROM mapped_ids
    `);
    
    const row = (rosterResult.rows as any[])[0] || { total: 0, unique_ids: 0, mapped: 0, unmapped_ids: [] };
    const totalRosterSleeperIds = parseInt(row.total) || 0;
    const uniqueRosterSleeperIds = parseInt(row.unique_ids) || 0;
    const mapped = parseInt(row.mapped) || 0;
    const unmappedIds: string[] = row.unmapped_ids || [];
    
    // Diagnostic payload for debugging
    const diagnostics = {
      leagueId,
      teamCount,
      totalRosterSleeperIds,
      uniqueRosterSleeperIds,
      sampleTeams
    };
    
    // Branch B: League exists but no roster players => CRITICAL
    if (totalRosterSleeperIds === 0) {
      return {
        key: 'identity.roster_bridge_coverage',
        status: 'critical',
        value: 0,
        details: {
          ...diagnostics,
          note: 'Active league set but no roster players found in league_teams.players (roster sync missing).',
          actionHint: 'Run Sleeper roster sync or verify league_teams population.',
          thresholds: { healthy: '>=0.95', warning: '0.85-0.94', critical: '<0.85 or empty rosters' }
        }
      };
    }
    
    // Branch C: Has roster players => compute coverage normally
    const coveragePct = mapped / totalRosterSleeperIds;
    
    let status: CheckStatus = 'healthy';
    if (coveragePct < 0.85) status = 'critical';
    else if (coveragePct < 0.95) status = 'warning';
    
    // Get unmapped sample with player details from unmapped_sleeper_players table
    const unmappedSampleIds = unmappedIds.slice(0, 10);
    let unmappedSample: { sleeperId: string; fullName?: string; position?: string; team?: string }[] = [];
    
    if (unmappedSampleIds.length > 0) {
      const unmappedDetailsResult = await db.execute(sql`
        SELECT sleeper_id, full_name, position, team
        FROM unmapped_sleeper_players
        WHERE sleeper_id = ANY(ARRAY[${sql.join(unmappedSampleIds.map(id => sql`${id}`), sql`, `)}]::text[])
      `);
      
      const detailsMap = new Map((unmappedDetailsResult.rows as any[]).map(r => [r.sleeper_id, r]));
      
      unmappedSample = unmappedSampleIds.map(id => {
        const details = detailsMap.get(id);
        return {
          sleeperId: id,
          fullName: details?.full_name,
          position: details?.position,
          team: details?.team
        };
      });
    }
    
    // Add actionHint for critical status
    const actionHint = status === 'critical' 
      ? 'Run POST /api/league/enrich-roster-identity to improve mapping'
      : status === 'warning' 
        ? 'Consider running identity enrichment to reach 85% coverage'
        : undefined;
    
    return {
      key: 'identity.roster_bridge_coverage',
      status,
      value: Math.round(coveragePct * 100) / 100,
      details: {
        ...diagnostics,
        mapped,
        coveragePct: Math.round(coveragePct * 100) / 100,
        unmappedSample,
        ...(actionHint && { actionHint }),
        thresholds: { healthy: '>=0.95', warning: '0.85-0.94', critical: '<0.85' },
        note: 'Roster coverage is what ownership + player UX depends on.'
      }
    };
  } catch (error) {
    return {
      key: 'identity.roster_bridge_coverage',
      status: 'skipped',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

async function checkGlobalSleeperIdPopulation(): Promise<AuditCheck> {
  try {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(sleeper_id) as with_sleeper,
        COUNT(nfl_data_py_id) as with_nfl_data_py
      FROM player_identity_map
      WHERE is_active = true
    `);
    
    const row = (result.rows as any[])[0] || { total: 0, with_sleeper: 0, with_nfl_data_py: 0 };
    const total = parseInt(row.total) || 0;
    const withSleeper = parseInt(row.with_sleeper) || 0;
    
    const coveragePct = total > 0 ? withSleeper / total : 0;
    
    let status: CheckStatus = 'healthy';
    if (coveragePct < 0.40) status = 'info';
    else if (coveragePct < 0.70) status = 'warning';
    
    return {
      key: 'identity.global_sleeper_id_population',
      status,
      value: Math.round(coveragePct * 100) / 100,
      details: {
        totalActivePlayers: total,
        withSleeperId: withSleeper,
        withNflDataPyId: parseInt(row.with_nfl_data_py) || 0,
        thresholds: { healthy: '>=0.70', warning: '0.40-0.69', info: '<0.40' },
        note: 'Global enrichment metric - does NOT block ownership. Many active players are practice squad/reserves without Sleeper presence.'
      }
    };
  } catch (error) {
    return {
      key: 'identity.global_sleeper_id_population',
      status: 'skipped',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

async function checkEnrichmentRecentActivity(): Promise<AuditCheck> {
  try {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total_count,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as recent_count,
        MAX(created_at) as last_run,
        COUNT(CASE WHEN matched_canonical_id IS NOT NULL THEN 1 END) as matched_count,
        COUNT(DISTINCT match_strategy) as strategies_used
      FROM identity_enrichment_log
    `);
    
    const row = (result.rows as any[])[0] || { total_count: 0, recent_count: 0, last_run: null };
    const totalCount = parseInt(row.total_count) || 0;
    const recentCount = parseInt(row.recent_count) || 0;
    const matchedCount = parseInt(row.matched_count) || 0;
    const strategiesUsed = parseInt(row.strategies_used) || 0;
    
    let status: CheckStatus = 'healthy';
    if (recentCount === 0 && totalCount === 0) {
      status = 'info';
    } else if (recentCount === 0) {
      status = 'info';
    }
    
    // Get strategy breakdown
    const strategyResult = await db.execute(sql`
      SELECT match_strategy, COUNT(*) as count
      FROM identity_enrichment_log
      GROUP BY match_strategy
      ORDER BY count DESC
    `);
    
    const strategyBreakdown: Record<string, number> = {};
    for (const r of strategyResult.rows as any[]) {
      strategyBreakdown[r.match_strategy] = parseInt(r.count);
    }
    
    return {
      key: 'identity.enrichment_recent_activity',
      status,
      value: recentCount,
      details: {
        totalLogs: totalCount,
        recentLogs24h: recentCount,
        matchedTotal: matchedCount,
        matchRate: totalCount > 0 ? Math.round((matchedCount / totalCount) * 100) / 100 : 0,
        lastRun: row.last_run,
        strategiesUsed,
        strategyBreakdown,
        note: 'Tracks identity enrichment runs. Recent activity indicates active maintenance.'
      }
    };
  } catch (error) {
    return {
      key: 'identity.enrichment_recent_activity',
      status: 'skipped',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

async function checkGsisDuplicatesActive(): Promise<AuditCheck> {
  try {
    const result = await db.execute(sql`
      SELECT 
        gsis_id, 
        COUNT(*) as count, 
        array_agg(
          json_build_object(
            'canonical_id', canonical_id,
            'full_name', full_name,
            'position', position,
            'nfl_team', nfl_team
          )
        ) as players
      FROM player_identity_map
      WHERE gsis_id IS NOT NULL
        AND position IN ('QB', 'RB', 'WR', 'TE')
        AND is_active = true
        AND merged_into IS NULL
      GROUP BY gsis_id
      HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC
      LIMIT 10
    `);
    
    const duplicates = result.rows as any[];
    const duplicateCount = duplicates.length;
    
    const duplicateSample = duplicates.map(d => ({
      gsisId: d.gsis_id,
      count: parseInt(d.count),
      canonicalIds: d.players
    }));
    
    return {
      key: 'identity.gsis_duplicates_active',
      status: duplicateCount > 0 ? 'critical' : 'healthy',
      value: duplicateCount,
      details: {
        duplicateCount,
        duplicateSample,
        actionHint: duplicateCount > 0 
          ? 'Use POST /api/identity/resolve-duplicate to mark merged players'
          : undefined,
        note: 'Duplicate GSIS IDs among ACTIVE players break identity resolution'
      }
    };
  } catch (error) {
    return {
      key: 'identity.gsis_duplicates_active',
      status: 'skipped',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

async function checkMergedRowsExcluded(): Promise<AuditCheck> {
  try {
    const result = await db.execute(sql`
      WITH active_counts AS (
        SELECT 
          COUNT(*) FILTER (WHERE is_active = true) as active_count,
          COUNT(*) FILTER (WHERE is_active = true AND merged_into IS NULL) as active_not_merged,
          COUNT(*) FILTER (WHERE is_active = true AND merged_into IS NOT NULL) as active_but_merged,
          COUNT(*) FILTER (WHERE merged_into IS NOT NULL) as total_merged
        FROM player_identity_map
        WHERE position IN ('QB', 'RB', 'WR', 'TE')
      )
      SELECT * FROM active_counts
    `);
    
    const row = (result.rows as any[])[0] || {};
    const activeCount = parseInt(row.active_count) || 0;
    const activeNotMerged = parseInt(row.active_not_merged) || 0;
    const activeButMerged = parseInt(row.active_but_merged) || 0;
    const totalMerged = parseInt(row.total_merged) || 0;
    
    const mergedRowsInflateActive = activeButMerged > 0;
    
    return {
      key: 'identity.merged_rows_excluded',
      status: mergedRowsInflateActive ? 'critical' : 'healthy',
      value: activeButMerged,
      details: {
        activeSkillPlayers: activeCount,
        activeNotMerged,
        activeButMerged,
        totalMergedRows: totalMerged,
        exclusionEnforced: !mergedRowsInflateActive,
        actionHint: mergedRowsInflateActive 
          ? 'Set is_active=false for merged rows (WHERE merged_into IS NOT NULL)'
          : undefined,
        note: 'Merged rows should have is_active=false to not inflate active player counts'
      }
    };
  } catch (error) {
    return {
      key: 'identity.merged_rows_excluded',
      status: 'skipped',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

async function checkEnrichmentQuality(): Promise<AuditCheck> {
  try {
    const result = await db.execute(sql`
      SELECT 
        match_confidence,
        COUNT(*) as count
      FROM identity_enrichment_log
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY match_confidence
    `);
    
    const rows = result.rows as any[];
    const confidenceBreakdown: Record<string, number> = {};
    let total = 0;
    
    for (const row of rows) {
      const confidence = row.match_confidence || 'none';
      const count = parseInt(row.count) || 0;
      confidenceBreakdown[confidence] = count;
      total += count;
    }
    
    if (total === 0) {
      return {
        key: 'identity.enrichment_quality',
        status: 'info',
        details: { 
          note: 'No enrichment runs in last 7 days',
          confidenceBreakdown: {}
        }
      };
    }
    
    const exactCount = confidenceBreakdown['exact'] || 0;
    const highCount = confidenceBreakdown['high'] || 0;
    const mediumCount = confidenceBreakdown['medium'] || 0;
    const noneCount = confidenceBreakdown['none'] || 0;
    
    const exactPct = Math.round((exactCount / total) * 100);
    const highPct = Math.round((highCount / total) * 100);
    const mediumPct = Math.round((mediumCount / total) * 100);
    const nonePct = Math.round((noneCount / total) * 100);
    
    let status: CheckStatus = 'healthy';
    if (mediumPct > 10) {
      status = 'warning';
    }
    
    return {
      key: 'identity.enrichment_quality',
      status,
      value: exactPct + highPct,
      details: {
        total,
        exactPct,
        highPct,
        mediumPct,
        nonePct,
        confidenceBreakdown,
        thresholds: { healthy: 'medium <= 10%', warning: 'medium > 10%' },
        note: 'Quality of identity enrichment matches. High exact/high rates indicate reliable matching.'
      }
    };
  } catch (error) {
    return {
      key: 'identity.enrichment_quality',
      status: 'skipped',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

async function checkMetricMatrixCoverage(season: number, week?: number): Promise<AuditCheck> {
  try {
    const weekFilter = week ? sql`AND week = ${week}` : sql``;
    
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total_rows,
        COUNT(snap_share_pct) as snap_share_non_null,
        COUNT(target_share_pct) as target_share_non_null
      FROM player_usage
      WHERE season = ${season} ${weekFilter}
    `);
    
    const row = (result.rows as any[])[0] || { total_rows: 0, snap_share_non_null: 0 };
    const total = parseInt(row.total_rows) || 0;
    const snapNonNull = parseInt(row.snap_share_non_null) || 0;
    
    if (total === 0) {
      const latestWeekResult = await db.execute(sql`
        SELECT MAX(week) as latest_week FROM player_usage WHERE season = ${season}
      `);
      const latestWeek = (latestWeekResult.rows as any[])[0]?.latest_week;
      
      return {
        key: 'metricMatrix.vectorCoverage',
        status: 'warning',
        value: 0,
        details: {
          season,
          week: week || 'all',
          note: 'No data for requested week',
          latestAvailableWeek: latestWeek || null
        }
      };
    }
    
    const coveragePct = snapNonNull / total;
    
    let status: CheckStatus = 'healthy';
    if (coveragePct < 0.50) status = 'critical';
    else if (coveragePct < 0.80) status = 'warning';
    
    return {
      key: 'metricMatrix.vectorCoverage',
      status,
      value: Math.round(coveragePct * 10000) / 10000,
      details: {
        season,
        week: week || 'all',
        totalRows: total,
        snapShareNonNull: snapNonNull,
        targetShareNonNull: parseInt(row.target_share_non_null) || 0
      }
    };
  } catch (error) {
    return {
      key: 'metricMatrix.vectorCoverage',
      status: 'skipped',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

async function checkPercentScaleSanity(season: number): Promise<AuditCheck> {
  try {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as sample_size,
        COUNT(CASE WHEN target_share_pct > 0 AND target_share_pct <= 1.0 THEN 1 END) as fraction_likely,
        COUNT(CASE WHEN snap_share_pct > 0 AND snap_share_pct <= 1.0 THEN 1 END) as snap_fraction_likely,
        COUNT(CASE WHEN target_share_pct > 100 THEN 1 END) as over_100,
        COUNT(CASE WHEN snap_share_pct IS NULL AND target_share_pct IS NULL THEN 1 END) as null_count
      FROM player_usage
      WHERE season = ${season}
      LIMIT 1000
    `);
    
    const row = (result.rows as any[])[0] || {};
    const sampleSize = parseInt(row.sample_size) || 0;
    const fractionLikely = parseInt(row.fraction_likely) || 0;
    const snapFractionLikely = parseInt(row.snap_fraction_likely) || 0;
    const over100 = parseInt(row.over_100) || 0;
    const nullCount = parseInt(row.null_count) || 0;
    
    const fractionRatio = sampleSize > 0 ? (fractionLikely + snapFractionLikely) / (sampleSize * 2) : 0;
    
    let status: CheckStatus = 'healthy';
    if (fractionRatio > 0.50) status = 'critical';
    else if (fractionRatio > 0.10 || over100 > 0) status = 'warning';
    
    return {
      key: 'metricMatrix.percentScaleSanity',
      status,
      details: {
        season,
        sampleSize,
        fractionLikely,
        snapFractionLikely,
        over100,
        nullCount,
        fractionRatio: Math.round(fractionRatio * 100) / 100,
        note: fractionRatio > 0.10 
          ? 'Many values appear to be in decimal (0-1) format instead of percent (0-100)' 
          : 'Values appear to be in correct percent scale'
      }
    };
  } catch (error) {
    return {
      key: 'metricMatrix.percentScaleSanity',
      status: 'skipped',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

async function checkCacheFreshness(): Promise<AuditCheck> {
  try {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN computed_at > NOW() - INTERVAL '7 days' THEN 1 END) as fresh,
        COUNT(CASE WHEN season = 0 OR week = 0 THEN 1 END) as fallback_rows
      FROM metric_matrix_player_vectors
    `);
    
    const row = (result.rows as any[])[0] || { total: 0, fresh: 0, fallback_rows: 0 };
    const total = parseInt(row.total) || 0;
    const fresh = parseInt(row.fresh) || 0;
    const fallbackRows = parseInt(row.fallback_rows) || 0;
    
    if (total === 0) {
      return {
        key: 'metricMatrix.cacheFreshness',
        status: 'warning',
        value: 0,
        details: { note: 'No cached vectors found - will compute on demand' }
      };
    }
    
    const freshPct = fresh / total;
    
    let status: CheckStatus = 'healthy';
    if (freshPct < 0.50) status = 'critical';
    else if (freshPct < 0.80) status = 'warning';
    
    return {
      key: 'metricMatrix.cacheFreshness',
      status,
      value: Math.round(freshPct * 100) / 100,
      details: {
        totalCached: total,
        freshWithin7Days: fresh,
        fallbackRows,
        staleCount: total - fresh
      }
    };
  } catch (error) {
    return {
      key: 'metricMatrix.cacheFreshness',
      status: 'skipped',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

async function checkPlayerProfileRoutes(playerId: string, season: number, week: number): Promise<AuditCheck> {
  const smokeTests: Record<string, { status: 'pass' | 'fail' | 'skipped'; error?: string }> = {};
  
  try {
    const identityResult = await db.execute(sql`
      SELECT canonical_id, full_name, position 
      FROM player_identity_map 
      WHERE canonical_id = ${playerId}
      LIMIT 1
    `);
    
    if ((identityResult.rows as any[]).length === 0) {
      return {
        key: 'playerProfile.routes',
        status: 'skipped',
        details: { 
          playerId,
          note: 'Smoke test player not found in identity map',
          smokeTests: {}
        }
      };
    }
    
    smokeTests['identity'] = { status: 'pass' };
    
    const usageResult = await db.execute(sql`
      SELECT player_id FROM player_usage 
      WHERE player_id = ${playerId} AND season = ${season}
      LIMIT 1
    `);
    smokeTests['playerUsage'] = (usageResult.rows as any[]).length > 0 
      ? { status: 'pass' } 
      : { status: 'fail', error: 'No usage data for player' };
    
    const allPassed = Object.values(smokeTests).every(t => t.status === 'pass');
    
    return {
      key: 'playerProfile.routes',
      status: allPassed ? 'healthy' : 'warning',
      details: {
        playerId,
        season,
        week,
        smokeTests
      }
    };
  } catch (error) {
    return {
      key: 'playerProfile.routes',
      status: 'skipped',
      details: { 
        playerId,
        error: error instanceof Error ? error.message : 'Unknown error',
        smokeTests
      }
    };
  }
}

async function checkSimilarAndTierNeighbors(playerId: string, season: number): Promise<AuditCheck> {
  const endpointTests: Record<string, { status: 'pass' | 'fail' | 'skipped'; latencyMs?: number; error?: string }> = {};
  
  try {
    const playerCheck = await db.execute(sql`
      SELECT canonical_id, position FROM player_identity_map 
      WHERE canonical_id = ${playerId}
      LIMIT 1
    `);
    
    if ((playerCheck.rows as any[]).length === 0) {
      return {
        key: 'research.similarAndNeighbors',
        status: 'skipped',
        details: { 
          playerId,
          note: 'Test player not found',
          endpointTests: {}
        }
      };
    }
    
    const position = (playerCheck.rows as any[])[0]?.position || 'WR';
    
    const vectorStart = Date.now();
    const vectorResult = await db.execute(sql`
      SELECT player_id FROM metric_matrix_player_vectors 
      WHERE player_id = ${playerId} AND season = ${season}
      LIMIT 1
    `);
    const vectorLatency = Date.now() - vectorStart;
    
    endpointTests['vectorLookup'] = (vectorResult.rows as any[]).length > 0
      ? { status: 'pass', latencyMs: vectorLatency }
      : { status: 'fail', latencyMs: vectorLatency, error: 'No vector cached for player' };
    
    const tiersStart = Date.now();
    const tiersResult = await db.execute(sql`
      SELECT player_id FROM forge_alpha_scores 
      WHERE position = ${position} AND season = ${season}
      LIMIT 5
    `);
    const tiersLatency = Date.now() - tiersStart;
    
    endpointTests['tiersData'] = (tiersResult.rows as any[]).length > 0
      ? { status: 'pass', latencyMs: tiersLatency }
      : { status: 'warning' as any, latencyMs: tiersLatency, error: 'No tier data for position' };
    
    const anyFailed = Object.values(endpointTests).some(t => t.status === 'fail');
    
    return {
      key: 'research.similarAndNeighbors',
      status: anyFailed ? 'warning' : 'healthy',
      details: {
        playerId,
        season,
        position,
        endpointTests
      }
    };
  } catch (error) {
    return {
      key: 'research.similarAndNeighbors',
      status: 'skipped',
      details: { 
        playerId,
        error: error instanceof Error ? error.message : 'Unknown error',
        endpointTests
      }
    };
  }
}

async function checkOwnershipService(): Promise<AuditCheck> {
  try {
    const leagueResult = await db.execute(sql`
      SELECT id, league_id_external FROM leagues WHERE platform = 'sleeper' LIMIT 1
    `);
    
    if ((leagueResult.rows as any[]).length === 0) {
      return {
        key: 'ownership.service',
        status: 'healthy',
        details: { note: 'No leagues configured - ownership disabled by design' }
      };
    }
    
    const leagueId = (leagueResult.rows as any[])[0].id;
    
    const teamsResult = await db.execute(sql`
      SELECT COUNT(*) as team_count FROM league_teams WHERE league_id = ${leagueId}
    `);
    const teamCount = parseInt((teamsResult.rows as any[])[0]?.team_count) || 0;
    
    if (teamCount === 0) {
      return {
        key: 'ownership.service',
        status: 'warning',
        details: { 
          leagueId,
          note: 'League exists but no teams synced'
        }
      };
    }
    
    return {
      key: 'ownership.service',
      status: 'healthy',
      details: {
        leagueId,
        teamCount,
        note: 'Ownership service ready'
      }
    };
  } catch (error) {
    return {
      key: 'ownership.service',
      status: 'skipped',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

// ========================================
// SLEEPER SYNC V2 CHECKS
// ========================================

async function checkSleeperSyncRecent(): Promise<AuditCheck> {
  try {
    // Check if any sync has happened recently (within 2 hours)
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total_leagues,
        COUNT(CASE WHEN status = 'ok' THEN 1 END) as healthy_leagues,
        COUNT(CASE WHEN status = 'error' THEN 1 END) as error_leagues,
        COUNT(CASE WHEN status = 'running' THEN 1 END) as running_leagues,
        MAX(last_synced_at) as most_recent_sync
      FROM sleeper_sync_state
    `);
    
    const row = (result.rows as any[])[0] || {};
    const totalLeagues = parseInt(row.total_leagues) || 0;
    const healthyLeagues = parseInt(row.healthy_leagues) || 0;
    const errorLeagues = parseInt(row.error_leagues) || 0;
    const mostRecentSync = row.most_recent_sync ? new Date(row.most_recent_sync) : null;
    
    if (totalLeagues === 0) {
      return {
        key: 'sleeper.sync_recent',
        status: 'info',
        details: { note: 'No leagues synced yet', syncIntervalMinutes: 60 }
      };
    }
    
    // Check if most recent sync was within 2 hours (2x the 60 min interval)
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const isRecent = mostRecentSync && mostRecentSync > twoHoursAgo;
    
    if (errorLeagues > 0) {
      return {
        key: 'sleeper.sync_recent',
        status: 'warning',
        value: healthyLeagues / totalLeagues,
        details: {
          totalLeagues,
          healthyLeagues,
          errorLeagues,
          mostRecentSync: mostRecentSync?.toISOString() ?? null
        }
      };
    }
    
    return {
      key: 'sleeper.sync_recent',
      status: isRecent ? 'healthy' : 'warning',
      value: healthyLeagues / totalLeagues,
      details: {
        totalLeagues,
        healthyLeagues,
        mostRecentSync: mostRecentSync?.toISOString() ?? null,
        note: isRecent ? 'Sync within expected interval' : 'Sync is stale (>2 hours)'
      }
    };
  } catch (error) {
    return {
      key: 'sleeper.sync_recent',
      status: 'skipped',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

async function checkSleeperUnresolvedPlayers(): Promise<AuditCheck> {
  try {
    // Count unresolved players (player_key starts with 'sleeper:')
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total_players,
        COUNT(CASE WHEN player_key LIKE 'sleeper:%' THEN 1 END) as unresolved_players
      FROM sleeper_roster_current
    `);
    
    const row = (result.rows as any[])[0] || {};
    const totalPlayers = parseInt(row.total_players) || 0;
    const unresolvedPlayers = parseInt(row.unresolved_players) || 0;
    
    if (totalPlayers === 0) {
      return {
        key: 'sleeper.unresolved_players',
        status: 'info',
        value: 0,
        details: { note: 'No roster data yet' }
      };
    }
    
    const unresolvedPercent = (unresolvedPlayers / totalPlayers) * 100;
    
    return {
      key: 'sleeper.unresolved_players',
      status: 'info', // Informational only, not a failure
      value: unresolvedPlayers,
      details: {
        totalPlayers,
        unresolvedPlayers,
        unresolvedPercent: unresolvedPercent.toFixed(1) + '%',
        note: unresolvedPlayers > 0 
          ? `${unresolvedPlayers} players using sleeper:<id> fallback keys`
          : 'All players resolved to GSIS IDs'
      }
    };
  } catch (error) {
    return {
      key: 'sleeper.unresolved_players',
      status: 'skipped',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

async function checkSleeperSyncStatus(): Promise<AuditCheck> {
  try {
    // Get aggregate sync status
    const result = await db.execute(sql`
      SELECT 
        status,
        COUNT(*) as count
      FROM sleeper_sync_state
      GROUP BY status
    `);
    
    const rows = result.rows as { status: string; count: string }[];
    const statusCounts: Record<string, number> = {};
    let totalLeagues = 0;
    
    for (const row of rows) {
      statusCounts[row.status] = parseInt(row.count) || 0;
      totalLeagues += statusCounts[row.status];
    }
    
    if (totalLeagues === 0) {
      return {
        key: 'sleeper.sync_status',
        status: 'info',
        details: { note: 'No leagues configured for sync' }
      };
    }
    
    const hasErrors = (statusCounts['error'] || 0) > 0;
    const allOk = (statusCounts['ok'] || 0) === totalLeagues;
    
    return {
      key: 'sleeper.sync_status',
      status: hasErrors ? 'warning' : (allOk ? 'healthy' : 'info'),
      details: {
        totalLeagues,
        statusCounts,
        note: hasErrors ? 'Some leagues have sync errors' : 'All syncs healthy'
      }
    };
  } catch (error) {
    return {
      key: 'sleeper.sync_status',
      status: 'skipped',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

export async function runFeatureAudit(params: AuditParams = {}): Promise<FeatureAuditResult> {
  const season = params.season || 2024;
  const week = params.week;
  const playerId = params.playerId || 'jamarr-chase';
  
  const checks: AuditCheck[] = await Promise.all([
    checkRosterBridgeCoverage(),
    checkGlobalSleeperIdPopulation(),
    checkEnrichmentRecentActivity(),
    checkGsisDuplicatesActive(),
    checkMergedRowsExcluded(),
    checkEnrichmentQuality(),
    checkMetricMatrixCoverage(season, week),
    checkPercentScaleSanity(season),
    checkCacheFreshness(),
    checkPlayerProfileRoutes(playerId, season, week || 1),
    checkSimilarAndTierNeighbors(playerId, season),
    checkOwnershipService(),
    // Sleeper Sync V2 checks
    checkSleeperSyncRecent(),
    checkSleeperUnresolvedPlayers(),
    checkSleeperSyncStatus()
  ]);
  
  let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
  
  for (const check of checks) {
    if (check.status === 'critical') {
      overallStatus = 'critical';
      break;
    }
    if (check.status === 'warning') {
      overallStatus = 'warning';
    }
  }
  
  return {
    status: overallStatus,
    generatedAt: new Date().toISOString(),
    checks
  };
}
