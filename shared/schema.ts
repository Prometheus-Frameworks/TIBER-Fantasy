import { pgTable, text, serial, integer, real, boolean, timestamp, varchar, jsonb, unique, pgEnum, uniqueIndex, index, smallint, primaryKey, vector, numeric, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ========================================
// UNIFIED PLAYER HUB - 3-LAYER ELT ARCHITECTURE
// ========================================

// Data quality enums
export const dataQualityEnum = pgEnum("data_quality", [
  "HIGH",
  "MEDIUM", 
  "LOW",
  "MISSING"
]);

// Data source enums
export const dataSourceEnum = pgEnum("data_source", [
  "sleeper",
  "nfl_data_py",
  "fantasypros",
  "mysportsfeeds",
  "espn",
  "yahoo",
  "manual",
  "computed"
]);

// Ingest status enum
export const ingestStatusEnum = pgEnum("ingest_status", [
  "PENDING",
  "PROCESSING",
  "SUCCESS",
  "FAILED",
  "PARTIAL"
]);

// ========================================
// UPH JOB/TASK TRACKING ENUMS
// ========================================

// UPH Job status enum for orchestration tracking
export const uphJobStatusEnum = pgEnum("uph_job_status", [
  "PENDING",
  "RUNNING", 
  "SUCCESS",
  "FAILED",
  "SKIPPED"
]);

// UPH Task type enum for processing pipeline tasks
export const uphTaskTypeEnum = pgEnum("uph_task_type", [
  "BRONZE_INGEST",
  "SILVER_TRANSFORM", 
  "GOLD_FACTS",
  "QUALITY_GATE"
]);

// UPH Job type enum for different job categories
export const uphJobTypeEnum = pgEnum("uph_job_type", [
  "WEEKLY",
  "SEASON",
  "BACKFILL",
  "INCREMENTAL"
]);

// ========================================
// BRAND SIGNALS BRAIN ENUMS
// ========================================

// Brand enum for different brand intelligence types
export const brandEnum = pgEnum("brand", [
  "rookie_risers",
  "dynasty", 
  "redraft",
  "trade_eval",
  "sos",
  "consensus"
]);

// TIBER tier enum
export const tiberTierEnum = pgEnum("tiber_tier", [
  "breakout",
  "stable",
  "regression"
]);

// TIBER trend enum
export const tiberTrendEnum = pgEnum("tiber_trend", [
  "rising",
  "stable",
  "falling"
]);

// ========================================
// WAIVER WISDOM ENUMS
// ========================================

// Waiver tier enum
export const waiverTierEnum = pgEnum("waiver_tier", ["S", "A", "B", "C", "D"]);

// Waiver archetype enum
export const waiverArchetypeEnum = pgEnum("waiver_archetype", [
  "breakout",
  "handcuff", 
  "injury_replacement",
  "role_shift",
  "trap"
]);

// ========================================
// ROLE BANK ENUMS
// ========================================

// WR Role tier enum for role bank classification
export const wrRoleTierEnum = pgEnum("wr_role_tier", [
  "ALPHA",
  "CO_ALPHA",
  "PRIMARY_SLOT",
  "SECONDARY",
  "ROTATIONAL",
  "UNKNOWN"
]);

// RB Role tier enum for role bank classification
export const rbRoleTierEnum = pgEnum("rb_role_tier", [
  "ELITE_WORKHORSE",
  "HIGH_END_RB1",
  "MID_RB1",
  "STRONG_RB2",
  "ROTATIONAL_RB",
  "LIMITED_USAGE",
  "UNKNOWN"
]);

// TE Role tier enum for role bank classification
export const teRoleTierEnum = pgEnum("te_role_tier", [
  "ELITE_TE1",
  "STRONG_TE1",
  "MID_TE1",
  "HIGH_TE2",
  "STREAMER",
  "BLOCKING_TE",
  "UNKNOWN"
]);

// QB Role tier enum for role bank classification
export const qbRoleTierEnum = pgEnum("qb_role_tier", [
  "ELITE_QB1",
  "STRONG_QB1",
  "MID_QB1",
  "HIGH_QB2",
  "STREAMING_QB",
  "BENCH_QB",
  "UNKNOWN"
]);

// ========================================
// BRONZE LAYER - RAW DATA STORAGE
// ========================================

// Raw payload storage for all data sources
export const ingestPayloads = pgTable("ingest_payloads", {
  id: serial("id").primaryKey(),
  source: dataSourceEnum("source").notNull(),
  endpoint: text("endpoint").notNull(), // API endpoint or data source identifier
  payload: jsonb("payload").notNull(), // Raw JSON data
  version: text("version").notNull(), // API version or data version
  jobId: text("job_id").notNull(), // ETL job identifier
  season: integer("season").notNull(),
  week: integer("week"), // NULL for season-level data
  status: ingestStatusEnum("status").notNull().default("PENDING"),
  recordCount: integer("record_count"), // Number of records in payload
  errorMessage: text("error_message"), // Error details if failed
  checksumHash: text("checksum_hash"), // For deduplication
  ingestedAt: timestamp("ingested_at").defaultNow(),
  processedAt: timestamp("processed_at"),
}, (table) => ({
  sourceEndpointIdx: index("ingest_source_endpoint_idx").on(table.source, table.endpoint),
  seasonWeekIdx: index("ingest_season_week_idx").on(table.season, table.week),
  statusIdx: index("ingest_status_idx").on(table.status),
  jobIdIdx: index("ingest_job_id_idx").on(table.jobId),
  uniqueIngestion: unique("ingest_unique").on(table.source, table.endpoint, table.checksumHash),
}));

// ========================================
// UPH JOB/TASK TRACKING - ORCHESTRATION STATE MANAGEMENT
// ========================================

// Dataset Versions - Track data versioning and commits for monitoring
export const datasetVersions = pgTable("dataset_versions", {
  id: serial("id").primaryKey(),
  dataset: text("dataset").notNull(), // 'bronze_players','silver_players','gold_player_week', etc.
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  rowCount: integer("row_count").notNull(),
  committedAt: timestamp("committed_at").defaultNow().notNull(),
  source: text("source").notNull(), // 'sleeper','merge','recompute'
}, (table) => ({
  datasetSeasonWeekIdx: index("dataset_versions_dataset_season_week_idx").on(table.dataset, table.season, table.week),
  committedAtIdx: index("dataset_versions_committed_at_idx").on(table.committedAt),
  datasetSourceIdx: index("dataset_versions_dataset_source_idx").on(table.dataset, table.source),
}));

// Simple Job Runs for monitoring (simplified version alongside UPH jobRuns)
export const monitoringJobRuns = pgTable("monitoring_job_runs", {
  id: serial("id").primaryKey(),
  jobName: text("job_name").notNull(),
  status: text("status").notNull(), // 'success' | 'error'
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
  durationMs: integer("duration_ms"),
  details: jsonb("details"),
}, (table) => ({
  jobNameIdx: index("monitoring_job_runs_job_name_idx").on(table.jobName),
  statusIdx: index("monitoring_job_runs_status_idx").on(table.status),
  startedAtIdx: index("monitoring_job_runs_started_at_idx").on(table.startedAt),
}));

// Job Runs - Master job tracking for orchestration
export const jobRuns = pgTable("job_runs", {
  jobId: text("job_id").primaryKey(), // Unique job identifier
  type: uphJobTypeEnum("type").notNull(), // Job type (WEEKLY, SEASON, BACKFILL, INCREMENTAL)
  status: uphJobStatusEnum("status").notNull().default("PENDING"), // Current job status
  
  // Processing scope
  season: integer("season"), // Season being processed (null for cross-season jobs)
  week: integer("week"), // Week being processed (null for season-level jobs)
  sources: text("sources").array().default([]), // Data sources involved ["sleeper", "nfl_data_py"]
  
  // Execution tracking
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  attempt: integer("attempt").notNull().default(1), // Retry attempt number
  
  // Job statistics and metadata
  stats: jsonb("stats"), // Job-level statistics {recordsProcessed, errors, warnings, etc}
  errorMessage: text("error_message"), // Error details if failed
  metadata: jsonb("metadata"), // Additional job context and configuration
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  statusIdx: index("job_runs_status_idx").on(table.status),
  typeIdx: index("job_runs_type_idx").on(table.type),
  seasonWeekIdx: index("job_runs_season_week_idx").on(table.season, table.week),
  startedAtIdx: index("job_runs_started_at_idx").on(table.startedAt),
  createdAtIdx: index("job_runs_created_at_idx").on(table.createdAt),
  statusStartedIdx: index("job_runs_status_started_idx").on(table.status, table.startedAt),
}));

// Task Runs - Individual task tracking within jobs
export const taskRuns = pgTable("task_runs", {
  id: serial("id").primaryKey(),
  jobId: text("job_id").notNull().references(() => jobRuns.jobId, { 
    onDelete: "cascade", 
    onUpdate: "cascade" 
  }), // Parent job reference
  taskType: uphTaskTypeEnum("task_type").notNull(), // Task type (BRONZE_INGEST, SILVER_TRANSFORM, etc)
  status: uphJobStatusEnum("status").notNull().default("PENDING"), // Task status
  
  // Task scope and context
  scope: jsonb("scope"), // Task-specific scope information {source, tables, filters}
  
  // Execution tracking
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  attempt: integer("attempt").notNull().default(1), // Retry attempt number
  
  // Task statistics and error tracking
  stats: jsonb("stats"), // Task-level statistics {recordsProcessed, transformations, quality_checks}
  errorMessage: text("error_message"), // Detailed error information if failed
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  jobIdIdx: index("task_runs_job_id_idx").on(table.jobId),
  statusIdx: index("task_runs_status_idx").on(table.status),
  taskTypeIdx: index("task_runs_task_type_idx").on(table.taskType),
  jobTaskIdx: index("task_runs_job_task_idx").on(table.jobId, table.taskType),
  startedAtIdx: index("task_runs_started_at_idx").on(table.startedAt),
  statusStartedIdx: index("task_runs_status_started_idx").on(table.status, table.startedAt),
}));

// ========================================
// INTELLIGENT SCHEDULING - STATE-AWARE PROCESSING
// ========================================

// Trigger type enum for intelligent scheduling
export const scheduleTriggerTypeEnum = pgEnum("schedule_trigger_type", [
  "data_freshness",
  "upstream_change", 
  "sla_adjustment",
  "brand_recompute",
  "manual_trigger"
]);

// Schedule action enum for intelligent scheduling
export const scheduleActionEnum = pgEnum("schedule_action", [
  "triggered_processing",
  "adjusted_frequency", 
  "skipped_stale",
  "backoff_applied",
  "brand_recompute"
]);

// Intelligent Schedule State - Track dynamic scheduling state and frequency
export const intelligentScheduleState = pgTable("intelligent_schedule_state", {
  id: serial("id").primaryKey(),
  scheduleKey: text("schedule_key").notNull().unique(), // 'incremental', 'weekly', 'brand_recompute', etc.
  
  // Scheduling timing
  lastRun: timestamp("last_run"),
  nextRun: timestamp("next_run"),
  frequencyMs: integer("frequency_ms").notNull(), // Dynamic frequency in milliseconds
  
  // Performance and load tracking
  systemLoad: jsonb("system_load"), // Current system load metrics
  slaMetrics: jsonb("sla_metrics"), // SLA performance data
  
  // Trigger context
  triggerSource: scheduleTriggerTypeEnum("trigger_source").notNull(), // What caused last schedule change
  isActive: boolean("is_active").notNull().default(true),
  
  // Stats tracking
  totalRuns: integer("total_runs").notNull().default(0),
  successfulRuns: integer("successful_runs").notNull().default(0),
  averageExecutionMs: integer("average_execution_ms").notNull().default(0),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  scheduleKeyIdx: index("intelligent_schedule_state_key_idx").on(table.scheduleKey),
  lastRunIdx: index("intelligent_schedule_state_last_run_idx").on(table.lastRun),
  nextRunIdx: index("intelligent_schedule_state_next_run_idx").on(table.nextRun),
  triggerSourceIdx: index("intelligent_schedule_state_trigger_source_idx").on(table.triggerSource),
  activeIdx: index("intelligent_schedule_state_active_idx").on(table.isActive),
  updatedAtIdx: index("intelligent_schedule_state_updated_at_idx").on(table.updatedAt),
}));

// Schedule Triggers - Track all processing triggers and outcomes
export const scheduleTriggers = pgTable("schedule_triggers", {
  id: serial("id").primaryKey(),
  
  // Trigger identification
  triggerType: scheduleTriggerTypeEnum("trigger_type").notNull(), // Type of trigger
  triggerSource: text("trigger_source").notNull(), // Specific dataset, event, or metric that triggered
  scheduleKey: text("schedule_key").notNull(), // Which schedule was affected
  
  // Action and outcome
  actionTaken: scheduleActionEnum("action_taken").notNull(), // What action was performed
  executionTimeMs: integer("execution_time_ms"), // How long execution took
  success: boolean("success").notNull(),
  errorDetails: text("error_details"), // Error information if failed
  
  // Context data
  triggerData: jsonb("trigger_data"), // Additional context about the trigger
  scheduleStateBefore: jsonb("schedule_state_before"), // State before trigger
  scheduleStateAfter: jsonb("schedule_state_after"), // State after trigger
  
  // References
  jobId: text("job_id"), // Reference to job_runs if processing was triggered
  season: integer("season"), // Season context if applicable
  week: integer("week"), // Week context if applicable
  
  // Timestamps
  triggeredAt: timestamp("triggered_at").notNull().defaultNow(),
}, (table) => ({
  triggerTypeIdx: index("schedule_triggers_trigger_type_idx").on(table.triggerType),
  triggerSourceIdx: index("schedule_triggers_trigger_source_idx").on(table.triggerSource),
  scheduleKeyIdx: index("schedule_triggers_schedule_key_idx").on(table.scheduleKey),
  actionTakenIdx: index("schedule_triggers_action_taken_idx").on(table.actionTaken),
  successIdx: index("schedule_triggers_success_idx").on(table.success),
  triggeredAtIdx: index("schedule_triggers_triggered_at_idx").on(table.triggeredAt),
  jobIdIdx: index("schedule_triggers_job_id_idx").on(table.jobId),
  seasonWeekIdx: index("schedule_triggers_season_week_idx").on(table.season, table.week),
}));

// ========================================
// SCHEMA REGISTRY - DRIFT DETECTION & SAFETY
// ========================================

// Schema Registry for drift detection and deployment safety
export const schemaRegistry = pgTable("schema_registry", {
  id: serial("id").primaryKey(),
  appVersion: text("app_version").notNull(), // Application version
  gitCommit: text("git_commit").notNull(), // Git commit hash for audit trail
  drizzleTag: text("drizzle_tag").notNull(), // Drizzle schema version tag
  appliedAt: timestamp("applied_at").defaultNow().notNull(), // When migration was applied
  checksumSql: text("checksum_sql").notNull(), // Hash of generated SQL schema
  
  // Migration metadata
  migrationSource: text("migration_source").default("auto"), // "auto" | "manual" | "rollback"
  environment: text("environment"), // Environment where applied
  notes: text("notes"), // Additional notes about the migration
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Unique constraint on git commit to prevent duplicate entries
  uniqueGitCommitIdx: uniqueIndex("uq_schema_registry_commit").on(table.gitCommit),
  // Fast access to latest schema
  appliedAtIdx: index("schema_registry_applied_at_idx").on(table.appliedAt),
  // Environment and version tracking
  envVersionIdx: index("schema_registry_env_version_idx").on(table.environment, table.appVersion),
  // Migration source tracking
  migrationSourceIdx: index("schema_registry_migration_source_idx").on(table.migrationSource),
}));

// ========================================
// SILVER LAYER - NORMALIZED CANONICAL TABLES
// ========================================

// Season State - Dynamic season/week detection with hierarchical source tracking
export const seasonState = pgTable("season_state", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(), // 'sleeper' | 'db' | 'env'
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  seasonType: text("season_type").notNull(), // 'pre' | 'regular' | 'post'
  observedAt: timestamp("observed_at").defaultNow().notNull(),
}, (table) => ({
  // Fast access to latest state
  latestStateIdx: uniqueIndex("season_state_latest_idx").on(table.observedAt),
  // Source tracking for debugging
  sourceIdx: index("season_state_source_idx").on(table.source),
  // Season week tracking
  seasonWeekIdx: index("season_state_season_week_idx").on(table.season, table.week),
  // Chronological order
  observedAtIdx: index("season_state_observed_at_idx").on(table.observedAt),
}));

// Player Identity Map - Central cross-platform ID resolution
export const playerIdentityMap = pgTable("player_identity_map", {
  canonicalId: text("canonical_id").primaryKey(), // Our canonical player ID
  fullName: text("full_name").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  position: text("position").notNull(),
  nflTeam: text("nfl_team"), // Current NFL team
  
  // External platform IDs
  sleeperId: text("sleeper_id"),
  espnId: text("espn_id"),
  yahooId: text("yahoo_id"),
  rotowireId: text("rotowire_id"),
  fantasyDataId: text("fantasy_data_id"),
  fantasyprosId: text("fantasypros_id"),
  mysportsfeedsId: text("mysportsfeeds_id"),
  nflDataPyId: text("nfl_data_py_id"),
  gsisId: text("gsis_id"), // NFL GSIS ID for identity resolution
  
  // Player attributes for identity resolution
  jerseyNumber: integer("jersey_number"),
  birthDate: timestamp("birth_date"),
  college: text("college"),
  height: text("height"),
  weight: integer("weight"),
  
  // Identity consolidation fields (v0.2)
  nameFingerprint: text("name_fingerprint"), // Normalized name for matching: "jamarr chase"
  teamHistory: text("team_history").array(), // ["CIN", "FA"] - for trade/FA handling
  mergedInto: text("merged_into"), // Points to surviving canonical_id if merged
  needsReview: boolean("needs_review").default(false), // Flag for manual review queue
  dataCompleteness: integer("data_completeness").default(0), // Count of non-null external IDs + FK refs
  
  // Metadata
  isActive: boolean("is_active").default(true),
  confidence: real("confidence").default(1.0), // ID matching confidence
  lastVerified: timestamp("last_verified").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Platform ID unique indexes for fast lookups
  sleeperIdIdx: uniqueIndex("pim_sleeper_id_idx").on(table.sleeperId).where(sql`${table.sleeperId} IS NOT NULL`),
  espnIdIdx: uniqueIndex("pim_espn_id_idx").on(table.espnId).where(sql`${table.espnId} IS NOT NULL`),
  yahooIdIdx: uniqueIndex("pim_yahoo_id_idx").on(table.yahooId).where(sql`${table.yahooId} IS NOT NULL`),
  rotowireIdIdx: uniqueIndex("pim_rotowire_id_idx").on(table.rotowireId).where(sql`${table.rotowireId} IS NOT NULL`),
  fantasyDataIdIdx: uniqueIndex("pim_fantasy_data_id_idx").on(table.fantasyDataId).where(sql`${table.fantasyDataId} IS NOT NULL`),
  fantasyprosIdIdx: uniqueIndex("pim_fantasypros_id_idx").on(table.fantasyprosId).where(sql`${table.fantasyprosId} IS NOT NULL`),
  mysportsfeedsIdIdx: uniqueIndex("pim_mysportsfeeds_id_idx").on(table.mysportsfeedsId).where(sql`${table.mysportsfeedsId} IS NOT NULL`),
  nflDataPyIdIdx: uniqueIndex("pim_nfl_data_py_id_idx").on(table.nflDataPyId).where(sql`${table.nflDataPyId} IS NOT NULL`),
  
  // Search performance indexes
  positionTeamIdx: index("pim_position_team_idx").on(table.position, table.nflTeam),
  nameIdx: index("pim_name_idx").on(table.fullName),
  firstNameIdx: index("pim_first_name_idx").on(table.firstName),
  lastNameIdx: index("pim_last_name_idx").on(table.lastName),
  activeStatusIdx: index("pim_active_status_idx").on(table.isActive),
  
  // Composite search indexes for common queries
  activePositionIdx: index("pim_active_position_idx").on(table.isActive, table.position),
  positionNameIdx: index("pim_position_name_idx").on(table.position, table.fullName),
  
  // Identity consolidation indexes (v0.2)
  fingerprintIdx: index("pim_fingerprint_idx").on(table.nameFingerprint),
  fingerprintPositionIdx: index("pim_fingerprint_position_idx").on(table.nameFingerprint, table.position),
  mergedIntoIdx: index("pim_merged_into_idx").on(table.mergedInto).where(sql`${table.mergedInto} IS NOT NULL`),
  needsReviewIdx: index("pim_needs_review_idx").on(table.needsReview).where(sql`${table.needsReview} = true`),
}));

// Unmapped Sleeper Players - Roster players that couldn't be matched to canonical IDs
export const unmappedSleeperPlayers = pgTable("unmapped_sleeper_players", {
  sleeperId: text("sleeper_id").primaryKey(),
  fullName: text("full_name").notNull(),
  position: text("position"),
  team: text("team"),
  statusReason: text("status_reason").notNull(), // 'no_match', 'ambiguous', 'inactive', etc.
  rawJson: jsonb("raw_json"), // Full Sleeper player payload for debugging
  firstSeenAt: timestamp("first_seen_at").defaultNow(),
  lastSeenAt: timestamp("last_seen_at").defaultNow(),
});

// Identity Enrichment Log - Traces every Sleeper→Canonical match attempt
export const identityEnrichmentLog = pgTable("identity_enrichment_log", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at").defaultNow(),
  leagueId: uuid("league_id"),
  sleeperPlayerId: text("sleeper_player_id").notNull(),
  sleeperFullName: text("sleeper_full_name"),
  sleeperPosition: text("sleeper_position"),
  sleeperTeam: text("sleeper_team"),
  sleeperGsisId: text("sleeper_gsis_id"),
  sleeperFantasyDataId: text("sleeper_fantasy_data_id"),
  matchedCanonicalId: text("matched_canonical_id"),
  matchConfidence: text("match_confidence").notNull(), // 'exact' | 'high' | 'medium' | 'none'
  matchStrategy: text("match_strategy").notNull(), // 'gsis' | 'fantasy_data' | 'name_pos_team' | 'name_pos' | 'none'
  candidateCount: integer("candidate_count").notNull().default(0),
  candidateSample: jsonb("candidate_sample"), // First 5 candidates for debugging
  notes: text("notes"),
}, (table) => ({
  leagueCreatedIdx: index("iel_league_created_idx").on(table.leagueId, table.createdAt),
  sleeperIdIdx: index("iel_sleeper_id_idx").on(table.sleeperPlayerId),
  canonicalIdIdx: index("iel_canonical_id_idx").on(table.matchedCanonicalId),
  strategyIdx: index("iel_strategy_idx").on(table.matchStrategy),
}));

export type IdentityEnrichmentLog = typeof identityEnrichmentLog.$inferSelect;
export type InsertIdentityEnrichmentLog = typeof identityEnrichmentLog.$inferInsert;

// NFL Teams Dimension Table
export const nflTeamsDim = pgTable("nfl_teams_dim", {
  teamCode: text("team_code").primaryKey(), // "KC", "SF", etc.
  teamName: text("team_name").notNull(), // "Kansas City Chiefs"
  teamCity: text("team_city").notNull(), // "Kansas City"
  teamNickname: text("team_nickname").notNull(), // "Chiefs"
  conference: text("conference").notNull(), // "AFC" or "NFC"
  division: text("division").notNull(), // "North", "South", "East", "West"
  primaryColor: text("primary_color"), // Hex color code
  secondaryColor: text("secondary_color"), // Hex color code
  logoUrl: text("logo_url"),
  stadiumName: text("stadium_name"),
  stadiumCity: text("stadium_city"),
  timezone: text("timezone"), // "America/New_York"
  isActive: boolean("is_active").default(true),
  
  // Alternative team codes for data source mapping
  sleeperId: text("sleeper_id"),
  espnId: text("espn_id"),
  yahooId: text("yahoo_id"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  conferenceIdx: index("teams_conference_idx").on(table.conference),
  divisionIdx: index("teams_division_idx").on(table.division),
}));

// Market Signals - ADP, ECR rankings, market movements
export const marketSignals = pgTable("market_signals", {
  id: serial("id").primaryKey(),
  canonicalPlayerId: text("canonical_player_id").notNull().references(() => playerIdentityMap.canonicalId),
  source: dataSourceEnum("source").notNull(),
  signalType: text("signal_type").notNull(), // "adp", "ecr", "ownership", "start_pct"
  
  // Market data
  overallRank: integer("overall_rank"),
  positionalRank: integer("positional_rank"),
  value: real("value"), // ADP value, percentage, etc.
  
  // Context
  season: integer("season").notNull(),
  week: integer("week"), // NULL for season-long rankings
  leagueFormat: text("league_format"), // "redraft", "dynasty", "bestball"
  scoringFormat: text("scoring_format"), // "ppr", "half", "standard"
  
  // Data quality
  sampleSize: integer("sample_size"),
  confidence: real("confidence").default(0.8),
  dataQuality: dataQualityEnum("data_quality").notNull().default("MEDIUM"),
  
  // Metadata
  extractedAt: timestamp("extracted_at").notNull(),
  validFrom: timestamp("valid_from").notNull(),
  validTo: timestamp("valid_to"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  playerSignalIdx: index("market_player_signal_idx").on(table.canonicalPlayerId, table.signalType),
  seasonWeekIdx: index("market_season_week_idx").on(table.season, table.week),
  sourceTypeIdx: index("market_source_type_idx").on(table.source, table.signalType),
  validityIdx: index("market_validity_idx").on(table.validFrom, table.validTo),
  uniqueSignal: unique("market_unique_signal").on(
    table.canonicalPlayerId, 
    table.source, 
    table.signalType, 
    table.season, 
    table.week,
    table.leagueFormat,
    table.scoringFormat
  ),
}));

