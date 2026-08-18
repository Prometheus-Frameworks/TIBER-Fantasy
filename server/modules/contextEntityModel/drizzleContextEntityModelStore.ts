/**
 * PostgreSQL persistence for context-bound entity models (Fantasy #332).
 *
 * Storage decision: the same PostgreSQL database that already holds
 * TIBER-Fantasy application state and the canonical identity registry, through
 * the existing Drizzle schema and generated-migration workflow. No second
 * persistence authority is introduced — an operator model whose subject lives
 * in Postgres and whose context lived somewhere else would be two stores to
 * keep consistent for no gain, and the pilot has to survive a process restart
 * between Session A and Session B, which rules out anything in memory.
 *
 * The implementation is deliberately small: two tables, inserts and selects,
 * no updates and no deletes. There is no UPDATE statement anywhere in this
 * file, which is what makes "the original model is never rewritten" a property
 * of the storage layer rather than a convention callers are trusted to follow.
 */

import { and, asc, desc, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import {
  contextEntityModels,
  contextEntityObservations,
  type ContextEntityModel as ContextEntityModelRow,
  type ContextEntityObservation as ContextEntityObservationRow,
} from '@shared/schema';
import type {
  ContextBoundEntityModel,
  ContextEntityObservationRecord,
  Horizon,
  ModelProvenance,
  ObservationSource,
  StructuredMap,
  SubjectType,
  AuthorityState,
  Visibility,
} from './domain';
import {
  ContextEntityStoreUnavailableError,
  type ContextEntityModelStore,
  type SubjectRef,
} from './store';

/** Postgres unique-violation. A conflicting identical save is not an outage. */
const PG_UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === PG_UNIQUE_VIOLATION;
}

export class DrizzleContextEntityModelStore<
  TSchema extends Record<string, unknown> = Record<string, unknown>,
