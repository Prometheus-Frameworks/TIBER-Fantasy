import { z } from 'zod';
import { leagueSeason, sleeperId } from './teamLeagues';

export const managerResultInput = z.object({
  userId: sleeperId, leagueId: sleeperId, season: leagueSeason,
  week: z.string().regex(/^(?:[1-9]|1[0-8])$/).transform(Number),
}).strict();
export type ManagerOutcome = 'win' | 'loss' | 'tie' | 'pending' | 'unavailable';
export interface ManagerResult {
  schemaVersion: 'tiber_manager_week_v1';
  leagueId: string; season: string; week: number;
  status: 'available' | 'unavailable'; reason: string | null;
  rosters: Array<{
    rosterId: number; canonicalUrl: string; opponentRosterId: number | null;
    points: number | null; opponentPoints: number | null;
    scoreBasis: 'reported' | 'commissioner_override' | null;
    opponentScoreBasis: 'reported' | 'commissioner_override' | null;
    outcome: ManagerOutcome;
  }>;
  observations: { leagueReceivedAt: string; rostersReceivedAt: string; matchupsReceivedAt: string | null;
    nflStateReceivedAt: string | null; sourceUrls: string[] };
  finality: 'not_verified';
  recordBasis: 'head_to_head_only';
  accountControlVerified: false;
}
/** One explicitly selected roster per league. Missing/failed selections are not losses. */
export function summarizeManagerWeek(outcomes: ManagerOutcome[]) {
  return outcomes.reduce((total, outcome) => { total[outcome]++; return total; },
    { win: 0, loss: 0, tie: 0, pending: 0, unavailable: 0 });
}