// Injuries - Injury reports and practice status
export const injuries = pgTable("injuries", {
  id: serial("id").primaryKey(),
  canonicalPlayerId: text("canonical_player_id").notNull().references(() => playerIdentityMap.canonicalId),
  
  // Injury details
  injuryType: text("injury_type"), // "knee", "ankle", "concussion", etc.
  bodyPart: text("body_part"), // "knee", "shoulder", "head", etc.
  severity: text("severity"), // "minor", "moderate", "major", "season_ending"
  status: text("status").notNull(), // "healthy", "questionable", "doubtful", "out", "ir"
  
  // Practice status
  practiceStatus: text("practice_status"), // "full", "limited", "did_not_participate"
  
  // Timeline
  injuryDate: timestamp("injury_date"),
  expectedReturn: timestamp("expected_return"),
  actualReturn: timestamp("actual_return"),
  
  // Context
  season: integer("season").notNull(),
  week: integer("week"),
  gameDate: timestamp("game_date"),
  
  // Source and quality
  source: dataSourceEnum("source").notNull(),
  reportedBy: text("reported_by"), // Reporter or source name
  confidence: real("confidence").default(0.8),
  
  // Additional context
  description: text("description"),
  impactAssessment: text("impact_assessment"), // Expected fantasy impact
  
  // Metadata
  reportedAt: timestamp("reported_at").notNull(),
  isResolved: boolean("is_resolved").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  playerSeasonIdx: index("injuries_player_season_idx").on(table.canonicalPlayerId, table.season),
  statusIdx: index("injuries_status_idx").on(table.status),
  weekIdx: index("injuries_week_idx").on(table.week),
  activeInjuriesIdx: index("injuries_active_idx").on(table.isResolved).where(sql`${table.isResolved} = false`),
  // Composite index for TIBER rankings LEFT JOIN filter performance
  playerSeasonStatusIdx: index("injuries_player_season_status_idx").on(table.canonicalPlayerId, table.season, table.status),
  // Unique constraint for upsert operations (one injury record per player per season)
  uniquePlayerSeason: unique("injuries_unique_player_season").on(table.canonicalPlayerId, table.season),
}));

// Player Live Status - Real-time roster status from Sleeper API
// Tracks current team, injury status, and active/inactive for FORGE eligibility
export const playerLiveStatus = pgTable("player_live_status", {
  canonicalId: text("canonical_id").primaryKey().references(() => playerIdentityMap.canonicalId),
  sleeperId: text("sleeper_id"),
  
  // Current team (authoritative source from Sleeper)
  currentTeam: text("current_team"), // "PIT", "NYG", null for FA
  
  // Player status from Sleeper
  status: text("status"), // "Active", "Inactive", "Injured Reserve", "PUP", "Suspended", "Out"
  injuryStatus: text("injury_status"), // "Questionable", "Doubtful", "Out", "IR", null
  injuryBodyPart: text("injury_body_part"), // "Knee", "Ankle", "Concussion", etc.
  
  // Eligibility flags for FORGE
  isEligibleForForge: boolean("is_eligible_for_forge").default(true), // False if IR, PUP, or inactive
  
  // Sync metadata
  lastSyncedAt: timestamp("last_synced_at").defaultNow(),
  syncSource: text("sync_source").default("sleeper"), // "sleeper", "manual"
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  statusIdx: index("pls_status_idx").on(table.status),
  eligibleIdx: index("pls_eligible_idx").on(table.isEligibleForForge),
  teamIdx: index("pls_team_idx").on(table.currentTeam),
  sleeperIdx: uniqueIndex("pls_sleeper_idx").on(table.sleeperId).where(sql`${table.sleeperId} IS NOT NULL`),
}));

// Depth Charts - Team depth chart positions
export const depthCharts = pgTable("depth_charts", {
  id: serial("id").primaryKey(),
  canonicalPlayerId: text("canonical_player_id").notNull().references(() => playerIdentityMap.canonicalId),
  teamCode: text("team_code").notNull().references(() => nflTeamsDim.teamCode),
  
  // Depth chart position
  position: text("position").notNull(), // "QB", "RB", "WR", "TE", etc.
  positionGroup: text("position_group"), // "QB", "RB", "WR", "TE", "K", "DST"
  depthOrder: integer("depth_order").notNull(), // 1 = starter, 2 = backup, etc.
  
  // Context
  season: integer("season").notNull(),
  week: integer("week"), // NULL for season-long depth chart
  
  // Additional context
  role: text("role"), // "starter", "backup", "special_packages", "injured_reserve"
  packages: text("packages").array().default([]), // ["base", "nickel", "red_zone"]
  
  // Source and quality
  source: dataSourceEnum("source").notNull(),
  confidence: real("confidence").default(0.8),
  
  // Metadata
  effectiveDate: timestamp("effective_date").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  playerTeamIdx: index("depth_player_team_idx").on(table.canonicalPlayerId, table.teamCode),
  teamPositionIdx: index("depth_team_position_idx").on(table.teamCode, table.position),
  seasonWeekIdx: index("depth_season_week_idx").on(table.season, table.week),
  activeDepthIdx: index("depth_active_idx").on(table.isActive).where(sql`${table.isActive} = true`),
  uniqueDepthPosition: unique("depth_unique_position").on(
    table.canonicalPlayerId,
    table.teamCode,
    table.position,
    table.season,
    table.week
  ),
}));

// Weekly Stats - NFLfastR 2025 weekly player statistics with fantasy scoring
export const weeklyStats = pgTable("weekly_stats", {
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  playerId: text("player_id").notNull(),
  playerName: text("player_name").notNull(),
  team: text("team"),
  position: text("position"),
  
  // Usage metrics
  snaps: integer("snaps"),
  routes: integer("routes"),
  targets: integer("targets"),
  rushAtt: integer("rush_att"),
  
  // Production metrics
  rec: integer("rec"),
  recYd: integer("rec_yd"),
  recTd: integer("rec_td"),
  rushYd: integer("rush_yd"),
  rushTd: integer("rush_td"),
  passYd: integer("pass_yd"),
  passTd: integer("pass_td"),
  int: integer("int"),
  fumbles: integer("fumbles"),
  twoPt: integer("two_pt"),
  
  // Fantasy points (pre-calculated for all scoring formats)
  fantasyPointsStd: real("fantasy_points_std"),
  fantasyPointsHalf: real("fantasy_points_half"),
  fantasyPointsPpr: real("fantasy_points_ppr"),
  
  // Metadata
  gsisId: text("gsis_id"), // NFLfastR crosswalk ID
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Primary key: season + week + player_id (upsert-safe)
  pk: primaryKey({ columns: [table.season, table.week, table.playerId] }),
  
  // Fast player lookups
  playerIdIdx: index("weekly_stats_player_id_idx").on(table.playerId),
  
  // Season-wide queries
  seasonPlayerIdx: index("weekly_stats_season_player_idx").on(table.season, table.playerId),
  
  // Week-specific queries
  seasonWeekIdx: index("weekly_stats_season_week_idx").on(table.season, table.week),
  
  // Position-based rankings
  seasonPositionIdx: index("weekly_stats_season_position_idx").on(table.season, table.position),
}));

// ========================================
// ENUMS FOR BUYS/SELLS TRADE ADVICE MODEL
// ========================================

// Verdict enum for buy/sell recommendations
export const verdictEnum = pgEnum("verdict", [
  "BUY_HARD",
  "BUY", 
  "WATCH_BUY",
  "HOLD",
  "WATCH_SELL", 
  "SELL",
  "SELL_HARD"
]);

// Format enum for league types
export const formatEnum = pgEnum("format", [
  "redraft",
  "dynasty"
]);

// PPR scoring enum
export const pprEnum = pgEnum("ppr", [
  "ppr",
  "half", 
  "standard"
]);

export const teams = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull(),
  leagueName: text("league_name").notNull(),
  record: text("record").notNull(), // e.g., "6-2"
  leagueRank: integer("league_rank").notNull(),
  totalPoints: real("total_points").notNull(),
  healthScore: integer("health_score").notNull(), // 0-100
  // Sync metadata
  syncPlatform: text("sync_platform"), // "espn", "yahoo", "sleeper", "manual"
  syncLeagueId: text("sync_league_id"), // External league ID
  syncTeamId: text("sync_team_id"), // External team ID
  lastSyncDate: timestamp("last_sync_date"),
  syncEnabled: boolean("sync_enabled").default(false),
});

export const players = pgTable("players", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  team: text("team").notNull(), // NFL team abbreviation
  position: text("position").notNull(), // QB, RB, WR, TE, etc.
  avgPoints: real("avg_points").notNull(),
  projectedPoints: real("projected_points").notNull(),
  ownershipPercentage: integer("ownership_percentage").notNull(),
  isAvailable: boolean("is_available").notNull().default(true),
  upside: real("upside").notNull(),
  injuryStatus: text("injury_status").default("Healthy"),
  availability: text("availability").default("Available"),
  imageUrl: text("image_url"), // Player headshot/photo URL
  consistency: real("consistency"), // Performance consistency rating
  matchupRating: real("matchup_rating"), // Upcoming matchup rating
  trend: text("trend"), // "up", "down", "stable"
  ownership: integer("ownership"), // Fantasy ownership %
  targetShare: real("target_share"), // WR/TE target share
  redZoneTargets: integer("red_zone_targets"), // Red zone targets
  carries: integer("carries"), // RB carries
  snapCount: integer("snap_count"), // Offensive snap count
  externalId: text("external_id"), // SportsDataIO player ID
  
  // Sleeper API integration fields
  sleeperId: text("sleeper_id").unique(), // Sleeper player ID
  firstName: text("first_name"),
  lastName: text("last_name"),
  fullName: text("full_name"),
  jerseyNumber: integer("jersey_number"),
  age: integer("age"),
  yearsExp: integer("years_exp"),
  height: text("height"), // e.g., "6'4""
  weight: integer("weight"), // in pounds
  college: text("college"),
  birthCountry: text("birth_country"),
  status: text("status"), // "Active", "Inactive", etc.
  depthChartPosition: text("depth_chart_position"),
  depthChartOrder: integer("depth_chart_order"),
  
  // External IDs for cross-platform matching
  espnId: text("espn_id"),
  yahooId: text("yahoo_id"),
  rotowireId: text("rotowire_id"),
  fantasyDataId: text("fantasy_data_id"),
  
  // Market data - ENHANCED WITH DUAL ADP FIELDS
  adp: real("adp"), // Overall ADP (e.g., 4)
  positionalADP: text("positional_adp"), // Position rank (e.g., "WR1", "RB6")
  adpMissing: boolean("adp_missing").default(false), // True if ADP data unavailable
  adpLastUpdated: timestamp("adp_last_updated"), // When ADP was last synced
  adpSource: text("adp_source"), // 'sleeper', 'espn', 'fantasypros'
  dynastyValue: integer("dynasty_value"), // Dynasty value score 0-100
  
  // FPG-CENTRIC SCORING SYSTEM
  fpg: real("fpg"), // Current season fantasy points per game
  xFpg: real("x_fpg"), // Expected FPG based on advanced metrics
  projFpg: real("proj_fpg"), // Projected FPG for rest of season
  upsideIndex: real("upside_index"), // 0-100 upside potential (rushing QBs, explosive profiles)
  upsideBoost: real("upside_boost"), // Calculated boost from upside factors
  fpgTrend: text("fpg_trend"), // "rising", "declining", "stable"
  fpgVariance: real("fpg_variance"), // Week-to-week FPG variance for floor/ceiling
  explosivePlays: integer("explosive_plays"), // 20+ yard plays this season
  redZoneOpportunity: real("red_zone_opportunity"), // RZ touches/targets per game
  
  // RAG SCORING SYSTEM - Production weekly analysis
  expectedPoints: real("expected_points"), // Weekly expected points (mu)
  floorPoints: real("floor_points"), // Weekly floor (mu - sigma)
  ceilingPoints: real("ceiling_points"), // Weekly ceiling (mu + sigma) 
  ragScore: real("rag_score"), // 0-100 RAG score with upside bias
  ragColor: text("rag_color"), // "GREEN", "AMBER", "RED"
  
  // Advanced weekly analytics from earlier phases
  beatProj: real("beat_proj"), // Beat projection rate 0-100
  features: jsonb("features"), // Advanced feature calculations
  
  // ROOKIE RISERS SYSTEM - Draft data for rookie identification
  draftYear: integer("draft_year"), // Draft year to identify rookies
  draftRound: integer("draft_round"), // Draft round (1-7, or NULL for UDFA)
  draftPick: integer("draft_pick"), // Overall draft pick
  
  // PLAYER POOL QUALITY SYSTEM - For filtering relevant players
  rosteredPct: real("rostered_pct").default(0), // Fantasy rostered percentage (0-100)
  active: boolean("active").default(true), // Whether player is active/relevant for fantasy
  
  // RANKING SYSTEM - Overall and dynasty-specific rankings
  rank: integer("rank"), // Overall fantasy ranking
  dynastyRank: integer("dynasty_rank"), // Dynasty-specific ranking
  startupDraftable: boolean("startup_draftable").default(false), // Whether player is startup draftable
});

// Articles table for content management
export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  content: text("content").notNull(), // Full article content in markdown
  excerpt: text("excerpt"), // Short excerpt for previews
  category: text("category").notNull(),
  tags: text("tags").array().notNull().default([]), // Array of tags
  readTime: text("read_time").notNull(), // e.g., "8 min"
  publishDate: timestamp("publish_date").defaultNow(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  featured: boolean("featured").default(false),
  published: boolean("published").default(true),
  author: text("author").notNull(),
  authorBio: text("author_bio"), // Optional author description
  metaKeywords: text("meta_keywords").array().default([]), // SEO keywords
  viewCount: integer("view_count").default(0),
});

// Game logs table for storing weekly performance data
export const gameLogs = pgTable("game_logs", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").references(() => players.id).notNull(),
  sleeperId: text("sleeper_id").notNull(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  seasonType: text("season_type").notNull(), // "regular", "post", "pre"
  opponent: text("opponent"),
  gameDate: timestamp("game_date"),
  
  // Fantasy stats
  fantasyPoints: real("fantasy_points"),
  fantasyPointsPpr: real("fantasy_points_ppr"),
  fantasyPointsHalfPpr: real("fantasy_points_half_ppr"),
  
  // Passing stats
  passAttempts: integer("pass_attempts"),
  passCompletions: integer("pass_completions"),
  passYards: integer("pass_yards"),
  passTd: integer("pass_td"),
  passInt: integer("pass_int"),
  pass2pt: integer("pass_2pt"),
  
  // Rushing stats
  rushAttempts: integer("rush_attempts"),
  rushYards: integer("rush_yards"),
  rushTd: integer("rush_td"),
  rush2pt: integer("rush_2pt"),
  
  // Receiving stats
  receptions: integer("receptions"),
  targets: integer("targets"),
  recYards: integer("rec_yards"),
  recTd: integer("rec_td"),
  rec2pt: integer("rec_2pt"),
  
  // Other stats
  fumbles: integer("fumbles"),
  fumblesLost: integer("fumbles_lost"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  // Unique constraint to prevent duplicate game logs
  uniqueGameLog: unique().on(table.sleeperId, table.season, table.week, table.seasonType)
}));

export const teamPlayers = pgTable("team_players", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  playerId: integer("player_id").notNull(),
  isStarter: boolean("is_starter").notNull().default(false),
});

export const positionAnalysis = pgTable("position_analysis", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  position: text("position").notNull(),
  strengthScore: integer("strength_score").notNull(), // 0-100
  status: text("status").notNull(), // "critical", "warning", "good"
  weeklyAverage: real("weekly_average").notNull(),
  leagueAverage: real("league_average").notNull(),
});

export const weeklyPerformance = pgTable("weekly_performance", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull(),
  week: integer("week").notNull(),
  points: real("points").notNull(),
  projectedPoints: real("projected_points").notNull(),
});

// Advanced Analytics Tables
export const matchupAnalysis = pgTable("matchup_analysis", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => players.id),
  week: integer("week").notNull(),
  opponent: text("opponent").notNull(),
  difficulty: text("difficulty").notNull(), // "easy", "medium", "hard"
  defenseRank: integer("defense_rank"), // opponent defense ranking vs position
  projectedPoints: real("projected_points"),
  weatherImpact: text("weather_impact"),
  isHome: boolean("is_home").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const lineupOptimization = pgTable("lineup_optimization", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id),
  week: integer("week").notNull(),
  optimizedLineup: text("optimized_lineup").notNull(), // JSON string of player IDs by position
  projectedPoints: real("projected_points").notNull(),
  confidence: real("confidence"), // 0-1 confidence score
  factors: text("factors"), // JSON string with optimization factors
  createdAt: timestamp("created_at").defaultNow(),
});

export const tradeAnalysis = pgTable("trade_analysis", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id),
  playersGiven: text("players_given").notNull(), // JSON array of player IDs
  playersReceived: text("players_received").notNull(), // JSON array of player IDs
  tradeValue: real("trade_value"), // Overall trade value score
  recommendation: text("recommendation"), // "accept", "decline", "counter"
  reasoning: text("reasoning"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const dynastyTradeHistory = pgTable("dynasty_trade_history", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id),
  tradePartnerTeamId: integer("trade_partner_team_id"), // Other team in trade
  playersGiven: text("players_given").notNull(), // JSON array of {playerId, playerName, position, age}
  playersReceived: text("players_received").notNull(), // JSON array of {playerId, playerName, position, age}
  draftPicksGiven: text("draft_picks_given"), // JSON array of {year, round, pick}
  draftPicksReceived: text("draft_picks_received"), // JSON array of {year, round, pick}
  tradeDate: timestamp("trade_date").defaultNow(),
  tradeValue: real("trade_value"), // Value assessment at time of trade
  currentValue: real("current_value"), // Current retrospective value
  tradeGrade: text("trade_grade"), // "A+", "A", "B+", "B", "C+", "C", "D+", "D", "F"
  notes: text("notes"), // User notes about the trade
  leagueId: text("league_id"), // External league ID for sync
  externalTradeId: text("external_trade_id"), // Platform-specific trade ID
  season: integer("season").notNull().default(2024),
  week: integer("week"), // Week the trade was made
});



export const waiverRecommendations = pgTable("waiver_recommendations", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id),
  playerId: integer("player_id").notNull().references(() => players.id),
  priority: integer("priority").notNull(), // 1 = highest priority
  reasoning: text("reasoning").notNull(),
  projectedImpact: real("projected_impact"), // Expected fantasy points gain
  usageTrend: text("usage_trend"), // "rising", "stable", "declining"
  createdAt: timestamp("created_at").defaultNow(),
});

export const injuryTracker = pgTable("injury_tracker", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => players.id),
  injuryType: text("injury_type"),
  severity: text("severity"), // "minor", "moderate", "major"
  expectedReturn: timestamp("expected_return"),
  impactDescription: text("impact_description"),
  replacementSuggestions: text("replacement_suggestions"), // JSON array of suggested replacement player IDs
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertTeamSchema = createInsertSchema(teams).omit({
  id: true,
});

export const insertPlayerSchema = createInsertSchema(players).omit({
  id: true,
});

export const insertTeamPlayerSchema = createInsertSchema(teamPlayers).omit({
  id: true,
});

export const insertPositionAnalysisSchema = createInsertSchema(positionAnalysis).omit({
  id: true,
});

export const insertWeeklyPerformanceSchema = createInsertSchema(weeklyPerformance).omit({
  id: true,
});

// Advanced Analytics Insert Schemas
export const insertMatchupAnalysisSchema = createInsertSchema(matchupAnalysis).omit({
  id: true,
  createdAt: true,
});

export const insertLineupOptimizationSchema = createInsertSchema(lineupOptimization).omit({
  id: true,
  createdAt: true,
});

export const insertTradeAnalysisSchema = createInsertSchema(tradeAnalysis).omit({
  id: true,
  createdAt: true,
});

export const insertWaiverRecommendationsSchema = createInsertSchema(waiverRecommendations).omit({
  id: true,
  createdAt: true,
});

export const insertInjuryTrackerSchema = createInsertSchema(injuryTracker).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// UPH Job/Task Tracking Insert Schemas
export const insertJobRunsSchema = createInsertSchema(jobRuns).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertTaskRunsSchema = createInsertSchema(taskRuns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Fantasy Moves Tracking Tables
export const fantasyMoves = pgTable("fantasy_moves", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id),
  moveType: text("move_type").notNull(), // "trade", "draft", "waiver", "free_agent"
  moveDate: timestamp("move_date").notNull(),
  description: text("description").notNull(), // "Traded for Josh Allen", "Drafted Brian Thomas Jr."
  
  // Value tracking
  valueGained: integer("value_gained").notNull(), // Dynasty points gained
  valueLost: integer("value_lost").notNull(), // Dynasty points lost  
  netValue: integer("net_value").notNull(), // Net gain/loss
  
  // Move details
  playersAcquired: jsonb("players_acquired"), // [{id, name, position, valueAtTime}]
  playersLost: jsonb("players_lost"), // [{id, name, position, valueAtTime}]
  picksAcquired: jsonb("picks_acquired"), // [{round, pick, year, valueAtTime}]
  picksLost: jsonb("picks_lost"), // [{round, pick, year, valueAtTime}]
  
  // Current evaluation
  currentValueGained: integer("current_value_gained"), // Current dynasty value of acquired assets
  currentValueLost: integer("current_value_lost"), // Current dynasty value of lost assets  
  currentNetValue: integer("current_net_value"), // Current net value
  
  // Metadata
  tradePartner: text("trade_partner"), // For trades
  waiverPriority: integer("waiver_priority"), // For waivers
  season: integer("season").notNull(),
  week: integer("week"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const draftPicks = pgTable("draft_picks", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teams.id),
  round: integer("round").notNull(),
  pick: integer("pick").notNull(), // Overall pick number
  originalPick: text("original_pick").notNull(), // "1.12", "2.03", etc.
  year: integer("year").notNull(),
  playerId: integer("player_id").references(() => players.id), // If picked
  playerName: text("player_name"), // Player selected
  position: text("position"), // Position of player selected
  
  // Valuation at time of pick
  pickValue: integer("pick_value").notNull(), // Dynasty value of pick slot
  playerCurrentValue: integer("player_current_value"), // Current dynasty value of player
  
  // Trade context if applicable
  acquiredVia: text("acquired_via"), // "original", "trade", "compensatory"
  tradeContext: text("trade_context"), // Description of how pick was acquired
  
  createdAt: timestamp("created_at").defaultNow(),
});

export const playerValueHistory = pgTable("player_value_history", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => players.id),
  date: timestamp("date").notNull(),
  dynastyValue: integer("dynasty_value").notNull(),
  source: text("source").notNull(), // "DynastyDataLab", "estimated"
  adp: real("adp"), // Average draft position
  ownership: real("ownership"), // Ownership percentage
  
  // Context
  season: integer("season").notNull(),
  week: integer("week"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Value Arbitrage Tables
export const marketData = pgTable("market_data", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => players.id),
  source: varchar("source", { length: 50 }).notNull(), // 'fantasypros', 'dynastydatalab', 'sportsdata'
  adp: real("adp"),
  adpRank: integer("adp_rank"),
  ownershipPercent: real("ownership_percent"),
  tradeValue: real("trade_value"),
  consensusRank: integer("consensus_rank"),
  week: integer("week"),
  season: integer("season").notNull(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const valueArbitrage = pgTable("value_arbitrage", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => players.id),
  adpValue: real("adp_value"), // Current ADP ranking
  metricsScore: real("metrics_score"), // Calculated score from advanced metrics
  valueGap: real("value_gap"), // Difference between metrics and ADP
  recommendation: varchar("recommendation", { length: 20 }).notNull(), // 'undervalued', 'overvalued', 'fair'
  confidence: real("confidence"), // 0-100 confidence score
  reasonCode: varchar("reason_code", { length: 100 }), // Primary metric driving recommendation
  weeklyChange: real("weekly_change"), // Change in value gap from previous week
  targetShare: real("target_share"),
  yardsPerRouteRun: real("yards_per_route_run"),
  airYards: real("air_yards"),
  redZoneTargets: integer("red_zone_targets"),
  snapCountPercent: real("snap_count_percent"),
  week: integer("week").notNull(),
  season: integer("season").notNull(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Add unique constraint for player per week/season
  playerWeekSeasonUnique: unique().on(table.playerId, table.week, table.season),
}));

export const metricCorrelations = pgTable("metric_correlations", {
  id: serial("id").primaryKey(),
  position: varchar("position", { length: 10 }).notNull(),
  metricName: varchar("metric_name", { length: 100 }).notNull(),
  correlationToFantasy: real("correlation_to_fantasy"), // -1 to 1 correlation with fantasy points
  correlationToAdp: real("correlation_to_adp"), // -1 to 1 correlation with ADP
  sampleSize: integer("sample_size"),
  season: integer("season").notNull(),
  lastCalculated: timestamp("last_calculated").defaultNow(),
});

export const insertMarketDataSchema = createInsertSchema(marketData).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

export const insertValueArbitrageSchema = createInsertSchema(valueArbitrage).omit({
  id: true,
  createdAt: true,
  lastUpdated: true,
});

export const insertMetricCorrelationsSchema = createInsertSchema(metricCorrelations).omit({
  id: true,
  lastCalculated: true,
});

export const insertFantasyMovesSchema = createInsertSchema(fantasyMoves).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDraftPicksSchema = createInsertSchema(draftPicks).omit({
  id: true,
  createdAt: true,
});

export const insertPlayerValueHistorySchema = createInsertSchema(playerValueHistory).omit({
  id: true,
  createdAt: true,
});

