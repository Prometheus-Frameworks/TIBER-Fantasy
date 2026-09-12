import { z } from 'zod';
import { draftReviewAgentPacket, reviewScope } from './draftReviewStudy';
const rosterEvidence = z.object({
  input: z.object({ canonicalUrl: z.string().url() }), generated_at: z.string().datetime(),
  observed: z.object({
    league: z.object({ lineup_slots: z.record(z.number().int().min(0).max(64)), reserve: z.object({ configured_slots: z.number().int().nonnegative(), occupied_slots: z.number().int().nonnegative(), open_slots: z.number().int().nonnegative(), configured_eligibility: z.record(z.boolean().nullable()) }).optional() }),
    current_roster: z.array(z.object({ player_id: z.string().max(24), name: z.string().max(120), roster_state: z.enum(['starter', 'bench', 'reserve', 'taxi']), injury_status: z.string().max(120).nullable().optional() })).max(256),
  }),
});
export type ChapterPressure = {
  scope: string;
  kind: 'unfilled_starting_slots' | 'starter_designation';
  trigger: { player_id: string | null; designation: string | null; unfilled_slots: number | null };
  title: string;
  reason: string;
  league_rule_context: { reserve_open_slots: number | null; designation_rule: boolean | null; current_player_eligibility: 'unavailable' };
  options: string[];
  watch_conditions: string[];
};
export function chapterPressure(raw: unknown): { status: 'available' | 'unavailable'; card: ChapterPressure | null; designation_coverage: 'available' | 'partial' } {
  const parsed = rosterEvidence.safeParse(raw);
  const unavailable = { status: 'unavailable' as const, card: null, designation_coverage: 'partial' as const };
  if (!parsed.success) return unavailable;
  const review = parsed.data;
  const slots = Object.entries(review.observed.league.lineup_slots).filter(([slot]) => !['BN', 'IR', 'TAXI'].includes(slot));
  const configured = slots.reduce((n, [, count]) => n + count, 0);
  const players = review.observed.current_roster;
  const starters = players.filter(p => p.roster_state === 'starter');
  const reserve = review.observed.league.reserve;
  if (!configured || configured > 32 || starters.length > configured || new Set(players.map(p => p.player_id)).size !== players.length || (reserve && reserve.open_slots !== Math.max(0, reserve.configured_slots - reserve.occupied_slots))) return unavailable;
  const designation_coverage = starters.every(p => Object.prototype.hasOwnProperty.call(p, 'injury_status')) ? 'available' as const : 'partial' as const;
  const base = { scope: reviewScope(review), league_rule_context: { reserve_open_slots: reserve?.open_slots ?? null, designation_rule: null as boolean | null, current_player_eligibility: 'unavailable' as const } };
  // Numeric geometry outranks designations. Neither a display label nor a model selects a priority.
  if (starters.length < configured) {
    const count = configured - starters.length;
    return { status: 'available', designation_coverage, card: { ...base, kind: 'unfilled_starting_slots', trigger: { player_id: null, designation: null, unfilled_slots: count }, title: `${count} starting ${count === 1 ? 'slot needs' : 'slots need'} a look`, reason: `${starters.length} rostered starters are reported against ${configured} configured starting slots. Weekly locks and eligibility are unknown.`, options: ['Inspect the starting lineup in Sleeper.', 'Review your bench and positional coverage.', 'Keep the question open until you have the missing context.'], watch_conditions: ['Refresh after the starting lineup changes.', 'Recheck when weekly lock or eligibility information is available.'] } };
  }
  // Only the distinct directory designation field; Active/Inactive is not an injury signal.
  const severity = ['Out', 'Doubtful', 'Questionable'];
  const selected = starters.filter(p => severity.includes(p.injury_status ?? '')).sort((a, b) => severity.indexOf(a.injury_status!) - severity.indexOf(b.injury_status!) || a.player_id.localeCompare(b.player_id))[0];
  if (!selected) return { status: 'available', card: null, designation_coverage };
  const designation = selected.injury_status!;
  return { status: 'available', designation_coverage, card: { ...base, kind: 'starter_designation', trigger: { player_id: selected.player_id, designation, unfilled_slots: null }, title: `${selected.name}: ${designation}`, reason: 'Sleeper’s player directory reports this designation for a player in your starting group. This is a prompt to inspect the lineup, not a claim that the player will miss a game.', league_rule_context: { ...base.league_rule_context, designation_rule: reserve?.configured_eligibility[designation.toLowerCase()] ?? null }, options: ['Check the player and lineup in Sleeper.', 'Compare bench coverage before deciding.', 'Wait for an updated designation while checking kickoff and lock timing in Sleeper.'], watch_conditions: ['A refreshed player designation changes.', 'The player leaves your starting group.', 'Reserve occupancy or the relevant league rule changes.'] } };
}
export function chapterPacket<T extends { input: { canonicalUrl: string }; generated_at: string }>(review: T) {
  const result = chapterPressure(review);
  if (!result.card) throw new Error('No supported pressure card');
  const packet = draftReviewAgentPacket(review, null);
  return { ...packet, instruction: `${packet.instruction} Discuss chapter.pressure_card and its observed trigger. Options are unranked discussion paths, not recommendations or proof of eligibility. No saved operator judgment, prior visit, action receipt, or ownership was retrieved. Ask the manager about constraints before proposing an action.`, chapter: { status: 'derived_attention', pressure_card: result.card, designation_coverage: result.designation_coverage, prior_visit: 'unavailable' }, operator_context: { kind: 'manager_judgment', constraints: [], watch_conditions: [], status: null, receipt: null } };
}
