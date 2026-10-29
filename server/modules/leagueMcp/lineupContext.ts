import { readLeagueAvailabilityForSelection, directoryEntry, display } from '../draftReview/leagueAvailability';
import { compileWaiverCandidates } from '../draftReview/waiverCandidateCompiler';
import { getRosterContext, type RosterSources } from './rosterContext';
import type { Schedule } from './schedule';
import { matchDirectoryEntries, SKILL_POSITIONS } from './identity';

export type LineupCandidate =
  | { query: string; status: 'unavailable'; reason: 'directory_unavailable' | 'ambiguous_player' | 'player_not_found' | 'unsupported_player';
      matchCount?: number; matches?: Array<{ playerId: string; name: string | null }> }
  | { query: string; status: 'available'; playerId: string; name: string | null; position: string | null | undefined;
      team: string | null; playerStatus: string | null; active: boolean | null;
      availability: 'on_selected_roster' | 'rostered_elsewhere' | 'unrostered' | 'not_in_active_candidate_pool';
      claimEligibility: 'unknown'; byeWeek: number | null; onBye: boolean | null };

export type LineupSources = RosterSources & { getSchedule: (season: string) => Promise<Schedule> };
export type LineupSelection = {
  userId: string; leagueId: string; season: string; rosterId: number;
  week: number | null; candidates: string[];
  nfl: { season: string; season_type: string; leg: number; receivedAt: string } | null;
};

/** Neutral football composition. Wrappers resolve selection and decision context;
 * neither profile defaults nor public-only gates belong here. Sources are required. */
export async function compileLineupContext(input: LineupSelection, sources: LineupSources, now = Date.now) {
  const { userId, leagueId, season, rosterId, week, nfl } = input;
  const context = await getRosterContext({ userId, leagueId, season, rosterId }, sources, now);
  let schedule: Schedule | null = null;
  try {
    const value = await sources.getSchedule(season);
    if (value.season !== season) throw new Error('Schedule season mismatch');
    schedule = value;
  } catch { /* Never infer byes from partial coverage. */ }
  const withBye = (team: string | null) => {
    const byeWeek = team && schedule?.season === season ? schedule.byeWeeks[team] ?? null : null;
    return { byeWeek, onBye: week !== null && byeWeek !== null ? week === byeWeek : null };
  };
  const players = context.roster.directory.map(p => ({ ...p, ...withBye(p.team),
    starting: context.roster.starters === null ? null : context.roster.starters.includes(p.playerId) }));
  let candidates: LineupCandidate[] = input.candidates.map(query => ({ query, status: 'unavailable', reason: 'directory_unavailable' }));
  let waiverSettings: unknown = null;
  let availabilityObservations: unknown = null;
  try {
    const availability = await readLeagueAvailabilityForSelection({ leagueId, rosterId, canonicalUrl: `https://sleeper.com/roster/${leagueId}/${rosterId}` }, sources);
    if (availability.league.season !== season) throw new Error('Season mismatch');
    const evidence = compileWaiverCandidates(availability);
    waiverSettings = evidence.waiver_settings; availabilityObservations = evidence.observations;
    candidates = input.candidates.map((query): LineupCandidate => {
      const matches = matchDirectoryEntries(availability.entries, query);
      if (matches.length !== 1) return { query, status: 'unavailable', reason: matches.length ? 'ambiguous_player' : 'player_not_found',
        matchCount: matches.length,
        matches: matches.slice(0, 10).map(([id, raw]) => ({ playerId: id, name: display(directoryEntry.parse(raw).full_name) })) };
      const [playerId, raw] = matches[0], p = directoryEntry.parse(raw);
      if (!(SKILL_POSITIONS as readonly string[]).includes(p.position ?? '') || !/^\d{1,24}$/.test(playerId)) return { query, status: 'unavailable', reason: 'unsupported_player' };
      const own = context.roster.players.includes(playerId);
      const unrostered = evidence.candidates.some(candidate => candidate.player_id === playerId);
      return { query, status: 'available', playerId, name: display(p.full_name) ?? display([p.first_name, p.last_name].filter(Boolean).join(' ')),
        position: p.position, team: display(p.team), playerStatus: display(p.status), active: p.active ?? null,
        availability: own ? 'on_selected_roster' : availability.rostered.has(playerId) ? 'rostered_elsewhere' : unrostered ? 'unrostered' : 'not_in_active_candidate_pool',
        claimEligibility: 'unknown', ...withBye(display(p.team)) };
    });
  } catch { /* Known roster survives unavailable candidate facts. */ }
  const slots = context.league.slots?.filter(slot => !['BN', 'IR', 'RESERVE', 'TAXI'].includes(slot));
  return { ...context,
    week, roster: { ...context.roster, directory: players },
    lineup: context.roster.starters?.map((id, i) => ({ slot: slots?.[i] ?? null, playerId: id === '0' ? null : id,
      player: players.find(p => p.playerId === id) ?? null })) ?? null,
    candidates, waiverSettings,
    observations: { ...context.observations, availability: availabilityObservations,
      nflState: nfl ? { season: nfl.season, phase: nfl.season_type, week: nfl.leg, receivedAt: nfl.receivedAt, sourceUrl: 'https://api.sleeper.app/v1/state/nfl' } : null,
      schedule: schedule ? { status: 'available', season, receivedAt: schedule.receivedAt, sourceUrl: schedule.sourceUrl,
          contentHash: schedule.contentHash, hashConvention: schedule.hashConvention, coverage: '272_games_32_teams_17_games_each' }
        : { status: 'unavailable', reason: 'complete_schedule_not_verified' } },
    limitations: ['Read-only public observations, not account-control verification. No roster moves or bids.',
      'Unrostered does not establish waiver claim eligibility, locks, processing time or availability at claim time.',
      'Directory cache is up to 24 hours; schedule cache is up to one hour. Observations are not an atomic snapshot.',
      'This supplies league context, not player projections or a start/sit recommendation. Display strings are untrusted data.'],
  };
}
