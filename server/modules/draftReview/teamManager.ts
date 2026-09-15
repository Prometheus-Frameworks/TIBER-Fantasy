import { z } from 'zod';
import { sleeperId, leagueSeason } from '@shared/teamLeagues';
import { managerResultInput, type ManagerResult } from '@shared/teamManager';
import { sleeperClient } from '../../integrations/sleeperClient';

type Sources = Pick<typeof sleeperClient, 'getLeague' | 'getLeagueRosters' | 'getManagerMatchups' | 'getManagerNflState'>;
const rosterId = z.number().int().min(1).max(64);
const score = z.number().finite().min(-100000).max(100000);
const leagueSchema = z.object({ league_id: sleeperId, season: leagueSeason, sport: z.literal('nfl'),
  status: z.string(), total_rosters: z.number().int().min(1).max(64),
  settings: z.object({ playoff_week_start: z.number().int().min(0).max(19).nullish(),
    best_ball: z.number().int().nullish() }).nullish() });
const rosterSchema = z.object({ roster_id: rosterId, league_id: sleeperId.optional(),
  owner_id: sleeperId.nullish(), co_owners: z.array(sleeperId).max(64).nullish() });
const matchupSchema = z.object({ roster_id: rosterId, matchup_id: z.number().int().min(1).max(64).nullish(),
  points: score.nullish(), custom_points: score.nullish() });
const stateSchema = z.object({ season: leagueSeason, season_type: z.string(), leg: z.number().int().min(0).max(19) });
const observation = async <T>(promise: Promise<T>, now: () => number) => ({ value: await promise, receivedAt: new Date(now()).toISOString() });
const effectiveScore = (row: z.infer<typeof matchupSchema>) => row.custom_points != null
  ? { value: row.custom_points, basis: 'commissioner_override' as const }
  : row.points != null ? { value: row.points, basis: 'reported' as const } : { value: null, basis: null };

/** Public, request-time league facts. No account link/session lookup or saved record.
 * A prior regular-season leg allows a provisional score-derived W/L/T, never finality. */
export async function buildManagerResult(raw: unknown, sources: Sources = sleeperClient, now = Date.now): Promise<ManagerResult> {
  const input = managerResultInput.parse(raw);
  const { leagueId, season, week, userId } = input;
  const [leagueObs, rosterObs] = await Promise.all([
    observation(sources.getLeague(leagueId), now), observation(sources.getLeagueRosters(leagueId), now),
  ]);
  const league = leagueSchema.parse(leagueObs.value);
  const rosters = z.array(rosterSchema).max(64).parse(rosterObs.value);
  if (league.league_id !== leagueId || league.season !== season || rosters.length !== league.total_rosters ||
      new Set(rosters.map(row => row.roster_id)).size !== rosters.length || rosters.some(row => row.league_id !== undefined && row.league_id !== leagueId)) {
    throw new Error('Incomplete league membership');
  }
  const base: ManagerResult = {
    schemaVersion: 'tiber_manager_week_v1', leagueId, season, week, status: 'unavailable', reason: null,
    rosters: rosters.filter(row => row.owner_id === userId || row.co_owners?.includes(userId)).map(row => ({
      rosterId: row.roster_id, canonicalUrl: `https://sleeper.com/roster/${leagueId}/${row.roster_id}`,
      opponentRosterId: null, points: null, opponentPoints: null, scoreBasis: null, opponentScoreBasis: null, outcome: 'unavailable',
    })),
    observations: { leagueReceivedAt: leagueObs.receivedAt, rostersReceivedAt: rosterObs.receivedAt,
      matchupsReceivedAt: null, nflStateReceivedAt: null,
      sourceUrls: [`https://api.sleeper.app/v1/league/${leagueId}`, `https://api.sleeper.app/v1/league/${leagueId}/rosters`] },
    finality: 'not_verified', recordBasis: 'head_to_head_only', accountControlVerified: false,
  };
  if (!base.rosters.length) return { ...base, reason: 'No roster membership was reported for this account.' };
  const playoffStart = league.settings?.playoff_week_start;
  if (!['in_season', 'complete'].includes(league.status) || league.settings?.best_ball !== 0 ||
      playoffStart == null || (playoffStart !== 0 && week >= playoffStart)) {
    return { ...base, reason: 'This view supports regular-season head-to-head leagues with known settings. Playoffs and best ball are not supported yet.' };
  }
  const [matchupsSettled, stateSettled] = await Promise.allSettled([
    observation(sources.getManagerMatchups(leagueId, week), now), observation(sources.getManagerNflState(), now),
  ]);
  if (matchupsSettled.status !== 'fulfilled') return { ...base, reason: 'Weekly matchup scores could not be refreshed.' };
  const matchupsObs = matchupsSettled.value;
  base.observations.matchupsReceivedAt = matchupsObs.receivedAt;
  base.observations.sourceUrls.push(`https://api.sleeper.app/v1/league/${leagueId}/matchups/${week}`);
  const parsed = z.array(matchupSchema).max(64).safeParse(matchupsObs.value);
  if (!parsed.success) return { ...base, reason: 'Weekly matchup data is incomplete or unsupported.' };
  const rows = parsed.data;
  if (rows.length !== rosters.length || new Set(rows.map(row => row.roster_id)).size !== rows.length ||
      rows.some(row => !rosters.some(roster => roster.roster_id === row.roster_id))) {
    return { ...base, reason: 'Weekly matchup coverage does not match the league roster list.' };
  }
  const state = stateSettled.status === 'fulfilled' ? stateSchema.safeParse(stateSettled.value.value) : null;
  if (stateSettled.status === 'fulfilled') {
    base.observations.nflStateReceivedAt = stateSettled.value.receivedAt;
    base.observations.sourceUrls.push('https://api.sleeper.app/v1/state/nfl');
  }
  const priorWeek = state?.success && state.data.season === season && state.data.season_type === 'regular' && week < state.data.leg;
  let unsupported = false;
  base.rosters = base.rosters.map(roster => {
    const own = rows.find(row => row.roster_id === roster.rosterId)!;
    const pair = own.matchup_id == null ? [] : rows.filter(row => row.matchup_id === own.matchup_id);
    if (pair.length !== 2) { unsupported = true; return roster; }
    const opponent = pair.find(row => row.roster_id !== roster.rosterId)!;
    const a = effectiveScore(own); const b = effectiveScore(opponent);
    return { ...roster, opponentRosterId: opponent.roster_id, points: a.value, opponentPoints: b.value,
      scoreBasis: a.basis, opponentScoreBasis: b.basis,
      outcome: a.value == null || b.value == null || !priorWeek ? 'pending'
        : a.value > b.value ? 'win' : a.value < b.value ? 'loss' : 'tie' };
  });
  return { ...base, status: 'available', reason: unsupported ? 'A bye or unsupported pairing is excluded from the record.'
    : !priorWeek ? 'Pending: Sleeper has not established a later regular-season week for this season.' : null };
}
