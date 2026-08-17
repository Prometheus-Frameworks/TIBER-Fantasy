/**
 * Context-bound entity model — provider-neutral domain object (Fantasy #332).
 *
 * A context-bound entity model records *why a canonical TIBER entity matters
 * inside one operator's workspace*, durably enough that a session with no
 * conversational memory can pick it up and explain it.
 *
 * The contract here is deliberately generic. It knows about operators,
 * workspaces, opaque entity subjects, horizons, a structured-map payload and
 * an append-only observation lineage — and about nothing else. Position,
 * role, scoring format, league, target share and every other football
 * use-case concept stays out: those belong in the structured-map payload the
 * producing agent supplies, not in the persistence contract.
 *
 * Nothing in this module talks to MCP, HTTP, or a database.
 */

import { createHash } from 'crypto';
import { z } from 'zod';
import { TIBER_PLAYER_ID_PATTERN } from '../../services/identity/tiberPlayerId';

// ---------------------------------------------------------------------------
// Subjects
// ---------------------------------------------------------------------------

/**
 * Entity namespaces this pilot can bind a model to.
 *
 * v0 has exactly one: the canonical opaque `tiber_player_id` minted by the
 * Fantasy #327 registry. A second namespace is a deliberate future decision,
 * not something a caller may introduce by passing a new string.
 */
export const SUBJECT_TYPES = ['tiber_player'] as const;
export type SubjectType = (typeof SUBJECT_TYPES)[number];

export const subjectTypeSchema = z.enum(SUBJECT_TYPES);

/**
 * The resolved entity a model is bound to.
 *
 * `subjectId` is the identity. `displayName` / `position` / `team` are *not*
 * part of the durable model: they are live labels read from the identity
 * registry at retrieval time, so a rename or a trade can never leave a stale
 * fact frozen inside operator context. They are carried here only so a caller
 * can show the operator which entity was resolved.
 */
export interface EntitySubject {
  subjectType: SubjectType;
  subjectId: string;
  displayName: string;
  position?: string;
  team?: string;
}

