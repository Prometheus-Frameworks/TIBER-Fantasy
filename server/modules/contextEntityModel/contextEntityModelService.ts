/**
 * Application operations for context-bound entity models (Fantasy #332).
 *
 * This is the layer the pilot actually consists of. It is ordinary
 * application code: no MCP, no HTTP, no transport of any kind. The MCP
 * adapter in `mcp/` is one caller; a script, a test, or a future route would
 * be equally valid callers, and if MCP disappeared tomorrow everything below
 * would still work unchanged.
 *
 * Four operations:
 *   - `resolveEntity`   (read)  — locator to canonical identity, fail closed
 *   - `getEntityModel`  (read)  — the durable context for a workspace/entity
 *   - `saveEntityModel` (write) — persist a confirmed interpretation
 *   - `appendEntityObservation` (write) — extend the lineage, rewrite nothing
 *
 * Every operation returns a typed result rather than throwing on refusal:
 * "ambiguous identity" and "registry unavailable" are answers the caller must
 * surface to a human, not exceptions to swallow.
 */

import { randomUUID } from 'crypto';
import {
  AUTHORITY_STATES,
  MODEL_ID_PREFIX,
  OBSERVATION_ID_PREFIX,
  VISIBILITIES,
  computeContentDigest,
  isValidSubjectId,
  looksLikeModelId,
  sha256Digest,
  type AuthorityState,
  type ContextBoundEntityModel,
  type ContextBoundEntityModelWithLineage,
  type ContextEntityObservationRecord,
  type EntitySubject,
  type Horizon,
  type ModelProvenance,
  type ObservationSource,
  type StructuredMap,
  type SubjectType,
  type Visibility,
} from './domain';
import type { ContextEntityResolver, EntityLocator, EntityResolution } from './entityResolver';
import {
  ContextEntityStoreUnavailableError,
  type ContextEntityModelStore,
  type SubjectRef,
} from './store';

/**
 * Source of observed time.
 *
 * Injected as a single seam so that every timestamp in a write comes from one
 * reading of a real clock. Tests replace it to assert ordering; they never get
 * to write a placeholder into the store, because the service refuses caller-
 * supplied creation times entirely (see `saveEntityModel`).
 */
export type Clock = () => Date;

const systemClock: Clock = () => new Date();

/** v0 writes exactly one authority/privacy state. Not caller-selectable. */
const V0_AUTHORITY_STATE: AuthorityState = AUTHORITY_STATES[0];
const V0_VISIBILITY: Visibility = VISIBILITIES[0];

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * Operator/workspace context required on every write.
 *
 * There is no ambient operator. A write that cannot say which workspace it
 * belongs to and who authorised it is refused — availability of a tool is not
 * authority to write.
 */
export interface OperatorContextInput {
  workspaceId: string;
  operatorId: string;
}

export interface SaveEntityModelInput extends OperatorContextInput {
  locator: EntityLocator;
  /** The operator's own framing of why this entity matters here. */
  operatorContext: string;
  horizon: Horizon;
  structuredMap: StructuredMap;
  provenance: ModelProvenance;
}

export interface GetEntityModelInput {
  workspaceId: string;
  locator: EntityLocator;
}

