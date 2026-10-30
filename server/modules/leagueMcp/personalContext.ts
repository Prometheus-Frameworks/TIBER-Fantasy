import { createRequestSources } from '../draftReview/sourceObservations';
import { compileLineupContext } from './lineupContext';
import { z } from 'zod';
import { sleeperId, leagueSeason } from '../../../shared/teamLeagues';
import { sleeperClient } from '../../integrations/sleeperClient';
import { getDraftReviewPlayerDirectory } from '../draftReview/playerDirectory';
import { discoverTeamLeagues, findTeamLeagueRosters } from '../draftReview/teamLeagues';
import { type RosterSources } from './rosterContext';
import { getSchedule, type Schedule } from './schedule';
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
      const scoped = createRequestSources(sources, leagueId);
      const memberships = await findTeamLeagueRosters(profile.userId, leagueId, season, scoped);
      const rosterId = input.rosterId ?? (memberships.rosters.length === 1 ? memberships.rosters[0].rosterId : null);
      if (!rosterId || !memberships.rosters.some(r => r.rosterId === rosterId)) {
        return { status: 'unavailable', reason: 'roster_selection_required', memberships };
      }
      const context = await compileLineupContext({ userId: profile.userId, leagueId, season, rosterId, week, candidates: input.candidates, nfl }, scoped);
      return { ...context, schemaVersion: 'tiber_personal_lineup_context_v1',
        accountUserId: profile.userId, selectionBasis: input.leagueId ? 'explicit_league' : 'configured_default_league' };
    },
  };
}
