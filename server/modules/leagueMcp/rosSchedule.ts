import { SCHEDULE_TEAMS, type Fixture, type Schedule } from './schedule';

/** Regular-season bound of the validated schedule. It is never the fantasy championship by default. */
export const REGULAR_SEASON_END = 18;
const canonicalTeams = new Set(SCHEDULE_TEAMS);
export const isCanonicalTeam = (team: string) => canonicalTeams.has(team);

export type WindowKind = 'next3' | 'ros' | 'playoffs' | 'custom';
export type WindowRequest =
  | { kind: 'next3'; finalWeek: number | null }
  | { kind: 'ros'; finalWeek: number | null }
  | { kind: 'playoffs'; finalWeek: number | null }
  | { kind: 'custom'; startWeek: number; endWeek: number };
/** Verified from the selected league's settings; 0 means no playoffs are configured. */
export type PlayoffStart = { status: 'verified'; value: number } | { status: 'unavailable'; reason: string };
export type CalendarInput = { schedule: Schedule; team: string; decisionWeek: number; window: WindowRequest; playoffStart: PlayoffStart };

export type WitnessReason = 'not_inspected' | 'absent_from_inspected_source' | 'disagreement' | 'insufficient_sample'
  | 'stale_evidence' | 'unsupported_scoring' | 'no_qualified_defensive_evidence';
export type MissingWitness = {
  id: string;
  scope: { season: string; team: string; weeks: number[] | null; metric: string };
  reason: WitnessReason;
  affectedClaim: string;
  evidenceNeeded: string;
  sourceRef: string | null;
};
export type WindowFixture = {
  week: number;
  status: 'scheduled_date_only' | 'bye';
  bye: boolean;
  gameId: string | null; gameday: string | null; opponent: string | null;
  /** Source home/away label only; it does not establish physical venue or neutral-site conditions. */
  designation: 'home' | 'away' | null;
  relativeToDecisionWeek: 'before' | 'decision_week' | 'after';
  /** Weeks before the decision week are team history; player membership for them is not verified here. */
  teamHistoryOnly: boolean;
  kickoff: null; lockState: 'unknown'; completion: 'unknown'; postponement: 'unknown'; venue: 'unknown';
  opponentDefense: null | { rating: null; reason: 'no_qualified_defensive_evidence'; cutoff: null };
};
type Counts = { weeks: number; scheduledGames: number; byes: number; eligibleGames: null; ratedGames: null };
export type CompiledWindow = {
  kind: WindowKind;
  status: 'available' | 'unavailable';
  reason: string | null;
  basis: string;
  requested: { startWeek: number; endWeek: number } | null;
  weeks: number[];
  clampedBy: 'regular_season_end' | 'caller_supplied_final_week' | null;
  counts: Counts;
  fixtures: WindowFixture[];
};
export type CompiledCalendar = {
  window: CompiledWindow;
  /** Preserved schedule facts when the requested window cannot be interpreted. Not the league ROS. */
  regularSeasonRemainder: { basis: string; weeks: number[]; counts: Counts; fixtures: WindowFixture[] } | null;
  missingWitnesses: MissingWitness[];
};

const range = (start: number, end: number) => start > end ? [] : Array.from({ length: end - start + 1 }, (_, i) => start + i);
const emptyCounts = (): Counts => ({ weeks: 0, scheduledGames: 0, byes: 0, eligibleGames: null, ratedGames: null });

function fixtureRow(schedule: Schedule, team: string, week: number, decisionWeek: number): WindowFixture {
  const relative = week < decisionWeek ? 'before' : week === decisionWeek ? 'decision_week' : 'after';
  const common = { week, relativeToDecisionWeek: relative, teamHistoryOnly: week < decisionWeek,
    kickoff: null, lockState: 'unknown', completion: 'unknown', postponement: 'unknown', venue: 'unknown' } as const;
  const game: Fixture | undefined = schedule.teamWeeks[team].find(f => f.week === week);
  if (!game) {
    // A missing team-week is a verified bye only because compileSchedule proved 17 fixtures per team.
    if (schedule.byeWeeks[team] !== week) throw new Error('Schedule invariant violated');
    return { ...common, status: 'bye', bye: true, gameId: null, gameday: null, opponent: null, designation: null, opponentDefense: null };
  }
  return { ...common, status: 'scheduled_date_only', bye: false, gameId: game.gameId, gameday: game.gameday, opponent: game.opponent,
    designation: game.designation, opponentDefense: { rating: null, reason: 'no_qualified_defensive_evidence', cutoff: null } };
}

function block(schedule: Schedule, team: string, weeks: number[], decisionWeek: number) {
  const fixtures = weeks.map(week => fixtureRow(schedule, team, week, decisionWeek));
  const byes = fixtures.filter(f => f.bye).length;
  const counts: Counts = { weeks: weeks.length, scheduledGames: fixtures.length - byes, byes, eligibleGames: null, ratedGames: null };
  return { fixtures, counts };
}

