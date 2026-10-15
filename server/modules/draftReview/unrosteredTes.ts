import { z } from 'zod';
import { sleeperClient } from '../../integrations/sleeperClient';
import { parseSleeperRosterUrl } from './draftReviewService';
import { readLeagueAvailabilityForSelection, directoryEntry, display } from './leagueAvailability';
export { directoryEntry, display } from './leagueAvailability';
import { unrosteredTesSchema, type UnrosteredTes } from '../../../shared/draftReviewWaivers';

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
    } catch {
      const result = { ...base, status: 'unavailable' as const, received_at: null, counts: {} };
      trendCache = { at: Date.now(), result };
      return result;
    }
  })().finally(() => { trendRequest = null; });
  return trendRequest;
}

export async function readLeagueAvailability(rawInput: string) {
  return readLeagueAvailabilityForSelection(parseSleeperRosterUrl(rawInput));
}

export async function buildUnrosteredTes(rawInput: string): Promise<UnrosteredTes> {
  const { input, league, rosters, rostered, entries, leagueRead, rosterRead, directory } = await readLeagueAvailability(rawInput);
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
