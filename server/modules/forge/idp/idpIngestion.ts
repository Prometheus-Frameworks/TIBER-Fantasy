import { db } from '../../../infra/db';
import { sql } from 'drizzle-orm';
import { HAVOC_PRIOR_RATE, HAVOC_PRIOR_SNAPS, NFL_TO_IDP_POSITION } from '@shared/idpSchema';
import { mapHavocToTier } from '@shared/idpSchema';

const NFLVERSE_DEF_URL = 'https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats_def.csv';

type DefRow = Record<string, string>;

function parseCsv(csv: string): DefRow[] {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(',');
  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row: DefRow = {};
    headers.forEach((h, i) => { row[h] = cols[i] ?? ''; });
    return row;
  });
}

const n = (v: string | undefined): number => {
  const parsed = Number(v ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function ingestIdpWeeklyStats(seasons: number[]): Promise<{ upsertedWeekly: number; upsertedSeason: number }> {
  const csv = await fetch(NFLVERSE_DEF_URL).then((r) => r.text());
  const rows = parseCsv(csv).filter((r) => seasons.includes(n(r.season)));

  let upsertedWeekly = 0;

  for (const row of rows) {
    const gsisId = row.player_id;
    if (!gsisId) continue;

    const season = n(row.season);
    const week = n(row.week);
    const position = (row.position || '').toUpperCase();
    const positionGroup = NFL_TO_IDP_POSITION[position] || null;
    if (!positionGroup) continue;

    const defSnaps = n(row.def_snaps);
    const tacklesSolo = n(row.tackles_solo);
    const tacklesAssist = n(row.tackles_assist);
    const tacklesTotal = n(row.tackles_combined);
    const sacks = n(row.sacks);
    const tfl = n(row.tackles_for_loss);
    const qbHits = n(row.qb_hits);
    const pd = n(row.passes_defended);
    const ff = n(row.forced_fumbles);
    const ints = n(row.interceptions);
    const fr = n(row.fumble_recoveries);

    const havocEvents = sacks + tfl + ff + ints + pd + qbHits;
    const havocRawRate = defSnaps > 0 ? havocEvents / defSnaps : 0;

    await db.execute(sql`
      INSERT INTO idp_player_week (
        gsis_id, player_name, position, position_group, team, season, week, opponent_team,
        def_snaps, tackles_solo, tackles_assist, tackles_total, sacks, tackles_for_loss,
        qb_hits, passes_defended, forced_fumbles, interceptions, fumble_recoveries,
        havoc_events, havoc_raw_rate
      ) VALUES (
        ${gsisId}, ${row.player_display_name || row.player_name || gsisId}, ${position}, ${positionGroup}, ${row.team || null}, ${season}, ${week}, ${row.opponent_team || null},
        ${defSnaps}, ${tacklesSolo}, ${tacklesAssist}, ${tacklesTotal}, ${sacks}, ${tfl},
        ${qbHits}, ${pd}, ${ff}, ${ints}, ${fr},
        ${havocEvents}, ${havocRawRate}
      )
      ON CONFLICT (gsis_id, season, week) DO UPDATE SET
        player_name = EXCLUDED.player_name,
        position = EXCLUDED.position,
        position_group = EXCLUDED.position_group,
        team = EXCLUDED.team,
        opponent_team = EXCLUDED.opponent_team,
        def_snaps = EXCLUDED.def_snaps,
        tackles_solo = EXCLUDED.tackles_solo,
        tackles_assist = EXCLUDED.tackles_assist,
        tackles_total = EXCLUDED.tackles_total,
        sacks = EXCLUDED.sacks,
        tackles_for_loss = EXCLUDED.tackles_for_loss,
        qb_hits = EXCLUDED.qb_hits,
        passes_defended = EXCLUDED.passes_defended,
        forced_fumbles = EXCLUDED.forced_fumbles,
        interceptions = EXCLUDED.interceptions,
        fumble_recoveries = EXCLUDED.fumble_recoveries,
        havoc_events = EXCLUDED.havoc_events,
        havoc_raw_rate = EXCLUDED.havoc_raw_rate
    `);
    upsertedWeekly += 1;
  }

  let upsertedSeason = 0;
  for (const season of seasons) {
    const agg = await db.execute(sql`
      SELECT gsis_id, max(player_name) player_name, max(position_group) position_group, max(team) team,
        count(*) FILTER (WHERE def_snaps > 0) games_played,
        sum(def_snaps) total_snaps,
        sum(tackles_total) tackles_total,
        sum(sacks) sacks,
        sum(tackles_for_loss) tackles_for_loss,
        sum(qb_hits) qb_hits,
        sum(passes_defended) passes_defended,
        sum(forced_fumbles) forced_fumbles,
        sum(interceptions) interceptions,
        sum(fumble_recoveries) fumble_recoveries,
        sum(havoc_events) havoc_events
      FROM idp_player_week
      WHERE season = ${season}
      GROUP BY gsis_id
    `);

    for (const row of agg.rows as Array<Record<string, any>>) {
      const snaps = n(row.total_snaps);
      const havocEvents = n(row.havoc_events);
      const smoothed = (havocEvents + HAVOC_PRIOR_RATE * HAVOC_PRIOR_SNAPS) / (snaps + HAVOC_PRIOR_SNAPS);
      const lowConfidence = snaps < HAVOC_PRIOR_SNAPS;

      await db.execute(sql`
        INSERT INTO idp_player_season (
          gsis_id, player_name, position_group, team, season, games_played, total_snaps,
          tackles_total, sacks, tackles_for_loss, qb_hits, passes_defended, forced_fumbles,
          interceptions, fumble_recoveries, havoc_events, havoc_smoothed_rate, havoc_index, havoc_tier, low_confidence
        ) VALUES (
          ${row.gsis_id}, ${row.player_name}, ${row.position_group}, ${row.team}, ${season}, ${n(row.games_played)}, ${snaps},
          ${n(row.tackles_total)}, ${n(row.sacks)}, ${n(row.tackles_for_loss)}, ${n(row.qb_hits)}, ${n(row.passes_defended)}, ${n(row.forced_fumbles)},
          ${n(row.interceptions)}, ${n(row.fumble_recoveries)}, ${havocEvents}, ${smoothed}, ${Math.max(0, Math.min(100, smoothed * 1000))}, ${mapHavocToTier(Math.max(0, Math.min(100, smoothed * 1000)))}, ${lowConfidence}
        )
        ON CONFLICT (gsis_id, season) DO UPDATE SET
          player_name = EXCLUDED.player_name,
          position_group = EXCLUDED.position_group,
          team = EXCLUDED.team,
          games_played = EXCLUDED.games_played,
          total_snaps = EXCLUDED.total_snaps,
          tackles_total = EXCLUDED.tackles_total,
          sacks = EXCLUDED.sacks,
          tackles_for_loss = EXCLUDED.tackles_for_loss,
          qb_hits = EXCLUDED.qb_hits,
          passes_defended = EXCLUDED.passes_defended,
          forced_fumbles = EXCLUDED.forced_fumbles,
          interceptions = EXCLUDED.interceptions,
          fumble_recoveries = EXCLUDED.fumble_recoveries,
          havoc_events = EXCLUDED.havoc_events,
          havoc_smoothed_rate = EXCLUDED.havoc_smoothed_rate,
          havoc_index = EXCLUDED.havoc_index,
          havoc_tier = EXCLUDED.havoc_tier,
          low_confidence = EXCLUDED.low_confidence
      `);
      upsertedSeason += 1;
    }
  }

  return { upsertedWeekly, upsertedSeason };
}
