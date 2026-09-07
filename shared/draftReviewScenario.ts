/** Pure hypothetical roster geometry. No scoring, ownership or execution inference. */
export type ScenarioPlayer = { player_id: string; position: string | null; roster_state?: string };
const NON_STARTING = new Set(['BN', 'IR', 'RESERVE', 'TAXI']);
const NON_ORDINARY = new Set(['IR', 'RESERVE', 'TAXI']);
const ELIGIBILITY: Record<string, string[]> = {
  QB: ['QB'], RB: ['RB'], WR: ['WR'], TE: ['TE'], K: ['K'], DEF: ['DEF'],
  FLEX: ['RB', 'WR', 'TE'], WRRB_FLEX: ['WR', 'RB'], REC_FLEX: ['WR', 'TE'], SUPER_FLEX: ['QB', 'RB', 'WR', 'TE'],
};
const ordinary = (p: ScenarioPlayer) => p.roster_state === 'starter' || p.roster_state === 'bench';

function summarize(players: ScenarioPlayer[], slots: Record<string, number>) {
  const pool = players.filter(ordinary);
  const counts: Record<string, number> = {};
  for (const player of pool) counts[player.position ?? 'UNKNOWN'] = (counts[player.position ?? 'UNKNOWN'] ?? 0) + 1;
  const validCounts = Object.values(slots).every(n => Number.isInteger(n) && n >= 0 && n <= 256);
  const slotEntries = Object.entries(slots).filter(([slot]) => !NON_STARTING.has(slot));
  const supported = validCounts && slotEntries.every(([slot, n]) => n === 0 || Object.hasOwn(ELIGIBILITY, slot))
    && pool.every(p => p.position !== null && ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].includes(p.position));
  const capacity = validCounts ? Object.entries(slots).filter(([slot]) => !NON_ORDINARY.has(slot)).reduce((n, [, count]) => n + count, 0) : null;
  const required = supported ? slotEntries.flatMap(([slot, count]) => Array.from({ length: count }, () => slot)) : [];
  // Maximum bipartite matching handles flex without greedily stealing a required RB/WR.
  const assignments = new Map<number, number>();
  function fill(slotIndex: number, seen: Set<number>): boolean {
    for (let i = 0; i < pool.length; i++) {
      if (seen.has(i) || !ELIGIBILITY[required[slotIndex]].includes(pool[i].position!)) continue;
      seen.add(i);
      const previous = assignments.get(i);
      if (previous === undefined || fill(previous, seen)) { assignments.set(i, slotIndex); return true; }
    }
    return false;
  }
  if (supported) required.forEach((_, i) => fill(i, new Set()));
  return {
    total_roster_count: players.length, ordinary_roster_count: pool.length, ordinary_position_counts: counts,
    ordinary_capacity: capacity, ordinary_open_slots: capacity === null ? null : Math.max(0, capacity - pool.length),
    ordinary_over_capacity: capacity === null ? null : Math.max(0, pool.length - capacity),
    position_only_lineup: supported ? { status: 'available' as const, required_slots: required.length, fillable_slots: assignments.size, all_fillable: assignments.size === required.length }
      : { status: 'unavailable' as const, reason: 'Unknown position, unsupported lineup slot or invalid slot count.' },
  };
}

export function deriveRosterScenario(roster: ScenarioPlayer[], slots: Record<string, number>, outgoingIds: string[], incoming: ScenarioPlayer | null) {
  const invalid = (reason: string) => ({ status: 'invalid_input' as const, reason, before: null, after: null });
  if (roster.length > 256 || Object.keys(slots).length > 32) return invalid('Roster or lineup exceeds supported bounds.');
  if (!incoming || outgoingIds.length < 1 || outgoingIds.length > 2 || new Set(outgoingIds).size !== outgoingIds.length) return invalid('Choose one or two distinct outgoing players and one incoming player.');
  if (new Set(roster.map(p => p.player_id)).size !== roster.length) return invalid('Roster identities must be unique.');
  if (outgoingIds.some(id => !roster.some(p => p.player_id === id && ordinary(p)))) return invalid('Outgoing players must be on this observed ordinary roster.');
  if (roster.some(p => p.player_id === incoming.player_id)) return invalid('Incoming player is already on this roster.');
  return {
    status: 'available' as const, reason: null,
    outgoing_player_ids: outgoingIds, incoming_player_id: incoming.player_id,
    before: summarize(roster, slots),
    after: summarize([...roster.filter(p => !outgoingIds.includes(p.player_id)), { ...incoming, roster_state: 'bench' }], slots),
    removed_observed_starter_ids: roster.filter(p => p.roster_state === 'starter' && outgoingIds.includes(p.player_id)).map(p => p.player_id),
    assumptions: [
      'Hypothetical one- or two-player departure and one-player arrival; no trade executed.',
      'Draft-board membership does not establish current ownership or manager willingness.',
      'Position-only lineup feasibility ignores performance, health, schedule and reserve eligibility; it is not a recommended lineup.',
      'Incoming player occupies an ordinary roster slot. Reserve and taxi players remain excluded from ordinary lineup capacity.',
      'No point gain, trade value, acceptance probability or transaction recommendation is inferred.',
    ],
  };
}
export type RosterScenario = ReturnType<typeof deriveRosterScenario>;