export interface AppendObservationInput extends OperatorContextInput {
  /** Either the entity (appends to its latest version) or an exact version. */
  locator?: EntityLocator;
  modelId?: string;
  body: string;
  observationSource: ObservationSource;
  /** When the thing observed happened. Defaults to now; never in the future. */
  observedAt?: Date;
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

/** Why a write or read was refused. Each maps to something a human must see. */
export type RefusalReason =
  | 'invalid_input'
  | 'identity_not_found'
  | 'identity_ambiguous'
  | 'identity_merge_broken'
  | 'identity_incomplete'
  | 'identity_unavailable'
  | 'model_not_found'
  | 'workspace_mismatch'
  | 'store_unavailable';

export interface Refusal {
  status: 'refused';
  reason: RefusalReason;
  detail: string;
}

export type ResolveEntityResult = { status: 'resolved'; subject: EntitySubject } | Refusal;

export type SaveEntityModelResult =
  | {
      status: 'saved';
      /** `created` minted a new version; `unchanged` matched a stored one. */
      outcome: 'created' | 'unchanged';
      model: ContextBoundEntityModel;
      subject: EntitySubject;
    }
  | Refusal;

export type GetEntityModelResult =
  | ({ status: 'found'; subject: EntitySubject } & ContextBoundEntityModelWithLineage)
  | Refusal;

export type AppendObservationResult =
  | {
      status: 'appended';
      observation: ContextEntityObservationRecord;
      model: ContextBoundEntityModel;
    }
  | Refusal;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

const MAX_WORKSPACE_ID = 64;
const MAX_OPERATOR_ID = 128;
const MAX_OPERATOR_CONTEXT = 8000;
const MAX_OBSERVATION_BODY = 8000;
/** v0 binds models to exactly one entity namespace. */
const V0_SUBJECT_TYPE: SubjectType = 'tiber_player';

export class ContextEntityModelService {
  constructor(
    private readonly store: ContextEntityModelStore,
    private readonly resolver: ContextEntityResolver,
    private readonly clock: Clock = systemClock,
  ) {}

  // -- read -----------------------------------------------------------------

  /** READ. Locator to canonical identity; every failure mode is a refusal. */
  async resolveEntity(locator: EntityLocator): Promise<ResolveEntityResult> {
    const resolution = await this.resolver.resolve(locator);
    if (resolution.status === 'resolved') {
      return { status: 'resolved', subject: resolution.subject };
    }
    return refusalFromResolution(resolution);
  }

  /**
   * READ. The durable context for one entity in one workspace: the latest
   * model version plus its observation lineage.
   *
   * This is what has to be sufficient for a session with no conversational
   * memory to explain why the entity matters here.
   */
  async getEntityModel(input: GetEntityModelInput): Promise<GetEntityModelResult> {
    const workspaceId = normaliseWorkspaceId(input.workspaceId);
    if (!workspaceId) {
      return refuse('invalid_input', 'workspaceId is required');
    }

    const resolution = await this.resolver.resolve(input.locator);
    if (resolution.status !== 'resolved') return refusalFromResolution(resolution);
    const { subject } = resolution;

    try {
      const model = await this.store.findLatestModel(refFor(workspaceId, subject));
      if (!model) {
        return refuse(
          'model_not_found',
          `no context-bound entity model stored for this entity in workspace ${workspaceId}`,
        );
      }
      const observations = await this.store.listObservations(refFor(workspaceId, subject));
      return { status: 'found', subject, model, observations };
    } catch (error) {
      return storeRefusal(error);
    }
  }

  // -- write ----------------------------------------------------------------

