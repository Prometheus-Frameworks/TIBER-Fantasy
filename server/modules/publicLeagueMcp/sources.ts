import { z } from 'zod';
import type { sleeperClient } from '../../integrations/sleeperClient';
import type { LineupSources } from '../leagueMcp/lineupContext';
import { SCHEDULE_TEAMS, SCHEDULE_HASH_CONVENTION, type Schedule } from '../leagueMcp/schedule';

/** No fetching or retained cache is supplied by this library. Acquisition evidence
 * belongs to the injected reference; checkedAt is only the validation clock. */
export type PublicSources = LineupSources & Pick<typeof sleeperClient,
  'getUser' | 'getUserLeagues' | 'getManagerNflState' | 'getManagerMatchups'>;
export type ReferenceEvidence = {
  status: 'available' | 'unavailable' | 'not_read';
  receivedAt: string | null; checkedAt: string | null; maxAgeMs: number;
  reason?: 'source_unavailable' | 'invalid_reference' | 'expired_reference';
};
const DIRECTORY_TTL = 24 * 60 * 60 * 1000;
const SCHEDULE_TTL = 60 * 60 * 1000;
const fixtureSchema = z.object({ gameId: z.string().min(1).max(256), week: z.number().int().min(1).max(18),
  gameday: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), opponent: z.enum(SCHEDULE_TEAMS as [string, ...string[]]),
  designation: z.enum(['home', 'away']) });
const scheduleSchema = z.object({ season: z.string().regex(/^20\d{2}$/), receivedAt: z.string().datetime(),
  sourceUrl: z.string().url().max(2048), contentHash: z.string().regex(/^[a-f0-9]{64}$/),
  hashConvention: z.literal(SCHEDULE_HASH_CONVENTION), byeWeeks: z.record(z.number().int().min(1).max(18)),
  teamWeeks: z.record(z.array(fixtureSchema).length(17)) });

/** Validate complete reciprocal coverage even when an injected source bypasses compileSchedule. */
function validateSchedule(value: Schedule, season: string) {
  const schedule = scheduleSchema.parse(value);
  if (season !== schedule.season || Number(season) < 2021) throw new Error('Invalid season');
  for (const keys of [Object.keys(schedule.teamWeeks), Object.keys(schedule.byeWeeks)]) {
    if (keys.length !== 32 || keys.some(team => !SCHEDULE_TEAMS.includes(team))) throw new Error('Incomplete teams');
  }
  const games = new Map<string, number>();
  for (const team of SCHEDULE_TEAMS) {
    const fixtures = schedule.teamWeeks[team];
    const weeks = new Set(fixtures.map(f => f.week));
    if (weeks.size !== 17 || weeks.has(schedule.byeWeeks[team])) throw new Error('Invalid bye');
    for (const f of fixtures) {
      const date = Date.parse(`${f.gameday}T00:00:00Z`);
      if (!Number.isFinite(date) || new Date(date).toISOString().slice(0, 10) !== f.gameday || team === f.opponent) throw new Error('Invalid fixture');
      const reciprocal = schedule.teamWeeks[f.opponent].filter(other => other.gameId === f.gameId && other.week === f.week
        && other.gameday === f.gameday && other.opponent === team && other.designation !== f.designation);
      if (reciprocal.length !== 1) throw new Error('Nonreciprocal fixture');
      games.set(f.gameId, (games.get(f.gameId) ?? 0) + 1);
    }
  }
  if (games.size !== 272 || Array.from(games.values()).some(count => count !== 2)) throw new Error('Incomplete games');
  return schedule;
}

export function qualifyReferences<T extends PublicSources>(sources: T, now: () => number) {
  const evidence: { directory: ReferenceEvidence; schedule: ReferenceEvidence } = {
    directory: { status: 'not_read', receivedAt: null, checkedAt: null, maxAgeMs: DIRECTORY_TTL },
    schedule: { status: 'not_read', receivedAt: null, checkedAt: null, maxAgeMs: SCHEDULE_TTL },
  };
  function freshness(kind: keyof typeof evidence, acquired: number) {
    const current = now(), previous = evidence[kind];
    const valid = Number.isFinite(acquired) && Math.abs(acquired) <= 8.64e15 && acquired <= current;
    const receivedAt = valid ? new Date(acquired).toISOString() : null;
    const reason = !valid ? 'invalid_reference' : current - acquired >= previous.maxAgeMs ? 'expired_reference' : undefined;
    evidence[kind] = { maxAgeMs: previous.maxAgeMs, status: reason ? 'unavailable' : 'available', receivedAt,
      checkedAt: new Date(current).toISOString(), ...(reason ? { reason } : {}) };
    if (reason) throw new Error(reason);
  }
  async function read<TValue>(kind: keyof typeof evidence, read: () => Promise<TValue>, validate: (v: TValue) => TValue) {
    let value: TValue;
    try { value = await read(); }
    catch { evidence[kind] = { ...evidence[kind], status: 'unavailable', reason: 'source_unavailable', checkedAt: new Date(now()).toISOString() }; throw new Error('Reference unavailable'); }
    try { return validate(value); }
    catch {
      if (evidence[kind].status !== 'unavailable') evidence[kind] = { ...evidence[kind], status: 'unavailable', reason: 'invalid_reference', checkedAt: new Date(now()).toISOString() };
      throw new Error('Reference unavailable');
    }
  }
  const refresh = () => {
    for (const kind of ['directory', 'schedule'] as const) {
      const reference = evidence[kind];
      if (reference.status === 'available' && reference.receivedAt !== null) {
        try { freshness(kind, Date.parse(reference.receivedAt)); } catch { /* Expiry is evidence, not a refresh. */ }
      }
    }
  };
  return { evidence, refresh, sources: { ...sources,
    getDirectory: () => read('directory', () => sources.getDirectory(), value => {
      freshness('directory', value.fetchedAt);
      if (!value.players || Array.isArray(value.players) || typeof value.players !== 'object'
        || Object.keys(value.players).length === 0 || Object.keys(value.players).length > 50_000) throw new Error('Invalid directory');
      return value;
    }),
    getSchedule: (season: string) => read('schedule', () => sources.getSchedule(season), value => {
      freshness('schedule', typeof value.receivedAt === 'string' && z.string().datetime().safeParse(value.receivedAt).success ? Date.parse(value.receivedAt) : NaN);
      return validateSchedule(value, season);
    }),
  } };
}
