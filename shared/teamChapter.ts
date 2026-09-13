import { z } from 'zod';
import { draftReviewAgentPacket, reviewScope, type StudyAttachment } from './draftReviewStudy';
const rosterEvidence = z.object({
  input: z.object({ canonicalUrl: z.string().url() }), generated_at: z.string().datetime(),
  observed: z.object({
    league: z.object({ lineup_slots: z.record(z.number().int().min(0).max(64)), reserve: z.object({ configured_slots: z.number().int().nonnegative(), occupied_slots: z.number().int().nonnegative(), open_slots: z.number().int().nonnegative(), configured_eligibility: z.record(z.boolean().nullable()) }).optional() }),
    current_roster: z.array(z.object({ player_id: z.string().min(1).max(24), name: z.string().max(120), position: z.string().max(32).nullable().optional(), team: z.string().max(32).nullable().optional(), status: z.string().max(120).nullable().optional(), active: z.boolean().nullable().optional(), roster_state: z.enum(['starter', 'bench', 'reserve', 'taxi']), injury_status: z.string().max(120).nullable().optional() })).max(256),
  }),
});
type Player = z.infer<typeof rosterEvidence>['observed']['current_roster'][number];
const designations = ['Out', 'IR', 'PUP', 'Doubtful', 'Questionable'];
const severity = (value: string) => ['Out', 'IR', 'PUP'].includes(value) ? 0 : value === 'Doubtful' ? 1 : 2;
// Exact observed strings only. Active/Inactive and the active boolean never become injury clearance.
function designation(player: Player) {
  const flags = [player.injury_status, player.status].filter((value): value is string => !!value && designations.includes(value));
  return flags.sort((a, b) => severity(a) - severity(b) || designations.indexOf(a) - designations.indexOf(b))[0] ?? null;
}
export type RbCoverage = {
  status: 'available' | 'unavailable' | 'not_applicable';
  required_slots: number; ordinary_count: number | null; starter_count: number | null; bench_count: number | null;
  flagged_count: number | null; without_recorded_flag_count: number | null;
  players: Player[];
};
export type ChapterPressure = {
  scope: string;
  kind: 'unfilled_starting_slots' | 'starter_designation' | 'rostered_designation' | 'rb_coverage';
  trigger: { player_id: string | null; designation: string | null; unfilled_slots: number | null; observed_player?: Player; roster_coverage?: RbCoverage };
  title: string;
  reason: string;
  league_rule_context: { reserve_open_slots: number | null; designation_rule: boolean | null; current_player_eligibility: 'unavailable'; reserve_state?: 'unavailable' | 'not_configured' | 'full' | 'open' };
  options: string[];
  watch_conditions: string[];
};
export function chapterPressure(raw: unknown) {
  const parsed = rosterEvidence.safeParse(raw);
  const unavailable = { status: 'unavailable' as const, card: null, designation_coverage: 'partial' as const, rb_coverage: null as RbCoverage | null };
  if (!parsed.success) return unavailable;
  const review = parsed.data;
  const slots = Object.entries(review.observed.league.lineup_slots).filter(([slot]) => !['BN', 'IR', 'TAXI'].includes(slot));
  const configured = slots.reduce((n, [, count]) => n + count, 0);
  const players = review.observed.current_roster;
  const starters = players.filter(p => p.roster_state === 'starter');
  const reserve = review.observed.league.reserve;
  if (!configured || configured > 32 || starters.length > configured || new Set(players.map(p => p.player_id)).size !== players.length || (reserve && (reserve.occupied_slots > reserve.configured_slots || reserve.open_slots !== reserve.configured_slots - reserve.occupied_slots))) return unavailable;
  const designation_coverage = players.every(p => Object.prototype.hasOwnProperty.call(p, 'injury_status') && (p.injury_status === null || p.injury_status === '' || designations.includes(p.injury_status!))) ? 'available' as const : 'partial' as const;
  const ordinary = players.filter(p => p.roster_state === 'starter' || p.roster_state === 'bench');
  const required = review.observed.league.lineup_slots.RB ?? 0;
  const rbs = ordinary.filter(p => p.position === 'RB').sort((a, b) => a.player_id.localeCompare(b.player_id));
  const positionsKnown = ordinary.every(p => ['QB', 'RB', 'FB', 'WR', 'TE', 'K', 'P', 'DEF', 'DB', 'CB', 'S', 'SS', 'FS', 'DL', 'DE', 'DT', 'NT', 'LB', 'ILB', 'OLB', 'EDGE', 'LS', 'OL', 'OT', 'OG', 'C'].includes(p.position ?? ''));
  const flagged = rbs.filter(p => p.status === 'Inactive' || designation(p) !== null);
  const rb_coverage: RbCoverage = {
    status: !required ? 'not_applicable' : positionsKnown ? 'available' : 'unavailable', required_slots: required,
    ordinary_count: positionsKnown ? rbs.length : null, starter_count: positionsKnown ? rbs.filter(p => p.roster_state === 'starter').length : null,
    bench_count: positionsKnown ? rbs.filter(p => p.roster_state === 'bench').length : null, flagged_count: positionsKnown ? flagged.length : null,
    without_recorded_flag_count: positionsKnown ? rbs.length - flagged.length : null, players: positionsKnown ? rbs : [],
  };
  const reserve_state = !reserve ? 'unavailable' as const : reserve.configured_slots === 0 ? 'not_configured' as const : reserve.open_slots === 0 ? 'full' as const : 'open' as const;
  const base = { scope: reviewScope(review), league_rule_context: { reserve_open_slots: reserve?.open_slots ?? null, designation_rule: null as boolean | null, current_player_eligibility: 'unavailable' as const, reserve_state } };
  const result = (card: ChapterPressure | null) => ({ status: 'available' as const, designation_coverage, rb_coverage, card });
  // First match: vacancies, starter designation, limited RB cover, other rostered designation.
  // Reserve capacity is orthogonal context, never a shadowed second pressure rule.
  if (starters.length < configured) {
    const count = configured - starters.length;
    return result({ ...base, kind: 'unfilled_starting_slots', trigger: { player_id: null, designation: null, unfilled_slots: count }, title: `${count} starting ${count === 1 ? 'slot needs' : 'slots need'} a look`, reason: `${starters.length} rostered starters are reported against ${configured} configured starting slots. Weekly locks and eligibility are unknown.`, options: ['Inspect the starting lineup in Sleeper.', 'Review your bench and positional coverage.', 'Keep the question open until you have the missing context.'], watch_conditions: ['Refresh after the starting lineup changes.', 'Recheck when weekly lock or eligibility information is available.'] });
  }
  const marked = players.filter(p => designation(p) !== null).sort((a, b) => severity(designation(a)!) - severity(designation(b)!) || a.player_id.localeCompare(b.player_id));
  const selectedStarter = marked.find(p => p.roster_state === 'starter');
  const limitedRb = rb_coverage.status === 'available' && rb_coverage.without_recorded_flag_count! <= required + 1;
  if (!selectedStarter && limitedRb) {
    return result({ ...base, kind: 'rb_coverage', trigger: { player_id: null, designation: null, unfilled_slots: null, roster_coverage: rb_coverage }, title: 'Limited RB cover',
      reason: `${rb_coverage.starter_count} starting-group RBs · ${rb_coverage.bench_count} bench RB${rb_coverage.bench_count === 1 ? "" : "s"} · ${flagged.length} recorded flag${flagged.length === 1 ? "" : "s"} across those RBs. ${required} RB slots are required; game availability is unresolved.`,
      options: ['Review RB and flex coverage in the current lineup.', 'Check player availability, kickoff and lineup locks in Sleeper.', 'Clarify keeper protections and whether player additions or trades are permitted.'],
      watch_conditions: ['RB roster membership or a recorded status changes.', 'Required RB slots change.', 'New availability or acquisition-rule evidence becomes available.'] });
  }
  const selected = selectedStarter ?? marked[0];
  if (!selected) return result(null);
  const flag = designation(selected)!;
  return result({ ...base, kind: selected.roster_state === 'starter' ? 'starter_designation' : 'rostered_designation', trigger: { player_id: selected.player_id, designation: flag, unfilled_slots: null, observed_player: selected, ...(limitedRb ? { roster_coverage: rb_coverage } : {}) }, title: `${selected.name}: ${flag}`, reason: `Sleeper reports ${flag} for a player in the ${selected.roster_state === 'starter' ? 'starting group' : selected.roster_state}. Game availability and reserve eligibility remain unresolved.`, league_rule_context: { ...base.league_rule_context, designation_rule: reserve?.configured_eligibility[flag.toLowerCase()] ?? null }, options: ['Check the player and lineup in Sleeper.', 'Compare roster coverage before deciding.', 'Wait for an updated designation while checking kickoff and lock timing in Sleeper.'], watch_conditions: ['A refreshed player designation changes.', 'The player changes roster group.', 'Reserve occupancy or the relevant league rule changes.'] });
}
export function chapterPacket<T extends { input: { canonicalUrl: string }; generated_at: string }>(review: T, study: StudyAttachment | null = null) {
  const result = chapterPressure(review);
  if (!result.card) throw new Error('No supported pressure card');
  const packet = draftReviewAgentPacket(review, study);
  return { ...packet, instruction: `${packet.instruction} Discuss chapter.pressure_card and its observed or deterministic trigger. Roster coverage counts exclude reserve and taxi and are not projections or proof of game availability. A missing flag never establishes health or eligibility. Acquisition rules are not established by this card; ask the manager about keeper, drop and acquisition constraints before proposing an action. Options are unranked discussion paths, not recommendations or proof of eligibility. No saved operator judgment, prior visit, action receipt, or ownership was retrieved.`, chapter: { status: 'derived_attention', pressure_card: result.card, designation_coverage: result.designation_coverage, rb_coverage: result.rb_coverage, prior_visit: 'unavailable' }, operator_context: packet.operator_context ?? { kind: 'manager_judgment', constraints: [], watch_conditions: [], status: null, receipt: null } };
}