  /**
   * WRITE. Persist a confirmed interpretation.
   *
   * Idempotent by content: re-saving the same interpretation returns the
   * stored row (`unchanged`) instead of minting a second version, so a retried
   * or replayed call cannot inflate the version history. A genuinely different
   * interpretation becomes version N+1 — the earlier row is left exactly as it
   * was written and stays replayable.
   *
   * `createdAt` is taken from this service's clock and is not caller-
   * supplied: a persisted creation time is always a real observed time.
   */
  async saveEntityModel(input: SaveEntityModelInput): Promise<SaveEntityModelResult> {
    const workspaceId = normaliseWorkspaceId(input.workspaceId);
    if (!workspaceId) return refuse('invalid_input', 'workspaceId is required');

    const operatorId = input.operatorId?.trim();
    if (!operatorId || operatorId.length > MAX_OPERATOR_ID) {
      return refuse('invalid_input', 'operatorId is required');
    }

    const operatorContext = input.operatorContext?.trim();
    if (!operatorContext) return refuse('invalid_input', 'operatorContext is required');
    if (operatorContext.length > MAX_OPERATOR_CONTEXT) {
      return refuse('invalid_input', `operatorContext exceeds ${MAX_OPERATOR_CONTEXT} characters`);
    }

    // Confirmation authorises *this* persistence. It is checked here, in the
    // application layer, so the guarantee does not depend on which transport
    // the call arrived over.
    if (input.provenance?.confirmation?.confirmed !== true) {
      return refuse('invalid_input', 'operator confirmation is required before persistence');
    }

    const resolution = await this.resolver.resolve(input.locator);
    if (resolution.status !== 'resolved') return refusalFromResolution(resolution);
    const { subject } = resolution;

    if (subject.subjectType !== V0_SUBJECT_TYPE || !isValidSubjectId(subject.subjectType, subject.subjectId)) {
      return refuse('identity_incomplete', 'resolved subject is outside the v0 identity namespace');
    }

    const contentDigest = computeContentDigest({
      workspaceId,
      operatorId,
      subjectType: subject.subjectType,
      subjectId: subject.subjectId,
      operatorContext,
      horizon: input.horizon,
      structuredMap: input.structuredMap,
      authorityState: V0_AUTHORITY_STATE,
      visibility: V0_VISIBILITY,
    });

    const ref = refFor(workspaceId, subject);

    try {
      const existing = await this.store.findModelByContentDigest(ref, contentDigest);
      if (existing) {
        return { status: 'saved', outcome: 'unchanged', model: existing, subject };
      }

      const latest = await this.store.findLatestModel(ref);
      const model: ContextBoundEntityModel = {
        modelId: `${MODEL_ID_PREFIX}${randomUUID().replace(/-/g, '')}`,
        version: (latest?.version ?? 0) + 1,
        workspaceId,
        operatorId,
        subjectType: subject.subjectType,
        subjectId: subject.subjectId,
        operatorContext,
        horizon: input.horizon,
        structuredMap: input.structuredMap,
        structuredMapDigest: sha256Digest(input.structuredMap),
        provenance: input.provenance,
        authorityState: V0_AUTHORITY_STATE,
        visibility: V0_VISIBILITY,
        contentDigest,
        createdAt: this.clock(),
      };

      // The store arbitrates the race: a concurrent identical save loses the
      // unique-index conflict and comes back as the already-stored row.
      const { inserted, model: stored } = await this.store.insertModel(model);
      return { status: 'saved', outcome: inserted ? 'created' : 'unchanged', model: stored, subject };
    } catch (error) {
      return storeRefusal(error);
    }
  }

  /**
   * WRITE. Append one observation to an existing model version.
   *
   * Append-only in the strict sense: this writes a row in the observation
   * table and touches nothing on the model. The model's own `contentDigest`
   * is therefore still valid after the append, which is what makes the
   * original creation state replayable.
   *
   * Deliberately *not* idempotent — two identical observations at different
   * times are two real observations, and silently collapsing them would lose
   * information. Callers that need dedupe must decide that themselves.
   */
  async appendEntityObservation(input: AppendObservationInput): Promise<AppendObservationResult> {
    const workspaceId = normaliseWorkspaceId(input.workspaceId);
    if (!workspaceId) return refuse('invalid_input', 'workspaceId is required');

    const recordedBy = input.operatorId?.trim();
    if (!recordedBy || recordedBy.length > MAX_OPERATOR_ID) {
      return refuse('invalid_input', 'operatorId is required');
    }

    const body = input.body?.trim();
    if (!body) return refuse('invalid_input', 'observation body is required');
    if (body.length > MAX_OBSERVATION_BODY) {
      return refuse('invalid_input', `observation body exceeds ${MAX_OBSERVATION_BODY} characters`);
    }

    const recordedAt = this.clock();
    // An observation may describe something that happened earlier, but it can
    // never have been observed in the future. Rejecting that is what stops a
    // placeholder or fabricated clock value from entering the lineage.
    let observedAt = recordedAt;
    if (input.observedAt !== undefined) {
      const supplied = input.observedAt;
      if (!(supplied instanceof Date) || Number.isNaN(supplied.getTime())) {
        return refuse('invalid_input', 'observedAt is not a valid instant');
      }
      if (supplied.getTime() > recordedAt.getTime()) {
        return refuse('invalid_input', 'observedAt is in the future');
      }
      observedAt = supplied;
    }

    if (!input.modelId && !input.locator) {
      return refuse('invalid_input', 'either modelId or locator is required');
    }

    try {
      const target = await this.resolveAppendTarget(workspaceId, input);
      if ('status' in target) return target;
      const model = target;

      const ref: SubjectRef = {
        workspaceId,
        subjectType: model.subjectType,
        subjectId: model.subjectId,
      };
      const observations = await this.store.listObservations(ref);
      const observation: ContextEntityObservationRecord = {
        observationId: `${OBSERVATION_ID_PREFIX}${randomUUID().replace(/-/g, '')}`,
        modelId: model.modelId,
        workspaceId,
        subjectType: model.subjectType,
        subjectId: model.subjectId,
        sequence: observations.length + 1,
        body,
        observationSource: input.observationSource,
        recordedBy,
        observedAt,
        recordedAt,
      };
      await this.store.insertObservation(observation);
      return { status: 'appended', observation, model };
    } catch (error) {
      return storeRefusal(error);
    }
  }

