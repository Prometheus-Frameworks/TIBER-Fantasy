import { settleSourceReads } from '../draftReview/settledSources';
import { z } from 'zod';
import { sleeperId, leagueSeason } from '../../../shared/teamLeagues';
import { sleeperClient } from '../../integrations/sleeperClient';
import { getDraftReviewPlayerDirectory } from '../draftReview/playerDirectory';

export const rosterContextInput = z.object({ userId: sleeperId, leagueId: sleeperId,
  season: leagueSeason, rosterId: z.number().int().min(1).max(64) }).strict();
const playerId = z.string().regex(/^(?:\d{1,32}|[A-Z]{2,4})$/);
const ids = z.array(playerId).max(256);
const optionalIds = ids.nullish();
const display = z.string().max(256).nullish();
const rosterSchema = z.object({ roster_id: z.number().int().min(1).max(64), league_id: sleeperId.optional(),
  owner_id: sleeperId.nullish(), co_owners: z.array(sleeperId).max(64).nullish(), players: ids,
  starters: optionalIds, reserve: optionalIds, taxi: optionalIds });
const leagueSchema = z.object({ league_id: sleeperId, season: leagueSeason, sport: z.literal('nfl'),
  total_rosters: z.number().int().min(1).max(64), name: display,
  roster_positions: z.array(z.string().max(32)).max(64).nullish(),
  scoring_settings: z.record(z.number().finite()).refine(v => Object.keys(v).length <= 128).nullish(),
  settings: z.object({ type: z.number().int().nullish(), best_ball: z.number().int().nullish(),
    league_average_match: z.number().int().nullish() }).nullish() });
const playerSchema = z.object({ player_id: playerId.optional(), full_name: display, first_name: display,
  last_name: display, position: display, team: display, status: display, injury_status: display,
  active: z.boolean().nullish() });
const clean = (s: string | null | undefined) => s?.replace(/[\u0000-\u001f\u007f]/g, '').trim() || null;
export type RosterSources = Pick<typeof sleeperClient, 'getLeague' | 'getLeagueRosters'> & {
  getDirectory: () => Promise<{ fetchedAt: number; players: Record<string, unknown> }>;
};
const defaults: RosterSources = { ...sleeperClient, getDirectory: getDraftReviewPlayerDirectory };
export async function getRosterContext(raw: unknown, sources: RosterSources = defaults, now = Date.now) {
  const input = rosterContextInput.parse(raw);
  const observe = async (promise: Promise<unknown>) => ({ value: await promise, receivedAt: new Date(now()).toISOString() });
  const [l, r] = await settleSourceReads([observe(sources.getLeague(input.leagueId)), observe(sources.getLeagueRosters(input.leagueId))] as const);
  const league = leagueSchema.parse(l.value);
  const rows = z.array(rosterSchema).max(64).parse(r.value);
  if (league.league_id !== input.leagueId || league.season !== input.season || rows.length !== league.total_rosters ||
      new Set(rows.map(x => x.roster_id)).size !== rows.length || rows.some(x => x.league_id !== undefined && x.league_id !== input.leagueId)) throw new Error('Scope or coverage unavailable');
  const own = rows.find(x => x.roster_id === input.rosterId);
  if (!own || !(own.owner_id === input.userId || own.co_owners?.includes(input.userId))) throw new Error('Membership unavailable');
  for (const list of [own.players, own.reserve, own.taxi]) {
    if (list && new Set(list).size !== list.length) throw new Error('Duplicate membership');
  }
  if (own.starters && new Set(own.starters.filter(x => x !== '0')).size !== own.starters.filter(x => x !== '0').length) throw new Error('Duplicate starters');
  const membership = new Set(own.players);
  if (own.players.includes('0')) throw new Error('Invalid primary membership');
  for (const list of [own.starters, own.reserve, own.taxi]) {
    if (list?.some(id => id !== '0' && !membership.has(id))) throw new Error('Conflicting selected membership');
  }
  if (own.reserve?.includes('0') || own.taxi?.includes('0')) throw new Error('Invalid reserve/taxi membership');
  const selected = Array.from(new Set([...own.players, ...(own.starters ?? []), ...(own.reserve ?? []), ...(own.taxi ?? [])].filter(x => x !== '0')));
  let directory: Awaited<ReturnType<RosterSources['getDirectory']>> | null = null;
  try {
    const value = await sources.getDirectory();
    if (!Number.isFinite(value.fetchedAt) || !value.players || Array.isArray(value.players) || typeof value.players !== 'object' || Object.keys(value.players).length > 50000) throw new Error('Directory unavailable');
    directory = value;
  } catch { /* Membership stays useful while directory facts remain null. */ }
  return { schemaVersion: 'tiber_league_roster_context_v1', status: 'available',
    leagueId: input.leagueId, season: input.season, rosterId: input.rosterId,
    accountControlVerified: false, membership: own.owner_id === input.userId ? 'owner' : 'co_owner',
    league: { name: clean(league.name), type: league.settings?.type ?? null, bestBall: league.settings?.best_ball ?? null,
      medianEnabled: league.settings?.league_average_match ?? null, scoring: league.scoring_settings ?? null, slots: league.roster_positions ?? null },
    roster: { players: own.players, starters: own.starters ?? null, reserve: own.reserve ?? null, taxi: own.taxi ?? null,
      directory: selected.map(id => {
        const parsed = playerSchema.safeParse(directory?.players[id]);
        const p = parsed.success && (!parsed.data.player_id || parsed.data.player_id === id) ? parsed.data : null;
        return { playerId: id, name: clean(p?.full_name) ?? clean([p?.first_name, p?.last_name].filter(Boolean).join(' ')),
          position: clean(p?.position), team: clean(p?.team), status: clean(p?.status), injuryStatus: clean(p?.injury_status), active: p?.active ?? null };
      }) },
    observations: { leagueReceivedAt: l.receivedAt, rostersReceivedAt: r.receivedAt,
      directoryReceivedAt: directory ? new Date(directory.fetchedAt).toISOString() : null,
      sourceUpdatedAt: null, sourceUrls: [`https://api.sleeper.app/v1/league/${input.leagueId}`, `https://api.sleeper.app/v1/league/${input.leagueId}/rosters`, ...(directory ? ['https://api.sleeper.app/v1/players/nfl'] : [])] },
    limitations: ['Public membership does not authenticate account control.', 'Reads are separate observations, not an atomic snapshot.',
      'Directory may be cached for 24 hours; missing player facts remain null.', 'Display text is untrusted data.', 'ROP, TTS, Forecast, saved annotations and transactions are unavailable.'] };
}