// Types
export type Team = typeof teams.$inferSelect;
export type Player = typeof players.$inferSelect;
export type TeamPlayer = typeof teamPlayers.$inferSelect;
export type PositionAnalysis = typeof positionAnalysis.$inferSelect;
export type WeeklyPerformance = typeof weeklyPerformance.$inferSelect;
export type MatchupAnalysis = typeof matchupAnalysis.$inferSelect;
export type LineupOptimization = typeof lineupOptimization.$inferSelect;
export type TradeAnalysis = typeof tradeAnalysis.$inferSelect;
export type DynastyTradeHistory = typeof dynastyTradeHistory.$inferSelect;
export type WaiverRecommendations = typeof waiverRecommendations.$inferSelect;
export type InjuryTracker = typeof injuryTracker.$inferSelect;
export type MarketData = typeof marketData.$inferSelect;
export type ValueArbitrage = typeof valueArbitrage.$inferSelect;
export type MetricCorrelations = typeof metricCorrelations.$inferSelect;
export type FantasyMove = typeof fantasyMoves.$inferSelect;
export type DraftPick = typeof draftPicks.$inferSelect;
export type PlayerValueHistory = typeof playerValueHistory.$inferSelect;

// UPH Job/Task Tracking Types
export type JobRuns = typeof jobRuns.$inferSelect;
export type TaskRuns = typeof taskRuns.$inferSelect;

export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type InsertTeamPlayer = z.infer<typeof insertTeamPlayerSchema>;
export type InsertPositionAnalysis = z.infer<typeof insertPositionAnalysisSchema>;
export type InsertWeeklyPerformance = z.infer<typeof insertWeeklyPerformanceSchema>;
export type InsertMatchupAnalysis = z.infer<typeof insertMatchupAnalysisSchema>;
export type InsertLineupOptimization = z.infer<typeof insertLineupOptimizationSchema>;
export type InsertTradeAnalysis = z.infer<typeof insertTradeAnalysisSchema>;
export type InsertWaiverRecommendations = z.infer<typeof insertWaiverRecommendationsSchema>;
export type InsertInjuryTracker = z.infer<typeof insertInjuryTrackerSchema>;
export type InsertMarketData = z.infer<typeof insertMarketDataSchema>;
export type InsertValueArbitrage = z.infer<typeof insertValueArbitrageSchema>;
export type InsertMetricCorrelations = z.infer<typeof insertMetricCorrelationsSchema>;

// UPH Job/Task Tracking Insert Types
export type InsertJobRuns = z.infer<typeof insertJobRunsSchema>;
export type InsertTaskRuns = z.infer<typeof insertTaskRunsSchema>;

// Game Logs types
export type GameLog = typeof gameLogs.$inferSelect;
export type InsertGameLog = typeof gameLogs.$inferInsert;

export const insertGameLogSchema = createInsertSchema(gameLogs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertGameLogType = z.infer<typeof insertGameLogSchema>;

// Article schema and types
export const insertArticleSchema = createInsertSchema(articles).omit({
  id: true,
  publishDate: true,
  lastUpdated: true,
  viewCount: true,
});

export type Article = typeof articles.$inferSelect;
export type InsertArticle = z.infer<typeof insertArticleSchema>;
export type InsertFantasyMove = z.infer<typeof insertFantasyMovesSchema>;
export type InsertDraftPick = z.infer<typeof insertDraftPicksSchema>;
export type InsertPlayerValueHistory = z.infer<typeof insertPlayerValueHistorySchema>;

// Relations
export const teamsRelations = relations(teams, ({ many }) => ({
  teamPlayers: many(teamPlayers),
  positionAnalyses: many(positionAnalysis),
  weeklyPerformances: many(weeklyPerformance),
}));

export const playersRelations = relations(players, ({ many }) => ({
  teamPlayers: many(teamPlayers),
  gameLogs: many(gameLogs),
}));

export const gameLogsRelations = relations(gameLogs, ({ one }) => ({
  player: one(players, {
    fields: [gameLogs.playerId],
    references: [players.id],
  }),
}));

// TIBER Consensus Engine v1.1 Tables
export const userProfiles = pgTable("user_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username").notNull().unique(),
  consentConsensus: boolean("consent_consensus").default(false),
  fireScore: integer("fire_score").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userRanks = pgTable("user_ranks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => userProfiles.id),
  format: varchar("format", { enum: ["dynasty", "redraft"] }).notNull(),
  season: integer("season"), // required for redraft, null for dynasty
  pos: varchar("pos", { enum: ["QB", "RB", "WR", "TE", "ALL"] }).notNull(),
  playerId: varchar("player_id").notNull(),
  rank: integer("rank").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const fireEvents = pgTable("fire_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fromUserId: varchar("from_user_id").notNull().references(() => userProfiles.id),
  toUserId: varchar("to_user_id").notNull().references(() => userProfiles.id),
  targetType: varchar("target_type", { enum: ["rankingSet", "profile"] }).notNull(),
  targetId: varchar("target_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations for consensus engine
export const userProfilesRelations = relations(userProfiles, ({ many }) => ({
  userRanks: many(userRanks),
  fireEventsGiven: many(fireEvents, { relationName: "fireEventsGiven" }),
  fireEventsReceived: many(fireEvents, { relationName: "fireEventsReceived" }),
}));

export const userRanksRelations = relations(userRanks, ({ one }) => ({
  user: one(userProfiles, {
    fields: [userRanks.userId],
    references: [userProfiles.id],
  }),
}));

export const fireEventsRelations = relations(fireEvents, ({ one }) => ({
  fromUser: one(userProfiles, {
    fields: [fireEvents.fromUserId],
    references: [userProfiles.id],
    relationName: "fireEventsGiven",
  }),
  toUser: one(userProfiles, {
    fields: [fireEvents.toUserId],
    references: [userProfiles.id],
    relationName: "fireEventsReceived",
  }),
}));

// Insert schemas for consensus engine
export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  createdAt: true,
});

export const insertUserRankSchema = createInsertSchema(userRanks).omit({
  id: true,
  updatedAt: true,
});

export const insertFireEventSchema = createInsertSchema(fireEvents).omit({
  id: true,
  createdAt: true,
});

// Types for consensus engine
export type UserProfile = typeof userProfiles.$inferSelect;
export type UpsertUserProfile = typeof userProfiles.$inferInsert;
export type UserRank = typeof userRanks.$inferSelect;
export type UpsertUserRank = typeof userRanks.$inferInsert;
export type FireEvent = typeof fireEvents.$inferSelect;
export type UpsertFireEvent = typeof fireEvents.$inferInsert;

export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type InsertUserRank = z.infer<typeof insertUserRankSchema>;
export type InsertFireEvent = z.infer<typeof insertFireEventSchema>;

// TIBER Consensus Command Router v1 types
export type ConsensusRank = typeof consensusRanks.$inferSelect;
export type InsertConsensusRank = typeof consensusRanks.$inferInsert;
export type ConsensusAudit = typeof consensusAudit.$inferSelect;
export type InsertConsensusAudit = typeof consensusAudit.$inferInsert;

// TIBER Consensus Command Router v1 - dedicated consensus ranking system
export const consensusRanks = pgTable("consensus_ranks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  season: integer("season").notNull().default(2025),
  mode: varchar("mode", { enum: ["redraft", "dynasty"] }).notNull(),
  position: varchar("position", { enum: ["QB", "RB", "WR", "TE", "ALL"] }).notNull(),
  rank: integer("rank").notNull(),
  playerId: varchar("player_id").notNull(),
  sourceUser: varchar("source_user").notNull().default("architect-j"),
  sourceWeight: real("source_weight").notNull().default(1.0),
  note: varchar("note"),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueRanking: uniqueIndex("unique_consensus_rank").on(table.season, table.mode, table.position, table.rank),
}));

