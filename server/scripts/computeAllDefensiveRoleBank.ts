/**
 * Defensive Role Bank Batch Compute Script
 * Builds season-level role bank records for all IDP positions (EDGE, DI, LB, CB, S)
 * sourced from idp_player_season.
 *
 * Usage:
 *   tsx server/scripts/computeAllDefensiveRoleBank.ts [season] [position] [--dry-run]
 *
 * Examples:
 *   tsx server/scripts/computeAllDefensiveRoleBank.ts 2025
 *   tsx server/scripts/computeAllDefensiveRoleBank.ts 2025 EDGE --dry-run
 */

import { db, dbPool } from '../infra/db';
import { sql } from 'drizzle-orm';
import type { DefensivePosition } from '@shared/idpSchema';
import { IDP_POSITIONS } from '@shared/idpSchema';

const TABLE_MAP: Record<DefensivePosition, string> = {
  EDGE: 'edge_role_bank',
  DI: 'di_role_bank',
  LB: 'lb_role_bank',
  CB: 'cb_role_bank',
  S: 's_role_bank',
};

const MIN_GAMES: Record<DefensivePosition, number> = {
  EDGE: 4,
  DI: 4,
  LB: 4,
  CB: 4,
  S: 4,
};

function clamp(v: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function deriveRoleTier(roleScore: number): string {
  if (roleScore >= 80) return 'T1';
  if (roleScore >= 65) return 'T2';
  if (roleScore >= 50) return 'T3';
  if (roleScore >= 35) return 'T4';
  return 'T5';
}

type IdpSeasonRow = Record<string, any>;

function computeScores(row: IdpSeasonRow, position: DefensivePosition): {
  volumeScore: number;
  impactScore: number;
  consistencyScore: number;
  roleScore: number;
} {
  const havocIndex = Number(row.havoc_index ?? 0);
  const games = Number(row.games ?? 1);
  const snaps = Number(row.total_snaps ?? 0);
  const snapsPerGame = games > 0 ? snaps / games : 0;

  // Volume score: snap-share proxy (snaps per game vs positional norms)
  const snapNorms: Record<DefensivePosition, number> = {
    EDGE: 50, DI: 48, LB: 55, CB: 55, S: 58,
  };
  const volumeScore = clamp((snapsPerGame / snapNorms[position]) * 70);

  // Impact score: directly use havoc_index (already 0-100)
  const impactScore = clamp(havocIndex);

  // Consistency score: games played ratio (17 game season)
  const consistencyScore = clamp((games / 17) * 100);

  // Role score: weighted composite
  const roleScore = clamp(
    volumeScore * 0.3 +
    impactScore * 0.5 +
    consistencyScore * 0.2
  );

  return { volumeScore, impactScore, consistencyScore, roleScore };
}

async function fetchCandidates(position: DefensivePosition, season: number): Promise<IdpSeasonRow[]> {
  const minGames = MIN_GAMES[position];
  const result = await db.execute(sql`
    SELECT *
    FROM idp_player_season
    WHERE season = ${season}
      AND position_group = ${position}
      AND games >= ${minGames}
    ORDER BY total_snaps DESC
  `);
  return result.rows as IdpSeasonRow[];
}

async function upsertRow(tableName: string, row: Record<string, any>): Promise<void> {
  const cols = Object.keys(row);
  const values = Object.values(row);
  const colList = cols.map(c => `"${c}"`).join(', ');
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
  const updates = cols
    .filter(c => c !== 'player_id' && c !== 'season')
    .map(c => `"${c}" = EXCLUDED."${c}"`)
    .join(', ');

  const text = `INSERT INTO "${tableName}" (${colList}) VALUES (${placeholders})
    ON CONFLICT (player_id, season) DO UPDATE SET ${updates}, updated_at = NOW()`;

  await dbPool.query(text, values);
}

async function computePositionRoleBank(
  position: DefensivePosition,
  season: number,
  dryRun: boolean
): Promise<{ success: number; failures: number }> {
  const tableName = TABLE_MAP[position];
  console.log(`\n📐 [${position}] Starting role bank for season ${season} → "${tableName}"`);

  const candidates = await fetchCandidates(position, season);
  console.log(`   Found ${candidates.length} candidates (${MIN_GAMES[position]}+ games)`);

  let success = 0;
  let failures = 0;

  for (let i = 0; i < candidates.length; i++) {
    const row = candidates[i];
    const playerId = String(row.gsis_id ?? '').trim();
    const playerName = String(row.player_name ?? 'Unknown');
    if (!playerId) continue;

    try {
      const { volumeScore, impactScore, consistencyScore, roleScore } = computeScores(row, position);
      const roleTier = deriveRoleTier(roleScore);

      const base = {
        player_id: playerId,
        season,
        nfl_position: row.nfl_position ?? null,
        team: row.team ?? null,
        games_played: Number(row.games ?? 0),
        total_snaps: Number(row.total_snaps ?? 0),
        forced_fumbles: row.forced_fumbles != null ? Number(row.forced_fumbles) : null,
        total_havoc_events: row.total_havoc_events != null ? Number(row.total_havoc_events) : null,
        havoc_raw_rate: row.havoc_raw_rate != null ? Number(row.havoc_raw_rate) : null,
        havoc_smoothed_rate: row.havoc_smoothed_rate != null ? Number(row.havoc_smoothed_rate) : null,
        havoc_index: row.havoc_index != null ? Number(row.havoc_index) : null,
        havoc_tier: row.havoc_tier ?? null,
        volume_score: volumeScore,
        impact_score: impactScore,
        consistency_score: consistencyScore,
        role_score: roleScore,
        role_tier: roleTier,
      };

      // Position-specific columns matching each table's schema
      const record: Record<string, any> = { ...base };
      if (position === 'EDGE' || position === 'DI') {
        record.sacks = row.sacks != null ? Number(row.sacks) : null;
        record.pressures = row.pressures != null ? Number(row.pressures) : null;
        record.qb_hits = row.qb_hits != null ? Number(row.qb_hits) : null;
        record.tackles_for_loss = row.tackles_for_loss != null ? Number(row.tackles_for_loss) : null;
      } else if (position === 'LB') {
        record.tackles_total = row.tackles_total != null ? Number(row.tackles_total) : null;
        record.tackles_for_loss = row.tackles_for_loss != null ? Number(row.tackles_for_loss) : null;
        record.sacks = row.sacks != null ? Number(row.sacks) : null;
        record.interceptions = row.interceptions != null ? Number(row.interceptions) : null;
        record.passes_defended = row.passes_defended != null ? Number(row.passes_defended) : null;
      } else if (position === 'CB') {
        record.interceptions = row.interceptions != null ? Number(row.interceptions) : null;
        record.passes_defended = row.passes_defended != null ? Number(row.passes_defended) : null;
        record.tackles_total = row.tackles_total != null ? Number(row.tackles_total) : null;
      } else if (position === 'S') {
        record.interceptions = row.interceptions != null ? Number(row.interceptions) : null;
        record.passes_defended = row.passes_defended != null ? Number(row.passes_defended) : null;
        record.tackles_total = row.tackles_total != null ? Number(row.tackles_total) : null;
        record.tackles_for_loss = row.tackles_for_loss != null ? Number(row.tackles_for_loss) : null;
      }

      if (!dryRun) {
        await upsertRow(tableName, record);
      }

      const tierEmoji = roleTier === 'T1' ? '🏆' : roleTier === 'T2' ? '⭐' : roleTier === 'T3' ? '🎯' : roleTier === 'T4' ? '📊' : '📉';
      console.log(
        `   [${i + 1}/${candidates.length}] ${tierEmoji} ${playerName.padEnd(26)} | ` +
        `Tier: ${roleTier} | Score: ${String(roleScore).padStart(3)} | ` +
        `Vol: ${String(volumeScore).padStart(3)} | Impact: ${String(impactScore).padStart(3)} | ` +
        `Games: ${row.games}`
      );

      success++;
    } catch (err) {
      console.error(`   ❌ ${playerName} (${playerId}): ${(err as Error).message}`);
      failures++;
    }
  }

  console.log(`   ✅ ${position}: ${success} written, ${failures} failed`);
  return { success, failures };
}

async function computeAllDefensiveRoleBank(season: number, positionFilter: DefensivePosition | null, dryRun: boolean): Promise<void> {
  const startTime = Date.now();
  const positions = positionFilter ? [positionFilter] : [...IDP_POSITIONS];

  console.log(`\n🚀 [Defensive Role Bank] Season ${season} | Positions: ${positions.join(', ')} | Mode: ${dryRun ? 'DRY RUN' : 'PRODUCTION'}`);

  let totalSuccess = 0;
  let totalFailures = 0;

  for (const pos of positions) {
    const { success, failures } = await computePositionRoleBank(pos, season, dryRun);
    totalSuccess += success;
    totalFailures += failures;
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 [Defensive Role Bank] Done in ${elapsed}s`);
  console.log(`   ✅ Total written: ${totalSuccess}`);
  console.log(`   ❌ Total failures: ${totalFailures}`);
  console.log(`   Mode: ${dryRun ? 'DRY RUN (no writes)' : 'PRODUCTION'}`);
  console.log(`${'='.repeat(70)}\n`);
}

const args = process.argv.slice(2);
const seasonArg = args.find(a => /^\d{4}$/.test(a));
const posArg = args.find(a => IDP_POSITIONS.includes(a as DefensivePosition)) as DefensivePosition | undefined;
const dryRun = args.includes('--dry-run');
const season = seasonArg ? parseInt(seasonArg) : 2025;

computeAllDefensiveRoleBank(season, posArg ?? null, dryRun)
  .then(() => process.exit(0))
  .catch((err) => { console.error('Fatal:', err); process.exit(1); });
