import { PaperTradeGeometryInputSchema, type PaperPlayer, type PaperTradeGeometryInput } from './schemas';

const ELIGIBILITY: Record<string, readonly string[]> = {
  QB: ['QB'], RB: ['RB'], WR: ['WR'], TE: ['TE'], FLEX: ['RB', 'WR', 'TE'],
  WRRB_FLEX: ['WR', 'RB'], REC_FLEX: ['WR', 'TE'], SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
};
const MAX_CUT_VARIANTS = 128;
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const ordinary = (p: PaperPlayer) => p.container === 'starter' || p.container === 'bench';
const ordered = (players: PaperPlayer[]) => [...players].sort((a, b) => compare(a.player_id, b.player_id));

function summarize(players: PaperPlayer[], rules: PaperTradeGeometryInput['rules']) {
  const pool = ordered(players.filter(ordinary));
  const counts = { QB: 0, RB: 0, WR: 0, TE: 0, UNKNOWN: 0 };
  for (const p of pool) counts[p.position ?? 'UNKNOWN']++;
  const required = Object.keys(ELIGIBILITY).flatMap(slot =>
    Array.from({ length: rules.lineup[slot as keyof typeof rules.lineup] ?? 0 }, () => slot));
  // Maximum matching prevents FLEX from consuming a player's only required slot.
  const assignments = new Map<number, number>();
  function fill(slot: number, seen: Set<number>): boolean {
    for (let i = 0; i < pool.length; i++) {
      if (seen.has(i) || pool[i].position === null || !ELIGIBILITY[required[slot]].includes(pool[i].position!)) continue;
      seen.add(i);
      const previous = assignments.get(i);
      if (previous === undefined || fill(previous, seen)) { assignments.set(i, slot); return true; }
    }
    return false;
  }
  const unknown = pool.some(p => p.position === null);
  if (!unknown) required.forEach((_, i) => fill(i, new Set()));
  return {
    players: ordered(players),
    occupancy: {
      ordinary: pool.length,
      reserve: players.filter(p => p.container === 'reserve').length,
      taxi: players.filter(p => p.container === 'taxi').length,
    },
    ordinary_position_counts: counts,
    ordinary_open_slots: Math.max(0, rules.ordinary_capacity - pool.length),
    ordinary_over_capacity: Math.max(0, pool.length - rules.ordinary_capacity),
    position_only_lineup: unknown
      ? { status: 'unavailable' as const, reason: 'unknown_ordinary_position' as const }
      : { status: 'available' as const, required_slots: required.length, fillable_slots: assignments.size, all_fillable: assignments.size === required.length },
  };
}

function cutVariants(players: PaperPlayer[], excess: number) {
  const ids = ordered(players.filter(ordinary)).map(p => p.player_id);
  if (excess === 0) return { status: 'not_required' as const, variants: [] };
  // Refuse an incomplete enumeration. Never truncate into an implicit shortlist.
  let possibilities = 1;
  for (let i = 1; i <= Math.min(excess, ids.length - excess); i++) {
    possibilities = possibilities * (ids.length - i + 1) / i;
    if (possibilities > MAX_CUT_VARIANTS) return { status: 'unavailable' as const, reason: 'cut_variant_bound_exceeded' as const, variants: [] };
  }
  const variants: string[][] = [];
  function choose(start: number, selected: string[]) {
    if (selected.length === excess) { variants.push([...selected]); return; }
    for (let i = start; i <= ids.length - (excess - selected.length); i++) choose(i + 1, [...selected, ids[i]]);
  }
  choose(0, []);
  return { status: 'enumerated' as const, variants };
}

function exchange(players: PaperPlayer[], outgoing: string[], incoming: PaperPlayer[], rules: PaperTradeGeometryInput['rules']) {
  const afterPlayers = [...players.filter(p => !outgoing.includes(p.player_id)), ...incoming.map(p => ({ ...p, container: 'bench' as const }))];
  const after = summarize(afterPlayers, rules);
  return {
    before: summarize(players, rules), after,
    outgoing_player_ids: [...outgoing].sort(compare), incoming_player_ids: incoming.map(p => p.player_id).sort(compare),
    removed_observed_starter_ids: players.filter(p => p.container === 'starter' && outgoing.includes(p.player_id)).map(p => p.player_id).sort(compare),
    capacity_status: after.ordinary_over_capacity > 0 ? 'requires_operator_cut_choice' as const : 'within_ordinary_capacity' as const,
    cut_variants: cutVariants(afterPlayers, after.ordinary_over_capacity),
  };
}

const refusal = (reason: string) => ({
  status: 'refused' as const, reason, geometry: null,
  execution: { performed: false as const, authorized: false as const }, durable_records: 0 as const,
});

/** Synthetic inputs only. Never proves legal, feasible, willing, valuable or executable. */
export function evaluatePaperTradeGeometry(input: unknown) {
  const parsed = PaperTradeGeometryInputSchema.safeParse(input);
  if (!parsed.success) return refusal('invalid_paper_input');
  const { operator_roster: own, counterparty_roster: other, package: terms, rules } = parsed.data;
  if (own.roster_id === other.roster_id) return refusal('same_roster');
  const all = [...own.players, ...other.players];
  if (new Set(all.map(p => p.player_id)).size !== all.length) return refusal('duplicate_roster_identity');
  const exchanged = [...terms.operator_gives, ...terms.operator_receives];
  if (new Set(exchanged).size !== exchanged.length) return refusal('duplicate_package_identity');
  const departures = own.players.filter(p => terms.operator_gives.includes(p.player_id));
  const arrivals = other.players.filter(p => terms.operator_receives.includes(p.player_id));
  if (departures.length !== terms.operator_gives.length || arrivals.length !== terms.operator_receives.length) return refusal('asset_not_on_stated_roster');
  if ([...departures, ...arrivals].some(p => !ordinary(p))) return refusal('unsupported_reserve_or_taxi_exchange');
  if (Object.values(rules.lineup).reduce((n, v) => n + (v ?? 0), 0) > rules.ordinary_capacity) return refusal('lineup_exceeds_ordinary_capacity');
  for (const roster of [own, other]) {
    const { occupancy } = summarize(roster.players, rules);
    if (occupancy.ordinary > rules.ordinary_capacity || occupancy.reserve > rules.reserve_capacity || occupancy.taxi > rules.taxi_capacity) return refusal('invalid_baseline_capacity');
  }
  return {
    status: 'paper_geometry_available' as const,
    method_version: 'tiber.trade-study.paper-geometry.v0' as const,
    evaluation_mode: 'isolated_paper' as const,
    geometry: {
      operator: exchange(own.players, terms.operator_gives, arrivals, rules),
      counterparty: exchange(other.players, terms.operator_receives, departures, rules),
    },
    legality: 'unknown' as const, feasibility: 'unknown' as const,
    plausibility: 'unavailable' as const, desirability: 'not_evaluated' as const,
    execution: { performed: false as const, authorized: false as const }, durable_records: 0 as const,
  };
}

/** There is no live admission contract in this slice, including for valid fixtures. */
export function evaluateProductionTradeGeometry(_input: unknown) {
  return refusal('production_contract_unavailable');
}
