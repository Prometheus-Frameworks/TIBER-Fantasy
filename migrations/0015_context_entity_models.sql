-- Fantasy #332: context-bound entity model persistence (operator-local pilot).
--
-- Two new tables, no changes to any existing table, no foreign keys into
-- existing tables. `subject_id` holds the canonical opaque `tiber_player_id`
-- minted by the Fantasy #327 registry, but it is deliberately *not* an FK:
-- identity is resolved through PlayerIdentityService at the application
-- boundary (which fails closed on ambiguity, outages, and broken merge
-- chains), and a database-level FK would neither reproduce those semantics nor
-- tolerate the nullable/backfilled state of `player_identity_map.tiber_player_id`.
--
-- Hand-authored rather than `drizzle-kit generate`, matching migrations
-- 0004-0014: this repo's drizzle snapshot chain stops at `meta/0003_snapshot.json`
-- while the live schema is ~11 migrations ahead, so `generate` diffs against
-- 0003 and proposes re-creating unrelated tables (metric_matrix_player_vectors,
-- catalyst_scores, rookie_profiles, bronze_nflfastr_plays, ...) behind
-- interactive create-or-rename prompts. Repairing that chain is a separate,
-- much larger change than this pilot is authorised to make. The DDL below is
-- transcribed from `contextEntityModels` / `contextEntityObservations` in
-- shared/schema.ts.

CREATE TABLE IF NOT EXISTS context_entity_models (
  model_id                varchar(64)  PRIMARY KEY,
  version                 integer      NOT NULL,
  workspace_id            varchar(64)  NOT NULL,
  operator_id             varchar(128) NOT NULL,
  subject_type            varchar(32)  NOT NULL,
  subject_id              varchar(64)  NOT NULL,
  operator_context        text         NOT NULL,
  horizon                 varchar(32)  NOT NULL,
  structured_map          jsonb        NOT NULL,
  declared_structured_map_contract varchar(128) NOT NULL,
  structured_map_digest   varchar(71)  NOT NULL,
  provenance              jsonb        NOT NULL,
  authority_state         varchar(32)  NOT NULL,
  visibility              varchar(32)  NOT NULL,
  content_digest          varchar(71)  NOT NULL,
  -- No DEFAULT now(): the application supplies every timestamp from one
  -- observed clock, so a stored time is always a real time rather than
  -- whatever the database happened to think when a row appeared.
  created_at              timestamptz  NOT NULL
);
--> statement-breakpoint

-- One row per (workspace, subject, version). Versions are immutable and
-- additive; nothing updates a model row.
CREATE UNIQUE INDEX IF NOT EXISTS context_entity_models_version_uq
  ON context_entity_models (workspace_id, subject_type, subject_id, version);
--> statement-breakpoint

-- Idempotency: an identical save resolves to the stored row instead of
-- minting a second version. This index is what makes that hold for two
-- concurrent writers, not just for one caller retrying.
CREATE UNIQUE INDEX IF NOT EXISTS context_entity_models_content_uq
  ON context_entity_models (workspace_id, subject_type, subject_id, content_digest);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS context_entity_models_subject_idx
  ON context_entity_models (workspace_id, subject_id);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS context_entity_observations (
  observation_id     varchar(64)  PRIMARY KEY,
  -- Which model version was current when this was appended. Provenance, not
  -- ownership: the lineage belongs to the (workspace, subject) pair, so an
  -- observation stays visible once a later version exists.
  model_id           varchar(64)  NOT NULL REFERENCES context_entity_models (model_id),
  workspace_id       varchar(64)  NOT NULL,
  subject_type       varchar(32)  NOT NULL,
  subject_id         varchar(64)  NOT NULL,
  sequence           integer      NOT NULL,
  body               text         NOT NULL,
  observation_source varchar(32)  NOT NULL,
  recorded_by        varchar(128) NOT NULL,
  observed_at        timestamptz  NOT NULL,
  recorded_at        timestamptz  NOT NULL
);
--> statement-breakpoint

-- Backstop for lineage positions: the application assigns `sequence` from the
-- current lineage length (safe for the single-operator pilot), and two truly
-- concurrent appends collide here and fail loudly rather than silently
-- sharing a position.
CREATE UNIQUE INDEX IF NOT EXISTS context_entity_observations_sequence_uq
  ON context_entity_observations (workspace_id, subject_type, subject_id, sequence);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS context_entity_observations_lineage_idx
  ON context_entity_observations (workspace_id, subject_type, subject_id);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS context_entity_observations_model_idx
  ON context_entity_observations (model_id);