> implements ContextEntityModelStore {
  constructor(private readonly db: NodePgDatabase<TSchema>) {}

  async findLatestModel(ref: SubjectRef): Promise<ContextBoundEntityModel | null> {
    const rows = await this.query(
      () =>
        this.db
          .select()
          .from(contextEntityModels)
          .where(subjectWhere(ref))
          .orderBy(desc(contextEntityModels.version))
          .limit(1),
      'findLatestModel',
    );
    return rows[0] ? toModel(rows[0]) : null;
  }

  async findModelByContentDigest(
    ref: SubjectRef,
    contentDigest: string,
  ): Promise<ContextBoundEntityModel | null> {
    const rows = await this.query(
      () =>
        this.db
          .select()
          .from(contextEntityModels)
          .where(and(subjectWhere(ref), eq(contextEntityModels.contentDigest, contentDigest)))
          .limit(1),
      'findModelByContentDigest',
    );
    return rows[0] ? toModel(rows[0]) : null;
  }

  async findModelById(modelId: string): Promise<ContextBoundEntityModel | null> {
    const rows = await this.query(
      () =>
        this.db
          .select()
          .from(contextEntityModels)
          .where(eq(contextEntityModels.modelId, modelId))
          .limit(1),
      'findModelById',
    );
    return rows[0] ? toModel(rows[0]) : null;
  }

  async listModelVersions(ref: SubjectRef): Promise<ContextBoundEntityModel[]> {
    const rows = await this.query(
      () =>
        this.db
          .select()
          .from(contextEntityModels)
          .where(subjectWhere(ref))
          .orderBy(asc(contextEntityModels.version)),
      'listModelVersions',
    );
    return rows.map(toModel);
  }

  async insertModel(
    model: ContextBoundEntityModel,
  ): Promise<{ inserted: boolean; model: ContextBoundEntityModel }> {
    try {
      await this.db.insert(contextEntityModels).values({
        modelId: model.modelId,
        version: model.version,
        workspaceId: model.workspaceId,
        operatorId: model.operatorId,
        subjectType: model.subjectType,
        subjectId: model.subjectId,
        operatorContext: model.operatorContext,
        horizon: model.horizon,
        structuredMap: model.structuredMap,
        declaredStructuredMapContract: model.structuredMap.declaredContract,
        structuredMapDigest: model.structuredMapDigest,
        provenance: model.provenance,
        authorityState: model.authorityState,
        visibility: model.visibility,
        contentDigest: model.contentDigest,
        createdAt: model.createdAt,
      });
      return { inserted: true, model };
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Either a retry of this exact content or a concurrent writer that got
        // there first. Both mean "already stored" — resolve to the stored row
        // so the caller sees `unchanged` rather than a spurious failure.
        const existing = await this.findModelByContentDigest(
          {
            workspaceId: model.workspaceId,
            subjectType: model.subjectType,
            subjectId: model.subjectId,
          },
          model.contentDigest,
        );
        if (existing) return { inserted: false, model: existing };
        // A unique violation with no matching content row means the version
        // slot was taken by *different* content. That is a genuine conflict,
        // not idempotency, and must not be reported as a successful save.
        throw new ContextEntityStoreUnavailableError(
          'context entity model insert conflicted on a concurrent version write',
          error,
        );
      }
      throw new ContextEntityStoreUnavailableError('context entity model insert failed', error);
    }
  }

  async listObservations(ref: SubjectRef): Promise<ContextEntityObservationRecord[]> {
    const rows = await this.query(
      () =>
        this.db
          .select()
          .from(contextEntityObservations)
          .where(
            and(
              eq(contextEntityObservations.workspaceId, ref.workspaceId),
              eq(contextEntityObservations.subjectType, ref.subjectType),
              eq(contextEntityObservations.subjectId, ref.subjectId),
            ),
          )
          .orderBy(asc(contextEntityObservations.sequence)),
      'listObservations',
    );
    return rows.map(toObservation);
  }

  async insertObservation(observation: ContextEntityObservationRecord): Promise<void> {
    try {
      await this.db.insert(contextEntityObservations).values({
        observationId: observation.observationId,
        modelId: observation.modelId,
        workspaceId: observation.workspaceId,
        subjectType: observation.subjectType,
        subjectId: observation.subjectId,
        sequence: observation.sequence,
        body: observation.body,
        observationSource: observation.observationSource,
        recordedBy: observation.recordedBy,
        observedAt: observation.observedAt,
        recordedAt: observation.recordedAt,
      });
    } catch (error) {
      throw new ContextEntityStoreUnavailableError('context entity observation insert failed', error);
    }
  }

  private async query<T>(run: () => Promise<T>, operation: string): Promise<T> {
    try {
      return await run();
    } catch (error) {
      // Reported as unavailable, never as an empty result: a fresh session must
      // not read a database outage as "the operator never saved anything".
      throw new ContextEntityStoreUnavailableError(
        `context entity store ${operation} failed`,
        error,
      );
    }
  }
}

function subjectWhere(ref: SubjectRef) {
  return and(
    eq(contextEntityModels.workspaceId, ref.workspaceId),
    eq(contextEntityModels.subjectType, ref.subjectType),
    eq(contextEntityModels.subjectId, ref.subjectId),
  );
}

function toModel(row: ContextEntityModelRow): ContextBoundEntityModel {
  return {
    modelId: row.modelId,
    version: row.version,
    workspaceId: row.workspaceId,
    operatorId: row.operatorId,
    subjectType: row.subjectType as SubjectType,
    subjectId: row.subjectId,
    operatorContext: row.operatorContext,
    horizon: row.horizon as Horizon,
    structuredMap: row.structuredMap as StructuredMap,
    structuredMapDigest: row.structuredMapDigest,
    provenance: row.provenance as ModelProvenance,
    authorityState: row.authorityState as AuthorityState,
    visibility: row.visibility as Visibility,
    contentDigest: row.contentDigest,
    createdAt: row.createdAt,
  };
}

function toObservation(row: ContextEntityObservationRow): ContextEntityObservationRecord {
  return {
    observationId: row.observationId,
    modelId: row.modelId,
    workspaceId: row.workspaceId,
    subjectType: row.subjectType as SubjectType,
    subjectId: row.subjectId,
    sequence: row.sequence,
    body: row.body,
    observationSource: row.observationSource as ObservationSource,
    recordedBy: row.recordedBy,
    observedAt: row.observedAt,
    recordedAt: row.recordedAt,
  };
}
