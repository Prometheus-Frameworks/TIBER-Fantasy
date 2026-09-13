import { z } from 'zod';
import { leagueSeason, sleeperAccountInput, sleeperId, type TeamLeagues, type TeamLeagueRosters, type TeamLeagueSummary } from '@shared/teamLeagues';
import { sleeperClient } from '../../integrations/sleeperClient';

type Sources = Pick<typeof sleeperClient, 'getUser' | 'getUserLeagues' | 'getLeague' | 'getLeagueRosters'>;
const optionalDisplay = z.string().max(256).nullish();
const accountSchema = z.object({ user_id: sleeperId, username: optionalDisplay, display_name: optionalDisplay });
const leagueSchema = z.object({
  league_id: sleeperId, season: leagueSeason, name: optionalDisplay,
  sport: z.literal('nfl').optional(), status: optionalDisplay,
  total_rosters: z.number().int().min(1).max(64).nullish(),
  settings: z.object({ type: z.number().int().nullish() }).nullish(),
  scoring_settings: z.object({ rec: z.number().finite().nullish() }).nullish(),
  roster_positions: z.array(z.string().max(32)).max(64).nullish(),
});
const rosterSchema = z.object({
  roster_id: z.number().int().min(1).max(64), league_id: sleeperId.optional(),
  owner_id: sleeperId.nullish(), co_owners: z.array(sleeperId).max(64).nullish(),
});
const display = (value: string | null | undefined) => value?.replace(/[\u0000-\u001f\u007f]/g, '').trim() || null;

export class TeamLeaguesSourceError extends Error {
  constructor() { super('Sleeper league information is unavailable. Try again shortly.'); }
}

/** Request-time public observations only. No session, database, global cache,
 * player directory or private state is consulted by this compiler. */
export async function discoverTeamLeagues(account: string, season: string, sources: Sources = sleeperClient, now = Date.now): Promise<TeamLeagues> {
  sleeperAccountInput.parse(account); leagueSeason.parse(season);
  try {
    const user = accountSchema.parse(await sources.getUser(account));
    if (/^\d+$/.test(account) && user.user_id !== account) throw new TeamLeaguesSourceError();
    const accountReceivedAt = new Date(now()).toISOString();
    const rows = z.array(leagueSchema).max(128).parse(await sources.getUserLeagues(user.user_id, season));
    const leaguesReceivedAt = new Date(now()).toISOString();
    const seen = new Set<string>();
    const leagues = rows.map((row): TeamLeagueSummary => {
      if (row.season !== season || seen.has(row.league_id)) throw new TeamLeaguesSourceError();
      seen.add(row.league_id);
      return {
        leagueId: row.league_id, name: display(row.name) ?? `League ${row.league_id}`, season,
        status: display(row.status), totalRosters: row.total_rosters ?? null,
        mode: row.settings?.type === 0 ? 'redraft' : row.settings?.type === 1 ? 'keeper' : row.settings?.type === 2 ? 'dynasty' : 'unknown',
        receptionPoints: row.scoring_settings?.rec ?? null,
        superflex: row.roster_positions ? row.roster_positions.includes('SUPER_FLEX') : null,
      };
    }).sort((a, b) => a.name.localeCompare(b.name) || a.leagueId.localeCompare(b.leagueId));
    return {
      status: 'available', account: { userId: user.user_id, username: display(user.username), displayName: display(user.display_name) },
      season, leagues, accountControlVerified: false,
      observations: { accountReceivedAt, leaguesReceivedAt, sourceUrls: [
        `https://api.sleeper.app/v1/user/${account}`,
        `https://api.sleeper.app/v1/user/${user.user_id}/leagues/nfl/${season}`,
      ] },
    };
  } catch { throw new TeamLeaguesSourceError(); }
}

/** Fetch membership only for the league the manager opens, avoiding an
 * all-league roster fan-out. Roster numbers are never reused across leagues. */
export async function findTeamLeagueRosters(userId: string, leagueId: string, season: string, sources: Sources = sleeperClient, now = Date.now): Promise<TeamLeagueRosters> {
  sleeperId.parse(userId); sleeperId.parse(leagueId); leagueSeason.parse(season);
  try {
    const [leagueObservation, rosterObservation] = await Promise.all([
      sources.getLeague(leagueId).then(value => ({ value, receivedAt: new Date(now()).toISOString() })),
      sources.getLeagueRosters(leagueId).then(value => ({ value, receivedAt: new Date(now()).toISOString() })),
    ]);
    const league = leagueSchema.parse(leagueObservation.value);
    const rows = z.array(rosterSchema).max(64).parse(rosterObservation.value);
    if (league.league_id !== leagueId || league.season !== season || !league.total_rosters || rows.length !== league.total_rosters) throw new TeamLeaguesSourceError();
    const seen = new Set<number>();
    for (const row of rows) {
      if (seen.has(row.roster_id) || (row.league_id !== undefined && row.league_id !== leagueId)) throw new TeamLeaguesSourceError();
      seen.add(row.roster_id);
    }
    return {
      status: 'available', leagueId, season, accountControlVerified: false,
      rosters: rows.filter(row => row.owner_id === userId || row.co_owners?.includes(userId)).map(row => ({
        rosterId: row.roster_id, relationship: row.owner_id === userId ? 'owner' as const : 'co_owner' as const,
        canonicalUrl: `https://sleeper.com/roster/${leagueId}/${row.roster_id}`,
      })),
      observations: { leagueReceivedAt: leagueObservation.receivedAt, rostersReceivedAt: rosterObservation.receivedAt,
        sourceUrls: [`https://api.sleeper.app/v1/league/${leagueId}`, `https://api.sleeper.app/v1/league/${leagueId}/rosters`] },
    };
  } catch { throw new TeamLeaguesSourceError(); }
}
