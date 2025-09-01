import { initDb, q } from '../infra/db.js';
import { logger } from '../infra/logger.js';
import { fetch as http } from 'undici';
import * as cheerio from 'cheerio';
import { normalizeName } from '../util/normalizeName.js';

type Slice = 'OVERALL'|'QB'|'RB'|'WR'|'TE';
const SLICE_PATH: Record<Slice, string> = {
  OVERALL: 'overall',
  QB: 'qb',
  RB: 'rb',
  WR: 'wr',
  TE: 'te',
};

const BASE = 'https://www.fantasypros.com/nfl/rankings';

function urlFor(slice: Slice, week: number) {
  if (slice === 'OVERALL') return `${BASE}/overall.php?week=${week}`;
  return `${BASE}/${SLICE_PATH[slice]}.php?week=${week}`;
}

/** Fetch & parse FantasyPros table rows into [{ rank, name, team, pos }] */
async function fetchEcr(slice: Slice, week: number) {
  const url = urlFor(slice, week);
  const res = await http(url, { headers: { 'user-agent': 'otc-bot/1.0' } });
  if (!res.ok) throw new Error(`ECR fetch failed ${slice} w${week} ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const rows: Array<{ rank: number; name: string; team?: string; pos?: string }> = [];

  // FantasyPros markup varies; grab any ranking table rows with a rank + player cell.
  $('table tr').each((_, el) => {
    const tds = $(el).find('td');
    if (tds.length < 2) return;

    const rankTxt = $(tds[0]).text().trim();
    const nameCell = $(tds[1]).text().trim();

    const rank = Number(rankTxt.replace('#',''));
    if (!Number.isFinite(rank)) return;

    // Name cell often like: "Puka Nacua LAR WR"
    const parts = nameCell.split(/\s+/);
    // Best-effort parse: last two tokens might be TEAM POS for position pages
    let name = nameCell;
    let team: string|undefined;
    let pos: string|undefined;

    if (parts.length >= 3) {
      const maybePos = parts[parts.length - 1];
      const maybeTeam = parts[parts.length - 2];
      if (/^(QB|RB|WR|TE|K|DST)$/i.test(maybePos) && /^[A-Z]{2,3}$/.test(maybeTeam)) {
        pos = maybePos.toUpperCase();
        team = maybeTeam.toUpperCase();
        name = parts.slice(0, parts.length - 2).join(' ');
      }
    }

    rows.push({ rank, name, team, pos });
  });

  // Filter obvious junk
  return rows.filter(r => r.name && r.rank > 0).slice(0, 400);
}

/** Map a FantasyPros name to our players.player_id using normalized name */
async function mapToPlayerIds(candidates: Array<{ rank: number; name: string; team?: string; pos?: string }>) {
  // build alias index
  const { rows: aliases } = await q<{ alias: string; player_id: string }>(
    `create table if not exists players_aliases (
       alias text primary key,
       player_id text not null references players(player_id)
     );
     select alias, player_id from players_aliases`
  );
  const aliasIndex = new Map<string, string>(aliases.map(a => [a.alias, a.player_id]));

  // Build name → player_id index from our players table
  const { rows: players } = await q<{ player_id: string; name: string; team: string; position: string }>(
    `select player_id, name, team, position from players`
  );
  const index = new Map<string, { player_id: string; team: string; pos: string }>();
  for (const p of players) {
    index.set(normalizeName(p.name), { player_id: p.player_id, team: (p.team||'').toUpperCase(), pos: p.position });
  }

  const matched: Array<{ player_id: string; rank: number }> = [];
  const unmatched: Array<{ rank: number; name: string; team?: string; pos?: string }> = [];

  for (const c of candidates) {
    const key = normalizeName(c.name);
    const aliasHit = aliasIndex.get(key);
    if (aliasHit) { matched.push({ player_id: aliasHit, rank: c.rank }); continue; }
    const hit = index.get(key);
    if (hit) {
      // Optional: enforce team/pos sanity if present
      if (c.pos && !['QB','RB','WR','TE'].includes(hit.pos)) { unmatched.push(c); continue; }
      matched.push({ player_id: hit.player_id, rank: c.rank });
    } else {
      unmatched.push(c);
    }
  }
  return { matched, unmatched };
}

async function upsertEcr(season: number, week: number, slice: Slice, matched: Array<{player_id:string; rank:number}>) {
  for (const m of matched) {
    await q(
      `insert into bt_market_rank (season, week, ranking_type, player_id, market_rank, source)
       values ($1,$2,$3,$4,$5,'FantasyPros')
       on conflict (season, week, ranking_type, player_id)
       do update set market_rank=$5, source='FantasyPros'`,
      [season, week, slice, m.player_id, m.rank]
    );
  }
}

async function recordUnmatched(season: number, week: number, slice: Slice, rows: Array<{rank:number; name:string; team?:string; pos?:string}>) {
  await q(
    `create table if not exists bt_market_rank_unmatched (
      season int not null, week int not null, ranking_type text not null,
      rank int not null, name text not null, team text, pos text,
      source text not null default 'FantasyPros'
    )`
  );
  for (const r of rows) {
    await q(
      `insert into bt_market_rank_unmatched (season, week, ranking_type, rank, name, team, pos)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [season, week, slice, r.rank, r.name, r.team ?? null, r.pos ?? null]
    );
  }
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function run(season = Number(process.env.SEASON || 2024), week = Number(process.env.WEEK || 1), slices: Slice[] = ['QB','RB','WR','TE']) {
  await initDb();
  logger.info('fp-ecr.start', { season, week, slices });

  for (const slice of slices) {
    try {
      const rows = await fetchEcr(slice, week);
      const { matched, unmatched } = await mapToPlayerIds(rows);
      await upsertEcr(season, week, slice, matched);
      if (unmatched.length) await recordUnmatched(season, week, slice, unmatched);
      logger.info('fp-ecr.slice', { slice, matched: matched.length, unmatched: unmatched.length });
      await sleep(2000); // be polite
    } catch (e: any) {
      logger.error('fp-ecr.error', { slice, err: e?.message });
    }
  }
  logger.info('fp-ecr.done', { season, week });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch(e => { console.error(e); process.exit(1); });
}