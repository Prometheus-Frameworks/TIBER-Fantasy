import { z } from 'zod';
import { sleeperId, leagueSeason } from '../../../shared/teamLeagues';
import { sleeperClient } from '../../integrations/sleeperClient';
import { getDraftReviewPlayerDirectory } from '../draftReview/playerDirectory';
import { discoverTeamLeagues, findTeamLeagueRosters } from '../draftReview/teamLeagues';
import { readLeagueAvailabilityForSelection, directoryEntry, display } from '../draftReview/leagueAvailability';
import { compileWaiverCandidates } from '../draftReview/waiverCandidateCompiler';
import { getRosterContext, type RosterSources } from './rosterContext';
import { getSchedule, type Schedule } from './schedule';
import { matchDirectoryEntries, SKILL_POSITIONS } from './identity';
import { nflStateSchema } from './nflState';
import { createScheduleStrengthReader } from './scheduleStrength';

export const myLeaguesInput = z.object({ season: leagueSeason.optional() }).strict();
export const lineupContextInput = z.object({
  leagueId: sleeperId.optional(), season: leagueSeason.optional(),
  rosterId: z.number().int().min(1).max(64).optional(),
  week: z.string().regex(/^(?:[1-9]|1[0-8])$/).optional(),
  candidates: z.array(z.string().trim().min(1).max(120)).max(5).default([]),
}).strict();
export const personalProfileSchema = z.object({ userId: sleeperId, defaultLeagueId: sleeperId.optional() }).strict();
export type PersonalProfile = z.infer<typeof personalProfileSchema>;
export type PersonalSources = RosterSources & Pick<typeof sleeperClient, 'getUser' | 'getUserLeagues' | 'getManagerNflState'> & {
  getSchedule: (season: string) => Promise<Schedule>;
};
type Sources = PersonalSources;
const defaults: Sources = { ...sleeperClient, getDirectory: getDraftReviewPlayerDirectory, getSchedule };
const stateSchema = nflStateSchema;

export function createPersonalReaders(rawProfile: PersonalProfile, sources: Sources = defaults) {
  const profile = personalProfileSchema.parse(rawProfile);
  async function state() {
    try { return { ...stateSchema.parse(await sources.getManagerNflState()), receivedAt: new Date().toISOString() }; }
    catch { return null; }
  }
  return {
    scheduleStrength: createScheduleStrengthReader(profile, sources),
    myLeagues: async (raw: z.input<typeof myLeaguesInput>) => {
      const input = myLeaguesInput.parse(raw);
      const nfl = input.season ? null : await state();
      const season = input.season ?? nfl?.season;
      if (!season) return { status: 'unavailable', reason: 'season_required' };
      return discoverTeamLeagues(profile.userId, season, sources);
    },
    lineup: async (raw: z.input<typeof lineupContextInput>) => {
      const input = lineupContextInput.parse(raw);
      const nfl = await state();
      const season = input.season ?? nfl?.season;
      const leagueId = input.leagueId ?? profile.defaultLeagueId;
      if (!season || !leagueId) return { status: 'unavailable', reason: 'league_and_season_required', nextTool: 'tiber_get_my_leagues' };
      const week = input.week ? Number(input.week)
        : nfl?.season === season && nfl.season_type === 'regular' && nfl.leg >= 1 && nfl.leg <= 18 ? nfl.leg : null;
      // One request shares league/roster observations; no all-league roster fan-out.
      const leaguePromise = sources.getLeague(leagueId);
      const rosterPromise = sources.getLeagueRosters(leagueId);
      let directoryPromise: ReturnType<Sources['getDirectory']> | undefined;
      const scoped = { ...sources, getLeague: () => leaguePromise, getLeagueRosters: () => rosterPromise,
        getDirectory: () => directoryPromise ??= sources.getDirectory() };
      const memberships = await findTeamLeagueRosters(profile.userId, leagueId, season, scoped);
      const rosterId = input.rosterId ?? (memberships.rosters.length === 1 ? memberships.rosters[0].rosterId : null);
      if (!rosterId || !memberships.rosters.some(r => r.rosterId === rosterId)) {
        return { status: 'unavailable', reason: 'roster_selection_required', memberships };
      }
      const context = await getRosterContext({ userId: profile.userId, leagueId, season, rosterId }, scoped);
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
      let candidates: unknown[] = input.candidates.map(query => ({ query, status: 'unavailable', reason: 'directory_unavailable' }));
      let waiverSettings: unknown = null;
      let availabilityObservations: unknown = null;
      try {
        const availability = await readLeagueAvailabilityForSelection({ leagueId, rosterId, canonicalUrl: `https://sleeper.com/roster/${leagueId}/${rosterId}` }, scoped);
        if (availability.league.season !== season) throw new Error('Season mismatch');
        const evidence = compileWaiverCandidates(availability);
        waiverSettings = evidence.waiver_settings; availabilityObservations = evidence.observations;
        candidates = input.candidates.map(query => {
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
      return { ...context, schemaVersion: 'tiber_personal_lineup_context_v1',
        accountUserId: profile.userId, selectionBasis: input.leagueId ? 'explicit_league' : 'configured_default_league',
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
    },
  };
}