/** Guard for the one namespace v0 accepts. Name equality is never identity. */
export function isValidSubjectId(subjectType: SubjectType, subjectId: string): boolean {
  switch (subjectType) {
    case 'tiber_player':
      return TIBER_PLAYER_ID_PATTERN.test(subjectId);
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Horizons, authority, provenance
// ---------------------------------------------------------------------------

/**
 * Management/research horizon, in generic terms only.
 *
 * These are intentionally not seasons, weeks, or league phases — encoding a
 * football calendar here would make the persistence contract domain-specific.
 */
export const HORIZONS = ['short_term', 'medium_term', 'long_term', 'open_ended'] as const;
export type Horizon = (typeof HORIZONS)[number];
export const horizonSchema = z.enum(HORIZONS);

/**
 * Authority/privacy state of a stored model.
 *
 * v0 may only write `operator_local` + `operator_private`. These are recorded
 * as explicit columns rather than assumed, so that anything later reading
 * these rows has to confront the fact that they are one operator's private
 * working context — not a promoted artifact and not Shared Reality content.
 */
export const AUTHORITY_STATES = ['operator_local'] as const;
export type AuthorityState = (typeof AUTHORITY_STATES)[number];
export const VISIBILITIES = ['operator_private'] as const;
export type Visibility = (typeof VISIBILITIES)[number];

/**
 * Operator confirmation captured at creation.
 *
 * Confirmation authorises *persistence of the interpretation*. It is not a
 * request to serialise the model into chat, and it is not standing authority
 * for later writes: each write carries its own.
 */
export const operatorConfirmationSchema = z.object({
  confirmed: z.literal(true),
  /** What the operator confirmed, in the operator's or agent's own words. */
  statement: z.string().trim().min(1).max(2000),
});
export type OperatorConfirmation = z.infer<typeof operatorConfirmationSchema>;

/** Who produced this model and in which conversation. Audit metadata only. */
export const provenanceSchema = z.object({
  /** Producing agent/client reference, e.g. `claude-code`. */
  agentRef: z.string().trim().min(1).max(128),
  /** Opaque session reference; must not carry conversation content. */
  sessionRef: z.string().trim().min(1).max(128),
  confirmation: operatorConfirmationSchema,
  /** Optional free-text note about how the interpretation was reached. */
  note: z.string().trim().max(2000).optional(),
});
export type ModelProvenance = z.infer<typeof provenanceSchema>;

// ---------------------------------------------------------------------------
// Structured map payload
// ---------------------------------------------------------------------------

/**
 * The structured interpretation, carried verbatim.
 *
 * TIBER-Research's `agent-thesis-proposal/v0` is a *pre-freeze proposal*
 * contract owned by another repository. This repo therefore does not define,
 * validate, vendor, or mutate that shape. It stores whatever JSON object the
 * producing agent supplies, records which contract the agent declared it to
 * be, and digests the canonicalised bytes so the payload stays identifiable
 * and comparable later. If the proposal contract and the durable wrapper ever
 * diverge, that divergence is visible as a contract id + digest, never as a
 * silent rewrite.
 */
export const structuredMapSchema = z.object({
  /** Declared contract id, e.g. `agent-thesis-proposal/v0`. */
  contract: z.string().trim().min(1).max(128),
  /** Payload bytes, stored as given. Not interpreted by this repo. */
  payload: z.record(z.unknown()),
});
export type StructuredMap = z.infer<typeof structuredMapSchema>;

// ---------------------------------------------------------------------------
// The model
// ---------------------------------------------------------------------------

/**
 * A persisted context-bound entity model. Immutable once written: a changed
 * interpretation is a new `version`, and new information is an appended
 * observation.
 */
export interface ContextBoundEntityModel {
  modelId: string;
  version: number;
  workspaceId: string;
  operatorId: string;
  subjectType: SubjectType;
  subjectId: string;
  operatorContext: string;
  horizon: Horizon;
  structuredMap: StructuredMap;
  structuredMapDigest: string;
  provenance: ModelProvenance;
  authorityState: AuthorityState;
  visibility: Visibility;
  contentDigest: string;
  createdAt: Date;
}

/** Where an observation came from. Never inferred from the observation text. */
export const OBSERVATION_SOURCES = ['operator_supplied', 'agent_synthetic'] as const;
export type ObservationSource = (typeof OBSERVATION_SOURCES)[number];
export const observationSourceSchema = z.enum(OBSERVATION_SOURCES);

/**
 * One appended observation. Never rewrites the model it is attached to.
 *
 * The lineage belongs to the (workspace, subject) pair rather than to a single
 * model version: `modelId` records which version was current at append time,
 * so an observation stays visible after a later version is written instead of
 * disappearing behind it.
 */
export interface ContextEntityObservationRecord {
  observationId: string;
  modelId: string;
  workspaceId: string;
  subjectType: SubjectType;
  subjectId: string;
  sequence: number;
  body: string;
  observationSource: ObservationSource;
  recordedBy: string;
  observedAt: Date;
  recordedAt: Date;
}

/** A model plus its observation lineage, oldest first. */
export interface ContextBoundEntityModelWithLineage {
  model: ContextBoundEntityModel;
  observations: ContextEntityObservationRecord[];
}

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

export const MODEL_ID_PREFIX = 'tbr_cem_';
export const OBSERVATION_ID_PREFIX = 'tbr_ceo_';
export const MODEL_ID_PATTERN = /^tbr_cem_[0-9a-f]{32}$/;
export const OBSERVATION_ID_PATTERN = /^tbr_ceo_[0-9a-f]{32}$/;

export function looksLikeModelId(value: string | null | undefined): boolean {
  return typeof value === 'string' && MODEL_ID_PATTERN.test(value);
}

// ---------------------------------------------------------------------------
// Canonicalisation + digests
// ---------------------------------------------------------------------------

/**
 * Deterministic JSON with object keys sorted at every depth.
 *
 * Digest stability is the whole point: an identical save must produce an
 * identical digest regardless of key order, or idempotency silently degrades
 * into version churn. Arrays keep their order — order is data.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      if (source[key] === undefined) continue;
      out[key] = sortDeep(source[key]);
    }
    return out;
  }
  return value;
}

export function sha256Digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

/**
 * Content digest of a model interpretation.
 *
 * Covers exactly the fields that constitute the interpretation. `modelId`,
 * `version`, `createdAt` and `provenance` are excluded on purpose: re-saving
 * the same interpretation from a new session, at a new time, under a new
 * model id must be recognised as the same content — otherwise every retry
 * would mint a version.
 */
export function computeContentDigest(input: {
  workspaceId: string;
  operatorId: string;
  subjectType: SubjectType;
  subjectId: string;
  operatorContext: string;
  horizon: Horizon;
  structuredMap: StructuredMap;
  authorityState: AuthorityState;
  visibility: Visibility;
}): string {
  return sha256Digest({
    workspaceId: input.workspaceId,
    operatorId: input.operatorId,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    operatorContext: input.operatorContext,
    horizon: input.horizon,
    structuredMap: input.structuredMap,
    authorityState: input.authorityState,
    visibility: input.visibility,
  });
}
