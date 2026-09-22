import { publicLeagueRosterInput } from './teamLeagues';
export const exposureInput = publicLeagueRosterInput;
export type RosterLocation = 'starter' | 'bench' | 'reserve' | 'taxi' | 'unknown';
export interface ExposurePlayer {
  sleeperId: string; name: string | null; position: string | null; team: string | null;
  injuryStatus: string | null; directoryAvailable: boolean;
  location: RosterLocation;
}
export interface ExposureLeague {
  schemaVersion: 'tiber_exposure_v1'; userId: string; leagueId: string; season: string;
  rosters: Array<{ rosterId: number; canonicalUrl: string; available: boolean; players: ExposurePlayer[] }>;
  observations: { rostersReceivedAt: string; leagueReceivedAt: string; directoryReceivedAt: string | null; sourceUrls: string[] };
  accountControlVerified: false;
}
export interface ExposureHolding { leagueId: string; rosterId: number; canonicalUrl: string; location: RosterLocation; checkedAt: string }
export interface ExposureRow { player: ExposurePlayer; directoryReceivedAt: string | null; holdings: ExposureHolding[]; percent: number }
/** Exactly one valid explicitly chosen roster per league forms the denominator, including empty rosters. */
export function summarizeExposure(selected: string[], results: Record<string, ExposureLeague>, choices: Record<string, number>) {
  const rows = new Map<string, ExposureRow>(); let loaded = 0;
  for (const leagueId of Array.from(new Set(selected))) {
    const result = results[leagueId];
    const roster = result?.rosters.length === 1 ? result.rosters[0] : result?.rosters.find(row => row.rosterId === choices[leagueId]);
    if (!roster?.available) continue;
    loaded++;
    for (const player of roster.players) {
      let row = rows.get(player.sleeperId);
      if (!row) { row = { player, directoryReceivedAt: result.observations.directoryReceivedAt, holdings: [], percent: 0 }; rows.set(player.sleeperId, row); }
      // Prefer the latest available directory observation across a paced batch.
      if (player.directoryAvailable && (!row.player.directoryAvailable || (result.observations.directoryReceivedAt ?? '') > (row.directoryReceivedAt ?? ''))) {
        row.player = player; row.directoryReceivedAt = result.observations.directoryReceivedAt;
      }
      if (!row.holdings.some(h => h.leagueId === leagueId)) row.holdings.push({ leagueId, rosterId: roster.rosterId,
        canonicalUrl: roster.canonicalUrl, location: player.location, checkedAt: result.observations.rostersReceivedAt });
    }
  }
  for (const row of Array.from(rows.values())) row.percent = row.holdings.length / loaded * 100;
  return { loaded, rows: Array.from(rows.values()).sort((a, b) => b.holdings.length - a.holdings.length || (a.player.name ?? a.player.sleeperId).localeCompare(b.player.name ?? b.player.sleeperId)) };
}
