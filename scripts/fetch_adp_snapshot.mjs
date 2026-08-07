#!/usr/bin/env node
/**
 * ADP Snapshot Fetcher — persists Fantasy Football Calculator ADP to disk.
 *
 * Closes the gap where FantasyCalculatorClient (server/data/adpClient.ts) is
 * wired up but never called into a durable artifact: every other ADP path is
 * either broken (Sleeper endpoints carry no adp field), in-memory only (ECR),
 * or hardcoded. This script is standalone (no deps, no DB) so it can run from
 * cron or by hand and leave a provenance-stamped snapshot behind.
 *
 * Usage:
 *   node scripts/fetch_adp_snapshot.mjs [--format ppr|half-ppr|standard|2qb]
 *                                       [--teams 8|10|12|14] [--year YYYY]
 *                                       [--out data/adp]
 *
 * Writes:
 *   {out}/adp_snapshot_{year}_{format}_{teams}tm_{YYYY-MM-DD}.json
 *   {out}/adp_snapshot_latest_{format}_{teams}tm.json   (overwritten copy)
 */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, [])
);

const format = args.format ?? 'ppr';
const teams = Number(args.teams ?? 12);
const year = Number(args.year ?? new Date().getUTCFullYear());
const outDir = args.out ?? 'data/adp';

const VALID_FORMATS = ['ppr', 'half-ppr', 'standard', '2qb'];
if (!VALID_FORMATS.includes(format)) {
  console.error(`Unknown format "${format}" (expected ${VALID_FORMATS.join('|')})`);
  process.exit(1);
}
if (!Number.isInteger(teams) || teams < 2 || !Number.isInteger(year) || year < 2000) {
  console.error(`Bad --teams (${args.teams}) or --year (${args.year}) — a flag passed without a value parses to NaN`);
  process.exit(1);
}

const url = `https://fantasyfootballcalculator.com/api/v1/adp/${format}?teams=${teams}&year=${year}`;

const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
if (!res.ok) {
  console.error(`FFC request failed: HTTP ${res.status} for ${url}`);
  process.exit(1);
}
const body = await res.json();
if (body.status !== 'Success' || !Array.isArray(body.players) || body.players.length === 0) {
  console.error(`FFC response not usable (status=${body.status}, players=${body.players?.length ?? 0}); nothing written`);
  process.exit(1);
}

const fetchedAt = new Date().toISOString();
const artifact = {
  kind: 'adp_snapshot',
  schema_version: 'adp_snapshot_v0',
  source: {
    name: 'fantasyfootballcalculator',
    url,
    fetched_at: fetchedAt,
  },
  params: { format, teams, year },
  ffc_meta: body.meta ?? null, // drafts counted, date window — FFC's own provenance
  player_count: body.players.length,
  players: body.players,
};

await mkdir(outDir, { recursive: true });
const dated = path.join(outDir, `adp_snapshot_${year}_${format}_${teams}tm_${fetchedAt.slice(0, 10)}.json`);
const latest = path.join(outDir, `adp_snapshot_latest_${format}_${teams}tm.json`);
const json = JSON.stringify(artifact, null, 1);
await writeFile(dated, json);
await writeFile(latest, json);
console.log(`Wrote ${body.players.length} players (${body.meta?.total_drafts ?? '?'} drafts, ${body.meta?.start_date ?? '?'}..${body.meta?.end_date ?? '?'})`);
console.log(`  ${dated}`);
console.log(`  ${latest}`);