export const consensusAudit = pgTable("consensus_audit", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  season: integer("season").notNull(),
  mode: varchar("mode").notNull(),
  position: varchar("position").notNull(),
  rank: integer("rank").notNull(),
  playerId: varchar("player_id").notNull(),
  previousPlayerId: varchar("previous_player_id"),
  sourceUser: varchar("source_user").notNull(),
  action: varchar("action", { enum: ["insert", "update", "swap", "shift"] }).notNull(),
  payload: jsonb("payload"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Note: Consensus board tables defined below with proper enums

export const teamPlayersRelations = relations(teamPlayers, ({ one }) => ({
  team: one(teams, {
    fields: [teamPlayers.teamId],
    references: [teams.id],
  }),
  player: one(players, {
    fields: [teamPlayers.playerId],
    references: [players.id],
  }),
}));

export const positionAnalysisRelations = relations(positionAnalysis, ({ one }) => ({
  team: one(teams, {
    fields: [positionAnalysis.teamId],
    references: [teams.id],
  }),
}));

export const weeklyPerformanceRelations = relations(weeklyPerformance, ({ one }) => ({
  team: one(teams, {
    fields: [weeklyPerformance.teamId],
    references: [teams.id],
  }),
}));

export const fantasyMovesRelations = relations(fantasyMoves, ({ one }) => ({
  team: one(teams, {
    fields: [fantasyMoves.teamId],
    references: [teams.id],
  }),
}));

export const draftPicksRelations = relations(draftPicks, ({ one }) => ({
  team: one(teams, {
    fields: [draftPicks.teamId],
    references: [teams.id],
  }),
  player: one(players, {
    fields: [draftPicks.playerId],
    references: [players.id],
  }),
}));

export const playerValueHistoryRelations = relations(playerValueHistory, ({ one }) => ({
  player: one(players, {
    fields: [playerValueHistory.playerId],
    references: [players.id],
  }),
}));

// Consensus system tables
export const consensusFormatEnum = pgEnum("consensus_format", ["redraft", "dynasty"]);
export const consensusSourceEnum = pgEnum("consensus_source", ["system", "editor", "community"]);

export const consensusBoard = pgTable("consensus_board", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  format: consensusFormatEnum("format").notNull(),
  season: integer("season"), // required for redraft, null for dynasty
  rank: integer("rank").notNull(),
  tier: varchar("tier").notNull(),
  score: real("score").notNull(),
  source: consensusSourceEnum("source").notNull().default("system"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("consensus_unique_player_format_season").on(table.format, table.season, table.playerId),
  index("consensus_format_season_rank_idx").on(table.format, table.season, table.rank),
  index("consensus_format_season_updated_idx").on(table.format, table.season, table.updatedAt),
]);

export const consensusMeta = pgTable("consensus_meta", {
  id: varchar("id").primaryKey().default("singleton"),
  defaultFormat: consensusFormatEnum("default_format").notNull().default("dynasty"),
  boardVersion: integer("board_version").notNull().default(1),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const consensusChangelog = pgTable("consensus_changelog", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  userId: varchar("user_id"),
  format: consensusFormatEnum("format").notNull(),
  season: integer("season"),
  playerId: varchar("player_id").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
}, (table) => [
  index("consensus_changelog_timestamp_idx").on(table.timestamp),
  index("consensus_changelog_player_idx").on(table.playerId),
]);

// Consensus Engine Types
export type ConsensusBoard = typeof consensusBoard.$inferSelect;
export type InsertConsensusBoard = typeof consensusBoard.$inferInsert;
export type ConsensusMeta = typeof consensusMeta.$inferSelect;
export type InsertConsensusMeta = typeof consensusMeta.$inferInsert;
export type ConsensusChangelog = typeof consensusChangelog.$inferSelect;
export type InsertConsensusChangelog = typeof consensusChangelog.$inferInsert;

// Adaptive Consensus Engine Tables
export const playerInjuries = pgTable("player_injuries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  status: varchar("status", { 
    enum: ["ACTIVE", "OUT", "IR", "PUP", "QUESTIONABLE", "DOUBTFUL"] 
  }).notNull(),
  injuryType: varchar("injury_type", {
    enum: ["ACL", "Achilles", "Hamstring", "Concussion", "Ankle", "Knee", "Shoulder", "Back", "Other"]
  }),
  datePlaced: timestamp("date_placed"),
  estReturnWeeks: integer("est_return_weeks"),
  outForSeason: boolean("out_for_season").default(false),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const playerBios = pgTable("player_bios", {
  playerId: varchar("player_id").primaryKey(),
  pos: varchar("pos", { enum: ["QB", "RB", "WR", "TE"] }).notNull(),
  age: integer("age").notNull(),
  team: varchar("team"),
  lastUpdated: timestamp("last_updated").defaultNow(),
});

export const playerUsageWeekly = pgTable("player_usage_weekly", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  week: integer("week").notNull(),
  season: integer("season").notNull(),
  snapShare: real("snap_share"),
  routesRun: integer("routes_run"),
  touches: integer("touches"),
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => [
  uniqueIndex("usage_player_week_season").on(table.playerId, table.week, table.season),
]);

export const consensusExplanations = pgTable("consensus_explanations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  playerId: varchar("player_id").notNull(),
  format: varchar("format", { enum: ["dynasty", "redraft"] }).notNull(),
  season: integer("season"),
  decayDays: integer("decay_days").notNull(),
  surgeActive: boolean("surge_active").default(false),
  baseRank: real("base_rank").notNull(),
  adjustedRank: real("adjusted_rank").notNull(),
  explanation: jsonb("explanation").notNull(), // Full explanation object
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => [
  uniqueIndex("explanation_player_format_season").on(table.playerId, table.format, table.season),
]);

export type PlayerInjury = typeof playerInjuries.$inferSelect;
export type InsertPlayerInjury = typeof playerInjuries.$inferInsert;
export type PlayerBio = typeof playerBios.$inferSelect;
export type InsertPlayerBio = typeof playerBios.$inferInsert;
export type PlayerUsageWeekly = typeof playerUsageWeekly.$inferSelect;
export type InsertPlayerUsageWeekly = typeof playerUsageWeekly.$inferInsert;
export type ConsensusExplanationRow = typeof consensusExplanations.$inferSelect;
export type InsertConsensusExplanation = typeof consensusExplanations.$inferInsert;

// Strength of Schedule (SOS) Tables
export const defenseVP = pgTable("defense_dvp", {
  id: serial("id").primaryKey(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  defTeam: text("def_team").notNull(),
  position: text("position").notNull(), // 'RB','WR','QB','TE'
  fpAllowed: real("fp_allowed").notNull(), // fantasy points allowed per game
  ydsPerAtt: real("yds_per_att"), // optional for v2
  rzTdRate: real("rz_td_rate"), // optional for v2
  injAdj: real("inj_adj").default(0), // optional
  last4Avg: real("last4_avg"), // Grok's trailing 4-week average
}, (table) => ({
  uniqueDefenseWeek: unique().on(table.season, table.week, table.defTeam, table.position),
}));

export const schedule = pgTable("schedule", {
  id: serial("id").primaryKey(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  home: text("home").notNull(),
  away: text("away").notNull(),
  homeScore: integer("home_score"),
  awayScore: integer("away_score"),
  result: integer("result"), // positive = home win, negative = away win, 0 = tie
}, (table) => ({
  uniqueGame: unique().on(table.season, table.week, table.home, table.away),
}));

export const sosScores = pgTable("sos_scores", {
  id: serial("id").primaryKey(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  team: text("team").notNull(), // offense team
  opponent: text("opponent").notNull(), // defense team
  position: text("position").notNull(),
  sosScore: real("sos_score").notNull(), // 0-100 (higher = easier)
  tier: text("tier").notNull(), // 'green','yellow','red'
}, (table) => ({
  uniqueSOS: unique().on(table.season, table.week, table.team, table.position),
}));

// SOSv2 Contextual Defense Data Table
export const defenseContext = pgTable("defense_context", {
  id: serial("id").primaryKey(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  defTeam: text("def_team").notNull(),
  epaPerPlayAllowed: real("epa_per_play_allowed"),
  playsAllowedPerGame: real("plays_allowed_per_game"),
  rzTdRateAllowed: real("rz_td_rate_allowed"),
  homeDefAdj: real("home_def_adj"),
  awayDefAdj: real("away_def_adj"),
}, (table) => ({
  uniqueDefenseContext: unique().on(table.season, table.week, table.defTeam),
}));

// User Customizable SOS Dashboard Tables
export const sosDashboards = pgTable("sos_dashboards", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(), // Session-based or auth user ID
  name: text("name").notNull(), // "My RB Dashboard", "Week 1 Analysis"
  isDefault: boolean("is_default").default(false),
  config: jsonb("config").notNull(), // Dashboard configuration JSON
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueUserDashboard: unique().on(table.userId, table.name),
}));

export const sosWidgets = pgTable("sos_widgets", {
  id: serial("id").primaryKey(),
  dashboardId: integer("dashboard_id").references(() => sosDashboards.id, { onDelete: 'cascade' }),
  widgetType: text("widget_type").notNull(), // 'weekly', 'ros', 'chart', 'filter'
  position: jsonb("position").notNull(), // {x, y, w, h} for grid layout
  config: jsonb("config").notNull(), // Widget-specific configuration
  isVisible: boolean("is_visible").default(true),
});

export const sosUserPreferences = pgTable("sos_user_preferences", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  defaultPositions: jsonb("default_positions").default(['RB', 'WR']), // Array of preferred positions
  defaultWeekRange: jsonb("default_week_range").default({start: 1, end: 5}), // Week range for ROS
  favoriteTeams: jsonb("favorite_teams").default([]), // Array of team abbreviations
  tierThresholds: jsonb("tier_thresholds").default({green: 67, yellow: 33}), // Custom tier boundaries
  viewPreferences: jsonb("view_preferences").default({showCharts: true, showTable: true}),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ========================================
// TEAM ANALYTICS - Enhanced SOS Context Data (from screenshot_data_bank.json)
// ========================================

// Team Offensive Context - EPA, explosive plays, rushing concepts, passing efficiency
export const teamOffensiveContext = pgTable("team_offensive_context", {
  id: serial("id").primaryKey(),
  season: integer("season").notNull(),
  week: integer("week").notNull(), // Up to date through this week
  team: text("team").notNull(), // Team abbreviation
  
  // EPA metrics (screenshot #1)
  passEpa: real("pass_epa"), // Passing EPA offense
  rushEpa: real("rush_epa"), // Rushing EPA offense
  
  // Explosive plays (screenshot #2)
  explosive20Plus: integer("explosive_20_plus"), // Count of 20+ yard plays
  
  // Passing efficiency (screenshot #8)
  ypa: real("ypa"), // Yards per attempt
  cpoe: real("cpoe"), // Completion percentage over expected
  
  // Run blocking (screenshot #3)
  ybcPerAtt: real("ybc_per_att"), // Yards before contact per attempt
  
  // Rushing concepts (screenshots #4, #5, #6)
  gapRunPct: real("gap_run_pct"), // Gap concept usage %
  zoneRunPct: real("zone_run_pct"), // Zone concept usage %
  runSuccessRate: real("run_success_rate"), // Run blocking success rate %
  
  // Pass protection (screenshot #7)
  pressureRateAllowed: real("pressure_rate_allowed"), // Pressure rate allowed %
  
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => ({
  uniqueTeamWeek: unique().on(table.season, table.week, table.team),
  teamIdx: index("team_offensive_context_team_idx").on(table.team),
  seasonWeekIdx: index("team_offensive_context_season_week_idx").on(table.season, table.week),
}));

// Team Defensive Context - EPA allowed, explosive plays allowed, passing defense
export const teamDefensiveContext = pgTable("team_defensive_context", {
  id: serial("id").primaryKey(),
  season: integer("season").notNull(),
  week: integer("week").notNull(), // Up to date through this week
  team: text("team").notNull(), // Team abbreviation
  
  // EPA metrics allowed (screenshot #1)
  passEpaAllowed: real("pass_epa_allowed"), // Passing EPA allowed by defense
  rushEpaAllowed: real("rush_epa_allowed"), // Rushing EPA allowed by defense
  
  // Explosive plays allowed (screenshot #2)
  explosive20PlusAllowed: integer("explosive_20_plus_allowed"), // Count of 20+ yard plays allowed
  
  // Passing efficiency allowed (screenshot #8)
  ypaAllowed: real("ypa_allowed"), // Yards per attempt allowed
  cpoeAllowed: real("cpoe_allowed"), // Completion percentage over expected allowed
  
  // Run defense (screenshot #3)
  ybcPerAttAllowed: real("ybc_per_att_allowed"), // Yards before contact per attempt allowed
  
  // Run defense vs concepts (screenshots #4, #5, #6)
  gapRunSuccessRate: real("gap_run_success_rate"), // Success rate vs gap runs %
  zoneRunSuccessRate: real("zone_run_success_rate"), // Success rate vs zone runs %
  
  // Pass rush (screenshot #7)
  pressureRateGenerated: real("pressure_rate_generated"), // Pressure rate generated %
  
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => ({
  uniqueTeamWeek: unique().on(table.season, table.week, table.team),
  teamIdx: index("team_defensive_context_team_idx").on(table.team),
  seasonWeekIdx: index("team_defensive_context_season_week_idx").on(table.season, table.week),
}));

// Team Receiver Alignment Matchups - Fantasy points by alignment (screenshot #9)
export const teamReceiverAlignmentMatchups = pgTable("team_receiver_alignment_matchups", {
  id: serial("id").primaryKey(),
  season: integer("season").notNull(),
  week: integer("week").notNull(), // Up to date through this week
  team: text("team").notNull(), // Team abbreviation
  
  // Offensive production by alignment
  offOutsideWrFpg: real("off_outside_wr_fpg"), // Outside WR fantasy points per game
  offSlotFpg: real("off_slot_fpg"), // Slot WR fantasy points per game
  offTeFpg: real("off_te_fpg"), // TE fantasy points per game
  
  // Defensive production allowed by alignment
  defOutsideWrFpgAllowed: real("def_outside_wr_fpg_allowed"), // Outside WR FPG allowed
  defSlotFpgAllowed: real("def_slot_fpg_allowed"), // Slot WR FPG allowed
  defTeFpgAllowed: real("def_te_fpg_allowed"), // TE FPG allowed
  
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => ({
  uniqueTeamWeek: unique().on(table.season, table.week, table.team),
  teamIdx: index("team_receiver_alignment_matchups_team_idx").on(table.team),
  seasonWeekIdx: index("team_receiver_alignment_matchups_season_week_idx").on(table.season, table.week),
}));

// Team Coverage Matchups - Fantasy points per dropback by coverage type (screenshot #10)
export const teamCoverageMatchups = pgTable("team_coverage_matchups", {
  id: serial("id").primaryKey(),
  season: integer("season").notNull(),
  week: integer("week").notNull(), // Up to date through this week
  team: text("team").notNull(), // Team abbreviation
  
  // Offensive efficiency vs coverage types
  offZoneFpdb: real("off_zone_fpdb"), // FP per dropback vs zone coverage
  offManFpdb: real("off_man_fpdb"), // FP per dropback vs man coverage
  offTwoHighFpdb: real("off_two_high_fpdb"), // FP per dropback vs two-high safety
  offOneHighFpdb: real("off_one_high_fpdb"), // FP per dropback vs one-high safety
  
  // Defensive coverage usage and FP allowed
  defZonePct: real("def_zone_pct"), // Zone coverage usage %
  defManPct: real("def_man_pct"), // Man coverage usage %
  defTwoHighPct: real("def_two_high_pct"), // Two-high safety usage %
  defOneHighPct: real("def_one_high_pct"), // One-high safety usage %
  defZoneFpdbAllowed: real("def_zone_fpdb_allowed"), // FP per dropback allowed in zone
  defManFpdbAllowed: real("def_man_fpdb_allowed"), // FP per dropback allowed in man
  defTwoHighFpdbAllowed: real("def_two_high_fpdb_allowed"), // FP per dropback allowed in 2-high
  defOneHighFpdbAllowed: real("def_one_high_fpdb_allowed"), // FP per dropback allowed in 1-high
  
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => ({
  uniqueTeamWeek: unique().on(table.season, table.week, table.team),
  teamIdx: index("team_coverage_matchups_team_idx").on(table.team),
  seasonWeekIdx: index("team_coverage_matchups_season_week_idx").on(table.season, table.week),
}));

// SOS Type Exports
export type DefenseVP = typeof defenseVP.$inferSelect;
export type InsertDefenseVP = typeof defenseVP.$inferInsert;
export type Schedule = typeof schedule.$inferSelect;
export type InsertSchedule = typeof schedule.$inferInsert;
export type SOSScore = typeof sosScores.$inferSelect;
export type InsertSOSScore = typeof sosScores.$inferInsert;

// Team Analytics Type Exports
export type TeamOffensiveContext = typeof teamOffensiveContext.$inferSelect;
export type InsertTeamOffensiveContext = typeof teamOffensiveContext.$inferInsert;
export type TeamDefensiveContext = typeof teamDefensiveContext.$inferSelect;
export type InsertTeamDefensiveContext = typeof teamDefensiveContext.$inferInsert;
export type TeamReceiverAlignmentMatchups = typeof teamReceiverAlignmentMatchups.$inferSelect;
export type InsertTeamReceiverAlignmentMatchups = typeof teamReceiverAlignmentMatchups.$inferInsert;
export type TeamCoverageMatchups = typeof teamCoverageMatchups.$inferSelect;
export type InsertTeamCoverageMatchups = typeof teamCoverageMatchups.$inferInsert;

// 2024 Player Season Stats - Complete season data for leaderboards
export const playerSeason2024 = pgTable("player_season_2024", {
  id: serial("id").primaryKey(),
  playerId: text("player_id"),
  playerName: text("player_name").notNull(),
  position: text("position").notNull(),
  team: text("team"),
  games: integer("games"),
  
  // Receiving stats
  targets: integer("targets"),
  receptions: integer("receptions"), 
  recYards: integer("rec_yards"),
  recTds: integer("rec_tds"),
  routes: integer("routes"),
  yprr: real("yprr"), // Yards per route run
  adot: real("adot"), // Average depth of target
  racr: real("racr"), // Receiver air conversion ratio
  targetShare: real("target_share"),
  wopr: real("wopr"), // Weighted opportunity rating
  
  // Rushing stats
  rushAtt: integer("rush_att"),
  rushYards: integer("rush_yards"),
  rushTds: integer("rush_tds"),
  rushYpc: real("rush_ypc"), // Yards per carry
  rushYacPerAtt: real("rush_yac_per_att"),
  rushMtf: integer("rush_mtf"), // Missed tackles forced
  rushExpl10p: real("rush_expl_10p"), // Explosive run rate (10+ yards)
  
  // QB passing stats
  cmp: integer("cmp"), // Completions
  att: integer("att"), // Attempts
  cmpPct: real("cmp_pct"), // Completion percentage
  passYards: integer("pass_yards"),
  passTds: integer("pass_tds"),
  int: integer("int"), // Interceptions
  ypa: real("ypa"), // Yards per attempt
  aypa: real("aypa"), // Air yards per attempt
  epaPerPlay: real("epa_per_play"), // Expected points added per play
  
  // QB rushing stats
  qbRushYards: integer("qb_rush_yards"),
  qbRushTds: integer("qb_rush_tds"),
  
  // Fantasy points
  fpts: real("fpts"), // Standard fantasy points
  fptsPpr: real("fpts_ppr"), // PPR fantasy points
  
  // Total TDs (for RB)
  tdTotal: integer("td_total"),
  
  // Metadata
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => ({
  positionIdx: index("player_season_2024_position_idx").on(table.position),
  teamIdx: index("player_season_2024_team_idx").on(table.team),
  uniquePlayer: unique("player_season_2024_unique").on(table.playerName, table.position, table.team),
}));

export type SOSDashboard = typeof sosDashboards.$inferSelect;
export type InsertSOSDashboard = typeof sosDashboards.$inferInsert;
export type SOSWidget = typeof sosWidgets.$inferSelect;
export type InsertSOSWidget = typeof sosWidgets.$inferInsert;
export type SOSUserPreferences = typeof sosUserPreferences.$inferSelect;
export type InsertSOSUserPreferences = typeof sosUserPreferences.$inferInsert;

export const playerAdvanced2024 = pgTable("player_advanced_2024", {
  id: serial("id").primaryKey(),
  playerId: text("player_id"),
  playerName: text("player_name"),
  team: text("team"),
  position: text("position"),
  games: smallint("games"),
  
  // WR/TE advanced metrics
  adot: real("adot"), // Average depth of target
  yprr: real("yprr"), // Yards per route run (null in v1.5)
  racr: real("racr"), // Receiver air conversion ratio
  targetShare: real("target_share"), // Target share
  wopr: real("wopr"), // Weighted opportunity rating
  
  // RB advanced metrics
  rushExpl10p: real("rush_expl_10p"), // Explosive rush percentage (10+ yards)
  
  // QB advanced metrics  
  aypa: real("aypa"), // Adjusted yards per attempt
  epaPerPlay: real("epa_per_play") // EPA per play
}, (table) => ({
  playerIdIdx: index("player_advanced_2024_player_id_idx").on(table.playerId),
  positionIdx: index("player_advanced_2024_position_idx").on(table.position),
}));

// 2024 Player Season Types
export type PlayerSeason2024 = typeof playerSeason2024.$inferSelect;
export type InsertPlayerSeason2024 = typeof playerSeason2024.$inferInsert;
export type PlayerAdvanced2024 = typeof playerAdvanced2024.$inferSelect;
export type InsertPlayerAdvanced2024 = typeof playerAdvanced2024.$inferInsert;

// Tiber Memory System - Knowledge base for storing learned insights
export const tiberMemory = pgTable("tiber_memory", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(), // e.g., "draft_analysis", "player_eval", "market_trends"
  title: text("title").notNull(),
  content: text("content").notNull(), // Main knowledge content
  insights: jsonb("insights").default('[]'), // Key insights as JSON array
  tags: text("tags").array().default([]), // Searchable tags
  source: text("source"), // Where this knowledge came from
  confidence: real("confidence").default(0.8), // How confident Tiber is in this knowledge
  lastAccessed: timestamp("last_accessed"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});

export const insertTiberMemorySchema = createInsertSchema(tiberMemory).omit({ id: true, createdAt: true, updatedAt: true });
export type TiberMemory = typeof tiberMemory.$inferSelect;
export type InsertTiberMemory = z.infer<typeof insertTiberMemorySchema>;

// ========================================
// TIBER CONVERSATION MEMORY SYSTEM v0.1
// ========================================

// Tiber Conversations - Conversation threads
// Mode separates FANTASY (ForgeContext-based) vs GENERAL (philosophical) conversations
export const tiberConversations = pgTable("tiber_conversations", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  leagueId: text("league_id"),
  title: text("title"),
  mode: text("mode").notNull().default("GENERAL"), // 'FANTASY' | 'GENERAL'
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Tiber Messages - Messages within conversations  
export const tiberMessages = pgTable("tiber_messages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => tiberConversations.id, { onDelete: "cascade" }),
  sender: text("sender").notNull(), // 'USER' or 'TIBER'
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Tiber Memory Snapshots - Scoped memory summaries
export const tiberMemorySnapshots = pgTable("tiber_memory_snapshots", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id").notNull(),
  leagueId: text("league_id"),
  scope: text("scope").notNull(), // 'GLOBAL' | 'LEAGUE' | 'SESSION'
  summary: text("summary"),
  factsJson: jsonb("facts_json"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Tiber Conversation Relations
export const tiberMessagesRelations = relations(tiberMessages, ({ one }) => ({
  conversation: one(tiberConversations, {
    fields: [tiberMessages.conversationId],
    references: [tiberConversations.id],
  }),
}));

export const tiberConversationsRelations = relations(tiberConversations, ({ many }) => ({
  messages: many(tiberMessages),
}));

// Types for Tiber Conversation System
export type TiberConversation = typeof tiberConversations.$inferSelect;
export type InsertTiberConversation = typeof tiberConversations.$inferInsert;
export type TiberMessage = typeof tiberMessages.$inferSelect;
export type InsertTiberMessage = typeof tiberMessages.$inferInsert;
export type TiberMemorySnapshot = typeof tiberMemorySnapshots.$inferSelect;
export type InsertTiberMemorySnapshot = typeof tiberMemorySnapshots.$inferInsert;

// ========================================
// ROOKIE RISERS SYSTEM TABLES
// ========================================

// Rookie Weekly Usage Table - Raw usage signals for waiver heat calculation
export const rookieWeeklyUsage = pgTable("rookie_weekly_usage", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").references(() => players.id).notNull(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  snapPct: real("snap_pct"), // Offensive snap percentage
  routes: integer("routes"), // Routes run (WR/TE)
  targets: integer("targets"), // Targets (WR/TE)
  carries: integer("carries"), // Carries (RB)
  touches: integer("touches"), // Total touches (carries + targets)
  rzTargets: integer("rz_targets"), // Red zone targets
  rzCarries: integer("rz_carries"), // Red zone carries
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Grok's performance indices
  seasonWeekIdx: index("rookie_usage_season_week_idx").on(table.season, table.week),
  playerSeasonIdx: index("rookie_usage_player_season_idx").on(table.playerId, table.season),
  uniquePlayerWeek: unique("rookie_usage_unique").on(table.playerId, table.season, table.week),
}));

// Rookie Context Signals Table - Market and situational context
export const rookieContextSignals = pgTable("rookie_context_signals", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").references(() => players.id).notNull(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  injuryOpening: boolean("injury_opening").default(false), // Team injury opens opportunity
  depthChartRank: integer("depth_chart_rank"), // Position on depth chart (1=starter)
  newsWeight: real("news_weight"), // 0-1 coach quotes/beat reports strength
  marketRostership: real("market_rostership"), // 0-1 rostership percentage
  marketStartPct: real("market_start_pct"), // 0-1 start percentage  
  adpDelta: real("adp_delta"), // ADP movement (negative = market lag)
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  seasonWeekIdx: index("context_season_week_idx").on(table.season, table.week),
  playerSeasonIdx: index("context_player_season_idx").on(table.playerId, table.season),
  uniquePlayerWeek: unique("context_unique").on(table.playerId, table.season, table.week),
}));

// Rookie Risers Snapshots - Weekly official Waiver Heat records (Hybrid Model backbone)
export const rookieRiserSnapshots = pgTable("rookie_riser_snapshots", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").references(() => players.id).notNull(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  usageGrowth: real("usage_growth"), // 0-1 normalized usage growth score
  opportunityDelta: real("opportunity_delta"), // 0-1 opportunity from injuries/depth
  marketLag: real("market_lag"), // 0-1 market inefficiency score
  newsWeight: real("news_weight"), // 0-1 beat reports/coach quotes
  waiverHeat: integer("waiver_heat"), // 0-100 final Waiver Heat Index
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Grok's recommended indices for performance
  createdAtIdx: index("snapshots_created_at_idx").on(table.createdAt),
  seasonWeekIdx: index("snapshots_season_week_idx").on(table.season, table.week),
  heatIdx: index("snapshots_heat_idx").on(table.waiverHeat),
  uniquePlayerWeek: unique("snapshots_unique").on(table.playerId, table.season, table.week),
}));

// Rookie Risers Types
export type RookieWeeklyUsage = typeof rookieWeeklyUsage.$inferSelect;
export type InsertRookieWeeklyUsage = typeof rookieWeeklyUsage.$inferInsert;
export type RookieContextSignals = typeof rookieContextSignals.$inferSelect;
export type InsertRookieContextSignals = typeof rookieContextSignals.$inferInsert;
export type RookieRiserSnapshots = typeof rookieRiserSnapshots.$inferSelect;
export type InsertRookieRiserSnapshots = typeof rookieRiserSnapshots.$inferInsert;

// Rookie Risers Insert Schemas
export const insertRookieWeeklyUsageSchema = createInsertSchema(rookieWeeklyUsage).omit({ id: true, createdAt: true });
export const insertRookieContextSignalsSchema = createInsertSchema(rookieContextSignals).omit({ id: true, createdAt: true });
export const insertRookieRiserSnapshotsSchema = createInsertSchema(rookieRiserSnapshots).omit({ id: true, createdAt: true });

// ========================================
// ADVANCED SIGNALS TABLE (GROK'S ENHANCEMENT)
// ========================================

// Advanced Signals table - Captures derived metrics like efficiency, trends for better signal detection
// Enables multi-faceted reasoning for rankings, like chaining efficiency to projected TDs
export const advancedSignals = pgTable("advanced_signals", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull(), // FK to players.id (using text to match existing pattern)
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  
  // Efficiency metrics (Grok's recommendations)
  ypc: real("ypc"), // Yards per carry
  snapShare: real("snap_share"), // Float 0-1 (percentage of team snaps)
  epaRush: real("epa_rush"), // Expected points added per rush
  brokenTackles: integer("broken_tackles"), // Broken tackles count
  redzoneTouches: integer("redzone_touches"), // Red zone touches
  
  // Trend analysis (3-week rolling context)
  trendMultiplier: real("trend_multiplier"), // Weighted 3-week avg performance (e.g., 1.2 = 20% above baseline)
  rollingAvg3wk: jsonb("rolling_avg_3wk"), // JSONB for flexible rolling averages (yards, TDs, etc.)
  opponentAdjustedScore: real("opponent_adjusted_score"), // Matchup-adjusted performance factoring run defense
  
  // Advanced metrics for WR/TE/QB
  targetShare: real("target_share"), // WR/TE target share within team
  airyards: real("air_yards"), // Average depth of target (aDOT)
  separationScore: real("separation_score"), // Receiver separation (if available from NextGen)
  pressureRate: real("pressure_rate"), // QB pressure faced percentage
  
  // Market/Usage context
  usageSpike: boolean("usage_spike").default(false), // Weekly usage anomaly flag
  injuryOpportunity: boolean("injury_opportunity").default(false), // Benefiting from teammate injury
  
  // Metadata
  dataSource: text("data_source").default('computed'), // 'nfl-data-py', 'sleeper', 'computed', 'nextgen'
  confidence: real("confidence").default(0.8), // Data quality confidence 0-1
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => ({
  // Composite unique constraint to prevent duplicates
  unique: unique("advanced_signals_unique").on(table.playerId, table.season, table.week),
  // Indexes for efficient queries (Grok's performance optimization)
  playerSeasonIdx: index("advanced_signals_player_season_idx").on(table.playerId, table.season),
  weekIdx: index("advanced_signals_week_idx").on(table.week),
  trendIdx: index("advanced_signals_trend_idx").on(table.trendMultiplier),
}));

export const advancedSignalsRelations = relations(advancedSignals, ({ one }) => ({
  player: one(players, {
    fields: [advancedSignals.playerId],
    references: [players.id]
  })
}));

// Advanced Signals Types
export type AdvancedSignals = typeof advancedSignals.$inferSelect;
export type InsertAdvancedSignals = typeof advancedSignals.$inferInsert;
export const insertAdvancedSignalsSchema = createInsertSchema(advancedSignals).omit({ id: true, lastUpdated: true });

// ========================================
// BRAND SIGNALS BRAIN - INTELLIGENCE STORAGE
// ========================================

// Brand Signals table - Centralized storage for all brand-specific intelligence signals
// Generated by the BrandBus event system and plugin architecture
export const brandSignals = pgTable("brand_signals", {
  id: serial("id").primaryKey(),
  brand: brandEnum("brand").notNull(), // Which brand generated this signal
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  playerId: text("player_id").notNull(), // FK to player identity
  signalKey: text("signal_key").notNull(), // Signal identifier (e.g., 'rookie_riser_score', 'buy_sell_rating')
  signalValue: real("signal_value").notNull(), // Normalized signal value (0-100 scale)
  meta: jsonb("meta"), // Signal metadata and component breakdowns
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow()
}, (table) => ({
  // Unique constraint to prevent duplicate signals
  uniqueSignal: unique("brand_signals_unique").on(table.brand, table.season, table.week, table.playerId, table.signalKey),
  
  // Performance indexes for signal queries
  brandSeasonWeekIdx: index("brand_signals_brand_season_week_idx").on(table.brand, table.season, table.week),
  playerBrandIdx: index("brand_signals_player_brand_idx").on(table.playerId, table.brand),
  signalKeyIdx: index("brand_signals_key_idx").on(table.signalKey),
  signalValueIdx: index("brand_signals_value_idx").on(table.signalValue),
  createdAtIdx: index("brand_signals_created_at_idx").on(table.createdAt),
  
  // Composite indexes for common query patterns
  playerSeasonBrandIdx: index("brand_signals_player_season_brand_idx").on(table.playerId, table.season, table.brand),
  brandSignalValueIdx: index("brand_signals_brand_signal_value_idx").on(table.brand, table.signalKey, table.signalValue)
}));

// Brand Signals Relations
export const brandSignalsRelations = relations(brandSignals, ({ one }) => ({
  player: one(playerIdentityMap, {
    fields: [brandSignals.playerId],
    references: [playerIdentityMap.canonicalId],
  }),
}));

// Brand Signals Types and Insert Schemas
export type BrandSignals = typeof brandSignals.$inferSelect;
export type InsertBrandSignals = z.infer<typeof insertBrandSignalsSchema>;
export const insertBrandSignalsSchema = createInsertSchema(brandSignals).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

// ========================================
// BUYS/SELLS TRADE ADVICE MODEL TABLES
// ========================================

// Player Week Facts - Weekly player statistics and advanced metrics for trade advice calculations
export const playerWeekFacts = pgTable("player_week_facts", {
  playerId: text("player_id").notNull(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  position: text("position").notNull(),
  
  // Core power ranking columns that exist in the database
  usageNow: real("usage_now").notNull().default(0),
  talent: real("talent").notNull().default(0),
  environment: real("environment").notNull().default(0),
  availability: real("availability").notNull().default(0),
  marketAnchor: real("market_anchor").notNull().default(0),
  powerScore: real("power_score").notNull().default(0),
  confidence: real("confidence").notNull().default(0.5),
  flags: text("flags").array().notNull().default([]),
  lastUpdate: timestamp("last_update").notNull().defaultNow(),
  
  // Core ranking stats (TODO: Add these columns to database if needed)
  // tiberRank: integer("tiber_rank"),
  // ecrRank: integer("ecr_rank"),
  
  // New columns for trade advice model
  adpRank: integer("adp_rank"),
  snapShare: real("snap_share"),
  routesPerGame: real("routes_per_game"),
  targetsPerGame: real("targets_per_game"),
  rzTouches: real("rz_touches"),
  epaPerPlay: real("epa_per_play"),
  yprr: real("yprr"),
  yacPerAtt: real("yac_per_att"),
  mtfPerTouch: real("mtf_per_touch"),
  teamProe: real("team_proe"),
  paceRankPercentile: real("pace_rank_percentile"), // 0..100
  olTier: integer("ol_tier"),
  sosNext2: real("sos_next2"),
  injuryPracticeScore: real("injury_practice_score"), // 0..1
  committeeIndex: real("committee_index"), // 0..1
  coachVolatility: real("coach_volatility"), // 0..1
  ecr7dDelta: integer("ecr_7d_delta"),
  byeWeek: boolean("bye_week").default(false), // For redraft downgrade
  rostered7dDelta: real("rostered_7d_delta").default(0), // % change
  started7dDelta: real("started_7d_delta").default(0), // % change
}, (table) => ({
  // Primary key constraint using composite key
  primaryKey: primaryKey({ columns: [table.playerId, table.season, table.week] }),
  // Indexes for performance
  seasonWeekPosIdx: index("pwf_season_week_pos_idx").on(table.season, table.week, table.position),
  playerSeasonIdx: index("pwf_player_season_idx").on(table.playerId, table.season),
}));

// ========================================
// NFLFASTR 2025 DATA TABLES
// ========================================

// Bronze Layer: NFLfastR Play-by-Play Data
export const bronzeNflfastrPlays = pgTable("bronze_nflfastr_plays", {
  id: serial("id").primaryKey(),
  playId: varchar("play_id", { length: 100 }).notNull(),
  gameId: varchar("game_id", { length: 50 }).notNull(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  posteam: varchar("posteam", { length: 10 }),
  defteam: varchar("defteam", { length: 10 }),
  playType: varchar("play_type", { length: 50 }),
  
  passerPlayerId: varchar("passer_player_id", { length: 50 }),
  passerPlayerName: varchar("passer_player_name", { length: 100 }),
  receiverPlayerId: varchar("receiver_player_id", { length: 50 }),
  receiverPlayerName: varchar("receiver_player_name", { length: 100 }),
  rusherPlayerId: varchar("rusher_player_id", { length: 50 }),
  rusherPlayerName: varchar("rusher_player_name", { length: 100 }),
  
  epa: real("epa"),
  wpa: real("wpa"),
  airYards: integer("air_yards"),
  yardsAfterCatch: integer("yards_after_catch"),
  yardsGained: integer("yards_gained"),
  
  completePass: boolean("complete_pass").default(false),
  incompletePass: boolean("incomplete_pass").default(false),
  interception: boolean("interception").default(false),
  touchdown: boolean("touchdown").default(false),
  
  firstDown: boolean("first_down").default(false),
  firstDownRush: boolean("first_down_rush").default(false),
  firstDownPass: boolean("first_down_pass").default(false),
  
  rawData: jsonb("raw_data"),
  
  importedAt: timestamp("imported_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  gamePlayUniqueIdx: unique("bronze_nflfastr_game_play_unique").on(table.gameId, table.playId),
  seasonWeekIdx: index("bronze_nflfastr_season_week_idx").on(table.season, table.week),
  passerIdx: index("bronze_nflfastr_passer_idx").on(table.passerPlayerId),
  receiverIdx: index("bronze_nflfastr_receiver_idx").on(table.receiverPlayerId),
  rusherIdx: index("bronze_nflfastr_rusher_idx").on(table.rusherPlayerId),
  playTypeIdx: index("bronze_nflfastr_play_type_idx").on(table.playType),
}));

// Bronze Layer: NFLfastR Snap Counts (Real 2025 Data)
export const bronzeNflfastrSnapCounts = pgTable("bronze_nflfastr_snap_counts", {
  id: serial("id").primaryKey(),
  gameId: varchar("game_id", { length: 50 }).notNull(),
  pfrGameId: varchar("pfr_game_id", { length: 50 }),
  season: integer("season").notNull(),
  gameType: varchar("game_type", { length: 20 }),
  week: integer("week").notNull(),
  
  player: varchar("player", { length: 100 }).notNull(),
  pfrPlayerId: varchar("pfr_player_id", { length: 50 }),
  position: varchar("position", { length: 10 }),
  team: varchar("team", { length: 10 }),
  opponent: varchar("opponent", { length: 10 }),
  
  offenseSnaps: integer("offense_snaps"),
  offensePct: real("offense_pct"),
  defenseSnaps: integer("defense_snaps"),
  defensePct: real("defense_pct"),
  stSnaps: integer("st_snaps"),
  stPct: real("st_pct"),
  
  importedAt: timestamp("imported_at").defaultNow(),
}, (table) => ({
  gamePlayerUniqueIdx: unique("bronze_snap_counts_game_player_unique").on(table.gameId, table.player),
  seasonWeekIdx: index("bronze_snap_counts_season_week_idx").on(table.season, table.week),
  playerIdx: index("bronze_snap_counts_player_idx").on(table.player),
  positionIdx: index("bronze_snap_counts_position_idx").on(table.position),
  pfrPlayerIdx: index("bronze_snap_counts_pfr_player_idx").on(table.pfrPlayerId),
}));

// Silver Layer: Aggregated Weekly Player Stats
export const silverPlayerWeeklyStats = pgTable("silver_player_weekly_stats", {
  id: serial("id").primaryKey(),
  playerId: varchar("player_id", { length: 50 }).notNull(),
  playerName: varchar("player_name", { length: 100 }).notNull(),
  position: varchar("position", { length: 10 }),
  team: varchar("team", { length: 10 }),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  
  passAttempts: integer("pass_attempts").default(0),
  completions: integer("completions").default(0),
  passingYards: integer("passing_yards").default(0),
  passingTds: integer("passing_tds").default(0),
  interceptions: integer("interceptions").default(0),
  passingEpa: real("passing_epa"),
  
  targets: integer("targets").default(0),
  receptions: integer("receptions").default(0),
  receivingYards: integer("receiving_yards").default(0),
  receivingTds: integer("receiving_tds").default(0),
  receivingEpa: real("receiving_epa"),
  airYards: integer("air_yards").default(0),
  yac: integer("yac").default(0),
  
  rushAttempts: integer("rush_attempts").default(0),
  rushingYards: integer("rushing_yards").default(0),
  rushingTds: integer("rushing_tds").default(0),
  rushingEpa: real("rushing_epa"),
  
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniquePlayerWeek: unique("silver_player_weekly_stats_unique").on(table.playerId, table.season, table.week),
  playerIdx: index("silver_weekly_stats_player_idx").on(table.playerId),
  seasonWeekIdx: index("silver_weekly_stats_season_week_idx").on(table.season, table.week),
}));

// Defense vs Position Stats - Fantasy matchup analysis
export const defenseVsPositionStats = pgTable("defense_vs_position_stats", {
  id: serial("id").primaryKey(),
  defenseTeam: varchar("defense_team", { length: 10 }).notNull(),
  position: varchar("position", { length: 10 }).notNull(),
  season: integer("season").notNull(),
  week: integer("week"),
  
  playsAgainst: integer("plays_against").default(0),
  uniquePlayers: integer("unique_players").default(0),
  
  fantasyPtsPpr: real("fantasy_pts_ppr").default(0),
  fantasyPtsHalfPpr: real("fantasy_pts_half_ppr").default(0),
  fantasyPtsStandard: real("fantasy_pts_standard").default(0),
  
  avgPtsPerGamePpr: real("avg_pts_per_game_ppr"),
  avgPtsPerGameStandard: real("avg_pts_per_game_standard"),
  
  avgEpaAllowed: real("avg_epa_allowed"),
  successRateAllowed: real("success_rate_allowed"),
  touchdownsAllowed: integer("touchdowns_allowed").default(0),
  
  totalYardsAllowed: integer("total_yards_allowed").default(0),
  receptionsAllowed: integer("receptions_allowed").default(0),
  targetsAllowed: integer("targets_allowed").default(0),
  
  rankVsPosition: integer("rank_vs_position"),
  dvpRating: varchar("dvp_rating", { length: 20 }),
  
  updatedAt: timestamp("updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueDefensePositionWeek: unique("dvp_unique").on(table.defenseTeam, table.position, table.season, table.week),
  defenseIdx: index("dvp_defense_idx").on(table.defenseTeam),
  positionIdx: index("dvp_position_idx").on(table.position),
  seasonWeekIdx: index("dvp_season_week_idx").on(table.season, table.week),
  rankIdx: index("dvp_rank_idx").on(table.rankVsPosition),
  ratingIdx: index("dvp_rating_idx").on(table.dvpRating),
}));

// ========================================
// TIBER - TACTICAL INDEX FOR BREAKOUT EFFICIENCY AND REGRESSION
// ========================================

// TIBER Scores - Player volatility and regression analysis
export const tiberScores = pgTable("tiber_scores", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").references(() => players.id),
  nflfastrId: text("nflfastr_id").notNull(), // NFLfastR player ID (e.g., "00-0036322")
  week: integer("week").notNull(),
  season: integer("season").notNull(),
  
  // Core Score (0-100)
  tiberScore: integer("tiber_score").notNull(),
  tier: tiberTierEnum("tier").notNull(),
  
  // Component Scores (for transparency/breakdown)
  firstDownScore: integer("first_down_score").notNull(),
  epaScore: integer("epa_score").notNull(),
  usageScore: integer("usage_score").notNull(),
  tdScore: integer("td_score").notNull(),
  teamScore: integer("team_score").notNull(),
  
  // Supporting Metrics
  firstDownRate: real("first_down_rate"),
  totalFirstDowns: integer("total_first_downs"),
  epaPerPlay: real("epa_per_play"),
  snapPercentAvg: real("snap_percent_avg"),
  snapPercentTrend: tiberTrendEnum("snap_percent_trend"),
  tdRate: real("td_rate"),
  teamOffenseRank: integer("team_offense_rank"),
  
  // Metadata
  calculatedAt: timestamp("calculated_at").defaultNow(),
}, (table) => ({
  uniquePlayerWeek: unique("tiber_unique").on(table.nflfastrId, table.week, table.season),
  nflfastrIdIdx: index("tiber_nflfastr_idx").on(table.nflfastrId),
  weekIdx: index("tiber_week_idx").on(table.week, table.season),
  tierIdx: index("tiber_tier_idx").on(table.tier),
  scoreIdx: index("tiber_score_idx").on(table.tiberScore),
}));

// TIBER Season Ratings - Rolling averages of weekly scores
export const tiberSeasonRatings = pgTable("tiber_season_ratings", {
  id: serial("id").primaryKey(),
  nflfastrId: text("nflfastr_id").notNull(),
  season: integer("season").notNull(),
  
  // Season Average Score (0-100)
  seasonAverage: real("season_average").notNull(),
  weeksIncluded: integer("weeks_included").notNull(),
  
  // Tier based on season average
  seasonTier: tiberTierEnum("season_tier").notNull(),
  
  // Trend analysis
  trend: tiberTrendEnum("trend").notNull(), // Is average rising, stable, or falling?
  lastWeekScore: integer("last_week_score"), // Most recent week's score
  lastWeek: integer("last_week"), // Most recent week calculated
  
  // Volatility metrics
  scoreStdDev: real("score_std_dev"), // How consistent are they?
  highestWeekScore: integer("highest_week_score"),
  lowestWeekScore: integer("lowest_week_score"),
  
  // Metadata
  calculatedAt: timestamp("calculated_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniquePlayerSeason: unique("tiber_season_unique").on(table.nflfastrId, table.season),
  nflfastrIdIdx: index("tiber_season_nflfastr_idx").on(table.nflfastrId),
  seasonIdx: index("tiber_season_season_idx").on(table.season),
  avgScoreIdx: index("tiber_season_avg_idx").on(table.seasonAverage),
}));

// ========================================
// PLAYER ATTRIBUTES - WEEKLY ATTRIBUTE SYSTEM
// ========================================

// Player Attributes - Weekly granular stats from multiple sources for Madden-style scoring
export const playerAttributes = pgTable("player_attributes", {
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  otcId: text("otc_id").notNull(),
  team: text("team").notNull(),
  position: text("position").notNull(),
  
  // Player identification  
  playerName: text("player_name"),
  nflId: text("nfl_id"),
  sleeperId: text("sleeper_id"),

  // Rushing stats
  carries: integer("carries"),
  rushingYards: integer("rushing_yards"),
  rushingTds: integer("rushing_tds"),

  // Receiving stats
  targets: integer("targets"),
  receptions: integer("receptions"),
  receivingYards: integer("receiving_yards"),
  receivingTds: integer("receiving_tds"),

  // Fantasy points
  fantasyPtsHalfppr: real("fantasy_pts_halfppr"),
  fantasyPtsPpr: real("fantasy_pts_ppr"),
  fantasyPtsStandard: real("fantasy_pts_standard"),

  // Advanced metrics
  airYards: integer("air_yards"),
  yac: integer("yac"),
  aDOT: real("adot"),
  epaTotal: real("epa_total"),
  epaPerPlay: real("epa_per_play"),

  // Context/Environment
  opposingTeam: text("opposing_team"),
  opponentDefRank: real("opponent_def_rank"),
  gamePace: real("game_pace"),
  impliedTotal: real("implied_total"),
  depthPosition: text("depth_position"),
  snapPercentage: real("snap_percentage"),
  targetShare: real("target_share"),
  teamPlays: integer("team_plays"),
  injuryStatus: text("injury_status"),
  questionable: boolean("questionable"),

  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Primary key: season, week, otcId
  primaryKey: primaryKey({ columns: [table.season, table.week, table.otcId] }),
  
  // Performance indexes
  seasonWeekIdx: index("player_attributes_season_week_idx").on(table.season, table.week),
  otcIdSeasonIdx: index("player_attributes_otc_id_season_idx").on(table.otcId, table.season),
  positionIdx: index("player_attributes_position_idx").on(table.position),
  teamIdx: index("player_attributes_team_idx").on(table.team),
  
  // Query optimization indexes
  positionSeasonWeekIdx: index("player_attributes_pos_season_week_idx").on(table.position, table.season, table.week),
  teamSeasonWeekIdx: index("player_attributes_team_season_week_idx").on(table.team, table.season, table.week),
}));

// Player Attributes Relations
export const playerAttributesRelations = relations(playerAttributes, ({ one }) => ({
  player: one(playerIdentityMap, {
    fields: [playerAttributes.otcId],
    references: [playerIdentityMap.canonicalId],
  }),
}));

// Player Attributes Types and Schemas
export type PlayerAttributes = typeof playerAttributes.$inferSelect;
export type InsertPlayerAttributes = z.infer<typeof insertPlayerAttributesSchema>;
export const insertPlayerAttributesSchema = createInsertSchema(playerAttributes).omit({ 
  createdAt: true, 
  updatedAt: true 
});

// Buys/Sells Trade Advice - Weekly trade recommendations with supporting data
export const buysSells = pgTable("buys_sells", {
  playerId: text("player_id").notNull(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  position: text("position").notNull(),
  verdict: verdictEnum("verdict").notNull(), // BUY_HARD | BUY | WATCH_BUY | HOLD | WATCH_SELL | SELL | SELL_HARD
  verdictScore: real("verdict_score").notNull(),
  confidence: real("confidence").notNull(), // 0..1
  gapZ: real("gap_z").notNull(),
  signal: real("signal").notNull(),
  marketMomentum: real("market_momentum").notNull(),
  riskPenalty: real("risk_penalty").notNull(),
  format: formatEnum("format").notNull(), // redraft | dynasty
  ppr: pprEnum("ppr").notNull(), // ppr | half | standard
  proof: jsonb("proof").notNull(), // Metrics cited
  explanation: text("explanation").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  hitRate: real("hit_rate"), // Backtest metric
}, (table) => ({
  // Primary key constraint
  primaryKey: primaryKey({ columns: [table.playerId, table.season, table.week, table.format, table.ppr] }),
  // Index for filtering
  weekFiltersIdx: index("bs_week_filters_idx").on(table.season, table.week, table.position, table.format, table.ppr),
}));

// Player Week Facts Relations
export const playerWeekFactsRelations = relations(playerWeekFacts, ({ one }) => ({
  player: one(players, {
    fields: [playerWeekFacts.playerId],
    references: [players.sleeperId]
  })
}));

// Buys/Sells Relations
export const buysSellsRelations = relations(buysSells, ({ one }) => ({
  player: one(players, {
    fields: [buysSells.playerId],
    references: [players.sleeperId]
  })
}));

// Insert Schemas
export const insertPlayerWeekFactsSchema = createInsertSchema(playerWeekFacts).omit({
  lastUpdate: true,
});

export const insertBuysSellsSchema = createInsertSchema(buysSells).omit({
  createdAt: true,
});

// ========================================
// ADVANCED ANALYTICS - PHASE 1 FEATURES
// ========================================

// Win-Probability Context - Weekly WP/WPA splits for clutch performance analysis
export const wpSplitsWeekly = pgTable("wp_splits_weekly", {
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  playerId: text("player_id").notNull(),
  
  // Core WP metrics
  plays: integer("plays").notNull().default(0),
  wpAvg: real("wp_avg"), // Average win probability when on field
  wpaSum: real("wpa_sum"), // Total win probability added
  
  // High-leverage situations
  highLeveragePlays: integer("high_leverage_plays").default(0), // WP ∈ [0.25, 0.75]
  q4OneScorePlays: integer("q4_one_score_plays").default(0), // 4Q plays within 1 score
  q4OneScoreEpa: real("q4_one_score_epa"), // EPA in clutch moments
  
  // Garbage time filter
  kneelOutPlays: integer("kneel_out_plays").default(0), // Excluded from meaningful stats
  
  // Metadata
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => ({
  primaryKey: primaryKey({ columns: [table.season, table.week, table.playerId] }),
  seasonWeekIdx: index("wp_splits_season_week_idx").on(table.season, table.week),
  playerSeasonIdx: index("wp_splits_player_season_idx").on(table.playerId, table.season),
}));

// WP Splits Insert Schema & Types
export type WpSplitsWeekly = typeof wpSplitsWeekly.$inferSelect;
export type InsertWpSplitsWeekly = z.infer<typeof insertWpSplitsWeeklySchema>;
export const insertWpSplitsWeeklySchema = createInsertSchema(wpSplitsWeekly).omit({
  lastUpdated: true,
});

// ========================================
// GOLD LAYER - ANALYTICS-READY FACTS
// ========================================

// Enhanced Player Season Facts - Season-level aggregated analytics
export const playerSeasonFacts = pgTable("player_season_facts", {
  canonicalPlayerId: text("canonical_player_id").notNull().references(() => playerIdentityMap.canonicalId),
  season: integer("season").notNull(),
  position: text("position").notNull(),
  nflTeam: text("nfl_team").notNull().references(() => nflTeamsDim.teamCode),
  
  // Core stats
  gamesPlayed: integer("games_played").notNull().default(0),
  gamesStarted: integer("games_started").notNull().default(0),
  snapCount: real("snap_count").notNull().default(0),
  snapShare: real("snap_share").notNull().default(0),
  
  // Fantasy production
  fantasyPoints: real("fantasy_points").notNull().default(0),
  fantasyPointsPpr: real("fantasy_points_ppr").notNull().default(0),
  fantasyPointsHalfPpr: real("fantasy_points_half_ppr").notNull().default(0),
  
  // Position-specific stats
  passingYards: integer("passing_yards").default(0),
  passingTds: integer("passing_tds").default(0),
  interceptions: integer("interceptions").default(0),
  rushingYards: integer("rushing_yards").default(0),
  rushingTds: integer("rushing_tds").default(0),
  receivingYards: integer("receiving_yards").default(0),
  receivingTds: integer("receiving_tds").default(0),
  receptions: integer("receptions").default(0),
  targets: integer("targets").default(0),
  
  // Advanced metrics
  targetShare: real("target_share").default(0),
  airYards: real("air_yards").default(0),
  yac: real("yac").default(0),
  redZoneTargets: real("red_zone_targets").default(0),
  redZoneCarries: real("red_zone_carries").default(0),
  
  // Market data
  avgAdp: real("avg_adp"),
  ecrRank: integer("ecr_rank"),
  avgOwnership: real("avg_ownership"),
  avgStartPct: real("avg_start_pct"),
  
  // Data lineage and quality
  sourceMask: integer("source_mask").notNull().default(0), // Bitmask of data sources
  freshnessScore: real("freshness_score").notNull().default(0), // 0-1 score
  qualityGatesPassed: boolean("quality_gates_passed").notNull().default(false),
  completenessScore: real("completeness_score").notNull().default(0), // 0-1 score
  lastRefreshed: timestamp("last_refreshed").notNull().defaultNow(),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Primary key
  primaryKey: primaryKey({ columns: [table.canonicalPlayerId, table.season] }),
  // Indexes
  seasonPositionIdx: index("psf_season_position_idx").on(table.season, table.position),
  teamSeasonIdx: index("psf_team_season_idx").on(table.nflTeam, table.season),
  qualityIdx: index("psf_quality_idx").on(table.qualityGatesPassed),
  freshnessIdx: index("psf_freshness_idx").on(table.freshnessScore),
}));

// Market Rollups - Aggregated market trend analysis
export const marketRollups = pgTable("market_rollups", {
  id: serial("id").primaryKey(),
  canonicalPlayerId: text("canonical_player_id").notNull().references(() => playerIdentityMap.canonicalId),
  
  // Time period
  season: integer("season").notNull(),
  week: integer("week"), // NULL for season rollups
  rollupType: text("rollup_type").notNull(), // "weekly", "monthly", "season"
  
  // Market metrics
  adpTrend: real("adp_trend"), // Week over week change
  ecrTrend: real("ecr_trend"), // Week over week change
  ownershipTrend: real("ownership_trend"), // Week over week change
  startPctTrend: real("start_pct_trend"), // Week over week change
  
  // Consensus metrics
  adpConsensus: real("adp_consensus"), // Average across sources
  adpStdDev: real("adp_std_dev"), // Standard deviation
  ecrConsensus: real("ecr_consensus"), // Average ECR rank
  ecrStdDev: real("ecr_std_dev"), // Standard deviation
  
  // Volume and reliability
  sourceCount: integer("source_count").notNull().default(0), // Number of contributing sources
  sampleSize: integer("sample_size"), // Total sample size across sources
  confidenceInterval: real("confidence_interval"), // 95% CI width
  
  // Market momentum indicators
  momentumScore: real("momentum_score"), // -1 to 1 momentum indicator
  volatilityScore: real("volatility_score"), // 0-1 volatility measure
  trendStrength: real("trend_strength"), // 0-1 trend strength
  
  // Data lineage
  sourceMask: integer("source_mask").notNull().default(0),
  freshnessScore: real("freshness_score").notNull().default(0),
  qualityGatesPassed: boolean("quality_gates_passed").notNull().default(false),
  
  // Metadata
  calculatedAt: timestamp("calculated_at").notNull().defaultNow(),
  validFrom: timestamp("valid_from").notNull(),
  validTo: timestamp("valid_to"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  playerRollupIdx: index("mr_player_rollup_idx").on(table.canonicalPlayerId, table.rollupType),
  seasonWeekIdx: index("mr_season_week_idx").on(table.season, table.week),
  validityIdx: index("mr_validity_idx").on(table.validFrom, table.validTo),
  qualityIdx: index("mr_quality_idx").on(table.qualityGatesPassed),
  uniqueRollup: unique("mr_unique_rollup").on(
    table.canonicalPlayerId,
    table.season,
    table.week,
    table.rollupType
  ),
}));

// Data Lineage Tracking - Track data flow and transformations
export const dataLineage = pgTable("data_lineage", {
  id: serial("id").primaryKey(),
  jobId: text("job_id").notNull(), // ETL job identifier
  tableName: text("table_name").notNull(), // Target table name
  operation: text("operation").notNull(), // "INSERT", "UPDATE", "DELETE", "UPSERT"
  
  // Source tracking
  sourceTable: text("source_table"), // Source table if transformation
  sourceJobId: text("source_job_id"), // Source job if derived
  ingestPayloadId: integer("ingest_payload_id").references(() => ingestPayloads.id),
  
  // Record tracking
  recordsProcessed: integer("records_processed").notNull().default(0),
  recordsSuccess: integer("records_success").notNull().default(0),
  recordsFailed: integer("records_failed").notNull().default(0),
  recordsSkipped: integer("records_skipped").notNull().default(0),
  
  // Data quality metrics
  qualityScore: real("quality_score"), // 0-1 overall quality score
  completenessScore: real("completeness_score"), // 0-1 completeness score
  freshnessScore: real("freshness_score"), // 0-1 freshness score
  
  // Execution details
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  errorMessage: text("error_message"),
  executionContext: jsonb("execution_context"), // Additional context
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  jobIdIdx: index("lineage_job_id_idx").on(table.jobId),
  tableIdx: index("lineage_table_idx").on(table.tableName),
  sourceJobIdx: index("lineage_source_job_idx").on(table.sourceJobId),
  executionIdx: index("lineage_execution_idx").on(table.startedAt, table.completedAt),
}));

// Player Market Facts - Dedicated market analytics and trends
export const playerMarketFacts = pgTable("player_market_facts", {
  id: serial("id").primaryKey(),
  canonicalPlayerId: text("canonical_player_id").notNull().references(() => playerIdentityMap.canonicalId),
  
  // Time period
  season: integer("season").notNull(),
  week: integer("week"), // NULL for season-level market facts
  
  // ADP Analytics
  avgAdp: real("avg_adp"),
  adpTrend7d: real("adp_trend_7d"), // 7-day change
  adpTrend30d: real("adp_trend_30d"), // 30-day change
  adpVolatility: real("adp_volatility"), // Standard deviation
  
  // ECR Analytics
  avgEcr: real("avg_ecr"),
  ecrTrend7d: real("ecr_trend_7d"),
  ecrTrend30d: real("ecr_trend_30d"),
  ecrConsensus: real("ecr_consensus"), // Consensus strength
  
  // Ownership Analytics
  averageOwnership: real("average_ownership"),
  ownershipTrend7d: real("ownership_trend_7d"),
  ownershipMomentum: real("ownership_momentum"), // Accelerating/decelerating
  
  // Market Sentiment
  expertBuyRating: real("expert_buy_rating"), // -1 to 1
  communityBuzzScore: real("community_buzz_score"), // 0-100
  momentumScore: real("momentum_score"), // Overall momentum
  volatilityIndex: real("volatility_index"), // Market volatility
  
  // Advanced Market Metrics
  valueOverReplacement: real("value_over_replacement"),
  positionMarketShare: real("position_market_share"),
  tierBreakoutScore: real("tier_breakout_score"), // Likelihood of tier jump
  contraryIndicator: real("contrary_indicator"), // Contrarian signal strength
  
  // Data Quality
  sourceMask: integer("source_mask").notNull().default(0),
  sampleSize: integer("sample_size").default(0),
  freshnessScore: real("freshness_score").notNull().default(0),
  qualityGatesPassed: boolean("quality_gates_passed").notNull().default(false),
  confidenceScore: real("confidence_score").notNull().default(0.5),
  
  // Metadata
  calculatedAt: timestamp("calculated_at").notNull().defaultNow(),
  validFrom: timestamp("valid_from").notNull(),
  validTo: timestamp("valid_to"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  playerSeasonIdx: index("pmf_player_season_idx").on(table.canonicalPlayerId, table.season),
  seasonWeekIdx: index("pmf_season_week_idx").on(table.season, table.week),
  qualityIdx: index("pmf_quality_idx").on(table.qualityGatesPassed),
  momentumIdx: index("pmf_momentum_idx").on(table.momentumScore),
  validityIdx: index("pmf_validity_idx").on(table.validFrom, table.validTo),
  uniqueMarketFact: unique("pmf_unique").on(
    table.canonicalPlayerId,
    table.season,
    table.week
  ),
}));

// Player Composite Facts - Cross-format unified player profiles
export const playerCompositeFacts = pgTable("player_composite_facts", {
  canonicalPlayerId: text("canonical_player_id").notNull().references(() => playerIdentityMap.canonicalId),
  season: integer("season").notNull(),
  
  // Multi-format Rankings
  dynastyRank: integer("dynasty_rank"),
  redraftRank: integer("redraft_rank"),
  bestballRank: integer("bestball_rank"),
  tradeValueRank: integer("trade_value_rank"),
  
  // Multi-format Scores
  dynastyScore: real("dynasty_score"),
  redraftScore: real("redraft_score"),
  bestballScore: real("bestball_score"),
  tradeValueScore: real("trade_value_score"),
  
  // Unified Analytics
  overallTalentGrade: real("overall_talent_grade"), // 0-100
  opportunityGrade: real("opportunity_grade"), // 0-100
  consistencyGrade: real("consistency_grade"), // 0-100
  ceilingGrade: real("ceiling_grade"), // 0-100
  floorGrade: real("floor_grade"), // 0-100
  
  // Risk Metrics
  injuryRisk: real("injury_risk"), // 0-1
  ageRisk: real("age_risk"), // 0-1
  situationRisk: real("situation_risk"), // 0-1
  overallRiskGrade: real("overall_risk_grade"), // 0-1
  
  // Trend Analysis
  momentumScore: real("momentum_score"), // -1 to 1
  trajectoryScore: real("trajectory_score"), // Long-term trend
  breakoutProbability: real("breakout_probability"), // 0-1
  bustProbability: real("bust_probability"), // 0-1
  
  // Advanced Metrics
  positionValueScore: real("position_value_score"), // Positional scarcity value
  strengthOfScheduleImpact: real("sos_impact"), // SOS impact on value
  teamContextScore: real("team_context_score"), // Team situation value
  
  // Data Lineage & Quality
  contributingFactTables: text("contributing_fact_tables").array().default([]),
  sourceMask: integer("source_mask").notNull().default(0),
  freshnessScore: real("freshness_score").notNull().default(0),
  qualityGatesPassed: boolean("quality_gates_passed").notNull().default(false),
  completenessScore: real("completeness_score").notNull().default(0),
  confidenceScore: real("confidence_score").notNull().default(0.5),
  
  // Metadata
  lastRefreshed: timestamp("last_refreshed").notNull().defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Primary key
  primaryKey: primaryKey({ columns: [table.canonicalPlayerId, table.season] }),
  // Indexes
  dynastyRankIdx: index("pcf_dynasty_rank_idx").on(table.dynastyRank),
  redraftRankIdx: index("pcf_redraft_rank_idx").on(table.redraftRank),
  momentumIdx: index("pcf_momentum_idx").on(table.momentumScore),
  qualityIdx: index("pcf_quality_idx").on(table.qualityGatesPassed),
  talentGradeIdx: index("pcf_talent_grade_idx").on(table.overallTalentGrade),
}));

// Quality Gate Results - Track quality validation results
export const qualityGateResults = pgTable("quality_gate_results", {
  id: serial("id").primaryKey(),
  jobId: text("job_id").notNull(),
  tableName: text("table_name").notNull(),
  recordIdentifier: text("record_identifier").notNull(), // e.g., "player_123_2025_1"
  
  // Gate Results
  overallPassed: boolean("overall_passed").notNull(),
  completenessCheck: boolean("completeness_check"),
  consistencyCheck: boolean("consistency_check"),
  accuracyCheck: boolean("accuracy_check"),
  freshnessCheck: boolean("freshness_check"),
  outlierCheck: boolean("outlier_check"),
  
  // Detailed Scores
  completenessScore: real("completeness_score"),
  consistencyScore: real("consistency_score"),
  accuracyScore: real("accuracy_score"),
  freshnessScore: real("freshness_score"),
  outlierScore: real("outlier_score"),
  overallQualityScore: real("overall_quality_score"),
  
  // Validation Details
  failedRules: text("failed_rules").array().default([]),
  warningRules: text("warning_rules").array().default([]),
  validationMessages: jsonb("validation_messages"), // Detailed error/warning messages
  
  // Metadata
  validatedAt: timestamp("validated_at").notNull().defaultNow(),
  validatedBy: text("validated_by"), // System or user
  validationVersion: text("validation_version"), // Rule version
}, (table) => ({
  jobTableIdx: index("qgr_job_table_idx").on(table.jobId, table.tableName),
  recordIdx: index("qgr_record_idx").on(table.recordIdentifier),
  overallPassedIdx: index("qgr_overall_passed_idx").on(table.overallPassed),
  qualityScoreIdx: index("qgr_quality_score_idx").on(table.overallQualityScore),
}));

// Enhanced Player Week Facts Metadata (companion to existing playerWeekFacts)
export const playerWeekFactsMetadata = pgTable("player_week_facts_metadata", {
  canonicalPlayerId: text("canonical_player_id").notNull(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  
  // Data lineage and quality
  sourceMask: integer("source_mask").notNull().default(0), // Bitmask of contributing sources
  freshnessScore: real("freshness_score").notNull().default(0), // 0-1 freshness score
  qualityGatesPassed: boolean("quality_gates_passed").notNull().default(false),
  completenessScore: real("completeness_score").notNull().default(0), // 0-1 completeness
  
  // Source timestamps
  sleeperLastUpdate: timestamp("sleeper_last_update"),
  nflDataLastUpdate: timestamp("nfl_data_last_update"),
  fantasyProsLastUpdate: timestamp("fantasy_pros_last_update"),
  
  // Quality flags
  hasGameLog: boolean("has_game_log").default(false),
  hasMarketData: boolean("has_market_data").default(false),
  hasAdvancedStats: boolean("has_advanced_stats").default(false),
  hasInjuryData: boolean("has_injury_data").default(false),
  
  // Derived data freshness
  factTableLastRefresh: timestamp("fact_table_last_refresh").notNull().defaultNow(),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Primary key
  primaryKey: primaryKey({ columns: [table.canonicalPlayerId, table.season, table.week] }),
  // Indexes
  qualityIdx: index("pwfm_quality_idx").on(table.qualityGatesPassed),
  freshnessIdx: index("pwfm_freshness_idx").on(table.freshnessScore),
  seasonWeekIdx: index("pwfm_season_week_idx").on(table.season, table.week),
}));

// ========================================
// INSERT SCHEMAS AND TYPES
// ========================================

// Bronze Layer Insert Schemas
export const insertIngestPayloadsSchema = createInsertSchema(ingestPayloads).omit({
  id: true,
  ingestedAt: true,
});

// Silver Layer Insert Schemas
export const insertSeasonStateSchema = createInsertSchema(seasonState).omit({
  id: true,
  observedAt: true,
});

export const insertPlayerIdentityMapSchema = createInsertSchema(playerIdentityMap).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertNflTeamsDimSchema = createInsertSchema(nflTeamsDim).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertMarketSignalsSchema = createInsertSchema(marketSignals).omit({
  id: true,
  createdAt: true,
});

export const insertInjuriesSchema = createInsertSchema(injuries).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDepthChartsSchema = createInsertSchema(depthCharts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Gold Layer Insert Schemas
export const insertPlayerSeasonFactsSchema = createInsertSchema(playerSeasonFacts).omit({
  createdAt: true,
  updatedAt: true,
  lastRefreshed: true,
});

export const insertMarketRollupsSchema = createInsertSchema(marketRollups).omit({
  id: true,
  calculatedAt: true,
  createdAt: true,
});

export const insertDataLineageSchema = createInsertSchema(dataLineage).omit({
  id: true,
  createdAt: true,
});

export const insertPlayerWeekFactsMetadataSchema = createInsertSchema(playerWeekFactsMetadata).omit({
  createdAt: true,
  updatedAt: true,
  factTableLastRefresh: true,
});

export const insertPlayerMarketFactsSchema = createInsertSchema(playerMarketFacts).omit({
  id: true,
  calculatedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPlayerCompositeFactsSchema = createInsertSchema(playerCompositeFacts).omit({
  createdAt: true,
  updatedAt: true,
  lastRefreshed: true,
});

export const insertQualityGateResultsSchema = createInsertSchema(qualityGateResults).omit({
  id: true,
  validatedAt: true,
});

// ========================================
// TYPE DEFINITIONS
// ========================================

// Bronze Layer Types
export type IngestPayload = typeof ingestPayloads.$inferSelect;
export type InsertIngestPayload = z.infer<typeof insertIngestPayloadsSchema>;

// Silver Layer Types
export type SeasonState = typeof seasonState.$inferSelect;
export type InsertSeasonState = z.infer<typeof insertSeasonStateSchema>;
export type PlayerIdentityMap = typeof playerIdentityMap.$inferSelect;
export type InsertPlayerIdentityMap = z.infer<typeof insertPlayerIdentityMapSchema>;
export type NflTeamsDim = typeof nflTeamsDim.$inferSelect;
export type InsertNflTeamsDim = z.infer<typeof insertNflTeamsDimSchema>;
export type MarketSignals = typeof marketSignals.$inferSelect;
export type InsertMarketSignals = z.infer<typeof insertMarketSignalsSchema>;
export type Injuries = typeof injuries.$inferSelect;
export type InsertInjuries = z.infer<typeof insertInjuriesSchema>;
export type DepthCharts = typeof depthCharts.$inferSelect;
export type InsertDepthCharts = z.infer<typeof insertDepthChartsSchema>;

// Gold Layer Types
export type PlayerSeasonFacts = typeof playerSeasonFacts.$inferSelect;
export type InsertPlayerSeasonFacts = z.infer<typeof insertPlayerSeasonFactsSchema>;
export type MarketRollups = typeof marketRollups.$inferSelect;
export type InsertMarketRollups = z.infer<typeof insertMarketRollupsSchema>;
export type DataLineage = typeof dataLineage.$inferSelect;
export type InsertDataLineage = z.infer<typeof insertDataLineageSchema>;
export type PlayerWeekFactsMetadata = typeof playerWeekFactsMetadata.$inferSelect;
export type InsertPlayerWeekFactsMetadata = z.infer<typeof insertPlayerWeekFactsMetadataSchema>;
export type PlayerMarketFacts = typeof playerMarketFacts.$inferSelect;
export type InsertPlayerMarketFacts = z.infer<typeof insertPlayerMarketFactsSchema>;
export type PlayerCompositeFacts = typeof playerCompositeFacts.$inferSelect;
export type InsertPlayerCompositeFacts = z.infer<typeof insertPlayerCompositeFactsSchema>;
export type QualityGateResults = typeof qualityGateResults.$inferSelect;
export type InsertQualityGateResults = z.infer<typeof insertQualityGateResultsSchema>;

// ========================================
// TABLE RELATIONS
// ========================================

// Player Identity Map Relations
export const playerIdentityMapRelations = relations(playerIdentityMap, ({ many }) => ({
  marketSignals: many(marketSignals),
  injuries: many(injuries),
  depthCharts: many(depthCharts),
  playerSeasonFacts: many(playerSeasonFacts),
  marketRollups: many(marketRollups),
  playerMarketFacts: many(playerMarketFacts),
  playerCompositeFacts: many(playerCompositeFacts),
}));

// NFL Teams Relations
export const nflTeamsDimRelations = relations(nflTeamsDim, ({ many }) => ({
  depthCharts: many(depthCharts),
  playerSeasonFacts: many(playerSeasonFacts),
}));

// Market Signals Relations
export const marketSignalsRelations = relations(marketSignals, ({ one }) => ({
  player: one(playerIdentityMap, {
    fields: [marketSignals.canonicalPlayerId],
    references: [playerIdentityMap.canonicalId],
  }),
}));

// Injuries Relations
export const injuriesRelations = relations(injuries, ({ one }) => ({
  player: one(playerIdentityMap, {
    fields: [injuries.canonicalPlayerId],
    references: [playerIdentityMap.canonicalId],
  }),
}));

// Depth Charts Relations
export const depthChartsRelations = relations(depthCharts, ({ one }) => ({
  player: one(playerIdentityMap, {
    fields: [depthCharts.canonicalPlayerId],
    references: [playerIdentityMap.canonicalId],
  }),
  team: one(nflTeamsDim, {
    fields: [depthCharts.teamCode],
    references: [nflTeamsDim.teamCode],
  }),
}));

// Player Season Facts Relations
export const playerSeasonFactsRelations = relations(playerSeasonFacts, ({ one }) => ({
  player: one(playerIdentityMap, {
    fields: [playerSeasonFacts.canonicalPlayerId],
    references: [playerIdentityMap.canonicalId],
  }),
  team: one(nflTeamsDim, {
    fields: [playerSeasonFacts.nflTeam],
    references: [nflTeamsDim.teamCode],
  }),
}));

// Market Rollups Relations
export const marketRollupsRelations = relations(marketRollups, ({ one }) => ({
  player: one(playerIdentityMap, {
    fields: [marketRollups.canonicalPlayerId],
    references: [playerIdentityMap.canonicalId],
  }),
}));

// Player Market Facts Relations
export const playerMarketFactsRelations = relations(playerMarketFacts, ({ one }) => ({
  player: one(playerIdentityMap, {
    fields: [playerMarketFacts.canonicalPlayerId],
    references: [playerIdentityMap.canonicalId],
  }),
}));

// Player Composite Facts Relations
export const playerCompositeFactsRelations = relations(playerCompositeFacts, ({ one }) => ({
  player: one(playerIdentityMap, {
    fields: [playerCompositeFacts.canonicalPlayerId],
    references: [playerIdentityMap.canonicalId],
  }),
}));

// Data Lineage Relations
export const dataLineageRelations = relations(dataLineage, ({ one }) => ({
  ingestPayload: one(ingestPayloads, {
    fields: [dataLineage.ingestPayloadId],
    references: [ingestPayloads.id],
  }),
}));

// ========================================
// PLAYER USAGE - MATCHUP INTELLIGENCE DATA
// ========================================

// Player Usage Metrics - Weekly alignment splits, snap share, target share for matchup analysis
export const playerUsage = pgTable("player_usage", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull(),
  sleeperId: text("sleeper_id"),
  week: integer("week").notNull(),
  season: integer("season").notNull(),
  
  // WR Alignment Data (from play-by-play)
  routesTotal: integer("routes_total"),
  routesOutside: integer("routes_outside"),
  routesSlot: integer("routes_slot"),
  routesInline: integer("routes_inline"),
  alignmentOutsidePct: real("alignment_outside_pct"),
  alignmentSlotPct: real("alignment_slot_pct"),
  
  // Usage Metrics
  snaps: integer("snaps"),
  snapSharePct: real("snap_share_pct"),
  targetSharePct: real("target_share_pct"),
  targets: integer("targets"),
  
  // RB Specific - Rushing concept splits
  carriesGap: integer("carries_gap"),
  carriesZone: integer("carries_zone"),
  carriesTotal: integer("carries_total"),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint on player/week/season
  uniquePlayerWeek: uniqueIndex("player_usage_unique").on(table.playerId, table.week, table.season),
  // Performance indexes
  playerSeasonIdx: index("player_usage_player_season_idx").on(table.playerId, table.season),
  seasonWeekIdx: index("player_usage_season_week_idx").on(table.season, table.week),
}));

// Player Usage Relations
export const playerUsageRelations = relations(playerUsage, ({ one }) => ({
  player: one(playerIdentityMap, {
    fields: [playerUsage.playerId],
    references: [playerIdentityMap.canonicalId],
  }),
}));

// Metric Matrix cache: player vector axes for Metric Matrix UI
export const metricMatrixPlayerVectors = pgTable("metric_matrix_player_vectors", {
  playerId: text("player_id").notNull(),
  season: integer("season").notNull().default(0),
  week: integer("week").notNull().default(0),
  mode: text("mode").notNull(),
  axesJson: jsonb("axes_json").notNull(),
  confidence: real("confidence"),
  missingInputs: text("missing_inputs").array().default([]),
  computedAt: timestamp("computed_at").defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.playerId, table.season, table.week, table.mode] }),
  modeIdx: index("metric_matrix_player_vectors_mode_idx").on(table.mode),
}));

// Player Usage Types and Insert Schemas
export type PlayerUsage = typeof playerUsage.$inferSelect;
export type InsertPlayerUsage = z.infer<typeof insertPlayerUsageSchema>;
export const insertPlayerUsageSchema = createInsertSchema(playerUsage).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// ========================================
// WR ROLE BANK - ANALYTICAL LAYER
// ========================================

// WR Role Bank - Season-level analytics computed from weekly_stats + player_usage
export const wrRoleBank = pgTable("wr_role_bank", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull(),
  sleeperId: text("sleeper_id"),
  season: integer("season").notNull(),
  
  // Volume Metrics
  gamesPlayed: integer("games_played").notNull(),
  targetsPerGame: real("targets_per_game").notNull(),
  targetShareAvg: real("target_share_avg"),
  routesPerGame: real("routes_per_game"),
  routeShareEst: real("route_share_est"),
  
  // Consistency Metrics
  targetStdDev: real("target_std_dev"),
  fantasyStdDev: real("fantasy_std_dev"),
  
  // Efficiency Metrics
  pprPerTarget: real("ppr_per_target"),
  deepTargetsPerGame: real("deep_targets_per_game"),  // v1.1: 20+ air yards targets per game
  deepTargetRate: real("deep_target_rate"),           // v1.1: deepTargets / totalTargets
  
  // Alignment Flavor (Estimates)
  slotRouteShareEst: real("slot_route_share_est"),
  outsideRouteShareEst: real("outside_route_share_est"),
  
  // Sub-scores (0-100)
  volumeScore: integer("volume_score").notNull(),
  consistencyScore: integer("consistency_score").notNull(),
  highValueUsageScore: integer("high_value_usage_score").notNull(),
  momentumScore: integer("momentum_score").notNull(),
  
  // Final Composite Score (0-100)
  roleScore: integer("role_score").notNull(),
  
  // v2.0 Fantasy Efficiency Blend - Debug Scores
  pureRoleScore: integer("pure_role_score"),           // v1.2 original score
  efficiencyScore: integer("efficiency_score"),        // Fantasy efficiency component
  
  // TIBER Alpha Engine (unified scoring system)
  alphaScore: integer("alpha_score").notNull(),                  // Unified alpha score (0-100)
  volumeIndex: integer("volume_index").notNull(),                // Volume pillar (0-100)
  productionIndex: integer("production_index").notNull(),        // Production pillar (0-100)
  efficiencyIndex: integer("efficiency_index").notNull(),        // Efficiency pillar (0-100)
  stabilityIndex: integer("stability_index").notNull(),          // Stability pillar (0-100)
  
  // Role Classification
  roleTier: wrRoleTierEnum("role_tier").notNull(),
  
  // Flags
  cardioWrFlag: boolean("cardio_wr_flag").default(false).notNull(),
  breakoutWatchFlag: boolean("breakout_watch_flag").default(false).notNull(),
  fakeSpikeFlag: boolean("fake_spike_flag").default(false).notNull(),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint on player/season
  uniquePlayerSeason: uniqueIndex("wr_role_bank_unique").on(table.playerId, table.season),
  
  // Performance indexes
  playerIdx: index("wr_role_bank_player_idx").on(table.playerId),
  seasonIdx: index("wr_role_bank_season_idx").on(table.season),
  roleScoreIdx: index("wr_role_bank_role_score_idx").on(table.season, table.roleScore),
  roleTierIdx: index("wr_role_bank_role_tier_idx").on(table.season, table.roleTier),
}));

// WR Role Bank Relations
export const wrRoleBankRelations = relations(wrRoleBank, ({ one }) => ({
  player: one(playerIdentityMap, {
    fields: [wrRoleBank.playerId],
    references: [playerIdentityMap.canonicalId],
  }),
}));

// WR Role Bank Types and Insert Schemas
export type WRRoleBank = typeof wrRoleBank.$inferSelect;
export type InsertWRRoleBank = z.infer<typeof insertWRRoleBankSchema>;
export const insertWRRoleBankSchema = createInsertSchema(wrRoleBank).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// ========================================
// RB ROLE BANK - ANALYTICAL LAYER
// ========================================

// RB Role Bank - Season-level analytics computed from weekly_stats + player_usage
export const rbRoleBank = pgTable("rb_role_bank", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull(),
  sleeperId: text("sleeper_id"),
  season: integer("season").notNull(),
  
  // Volume Metrics
  gamesPlayed: integer("games_played").notNull(),
  carriesPerGame: real("carries_per_game").notNull(),
  targetsPerGame: real("targets_per_game").notNull(),
  opportunitiesPerGame: real("opportunities_per_game").notNull(),
  targetShareAvg: real("target_share_avg"),
  routesPerGame: real("routes_per_game"),
  
  // Consistency Metrics
  oppStdDev: real("opp_std_dev"),
  fantasyStdDev: real("fantasy_std_dev"),
  
  // Efficiency Metrics
  pprPerOpportunity: real("ppr_per_opportunity"),
  redZoneTouchesPerGame: real("red_zone_touches_per_game"),
  
  // Sub-scores (0-100)
  volumeScore: integer("volume_score").notNull(),
  consistencyScore: integer("consistency_score").notNull(),
  highValueUsageScore: integer("high_value_usage_score").notNull(),
  momentumScore: integer("momentum_score").notNull(),
  
  // Final Composite Score (0-100)
  roleScore: integer("role_score").notNull(),
  
  // Role Classification
  roleTier: rbRoleTierEnum("role_tier").notNull(),
  
  // Flags
  pureRusherFlag: boolean("pure_rusher_flag").default(false).notNull(),
  passingDownBackFlag: boolean("passing_down_back_flag").default(false).notNull(),
  breakoutWatchFlag: boolean("breakout_watch_flag").default(false).notNull(),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint on player/season
  uniquePlayerSeason: uniqueIndex("rb_role_bank_unique").on(table.playerId, table.season),
  
  // Performance indexes
  playerIdx: index("rb_role_bank_player_idx").on(table.playerId),
  seasonIdx: index("rb_role_bank_season_idx").on(table.season),
  roleScoreIdx: index("rb_role_bank_role_score_idx").on(table.season, table.roleScore),
  roleTierIdx: index("rb_role_bank_role_tier_idx").on(table.season, table.roleTier),
}));

