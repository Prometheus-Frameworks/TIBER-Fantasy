import { z } from 'zod';

export const sleeperAccountInput = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);
export const sleeperId = z.string().regex(/^\d{1,32}$/);
export const leagueSeason = z.string().regex(/^20\d{2}$/);
export const publicLeaguesInput = z.object({ account: sleeperAccountInput, season: leagueSeason }).strict();
export const publicLeagueRosterInput = z.object({ userId: sleeperId, leagueId: sleeperId, season: leagueSeason }).strict();
export const privateLeaguesInput = z.object({ season: leagueSeason }).strict();
export const privateLeagueRosterInput = z.object({ leagueId: sleeperId, season: leagueSeason }).strict();

export interface TeamLeagueSummary {
  leagueId: string;
  name: string;
  season: string;
  status: string | null;
  totalRosters: number | null;
  mode: 'redraft' | 'keeper' | 'dynasty' | 'unknown';
  receptionPoints: number | null;
  superflex: boolean | null;
}
export interface TeamLeagues {
  status: 'available';
  account: { userId: string; username: string | null; displayName: string | null };
  season: string;
  leagues: TeamLeagueSummary[];
  observations: { accountReceivedAt: string; leaguesReceivedAt: string; sourceUrls: string[] };
  accountControlVerified: false;
}
export interface TeamLeagueRosters {
  status: 'available';
  leagueId: string;
  season: string;
  rosters: Array<{ rosterId: number; relationship: 'owner' | 'co_owner'; canonicalUrl: string }>;
  observations: { leagueReceivedAt: string; rostersReceivedAt: string; sourceUrls: string[] };
  accountControlVerified: false;
}
