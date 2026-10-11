import { z } from 'zod';
import type { HistoricalEvidence } from './draftReviewEvidence';
import { draftReviewAgentPacket, reviewScope } from './draftReviewStudy';
import { selectWaiverCandidates, waiverCandidatesSchema, type WaiverCandidates } from './teamWaiverContext';

const metric = z.object({ total: z.number().finite().nullable(), mean: z.number().finite().nullable(), nonnull_weeks: z.number().int().nonnegative(), recorded_weeks: z.number().int().nonnegative() })
  .refine(v => v.nonnull_weeks <= v.recorded_weeks && (v.nonnull_weeks === 0 ? v.mean === null : v.mean !== null));
export const historySchema = z.object({
  schema_version: z.literal('tiber_draft_review_historical_v1'), status: z.enum(['available', 'unavailable']), reason: z.string().nullable(),
  window: z.object({ season: z.literal(2025), week_start: z.literal(1), week_end: z.literal(18), period_basis: z.string() }),
  players: z.array(z.object({
    player_id: z.string().regex(/^\d{1,24}$/), status: z.enum(['available', 'unavailable']), reason: z.string().nullable(),
    identity: z.object({ confidence: z.string(), match_method: z.string(), tiber_player_id: z.string() }).nullable(),
    observed: z.object({ weeks: z.array(z.number().int().min(1).max(18)), historical_teams: z.array(z.string()), historical_positions: z.array(z.string()), usage_conflict_weeks: z.array(z.number()), usage_missing_weeks: z.array(z.number()) }).nullable(),
    derived: z.record(metric),
  })).max(2),
  provenance: z.object({ producer_repo: z.string(), producer_commit: z.string(), sources: z.array(z.object({ path: z.string(), sha256: z.string() })), operator_acceptance: z.string(), attribution: z.object({ name: z.string(), source_url: z.string().url(), license: z.string(), license_url: z.string().url(), notice: z.string() }) }).passthrough().nullable(),
  limitations: z.array(z.string()), unavailable_metrics: z.record(z.null()),
  forecast: z.object({ status: z.literal('unavailable'), fabricated_values: z.literal(false) }),
});
export function parseWaiverComparisonHistory(raw: unknown, ids: string[]): HistoricalEvidence {
  const evidence = historySchema.parse(raw);
  const received = evidence.players.map(p => p.player_id);
  if (ids.length !== 2 || new Set(ids).size !== 2 || new Set(received).size !== received.length
      || received.some(id => !ids.includes(id)) || (evidence.status === 'available' && (received.length !== 2 || !evidence.provenance))
      || evidence.players.some(p => p.status === 'available' && (!p.identity || !p.observed))) throw new Error('Historical comparison scope mismatch.');
  return evidence as HistoricalEvidence;
}
type RosterContext = { input: { canonicalUrl: string; leagueId: string; rosterId: number }; generated_at: string; observed: { league: { season: string } } };
export function waiverComparisonPacket<T extends RosterContext>(review: T, result: WaiverCandidates, ids: string[], history: HistoricalEvidence | null) {
  const checked = waiverCandidatesSchema.parse(result);
  if (ids.length !== 2 || new Set(ids).size !== 2 || checked.input.canonicalUrl !== review.input.canonicalUrl
      || checked.input.leagueId !== review.input.leagueId || checked.input.rosterId !== review.input.rosterId
      || checked.season !== review.observed.league.season) throw new Error('Comparison no longer matches the roster.');
  const attachment = selectWaiverCandidates(reviewScope(review), checked, ids);
  const evidence = history ? parseWaiverComparisonHistory(history, ids) : null;
  const base = draftReviewAgentPacket(review, null, attachment);
  return {
    ...base,
    instruction: `${base.instruction} Compare only waiver_comparison.selected_player_ids, two unrostered candidates in this league. Explain evidence coverage and denominators before comparing values. Ask the manager for their decision and time horizon. Do not infer a winner, claim eligibility, injury clearance or playing time from selection or historical statistics. No claim, bid, drop or transaction is authorized. No saved operator context was retrieved.`,
    waiver_comparison: {
      schema_version: 'tiber_team_waiver_comparison_v1', selected_player_ids: ids,
      historical: { status: evidence?.status ?? 'unavailable', reason: evidence?.reason ?? (evidence ? null : 'Historical evidence could not be loaded.'), evidence },
      forecast: { status: 'unavailable', fabricated_values: false },
    },
  };
}
