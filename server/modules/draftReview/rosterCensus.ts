import { parseCompleteRosterCoverage } from './leagueAvailability';
import type { Observation } from './sourceObservations';

export type RosterCensus =
  | { status: 'available'; rostersReceivedAt: string; selectedRosterId: number; ownership: ReadonlyMap<string, number> }
  | { status: 'unknown'; rostersReceivedAt: string | null; reason: 'incomplete_roster_census' | 'conflicting_ownership' };
export type CandidateMembership = {
  status: 'on_selected_roster' | 'rostered_elsewhere' | 'not_observed_in_complete_census' | 'unknown';
  rostersReceivedAt: string | null;
};
export const exactCandidateId = /^[0-9]{1,24}$/;

/** Independent of player-directory identity, skill position and active-pool evidence.
 * Keep raw observations outside parsed coverage so legacy FAAB settings survive. */
export function compileRosterCensus(
  input: { leagueId: string; season: string; rosterId: number },
  league: Observation<unknown>, rosters: Observation<unknown>,
): RosterCensus {
  const rostersReceivedAt = rosters.receivedAt;
  try {
    const coverage = parseCompleteRosterCoverage(input, league.value, rosters.value);
    if (coverage.league.season !== input.season || coverage.rosters.some(row => row.roster_id > 64)) throw new Error('Scope');
    const ownership = new Map<string, number>();
    for (const row of coverage.rosters) {
      if ([row.players, row.reserve, row.taxi].some(ids => ids?.includes('0'))) throw new Error('Invalid placeholder');
      const members = new Set([...row.players, ...(row.reserve ?? []), ...(row.taxi ?? []),
        ...(row.starters ?? []).filter(id => id !== '0' && id !== '')]);
      for (const id of Array.from(members)) {
        if (ownership.has(id) && ownership.get(id) !== row.roster_id) {
          return { status: 'unknown', reason: 'conflicting_ownership', rostersReceivedAt };
        }
        ownership.set(id, row.roster_id);
      }
    }
    return { status: 'available', rostersReceivedAt, selectedRosterId: input.rosterId, ownership };
  } catch { return { status: 'unknown', reason: 'incomplete_roster_census', rostersReceivedAt }; }
}

export function candidateMembership(query: string, census: RosterCensus): CandidateMembership {
  if (!exactCandidateId.test(query)) return { status: 'unknown', rostersReceivedAt: null };
  if (census.status !== 'available') return { status: 'unknown', rostersReceivedAt: census.rostersReceivedAt };
  const rosterId = census.ownership.get(query);
  return { status: rosterId === undefined ? 'not_observed_in_complete_census'
    : rosterId === census.selectedRosterId ? 'on_selected_roster' : 'rostered_elsewhere',
  rostersReceivedAt: census.rostersReceivedAt };
}
