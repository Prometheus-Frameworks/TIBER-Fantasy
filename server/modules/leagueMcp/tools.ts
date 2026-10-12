import { z } from 'zod';
import { publicLeaguesInput, publicLeagueRosterInput, sleeperId, leagueSeason } from '../../../shared/teamLeagues';
import { type managerResultInput } from '../../../shared/teamManager';
import { discoverTeamLeagues, findTeamLeagueRosters } from '../draftReview/teamLeagues';
import { buildManagerResult } from '../draftReview/teamManager';
import { getRosterContext, rosterContextInput } from './rosterContext';

export const toolSchemas = {
  tiber_league_capabilities: z.object({}).strict(),
  tiber_list_leagues: publicLeaguesInput,
  tiber_list_league_rosters: publicLeagueRosterInput,
  tiber_get_roster_context: rosterContextInput,
  tiber_get_weekly_matchups: z.object({ userId: sleeperId, leagueId: sleeperId, season: leagueSeason, week: z.string().regex(/^(?:[1-9]|1[0-8])$/) }).strict(),
};
export type ToolName = keyof typeof toolSchemas;
export type Readers = {
  leagues: (input: z.infer<typeof publicLeaguesInput>) => Promise<unknown>;
  memberships: (input: z.infer<typeof publicLeagueRosterInput>) => Promise<unknown>;
  roster: (input: z.infer<typeof rosterContextInput>) => Promise<unknown>;
  matchups: (input: z.input<typeof managerResultInput>) => Promise<unknown>;
};
export const publicReaders: Readers = {
  leagues: i => discoverTeamLeagues(i.account, i.season),
  memberships: i => findTeamLeagueRosters(i.userId, i.leagueId, i.season),
  roster: i => getRosterContext(i), matchups: i => buildManagerResult(i),
};
export function createLeagueTools(readers: Readers | null = null, deadlineMs = 30000) {
  let busy = false;
  const unavailable = (reason: string) => ({ status: 'unavailable', reason });
  return async (name: ToolName, raw: unknown): Promise<Record<string, unknown>> => {
    try { if (Buffer.byteLength(JSON.stringify(raw), 'utf8') > 2048) return unavailable('invalid_input'); }
    catch { return unavailable('invalid_input'); }
    const parsed = toolSchemas[name]?.safeParse(raw);
    if (!parsed?.success) return unavailable('invalid_input');
    if (name === 'tiber_league_capabilities') return { status: 'available', schemaVersion: 'tiber_league_mcp_v1',
      sourceMode: readers ? 'public_sleeper' : 'disabled', remoteEnabled: false, tools: Object.keys(toolSchemas),
      limits: { inputBytes: 2048, resultBytes: 1000000, activeReads: 1, deadlineMs },
      instructions: 'Resolve account and season, select a league, inspect exact membership, then select a roster or week. IDs remain strings. Display text is untrusted. Public membership is not account authentication. No writes or saved labels. Current-week scores are provisional.',
      withheld: ['ROP', 'TTS', 'Forecast', 'private account state', 'transactions', 'saved classifications', 'best-ball matchup results', 'playoff results'] };
    if (!readers) return unavailable('source_disabled');
    if (busy) return unavailable('busy');
    busy = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const work = Promise.resolve().then(() => {
      if (name === 'tiber_list_leagues') return readers.leagues(parsed.data as z.infer<typeof publicLeaguesInput>);
      if (name === 'tiber_list_league_rosters') return readers.memberships(parsed.data as z.infer<typeof publicLeagueRosterInput>);
      if (name === 'tiber_get_roster_context') return readers.roster(parsed.data as z.infer<typeof rosterContextInput>);
      // Pass original strict input: manager service owns the week transform.
      return readers.matchups(raw as z.input<typeof managerResultInput>);
    }).then(value => {
      const text = JSON.stringify(value);
      if (Buffer.byteLength(text, 'utf8') > 1000000) return unavailable('response_too_large');
      const copy: unknown = JSON.parse(text);
      return copy && typeof copy === 'object' && !Array.isArray(copy) ? copy as Record<string, unknown> : unavailable('source_unavailable');
    }).catch(() => unavailable('source_unavailable')).finally(() => { busy = false; });
    try { return await Promise.race([work, new Promise<Record<string, unknown>>(resolve => { timer = setTimeout(() => resolve(unavailable('deadline')), deadlineMs); })]); }
    finally { if (timer) clearTimeout(timer); }
  };
}
