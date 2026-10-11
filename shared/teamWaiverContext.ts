import { z } from 'zod';

const amount = z.number().int().nonnegative().safe().nullable();
export const waiverSettingsSchema = z.object({
  observed: z.object({ waiver_type: amount, waiver_budget: amount, waiver_budget_used: z.number().int().safe().nullable(), waiver_position: amount }),
  derived: z.object({ system: z.enum(['rolling', 'reverse_standings', 'faab', 'unknown']), faab_remaining: amount }),
  limitations: z.array(z.string()),
});
export type WaiverSettings = z.infer<typeof waiverSettingsSchema>;
export function deriveWaiverSettings(leagueSettings: unknown, rosterSettings: unknown): WaiverSettings {
  const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
  const integer = (v: unknown, min = 0): number | null => typeof v === 'number' && Number.isSafeInteger(v) && v >= min ? v : null;
  const league = object(leagueSettings), roster = object(rosterSettings);
  const type = integer(league.waiver_type), budget = integer(league.waiver_budget);
  const used = integer(roster.waiver_budget_used, Number.MIN_SAFE_INTEGER);
  const system = type === 0 ? 'rolling' : type === 1 ? 'reverse_standings' : type === 2 ? 'faab' : 'unknown';
  const remaining = system === 'faab' && budget !== null && used !== null ? integer(budget - used) : null;
  return {
    observed: { waiver_type: type, waiver_budget: budget, waiver_budget_used: used, waiver_position: integer(roster.waiver_position, 1) },
    derived: { system, faab_remaining: remaining },
    limitations: [
      'FAAB remaining is league settings.waiver_budget minus roster settings.waiver_budget_used; missing or inconsistent values remain unknown. This is not a pending-bid-adjusted spendable balance.',
      'The configured budget is the current league setting, not a certified original allocation. No separate trade or commissioner-adjustment ledger was reconciled.',
      'Waiver priority is an observed position, not a guarantee of winning. Claim eligibility, locks, processing time, minimum bid, pending claims and results are unavailable.',
    ],
  };
}
const candidateSchema = z.object({
  player_id: z.string().regex(/^\d{1,24}$/), name: z.string().max(120), position: z.enum(['QB', 'RB', 'WR', 'TE']),
  team: z.string().max(120), status: z.string().max(120).nullable(), active: z.literal(true),
});
export const waiverCandidatesSchema = z.object({
  schema_version: z.literal('tiber_team_waiver_candidates_v1'), status: z.literal('available'),
  input: z.object({ leagueId: z.string().regex(/^\d{1,32}$/), rosterId: z.number().int().positive().safe(), canonicalUrl: z.string() }),
  season: z.string().regex(/^\d{4}$/),
  observations: z.object({ league_received_at: z.string().datetime(), rosters_received_at: z.string().datetime(), directory_fetched_at: z.string().datetime(), directory_source_updated_at: z.null(), directory_cache_max_age_hours: z.literal(24), expected_rosters: z.number().int().min(1).max(64), received_rosters: z.number().int().min(1).max(64), source_urls: z.array(z.string().url()).length(3) }),
  derivation: z.literal('active_current_nfl_team_skill_players_minus_all_league_membership'),
  claim_eligibility: z.literal('unknown'), waiver_settings: waiverSettingsSchema,
  candidates: z.array(candidateSchema).max(2048),
}).superRefine((v, ctx) => {
  if (v.input.canonicalUrl !== `https://sleeper.com/roster/${v.input.leagueId}/${v.input.rosterId}` || v.observations.expected_rosters !== v.observations.received_rosters || new Set(v.candidates.map(p => p.player_id)).size !== v.candidates.length)
    ctx.addIssue({ code: 'custom', message: 'Candidate scope or membership completeness mismatch.' });
});
export type WaiverCandidates = z.infer<typeof waiverCandidatesSchema>;
export type WaiverAttachment = { scope: string; evidence: Omit<WaiverCandidates, 'candidates'> & { selected_candidates: WaiverCandidates['candidates'] } };
export function selectWaiverCandidates(scope: string, result: WaiverCandidates, ids: string[]): WaiverAttachment {
  const parsed = waiverCandidatesSchema.parse(result);
  if (ids.length > 5 || new Set(ids).size !== ids.length || ids.some(id => !parsed.candidates.some(p => p.player_id === id))) throw new Error('Invalid waiver shortlist.');
  const { candidates, ...evidence } = parsed;
  return { scope, evidence: { ...evidence, selected_candidates: ids.map(id => candidates.find(p => p.player_id === id)!) } };
}
