import { db } from '../../../infra/db';
import { sql } from 'drizzle-orm';
import { HAVOC_PRIOR_RATE, HAVOC_PRIOR_SNAPS, NFL_TO_IDP_POSITION } from '@shared/idpSchema';
import { mapHavocToTier } from '@shared/idpSchema';

const NFLVERSE_DEF_URL = 'https://github.com/nflverse/nflverse-data/releases/download/player_stats/player_stats_def.csv';

type DefRow = Record<string, string>;

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function parseCsv(csv: string): DefRow[] {
  const lines = csv.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    const row: DefRow = {};
    headers.forEach((h, i) => { row[h] = cols[i] ?? ''; });
    return row;
  });
}

const n = (v: string | undefined): number => {
  const parsed = Number(v ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

export async function ingestIdpWeeklyStats(seasons: number[]): Promise<{ upsertedWeekly: number; upsertedSeason: number; skipped: number }> {
  console.log(`[IDP Ingest] Fetching nflverse defensive stats CSV...`);
  const csv = await fetch(NFLVERSE_DEF_URL).then((r) => r.text());
  const allRows = parseCsv(csv);
  const rows = allRows.filter((r) => seasons.includes(n(r.season)));
  console.log(`[IDP Ingest] Parsed ${allRows.length} total rows, ${rows.length} for seasons ${seasons.join(',')}`);

  let upsertedWeekly = 0;
  let skipped = 0;

  const snapLookup = new Map<string, number>();
  for (const season of seasons) {
    const snapRows = await db.execute(sql`
      SELECT player, team, week, defense_snaps
      FROM bronze_nflfastr_snap_counts
      WHERE season = ${season} AND defense_snaps > 0
    `);
    for (const sr of snapRows.rows as Array<Record<string, any>>) {
      const key = `${(String(sr.player) || '').toLowerCase()}_${(String(sr.team) || '').toUpperCase()}_${sr.week}`;
      snapLookup.set(key, Number(sr.defense_snaps) || 0);
    }
    console.log(`[IDP Ingest] Loaded ${snapRows.rows.length} snap count rows for season ${season}`);
  }

  for (const row of rows) {
    const gsisId = row.player_id;
    if (!gsisId || gsisId === '0' || gsisId === 'NA') { skipped++; continue; }

    const season = n(row.season);
    const week = n(row.week);
    const position = (row.position || '').toUpperCase();
    const positionGroup = NFL_TO_IDP_POSITION[position] || null;
    if (!positionGroup) { skipped++; continue; }

    const playerName = (row.player_display_name || row.player_name || '').toLowerCase();
    const teamCode = (row.team || '').toUpperCase();
    const snapKey = `${playerName}_${teamCode}_${week}`;
    const defSnaps = snapLookup.get(snapKey) || 0;

    const tacklesSolo = Math.round(n(row.def_tackles_solo));
    const tacklesAssist = Math.round(n(row.def_tackle_assists));
    const tacklesTotal = Math.round(n(row.def_tackles));
    const sacks = n(row.def_sacks);
    const tfl = Math.round(n(row.def_tackles_for_loss));
    const qbHits = Math.round(n(row.def_qb_hits));
    const pd = Math.round(n(row.def_pass_defended));
    const ff = Math.round(n(row.def_fumbles_forced));
    const ints = Math.round(n(row.def_interceptions));
    const fr = Math.round(n(row.def_fumble_recovery_opp));

    const havocEvents = Math.round(sacks + tfl + ff + ints + pd + qbHits);
    const havocRawRate = defSnaps > 0 ? havocEvents / defSnaps : 0;

    await db.execute(sql`
      INSERT INTO idp_player_week (
        gsis_id, player_name, nfl_position, position_group, team, season, week,
        defense_snaps, tackles_solo, tackles_assist, tackles_total, sacks, tackles_for_loss,
        qb_hits, passes_defended, forced_fumbles, interceptions, fumble_recoveries,
        havoc_events, havoc_raw_rate
      ) VALUES (
        ${gsisId}, ${row.player_display_name || row.player_name || gsisId}, ${position}, ${positionGroup}, ${row.team || null}, ${season}, ${week},
        ${defSnaps}, ${tacklesSolo}, ${tacklesAssist}, ${tacklesTotal}, ${sacks}, ${tfl},
        ${qbHits}, ${pd}, ${ff}, ${ints}, ${fr},
        ${havocEvents}, ${havocRawRate}
      )
      ON CONFLICT (gsis_id, season, week) DO UPDATE SET
        player_name = EXCLUDED.player_name,
        nfl_position = EXCLUDED.nfl_position,
        position_group = EXCLUDED.position_group,
        team = EXCLUDED.team,
        defense_snaps = EXCLUDED.defense_snaps,
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

    if (upsertedWeekly % 1000 === 0) {
      console.log(`[IDP Ingest] Upserted ${upsertedWeekly} weekly rows...`);
    }
  }

  console.log(`[IDP Ingest] Weekly complete: ${upsertedWeekly} upserted, ${skipped} skipped`);

  let upsertedSeason = 0;
  for (const season of seasons) {
    const agg = await db.execute(sql`
      SELECT gsis_id, max(player_name) player_name, max(position_group) position_group, max(team) team,
        count(*) FILTER (WHERE defense_snaps > 0) games_played,
        sum(defense_snaps) total_snaps,
        sum(tackles_total) tackles_total,
        sum(sacks) sacks,
        sum(tackles_for_loss) tackles_for_loss,
        sum(qb_hits) qb_hits,
        sum(passes_defended) passes_defended,
        sum(forced_fumbles) forced_fumbles,
        sum(interceptions) interceptions,
        sum(fumble_recoveries) fumble_recoveries,
        sum(havoc_events) total_havoc_events
      FROM idp_player_week
      WHERE season = ${season}
      GROUP BY gsis_id
    `);

    for (const row of agg.rows as Array<Record<string, any>>) {
      const snaps = n(row.total_snaps);
      const havocEvents = n(row.total_havoc_events);
      const smoothed = (havocEvents + HAVOC_PRIOR_RATE * HAVOC_PRIOR_SNAPS) / (snaps + HAVOC_PRIOR_SNAPS);
      const lowConfidence = snaps < HAVOC_PRIOR_SNAPS;
      const havocIndex = Math.max(0, Math.min(100, smoothed * 1000));

      await db.execute(sql`
        INSERT INTO idp_player_season (
          gsis_id, player_name, position_group, team, season, games, total_snaps,
          tackles_total, sacks, tackles_for_loss, qb_hits, passes_defended, forced_fumbles,
          interceptions, fumble_recoveries, total_havoc_events, havoc_smoothed_rate, havoc_index, havoc_tier, low_confidence
        ) VALUES (
          ${row.gsis_id}, ${row.player_name}, ${row.position_group}, ${row.team}, ${season}, ${n(row.games_played)}, ${snaps},
          ${n(row.tackles_total)}, ${n(row.sacks)}, ${n(row.tackles_for_loss)}, ${n(row.qb_hits)}, ${n(row.passes_defended)}, ${n(row.forced_fumbles)},
          ${n(row.interceptions)}, ${n(row.fumble_recoveries)}, ${havocEvents}, ${smoothed}, ${havocIndex}, ${mapHavocToTier(havocIndex)}, ${lowConfidence}
        )
        ON CONFLICT (gsis_id, season) DO UPDATE SET
          player_name = EXCLUDED.player_name,
          position_group = EXCLUDED.position_group,
          team = EXCLUDED.team,
          games = EXCLUDED.games,
          total_snaps = EXCLUDED.total_snaps,
          tackles_total = EXCLUDED.tackles_total,
          sacks = EXCLUDED.sacks,
          tackles_for_loss = EXCLUDED.tackles_for_loss,
          qb_hits = EXCLUDED.qb_hits,
          passes_defended = EXCLUDED.passes_defended,
          forced_fumbles = EXCLUDED.forced_fumbles,
          interceptions = EXCLUDED.interceptions,
          fumble_recoveries = EXCLUDED.fumble_recoveries,
          total_havoc_events = EXCLUDED.total_havoc_events,
          havoc_smoothed_rate = EXCLUDED.havoc_smoothed_rate,
          havoc_index = EXCLUDED.havoc_index,
          havoc_tier = EXCLUDED.havoc_tier,
          low_confidence = EXCLUDED.low_confidence
      `);
      upsertedSeason += 1;
    }
    console.log(`[IDP Ingest] Season ${season} aggregation complete: ${upsertedSeason} players`);
  }

  return { upsertedWeekly, upsertedSeason, skipped };
}
