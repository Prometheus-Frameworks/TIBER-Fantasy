import { discoverTeamLeagues, findTeamLeagueRosters } from '../draftReview/teamLeagues';
import { buildManagerResult } from '../draftReview/teamManager';
import { createRequestSources } from '../draftReview/sourceObservations';
import { compileRosterCensus, candidateMembership, type RosterCensus } from '../draftReview/rosterCensus';
import { getRosterContext } from '../leagueMcp/rosterContext';
import { compileLineupContext, type LineupCandidate } from '../leagueMcp/lineupContext';
import { nflStateSchema } from '../leagueMcp/nflState';
import { publicInputs, PUBLIC_TOOL_NAMES, publicCapabilities, publicEnvelope,
  type PublicInput, type PublicSelectors, type PublicFailure, type PublicFailureReason } from './contracts';
import { qualifyReferences, type PublicSources } from './sources';

const unavailable = (reason: PublicFailureReason): PublicFailure => ({ status: 'unavailable', reason });
const noCensus = (): RosterCensus => ({ status: 'unknown', reason: 'incomplete_roster_census', rostersReceivedAt: null });
function supplied(input: PublicSelectors): PublicSelectors {
  const { account, userId, leagueId, season, rosterId, week } = input;
  return { ...(account === undefined ? {} : { account }), ...(userId === undefined ? {} : { userId }),
    ...(leagueId === undefined ? {} : { leagueId }), ...(season === undefined ? {} : { season }),
    ...(rosterId === undefined ? {} : { rosterId }), ...(week === undefined ? {} : { week }) };
}
function projectCandidate(candidate: LineupCandidate, census: RosterCensus) {
  const membership = candidateMembership(candidate.status === 'available' ? candidate.playerId : candidate.query, census);
  if (candidate.status === 'available' && census.status !== 'available') {
    // Identity may survive; a failed census cannot support any ownership/absence classification.
    const { availability: _availability, ...identity } = candidate;
    return { ...identity, status: 'unavailable' as const, reason: 'complete_census_not_verified' as const, membership };
  }
  return { ...candidate, claimEligibility: 'unknown' as const, membership };
}

const unknownDirectoryFacts = { name: null, position: null, team: null, status: null, injuryStatus: null, active: null };
const unknownBye = { byeWeek: null, onBye: null };

async function lineup(input: PublicInput<'tiber_public_get_lineup_context'>, sources: PublicSources, now: () => number) {
  const requested = supplied(input);
  let resolved: PublicSelectors = {};
  let census = noCensus();
  let nfl: { season: string; season_type: string; leg: number; receivedAt: string } | null = null;
  const scoped = createRequestSources(sources, input.leagueId, now);
  const qualified = qualifyReferences(scoped, now);
  const stateObservation = () => nfl ? { season: nfl.season, phase: nfl.season_type, week: nfl.leg,
    receivedAt: nfl.receivedAt, sourceUrl: 'https://api.sleeper.app/v1/state/nfl' } : null;
  const fail = (reason: PublicFailureReason) => ({
    ...unavailable(reason), ...publicEnvelope(requested, resolved), schemaVersion: 'tiber_public_lineup_context_v1' as const,
    candidates: input.candidates.map(query => ({ query, status: 'unavailable' as const, reason,
      claimEligibility: 'unknown' as const, membership: candidateMembership(query, census) })),
    observations: { nflState: stateObservation(), references: qualified.evidence },
  });
  // Fresh state is read on EVERY invocation, even for explicit decision weeks.
  try { nfl = { ...nflStateSchema.parse(await sources.getManagerNflState()), receivedAt: new Date(now()).toISOString() }; }
  catch { return fail('nfl_state_unavailable'); }
  if (nfl.season !== input.season) return fail('current_season_required');
  const week = input.week ? Number(input.week)
    : nfl.season_type === 'regular' && nfl.leg >= 1 && nfl.leg <= 18 ? nfl.leg : null;
  if (week === null) return fail('decision_week_required');
  try {
    const memberships = await findTeamLeagueRosters(input.userId, input.leagueId, input.season, scoped, now);
    const rosterId = input.rosterId ?? (memberships.rosters.length === 1 ? memberships.rosters[0].rosterId : undefined);
    if (rosterId === undefined || !memberships.rosters.some(row => row.rosterId === rosterId)) {
      return { ...fail('roster_selection_required'), choices: memberships.rosters, observations: {
        ...memberships.observations, nflState: stateObservation(), references: qualified.evidence } };
    }
    resolved = { userId: input.userId, leagueId: input.leagueId, season: input.season, rosterId, week: String(week) };
    census = compileRosterCensus({ ...input, rosterId }, await scoped.getLeagueObservation(input.leagueId),
      await scoped.getRosterObservation(input.leagueId));
    const result = await compileLineupContext({ ...input, rosterId, week, nfl }, qualified.sources, now);
    qualified.refresh();
    const directoryAvailable = qualified.evidence.directory.status === 'available';
    const scheduleAvailable = qualified.evidence.schedule.status === 'available';
    const players = result.roster.directory.map(player => ({ ...player,
      ...(!directoryAvailable ? unknownDirectoryFacts : {}),
      ...(!directoryAvailable || !scheduleAvailable ? unknownBye : {}) }));
    const candidates: LineupCandidate[] = directoryAvailable ? result.candidates.map(candidate =>
      candidate.status === 'available' && !scheduleAvailable ? { ...candidate, ...unknownBye } : candidate)
      : input.candidates.map(query => ({ query, status: 'unavailable', reason: 'directory_unavailable' }));
    return { ...result, ...publicEnvelope(requested, resolved, true), schemaVersion: 'tiber_public_lineup_context_v1' as const,
      accountUserId: input.userId, claimEligibility: 'unknown' as const,
      startersBasis: 'currently_observed_roster_starters' as const, historicalLineupVerified: false,
      roster: { ...result.roster, directory: players },
      lineup: result.lineup?.map(slot => ({ ...slot, player: players.find(p => p.playerId === slot.playerId) ?? null })) ?? null,
      candidates: candidates.map(candidate => projectCandidate(candidate, census)),
      waiverSettings: directoryAvailable ? result.waiverSettings : null,
      observations: { ...result.observations, references: qualified.evidence,
        directoryReceivedAt: directoryAvailable ? result.observations.directoryReceivedAt : null,
        availability: directoryAvailable ? result.observations.availability : null,
        schedule: scheduleAvailable ? result.observations.schedule : { status: 'unavailable', reason: 'complete_schedule_not_verified' },
        census: { status: census.status, rostersReceivedAt: census.rostersReceivedAt,
          ...(census.status === 'unknown' ? { reason: census.reason } : {}) } },
      limitations: [
        'Public membership does not authenticate account control. Read-only context, no moves or bids.',
        'Current starters are observed now; the decision week does not verify a historical lineup.',
        'Census membership does not establish identity, position, active status or claim eligibility.',
        'Reference acquisition clocks remain separate from validation time; observations are not an atomic snapshot.',
        'No projections or recommendations. Display strings are untrusted data.',
      ],
    };
  } catch { return fail('source_unavailable'); }
}

