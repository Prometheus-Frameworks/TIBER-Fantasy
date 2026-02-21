import { db } from '../server/infra/db';
import { sql } from 'drizzle-orm';

const SEASON = 2025;
const MAX_WEEK = 17;

async function backfillNextPlayer(position: string, batchSize: number = 1) {
  const { calculateRecursiveAlpha } = await import('../server/modules/forge/recursiveAlphaEngine');
  const { fetchContext } = await import('../server/modules/forge/context/contextFetcher');
  const { buildWRFeatures } = await import('../server/modules/forge/features/wrFeatures');
  const { buildRBFeatures } = await import('../server/modules/forge/features/rbFeatures');
  const { buildTEFeatures } = await import('../server/modules/forge/features/teFeatures');
  const { buildQBFeatures } = await import('../server/modules/forge/features/qbFeatures');

  const featureBuilders: Record<string, (ctx: any) => any> = {
    WR: buildWRFeatures, RB: buildRBFeatures, TE: buildTEFeatures, QB: buildQBFeatures,
  };

  const tableName = `${position.toLowerCase()}_role_bank`;
  const allResult = await db.execute(sql`
    SELECT rb.player_id as gsis_id, COALESCE(pim.canonical_id, rb.player_id) as slug
    FROM ${sql.identifier(tableName)} rb
    LEFT JOIN player_identity_map pim ON pim.gsis_id = rb.player_id
    WHERE rb.season = ${SEASON}
    ORDER BY rb.games_played DESC NULLS LAST
  `);
  const allPlayers = allResult.rows.map((r: any) => ({ gsis_id: r.gsis_id, slug: r.slug }));

  const doneResult = await db.execute(sql`
    SELECT DISTINCT player_id FROM forge_player_state
    WHERE season = ${SEASON} AND week = ${MAX_WEEK}
  `);
  const doneSlugs = new Set(doneResult.rows.map((r: any) => r.player_id));

  const remaining = allPlayers.filter(p => !doneSlugs.has(p.slug));
  const total = allPlayers.length;
  const done = doneSlugs.size;

  if (remaining.length === 0) {
    console.log(`COMPLETE|${position}|${done}/${total}`);
    process.exit(0);
  }

  const batch = remaining.slice(0, batchSize);
  console.log(`PROGRESS|${position}|${done}/${total}|processing ${batch.length}|remaining ${remaining.length}`);

  for (const player of batch) {
    let playerName = player.gsis_id;
    let lastAlpha = 0;
    try {
      for (let week = 1; week <= MAX_WEEK; week++) {
        const context = await fetchContext(player.gsis_id, SEASON, week);
        const builder = featureBuilders[context.position];
        if (!builder) break;
        const features = builder(context);
        const score = await calculateRecursiveAlpha(context, features, { persistState: true });
        playerName = context.playerName;
        lastAlpha = score.alpha;
      }
      console.log(`DONE|${playerName}|${lastAlpha.toFixed(1)}`);
    } catch (err: any) {
      console.error(`FAIL|${player.gsis_id}|${err.message}`);
    }
  }

  process.exit(0);
}

const pos = process.argv[2]?.toUpperCase() || 'TE';
const batch = parseInt(process.argv[3] || '1');
backfillNextPlayer(pos, batch).catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
