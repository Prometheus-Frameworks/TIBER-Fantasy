// /src/jobs/nightlyRecalc.ts
import { q, initDb } from '../infra/db.js';
import { logger } from '../infra/logger.js';
import { computePowerScore } from '../core/scoring.js';
import { clampDelta } from '../core/smoothing.js';
import type { PlayerFacts } from '../core/types.js';
import { loadAvailability, loadEnvironment, loadMarketAnchor, loadTalent, loadUsageBundle } from '../data/loaders.js';

function getSeasonWeek(d: Date = new Date()) {
  // Adjust if you maintain your own season/week calendar; seed logic for now.
  // NFL Week 1 ~ early September; we'll map ISO week to season placeholder.
  const season = d.getUTCFullYear();
  // naive: use ISO week % 18 range; replace with your real calendar later.
  const jan1 = new Date(Date.UTC(season, 0, 1));
  const diff = Math.floor((+d - +jan1) / 86400000);
  const isoWeek = Math.ceil((diff + jan1.getUTCDay() + 1) / 7);
  const week = Math.min(Math.max(1, isoWeek % 18 || 1), 18);
  return { season, week };
}

async function getPlayers() {
  const { rows } = await q<{ player_id: string; name: string; team: string; position: 'QB'|'RB'|'WR'|'TE' }>(
    `select player_id, name, team, position from players where position in ('QB','RB','WR','TE')`
  );
  return rows;
}

async function getLastWeekScore(player_id: string, season: number, week: number) {
  const { rows } = await q<{ power_score: number }>(
    `select power_score from player_week_facts where player_id=$1 and season=$2 and week=$3`,
    [player_id, season, week - 1]
  );
  return rows[0]?.power_score as number | undefined;
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

async function materializeRanks(season: number, week: number) {
  // OVERALL + by position
  const sets = [
    { key: 'OVERALL', where: `position in ('QB','RB','WR','TE')` },
    { key: 'QB', where: `position='QB'` },
    { key: 'RB', where: `position='RB'` },
    { key: 'WR', where: `position='WR'` },
    { key: 'TE', where: `position='TE'` },
  ];

  for (const s of sets) {
    const { rows } = await q<{ player_id: string; power_score: number }>(
      `select f.player_id, f.power_score
       from player_week_facts f
       join players p on p.player_id=f.player_id
       where f.season=$1 and f.week=$2 and ${s.where}
       order by f.power_score desc nulls last
       limit 500`,
      [season, week]
    );

    // Remove existing rows for this slice
    await q(`delete from power_ranks where season=$1 and week=$2 and ranking_type=$3`, [season, week, s.key]);

    // Insert with rank & delta_w
    let rank = 1;
    for (const r of rows) {
      // delta vs last week rank: compute previous rank quickly
      const prev = await q<{ rank: number }>(
        `select rank from power_ranks where season=$1 and week=$2 and ranking_type=$3 and player_id=$4`,
        [season, week - 1, s.key, r.player_id]
      );
      const prevRank = prev.rows[0]?.rank;
      const delta_w = typeof prevRank === 'number' ? prevRank - rank : 0;

      await q(
        `insert into power_ranks (season, week, ranking_type, rank, player_id, power_score, delta_w, generated_at)
         values ($1,$2,$3,$4,$5,$6,$7, now())`,
        [season, week, s.key, rank, r.player_id, r.power_score, delta_w]
      );
      rank++;
    }
  }
}

async function main() {
  await initDb();
  const { season, week } = getSeasonWeek();
  logger.info('nightlyRecalc: start', { season, week });

  const players = await getPlayers();
  logger.info('players.count', { n: players.length });

  for (const p of players) {
    try {
      // Load component bundles (0–100 scale). Stubs are fine to boot.
      const [usage_now, talent, environment, availability, market_anchor] = await Promise.all([
        loadUsageBundle(p.player_id, season, week),
        loadTalent(p.player_id),
        loadEnvironment(p.team),
        loadAvailability(p.player_id),
        loadMarketAnchor(p.player_id),
      ]);

      // Compute score
      const flags: string[] = []; // set flags here if needed
      const confidence = 0.7;     // seed; can compute from sample size later

      const nextRaw = computePowerScore({
        player_id: p.player_id,
        season, week,
        position: p.position,
        usage_now, talent, environment, availability, market_anchor,
        flags, confidence
      } as PlayerFacts);

      // clamp (hysteresis) vs last week
      const last = await getLastWeekScore(p.player_id, season, week);
      const power_score = clampDelta(last, nextRaw, flags);

      await upsertFacts({
        player_id: p.player_id,
        season, week,
        position: p.position,
        usage_now, talent, environment, availability, market_anchor,
        power_score, confidence, flags
      } as PlayerFacts);

    } catch (e: any) {
      logger.error('recalc.player.error', { player_id: p.player_id, err: e?.message });
    }
  }

  await materializeRanks(season, week);
  logger.info('nightlyRecalc: done', { season, week });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // run if executed directly
  main().catch(e => {
    logger.error('nightlyRecalc: fatal', { err: e?.message });
    process.exit(1);
  });
}