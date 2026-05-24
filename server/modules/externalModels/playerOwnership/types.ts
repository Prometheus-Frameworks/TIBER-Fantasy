import { z } from 'zod';

export const PLAYER_OWNERSHIP_CONTRACT_VERSION = 'player_ownership_v0';
export const PLAYER_OWNERSHIP_EVENT_CONTRACT_VERSION = 'player_ownership_change_event_v0';

const nullableStringSchema = z.string().min(1).nullable();

export const playerOwnershipSourceRefSchema = z.object({
  source_name: z.string().min(1),
  source_url: z.string().url().nullable().optional(),
  observed_at: z.string().datetime(),
  source_updated_at: z.string().datetime().nullable().optional(),
  confidence: z.string().min(1),
  notes: z.string().min(1).nullable().optional(),
});

export const canonicalPlayerOwnershipRowSchema = z.object({
  player_id: nullableStringSchema,
  player_name: nullableStringSchema,
  position: nullableStringSchema,
  football_level: z.enum(['NFL', 'COLLEGE', 'DEVY']).nullable(),
  current_team_id: nullableStringSchema,
  current_team_abbr: nullableStringSchema,
  current_team_name: nullableStringSchema,
  ownership_status: z.enum([
    'active_roster',
    'practice_squad',
    'unsigned_draft_pick',
    'college',
    'devy',
    'free_agent',
    'retired',
    'injured_reserve',
    'suspended',
    'unknown',
  ]),
  valid_from: z.string().datetime().nullable(),
  valid_to: z.string().datetime().nullable(),
  last_verified_at: z.string().datetime(),
  confidence: z.enum(['source_verified', 'multi_source_verified', 'provisional', 'unverified']),
  source_refs: z.array(playerOwnershipSourceRefSchema).min(1),
});

export const canonicalPlayerOwnershipArtifactSchema = z.object({
  contract_version: z.literal(PLAYER_OWNERSHIP_CONTRACT_VERSION),
  generated_at: z.string().datetime(),
  players: z.array(canonicalPlayerOwnershipRowSchema),
});

export const canonicalPlayerOwnershipEventSchema = z.object({
  event_id: z.string().min(1),
  event_type: z.enum([
    'team_change',
    'status_change',
    'signing',
    'release',
    'trade',
    'draft_selection',
    'practice_squad_change',
    'injured_reserve_change',
    'free_agent_status_change',
    'college_program_change',
  ]),
  player_id: nullableStringSchema,
  player_name: nullableStringSchema,
  position: nullableStringSchema,
  from_team_id: nullableStringSchema,
  from_team_abbr: nullableStringSchema,
  from_team_name: nullableStringSchema,
  to_team_id: nullableStringSchema,
  to_team_abbr: nullableStringSchema,
  to_team_name: nullableStringSchema,
  detected_at: z.string().datetime(),
  effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  verification_status: z.enum(['verified', 'provisional', 'unverified']),
  confidence: z.enum(['source_verified', 'multi_source_verified', 'provisional', 'unverified']),
  source_refs: z.array(playerOwnershipSourceRefSchema).min(1),
});

export type CanonicalPlayerOwnershipArtifact = z.infer<typeof canonicalPlayerOwnershipArtifactSchema>;
export type CanonicalPlayerOwnershipRow = z.infer<typeof canonicalPlayerOwnershipRowSchema>;
export type CanonicalPlayerOwnershipEvent = z.infer<typeof canonicalPlayerOwnershipEventSchema>;

export type PlayerOwnershipMatchType = 'player_id' | 'exact_name' | 'normalized_name' | 'fuzzy' | 'none';

export interface TiberPlayerOwnershipInsight {
  available: boolean;
  matched: boolean;
  matchType: PlayerOwnershipMatchType;
  playerId: string | null;
  playerName: string | null;
  position: string | null;
  footballLevel: string | null;
  currentTeamId: string | null;
  currentTeamAbbr: string | null;
  currentTeamName: string | null;
  ownershipStatus: string | null;
  validFrom: string | null;
  validTo: string | null;
  lastVerifiedAt: string | null;
  confidence: string | null;
  sourceRefs: Array<Record<string, unknown>>;
  recentEvents: Array<Record<string, unknown>>;
  warnings: string[];
}

export interface PlayerOwnershipLookupQuery {
  playerId?: string | null;
  query?: string | null;
  includeEvents?: boolean;
  eventLimit?: number;
}

export type PlayerOwnershipErrorCode =
  | 'config_error'
  | 'not_found'
  | 'invalid_payload'
  | 'upstream_unavailable'
  | 'ambiguous';

export class PlayerOwnershipIntegrationError extends Error {
  readonly code: PlayerOwnershipErrorCode;
  readonly status: number;
  readonly cause?: unknown;

  constructor(code: PlayerOwnershipErrorCode, message: string, status: number, cause?: unknown) {
    super(message);
    this.name = 'PlayerOwnershipIntegrationError';
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

export interface PlayerOwnershipClientConfig {
  latestArtifactPath?: string;
  eventsDir?: string | null;
  enabled?: boolean;
}
