import { z } from 'zod';
import { exposureInput, type ExposureLeague, type ExposurePlayer, type RosterLocation } from '@shared/teamExposure';
import { sleeperId, leagueSeason } from '@shared/teamLeagues';
import { sleeperClient } from '../../integrations/sleeperClient';
const playerId = z.string().regex(/^[A-Za-z0-9_-]{1,32}$/);
const ids = z.array(playerId).max(256);
const leagueSchema = z.object({ league_id: sleeperId, season: leagueSeason, sport: z.literal('nfl'), total_rosters: z.number().int().min(1).max(64) });
const memberSchema = z.object({ roster_id: z.number().int().min(1).max(64), league_id: sleeperId.optional(), owner_id: sleeperId.nullish(), co_owners: z.array(sleeperId).max(64).nullish() }).passthrough();
const contentsSchema = z.object({ players: ids, starters: z.array(playerId.or(z.literal(''))).max(256).nullish(), reserve: ids.nullish(), taxi: ids.nullish() });
const text = z.string().max(256).nullish();
const playerSchema = z.object({ player_id: playerId.optional(), full_name: text, first_name: text, last_name: text, position: text, team: text, injury_status: text });
const clean = (s: string | null | undefined) => s?.replace(/[\u0000-\u001f\u007f]/g, '').trim() || null;
type Directory = { players: Record<string, unknown>; receivedAt: string };
/** Short, shared single-flight cache: no stale fallback after expiry or failed reads. */
export function createExposureDirectory(read: () => Promise<unknown>, now = Date.now) {
  let cached: Directory | null = null; let pending: Promise<Directory> | null = null;
  return async () => {
    if (cached && now() - Date.parse(cached.receivedAt) < 300_000) return cached;
    if (!pending) pending = read().then(raw => {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Object.keys(raw).length || Object.keys(raw).length > 50_000) throw new Error('Invalid directory');
      cached = { players: raw as Record<string, unknown>, receivedAt: new Date(now()).toISOString() }; return cached;
    }).finally(() => { pending = null; });
    return pending;
  };
}
const directory = createExposureDirectory(() => sleeperClient.getNflPlayers());
type Sources = Pick<typeof sleeperClient, 'getLeague' | 'getLeagueRosters'>;
export async function buildExposure(raw: unknown, sources: Sources = sleeperClient, getDirectory = directory, now = Date.now): Promise<ExposureLeague> {
  const input = exposureInput.parse(raw);
  const observe = async (promise: Promise<unknown>) => ({ value: await promise, at: new Date(now()).toISOString() });
  const [leagueRead, rostersRead] = await Promise.all([observe(sources.getLeague(input.leagueId)), observe(sources.getLeagueRosters(input.leagueId))]);
  const league = leagueSchema.parse(leagueRead.value);
  const members = z.array(memberSchema).max(64).parse(rostersRead.value);
  if (league.league_id !== input.leagueId || league.season !== input.season || members.length !== league.total_rosters || new Set(members.map(r => r.roster_id)).size !== members.length || members.some(r => r.league_id !== undefined && r.league_id !== input.leagueId)) throw new Error('Invalid league coverage');
  const own = members.filter(r => r.owner_id === input.userId || r.co_owners?.includes(input.userId));
  const snapshot = own.length ? await getDirectory().catch(() => null) : null;
  return { schemaVersion: 'tiber_exposure_v1', ...input, accountControlVerified: false,
    observations: { leagueReceivedAt: leagueRead.at, rostersReceivedAt: rostersRead.at, directoryReceivedAt: snapshot?.receivedAt ?? null,
      sourceUrls: [`https://api.sleeper.app/v1/league/${input.leagueId}`, `https://api.sleeper.app/v1/league/${input.leagueId}/rosters`, ...(snapshot ? ['https://api.sleeper.app/v1/players/nfl'] : [])] },
    rosters: own.map(member => {
      const base = { rosterId: member.roster_id, canonicalUrl: `https://sleeper.com/roster/${input.leagueId}/${member.roster_id}` };
      const parsed = contentsSchema.safeParse(member);
      if (!parsed.success) return { ...base, available: false, players: [] };
      const r = parsed.data;
      const starters = (r.starters ?? []).filter(id => id !== '' && id !== '0');
      const reserve = r.reserve ?? []; const taxi = r.taxi ?? [];
      const union = Array.from(new Set([...r.players, ...reserve, ...taxi]));
      if (r.players.includes('0') || reserve.includes('0') || taxi.includes('0') || [r.players, starters, reserve, taxi].some(xs => new Set(xs).size !== xs.length) || starters.some(id => !r.players.includes(id) || reserve.includes(id) || taxi.includes(id)) || reserve.some(id => taxi.includes(id))) return { ...base, available: false, players: [] };
      const players: ExposurePlayer[] = union.map(id => {
        const data = playerSchema.safeParse(snapshot?.players[id]);
        const p = data.success && (!data.data.player_id || data.data.player_id === id) ? data.data : null;
        const location: RosterLocation = starters.includes(id) ? 'starter' : reserve.includes(id) ? 'reserve' : taxi.includes(id) ? 'taxi'
          : r.starters == null ? 'unknown' : 'bench';
        return { sleeperId: id, name: p ? clean(p.full_name) ?? clean([p.first_name, p.last_name].filter(Boolean).join(' ')) : null,
          position: p ? clean(p.position) : null, team: p ? clean(p.team) : null, injuryStatus: p ? clean(p.injury_status) : null, directoryAvailable: !!p, location };
      });
      return { ...base, available: true, players };
    }) };
}
