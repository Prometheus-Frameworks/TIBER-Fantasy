/**
 * Persistence port for context-bound entity models (Fantasy #332).
 *
 * The application service talks only to this interface, which is why the
 * service is testable without a database and why swapping the durable store
 * is a bounded change. The production implementation is
 * `drizzleContextEntityModelStore.ts` (PostgreSQL, the same database that
 * already owns TIBER-Fantasy application state and the canonical identity
 * registry).
 *
 * Two properties every implementation must preserve:
 *
 *   1. **Append-only.** There is no update or delete operation in this port,
 *      by design. A stored model is never rewritten; a changed interpretation
 *      is a new version row and new information is a new observation row.
 *   2. **Honest failure.** A store that cannot answer must throw
 *      `ContextEntityStoreUnavailableError` rather than return an empty
 *      result. "No model here" and "the database is down" are different
 *      answers, and collapsing them would let a fresh session conclude an
 *      operator never saved anything.
 */

import type {
  ContextBoundEntityModel,
  ContextEntityObservationRecord,
  SubjectType,
} from './domain';

/** The store could not be reached or the query failed. Never a null answer. */
export class ContextEntityStoreUnavailableError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'ContextEntityStoreUnavailableError';
  }
}

/** Identifies one entity inside one workspace. */
export interface SubjectRef {
  workspaceId: string;
  subjectType: SubjectType;
  subjectId: string;
}

export interface ContextEntityModelStore {
  /**
   * Latest version of the model for this subject in this workspace, or null
   * when the operator has never saved one. Throws when unavailable.
   */
  findLatestModel(ref: SubjectRef): Promise<ContextBoundEntityModel | null>;

  /**
   * Existing model with this exact content digest, if any. Drives idempotent
   * save: identical content resolves to the row already stored.
   */
  findModelByContentDigest(
    ref: SubjectRef,
    contentDigest: string,
  ): Promise<ContextBoundEntityModel | null>;

  /** Any version by opaque model id, for appends that name a version. */
  findModelById(modelId: string): Promise<ContextBoundEntityModel | null>;

  /**
   * Every version for this subject in this workspace, oldest first. Used to
   * prove the original creation state is still replayable after later writes.
   */
  listModelVersions(ref: SubjectRef): Promise<ContextBoundEntityModel[]>;

  /**
   * Insert a new model version.
   *
   * Implementations must let the database arbitrate concurrent writers rather
   * than checking first and inserting second: on a unique-constraint conflict
   * against the content digest, return the already-stored row with
   * `inserted: false`. That is the idempotency guarantee, and it has to hold
   * for two sessions racing, not just for one session retrying.
   */
  insertModel(
    model: ContextBoundEntityModel,
  ): Promise<{ inserted: boolean; model: ContextBoundEntityModel }>;

  /**
   * The observation lineage for one entity in one workspace, oldest first.
   *
   * Scoped to the subject rather than to a model version so that observations
   * appended against version 1 are still returned once version 2 exists.
   */
  listObservations(ref: SubjectRef): Promise<ContextEntityObservationRecord[]>;

  /**
   * Append one observation. Must not touch any model row.
   *
   * v0 assigns `sequence` in the application from the current lineage length,
   * which is safe for the single-operator pilot this is scoped to. The unique
   * index on (workspace, subject, sequence) is the backstop: two genuinely
   * concurrent appends collide there and the loser fails loudly rather than
   * silently overwriting a position in the lineage.
   */
  insertObservation(observation: ContextEntityObservationRecord): Promise<void>;
}
