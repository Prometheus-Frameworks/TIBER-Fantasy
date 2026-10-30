import { z } from 'zod';
import { sleeperAccountInput, sleeperId, leagueSeason } from '../../../shared/teamLeagues';

const selection = { userId: sleeperId, leagueId: sleeperId, season: leagueSeason };
const rosterId = z.number().int().min(1).max(64);
const week = z.string().regex(/^(?:[1-9]|1[0-8])$/);
export const publicInputs = {
  tiber_public_capabilities: z.object({}).strict(),
  tiber_public_list_leagues: z.object({ account: sleeperAccountInput, season: leagueSeason }).strict(),
  tiber_public_list_league_rosters: z.object(selection).strict(),
  tiber_public_get_roster_context: z.object({ ...selection, rosterId }).strict(),
  tiber_public_get_lineup_context: z.object({ ...selection, rosterId: rosterId.optional(), week: week.optional(),
    candidates: z.array(z.string().trim().min(1).max(120)).max(5).default([]) }).strict(),
  tiber_public_get_weekly_matchups: z.object({ ...selection, week }).strict(),
} as const;
export type PublicToolName = keyof typeof publicInputs;
export type PublicInput<N extends PublicToolName> = z.infer<typeof publicInputs[N]>;
export const PUBLIC_TOOL_NAMES = Object.freeze([
  'tiber_public_capabilities', 'tiber_public_list_leagues', 'tiber_public_list_league_rosters',
  'tiber_public_get_roster_context', 'tiber_public_get_lineup_context', 'tiber_public_get_weekly_matchups',
] as const);
export const publicContracts = Object.freeze(PUBLIC_TOOL_NAMES.map(name => Object.freeze({
  name, inputSchema: publicInputs[name], securitySchemes: [{ type: 'noauth' as const }],
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true,
    openWorldHint: name !== 'tiber_public_capabilities' },
})));

export type PublicSelectors = { account?: string; userId?: string; leagueId?: string; season?: string; rosterId?: number; week?: string };
export type PublicEnvelope = {
  serviceScope: 'public_explicit_selection'; accountControlVerified: false;
  selection: { supplied: PublicSelectors; resolved: PublicSelectors; basis: 'explicit_account_and_league' | null };
};
export type PublicFailureReason = 'invalid_input' | 'unknown_tool' | 'source_unavailable'
  | 'nfl_state_unavailable' | 'current_season_required' | 'decision_week_required' | 'roster_selection_required';
export type PublicFailure = { status: 'unavailable'; reason: PublicFailureReason };

export function publicEnvelope(supplied: PublicSelectors, resolved: PublicSelectors = {}, selected = false): PublicEnvelope {
  return { serviceScope: 'public_explicit_selection', accountControlVerified: false,
    selection: { supplied, resolved, basis: selected ? 'explicit_account_and_league' : null } };
}
export function publicCapabilities() {
  return {
    schemaVersion: 'tiber_public_league_mcp_v1', status: 'available',
    serviceScope: 'public_explicit_selection', accountControlVerified: false,
    stage: 'in_process_contracts', access: 'anonymous', readOnly: true,
    tools: PUBLIC_TOOL_NAMES, sourceDependencies: 'explicit_injection_required',
    hostedEndpoint: null, productionReady: false, clientAcceptance: 'not_tested',
    transport: 'not_implemented', sourceActivation: 'not_implemented',
    globalBudgets: 'not_implemented', persistentCaches: 'not_implemented',
    claimEligibility: 'unknown',
  } as const;
}
