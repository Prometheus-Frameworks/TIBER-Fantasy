import { PaperLeagueScreenInputSchema } from './schemas';

const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const refusal = (reason: string) => ({ status: 'refused' as const, reason, roster_views: null, durable_records: 0 as const });

/** Unordered structural inspection of supplied synthetic rosters. No package suggestions. */
export function inspectPaperLeagueRosters(input: unknown) {
  const parsed = PaperLeagueScreenInputSchema.safeParse(input);
  if (!parsed.success) return refusal('invalid_paper_input');
  const { rosters, operator_roster_id: ownId, filter } = parsed.data;
  if (new Set(rosters.map(r => r.roster_id)).size !== rosters.length) return refusal('duplicate_roster_identity');
  if (!rosters.some(r => r.roster_id === ownId)) return refusal('operator_roster_missing');
  const all = rosters.flatMap(r => r.players);
  if (new Set(all.map(p => p.player_id)).size !== all.length) return refusal('duplicate_player_identity');
  return {
    status: 'paper_roster_inspection_available' as const, evaluation_mode: 'isolated_paper' as const,
    method_version: 'tiber.trade-study.paper-league-screen.v0' as const,
    ordering: 'none' as const, filter,
    // ID serialization order is only reproducibility; it carries no priority.
    roster_views: [...rosters].filter(r => r.roster_id !== ownId).sort((a, b) => compare(a.roster_id, b.roster_id)).map(roster => {
      const ordinary = roster.players.filter(p => p.container === 'starter' || p.container === 'bench');
      const matching = ordinary.filter(p => p.position === filter.position).map(p => p.player_id).sort(compare);
      const unknown = ordinary.filter(p => p.position === null).length;
      return {
        roster_id: roster.roster_id, matching_ordinary_player_ids: matching,
        matching_ordinary_count: matching.length, unknown_ordinary_positions: unknown,
        count_filter_status: matching.length >= filter.minimum_ordinary_players ? 'meets' as const : unknown > 0 ? 'unknown' as const : 'below' as const,
      };
    }),
    willingness: 'unavailable' as const, expendability: 'not_evaluated' as const,
    execution: { performed: false as const, authorized: false as const }, durable_records: 0 as const,
  };
}

export function inspectProductionLeagueRosters(_input: unknown) {
  return refusal('production_contract_unavailable');
}
