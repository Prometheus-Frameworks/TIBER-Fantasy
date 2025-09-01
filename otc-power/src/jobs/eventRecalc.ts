// /src/jobs/eventRecalc.ts
import { initDb, q } from '../infra/db.js';
import { logger } from '../infra/logger.js';
import { computePowerScore } from '../core/scoring.js';
import type { PlayerFacts } from '../core/types.js';
import { loadAvailability, loadEnvironment, loadMarketAnchor, loadTalent, loadUsageBundle } from '../data/loaders.js';

async function impactPlayers(scope: any) {
  // Expand impact by scope
  if (scope.player_id) return [scope.player_id];
  if (scope.team) {
    const { rows } = await q<{ player_id: string }>(
      `select player_id from players where team=$1 and position in ('RB','WR','TE')`,
      [scope.team]
    );
    return rows.map(r => r.player_id);
  }
  return [];
}

async function lastFacts(player_id: string, season: number, week: number) {
  const { rows } = await q<any>(
    `select power_score from player_week_facts where player_id=$1 and season=$2 and week=$3`,
    [player_id, season, week]
  );
  return rows[0];
}

async function upsertFacts(f: PlayerFacts) {
  await q(
    `insert into player_week_facts
     (player_id, season, week, usage_now, talent, environment, availability, market_anchor,
      power_score, confidence, flags, last_update)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
     on conflict (player_id, season, week)
     do update set usage_now=$4, talent=$5, environment=$6, availability=$7, market_anchor=$8,
       power_score=$9, confidence=$10, flags=$11, last_update=now()`,
    [
      f.player_id, f.season, f.week,
      f.usage_now, f.talent, f.environment, f.availability, f.market_anchor,
      f.power_score, f.confidence, f.flags
    ]
  );
}

async function materializeSliceFor(season: number, week: number, player_ids: string[]) {
  // Quick-and-dirty: rebuild ranks for affected positions + overall
  // (Optimization later: local reinsert.)
  const { rows: positions } = await q<{ position: string }>(
    `select distinct position from players where player_id = any($1)`, [player_ids]
  );
  const posList = positions.map(p => p.position);
  const slices = ['OVERALL', ...posList];

  for (const key of slices) {
    const where = key === 'OVERALL' ? `position in ('QB','RB','WR','TE')` : `position='${key}'`;
    const { rows } = await q<{ player_id: string; power_score: number }>(
      `select f.player_id, f.power_score
       from player_week_facts f
       join players p on p.player_id=f.player_id
       where f.season=$1 and f.week=$2 and ${where}
       order by f.power_score desc nulls last
       limit 500`,
      [season, week]
    );
    await q(`delete from power_ranks where season=$1 and week=$2 and ranking_type=$3`, [season, week, key]);
    let rank = 1;
    for (const r of rows) {
      const prev = await q<{ rank: number }>(
        `select rank from power_ranks where season=$1 and week=$2 and ranking_type=$3 and player_id=$4`,
        [season, week - 1, key, r.player_id]
      );
      const prevRank = prev.rows[0]?.rank;
      const delta_w = typeof prevRank === 'number' ? prevRank - rank : 0;
      await q(
        `insert into power_ranks (season, week, ranking_type, rank, player_id, power_score, delta_w, generated_at)
         values ($1,$2,$3,$4,$5,$6,$7, now())`,
        [season, week, key, rank, r.player_id, r.power_score, delta_w]
      );
      rank++;
    }
  }
}

function getSeasonWeek(d: Date = new Date()) {
  const season = d.getUTCFullYear();
  const week = 1; // Replace with your calendar if needed
  return { season, week };
}

async function processOnce() {
  const evt = await q<any>(`select * from events_queue where processed=false order by created_at asc limit 1`);
  const event = evt.rows[0];
  if (!event) return false;

  const { season, week } = getSeasonWeek();
  logger.info('event.start', { id: event.id, type: event.event_type });

  const affected = await impactPlayers(event.scope);
  for (const player_id of affected) {
    // bypass clamp for events
    const [usage_now, talent, environment, availability, market_anchor] = await Promise.all([
      loadUsageBundle(player_id, season, week),
      loadTalent(player_id),
      loadEnvironment(event.scope.team || ''), // safe default
      loadAvailability(player_id),
      loadMarketAnchor(player_id),
    ]);

    const positionRow = await q<{ position: 'QB'|'RB'|'WR'|'TE' }>(`select position from players where player_id=$1`, [player_id]);
    const position = positionRow.rows[0]?.position || 'WR';

    const power_score = computePowerScore({
      player_id, season, week, position,
      usage_now, talent, environment, availability, market_anchor,
      flags: [event.event_type], confidence: 0.7
    } as PlayerFacts);

    await upsertFacts({
      player_id, season, week, position,
      usage_now, talent, environment, availability, market_anchor,
      power_score, confidence: 0.7, flags: [event.event_type]
    } as PlayerFacts);
  }

  await q(`update events_queue set processed=true where id=$1`, [event.id]);
  await materializeSliceFor(season, week, affected);
  logger.info('event.done', { id: event.id, type: event.event_type, affected: affected.length });
  return true;
}

async function main() {
  await initDb();
  logger.info('eventRecalc: worker online');
  // poll loop
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const worked = await processOnce();
    await new Promise(r => setTimeout(r, worked ? 200 : 1000 * 60)); // faster if we had work
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(e => {
    logger.error('eventRecalc: fatal', { err: e?.message });
    process.exit(1);
  });
}