// RB Role Bank Relations
export const rbRoleBankRelations = relations(rbRoleBank, ({ one }) => ({
  player: one(playerIdentityMap, {
    fields: [rbRoleBank.playerId],
    references: [playerIdentityMap.canonicalId],
  }),
}));

// RB Role Bank Types and Insert Schemas
export type RBRoleBank = typeof rbRoleBank.$inferSelect;
export type InsertRBRoleBank = z.infer<typeof insertRBRoleBankSchema>;
export const insertRBRoleBankSchema = createInsertSchema(rbRoleBank).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// ========================================
// TE ROLE BANK - ANALYTICAL LAYER
// ========================================

// TE Role Bank - Season-level analytics computed from weekly_stats + player_usage
export const teRoleBank = pgTable("te_role_bank", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull(),
  sleeperId: text("sleeper_id"),
  season: integer("season").notNull(),
  
  // Volume Metrics
  gamesPlayed: integer("games_played").notNull(),
  targetsPerGame: real("targets_per_game").notNull(),
  targetShareAvg: real("target_share_avg"),
  routesPerGame: real("routes_per_game"),
  
  // Consistency Metrics
  targetStdDev: real("target_std_dev"),
  fantasyStdDev: real("fantasy_std_dev"),
  
  // Efficiency Metrics
  pprPerTarget: real("ppr_per_target"),
  redZoneTargetsPerGame: real("red_zone_targets_per_game"),
  
  // Sub-scores (0-100)
  volumeScore: integer("volume_score").notNull(),
  consistencyScore: integer("consistency_score").notNull(),
  highValueUsageScore: integer("high_value_usage_score").notNull(),
  momentumScore: integer("momentum_score").notNull(),
  
  // Final Composite Score (0-100)
  roleScore: integer("role_score").notNull(),
  
  // Role Classification
  roleTier: teRoleTierEnum("role_tier").notNull(),
  
  // Flags
  redZoneWeaponFlag: boolean("red_zone_weapon_flag").default(false).notNull(),
  cardioTEFlag: boolean("cardio_te_flag").default(false).notNull(),
  breakoutWatchFlag: boolean("breakout_watch_flag").default(false).notNull(),
  
  // Metadata
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint on player/season
  uniquePlayerSeason: uniqueIndex("te_role_bank_unique").on(table.playerId, table.season),
  
  // Performance indexes
  playerIdx: index("te_role_bank_player_idx").on(table.playerId),
  seasonIdx: index("te_role_bank_season_idx").on(table.season),
  roleScoreIdx: index("te_role_bank_role_score_idx").on(table.season, table.roleScore),
  roleTierIdx: index("te_role_bank_role_tier_idx").on(table.season, table.roleTier),
}));

