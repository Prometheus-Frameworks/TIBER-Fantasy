import { db } from '../server/infra/db';
import { sql } from 'drizzle-orm';

const POSITIONS = ['TE', 'RB', 'WR'] as const;
const SEASON = 2025;
const MAX_WEEK = 17;

async function getCompletedCount(position: string): Promise<number> {
  const result = await db.execute(sql`
    SELECT COUNT(DISTINCT player_id) as cnt FROM forge_player_state
    WHERE season = ${SEASON} AND position = ${position} AND week = ${MAX_WEEK}
  `);
  return parseInt(result.rows[0]?.cnt as string) || 0;
}

async function backfillPosition(position: string) {
  const { calculateRecursiveAlpha } = await import('../server/modules/forge/recursiveAlphaEngine');
  const { fetchContext } = await import('../server/modules/forge/context/contextFetcher');
  const { buildWRFeatures } = await import('../server/modules/forge/features/wrFeatures');
  const { buildRBFeatures } = await import('../server/modules/forge/features/rbFeatures');
  const { buildTEFeatures } = await import('../server/modules/forge/features/teFeatures');
  const { buildQBFeatures } = await import('../server/modules/forge/features/qbFeatures');

  const featureBuilders: Record<string, (ctx: any) => any> = {
    WR: buildWRFeatures,
    RB: buildRBFeatures,
    TE: buildTEFeatures,
    QB: buildQBFeatures,
  };

  const tableName = `${position.toLowerCase()}_role_bank`;
  const result = await db.execute(sql`
    SELECT player_id FROM ${sql.identifier(tableName)}
    WHERE season = ${SEASON}
    ORDER BY games_played DESC NULLS LAST
  `);
  const allPlayerIds = result.rows.map((r: any) => r.player_id).filter(Boolean);

  const completedCount = await getCompletedCount(position);
  const skipCount = Math.max(0, completedCount);
  const playerIds = allPlayerIds.slice(skipCount);

  console.log(`[Backfill] ${position}: ${allPlayerIds.length} total, ~${completedCount} already done, processing ${playerIds.length} remaining`);

  if (playerIds.length === 0) {
    console.log(`[Backfill] ${position}: Nothing to do!`);
    return { scored: 0, failed: 0 };
  }

  let scored = 0;
  let failed = 0;

  for (const playerId of playerIds) {
    try {
      let playerName = playerId;
      let lastAlpha = 0;

      for (let week = 1; week <= MAX_WEEK; week++) {
        try {
          const context = await fetchContext(playerId, SEASON, week);
          const builder = featureBuilders[context.position];
          if (!builder) break;
          const features = builder(context);
          const score = await calculateRecursiveAlpha(context, features, { persistState: true });
          playerName = context.playerName;
          lastAlpha = score.alpha;
        } catch {}
      }

      scored++;
      console.log(`  [${position}] ${completedCount + scored}/${allPlayerIds.length} done: ${playerName} → ${lastAlpha.toFixed(1)}`);
    } catch (err: any) {
      failed++;
      console.error(`  [${position}] FAILED ${playerId}: ${err.message}`);
    }
  }

  console.log(`[Backfill] ${position} complete: ${scored} scored, ${failed} failed`);
  return { scored, failed };
}

async function main() {
  const posArg = process.argv[2]?.toUpperCase();
  const positions = posArg && ['QB', 'RB', 'WR', 'TE'].includes(posArg) 
    ? [posArg] 
    : POSITIONS;

  console.log(`[Backfill] Starting recursive backfill for: ${positions.join(', ')}`);
  console.log(`[Backfill] Season=${SEASON}, Weeks 1-${MAX_WEEK} (skipping already-completed players)`);

  for (const pos of positions) {
    const start = Date.now();
    await backfillPosition(pos);
    const elapsed = ((Date.now() - start) / 1000).toFixed(0);
    console.log(`[Backfill] ${pos} took ${elapsed}s`);
  }

  console.log('[Backfill] All done!');
  process.exit(0);
}

main().catch(err => {
  console.error('[Backfill] Fatal error:', err);
  process.exit(1);
});
