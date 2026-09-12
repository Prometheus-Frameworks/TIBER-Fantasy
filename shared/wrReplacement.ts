import { z } from 'zod';
import { draftReviewAgentPacket, reviewScope } from './draftReviewStudy';
import { chapterPressure } from './teamChapter';
const id = z.string().regex(/^\d{1,24}$/);
export const replacementPlayerSchema = z.object({ player_id: id, name: z.string().max(120), position: z.literal('WR'), team: z.string().max(120).nullable(), status: z.string().max(120).nullable(), injury_status: z.string().max(120).nullable(), active: z.boolean().nullable() });
export const wrReplacementSchema = z.object({
  schema_version: z.literal('tiber_wr_replacement_v1'),
  input: z.object({ leagueId: z.string().regex(/^\d{1,32}$/), rosterId: z.number().int().positive(), canonicalUrl: z.string().url(), target_player_id: id }),
  season: z.string().regex(/^\d{4}$/), target: replacementPlayerSchema,
  roster_player_ids: z.array(z.string()).max(256),
  bench: z.array(replacementPlayerSchema).max(64), unrostered: z.array(replacementPlayerSchema).max(4096),
  observations: z.object({ received_at: z.string().datetime(), directory_fetched_at: z.string().datetime(), source_urls: z.array(z.string().url()).length(3), directory_cache_max_age_hours: z.literal(24) }),
  forecast: z.object({ status: z.literal('unavailable'), fabricated_values: z.literal(false) }),
  claim_eligibility: z.literal('unknown'), lineup_locks: z.literal('unknown'),
}).superRefine((r, ctx) => {
  const ids = [r.target.player_id, ...r.bench.map(p => p.player_id), ...r.unrostered.map(p => p.player_id)];
  if (new Set(ids).size !== ids.length || r.input.target_player_id !== r.target.player_id || !r.roster_player_ids.includes(r.target.player_id) || r.bench.some(p => !r.roster_player_ids.includes(p.player_id)) || r.unrostered.some(p => r.roster_player_ids.includes(p.player_id)) || r.input.canonicalUrl !== `https://sleeper.com/roster/${r.input.leagueId}/${r.input.rosterId}`) ctx.addIssue({ code: 'custom', message: 'Replacement scope mismatch' });
});
export type WrReplacement = z.infer<typeof wrReplacementSchema>;
export const referencePointsSchema = z.object({
  kind: z.literal('manager_reported_external_projection'), source: z.string().trim().min(1).max(120), scoring_basis: z.string().trim().min(1).max(120), week: z.number().int().min(1).max(18), as_of: z.string().datetime(),
  points: z.array(z.object({ player_id: id, value: z.number().finite().min(-1000).max(1000) })).length(2),
});
export type ReferencePoints = z.infer<typeof referencePointsSchema>;
type Review = { input: { leagueId: string; rosterId: number; canonicalUrl: string }; generated_at: string; observed: { league: { season: string }; current_roster: Array<{ player_id: string; roster_state: string; position: string | null }> } };
export function matchesReplacement(review: Review, result: WrReplacement, target: string) {
  const ids = review.observed.current_roster.map(p => p.player_id).sort();
  const bench = review.observed.current_roster.filter(p => p.position === 'WR' && p.roster_state === 'bench').map(p => p.player_id).sort();
  return review.input.canonicalUrl === result.input.canonicalUrl && review.input.leagueId === result.input.leagueId && review.input.rosterId === result.input.rosterId && review.observed.league.season === result.season && target === result.input.target_player_id && JSON.stringify(ids) === JSON.stringify([...result.roster_player_ids].sort()) && JSON.stringify(bench) === JSON.stringify(result.bench.map(p => p.player_id).sort());
}
export function wrReplacementPacket<T extends Review>(review: T, raw: WrReplacement, benchId: string, waiverId: string, reference: ReferencePoints | null, historical: unknown, constraints = '') {
  const result = wrReplacementSchema.parse(raw);
  if (!matchesReplacement(review, result, result.target.player_id) || !result.bench.some(p => p.player_id === benchId) || !result.unrostered.some(p => p.player_id === waiverId)) throw new Error('Replacement scope changed');
  const parsed = reference ? referencePointsSchema.parse(reference) : null;
  if (parsed && (new Set(parsed.points.map(p => p.player_id)).size !== 2 || !parsed.points.some(p => p.player_id === benchId) || !parsed.points.some(p => p.player_id === waiverId))) throw new Error('Projection reference scope changed');
  const history = replacementHistorySchema.parse(historical);
  if (!matchesHistory(history, [benchId, waiverId]) || constraints.length > 500) throw new Error('Historical or manager context mismatch');
  const base = draftReviewAgentPacket(review, null);
  const pressure = chapterPressure(review).card;
  if (!pressure || pressure.trigger.player_id !== result.target.player_id || pressure.scope !== reviewScope(review)) throw new Error('Pressure scope changed');
  return { ...base, instruction: `${base.instruction} Discuss the conditional WR replacement question if the target is ruled out. The designation has not been changed by this scenario. Bench and unrostered membership have separate fresh observation clocks from the roster snapshot. Unrostered does not prove claim eligibility. External reference points, if present, are manager-reported and unverified, not a TIBER forecast. Compare scoring basis, week, source, freshness and practical timing before interpreting a point difference. Historical means are not current opportunity or projections. Ask about keeper and drop constraints; no transaction authority.`, replacement: { input: result.input, season: result.season, target: result.target, pressure_card: pressure, bench_candidate: result.bench.find(p => p.player_id === benchId), unrostered_candidate: result.unrostered.find(p => p.player_id === waiverId), observations: result.observations, historical: history, external_reference: parsed, forecast: result.forecast, claim_eligibility: result.claim_eligibility, lineup_locks: result.lineup_locks }, operator_context: { kind: 'manager_judgment', condition: 'Plan a fallback if the target is ruled out.', constraints: constraints.trim() ? [constraints.trim()] : [], receipt: null } };
}
const nfl = new Set('ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LAC LAR LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS'.split(' '));
export function currentWr(p: WrReplacement['target']) { return p.active === true && p.team !== null && nfl.has(p.team); }

const metric = z.object({ mean: z.number().finite().nullable(), total: z.number().finite().nullable(), nonnull_weeks: z.number().int().nonnegative(), recorded_weeks: z.number().int().nonnegative() });
export const replacementHistorySchema = z.object({
  status: z.enum(['available','unavailable']), reason: z.string().nullable(),
  schema_version: z.literal('tiber_draft_review_historical_v1'),
  window: z.object({ season: z.literal(2025) }).passthrough(),
  provenance: z.object({ attribution: z.object({ name: z.string(), source_url: z.string().url().regex(/^https:\/\//), license: z.string(), license_url: z.string().url().regex(/^https:\/\//), notice: z.string() }).passthrough() }).passthrough().optional(),
  players: z.array(z.object({ player_id: id, status: z.enum(['available','unavailable']), reason: z.string().nullable(), identity: z.object({ confidence: z.string(), match_method: z.string() }).passthrough().nullable(), derived: z.record(metric) }).passthrough()).max(2),
}).passthrough();
export type ReplacementHistory = z.infer<typeof replacementHistorySchema>;
export function matchesHistory(history: ReplacementHistory, ids: string[]) {
  return new Set(history.players.map(p=>p.player_id)).size===history.players.length && history.players.every(p=>ids.includes(p.player_id)) && (history.status==='unavailable' || (history.players.length===ids.length && ids.every(id=>history.players.some(p=>p.player_id===id))));
}