  /** Every version stored for an entity in a workspace, oldest first. READ. */
  async listEntityModelVersions(
    workspaceId: string,
    subject: EntitySubject,
  ): Promise<ContextBoundEntityModel[] | Refusal> {
    const normalised = normaliseWorkspaceId(workspaceId);
    if (!normalised) return refuse('invalid_input', 'workspaceId is required');
    try {
      return await this.store.listModelVersions(refFor(normalised, subject));
    } catch (error) {
      return storeRefusal(error);
    }
  }

  private async resolveAppendTarget(
    workspaceId: string,
    input: AppendObservationInput,
  ): Promise<ContextBoundEntityModel | Refusal> {
    if (input.modelId) {
      if (!looksLikeModelId(input.modelId)) {
        return refuse('invalid_input', 'modelId is not a context-bound entity model id');
      }
      const model = await this.store.findModelById(input.modelId);
      if (!model) return refuse('model_not_found', 'no model stored with this id');
      // A model id is opaque and guessable-by-nobody, but it is still not a
      // capability: the append must name the workspace it belongs to.
      if (model.workspaceId !== workspaceId) {
        return refuse('workspace_mismatch', 'model belongs to a different workspace');
      }
      return model;
    }

    const resolution = await this.resolver.resolve(input.locator!);
    if (resolution.status !== 'resolved') return refusalFromResolution(resolution);
    const model = await this.store.findLatestModel(refFor(workspaceId, resolution.subject));
    if (!model) {
      return refuse(
        'model_not_found',
        `no context-bound entity model stored for this entity in workspace ${workspaceId}`,
      );
    }
    return model;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normaliseWorkspaceId(workspaceId: string | undefined): string | null {
  const trimmed = workspaceId?.trim();
  if (!trimmed || trimmed.length > MAX_WORKSPACE_ID) return null;
  return trimmed;
}

function refFor(workspaceId: string, subject: EntitySubject): SubjectRef {
  return { workspaceId, subjectType: subject.subjectType, subjectId: subject.subjectId };
}

function refuse(reason: RefusalReason, detail: string): Refusal {
  return { status: 'refused', reason, detail };
}

/** Maps an identity refusal onto an application refusal, preserving which. */
function refusalFromResolution(resolution: Exclude<EntityResolution, { status: 'resolved' }>): Refusal {
  switch (resolution.status) {
    case 'not_found':
      return refuse('identity_not_found', resolution.detail);
    case 'ambiguous':
      return refuse('identity_ambiguous', resolution.detail);
    case 'merge_broken':
      return refuse('identity_merge_broken', resolution.detail);
    case 'identity_incomplete':
      return refuse('identity_incomplete', resolution.detail);
    case 'unavailable':
      return refuse('identity_unavailable', resolution.detail);
    default: {
      const exhaustive: never = resolution;
      return refuse('identity_unavailable', `unhandled resolution: ${String(exhaustive)}`);
    }
  }
}

/**
 * A store failure is reported as such and never as "nothing stored".
 * Unexpected errors are re-thrown: only the store's declared unavailability is
 * a refusal, and swallowing the rest would hide real bugs behind a soft answer.
 */
function storeRefusal(error: unknown): Refusal {
  if (error instanceof ContextEntityStoreUnavailableError) {
    return refuse('store_unavailable', error.message);
  }
  throw error;
}
