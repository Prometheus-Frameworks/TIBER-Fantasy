import { db } from '../../infra/db';
import { sql } from 'drizzle-orm';

export type CheckStatus = 'healthy' | 'warning' | 'critical' | 'skipped';

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

async function checkIdentityMappingCoverage(): Promise<AuditCheck> {
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
    if (coveragePct < 0.50) status = 'critical';
    else if (coveragePct < 0.70) status = 'warning';
    
    return {
      key: 'identity.mappingCoverage',
      status,
      value: Math.round(coveragePct * 100) / 100,
      details: {
        totalActivePlayers: total,
        withSleeperId: withSleeper,
        withNflDataPyId: parseInt(row.with_nfl_data_py) || 0,
        thresholds: { healthy: '>=0.70', warning: '0.50-0.69', critical: '<0.50' }
      }
    };
  } catch (error) {
    return {
      key: 'identity.mappingCoverage',
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

export async function runFeatureAudit(params: AuditParams = {}): Promise<FeatureAuditResult> {
  const season = params.season || 2024;
  const week = params.week;
  const playerId = params.playerId || 'jamarr-chase';
  
  const checks: AuditCheck[] = await Promise.all([
    checkIdentityMappingCoverage(),
    checkMetricMatrixCoverage(season, week),
    checkPercentScaleSanity(season),
    checkCacheFreshness(),
    checkPlayerProfileRoutes(playerId, season, week || 1),
    checkSimilarAndTierNeighbors(playerId, season),
    checkOwnershipService()
  ]);
  
  let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
  
  for (const check of checks) {
    if (check.status === 'critical') {
      overallStatus = 'critical';
      break;
    }
    if (check.status === 'warning' && overallStatus !== 'critical') {
      overallStatus = 'warning';
    }
  }
  
  return {
    status: overallStatus,
    generatedAt: new Date().toISOString(),
    checks
  };
}
