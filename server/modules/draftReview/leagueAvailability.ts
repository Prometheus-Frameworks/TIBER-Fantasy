import { z } from 'zod';
import { sleeperClient } from '../../integrations/sleeperClient';
import { getDraftReviewPlayerDirectory } from './playerDirectory';
import { settleSourceReads } from './settledSources';
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
export const directoryEntry = z.object({
  player_id: z.string().nullish(), position: z.string().nullish(),
  full_name: z.string().nullish(), first_name: z.string().nullish(), last_name: z.string().nullish(),
  team: z.string().nullish(), status: z.string().nullish(), active: z.boolean().nullish(),
});
export function display(value: string | null | undefined) {
  return value?.replace(/[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g, '').trim().slice(0, 120) || null;
}
type AvailabilitySources = Pick<typeof sleeperClient, 'getLeague' | 'getLeagueRosters'> & { getDirectory: () => Promise<{ fetchedAt: number; players: Record<string, unknown> }> };
const defaults: AvailabilitySources = { ...sleeperClient, getDirectory: getDraftReviewPlayerDirectory };
async function observed<T>(request: Promise<T>) {
  return { value: await request, receivedAt: new Date().toISOString() };
}

export async function readLeagueAvailabilityForSelection(input: { leagueId: string; rosterId: number; canonicalUrl: string }, sources: AvailabilitySources = defaults) {
  const [leagueRead, rosterRead, directory] = await settleSourceReads([
    observed(sources.getLeague(input.leagueId)),
    observed(sources.getLeagueRosters(input.leagueId)),
    sources.getDirectory(),
  ] as const);
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
  return { input, league, rosters, rostered, entries, leagueRead, rosterRead, directory };
}
