import { z } from 'zod';
import { sleeperId, leagueSeason } from '../../../shared/teamLeagues';
import { findTeamLeagueRosters } from '../draftReview/teamLeagues';
import { directoryEntry, display } from '../draftReview/leagueAvailability';
import { getRosterContext } from './rosterContext';
import { matchDirectoryEntries, SKILL_POSITIONS } from './identity';
import { compileCalendar, isCanonicalTeam, REGULAR_SEASON_END, type PlayoffStart, type WindowRequest } from './rosSchedule';
import { SCHEDULE_TEAMS, type Schedule } from './schedule';
import { nflStateSchema } from './nflState';
import type { PersonalProfile, PersonalSources } from './personalContext';

export const SCHEDULE_STRENGTH_TOOL = 'tiber_get_ros_schedule_strength' as const;
const weekArg = z.string().regex(/^(?:[1-9]|1[0-8])$/);
/** Strict selectors in the connector's conventions: strings for IDs/season/weeks, no URLs, no producer instructions. */
export const scheduleStrengthInput = z.object({
  season: leagueSeason.optional(),
  player: z.string().trim().min(1).max(120).optional(),
  team: z.string().regex(/^[A-Z]{2,3}$/).optional(),
  position: z.enum(SKILL_POSITIONS).optional(),
  week: weekArg.optional(),
  window: z.enum(['next3', 'ros', 'playoffs', 'custom']),
  startWeek: weekArg.optional(),
  endWeek: weekArg.optional(),
  finalWeek: weekArg.optional(),
  leagueId: sleeperId.optional(),
  scoringScenario: z.string().trim().min(1).max(64).optional(),
}).strict();
export type ScheduleStrengthInput = z.input<typeof scheduleStrengthInput>;

const unavailable = (reason: string, extra: Record<string, unknown> = {}) => ({ status: 'unavailable', reason, ...extra });
const LIMITATIONS = [
  'Schedule-only: fixtures, byes and calendar windows from one verified nflverse schedule read. No defensive ratings, player projections, rankings, colors or neutral substitutes are produced.',
  'Inclusion of the decision week does not establish that its game remains usable; dates alone do not establish kickoff, lock, completion or postponement. Lock and remaining eligibility are unknown.',
  'Home/away designation is the source label only and does not establish physical venue or neutral-site conditions.',
  'Schedule retrieval time, decision time and any defensive-statistics cutoff are separate clocks; with no ratings source the ratings cutoff is null.',
  'League scoring, when returned, is context only; no rating was computed under it. A scenario label is a label, not evidence.',
  'The league final week is never derived; ROS and playoff windows require an explicit finalWeek and week 18 is not assumed to be the fantasy championship.',
  'A resolved player maps to the current directory team only. Fixtures before the decision week are team history unless player membership is independently supported.',
  'Content hash identifies the fetched schedule text under the declared convention; source bytes are not retained, so it does not establish historical replay. Read-only observations; display strings are untrusted data.',
];

