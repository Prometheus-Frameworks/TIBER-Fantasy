#!/usr/bin/env tsx
/**
 * Gold DataDive QA Sanity Check Script
 *
 * Validates data quality in datadive_snapshot_player_week table
 * Checks row counts, null rates, value ranges, and basic statistics
 *
 * Usage:
 *   npm run qa:gold
 *   npm run qa:gold 2025 14 17
 *   npx tsx server/scripts/qaGoldDatadiveSanityCheck.ts 2025 17 17
 */

import { Client } from 'pg';

// CLI args with defaults
const season = parseInt(process.argv[2] || '2025');
const weekStart = parseInt(process.argv[3] || '17');
const weekEnd = parseInt(process.argv[4] || '17');

// Validate CLI args
if (weekStart > weekEnd) {
  console.error('\n❌ ERROR: weekStart cannot be greater than weekEnd');
  console.error('Usage: npm run qa:gold [season] [weekStart] [weekEnd]');
  console.error('Example: npm run qa:gold 2025 14 17\n');
  process.exit(1);
}

interface CheckResult {
  passed: boolean;
  message: string;
  details?: string;
}

const results: CheckResult[] = [];

function addResult(passed: boolean, message: string, details?: string) {
  results.push({ passed, message, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${message}`);
  if (details) {
    console.log(`  ${details}`);
  }
}

async function runSanityChecks() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('\n============================================================');
    console.log('GOLD DATADIVE QA SANITY CHECK');
    console.log(`Season: ${season}, Weeks: ${weekStart}-${weekEnd}`);
    console.log('============================================================\n');

    // ===== CHECK 1: Row Counts =====
    console.log('📊 CHECK 1: Row Counts by Position\n');

    const rowCountResult = await client.query(`
      SELECT
        position,
        COUNT(*) as count
      FROM datadive_snapshot_player_week
      WHERE season = $1
        AND week >= $2
        AND week <= $3
        AND position IN ('QB', 'RB', 'WR', 'TE')
      GROUP BY position
      ORDER BY position
    `, [season, weekStart, weekEnd]);

    const totalCountResult = await client.query(`
      SELECT COUNT(*) as total
      FROM datadive_snapshot_player_week
      WHERE season = $1
        AND week >= $2
        AND week <= $3
        AND position IN ('QB', 'RB', 'WR', 'TE')
    `, [season, weekStart, weekEnd]);

    const totalRows = parseInt(totalCountResult.rows[0].total);

    if (totalRows === 0) {
      addResult(false, 'Row count check (QB/RB/WR/TE)', 'CRITICAL: No skill position rows found in date range');
    } else {
      addResult(true, 'Row count check (QB/RB/WR/TE)', `Total: ${totalRows} rows`);

      for (const row of rowCountResult.rows) {
        console.log(`  ${row.position}: ${row.count} rows`);
      }
    }

    if (totalRows === 0) {
      console.log('\n⚠️  No data to check. Exiting.\n');
      await client.end();
      process.exit(1);
    }

    // ===== CHECK 2: Null Rate Checks =====
    console.log('\n📊 CHECK 2: Null Rate Checks\n');

    // All positions: success_rate (only check players with position)
    const successRateNullCheck = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE success_rate IS NULL) as null_count
      FROM datadive_snapshot_player_week
      WHERE season = $1 AND week >= $2 AND week <= $3
        AND position IS NOT NULL
        AND position IN ('QB', 'RB', 'WR', 'TE')
    `, [season, weekStart, weekEnd]);

    const successTotal = parseInt(successRateNullCheck.rows[0].total);
    const successNulls = parseInt(successRateNullCheck.rows[0].null_count);

    // Guard against divide-by-zero
    if (successTotal === 0) {
      addResult(false, 'success_rate null check (QB/RB/WR/TE)', 'CRITICAL: No skill position players found in dataset');
    } else {
      const successNullPct = (successNulls / successTotal * 100).toFixed(1);

      // Allow up to 55% nulls for success_rate (many backup players have very few plays)
      if (successNulls / successTotal <= 0.55) {
        addResult(true, 'success_rate null check (QB/RB/WR/TE)', `${successNulls}/${successTotal} (${successNullPct}%) null`);
      } else {
        addResult(false, 'success_rate null check (QB/RB/WR/TE)', `${successNulls}/${successTotal} (${successNullPct}%) null - exceeds 55% threshold`);
      }
    }

    // WR/TE/RB: xYAC metrics
    const receiverPositions = ['WR', 'TE', 'RB'];
    for (const pos of receiverPositions) {
      const xYacNullCheck = await client.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE x_yac IS NULL) as x_yac_null,
          COUNT(*) FILTER (WHERE yac_over_expected IS NULL) as yac_oe_null,
          COUNT(*) FILTER (WHERE x_yac_success_rate IS NULL) as x_yac_sr_null,
          COUNT(*) FILTER (WHERE avg_air_epa IS NULL) as air_epa_null,
          COUNT(*) FILTER (WHERE avg_comp_air_epa IS NULL) as comp_air_epa_null
        FROM datadive_snapshot_player_week
        WHERE season = $1 AND week >= $2 AND week <= $3 AND position = $4
      `, [season, weekStart, weekEnd, pos]);

      const row = xYacNullCheck.rows[0];
      const total = parseInt(row.total);

      if (total === 0) continue;

      const metrics = [
        { name: 'x_yac', nulls: parseInt(row.x_yac_null) },
        { name: 'yac_over_expected', nulls: parseInt(row.yac_oe_null) },
        { name: 'x_yac_success_rate', nulls: parseInt(row.x_yac_sr_null) },
        { name: 'avg_air_epa', nulls: parseInt(row.air_epa_null) },
        { name: 'avg_comp_air_epa', nulls: parseInt(row.comp_air_epa_null) },
      ];

      for (const metric of metrics) {
        const nullPct = (metric.nulls / total * 100).toFixed(1);
        // Allow up to 60% nulls for RB receiving metrics, 45% for WR/TE (many don't get targets)
        const threshold = pos === 'RB' ? 0.6 : 0.45;
        const thresholdPct = (threshold * 100).toFixed(0);

        if (metric.nulls / total <= threshold) {
          addResult(true, `${metric.name} null check (${pos})`, `${metric.nulls}/${total} (${nullPct}%) null`);
        } else {
          addResult(false, `${metric.name} null check (${pos})`, `${metric.nulls}/${total} (${nullPct}%) null - exceeds ${thresholdPct}% threshold`);
        }
      }
    }

    // QB: shotgun/no-huddle metrics
    const qbNullCheck = await client.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE shotgun_rate IS NULL) as shotgun_null,
        COUNT(*) FILTER (WHERE no_huddle_rate IS NULL) as no_huddle_null,
        COUNT(*) FILTER (WHERE shotgun_success_rate IS NULL) as shotgun_sr_null,
        COUNT(*) FILTER (WHERE under_center_success_rate IS NULL) as uc_sr_null
      FROM datadive_snapshot_player_week
      WHERE season = $1 AND week >= $2 AND week <= $3 AND position = 'QB'
    `, [season, weekStart, weekEnd]);

    if (qbNullCheck.rows.length > 0) {
      const qbRow = qbNullCheck.rows[0];
      const qbTotal = parseInt(qbRow.total);

      if (qbTotal > 0) {
        const qbMetrics = [
          { name: 'shotgun_rate', nulls: parseInt(qbRow.shotgun_null) },
          { name: 'no_huddle_rate', nulls: parseInt(qbRow.no_huddle_null) },
          { name: 'shotgun_success_rate', nulls: parseInt(qbRow.shotgun_sr_null) },
          { name: 'under_center_success_rate', nulls: parseInt(qbRow.uc_sr_null) },
        ];

        for (const metric of qbMetrics) {
          const nullPct = (metric.nulls / qbTotal * 100).toFixed(1);
          // Allow up to 45% nulls for QB metrics (backup QBs may have very few snaps)
          if (metric.nulls / qbTotal <= 0.45) {
            addResult(true, `${metric.name} null check (QB)`, `${metric.nulls}/${qbTotal} (${nullPct}%) null`);
          } else {
            addResult(false, `${metric.name} null check (QB)`, `${metric.nulls}/${qbTotal} (${nullPct}%) null - exceeds 45% threshold`);
          }
        }
      }
    }

    // ===== Phase 2A: Red Zone + 3rd Down Null Checks =====
    console.log('\n📊 CHECK 2B: Phase 2A Null Checks (RZ + 3rd Down)\n');

    // Red Zone metrics (all skill positions)
    for (const pos of ['QB', 'RB', 'WR', 'TE']) {
      const rzNullCheck = await client.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE rz_snaps IS NULL) as rz_snaps_null,
          COUNT(*) FILTER (WHERE rz_success_rate IS NULL) as rz_sr_null
        FROM datadive_snapshot_player_week
        WHERE season = $1 AND week >= $2 AND week <= $3 AND position = $4
      `, [season, weekStart, weekEnd, pos]);

      const row = rzNullCheck.rows[0];
      const total = parseInt(row.total);
      if (total === 0) continue;

      // rz_snaps should be 0 or populated for all players
      const rzSnapsNulls = parseInt(row.rz_snaps_null);
      const rzSnapsNullPct = (rzSnapsNulls / total * 100).toFixed(1);
      // Allow up to 15% nulls for rz_snaps (should be populated for most players)
      if (rzSnapsNulls / total <= 0.15) {
        addResult(true, `rz_snaps null check (${pos})`, `${rzSnapsNulls}/${total} (${rzSnapsNullPct}%) null`);
      } else {
        addResult(false, `rz_snaps null check (${pos})`, `${rzSnapsNulls}/${total} (${rzSnapsNullPct}%) null - exceeds 15% threshold`);
      }
    }

    // WR/TE specific RZ receiving metrics
    for (const pos of ['WR', 'TE']) {
      const rzRecNullCheck = await client.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE rz_targets IS NULL) as rz_targets_null,
          COUNT(*) FILTER (WHERE rz_target_share IS NULL) as rz_ts_null
        FROM datadive_snapshot_player_week
        WHERE season = $1 AND week >= $2 AND week <= $3 AND position = $4
      `, [season, weekStart, weekEnd, pos]);

      const row = rzRecNullCheck.rows[0];
      const total = parseInt(row.total);
      if (total === 0) continue;

      const rzTargetsNulls = parseInt(row.rz_targets_null);
      const nullPct = (rzTargetsNulls / total * 100).toFixed(1);
      // Allow up to 20% nulls for RZ receiving metrics
      if (rzTargetsNulls / total <= 0.20) {
        addResult(true, `rz_targets null check (${pos})`, `${rzTargetsNulls}/${total} (${nullPct}%) null`);
      } else {
        addResult(false, `rz_targets null check (${pos})`, `${rzTargetsNulls}/${total} (${nullPct}%) null - exceeds 20% threshold`);
      }
    }

    // 3rd Down metrics (all skill positions)
    for (const pos of ['QB', 'RB', 'WR', 'TE']) {
      const thirdDownNullCheck = await client.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE third_down_snaps IS NULL) as td_snaps_null,
          COUNT(*) FILTER (WHERE third_down_conversion_rate IS NULL) as td_conv_rate_null,
          COUNT(*) FILTER (WHERE early_down_success_rate IS NULL) as ed_sr_null,
          COUNT(*) FILTER (WHERE late_down_success_rate IS NULL) as ld_sr_null
        FROM datadive_snapshot_player_week
        WHERE season = $1 AND week >= $2 AND week <= $3 AND position = $4
      `, [season, weekStart, weekEnd, pos]);

      const row = thirdDownNullCheck.rows[0];
      const total = parseInt(row.total);
      if (total === 0) continue;

      const metrics = [
        { name: 'third_down_snaps', nulls: parseInt(row.td_snaps_null), threshold: 0.15 },
        // Rate metrics have high null rates because many backup players don't have enough plays
        { name: 'third_down_conversion_rate', nulls: parseInt(row.td_conv_rate_null), threshold: 0.85 },
        { name: 'early_down_success_rate', nulls: parseInt(row.ed_sr_null), threshold: 0.70 },
        { name: 'late_down_success_rate', nulls: parseInt(row.ld_sr_null), threshold: 0.85 },
      ];

      for (const metric of metrics) {
        const nullPct = (metric.nulls / total * 100).toFixed(1);
        const thresholdPct = (metric.threshold * 100).toFixed(0);
        if (metric.nulls / total <= metric.threshold) {
          addResult(true, `${metric.name} null check (${pos})`, `${metric.nulls}/${total} (${nullPct}%) null`);
        } else {
          addResult(false, `${metric.name} null check (${pos})`, `${metric.nulls}/${total} (${nullPct}%) null - exceeds ${thresholdPct}% threshold`);
        }
      }
    }

    // ===== CHECK 3: Range Checks =====
    console.log('\n📊 CHECK 3: Range Checks\n');

    // Rate metrics (0-1)
    const rateMetrics = [
      'success_rate',
      'x_yac_success_rate',
      'shotgun_rate',
      'no_huddle_rate',
      'shotgun_success_rate',
      'under_center_success_rate'
    ];

    for (const metric of rateMetrics) {
      const rangeCheck = await client.query(`
        SELECT
          COUNT(*) FILTER (WHERE ${metric} IS NOT NULL) as non_null_count,
          COUNT(*) FILTER (WHERE ${metric} < 0 OR ${metric} > 1) as out_of_range
        FROM datadive_snapshot_player_week
        WHERE season = $1 AND week >= $2 AND week <= $3
      `, [season, weekStart, weekEnd]);

      const nonNullCount = parseInt(rangeCheck.rows[0].non_null_count);
      const outOfRange = parseInt(rangeCheck.rows[0].out_of_range);

      if (nonNullCount > 0) {
        if (outOfRange === 0) {
          addResult(true, `${metric} range check (0-1)`, `All ${nonNullCount} values in range`);
        } else {
          addResult(false, `${metric} range check (0-1)`, `${outOfRange}/${nonNullCount} values out of range`);
        }
      }
    }

    // x_yac (0-25)
    const xYacRangeCheck = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE x_yac IS NOT NULL) as non_null_count,
        COUNT(*) FILTER (WHERE x_yac < 0 OR x_yac > 25) as out_of_range
      FROM datadive_snapshot_player_week
      WHERE season = $1 AND week >= $2 AND week <= $3
    `, [season, weekStart, weekEnd]);

    const xYacNonNull = parseInt(xYacRangeCheck.rows[0].non_null_count);
    const xYacOutOfRange = parseInt(xYacRangeCheck.rows[0].out_of_range);

    if (xYacNonNull > 0) {
      if (xYacOutOfRange === 0) {
        addResult(true, 'x_yac range check (0-25)', `All ${xYacNonNull} values in range`);
      } else {
        addResult(false, 'x_yac range check (0-25)', `${xYacOutOfRange}/${xYacNonNull} values out of range`);
      }
    }

    // yac_over_expected (-50 to 50)
    const yacOeRangeCheck = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE yac_over_expected IS NOT NULL) as non_null_count,
        COUNT(*) FILTER (WHERE yac_over_expected < -50 OR yac_over_expected > 50) as out_of_range
      FROM datadive_snapshot_player_week
      WHERE season = $1 AND week >= $2 AND week <= $3
    `, [season, weekStart, weekEnd]);

    const yacOeNonNull = parseInt(yacOeRangeCheck.rows[0].non_null_count);
    const yacOeOutOfRange = parseInt(yacOeRangeCheck.rows[0].out_of_range);

    if (yacOeNonNull > 0) {
      if (yacOeOutOfRange === 0) {
        addResult(true, 'yac_over_expected range check (-50 to 50)', `All ${yacOeNonNull} values in range`);
      } else {
        addResult(false, 'yac_over_expected range check (-50 to 50)', `${yacOeOutOfRange}/${yacOeNonNull} values out of range`);
      }
    }

    // avg_air_epa and avg_comp_air_epa (-10 to 10)
    const epaMetrics = ['avg_air_epa', 'avg_comp_air_epa'];

    for (const metric of epaMetrics) {
      const epaRangeCheck = await client.query(`
        SELECT
          COUNT(*) FILTER (WHERE ${metric} IS NOT NULL) as non_null_count,
          COUNT(*) FILTER (WHERE ${metric} < -10 OR ${metric} > 10) as out_of_range
        FROM datadive_snapshot_player_week
        WHERE season = $1 AND week >= $2 AND week <= $3
      `, [season, weekStart, weekEnd]);

      const epaNonNull = parseInt(epaRangeCheck.rows[0].non_null_count);
      const epaOutOfRange = parseInt(epaRangeCheck.rows[0].out_of_range);

      if (epaNonNull > 0) {
        if (epaOutOfRange === 0) {
          addResult(true, `${metric} range check (-10 to 10)`, `All ${epaNonNull} values in range`);
        } else {
          addResult(false, `${metric} range check (-10 to 10)`, `${epaOutOfRange}/${epaNonNull} values out of range`);
        }
      }
    }

    // Phase 2A rate metrics (0-1)
    console.log('\n📊 CHECK 3B: Phase 2A Range Checks\n');

    const phase2aRateMetrics = [
      'rz_success_rate',
      'rz_target_share',
      'third_down_conversion_rate',
      'early_down_success_rate',
      'late_down_success_rate'
    ];

    for (const metric of phase2aRateMetrics) {
      const rangeCheck = await client.query(`
        SELECT
          COUNT(*) FILTER (WHERE ${metric} IS NOT NULL) as non_null_count,
          COUNT(*) FILTER (WHERE ${metric} < 0 OR ${metric} > 1) as out_of_range
        FROM datadive_snapshot_player_week
        WHERE season = $1 AND week >= $2 AND week <= $3
      `, [season, weekStart, weekEnd]);

      const nonNullCount = parseInt(rangeCheck.rows[0].non_null_count);
      const outOfRange = parseInt(rangeCheck.rows[0].out_of_range);

      if (nonNullCount > 0) {
        if (outOfRange === 0) {
          addResult(true, `${metric} range check (0-1)`, `All ${nonNullCount} values in range`);
        } else {
          addResult(false, `${metric} range check (0-1)`, `${outOfRange}/${nonNullCount} values out of range`);
        }
      }
    }

    // Phase 2A count metrics (>= 0)
    const phase2aCountMetrics = [
      'rz_snaps',
      'rz_targets',
      'rz_receptions',
      'rz_rec_tds',
      'third_down_snaps',
      'third_down_conversions'
    ];

    for (const metric of phase2aCountMetrics) {
      const rangeCheck = await client.query(`
        SELECT
          COUNT(*) FILTER (WHERE ${metric} IS NOT NULL) as non_null_count,
          COUNT(*) FILTER (WHERE ${metric} < 0) as out_of_range
        FROM datadive_snapshot_player_week
        WHERE season = $1 AND week >= $2 AND week <= $3
      `, [season, weekStart, weekEnd]);

      const nonNullCount = parseInt(rangeCheck.rows[0].non_null_count);
      const outOfRange = parseInt(rangeCheck.rows[0].out_of_range);

      if (nonNullCount > 0) {
        if (outOfRange === 0) {
          addResult(true, `${metric} range check (>= 0)`, `All ${nonNullCount} values in range`);
        } else {
          addResult(false, `${metric} range check (>= 0)`, `${outOfRange}/${nonNullCount} values negative`);
        }
      }
    }

    // ===== CHECK 4: Min/Max/Avg Statistics =====
    console.log('\n📊 CHECK 4: Statistical Summary (Min/Max/Avg)\n');

    const positions = ['QB', 'RB', 'WR', 'TE'];

    for (const pos of positions) {
      const statsResult = await client.query(`
        SELECT
          -- Rate metrics (cast to float8 for JS compatibility)
          MIN(success_rate)::float8 as min_success_rate,
          MAX(success_rate)::float8 as max_success_rate,
          AVG(success_rate)::float8 as avg_success_rate,

          -- xYAC metrics
          MIN(x_yac)::float8 as min_x_yac,
          MAX(x_yac)::float8 as max_x_yac,
          AVG(x_yac)::float8 as avg_x_yac,
          MIN(yac_over_expected)::float8 as min_yac_oe,
          MAX(yac_over_expected)::float8 as max_yac_oe,
          AVG(yac_over_expected)::float8 as avg_yac_oe,
          MIN(x_yac_success_rate)::float8 as min_x_yac_sr,
          MAX(x_yac_success_rate)::float8 as max_x_yac_sr,
          AVG(x_yac_success_rate)::float8 as avg_x_yac_sr,

          -- EPA metrics
          MIN(avg_air_epa)::float8 as min_air_epa,
          MAX(avg_air_epa)::float8 as max_air_epa,
          AVG(avg_air_epa)::float8 as avg_air_epa,
          MIN(avg_comp_air_epa)::float8 as min_comp_air_epa,
          MAX(avg_comp_air_epa)::float8 as max_comp_air_epa,
          AVG(avg_comp_air_epa)::float8 as avg_comp_air_epa,

          -- QB metrics
          MIN(shotgun_rate)::float8 as min_shotgun,
          MAX(shotgun_rate)::float8 as max_shotgun,
          AVG(shotgun_rate)::float8 as avg_shotgun,
          MIN(no_huddle_rate)::float8 as min_no_huddle,
          MAX(no_huddle_rate)::float8 as max_no_huddle,
          AVG(no_huddle_rate)::float8 as avg_no_huddle,

          -- Phase 2A: Red Zone metrics
          SUM(rz_snaps)::int as total_rz_snaps,
          SUM(rz_targets)::int as total_rz_targets,
          SUM(rz_rec_tds)::int as total_rz_rec_tds,
          MIN(rz_success_rate)::float8 as min_rz_sr,
          MAX(rz_success_rate)::float8 as max_rz_sr,
          AVG(rz_success_rate)::float8 as avg_rz_sr,
          MIN(rz_target_share)::float8 as min_rz_ts,
          MAX(rz_target_share)::float8 as max_rz_ts,
          AVG(rz_target_share)::float8 as avg_rz_ts,

          -- Phase 2A: 3rd Down metrics
          SUM(third_down_snaps)::int as total_3d_snaps,
          SUM(third_down_conversions)::int as total_3d_conv,
          MIN(third_down_conversion_rate)::float8 as min_3d_conv_rate,
          MAX(third_down_conversion_rate)::float8 as max_3d_conv_rate,
          AVG(third_down_conversion_rate)::float8 as avg_3d_conv_rate,
          MIN(early_down_success_rate)::float8 as min_ed_sr,
          MAX(early_down_success_rate)::float8 as max_ed_sr,
          AVG(early_down_success_rate)::float8 as avg_ed_sr,
          MIN(late_down_success_rate)::float8 as min_ld_sr,
          MAX(late_down_success_rate)::float8 as max_ld_sr,
          AVG(late_down_success_rate)::float8 as avg_ld_sr
        FROM datadive_snapshot_player_week
        WHERE season = $1 AND week >= $2 AND week <= $3 AND position = $4
      `, [season, weekStart, weekEnd, pos]);

      if (statsResult.rows.length > 0) {
        const stats = statsResult.rows[0];
        console.log(`\n  === ${pos} ===`);

        if (stats.avg_success_rate !== null) {
          console.log(`  success_rate: min=${(stats.min_success_rate || 0).toFixed(3)}, max=${(stats.max_success_rate || 0).toFixed(3)}, avg=${(stats.avg_success_rate || 0).toFixed(3)}`);
        }

        if (pos === 'WR' || pos === 'TE' || pos === 'RB') {
          if (stats.avg_x_yac !== null) {
            console.log(`  x_yac: min=${(stats.min_x_yac || 0).toFixed(2)}, max=${(stats.max_x_yac || 0).toFixed(2)}, avg=${(stats.avg_x_yac || 0).toFixed(2)}`);
          }
          if (stats.avg_yac_oe !== null) {
            console.log(`  yac_over_expected: min=${(stats.min_yac_oe || 0).toFixed(2)}, max=${(stats.max_yac_oe || 0).toFixed(2)}, avg=${(stats.avg_yac_oe || 0).toFixed(2)}`);
          }
          if (stats.avg_x_yac_sr !== null) {
            console.log(`  x_yac_success_rate: min=${(stats.min_x_yac_sr || 0).toFixed(3)}, max=${(stats.max_x_yac_sr || 0).toFixed(3)}, avg=${(stats.avg_x_yac_sr || 0).toFixed(3)}`);
          }
          if (stats.avg_air_epa !== null) {
            console.log(`  avg_air_epa: min=${(stats.min_air_epa || 0).toFixed(3)}, max=${(stats.max_air_epa || 0).toFixed(3)}, avg=${(stats.avg_air_epa || 0).toFixed(3)}`);
          }
          if (stats.avg_comp_air_epa !== null) {
            console.log(`  avg_comp_air_epa: min=${(stats.min_comp_air_epa || 0).toFixed(3)}, max=${(stats.max_comp_air_epa || 0).toFixed(3)}, avg=${(stats.avg_comp_air_epa || 0).toFixed(3)}`);
          }
        }

        if (pos === 'QB') {
          if (stats.avg_shotgun !== null) {
            console.log(`  shotgun_rate: min=${(stats.min_shotgun || 0).toFixed(3)}, max=${(stats.max_shotgun || 0).toFixed(3)}, avg=${(stats.avg_shotgun || 0).toFixed(3)}`);
          }
          if (stats.avg_no_huddle !== null) {
            console.log(`  no_huddle_rate: min=${(stats.min_no_huddle || 0).toFixed(3)}, max=${(stats.max_no_huddle || 0).toFixed(3)}, avg=${(stats.avg_no_huddle || 0).toFixed(3)}`);
          }
        }

        // Phase 2A: Red Zone stats (all positions)
        if (stats.total_rz_snaps !== null && stats.total_rz_snaps > 0) {
          console.log(`  [RZ] snaps: ${stats.total_rz_snaps}, targets: ${stats.total_rz_targets || 0}, rec_tds: ${stats.total_rz_rec_tds || 0}`);
        }
        if (stats.avg_rz_sr !== null) {
          console.log(`  rz_success_rate: min=${(stats.min_rz_sr || 0).toFixed(3)}, max=${(stats.max_rz_sr || 0).toFixed(3)}, avg=${(stats.avg_rz_sr || 0).toFixed(3)}`);
        }
        if ((pos === 'WR' || pos === 'TE') && stats.avg_rz_ts !== null) {
          console.log(`  rz_target_share: min=${(stats.min_rz_ts || 0).toFixed(3)}, max=${(stats.max_rz_ts || 0).toFixed(3)}, avg=${(stats.avg_rz_ts || 0).toFixed(3)}`);
        }

        // Phase 2A: 3rd Down stats (all positions)
        if (stats.total_3d_snaps !== null && stats.total_3d_snaps > 0) {
          console.log(`  [3D] snaps: ${stats.total_3d_snaps}, conversions: ${stats.total_3d_conv || 0}`);
        }
        if (stats.avg_3d_conv_rate !== null) {
          console.log(`  third_down_conv_rate: min=${(stats.min_3d_conv_rate || 0).toFixed(3)}, max=${(stats.max_3d_conv_rate || 0).toFixed(3)}, avg=${(stats.avg_3d_conv_rate || 0).toFixed(3)}`);
        }
        if (stats.avg_ed_sr !== null) {
          console.log(`  early_down_success_rate: min=${(stats.min_ed_sr || 0).toFixed(3)}, max=${(stats.max_ed_sr || 0).toFixed(3)}, avg=${(stats.avg_ed_sr || 0).toFixed(3)}`);
        }
        if (stats.avg_ld_sr !== null) {
          console.log(`  late_down_success_rate: min=${(stats.min_ld_sr || 0).toFixed(3)}, max=${(stats.max_ld_sr || 0).toFixed(3)}, avg=${(stats.avg_ld_sr || 0).toFixed(3)}`);
        }
      }
    }

    // ===== FINAL SUMMARY =====
    console.log('\n============================================================');
    console.log('SUMMARY');
    console.log('============================================================\n');

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;
    const total = results.length;
    const passRate = total > 0 ? (passed / total * 100).toFixed(1) : '0.0';

    console.log(`Total Checks: ${total}`);
    console.log(`✅ Passed: ${passed} (${passRate}%)`);
    console.log(`❌ Failed: ${failed}`);

    if (total === 0) {
      console.log('\n⚠️  No checks were performed. Data may be missing.\n');
      await client.end();
      process.exit(1);
    } else if (failed === 0) {
      console.log('\n🎉 ALL CHECKS PASSED! Data quality is good.\n');
      await client.end();
      process.exit(0);
    } else {
      console.log('\n⚠️  SOME CHECKS FAILED. Review the failures above.\n');
      await client.end();
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ ERROR:', error);
    await client.end();
    process.exit(1);
  }
}

// Run the script
runSanityChecks();
