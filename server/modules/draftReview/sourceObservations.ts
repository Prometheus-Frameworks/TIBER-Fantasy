import type { SleeperLeagueDetail, SleeperRoster } from '../../integrations/sleeperClient';
/** Acquisition clocks travel with request-local reads, never with subsequent awaits. */
export type Observation<T> = { value: T; receivedAt: string };
export type LeagueReads = {
  getLeague: (leagueId: string) => Promise<SleeperLeagueDetail>;
  getLeagueRosters: (leagueId: string) => Promise<SleeperRoster[]>;
};
export type ObservedLeagueReads = {
  getLeagueObservation?: (leagueId: string) => Promise<Observation<SleeperLeagueDetail>>;
  getRosterObservation?: (leagueId: string) => Promise<Observation<SleeperRoster[]>>;
};
export async function observe<T>(read: () => Promise<T>, now = Date.now): Promise<Observation<T>> {
  return { value: await read(), receivedAt: new Date(now()).toISOString() };
}
export function observeLeague(sources: LeagueReads & ObservedLeagueReads, id: string, now = Date.now) {
  return sources.getLeagueObservation?.(id) ?? observe(() => sources.getLeague(id), now);
}
export function observeRosters(sources: LeagueReads & ObservedLeagueReads, id: string, now = Date.now) {
  return sources.getRosterObservation?.(id) ?? observe(() => sources.getLeagueRosters(id), now);
}

/** Construct inside an invocation. All reads are lazy, including rejected promises.
 * The compiler's sibling settlement barrier drains both league and roster reads. */
export function createRequestSources<T extends LeagueReads & { getDirectory: () => Promise<unknown> }>(sources: T, leagueId: string, now = Date.now) {
  let league: ReturnType<typeof observeLeague> | undefined;
  let rosters: ReturnType<typeof observeRosters> | undefined;
  let directory: ReturnType<T['getDirectory']> | undefined;
  const guard = (id: string) => { if (id !== leagueId) throw new Error('Request scope mismatch'); };
  const getLeagueObservation = (id: string) => {
    guard(id); return league ??= observe(() => sources.getLeague(id), now);
  };
  const getRosterObservation = (id: string) => {
    guard(id); return rosters ??= observe(() => sources.getLeagueRosters(id), now);
  };
  return { ...sources, getLeagueObservation, getRosterObservation,
    getLeague: async (id: string) => (await getLeagueObservation(id)).value,
    getLeagueRosters: async (id: string) => (await getRosterObservation(id)).value,
    getDirectory: () => directory ??= Promise.resolve().then(() => sources.getDirectory()) as ReturnType<T['getDirectory']>,
  };
}