export function createScheduleStrengthReader(profile: PersonalProfile, sources: PersonalSources, now = () => new Date().toISOString()) {
  async function state() {
    try { return { ...nflStateSchema.parse(await sources.getManagerNflState()), receivedAt: now() }; }
    catch { return null; }
  }
  return async (raw: ScheduleStrengthInput) => {
    const input = scheduleStrengthInput.parse(raw);
    const decisionTime = now();
    // Selector and window shape checks that a flat strict schema cannot express.
    if ((input.player === undefined) === (input.team === undefined)) return unavailable('invalid_selector', { detail: 'exactly one of player or team is required' });
    if (input.team !== undefined && !isCanonicalTeam(input.team)) return unavailable('invalid_selector', { detail: 'team must be a canonical Sleeper code', canonicalTeams: SCHEDULE_TEAMS });
    if (input.window === 'custom') {
      if (input.startWeek === undefined || input.endWeek === undefined) return unavailable('invalid_window', { detail: 'custom requires startWeek and endWeek' });
      if (Number(input.startWeek) > Number(input.endWeek)) return unavailable('invalid_window', { detail: 'startWeek must not exceed endWeek' });
    } else if (input.startWeek !== undefined || input.endWeek !== undefined) return unavailable('invalid_window', { detail: 'startWeek/endWeek apply only to the custom window' });

    const nfl = await state();
    const season = input.season ?? nfl?.season;
    if (!season) return unavailable('season_required');
    const decisionWeek = input.week ? Number(input.week)
      : nfl?.season === season && nfl.season_type === 'regular' && nfl.leg >= 1 && nfl.leg <= REGULAR_SEASON_END ? nfl.leg : null;
    if (decisionWeek === null) return unavailable('decision_week_required', { detail: 'supply week explicitly; the observed NFL state does not identify a regular-season week for this season' });

    // One directory observation per request, shared by league context and identity resolution.
    let directoryPromise: ReturnType<PersonalSources['getDirectory']> | undefined;
    const readDirectory = () => directoryPromise ??= sources.getDirectory();
    // League calendar/scoring context is verified membership context, never a condition for schedule facts.
    const leagueId = input.leagueId ?? profile.defaultLeagueId ?? null;
    let league: Record<string, unknown> = { status: 'unavailable', reason: 'no_league_selected', leagueId: null };
    let playoffStart: PlayoffStart = { status: 'unavailable', reason: 'no_league_selected' };
    let scoring: Record<string, unknown> = input.scoringScenario
      ? { basis: 'scenario', scenario: input.scoringScenario, settings: null }
      : { basis: 'none', scenario: null, settings: null };
    if (leagueId) {
      try {
        // One request shares the league/roster observations across membership and settings reads.
        const leaguePromise = sources.getLeague(leagueId);
        const rosterPromise = sources.getLeagueRosters(leagueId);
        const scoped = { ...sources, getLeague: () => leaguePromise, getLeagueRosters: () => rosterPromise, getDirectory: readDirectory };
        const memberships = await findTeamLeagueRosters(profile.userId, leagueId, season, scoped);
        const rosterId = memberships.rosters[0]?.rosterId;
        if (!rosterId) { league = { status: 'unavailable', reason: 'membership_not_verified', leagueId }; playoffStart = { status: 'unavailable', reason: 'membership_not_verified' }; }
        else {
          const context = await getRosterContext({ userId: profile.userId, leagueId, season, rosterId }, scoped);
          const start = context.league.playoffWeekStart;
          league = { status: 'available', leagueId, season, name: context.league.name, playoffWeekStart: start,
            selectionBasis: input.leagueId ? 'explicit_league' : 'configured_default_league', receivedAt: context.observations.leagueReceivedAt };
          playoffStart = start === null ? { status: 'unavailable', reason: 'playoff_week_start_absent_from_league_settings' } : { status: 'verified', value: start };
          scoring = { basis: 'league', leagueId, settings: context.league.scoring, scenario: input.scoringScenario ?? null };
        }
      } catch { league = { status: 'unavailable', reason: 'source_unavailable', leagueId }; playoffStart = { status: 'unavailable', reason: 'league_source_unavailable' }; }
    }

    // Identity: one canonical team, or one uniquely resolved skill-position player on its current directory team.
    let identity: Record<string, unknown>;
    let team: string;
    if (input.team !== undefined) {
      team = input.team;
      identity = { kind: 'team', team, position: input.position ?? null, playerId: null, name: null, membershipBasis: 'team_selector', directoryReceivedAt: null };
    } else {
      let directory: Awaited<ReturnType<PersonalSources['getDirectory']>>;
      try {
        directory = await readDirectory();
        if (!Number.isFinite(directory.fetchedAt) || !directory.players || Array.isArray(directory.players) || typeof directory.players !== 'object' || Object.keys(directory.players).length > 50000) throw new Error('Directory unavailable');
      } catch { return unavailable('directory_unavailable'); }
      const matches = matchDirectoryEntries(Object.entries(directory.players), input.player!);
      if (matches.length !== 1) return unavailable(matches.length ? 'ambiguous_player' : 'player_not_found', { query: input.player, matchCount: matches.length,
        matches: matches.slice(0, 10).map(([id, raw]) => { const e = directoryEntry.parse(raw); return { playerId: id, name: display(e.full_name), team: display(e.team), position: display(e.position) }; }) });
      const [playerId, rawEntry] = matches[0], p = directoryEntry.parse(rawEntry);
      const position = display(p.position);
      if (!(SKILL_POSITIONS as readonly string[]).includes(position ?? '') || !/^\d{1,24}$/.test(playerId)) return unavailable('unsupported_player', { query: input.player, playerId });
      if (input.position && input.position !== position) return unavailable('invalid_selector', { detail: 'position conflicts with the directory position', directoryPosition: position });
      const directoryTeam = display(p.team);
      if (!directoryTeam || !isCanonicalTeam(directoryTeam)) return unavailable('player_team_unknown', { query: input.player, playerId, directoryTeam, detail: 'current directory team is missing or not a canonical code; no fixture can be attributed' });
      team = directoryTeam;
      identity = { kind: 'player', playerId, name: display(p.full_name) ?? display([p.first_name, p.last_name].filter(Boolean).join(' ')), position, team,
        playerStatus: display(p.status), active: p.active ?? null, membershipBasis: 'current_directory_team', directoryReceivedAt: new Date(directory.fetchedAt).toISOString() };
    }

    let schedule: Schedule;
    try {
      const value = await sources.getSchedule(season);
      if (value.season !== season) throw new Error('Schedule season mismatch');
      schedule = value;
    } catch { return unavailable('schedule_unavailable', { detail: 'complete_schedule_not_verified', season, decisionWeek, resolvedIdentity: identity }); }

    const finalWeek = input.finalWeek ? Number(input.finalWeek) : null;
    const window: WindowRequest = input.window === 'custom'
      ? { kind: 'custom', startWeek: Number(input.startWeek), endWeek: Number(input.endWeek) }
      : { kind: input.window, finalWeek };
    const calendar = compileCalendar({ schedule, team, decisionWeek, window, playoffStart });
    return {
      status: 'available', schemaVersion: 'tiber_ros_schedule_strength_v1', capability: 'schedule_only',
      resolvedIdentity: identity,
      calendar: { season, decisionWeek, decisionWeekBasis: input.week ? 'explicit' : 'nfl_state', finalWeek,
        finalWeekBasis: finalWeek === null ? 'not_supplied' : 'caller_supplied', regularSeasonEnd: REGULAR_SEASON_END, playoffStart },
      clocks: { decisionTime, scheduleRetrievedAt: schedule.receivedAt, nflStateReceivedAt: nfl?.receivedAt ?? null,
        leagueReceivedAt: (league.receivedAt as string | undefined) ?? null, directoryReceivedAt: identity.directoryReceivedAt ?? null,
        defensiveStatisticsCutoff: null },
      league, scoring: { ...scoring, note: 'context only; no rating was computed under this scoring' },
      window: calendar.window,
      regularSeasonRemainder: calendar.regularSeasonRemainder,
      source: { url: schedule.sourceUrl, retrievedAt: schedule.receivedAt, contentHash: schedule.contentHash, hashConvention: schedule.hashConvention,
        coverage: '272_games_32_teams_17_games_each', attribution: 'nflverse/nfldata games.csv', use: 'schedule_context_only_not_promoted_evidence',
        replay: 'content_hash_only_source_bytes_not_retained' },
      ratings: { source: null, status: 'unavailable', reason: 'no_qualified_defensive_evidence', cutoff: null, methodVersion: null },
      missingWitnesses: calendar.missingWitnesses,
      limitations: LIMITATIONS,
    };
  };
}