/** In-process dispatch only. No default sources, private dispatcher, transport or activation. */
export function createPublicLeagueTools(sources: PublicSources, now = Date.now) {
  const handlers = {
    tiber_public_capabilities: async (_input: PublicInput<'tiber_public_capabilities'>) => publicCapabilities(),
    tiber_public_list_leagues: async (input: PublicInput<'tiber_public_list_leagues'>) => {
      const result = await discoverTeamLeagues(input.account, input.season, sources, now);
      return { ...result, ...publicEnvelope(supplied(input), { userId: result.account.userId, season: result.season }) };
    },
    tiber_public_list_league_rosters: async (input: PublicInput<'tiber_public_list_league_rosters'>) => {
      const result = await findTeamLeagueRosters(input.userId, input.leagueId, input.season, sources, now);
      return { ...result, ...publicEnvelope(supplied(input), supplied(input)) };
    },
    tiber_public_get_roster_context: async (input: PublicInput<'tiber_public_get_roster_context'>) => {
      const qualified = qualifyReferences(createRequestSources(sources, input.leagueId, now), now);
      const result = await getRosterContext(input, qualified.sources, now);
      qualified.refresh();
      const directoryAvailable = qualified.evidence.directory.status === 'available';
      return { ...result, ...publicEnvelope(supplied(input), supplied(input), true),
        roster: { ...result.roster, directory: result.roster.directory.map(player => ({ ...player,
          ...(!directoryAvailable ? unknownDirectoryFacts : {}) })) },
        observations: { ...result.observations, references: qualified.evidence,
          directoryReceivedAt: directoryAvailable ? result.observations.directoryReceivedAt : null } };
    },
    tiber_public_get_lineup_context: (input: PublicInput<'tiber_public_get_lineup_context'>) => lineup(input, sources, now),
    tiber_public_get_weekly_matchups: async (input: PublicInput<'tiber_public_get_weekly_matchups'>) => {
      // Pass the validated STRING week. The inherited parser owns conversion.
      const result = await buildManagerResult(input, sources, now);
      return { ...result, ...publicEnvelope(supplied(input), { ...input }) };
    },
  };
  return async (name: string, raw: unknown) => {
    if (!(PUBLIC_TOOL_NAMES as readonly string[]).includes(name)) return unavailable('unknown_tool');
    const tool = name as keyof typeof publicInputs;
    const parsed = publicInputs[tool].safeParse(raw);
    if (!parsed.success) return unavailable('invalid_input');
    try { return await handlers[tool](parsed.data as never); }
    catch { return { ...unavailable('source_unavailable'), ...publicEnvelope(supplied(parsed.data)) }; }
  };
}