/** Pure calendar/window compiler over a validated schedule. No fetches, no ratings, no derived league final. */
export function compileCalendar(input: CalendarInput): CompiledCalendar {
  const { schedule, team, decisionWeek, window } = input;
  if (!isCanonicalTeam(team) || !schedule.teamWeeks[team]) throw new Error('Canonical team required');
  if (!Number.isInteger(decisionWeek) || decisionWeek < 1 || decisionWeek > REGULAR_SEASON_END) throw new Error('Decision week out of bounds');
  const season = schedule.season;
  const witnesses: MissingWitness[] = [];
  const witness = (scope: string, metric: string, reason: WitnessReason, weeks: number[] | null, affectedClaim: string, evidenceNeeded: string) =>
    witnesses.push({ id: `SOS-${season}-${team}-${scope}-${metric}-${reason}`, scope: { season, team, weeks, metric }, reason, affectedClaim, evidenceNeeded, sourceRef: null });
  const unavailable = (reason: string, basis: string, requested: CompiledWindow['requested'] = null): CompiledWindow =>
    ({ kind: window.kind, status: 'unavailable', reason, basis, requested, weeks: [], clampedBy: null, counts: emptyCounts(), fixtures: [] });
  const available = (basis: string, requested: NonNullable<CompiledWindow['requested']>, weeks: number[], clampedBy: CompiledWindow['clampedBy'] = null): CompiledWindow =>
    ({ kind: window.kind, status: 'available', reason: null, basis, requested, weeks, clampedBy, ...block(schedule, team, weeks, decisionWeek) });
  const finalWeekWitness = (scope: string) => witness(scope, 'league_final_week', 'not_inspected', null, `${scope} window end`,
    'Explicit finalWeek argument (the league final week, at most week 18) or a separately validated derivation from league playoff settings. Week 18 is not assumed to be the fantasy championship.');

  let compiled: CompiledWindow;
  if (window.kind === 'next3') {
    const basis = 'decision_week_through_decision_week_plus_two';
    const requested = { startWeek: decisionWeek, endWeek: decisionWeek + 2 };
    let end = requested.endWeek, clampedBy: CompiledWindow['clampedBy'] = null;
    if (window.finalWeek !== null && end > window.finalWeek) { end = window.finalWeek; clampedBy = 'caller_supplied_final_week'; }
    if (end > REGULAR_SEASON_END) { end = REGULAR_SEASON_END; clampedBy = 'regular_season_end'; }
    compiled = end < decisionWeek ? unavailable('final_week_before_decision_week', basis, requested) : available(basis, requested, range(decisionWeek, end), clampedBy);
  } else if (window.kind === 'ros') {
    const basis = 'decision_week_through_caller_supplied_final_week';
    if (window.finalWeek === null) { finalWeekWitness('ros'); compiled = unavailable('league_final_week_required', basis); }
    else if (window.finalWeek < decisionWeek) compiled = unavailable('final_week_before_decision_week', basis, { startWeek: decisionWeek, endWeek: window.finalWeek });
    else compiled = available(basis, { startWeek: decisionWeek, endWeek: window.finalWeek }, range(decisionWeek, window.finalWeek));
  } else if (window.kind === 'playoffs') {
    const basis = 'verified_league_playoff_start_through_caller_supplied_final_week';
    const start = input.playoffStart;
    if (start.status !== 'verified') {
      witness('playoffs', 'league_playoff_start', 'absent_from_inspected_source', null, 'playoffs window start',
        `Verified playoff_week_start from the selected league's settings; current state: ${start.reason}.`);
      compiled = unavailable('playoff_start_unknown', basis);
    } else if (start.value === 0) compiled = unavailable('no_playoffs_configured', 'verified_league_setting_playoff_week_start_0');
    else if (start.value > REGULAR_SEASON_END) compiled = unavailable('playoff_start_outside_regular_season', basis, { startWeek: start.value, endWeek: window.finalWeek ?? start.value });
    else if (window.finalWeek === null) { finalWeekWitness('playoffs'); compiled = unavailable('league_final_week_required', basis, { startWeek: start.value, endWeek: start.value }); }
    else if (window.finalWeek < start.value) compiled = unavailable('final_week_before_playoff_start', basis, { startWeek: start.value, endWeek: window.finalWeek });
    else compiled = available(basis, { startWeek: start.value, endWeek: window.finalWeek }, range(start.value, window.finalWeek));
  } else {
    const { startWeek, endWeek } = window;
    const valid = [startWeek, endWeek].every(w => Number.isInteger(w) && w >= 1 && w <= REGULAR_SEASON_END) && startWeek <= endWeek;
    compiled = valid ? available('caller_supplied_range', { startWeek, endWeek }, range(startWeek, endWeek)) : unavailable('invalid_custom_range', 'caller_supplied_range', { startWeek, endWeek });
  }

  const remainderWeeks = range(decisionWeek, REGULAR_SEASON_END);
  const regularSeasonRemainder = compiled.status === 'unavailable'
    ? { basis: 'decision_week_through_regular_season_end_not_league_final', weeks: remainderWeeks, ...block(schedule, team, remainderWeeks, decisionWeek) }
    : null;
  // Witnesses describe whichever fixture block the response actually carries.
  const carried = compiled.status === 'available' ? { scope: compiled.kind, fixtures: compiled.fixtures } : { scope: 'regular_season_remainder', fixtures: regularSeasonRemainder!.fixtures };
  const scheduled = carried.fixtures.filter(f => !f.bye).map(f => f.week);
  if (scheduled.length) {
    witness(carried.scope, 'opponent_defense_rating', 'no_qualified_defensive_evidence', scheduled,
      'per-fixture opponent defensive rating and any window average or rank',
      'A qualified, scoring-labeled, cutoff-stamped defense x position allowance snapshot admitted for this consumer; none was identified in the inspected sources.');
    witness(carried.scope, 'lock_state', 'not_inspected', scheduled,
      'whether each listed game remains usable (unplayed, unlocked, not postponed) at decision time',
      'Validated kickoff, lock, completion and postponement semantics; the schedule source supplies calendar dates only.');
  }
  const history = carried.fixtures.filter(f => f.teamHistoryOnly).map(f => f.week);
  if (history.length) {
    witness(carried.scope, 'historical_player_membership', 'not_inspected', history,
      'that a resolved player was on this team for fixtures before the decision week',
      'Event-effective player-team membership for those weeks; current directory team membership does not establish it.');
  }
  return { window: compiled, regularSeasonRemainder, missingWitnesses: witnesses };
}