// TE Role Bank Relations
export const teRoleBankRelations = relations(teRoleBank, ({ one }) => ({
  player: one(playerIdentityMap, {
    fields: [teRoleBank.playerId],
    references: [playerIdentityMap.canonicalId],
  }),
}));

// TE Role Bank Types and Insert Schemas
export type TERoleBank = typeof teRoleBank.$inferSelect;
export type InsertTERoleBank = z.infer<typeof insertTERoleBankSchema>;
export const insertTERoleBankSchema = createInsertSchema(teRoleBank).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// ========================================
// QB ROLE BANK - ANALYTICAL LAYER
// ========================================

// QB Role Bank - Season-level analytics computed from play-by-play + weekly stats
export const qbRoleBank = pgTable("qb_role_bank", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull(),
  sleeperId: text("sleeper_id"),
  season: integer("season").notNull(),
  
  // Volume Metrics
  gamesPlayed: integer("games_played").notNull(),
  dropbacksPerGame: real("dropbacks_per_game").notNull(),
  redZoneDropbacksPerGame: real("red_zone_dropbacks_per_game"),
  passingAttempts: integer("passing_attempts").notNull(),
  passingYards: integer("passing_yards").notNull(),
  passingTouchdowns: integer("passing_touchdowns").notNull(),
  interceptions: integer("interceptions").notNull(),
  
  // Rushing Metrics
  rushAttemptsPerGame: real("rush_attempts_per_game").notNull(),
  redZoneRushesPerGame: real("red_zone_rushes_per_game"),
  rushingYards: integer("rushing_yards").notNull(),
  rushingTouchdowns: integer("rushing_touchdowns").notNull(),
  
  // Efficiency Metrics
  epaPerPlay: real("epa_per_play"),
  cpoe: real("cpoe"),
  sackRate: real("sack_rate"),
  completionPercentage: real("completion_percentage"),
  yardsPerAttempt: real("yards_per_attempt"),
  
  // Sub-scores (0-100)
  volumeScore: integer("volume_score").notNull(),
  rushingScore: integer("rushing_score").notNull(),
  efficiencyScore: integer("efficiency_score").notNull(),
  momentumScore: integer("momentum_score").notNull(),
  
  // Final Composite Score (0-100)
  alphaContextScore: integer("alpha_context_score").notNull(),
  
  // Role Classification
  alphaTier: qbRoleTierEnum("alpha_tier").notNull(),
  
  // Flags
  konamiCodeFlag: boolean("konami_code_flag").default(false).notNull(),
  systemQBFlag: boolean("system_qb_flag").default(false).notNull(),
  garbageTimeKingFlag: boolean("garbage_time_king_flag").default(false).notNull(),
  
  // Metadata
  version: text("version").default("1.0").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Unique constraint on player/season
  uniquePlayerSeason: uniqueIndex("qb_role_bank_unique").on(table.playerId, table.season),
  
  // Performance indexes
  playerIdx: index("qb_role_bank_player_idx").on(table.playerId),
  seasonIdx: index("qb_role_bank_season_idx").on(table.season),
  alphaScoreIdx: index("qb_role_bank_alpha_score_idx").on(table.season, table.alphaContextScore),
  alphaTierIdx: index("qb_role_bank_alpha_tier_idx").on(table.season, table.alphaTier),
}));

// QB Role Bank Relations
export const qbRoleBankRelations = relations(qbRoleBank, ({ one }) => ({
  player: one(playerIdentityMap, {
    fields: [qbRoleBank.playerId],
    references: [playerIdentityMap.canonicalId],
  }),
}));

// QB Role Bank Types and Insert Schemas
export type QBRoleBank = typeof qbRoleBank.$inferSelect;
export type InsertQBRoleBank = z.infer<typeof insertQBRoleBankSchema>;
export const insertQBRoleBankSchema = createInsertSchema(qbRoleBank).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// ========================================
// EPA REFERENCE SYSTEM
// ========================================

// External EPA Reference Data - External benchmark for EPA validation
export const qbEpaReference = pgTable("qb_epa_reference", {
  id: serial("id").primaryKey(),
  playerId: text("player_id"), // NFLfastR ID
  playerName: text("player_name").notNull(),
  team: text("team").notNull(),
  season: integer("season").notNull(),
  week: integer("week"), // null = season totals
  
  // External reference data
  numPlays: integer("num_plays"), // n
  rawEpaPerPlay: real("raw_epa_per_play"), // Raw EPA/P
  adjEpaPerPlay: real("adj_epa_per_play"), // Adjusted EPA/P
  epaDiff: real("epa_diff"), // Diff (adjustment amount)
  
  // Metadata
  source: text("source").default("external_reference"), // Data source
  dataDate: timestamp("data_date"), // Publication date
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  playerSeasonWeekIdx: index("qb_epa_ref_player_season_week_idx").on(table.playerId, table.season, table.week),
  uniquePlayerSeasonWeek: unique("qb_epa_ref_unique").on(table.playerId, table.season, table.week),
}));

// QB Context Metrics - Calculated "luck" factors from play-by-play
export const qbContextMetrics = pgTable("qb_context_metrics", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull(), // NFLfastR ID
  playerName: text("player_name").notNull(),
  season: integer("season").notNull(),
  week: integer("week"), // null = season totals
  
  // Drop rate context
  passAttempts: integer("pass_attempts"),
  drops: integer("drops"), // Receiver drops
  dropRate: real("drop_rate"), // drops / (completions + drops)
  
  // Pressure context
  pressures: integer("pressures"), // QB hits + hurries
  pressureRate: real("pressure_rate"), // pressures / dropbacks
  sacks: integer("sacks"),
  sackRate: real("sack_rate"),
  
  // YAC context
  totalYac: real("total_yac"), // Actual YAC
  expectedYac: real("expected_yac"), // Expected YAC (xYAC)
  yacDelta: real("yac_delta"), // Actual - Expected (positive = receivers helping)
  
  // Completion accuracy
  cpoe: real("cpoe"), // Completion Percentage Over Expected (difficulty-adjusted accuracy)
  completions: integer("completions"), // Total completions
  completionPct: real("completion_pct"), // Raw completion percentage
  
  // Defensive strength faced
  avgDefEpaFaced: real("avg_def_epa_faced"), // Average defensive EPA of opponents
  
  // Turnover luck
  interceptablePasses: integer("interceptable_passes"), // Should have been picked
  droppedInterceptions: integer("dropped_interceptions"), // Defenders dropped INTs
  
  // Metadata
  calculatedAt: timestamp("calculated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  playerSeasonWeekIdx: index("qb_context_player_season_week_idx").on(table.playerId, table.season, table.week),
  uniquePlayerSeasonWeek: unique("qb_context_unique").on(table.playerId, table.season, table.week),
}));

// Tiber Adjusted EPA - Our own calculated adjustments
export const qbEpaAdjusted = pgTable("qb_epa_adjusted", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull(), // NFLfastR ID
  playerName: text("player_name").notNull(),
  season: integer("season").notNull(),
  week: integer("week"), // null = season totals
  
  // Our calculations
  rawEpaPerPlay: real("raw_epa_per_play"), // From our data
  tiberAdjEpaPerPlay: real("tiber_adj_epa_per_play"), // Our adjusted EPA
  tiberEpaDiff: real("tiber_epa_diff"), // Our adjustment amount
  
  // Breakdown of adjustments
  dropAdjustment: real("drop_adjustment"), // EPA adjustment for drops
  pressureAdjustment: real("pressure_adjustment"), // EPA adjustment for pressure
  yacAdjustment: real("yac_adjustment"), // EPA adjustment for YAC
  defenseAdjustment: real("defense_adjustment"), // EPA adjustment for defenses faced
  
  // External reference comparison
  referenceAdjEpa: real("reference_adj_epa"), // External adjusted EPA for comparison
  accuracyPct: real("accuracy_pct"), // Comparison accuracy
  
  // Confidence
  confidence: real("confidence").default(0.7), // How confident we are in our adjustment
  
  // Metadata
  calculatedAt: timestamp("calculated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  playerSeasonWeekIdx: index("qb_epa_adj_player_season_week_idx").on(table.playerId, table.season, table.week),
  uniquePlayerSeasonWeek: unique("qb_epa_adj_unique").on(table.playerId, table.season, table.week),
}));

// ========================================
// RB EPA CONTEXT SYSTEM
// ========================================

