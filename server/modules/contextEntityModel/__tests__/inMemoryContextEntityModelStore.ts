/**
 * Test double for `ContextEntityModelStore` (Fantasy #332).
 *
 * Lives under `__tests__/` deliberately: it is a fixture, not an alternative
 * persistence authority. The durable store is PostgreSQL via
 * `drizzleContextEntityModelStore.ts`; nothing in the production graph can
 * reach this file.
 *
 * It reproduces the two behaviours the service actually depends on — the
 * unique content digest per (workspace, subject) and the unique sequence per
 * lineage — so that idempotency and append-only semantics are tested against
 * the same constraints Postgres enforces, not against a permissive fake.
 */

import type {
  ContextBoundEntityModel,
  ContextEntityObservationRecord,
} from '../domain';
import {
  ContextEntityStoreUnavailableError,
  type ContextEntityModelStore,
  type SubjectRef,
} from '../store';

function refKey(ref: SubjectRef): string {
  return `${ref.workspaceId}::${ref.subjectType}::${ref.subjectId}`;
}

function modelKey(model: ContextBoundEntityModel): string {
  return refKey({
    workspaceId: model.workspaceId,
    subjectType: model.subjectType,
    subjectId: model.subjectId,
  });
}

export class InMemoryContextEntityModelStore implements ContextEntityModelStore {
  /** Frozen copies, so a test cannot mutate stored state through a reference. */
  private readonly models: ContextBoundEntityModel[] = [];
  private readonly observations: ContextEntityObservationRecord[] = [];

  /** Set to make every operation report the store as unavailable. */
  unavailable = false;

  async findLatestModel(ref: SubjectRef): Promise<ContextBoundEntityModel | null> {
    this.guard();
    const versions = this.versionsFor(ref);
    return versions.length ? versions[versions.length - 1] : null;
  }

  async findModelByContentDigest(
    ref: SubjectRef,
    contentDigest: string,
  ): Promise<ContextBoundEntityModel | null> {
    this.guard();
    return this.versionsFor(ref).find((model) => model.contentDigest === contentDigest) ?? null;
  }

  async findModelById(modelId: string): Promise<ContextBoundEntityModel | null> {
    this.guard();
    return this.models.find((model) => model.modelId === modelId) ?? null;
  }

  async listModelVersions(ref: SubjectRef): Promise<ContextBoundEntityModel[]> {
    this.guard();
    return this.versionsFor(ref);
  }

  async insertModel(
    model: ContextBoundEntityModel,
  ): Promise<{ inserted: boolean; model: ContextBoundEntityModel }> {
    this.guard();
    const key = modelKey(model);
    const existing = this.models.find(
      (candidate) => modelKey(candidate) === key && candidate.contentDigest === model.contentDigest,
    );
    if (existing) return { inserted: false, model: existing };

    const versionTaken = this.models.some(
      (candidate) => modelKey(candidate) === key && candidate.version === model.version,
    );
    if (versionTaken) {
      throw new ContextEntityStoreUnavailableError(
        'context entity model insert conflicted on a concurrent version write',
      );
    }

    const stored = deepFreezeModel({ ...model });
    this.models.push(stored);
    return { inserted: true, model: stored };
  }

  async listObservations(ref: SubjectRef): Promise<ContextEntityObservationRecord[]> {
    this.guard();
    return this.observations
      .filter(
        (observation) =>
          observation.workspaceId === ref.workspaceId &&
          observation.subjectType === ref.subjectType &&
          observation.subjectId === ref.subjectId,
      )
      .sort((a, b) => a.sequence - b.sequence);
  }

  async insertObservation(observation: ContextEntityObservationRecord): Promise<void> {
    this.guard();
    const clash = this.observations.some(
      (candidate) =>
        candidate.workspaceId === observation.workspaceId &&
        candidate.subjectType === observation.subjectType &&
        candidate.subjectId === observation.subjectId &&
        candidate.sequence === observation.sequence,
    );
    if (clash) {
      throw new ContextEntityStoreUnavailableError('observation sequence already taken');
    }
    this.observations.push(Object.freeze({ ...observation }));
  }

  /** Raw stored rows, for assertions about what was written. */
  snapshotModels(): ContextBoundEntityModel[] {
    return [...this.models];
  }

  private versionsFor(ref: SubjectRef): ContextBoundEntityModel[] {
    const key = refKey(ref);
    return this.models
      .filter((model) => modelKey(model) === key)
      .sort((a, b) => a.version - b.version);
  }

  private guard(): void {
    if (this.unavailable) {
      throw new ContextEntityStoreUnavailableError('test store marked unavailable');
    }
  }
}

function deepFreezeModel(model: ContextBoundEntityModel): ContextBoundEntityModel {
  Object.freeze(model.structuredMap);
  Object.freeze(model.structuredMap.payload);
  Object.freeze(model.provenance);
  return Object.freeze(model);
}
