import { z } from 'zod';
import { sleeperClient } from '../../integrations/sleeperClient';
import { getDraftReviewPlayerDirectory, parseSleeperRosterUrl } from './draftReviewService';
import { unrosteredTesSchema, type UnrosteredTes } from '../../../shared/draftReviewWaivers';

const id = z.string().regex(/^(?:\d{1,24}|[A-Z]{2,3})$/);
const membership = z.array(id).max(256);
// players is required: a missing/null primary membership list is never an empty roster.
// Optional auxiliary fields add exclusions; no eligibility is inferred from their absence.
const rosterSchema = z.object({
  roster_id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  league_id: z.string().optional(), players: membership,
  starters: z.array(z.union([id, z.literal('0'), z.literal('')])).max(64).nullish(),
  reserve: membership.nullish(), taxi: membership.nullish(),
});
const leagueSchema = z.object({
  league_id: z.string(), season: z.string().regex(/^\d{4}$/),
  total_rosters: z.number().int().min(1).max(64),
});
const directoryEntry = z.object({
  player_id: z.string().nullish(), position: z.string().nullish(),
  full_name: z.string().nullish(), first_name: z.string().nullish(), last_name: z.string().nullish(),
  team: z.string().nullish(), status: z.string().nullish(), active: z.boolean().nullish(),
});
function display(value: string | null | undefined) {
  return value?.replace(/[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g, '').trim().slice(0, 120) || null;
}
async function observed<T>(request: Promise<T>) {
  const value = await request;
  return { value, receivedAt: new Date().toISOString() };
}

const trendUrl = 'https://api.sleeper.app/v1/players/nfl/trending/add?lookback_hours=24&limit=1000' as const;
let trendCache: { at: number; result: NonNullable<UnrosteredTes['trends']> } | null = null;
let trendRequest: Promise<NonNullable<UnrosteredTes['trends']>> | null = null;
export function __resetTeTrendsForTests() { trendCache = null; trendRequest = null; }
async function getTrends(): Promise<NonNullable<UnrosteredTes['trends']>> {
  if (trendCache && Date.now() - trendCache.at < 300_000) return trendCache.result;
  if (trendRequest) return trendRequest;
  trendRequest = (async () => {
    const base = { lookback_hours: 24 as const, limit: 1000 as const, source_url: trendUrl };
    try {
      const raw = await sleeperClient.getTrendingAdds();
      const rows = z.array(z.object({ player_id: z.string().regex(/^(?:\d{1,24}|[A-Z]{2,3})$/), count: z.number().int().nonnegative().safe() })).max(1000).parse(raw);
      if (new Set(rows.map(r => r.player_id)).size !== rows.length) throw new Error('Duplicate trend identity');
      const result = { ...base, status: 'available' as const, received_at: new Date().toISOString(), counts: Object.fromEntries(rows.filter(r => /^\d+$/.test(r.player_id)).map(r => [r.player_id, r.count])) };
      trendCache = { at: Date.now(), result };
      return result;
    } catch { return { ...base, status: 'unavailable' as const, received_at: null, counts: {} }; }
  })().finally(() => { trendRequest = null; });
  return trendRequest;
}

export async function buildUnrosteredTes(rawInput: string): Promise<UnrosteredTes> {
  const input = parseSleeperRosterUrl(rawInput);
  const [leagueRead, rosterRead, directory] = await Promise.all([
    observed(sleeperClient.getLeague(input.leagueId)),
    observed(sleeperClient.getLeagueRosters(input.leagueId)),
    getDraftReviewPlayerDirectory(),
  ]);
  const league = leagueSchema.parse(leagueRead.value);
  const rosters = z.array(rosterSchema).min(1).max(64).parse(rosterRead.value);
  if (league.league_id !== input.leagueId || rosters.length !== league.total_rosters
      || new Set(rosters.map(r => r.roster_id)).size !== rosters.length
      || !rosters.some(r => r.roster_id === input.rosterId)
      || rosters.some(r => r.league_id !== undefined && r.league_id !== input.leagueId)) {
    throw new Error('League roster completeness or scope could not be established.');
  }
  const rostered = new Set(rosters.flatMap(r => [
    ...r.players, ...(r.starters ?? []).filter(p => p !== '0' && p !== ''), ...(r.reserve ?? []), ...(r.taxi ?? []),
  ]));
  if (!directory.players || typeof directory.players !== 'object' || Array.isArray(directory.players)) {
    throw new Error('Player directory is malformed.');
  }
  const entries = Object.entries(directory.players);
  if (!entries.length || entries.length > 50_000) throw new Error('Player directory size is unsupported.');
  const candidates: UnrosteredTes['candidates'] = [];
  for (const [key, raw] of entries) {
    const player = directoryEntry.parse(raw);
    if (player.position !== 'TE') continue;
    // Never repair an exact identifier or infer one from the display name.
    if (!/^\d{1,24}$/.test(key) || (player.player_id != null && player.player_id !== key)) {
      throw new Error('Tight-end directory identity is ambiguous.');
    }
    if (rostered.has(key)) continue;
    candidates.push({
      player_id: key,
      name: display(player.full_name) ?? display([player.first_name, player.last_name].filter(Boolean).join(' ')) ?? `Sleeper player ${key}`,
      position: 'TE', team: display(player.team), status: display(player.status), active: player.active ?? null,
    });
  }
  candidates.sort((a, b) => a.name.localeCompare(b.name, 'en') || a.player_id.localeCompare(b.player_id, 'en'));
  const trends = await getTrends();
  const candidateIds = new Set(candidates.map(p => p.player_id));
  const result = unrosteredTesSchema.parse({
    trends: { ...trends, counts: Object.fromEntries(Object.entries(trends.counts).filter(([id]) => candidateIds.has(id))) },
    schema_version: 'tiber_team_unrostered_tes_v1', status: 'available', input, season: league.season,
    observations: {
      league_received_at: leagueRead.receivedAt, rosters_received_at: rosterRead.receivedAt,
      directory_fetched_at: new Date(directory.fetchedAt).toISOString(), directory_source_updated_at: null,
      directory_cache_max_age_hours: 24, expected_rosters: league.total_rosters, received_rosters: rosters.length,
      source_urls: [`https://api.sleeper.app/v1/league/${input.leagueId}`, `https://api.sleeper.app/v1/league/${input.leagueId}/rosters`, 'https://api.sleeper.app/v1/players/nfl'],
    },
    derivation: 'directory_primary_position_TE_minus_all_league_membership', claim_eligibility: 'unknown', candidates,
  });
  if (Buffer.byteLength(JSON.stringify(result), 'utf8') > 500_000) throw new Error('Candidate response exceeded its limit.');
  return result;
}