// RB Context Metrics - Calculated context factors from play-by-play
export const rbContextMetrics = pgTable("rb_context_metrics", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull(), // NFLfastR ID
  playerName: text("player_name").notNull(),
  season: integer("season").notNull(),
  week: integer("week"), // null = season totals
  
  // Box count context
  rushAttempts: integer("rush_attempts"),
  boxCount8Plus: integer("box_count_8_plus"), // Carries vs 8+ defenders
  boxCountRate: real("box_count_rate"), // % of carries vs stacked box
  
  // Yards before contact (O-line quality)
  yardsBeforeContact: real("yards_before_contact"), // Average YBC
  yardsAfterContact: real("yards_after_contact"), // Average YAC on runs
  ybcRate: real("ybc_rate"), // YBC / Total rushing yards
  
  // Elusiveness metrics
  brokenTackles: integer("broken_tackles"),
  brokenTackleRate: real("broken_tackle_rate"), // Broken tackles / attempts
  
  // Receiving context
  targets: integer("targets"),
  receptions: integer("receptions"),
  targetShare: real("target_share"), // % of team targets
  
  // Goal line opportunity
  glCarries: integer("gl_carries"), // Carries inside 5-yard line
  glTouchdowns: integer("gl_touchdowns"),
  glConversionRate: real("gl_conversion_rate"), // TD% on goal line carries
  
  // Defensive strength faced
  avgDefEpaFaced: real("avg_def_epa_faced"), // Average defensive EPA of opponents
  
  // Metadata
  calculatedAt: timestamp("calculated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  playerSeasonWeekIdx: index("rb_context_player_season_week_idx").on(table.playerId, table.season, table.week),
  uniquePlayerSeasonWeek: unique("rb_context_unique").on(table.playerId, table.season, table.week),
}));

// Tiber Adjusted EPA for RBs - Our own calculated adjustments
export const rbEpaAdjusted = pgTable("rb_epa_adjusted", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull(), // NFLfastR ID
  playerName: text("player_name").notNull(),
  season: integer("season").notNull(),
  week: integer("week"), // null = season totals
  
  // Our calculations
  rawEpaPerPlay: real("raw_epa_per_play"), // From our data
  tiberAdjEpaPerPlay: real("tiber_adj_epa_per_play"), // Our adjusted EPA
  tiberEpaDiff: real("tiber_epa_diff"), // Our adjustment amount
  
  // Breakdown of adjustments
  boxCountAdjustment: real("box_count_adjustment"), // EPA adjustment for stacked boxes
  ybcAdjustment: real("ybc_adjustment"), // EPA adjustment for O-line quality
  brokenTackleAdjustment: real("broken_tackle_adjustment"), // EPA adjustment for elusiveness
  targetShareAdjustment: real("target_share_adjustment"), // EPA adjustment for receiving work
  glAdjustment: real("gl_adjustment"), // EPA adjustment for goal line usage
  defenseAdjustment: real("defense_adjustment"), // EPA adjustment for defenses faced
  
  // Confidence
  confidence: real("confidence").default(0.7), // How confident we are in our adjustment
  
  // Metadata
  calculatedAt: timestamp("calculated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  playerSeasonWeekIdx: index("rb_epa_adj_player_season_week_idx").on(table.playerId, table.season, table.week),
  uniquePlayerSeasonWeek: unique("rb_epa_adj_unique").on(table.playerId, table.season, table.week),
}));

// Calibrated EPA Weights - Stores regression-optimized weights for EPA adjustments
export const calibratedEpaWeights = pgTable("calibrated_epa_weights", {
  id: serial("id").primaryKey(),
  season: integer("season").notNull(),
  position: text("position").notNull(), // 'QB' or 'RB'
  regressionType: text("regression_type").notNull(), // 'ols', 'ridge', 'lasso'
  
  // QB weights
  dropWeight: real("drop_weight"),
  pressureWeight: real("pressure_weight"),
  yacWeight: real("yac_weight"),
  defenseWeight: real("defense_weight"),
  
  // RB weights (for future use)
  boxCountWeight: real("box_count_weight"),
  ybcWeight: real("ybc_weight"),
  brokenTackleWeight: real("broken_tackle_weight"),
  targetShareWeight: real("target_share_weight"),
  glWeight: real("gl_weight"),
  rbDefenseWeight: real("rb_defense_weight"),
  
  // Performance metrics
  rmse: real("rmse"), // Root mean squared error
  r2: real("r2"), // R-squared score
  mae: real("mae"), // Mean absolute error
  
  // Status
  isActive: boolean("is_active").default(false), // Whether these weights are currently in use
  
  // Metadata
  calibratedBy: text("calibrated_by").default('auto'), // 'auto' or 'manual'
  notes: text("notes"), // Optional notes about this calibration
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  seasonPositionIdx: index("calibrated_weights_season_position_idx").on(table.season, table.position),
  activeIdx: index("calibrated_weights_active_idx").on(table.isActive),
  uniqueActiveSeasonPosition: unique("calibrated_weights_unique_active").on(table.season, table.position, table.isActive),
}));

// EPA Reference System Insert Schemas - QB
export const insertQbEpaReferenceSchema = createInsertSchema(qbEpaReference).omit({ id: true, createdAt: true });
export const insertQbContextMetricsSchema = createInsertSchema(qbContextMetrics).omit({ id: true, createdAt: true, calculatedAt: true });
export const insertQbEpaAdjustedSchema = createInsertSchema(qbEpaAdjusted).omit({ id: true, createdAt: true, calculatedAt: true });

// EPA Reference System Insert Schemas - RB
export const insertRbContextMetricsSchema = createInsertSchema(rbContextMetrics).omit({ id: true, createdAt: true, calculatedAt: true });
export const insertRbEpaAdjustedSchema = createInsertSchema(rbEpaAdjusted).omit({ id: true, createdAt: true, calculatedAt: true });

// Calibrated EPA Weights Insert Schema
export const insertCalibratedEpaWeightsSchema = createInsertSchema(calibratedEpaWeights).omit({ id: true, createdAt: true });

// EPA Reference System Types - QB
export type QbEpaReference = typeof qbEpaReference.$inferSelect;
export type InsertQbEpaReference = z.infer<typeof insertQbEpaReferenceSchema>;
export type QbContextMetrics = typeof qbContextMetrics.$inferSelect;
export type InsertQbContextMetrics = z.infer<typeof insertQbContextMetricsSchema>;
export type QbEpaAdjusted = typeof qbEpaAdjusted.$inferSelect;
export type InsertQbEpaAdjusted = z.infer<typeof insertQbEpaAdjustedSchema>;

// EPA Reference System Types - RB
export type RbContextMetrics = typeof rbContextMetrics.$inferSelect;
export type InsertRbContextMetrics = z.infer<typeof insertRbContextMetricsSchema>;
export type RbEpaAdjusted = typeof rbEpaAdjusted.$inferSelect;
export type InsertRbEpaAdjusted = z.infer<typeof insertRbEpaAdjustedSchema>;

// Calibrated EPA Weights Types
export type CalibratedEpaWeights = typeof calibratedEpaWeights.$inferSelect;
export type InsertCalibratedEpaWeights = z.infer<typeof insertCalibratedEpaWeightsSchema>;

// TIBER Insert Schemas
export const insertTiberScoreSchema = createInsertSchema(tiberScores).omit({ id: true, calculatedAt: true });
export const insertTiberSeasonRatingSchema = createInsertSchema(tiberSeasonRatings).omit({ id: true, calculatedAt: true, updatedAt: true });

// TIBER Types
export type TiberScore = typeof tiberScores.$inferSelect;
export type InsertTiberScore = z.infer<typeof insertTiberScoreSchema>;
export type TiberSeasonRating = typeof tiberSeasonRatings.$inferSelect;
export type InsertTiberSeasonRating = z.infer<typeof insertTiberSeasonRatingSchema>;

// Types
export type PlayerWeekFacts = typeof playerWeekFacts.$inferSelect;
export type InsertPlayerWeekFacts = z.infer<typeof insertPlayerWeekFactsSchema>;
export type BuysSells = typeof buysSells.$inferSelect;
export type InsertBuysSells = z.infer<typeof insertBuysSellsSchema>;

// ========================================
// WAIVER WISDOM SYSTEM TABLES
// ========================================

// Sleeper ownership table - Stores platform-wide ownership percentages
export const sleeperOwnership = pgTable("sleeper_ownership", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull(),
  season: integer("season").notNull(),
  week: integer("week"),
  ownershipPercentage: real("ownership_percentage"),
  rosterCount: integer("roster_count"),
  totalLeagues: integer("total_leagues"),
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => ({
  playerSeasonWeekIdx: uniqueIndex("sleeper_ownership_player_season_week_idx").on(table.playerId, table.season, table.week),
  seasonWeekIdx: index("sleeper_ownership_season_week_idx").on(table.season, table.week),
}));

// Waiver candidates table - Computed waiver recommendations
export const waiverCandidates = pgTable("waiver_candidates", {
  id: serial("id").primaryKey(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  playerId: text("player_id").notNull(),
  playerName: text("player_name"),
  position: text("position"),
  team: text("team"),
  ownershipPercentage: real("ownership_percentage"),
  interestScore: real("interest_score").notNull(),
  waiverTier: waiverTierEnum("waiver_tier").notNull(),
  archetype: waiverArchetypeEnum("archetype").notNull(),
  summary: text("summary"), // 1-2 sentence machine-generated note
  faabMin: integer("faab_min"), // Suggested FAAB range (min %)
  faabMax: integer("faab_max"), // Suggested FAAB range (max %)
  recentPpg: real("recent_ppg"), // Last 3 weeks PPG
  recentTrend: text("recent_trend"), // 'rising', 'stable', 'declining'
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  seasonWeekPlayerIdx: uniqueIndex("waiver_candidates_season_week_player_idx").on(table.season, table.week, table.playerId),
  seasonWeekTierIdx: index("waiver_candidates_season_week_tier_idx").on(table.season, table.week, table.waiverTier),
  positionIdx: index("waiver_candidates_position_idx").on(table.position),
}));

// ========================================
// RAG SYSTEM TABLES
// ========================================

// Chunks table - Stores embedded TIBER analysis narratives and pattern observations
export const chunks = pgTable("chunks", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  embedding: vector("embedding", { dimensions: 768 }), // Gemini Flash embeddings (768 dimensions)
  metadata: jsonb("metadata").$type<{
    player_id?: string;
    position?: string;
    week?: number;
    season?: number;
    tags?: string[];
    
    type?: 'narrative' | 'pattern_observation' | 'player_insight' | 'team_context' | 'historical_benchmark';
    pattern_type?: string;
    
    source?: 'twitter' | 'nflfastr_analysis' | 'historical_research' | 'aggregated_data_analysis';
    source_handle?: string;
    source_url?: string;
    observation_date?: string;
    
    applicable_to?: string[];
    team?: string;
    
    teaches?: string;
    confidence?: 'high' | 'medium' | 'low';
    epistemic_status?: 'working_assumption' | 'validated_pattern' | 'emerging_signal';
    
    metrics_used?: Array<{
      jargon_term: string;
      nflfastr_field?: string;
      calculation: string;
      queryable: boolean;
      requires_external_data?: string;
    }>;
    
    data_as_of?: string;
    revalidate_weekly?: boolean;
    historical_period?: string;
    
    player_example?: string;
    benchmark_player?: string;
    threshold?: string;
    note?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Leagues table - User-created league contexts (similar to Claude Projects)
export const leagues = pgTable("leagues", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(), // Will integrate auth later
  leagueName: text("league_name").notNull(),
  platform: text("platform").default("sleeper"), // 'sleeper', 'espn', 'yahoo', 'manual'
  leagueIdExternal: text("league_id_external"), // For API sync
  season: integer("season"),
  scoringFormat: text("scoring_format"),
  settings: jsonb("settings").notNull().$type<{
    scoring?: string; // 'ppr', 'half-ppr', 'standard'
    teams?: number;
    rosterSpots?: Record<string, number>;
    playoffs?: Record<string, any>;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("leagues_user_id_idx").on(table.userId),
  platformIdx: index("leagues_platform_idx").on(table.platform),
}));

export const leagueTeams = pgTable("league_teams", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leagueId: varchar("league_id").notNull().references(() => leagues.id, { onDelete: 'cascade' }),
  externalUserId: text("external_user_id"),
  externalRosterId: text("external_roster_id"),
  displayName: text("display_name").notNull(),
  isCommissioner: boolean("is_commissioner").default(false),
  avatar: text("avatar"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  leagueRosterIdx: uniqueIndex("league_teams_league_roster_idx").on(table.leagueId, table.externalRosterId),
  leagueUserIdx: uniqueIndex("league_teams_league_user_idx").on(table.leagueId, table.externalUserId),
}));

export const userLeaguePreferences = pgTable("user_league_preferences", {
  userId: text("user_id").primaryKey(),
  activeLeagueId: varchar("active_league_id").references(() => leagues.id, { onDelete: 'set null' }),
  activeTeamId: varchar("active_team_id").references(() => leagueTeams.id, { onDelete: 'set null' }),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ========================================
// SLEEPER SYNC V2 TABLES
// ========================================

// Sync state tracking per league
export const sleeperSyncState = pgTable("sleeper_sync_state", {
  leagueId: text("league_id").primaryKey(),
  lastSyncedAt: timestamp("last_synced_at"),
  status: text("status").notNull().default("never"), // 'never', 'running', 'ok', 'error'
  lastDurationMs: integer("last_duration_ms"),
  lastError: text("last_error"),
  lastHash: text("last_hash"), // SHA256 of canonical roster string for change detection
  changeSeq: integer("change_seq").notNull().default(0), // Increments on each roster change for dedupe
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Current roster state (upserted on each sync)
export const sleeperRosterCurrent = pgTable("sleeper_roster_current", {
  leagueId: text("league_id").notNull(),
  teamId: text("team_id").notNull(),
  playerKey: text("player_key").notNull(), // gsis_id preferred, else 'sleeper:<id>'
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.leagueId, table.teamId, table.playerKey] }),
  leagueTeamIdx: index("sleeper_roster_current_league_team_idx").on(table.leagueId, table.teamId),
}));

// Ownership events (append-only history)
export const ownershipEvents = pgTable("ownership_events", {
  id: serial("id").primaryKey(),
  leagueId: text("league_id").notNull(),
  playerKey: text("player_key").notNull(),
  fromTeamId: text("from_team_id"),
  toTeamId: text("to_team_id"),
  eventType: text("event_type").notNull(), // 'ADD', 'DROP', 'TRADE'
  eventAt: timestamp("event_at").defaultNow().notNull(),
  week: integer("week"),
  season: integer("season"),
  source: text("source").notNull().default("sleeper"),
  dedupeKey: text("dedupe_key").notNull(), // Unique constraint for idempotency
}, (table) => ({
  dedupeKeyUnique: uniqueIndex("ownership_events_dedupe_key_idx").on(table.dedupeKey),
  leaguePlayerIdx: index("ownership_events_league_player_idx").on(table.leagueId, table.playerKey),
  leagueEventAtIdx: index("ownership_events_league_event_at_idx").on(table.leagueId, table.eventAt),
}));

// Sleeper Sync V2 Insert Schemas
export const insertSleeperSyncStateSchema = createInsertSchema(sleeperSyncState);
export const insertSleeperRosterCurrentSchema = createInsertSchema(sleeperRosterCurrent).omit({ updatedAt: true });
export const insertOwnershipEventSchema = createInsertSchema(ownershipEvents).omit({ id: true, eventAt: true });

// Sleeper Sync V2 Types
export type SleeperSyncState = typeof sleeperSyncState.$inferSelect;
export type InsertSleeperSyncState = z.infer<typeof insertSleeperSyncStateSchema>;
export type SleeperRosterCurrent = typeof sleeperRosterCurrent.$inferSelect;
export type InsertSleeperRosterCurrent = z.infer<typeof insertSleeperRosterCurrentSchema>;
export type OwnershipEvent = typeof ownershipEvents.$inferSelect;
export type InsertOwnershipEvent = z.infer<typeof insertOwnershipEventSchema>;

export const userPlatformProfiles = pgTable("user_platform_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull(),
  platform: text("platform").notNull().default('sleeper'),
  externalUserId: text("external_user_id").notNull(),
  username: text("username"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userPlatformIdx: uniqueIndex("user_platform_profiles_user_platform_idx").on(table.userId, table.platform),
}));

// League context table - Vector-searchable league-specific information
export const leagueContext = pgTable("league_context", {
  id: serial("id").primaryKey(),
  leagueId: varchar("league_id").notNull().references(() => leagues.id, { onDelete: 'cascade' }),
  content: text("content").notNull(), // "User traded CMC for Evans + 2nd round pick"
  embedding: vector("embedding", { dimensions: 768 }), // Gemini Flash embeddings
  metadata: jsonb("metadata").notNull().$type<{
    type?: string; // 'trade', 'roster_move', 'waiver', 'note', 'roster'
    week?: number;
    season?: number;
    players?: string[]; // Player IDs involved
    playerName?: string; // Player name for reliable extraction (added for roster entries)
    tags?: string[]; // [position, team] for roster entries
    synced_at?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  leagueIdIdx: index("league_context_league_id_idx").on(table.leagueId),
}));

// Chat sessions table - User conversation sessions
export const chatSessions = pgTable("chat_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leagueId: varchar("league_id").references(() => leagues.id, { onDelete: 'set null' }), // Link to league context
  userLevel: integer("user_level").default(1).notNull(), // 1-5 skill level
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  leagueIdIdx: index("chat_sessions_league_id_idx").on(table.leagueId),
}));

// Chat messages table - Individual messages in conversations
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id").notNull().references(() => chatSessions.id),
  role: text("role").notNull(), // 'user' or 'assistant'
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  sessionIdIdx: index("chat_messages_session_id_idx").on(table.sessionId),
}));

// ========================================
// PLAYBOOK - USER DECISION JOURNAL
// ========================================

// Playbook entry type enum
export const playbookEntryTypeEnum = pgEnum("playbook_entry_type", [
  "roster_move",
  "trade",
  "waiver_add",
  "waiver_drop",
  "start_sit",
  "note",
  "insight"
]);

// Playbook entries table - User decisions and notes
export const playbookEntries = pgTable("playbook_entries", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  leagueId: varchar("league_id").references(() => leagues.id, { onDelete: 'set null' }),
  teamId: text("team_id"),
  scoringFormat: text("scoring_format"),
  week: integer("week"),
  season: integer("season"),
  entryType: playbookEntryTypeEnum("entry_type").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  playerIds: text("player_ids").array(),
  metadata: jsonb("metadata").$type<{
    forgeAlpha?: Record<string, number>;
    tier?: Record<string, string>;
    linkedFeature?: string;
    tags?: string[];
    summary?: string;
  }>(),
  outcome: text("outcome"),
  regretScore: integer("regret_score"),
  resolvedAt: timestamp("resolved_at"),
  forgeBefore: numeric("forge_before"),
  forgeAfter: numeric("forge_after"),
  tierBefore: text("tier_before"),
  tierAfter: text("tier_after"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("playbook_entries_user_id_idx").on(table.userId),
  leagueIdIdx: index("playbook_entries_league_id_idx").on(table.leagueId),
  entryTypeIdx: index("playbook_entries_type_idx").on(table.entryType),
}));

// Playbook Insert Schema
export const insertPlaybookEntrySchema = createInsertSchema(playbookEntries).omit({ id: true, createdAt: true, updatedAt: true });

// Playbook Types
export type PlaybookEntry = typeof playbookEntries.$inferSelect;
export type InsertPlaybookEntry = z.infer<typeof insertPlaybookEntrySchema>;

// League System Insert Schemas
export const insertLeagueSchema = createInsertSchema(leagues).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLeagueContextSchema = createInsertSchema(leagueContext).omit({ id: true, createdAt: true });

export const leagueDashboardSnapshots = pgTable("league_dashboard_snapshots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  leagueId: text("league_id").notNull(),
  week: integer("week"),
  season: integer("season"),
  payload: jsonb("payload").notNull(),
  computedAt: timestamp("computed_at").defaultNow(),
}, (table) => ({
  leagueSnapshotIdx: uniqueIndex("league_dashboard_snapshots_key").on(table.leagueId, table.week, table.season),
}));

// RAG System Insert Schemas
export const insertChunkSchema = createInsertSchema(chunks).omit({ id: true, createdAt: true });
export const insertChatSessionSchema = createInsertSchema(chatSessions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, createdAt: true });

// League System Types
export type League = typeof leagues.$inferSelect;
export type InsertLeague = z.infer<typeof insertLeagueSchema>;
export type LeagueTeam = typeof leagueTeams.$inferSelect;
export type UserLeaguePreference = typeof userLeaguePreferences.$inferSelect;
export type UserPlatformProfile = typeof userPlatformProfiles.$inferSelect;
export type LeagueContext = typeof leagueContext.$inferSelect;
export type InsertLeagueContext = z.infer<typeof insertLeagueContextSchema>;
export type LeagueDashboardSnapshot = typeof leagueDashboardSnapshots.$inferSelect;

// RAG System Types
export type Chunk = typeof chunks.$inferSelect;
export type InsertChunk = z.infer<typeof insertChunkSchema>;
export type ChatSession = typeof chatSessions.$inferSelect;
export type InsertChatSession = z.infer<typeof insertChatSessionSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;

// Waiver Wisdom Insert Schemas
export const insertSleeperOwnershipSchema = createInsertSchema(sleeperOwnership).omit({ id: true, lastUpdated: true });
export const insertWaiverCandidateSchema = createInsertSchema(waiverCandidates).omit({ id: true, createdAt: true, updatedAt: true });

// Waiver Wisdom Types
export type SleeperOwnership = typeof sleeperOwnership.$inferSelect;
export type InsertSleeperOwnership = z.infer<typeof insertSleeperOwnershipSchema>;
export type WaiverCandidate = typeof waiverCandidates.$inferSelect;
export type InsertWaiverCandidate = z.infer<typeof insertWaiverCandidateSchema>;

// ========================================
// FORGE TEAM ENVIRONMENT + MATCHUP CONTEXT
// ========================================

/**
 * Team Environment Score Table
 * One row per (season, week, team)
 * 
 * Data Sources:
 * - team_offensive_context: cpoe, pass_epa, pressure_rate_allowed
 * - bronze_nflfastr_plays: raw_data.qb_dropback, raw_data.sack, raw_data.score_differential
 * - Aggregated from PBP for: neutral_pass_rate, sack_rate, red zone metrics
 * 
 * env_score_100 formula (0-100, 50 = league average):
 *   0.25 * norm(qb_cpoe) 
 * + 0.25 * norm(qb_epa_per_dropback)
 * + 0.20 * (1 - norm(pressure_rate_allowed))
 * + 0.15 * norm(neutral_pass_rate + proe)
 * + 0.15 * norm(ppg + rz_possessions_per_game)
 */
export const forgeTeamEnvironment = pgTable("forge_team_environment", {
  id: serial("id").primaryKey(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  team: text("team").notNull(),
  
  // Core metrics
  qbCpoe: real("qb_cpoe"),
  qbEpaPerDropback: real("qb_epa_per_dropback"),
  neutralPassRate: real("neutral_pass_rate"),
  proe: real("proe"),
  pressureRateAllowed: real("pressure_rate_allowed"),
  sackRateAllowed: real("sack_rate_allowed"),
  ppg: real("ppg"),
  rzPossessionsPerGame: real("rz_possessions_per_game"),
  rzPassRate: real("rz_pass_rate"),
  
  // Composite scores
  envScoreRaw: real("env_score_raw"),      // 0-1 raw score
  envScore100: integer("env_score_100"),   // 0-100 scaled score (50 = league avg)
  
  // Metadata
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => ({
  uniqueSeasonWeekTeam: unique("forge_env_unique").on(table.season, table.week, table.team),
  seasonWeekIdx: index("forge_env_season_week_idx").on(table.season, table.week),
  teamIdx: index("forge_env_team_idx").on(table.team),
}));

/**
 * Team Matchup Context Score Table
 * One row per (season, week, defense_team, position)
 * 
 * Data Sources:
 * - team_defensive_context: pass_epa_allowed, rush_epa_allowed, pressure_rate_generated
 * - bronze_nflfastr_plays: explosive plays (20+ yards), YAC allowed
 * - silver_player_weekly_stats: fantasy points allowed by position
 * 
 * matchup_score_100 formula varies by position (0-100, 50 = neutral):
 * 
 * WR: 0.30*pass_epa + 0.20*explosive_pass + 0.20*yac + 0.15*(1-pressure) + 0.15*fpts_allowed
 * RB: 0.40*rush_epa + 0.25*fpts_allowed + 0.20*(1-pressure) + 0.15*explosive_rush
 * TE: 0.35*pass_epa + 0.30*fpts_allowed + 0.20*yac + 0.15*(1-pressure)
 */
export const forgeTeamMatchupContext = pgTable("forge_team_matchup_context", {
  id: serial("id").primaryKey(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  defenseTeam: text("defense_team").notNull(),
  position: text("position").notNull(),  // 'WR' | 'RB' | 'TE' | 'QB'
  
  // Defensive metrics
  defPassEpaPerAttempt: real("def_pass_epa_per_attempt"),
  defRushEpaPerRush: real("def_rush_epa_per_rush"),
  defPressureRate: real("def_pressure_rate"),
  defYacPerCompletion: real("def_yac_per_completion"),
  defExplosivePassRateAllowed: real("def_explosive_pass_rate_allowed"),
  defExplosiveRushRateAllowed: real("def_explosive_rush_rate_allowed"),
  fantasyPtsAllowedPerGame: real("fantasy_pts_allowed_per_game"),
  
  // Composite scores
  matchupScoreRaw: real("matchup_score_raw"),     // 0-1 raw score
  matchupScore100: integer("matchup_score_100"), // 0-100 scaled score (50 = neutral)
  
  // Metadata
  sampleSize: integer("sample_size"),           // Number of games in calculation
  lastUpdated: timestamp("last_updated").defaultNow(),
}, (table) => ({
  uniqueSeasonWeekDefPos: unique("forge_matchup_unique").on(table.season, table.week, table.defenseTeam, table.position),
  seasonWeekIdx: index("forge_matchup_season_week_idx").on(table.season, table.week),
  defenseTeamIdx: index("forge_matchup_def_team_idx").on(table.defenseTeam),
  positionIdx: index("forge_matchup_position_idx").on(table.position),
}));

// FORGE Environment + Matchup Types
export type ForgeTeamEnvironment = typeof forgeTeamEnvironment.$inferSelect;
export type InsertForgeTeamEnvironment = typeof forgeTeamEnvironment.$inferInsert;
export type ForgeTeamMatchupContext = typeof forgeTeamMatchupContext.$inferSelect;
export type InsertForgeTeamMatchupContext = typeof forgeTeamMatchupContext.$inferInsert;

/**
 * FORGE Player State Table
 * Recursive scoring state - stores per-player/week/season state for multi-pass scoring
 * 
 * FORGE Recursion v1:
 * - Pass 0: Compute alpha_raw using existing feature weights
 * - Pass 1: Calculate surprise (alpha_raw - expected_alpha), adjust using volatility/momentum
 * - Store alpha_final + updated state for next week's computation
 * 
 * This enables FORGE to be a "recursive, multi-pass scoring engine where each week's
 * score depends not just on current performance, but on how that performance interacts
 * with the player's historical trajectory and stability profile."
 */
export const forgePlayerState = pgTable("forge_player_state", {
  id: serial("id").primaryKey(),
  
  // Identity
  playerId: text("player_id").notNull(),
  playerName: text("player_name"),
  position: text("position"),         // 'QB' | 'RB' | 'WR' | 'TE'
  team: text("team"),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  
  // Previous week's state (inputs to current week's Pass 1)
  alphaPrev: real("alpha_prev"),           // Last week's final alpha
  tierPrev: integer("tier_prev"),          // Last week's tier (1-4)
  volatilityPrev: real("volatility_prev"), // Rolling std dev of alpha over last N weeks
  momentum: real("momentum"),              // Recent alpha avg - seasonal baseline
  
  // Pass 0 output (raw single-pass score)
  alphaRaw: real("alpha_raw"),
  
  // Pass 1 computations (recursive adjustments)
  expectedAlpha: real("expected_alpha"),   // Based on alpha_prev + positional baseline
  surprise: real("surprise"),              // alpha_raw - expected_alpha
  stabilityAdjustment: real("stability_adjustment"), // Adjustment from surprise/volatility/momentum
  
  // Final outputs
  alphaFinal: real("alpha_final"),         // After Pass 1 refinement
  tierFinal: integer("tier_final"),        // Final tier assignment
  confidenceScore: real("confidence_score"), // How confident are we in this score (0-100)
  
  // Volatility computation (for next week)
  alphaHistory: real("alpha_history").array(), // Rolling window of recent alphas
  volatilityUpdated: real("volatility_updated"), // New volatility for next week
  momentumUpdated: real("momentum_updated"),     // New momentum for next week
  
  // Metadata
  computedAt: timestamp("computed_at").defaultNow(),
  passCount: integer("pass_count").default(2),  // Number of scoring passes used
}, (table) => ({
  uniquePlayerSeasonWeek: unique("forge_state_unique").on(table.playerId, table.season, table.week),
  playerIdx: index("forge_state_player_idx").on(table.playerId),
  seasonWeekIdx: index("forge_state_season_week_idx").on(table.season, table.week),
  positionIdx: index("forge_state_position_idx").on(table.position),
}));

// FORGE Player State Types
export type ForgePlayerState = typeof forgePlayerState.$inferSelect;
export type InsertForgePlayerState = typeof forgePlayerState.$inferInsert;

/**
 * FORGE Player State Simulation Table
 * Isolated table for simulation runs - mirrors forge_player_state structure
 * but keeps simulation data separate from production scoring
 */
export const forgePlayerStateSim = pgTable("forge_player_state_sim", {
  id: serial("id").primaryKey(),
  
  // Simulation run identifier
  simRunId: text("sim_run_id").notNull(),
  
  // Identity
  playerId: text("player_id").notNull(),
  playerName: text("player_name"),
  position: text("position"),
  team: text("team"),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  
  // Previous week's state (inputs to current week's Pass 1)
  alphaPrev: real("alpha_prev"),
  tierPrev: integer("tier_prev"),
  volatilityPrev: real("volatility_prev"),
  momentum: real("momentum"),
  
  // Pass 0 output (raw single-pass score)
  alphaRaw: real("alpha_raw"),
  
  // Pass 1 computations (recursive adjustments)
  expectedAlpha: real("expected_alpha"),
  surprise: real("surprise"),
  stabilityAdjustment: real("stability_adjustment"),
  
  // Final outputs
  alphaFinal: real("alpha_final"),
  tierFinal: integer("tier_final"),
  confidenceScore: real("confidence_score"),
  
  // Volatility computation (for next week)
  alphaHistory: real("alpha_history").array(),
  volatilityUpdated: real("volatility_updated"),
  momentumUpdated: real("momentum_updated"),
  
  // Outlier flags
  outlierFlags: text("outlier_flags").array(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: text("reviewed_by"),
  reviewNotes: text("review_notes"),
  
  // Metadata
  computedAt: timestamp("computed_at").defaultNow(),
  passCount: integer("pass_count").default(2),
}, (table) => ({
  simRunIdx: index("forge_sim_run_idx").on(table.simRunId),
  uniqueSimPlayerSeasonWeek: unique("forge_sim_unique").on(table.simRunId, table.playerId, table.season, table.week),
  playerIdx: index("forge_sim_player_idx").on(table.playerId),
  seasonWeekIdx: index("forge_sim_season_week_idx").on(table.season, table.week),
  positionIdx: index("forge_sim_position_idx").on(table.position),
  outlierIdx: index("forge_sim_outlier_idx").on(table.outlierFlags),
}));

export type ForgePlayerStateSim = typeof forgePlayerStateSim.$inferSelect;
export type InsertForgePlayerStateSim = typeof forgePlayerStateSim.$inferInsert;

/**
 * FORGE Simulation Presets
 * Stores named parameter presets for reproducible simulation runs
 */
export const forgeSimPresets = pgTable("forge_sim_presets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  
  // Tunable parameters
  decayRatio: real("decay_ratio").notNull().default(0.7),
  baselineWeight: real("baseline_weight").notNull().default(0.3),
  volatilityHighThreshold: real("volatility_high_threshold").notNull().default(10),
  volatilityLowThreshold: real("volatility_low_threshold").notNull().default(5),
  momentumMultiplier: real("momentum_multiplier").notNull().default(0.15),
  adjustmentCap: real("adjustment_cap").notNull().default(10),
  historyWindowVolatility: integer("history_window_volatility").notNull().default(4),
  historyWindowMomentum: integer("history_window_momentum").notNull().default(3),
  
  // Outlier flag thresholds
  outlierLargeAdjustment: real("outlier_large_adjustment").default(8),
  outlierVolatilitySpike: real("outlier_volatility_spike").default(15),
  
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniqueName: unique("forge_preset_name_unique").on(table.name),
  defaultIdx: index("forge_preset_default_idx").on(table.isDefault),
}));

export type ForgeSimPreset = typeof forgeSimPresets.$inferSelect;
export type InsertForgeSimPreset = typeof forgeSimPresets.$inferInsert;

/**
 * FORGE Simulation Runs
 * Tracks each simulation run with its parameters and status
 */
export const forgeSimRuns = pgTable("forge_sim_runs", {
  id: text("id").primaryKey(),
  presetId: integer("preset_id").references(() => forgeSimPresets.id),
  presetName: text("preset_name"),
  
  // Run configuration
  season: integer("season").notNull(),
  weekStart: integer("week_start").notNull(),
  weekEnd: integer("week_end").notNull(),
  
  // Parameters snapshot (in case preset changes later)
  parametersSnapshot: text("parameters_snapshot"),
  
  // Progress tracking
  status: text("status").notNull().default("pending"),
  currentWeek: integer("current_week"),
  totalPlayers: integer("total_players"),
  processedPlayers: integer("processed_players").default(0),
  
  // Results summary
  outlierCount: integer("outlier_count"),
  avgAdjustmentMagnitude: real("avg_adjustment_magnitude"),
  
  // Timing
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  error: text("error"),
}, (table) => ({
  seasonIdx: index("forge_sim_runs_season_idx").on(table.season),
  statusIdx: index("forge_sim_runs_status_idx").on(table.status),
}));

export type ForgeSimRun = typeof forgeSimRuns.$inferSelect;
export type InsertForgeSimRun = typeof forgeSimRuns.$inferInsert;

// ========================================
// TIBER DATA LAB - OPERATION DATADIVE
// Snapshot-based NFL data spine for reproducible analytics
// ========================================

/**
 * Snapshot Metadata Table
 * Tracks each snapshot run with version, validation status, and audit info
 */
export const datadiveSnapshotMeta = pgTable("datadive_snapshot_meta", {
  id: serial("id").primaryKey(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  dataVersion: text("data_version").default("v1"),
  
  // Validation status
  isOfficial: boolean("is_official").default(false),
  rowCount: integer("row_count").notNull(),
  teamCount: integer("team_count").notNull(),
  validationPassed: boolean("validation_passed").default(false),
  validationErrors: text("validation_errors"),
  
  // Audit
  snapshotAt: timestamp("snapshot_at").defaultNow(),
  triggeredBy: text("triggered_by").default("system"),
}, (table) => ({
  seasonWeekIdx: index("datadive_meta_season_week_idx").on(table.season, table.week),
  officialIdx: index("datadive_meta_official_idx").on(table.isOfficial),
}));

/**
 * Player Week Staging Table
 * Temporary staging area for current week's data before snapshot finalization
 */
export const datadivePlayerWeekStaging = pgTable("datadive_player_week_staging", {
  id: serial("id").primaryKey(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  
  // Player identity
  playerId: text("player_id").notNull(),
  playerName: text("player_name").notNull(),
  teamId: text("team_id"),
  position: text("position"),
  
  // Usage metrics
  snaps: integer("snaps").default(0),
  snapShare: real("snap_share"),
  routes: integer("routes").default(0),
  routeRate: real("route_rate"),
  
  // Receiving metrics
  targets: integer("targets").default(0),
  targetShare: real("target_share"),
  receptions: integer("receptions").default(0),
  recYards: integer("rec_yards").default(0),
  recTds: integer("rec_tds").default(0),
  aDot: real("adot"),
  airYards: integer("air_yards").default(0),
  yac: integer("yac").default(0),
  
  // Advanced efficiency metrics
  tprr: real("tprr"),              // Targets per route run
  yprr: real("yprr"),              // Yards per route run
  epaPerPlay: real("epa_per_play"),
  epaPerTarget: real("epa_per_target"),
  successRate: real("success_rate"),
  
  // Rushing metrics
  rushAttempts: integer("rush_attempts").default(0),
  rushYards: integer("rush_yards").default(0),
  rushTds: integer("rush_tds").default(0),
  yardsPerCarry: real("yards_per_carry"),
  rushEpaPerPlay: real("rush_epa_per_play"),
  
  // Fantasy points
  fptsStd: real("fpts_std"),
  fptsHalf: real("fpts_half"),
  fptsPpr: real("fpts_ppr"),
  
  // Metadata
  stagingAt: timestamp("staging_at").defaultNow(),
}, (table) => ({
  uniquePlayerWeek: unique("datadive_staging_week_unique").on(table.season, table.week, table.playerId),
  playerIdx: index("datadive_staging_player_idx").on(table.playerId),
  seasonWeekIdx: index("datadive_staging_season_week_idx").on(table.season, table.week),
  positionIdx: index("datadive_staging_position_idx").on(table.position),
}));

/**
 * Player Season Staging Table
 * Season-to-date aggregates in staging before snapshot finalization
 */
export const datadivePlayerSeasonStaging = pgTable("datadive_player_season_staging", {
  id: serial("id").primaryKey(),
  season: integer("season").notNull(),
  throughWeek: integer("through_week").notNull(),
  
  // Player identity
  playerId: text("player_id").notNull(),
  playerName: text("player_name").notNull(),
  teamId: text("team_id"),
  position: text("position"),
  gamesPlayed: integer("games_played").default(0),
  
  // Cumulative usage
  totalSnaps: integer("total_snaps").default(0),
  avgSnapShare: real("avg_snap_share"),
  totalRoutes: integer("total_routes").default(0),
  avgRouteRate: real("avg_route_rate"),
  
  // Cumulative receiving
  totalTargets: integer("total_targets").default(0),
  avgTargetShare: real("avg_target_share"),
  totalReceptions: integer("total_receptions").default(0),
  totalRecYards: integer("total_rec_yards").default(0),
  totalRecTds: integer("total_rec_tds").default(0),
  avgAdot: real("avg_adot"),
  totalAirYards: integer("total_air_yards").default(0),
  totalYac: integer("total_yac").default(0),
  
  // Season efficiency averages
  avgTprr: real("avg_tprr"),
  avgYprr: real("avg_yprr"),
  avgEpaPerPlay: real("avg_epa_per_play"),
  avgSuccessRate: real("avg_success_rate"),
  
  // Cumulative rushing
  totalRushAttempts: integer("total_rush_attempts").default(0),
  totalRushYards: integer("total_rush_yards").default(0),
  totalRushTds: integer("total_rush_tds").default(0),
  avgYpc: real("avg_ypc"),
  
  // Cumulative fantasy
  totalFptsStd: real("total_fpts_std"),
  totalFptsHalf: real("total_fpts_half"),
  totalFptsPpr: real("total_fpts_ppr"),
  avgFptsPerGame: real("avg_fpts_per_game"),
  
  // Metadata
  stagingAt: timestamp("staging_at").defaultNow(),
}, (table) => ({
  uniquePlayerSeason: unique("datadive_staging_season_unique").on(table.season, table.throughWeek, table.playerId),
  playerIdx: index("datadive_staging_season_player_idx").on(table.playerId),
  seasonIdx: index("datadive_staging_season_season_idx").on(table.season, table.throughWeek),
}));

/**
 * Snapshot Player Week Table
 * Finalized weekly player data tied to a specific snapshot
 * Immutable once written - serves as the canonical record for that snapshot
 */
export const datadiveSnapshotPlayerWeek = pgTable("datadive_snapshot_player_week", {
  id: serial("id").primaryKey(),
  snapshotId: integer("snapshot_id").references(() => datadiveSnapshotMeta.id).notNull(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  
  // Player identity
  playerId: text("player_id").notNull(),
  playerName: text("player_name").notNull(),
  teamId: text("team_id"),
  position: text("position"),
  
  // Usage metrics
  snaps: integer("snaps").default(0),
  snapShare: real("snap_share"),
  routes: integer("routes").default(0),
  routeRate: real("route_rate"),
  
  // Receiving metrics
  targets: integer("targets").default(0),
  targetShare: real("target_share"),
  receptions: integer("receptions").default(0),
  recYards: integer("rec_yards").default(0),
  recTds: integer("rec_tds").default(0),
  aDot: real("adot"),
  airYards: integer("air_yards").default(0),
  yac: integer("yac").default(0),
  
  // Advanced efficiency metrics
  tprr: real("tprr"),
  yprr: real("yprr"),
  epaPerPlay: real("epa_per_play"),
  epaPerTarget: real("epa_per_target"),
  successRate: real("success_rate"),
  
  // Rushing metrics
  rushAttempts: integer("rush_attempts").default(0),
  rushYards: integer("rush_yards").default(0),
  rushTds: integer("rush_tds").default(0),
  yardsPerCarry: real("yards_per_carry"),
  rushEpaPerPlay: real("rush_epa_per_play"),
  
  // Fantasy points
  fptsStd: real("fpts_std"),
  fptsHalf: real("fpts_half"),
  fptsPpr: real("fpts_ppr"),
}, (table) => ({
  uniqueSnapshotPlayerWeek: unique("datadive_snapshot_week_unique").on(table.snapshotId, table.playerId),
  snapshotIdx: index("datadive_snapshot_week_snapshot_idx").on(table.snapshotId),
  playerIdx: index("datadive_snapshot_week_player_idx").on(table.playerId),
  seasonWeekIdx: index("datadive_snapshot_week_season_week_idx").on(table.season, table.week),
  positionIdx: index("datadive_snapshot_week_position_idx").on(table.position),
  teamIdx: index("datadive_snapshot_week_team_idx").on(table.teamId),
}));

/**
 * Snapshot Player Season Table
 * Finalized season-to-date aggregates tied to a specific snapshot
 * Immutable once written - serves as the canonical record for that snapshot
 */
export const datadiveSnapshotPlayerSeason = pgTable("datadive_snapshot_player_season", {
  id: serial("id").primaryKey(),
  snapshotId: integer("snapshot_id").references(() => datadiveSnapshotMeta.id).notNull(),
  season: integer("season").notNull(),
  throughWeek: integer("through_week").notNull(),
  
  // Player identity
  playerId: text("player_id").notNull(),
  playerName: text("player_name").notNull(),
  teamId: text("team_id"),
  position: text("position"),
  gamesPlayed: integer("games_played").default(0),
  
  // Cumulative usage
  totalSnaps: integer("total_snaps").default(0),
  avgSnapShare: real("avg_snap_share"),
  totalRoutes: integer("total_routes").default(0),
  avgRouteRate: real("avg_route_rate"),
  
  // Cumulative receiving
  totalTargets: integer("total_targets").default(0),
  avgTargetShare: real("avg_target_share"),
  totalReceptions: integer("total_receptions").default(0),
  totalRecYards: integer("total_rec_yards").default(0),
  totalRecTds: integer("total_rec_tds").default(0),
  avgAdot: real("avg_adot"),
  totalAirYards: integer("total_air_yards").default(0),
  totalYac: integer("total_yac").default(0),
  
  // Season efficiency averages
  avgTprr: real("avg_tprr"),
  avgYprr: real("avg_yprr"),
  avgEpaPerPlay: real("avg_epa_per_play"),
  avgSuccessRate: real("avg_success_rate"),
  
  // Cumulative rushing
  totalRushAttempts: integer("total_rush_attempts").default(0),
  totalRushYards: integer("total_rush_yards").default(0),
  totalRushTds: integer("total_rush_tds").default(0),
  avgYpc: real("avg_ypc"),
  
  // Cumulative fantasy
  totalFptsStd: real("total_fpts_std"),
  totalFptsHalf: real("total_fpts_half"),
  totalFptsPpr: real("total_fpts_ppr"),
  avgFptsPerGame: real("avg_fpts_per_game"),
}, (table) => ({
  uniqueSnapshotPlayerSeason: unique("datadive_snapshot_season_unique").on(table.snapshotId, table.playerId),
  snapshotIdx: index("datadive_snapshot_season_snapshot_idx").on(table.snapshotId),
  playerIdx: index("datadive_snapshot_season_player_idx").on(table.playerId),
  seasonIdx: index("datadive_snapshot_season_season_idx").on(table.season, table.throughWeek),
}));

/**
 * nflfastR Metrics Table
 * Per-player, per-week context metrics from nflfastR for xFPTS v2 calculations
 * Stores RZ usage, YAC, rushing EPA/success for context-aware expected fantasy
 */
export const datadiveNflfastrMetrics = pgTable("datadive_nflfastr_metrics", {
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  playerId: text("player_id").notNull(),
  position: text("position"),
  
  targets: integer("targets"),
  airYards: real("air_yards"),
  yacPerRec: real("yac_per_rec"),
  rzTargets: integer("rz_targets"),
  rzCarries: integer("rz_carries"),
  rushEpa: real("rush_epa"),
  rushSuccess: real("rush_success"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.season, table.week, table.playerId] }),
  seasonWeekIdx: index("datadive_nflfastr_season_week_idx").on(table.season, table.week),
}));

/**
 * Expected Fantasy Week Table
 * Stores v1 (usage-only) and v2 (context-aware) expected fantasy points per player-week
 * Includes debug multipliers for transparency
 */
export const datadiveExpectedFantasyWeek = pgTable("datadive_expected_fantasy_week", {
  id: serial("id").primaryKey(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  playerId: text("player_id").notNull(),
  position: text("position"),
  
  actualPpr: real("actual_ppr"),
  
  xPprV1: real("x_ppr_v1"),
  xfpgoePprV1: real("xfpgoe_ppr_v1"),
  
  xPprV2: real("x_ppr_v2"),
  xfpgoePprV2: real("xfpgoe_ppr_v2"),
  
  recMultiplier: real("rec_multiplier"),
  rushMultiplier: real("rush_multiplier"),
  rzShare: real("rz_share"),
  yacRatio: real("yac_ratio"),
  rushEpaCtx: real("rush_epa_ctx"),
  rushSuccessCtx: real("rush_success_ctx"),
  
  expectedRecPprV1: real("expected_rec_ppr_v1"),
  expectedRushPprV1: real("expected_rush_ppr_v1"),
  expectedRecPprV2: real("expected_rec_ppr_v2"),
  expectedRushPprV2: real("expected_rush_ppr_v2"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniquePlayerWeek: unique("datadive_xfpts_week_unique").on(table.season, table.week, table.playerId),
  seasonWeekIdx: index("datadive_xfpts_season_week_idx").on(table.season, table.week),
  playerIdx: index("datadive_xfpts_player_idx").on(table.playerId),
}));

// DataDive Types
export type DatadiveSnapshotMeta = typeof datadiveSnapshotMeta.$inferSelect;
export type InsertDatadiveSnapshotMeta = typeof datadiveSnapshotMeta.$inferInsert;
export type DatadivePlayerWeekStaging = typeof datadivePlayerWeekStaging.$inferSelect;
export type InsertDatadivePlayerWeekStaging = typeof datadivePlayerWeekStaging.$inferInsert;
export type DatadivePlayerSeasonStaging = typeof datadivePlayerSeasonStaging.$inferSelect;
export type InsertDatadivePlayerSeasonStaging = typeof datadivePlayerSeasonStaging.$inferInsert;
export type DatadiveSnapshotPlayerWeek = typeof datadiveSnapshotPlayerWeek.$inferSelect;
export type InsertDatadiveSnapshotPlayerWeek = typeof datadiveSnapshotPlayerWeek.$inferInsert;
export type DatadiveSnapshotPlayerSeason = typeof datadiveSnapshotPlayerSeason.$inferSelect;
export type InsertDatadiveSnapshotPlayerSeason = typeof datadiveSnapshotPlayerSeason.$inferInsert;
export type DatadiveNflfastrMetrics = typeof datadiveNflfastrMetrics.$inferSelect;
export type InsertDatadiveNflfastrMetrics = typeof datadiveNflfastrMetrics.$inferInsert;
export type DatadiveExpectedFantasyWeek = typeof datadiveExpectedFantasyWeek.$inferSelect;
export type InsertDatadiveExpectedFantasyWeek = typeof datadiveExpectedFantasyWeek.$inferInsert;

// ========================================
// QB CONTEXT v1 - TEAM-TO-QB MAPPING
// ========================================

/**
 * QB Context 2025 - Maps each team to their primary QB with context scores
 * Used by FORGE to provide QB-aware teamContext and dynastyContext for WR/RB/TE
 */
export const qbContext2025 = pgTable("qb_context_2025", {
  id: serial("id").primaryKey(),
  
  // QB identification
  qbId: text("qb_id").notNull(), // NFLfastR player ID
  qbName: text("qb_name").notNull(), // Display name
  teamId: text("team_id").notNull(), // Team abbreviation (CIN, DAL, etc.)
  season: integer("season").notNull().default(2025),
  
  // Depth chart position
  depthChartRank: integer("depth_chart_rank").notNull().default(1), // 1 = starter, 2 = backup
  isPrimaryQb: boolean("is_primary_qb").notNull().default(true),
  
  // Core QB scores (0-100)
  qbSkillScore: real("qb_skill_score").notNull().default(50), // QB's FORGE alpha
  qbRedraftScore: real("qb_redraft_score").notNull().default(50), // Current-season value
  qbDynastyScore: real("qb_dynasty_score").notNull().default(50), // Long-term value
  qbStabilityScore: real("qb_stability_score").notNull().default(50), // Games started continuity
  qbDurabilityScore: real("qb_durability_score").notNull().default(50), // Inverse of missed games
  
  // Additional context
  qbAge: integer("qb_age"), // Current age for dynasty curves
  gamesStartedRecent: integer("games_started_recent"), // Total games started last 2-3 seasons
  gamesStartedCurrentSeason: integer("games_started_current_season"), // Games in current season
  
  // Offensive metrics used in calculations
  epaPerPlay: real("epa_per_play"),
  cpoe: real("cpoe"),
  teamPassEpa: real("team_pass_epa"),
  
  // Metadata
  isActive: boolean("is_active").notNull().default(true),
  calculatedAt: timestamp("calculated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  teamSeasonIdx: index("qb_context_2025_team_season_idx").on(table.teamId, table.season),
  primaryQbIdx: index("qb_context_2025_primary_idx").on(table.teamId, table.season, table.isPrimaryQb),
  uniqueQbTeamSeason: unique("qb_context_2025_unique").on(table.qbId, table.teamId, table.season),
}));

export const insertQbContext2025Schema = createInsertSchema(qbContext2025).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  calculatedAt: true 
});
export type InsertQbContext2025 = z.infer<typeof insertQbContext2025Schema>;
export type QbContext2025 = typeof qbContext2025.$inferSelect;

// ========================================
// SIMILAR PLAYERS CACHE
// ========================================

/**
 * Cache for similar players computed via Metric Matrix vector distance
 * Used by /api/players/similar endpoint to avoid recomputation
 */
export const similarPlayersCache = pgTable("similar_players_cache", {
  id: serial("id").primaryKey(),
  
  // Query params
  playerId: text("player_id").notNull(),
  season: integer("season").notNull(),
  week: integer("week").notNull(),
  mode: text("mode").notNull().default("forge"),
  
  // Cached results
  similarPlayersJson: jsonb("similar_players_json").notNull(), // Array of similar player objects
  baseConfidence: real("base_confidence"), // Confidence of the base player vector
  
  // Metadata
  computedAt: timestamp("computed_at").defaultNow(),
}, (table) => ({
  uniqueQuery: unique("similar_players_cache_unique").on(table.playerId, table.season, table.week, table.mode),
  playerIdx: index("similar_players_cache_player_idx").on(table.playerId),
}));

export type SimilarPlayersCache = typeof similarPlayersCache.$inferSelect;
export type InsertSimilarPlayersCache = typeof similarPlayersCache.$inferInsert;
