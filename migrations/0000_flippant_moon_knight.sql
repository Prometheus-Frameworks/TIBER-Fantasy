CREATE TYPE "public"."consensus_format" AS ENUM('redraft', 'dynasty');--> statement-breakpoint
CREATE TYPE "public"."consensus_source" AS ENUM('system', 'editor', 'community');--> statement-breakpoint
CREATE TYPE "public"."data_quality" AS ENUM('HIGH', 'MEDIUM', 'LOW', 'MISSING');--> statement-breakpoint
CREATE TYPE "public"."data_source" AS ENUM('sleeper', 'nfl_data_py', 'fantasypros', 'mysportsfeeds', 'espn', 'yahoo', 'manual', 'computed');--> statement-breakpoint
CREATE TYPE "public"."format" AS ENUM('redraft', 'dynasty');--> statement-breakpoint
CREATE TYPE "public"."ingest_status" AS ENUM('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED', 'PARTIAL');--> statement-breakpoint
CREATE TYPE "public"."ppr" AS ENUM('ppr', 'half', 'standard');--> statement-breakpoint
CREATE TYPE "public"."uph_job_status" AS ENUM('PENDING', 'RUNNING', 'SUCCESS', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."uph_job_type" AS ENUM('WEEKLY', 'SEASON', 'BACKFILL', 'INCREMENTAL');--> statement-breakpoint
CREATE TYPE "public"."uph_task_type" AS ENUM('BRONZE_INGEST', 'SILVER_TRANSFORM', 'GOLD_FACTS', 'QUALITY_GATE');--> statement-breakpoint
CREATE TYPE "public"."verdict" AS ENUM('BUY_HARD', 'BUY', 'WATCH_BUY', 'HOLD', 'WATCH_SELL', 'SELL', 'SELL_HARD');--> statement-breakpoint
CREATE TABLE "advanced_signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" text NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"ypc" real,
	"snap_share" real,
	"epa_rush" real,
	"broken_tackles" integer,
	"redzone_touches" integer,
	"trend_multiplier" real,
	"rolling_avg_3wk" jsonb,
	"opponent_adjusted_score" real,
	"target_share" real,
	"air_yards" real,
	"separation_score" real,
	"pressure_rate" real,
	"usage_spike" boolean DEFAULT false,
	"injury_opportunity" boolean DEFAULT false,
	"data_source" text DEFAULT 'computed',
	"confidence" real DEFAULT 0.8,
	"last_updated" timestamp DEFAULT now(),
	CONSTRAINT "advanced_signals_unique" UNIQUE("player_id","season","week")
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"content" text NOT NULL,
	"excerpt" text,
	"category" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"read_time" text NOT NULL,
	"publish_date" timestamp DEFAULT now(),
	"last_updated" timestamp DEFAULT now(),
	"featured" boolean DEFAULT false,
	"published" boolean DEFAULT true,
	"author" text NOT NULL,
	"author_bio" text,
	"meta_keywords" text[] DEFAULT '{}',
	"view_count" integer DEFAULT 0,
	CONSTRAINT "articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "buys_sells" (
	"player_id" text NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"position" text NOT NULL,
	"verdict" "verdict" NOT NULL,
	"verdict_score" real NOT NULL,
	"confidence" real NOT NULL,
	"gap_z" real NOT NULL,
	"signal" real NOT NULL,
	"market_momentum" real NOT NULL,
	"risk_penalty" real NOT NULL,
	"format" "format" NOT NULL,
	"ppr" "ppr" NOT NULL,
	"proof" jsonb NOT NULL,
	"explanation" text NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"hit_rate" real,
	CONSTRAINT "buys_sells_player_id_season_week_format_ppr_pk" PRIMARY KEY("player_id","season","week","format","ppr")
);
--> statement-breakpoint
CREATE TABLE "consensus_audit" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season" integer NOT NULL,
	"mode" varchar NOT NULL,
	"position" varchar NOT NULL,
	"rank" integer NOT NULL,
	"player_id" varchar NOT NULL,
	"previous_player_id" varchar,
	"source_user" varchar NOT NULL,
	"action" varchar NOT NULL,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "consensus_board" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar NOT NULL,
	"format" "consensus_format" NOT NULL,
	"season" integer,
	"rank" integer NOT NULL,
	"tier" varchar NOT NULL,
	"score" real NOT NULL,
	"source" "consensus_source" DEFAULT 'system' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consensus_changelog" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"user_id" varchar,
	"format" "consensus_format" NOT NULL,
	"season" integer,
	"player_id" varchar NOT NULL,
	"before" jsonb,
	"after" jsonb
);
--> statement-breakpoint
CREATE TABLE "consensus_explanations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar NOT NULL,
	"format" varchar NOT NULL,
	"season" integer,
	"decay_days" integer NOT NULL,
	"surge_active" boolean DEFAULT false,
	"base_rank" real NOT NULL,
	"adjusted_rank" real NOT NULL,
	"explanation" jsonb NOT NULL,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "consensus_meta" (
	"id" varchar PRIMARY KEY DEFAULT 'singleton' NOT NULL,
	"default_format" "consensus_format" DEFAULT 'dynasty' NOT NULL,
	"board_version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "consensus_ranks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season" integer DEFAULT 2025 NOT NULL,
	"mode" varchar NOT NULL,
	"position" varchar NOT NULL,
	"rank" integer NOT NULL,
	"player_id" varchar NOT NULL,
	"source_user" varchar DEFAULT 'architect-j' NOT NULL,
	"source_weight" real DEFAULT 1 NOT NULL,
	"note" varchar,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "data_lineage" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"table_name" text NOT NULL,
	"operation" text NOT NULL,
	"source_table" text,
	"source_job_id" text,
	"ingest_payload_id" integer,
	"records_processed" integer DEFAULT 0 NOT NULL,
	"records_success" integer DEFAULT 0 NOT NULL,
	"records_failed" integer DEFAULT 0 NOT NULL,
	"records_skipped" integer DEFAULT 0 NOT NULL,
	"quality_score" real,
	"completeness_score" real,
	"freshness_score" real,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"error_message" text,
	"execution_context" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dataset_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"dataset" text NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"row_count" integer NOT NULL,
	"committed_at" timestamp DEFAULT now() NOT NULL,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "defense_context" (
	"id" serial PRIMARY KEY NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"def_team" text NOT NULL,
	"epa_per_play_allowed" real,
	"plays_allowed_per_game" real,
	"rz_td_rate_allowed" real,
	"home_def_adj" real,
	"away_def_adj" real,
	CONSTRAINT "defense_context_season_week_def_team_unique" UNIQUE("season","week","def_team")
);
--> statement-breakpoint
CREATE TABLE "defense_dvp" (
	"id" serial PRIMARY KEY NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"def_team" text NOT NULL,
	"position" text NOT NULL,
	"fp_allowed" real NOT NULL,
	"yds_per_att" real,
	"rz_td_rate" real,
	"inj_adj" real DEFAULT 0,
	"last4_avg" real,
	CONSTRAINT "defense_dvp_season_week_def_team_position_unique" UNIQUE("season","week","def_team","position")
);
--> statement-breakpoint
CREATE TABLE "depth_charts" (
	"id" serial PRIMARY KEY NOT NULL,
	"canonical_player_id" text NOT NULL,
	"team_code" text NOT NULL,
	"position" text NOT NULL,
	"position_group" text,
	"depth_order" integer NOT NULL,
	"season" integer NOT NULL,
	"week" integer,
	"role" text,
	"packages" text[] DEFAULT '{}',
	"source" "data_source" NOT NULL,
	"confidence" real DEFAULT 0.8,
	"effective_date" timestamp NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "depth_unique_position" UNIQUE("canonical_player_id","team_code","position","season","week")
);
--> statement-breakpoint
CREATE TABLE "draft_picks" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"round" integer NOT NULL,
	"pick" integer NOT NULL,
	"original_pick" text NOT NULL,
	"year" integer NOT NULL,
	"player_id" integer,
	"player_name" text,
	"position" text,
	"pick_value" integer NOT NULL,
	"player_current_value" integer,
	"acquired_via" text,
	"trade_context" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "dynasty_trade_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"trade_partner_team_id" integer,
	"players_given" text NOT NULL,
	"players_received" text NOT NULL,
	"draft_picks_given" text,
	"draft_picks_received" text,
	"trade_date" timestamp DEFAULT now(),
	"trade_value" real,
	"current_value" real,
	"trade_grade" text,
	"notes" text,
	"league_id" text,
	"external_trade_id" text,
	"season" integer DEFAULT 2024 NOT NULL,
	"week" integer
);
--> statement-breakpoint
CREATE TABLE "fantasy_moves" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"move_type" text NOT NULL,
	"move_date" timestamp NOT NULL,
	"description" text NOT NULL,
	"value_gained" integer NOT NULL,
	"value_lost" integer NOT NULL,
	"net_value" integer NOT NULL,
	"players_acquired" jsonb,
	"players_lost" jsonb,
	"picks_acquired" jsonb,
	"picks_lost" jsonb,
	"current_value_gained" integer,
	"current_value_lost" integer,
	"current_net_value" integer,
	"trade_partner" text,
	"waiver_priority" integer,
	"season" integer NOT NULL,
	"week" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fire_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_user_id" varchar NOT NULL,
	"to_user_id" varchar NOT NULL,
	"target_type" varchar NOT NULL,
	"target_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "game_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"sleeper_id" text NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"season_type" text NOT NULL,
	"opponent" text,
	"game_date" timestamp,
	"fantasy_points" real,
	"fantasy_points_ppr" real,
	"fantasy_points_half_ppr" real,
	"pass_attempts" integer,
	"pass_completions" integer,
	"pass_yards" integer,
	"pass_td" integer,
	"pass_int" integer,
	"pass_2pt" integer,
	"rush_attempts" integer,
	"rush_yards" integer,
	"rush_td" integer,
	"rush_2pt" integer,
	"receptions" integer,
	"targets" integer,
	"rec_yards" integer,
	"rec_td" integer,
	"rec_2pt" integer,
	"fumbles" integer,
	"fumbles_lost" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "game_logs_sleeper_id_season_week_season_type_unique" UNIQUE("sleeper_id","season","week","season_type")
);
--> statement-breakpoint
CREATE TABLE "ingest_payloads" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" "data_source" NOT NULL,
	"endpoint" text NOT NULL,
	"payload" jsonb NOT NULL,
	"version" text NOT NULL,
	"job_id" text NOT NULL,
	"season" integer NOT NULL,
	"week" integer,
	"status" "ingest_status" DEFAULT 'PENDING' NOT NULL,
	"record_count" integer,
	"error_message" text,
	"checksum_hash" text,
	"ingested_at" timestamp DEFAULT now(),
	"processed_at" timestamp,
	CONSTRAINT "ingest_unique" UNIQUE("source","endpoint","checksum_hash")
);
--> statement-breakpoint
CREATE TABLE "injuries" (
	"id" serial PRIMARY KEY NOT NULL,
	"canonical_player_id" text NOT NULL,
	"injury_type" text,
	"body_part" text,
	"severity" text,
	"status" text NOT NULL,
	"practice_status" text,
	"injury_date" timestamp,
	"expected_return" timestamp,
	"actual_return" timestamp,
	"season" integer NOT NULL,
	"week" integer,
	"game_date" timestamp,
	"source" "data_source" NOT NULL,
	"reported_by" text,
	"confidence" real DEFAULT 0.8,
	"description" text,
	"impact_assessment" text,
	"reported_at" timestamp NOT NULL,
	"is_resolved" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "injury_tracker" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"injury_type" text,
	"severity" text,
	"expected_return" timestamp,
	"impact_description" text,
	"replacement_suggestions" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"job_id" text PRIMARY KEY NOT NULL,
	"type" "uph_job_type" NOT NULL,
	"status" "uph_job_status" DEFAULT 'PENDING' NOT NULL,
	"season" integer,
	"week" integer,
	"sources" text[] DEFAULT '{}',
	"started_at" timestamp,
	"ended_at" timestamp,
	"attempt" integer DEFAULT 1 NOT NULL,
	"stats" jsonb,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "lineup_optimization" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"week" integer NOT NULL,
	"optimized_lineup" text NOT NULL,
	"projected_points" real NOT NULL,
	"confidence" real,
	"factors" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "market_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"source" varchar(50) NOT NULL,
	"adp" real,
	"adp_rank" integer,
	"ownership_percent" real,
	"trade_value" real,
	"consensus_rank" integer,
	"week" integer,
	"season" integer NOT NULL,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "market_rollups" (
	"id" serial PRIMARY KEY NOT NULL,
	"canonical_player_id" text NOT NULL,
	"season" integer NOT NULL,
	"week" integer,
	"rollup_type" text NOT NULL,
	"adp_trend" real,
	"ecr_trend" real,
	"ownership_trend" real,
	"start_pct_trend" real,
	"adp_consensus" real,
	"adp_std_dev" real,
	"ecr_consensus" real,
	"ecr_std_dev" real,
	"source_count" integer DEFAULT 0 NOT NULL,
	"sample_size" integer,
	"confidence_interval" real,
	"momentum_score" real,
	"volatility_score" real,
	"trend_strength" real,
	"source_mask" integer DEFAULT 0 NOT NULL,
	"freshness_score" real DEFAULT 0 NOT NULL,
	"quality_gates_passed" boolean DEFAULT false NOT NULL,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"valid_from" timestamp NOT NULL,
	"valid_to" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "mr_unique_rollup" UNIQUE("canonical_player_id","season","week","rollup_type")
);
--> statement-breakpoint
CREATE TABLE "market_signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"canonical_player_id" text NOT NULL,
	"source" "data_source" NOT NULL,
	"signal_type" text NOT NULL,
	"overall_rank" integer,
	"positional_rank" integer,
	"value" real,
	"season" integer NOT NULL,
	"week" integer,
	"league_format" text,
	"scoring_format" text,
	"sample_size" integer,
	"confidence" real DEFAULT 0.8,
	"data_quality" "data_quality" DEFAULT 'MEDIUM' NOT NULL,
	"extracted_at" timestamp NOT NULL,
	"valid_from" timestamp NOT NULL,
	"valid_to" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "market_unique_signal" UNIQUE("canonical_player_id","source","signal_type","season","week","league_format","scoring_format")
);
--> statement-breakpoint
CREATE TABLE "matchup_analysis" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"week" integer NOT NULL,
	"opponent" text NOT NULL,
	"difficulty" text NOT NULL,
	"defense_rank" integer,
	"projected_points" real,
	"weather_impact" text,
	"is_home" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "metric_correlations" (
	"id" serial PRIMARY KEY NOT NULL,
	"position" varchar(10) NOT NULL,
	"metric_name" varchar(100) NOT NULL,
	"correlation_to_fantasy" real,
	"correlation_to_adp" real,
	"sample_size" integer,
	"season" integer NOT NULL,
	"last_calculated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "monitoring_job_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_name" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"duration_ms" integer,
	"details" jsonb
);
--> statement-breakpoint
CREATE TABLE "nfl_teams_dim" (
	"team_code" text PRIMARY KEY NOT NULL,
	"team_name" text NOT NULL,
	"team_city" text NOT NULL,
	"team_nickname" text NOT NULL,
	"conference" text NOT NULL,
	"division" text NOT NULL,
	"primary_color" text,
	"secondary_color" text,
	"logo_url" text,
	"stadium_name" text,
	"stadium_city" text,
	"timezone" text,
	"is_active" boolean DEFAULT true,
	"sleeper_id" text,
	"espn_id" text,
	"yahoo_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "player_advanced_2024" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" text,
	"player_name" text,
	"team" text,
	"position" text,
	"games" smallint,
	"adot" real,
	"yprr" real,
	"racr" real,
	"target_share" real,
	"wopr" real,
	"rush_expl_10p" real,
	"aypa" real,
	"epa_per_play" real
);
--> statement-breakpoint
CREATE TABLE "player_bios" (
	"player_id" varchar PRIMARY KEY NOT NULL,
	"pos" varchar NOT NULL,
	"age" integer NOT NULL,
	"team" varchar,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "player_composite_facts" (
	"canonical_player_id" text NOT NULL,
	"season" integer NOT NULL,
	"dynasty_rank" integer,
	"redraft_rank" integer,
	"bestball_rank" integer,
	"trade_value_rank" integer,
	"dynasty_score" real,
	"redraft_score" real,
	"bestball_score" real,
	"trade_value_score" real,
	"overall_talent_grade" real,
	"opportunity_grade" real,
	"consistency_grade" real,
	"ceiling_grade" real,
	"floor_grade" real,
	"injury_risk" real,
	"age_risk" real,
	"situation_risk" real,
	"overall_risk_grade" real,
	"momentum_score" real,
	"trajectory_score" real,
	"breakout_probability" real,
	"bust_probability" real,
	"position_value_score" real,
	"sos_impact" real,
	"team_context_score" real,
	"contributing_fact_tables" text[] DEFAULT '{}',
	"source_mask" integer DEFAULT 0 NOT NULL,
	"freshness_score" real DEFAULT 0 NOT NULL,
	"quality_gates_passed" boolean DEFAULT false NOT NULL,
	"completeness_score" real DEFAULT 0 NOT NULL,
	"confidence_score" real DEFAULT 0.5 NOT NULL,
	"last_refreshed" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "player_composite_facts_canonical_player_id_season_pk" PRIMARY KEY("canonical_player_id","season")
);
--> statement-breakpoint
CREATE TABLE "player_identity_map" (
	"canonical_id" text PRIMARY KEY NOT NULL,
	"full_name" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"position" text NOT NULL,
	"nfl_team" text,
	"sleeper_id" text,
	"espn_id" text,
	"yahoo_id" text,
	"rotowire_id" text,
	"fantasy_data_id" text,
	"fantasypros_id" text,
	"mysportsfeeds_id" text,
	"nfl_data_py_id" text,
	"jersey_number" integer,
	"birth_date" timestamp,
	"college" text,
	"height" text,
	"weight" integer,
	"is_active" boolean DEFAULT true,
	"confidence" real DEFAULT 1,
	"last_verified" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "player_injuries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar NOT NULL,
	"status" varchar NOT NULL,
	"injury_type" varchar,
	"date_placed" timestamp,
	"est_return_weeks" integer,
	"out_for_season" boolean DEFAULT false,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "player_market_facts" (
	"id" serial PRIMARY KEY NOT NULL,
	"canonical_player_id" text NOT NULL,
	"season" integer NOT NULL,
	"week" integer,
	"avg_adp" real,
	"adp_trend_7d" real,
	"adp_trend_30d" real,
	"adp_volatility" real,
	"avg_ecr" real,
	"ecr_trend_7d" real,
	"ecr_trend_30d" real,
	"ecr_consensus" real,
	"average_ownership" real,
	"ownership_trend_7d" real,
	"ownership_momentum" real,
	"expert_buy_rating" real,
	"community_buzz_score" real,
	"momentum_score" real,
	"volatility_index" real,
	"value_over_replacement" real,
	"position_market_share" real,
	"tier_breakout_score" real,
	"contrary_indicator" real,
	"source_mask" integer DEFAULT 0 NOT NULL,
	"sample_size" integer DEFAULT 0,
	"freshness_score" real DEFAULT 0 NOT NULL,
	"quality_gates_passed" boolean DEFAULT false NOT NULL,
	"confidence_score" real DEFAULT 0.5 NOT NULL,
	"calculated_at" timestamp DEFAULT now() NOT NULL,
	"valid_from" timestamp NOT NULL,
	"valid_to" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "pmf_unique" UNIQUE("canonical_player_id","season","week")
);
--> statement-breakpoint
CREATE TABLE "player_season_2024" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" text,
	"player_name" text NOT NULL,
	"position" text NOT NULL,
	"team" text,
	"games" integer,
	"targets" integer,
	"receptions" integer,
	"rec_yards" integer,
	"rec_tds" integer,
	"routes" integer,
	"yprr" real,
	"adot" real,
	"racr" real,
	"target_share" real,
	"wopr" real,
	"rush_att" integer,
	"rush_yards" integer,
	"rush_tds" integer,
	"rush_ypc" real,
	"rush_yac_per_att" real,
	"rush_mtf" integer,
	"rush_expl_10p" real,
	"cmp" integer,
	"att" integer,
	"cmp_pct" real,
	"pass_yards" integer,
	"pass_tds" integer,
	"int" integer,
	"ypa" real,
	"aypa" real,
	"epa_per_play" real,
	"qb_rush_yards" integer,
	"qb_rush_tds" integer,
	"fpts" real,
	"fpts_ppr" real,
	"td_total" integer,
	"last_updated" timestamp DEFAULT now(),
	CONSTRAINT "player_season_2024_unique" UNIQUE("player_name","position","team")
);
--> statement-breakpoint
CREATE TABLE "player_season_facts" (
	"canonical_player_id" text NOT NULL,
	"season" integer NOT NULL,
	"position" text NOT NULL,
	"nfl_team" text NOT NULL,
	"games_played" integer DEFAULT 0 NOT NULL,
	"games_started" integer DEFAULT 0 NOT NULL,
	"snap_count" integer DEFAULT 0 NOT NULL,
	"snap_share" real DEFAULT 0 NOT NULL,
	"fantasy_points" real DEFAULT 0 NOT NULL,
	"fantasy_points_ppr" real DEFAULT 0 NOT NULL,
	"fantasy_points_half_ppr" real DEFAULT 0 NOT NULL,
	"passing_yards" integer DEFAULT 0,
	"passing_tds" integer DEFAULT 0,
	"interceptions" integer DEFAULT 0,
	"rushing_yards" integer DEFAULT 0,
	"rushing_tds" integer DEFAULT 0,
	"receiving_yards" integer DEFAULT 0,
	"receiving_tds" integer DEFAULT 0,
	"receptions" integer DEFAULT 0,
	"targets" integer DEFAULT 0,
	"target_share" real DEFAULT 0,
	"air_yards" real DEFAULT 0,
	"yac" real DEFAULT 0,
	"red_zone_targets" integer DEFAULT 0,
	"red_zone_carries" integer DEFAULT 0,
	"avg_adp" real,
	"ecr_rank" integer,
	"avg_ownership" real,
	"avg_start_pct" real,
	"source_mask" integer DEFAULT 0 NOT NULL,
	"freshness_score" real DEFAULT 0 NOT NULL,
	"quality_gates_passed" boolean DEFAULT false NOT NULL,
	"completeness_score" real DEFAULT 0 NOT NULL,
	"last_refreshed" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "player_season_facts_canonical_player_id_season_pk" PRIMARY KEY("canonical_player_id","season")
);
--> statement-breakpoint
CREATE TABLE "player_usage_weekly" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" varchar NOT NULL,
	"week" integer NOT NULL,
	"season" integer NOT NULL,
	"snap_share" real,
	"routes_run" integer,
	"touches" integer,
	"last_updated" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "player_value_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"date" timestamp NOT NULL,
	"dynasty_value" integer NOT NULL,
	"source" text NOT NULL,
	"adp" real,
	"ownership" real,
	"season" integer NOT NULL,
	"week" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "player_week_facts" (
	"player_id" text NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"position" text NOT NULL,
	"usage_now" real DEFAULT 0 NOT NULL,
	"talent" real DEFAULT 0 NOT NULL,
	"environment" real DEFAULT 0 NOT NULL,
	"availability" real DEFAULT 0 NOT NULL,
	"market_anchor" real DEFAULT 0 NOT NULL,
	"power_score" real DEFAULT 0 NOT NULL,
	"confidence" real DEFAULT 0.5 NOT NULL,
	"flags" text[] DEFAULT '{}' NOT NULL,
	"last_update" timestamp DEFAULT now() NOT NULL,
	"adp_rank" integer,
	"snap_share" real,
	"routes_per_game" real,
	"targets_per_game" real,
	"rz_touches" real,
	"epa_per_play" real,
	"yprr" real,
	"yac_per_att" real,
	"mtf_per_touch" real,
	"team_proe" real,
	"pace_rank_percentile" real,
	"ol_tier" integer,
	"sos_next2" real,
	"injury_practice_score" real,
	"committee_index" real,
	"coach_volatility" real,
	"ecr_7d_delta" integer,
	"bye_week" boolean DEFAULT false,
	"rostered_7d_delta" real DEFAULT 0,
	"started_7d_delta" real DEFAULT 0,
	CONSTRAINT "player_week_facts_player_id_season_week_pk" PRIMARY KEY("player_id","season","week")
);
--> statement-breakpoint
CREATE TABLE "player_week_facts_metadata" (
	"canonical_player_id" text NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"source_mask" integer DEFAULT 0 NOT NULL,
	"freshness_score" real DEFAULT 0 NOT NULL,
	"quality_gates_passed" boolean DEFAULT false NOT NULL,
	"completeness_score" real DEFAULT 0 NOT NULL,
	"sleeper_last_update" timestamp,
	"nfl_data_last_update" timestamp,
	"fantasy_pros_last_update" timestamp,
	"has_game_log" boolean DEFAULT false,
	"has_market_data" boolean DEFAULT false,
	"has_advanced_stats" boolean DEFAULT false,
	"has_injury_data" boolean DEFAULT false,
	"fact_table_last_refresh" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "player_week_facts_metadata_canonical_player_id_season_week_pk" PRIMARY KEY("canonical_player_id","season","week")
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"team" text NOT NULL,
	"position" text NOT NULL,
	"avg_points" real NOT NULL,
	"projected_points" real NOT NULL,
	"ownership_percentage" integer NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"upside" real NOT NULL,
	"injury_status" text DEFAULT 'Healthy',
	"availability" text DEFAULT 'Available',
	"image_url" text,
	"consistency" real,
	"matchup_rating" real,
	"trend" text,
	"ownership" integer,
	"target_share" real,
	"red_zone_targets" integer,
	"carries" integer,
	"snap_count" integer,
	"external_id" text,
	"sleeper_id" text,
	"first_name" text,
	"last_name" text,
	"full_name" text,
	"jersey_number" integer,
	"age" integer,
	"years_exp" integer,
	"height" text,
	"weight" integer,
	"college" text,
	"birth_country" text,
	"status" text,
	"depth_chart_position" text,
	"depth_chart_order" integer,
	"espn_id" text,
	"yahoo_id" text,
	"rotowire_id" text,
	"fantasy_data_id" text,
	"adp" real,
	"positional_adp" text,
	"adp_missing" boolean DEFAULT false,
	"adp_last_updated" timestamp,
	"adp_source" text,
	"dynasty_value" integer,
	"fpg" real,
	"x_fpg" real,
	"proj_fpg" real,
	"upside_index" real,
	"upside_boost" real,
	"fpg_trend" text,
	"fpg_variance" real,
	"explosive_plays" integer,
	"red_zone_opportunity" real,
	"expected_points" real,
	"floor_points" real,
	"ceiling_points" real,
	"rag_score" real,
	"rag_color" text,
	"beat_proj" real,
	"features" jsonb,
	"draft_year" integer,
	"draft_round" integer,
	"draft_pick" integer,
	"rostered_pct" real DEFAULT 0,
	"active" boolean DEFAULT true,
	"rank" integer,
	"dynasty_rank" integer,
	"startup_draftable" boolean DEFAULT false,
	CONSTRAINT "players_sleeper_id_unique" UNIQUE("sleeper_id")
);
--> statement-breakpoint
CREATE TABLE "position_analysis" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"position" text NOT NULL,
	"strength_score" integer NOT NULL,
	"status" text NOT NULL,
	"weekly_average" real NOT NULL,
	"league_average" real NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quality_gate_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"table_name" text NOT NULL,
	"record_identifier" text NOT NULL,
	"overall_passed" boolean NOT NULL,
	"completeness_check" boolean,
	"consistency_check" boolean,
	"accuracy_check" boolean,
	"freshness_check" boolean,
	"outlier_check" boolean,
	"completeness_score" real,
	"consistency_score" real,
	"accuracy_score" real,
	"freshness_score" real,
	"outlier_score" real,
	"overall_quality_score" real,
	"failed_rules" text[] DEFAULT '{}',
	"warning_rules" text[] DEFAULT '{}',
	"validation_messages" jsonb,
	"validated_at" timestamp DEFAULT now() NOT NULL,
	"validated_by" text,
	"validation_version" text
);
--> statement-breakpoint
CREATE TABLE "rookie_context_signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"injury_opening" boolean DEFAULT false,
	"depth_chart_rank" integer,
	"news_weight" real,
	"market_rostership" real,
	"market_start_pct" real,
	"adp_delta" real,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "context_unique" UNIQUE("player_id","season","week")
);
--> statement-breakpoint
CREATE TABLE "rookie_riser_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"usage_growth" real,
	"opportunity_delta" real,
	"market_lag" real,
	"news_weight" real,
	"waiver_heat" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "snapshots_unique" UNIQUE("player_id","season","week")
);
--> statement-breakpoint
CREATE TABLE "rookie_weekly_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"snap_pct" real,
	"routes" integer,
	"targets" integer,
	"carries" integer,
	"touches" integer,
	"rz_targets" integer,
	"rz_carries" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "rookie_usage_unique" UNIQUE("player_id","season","week")
);
--> statement-breakpoint
CREATE TABLE "schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"home" text NOT NULL,
	"away" text NOT NULL,
	CONSTRAINT "schedule_season_week_home_away_unique" UNIQUE("season","week","home","away")
);
--> statement-breakpoint
CREATE TABLE "schema_registry" (
	"id" serial PRIMARY KEY NOT NULL,
	"app_version" text NOT NULL,
	"git_commit" text NOT NULL,
	"drizzle_tag" text NOT NULL,
	"applied_at" timestamp DEFAULT now() NOT NULL,
	"checksum_sql" text NOT NULL,
	"migration_source" text DEFAULT 'auto',
	"environment" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "season_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"season_type" text NOT NULL,
	"observed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sos_dashboards" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false,
	"config" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sos_dashboards_user_id_name_unique" UNIQUE("user_id","name")
);
--> statement-breakpoint
CREATE TABLE "sos_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"team" text NOT NULL,
	"opponent" text NOT NULL,
	"position" text NOT NULL,
	"sos_score" real NOT NULL,
	"tier" text NOT NULL,
	CONSTRAINT "sos_scores_season_week_team_position_unique" UNIQUE("season","week","team","position")
);
--> statement-breakpoint
CREATE TABLE "sos_user_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"default_positions" jsonb DEFAULT '["RB","WR"]'::jsonb,
	"default_week_range" jsonb DEFAULT '{"start":1,"end":5}'::jsonb,
	"favorite_teams" jsonb DEFAULT '[]'::jsonb,
	"tier_thresholds" jsonb DEFAULT '{"green":67,"yellow":33}'::jsonb,
	"view_preferences" jsonb DEFAULT '{"showCharts":true,"showTable":true}'::jsonb,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "sos_user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "sos_widgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"dashboard_id" integer,
	"widget_type" text NOT NULL,
	"position" jsonb NOT NULL,
	"config" jsonb NOT NULL,
	"is_visible" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "task_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"task_type" "uph_task_type" NOT NULL,
	"status" "uph_job_status" DEFAULT 'PENDING' NOT NULL,
	"scope" jsonb,
	"started_at" timestamp,
	"ended_at" timestamp,
	"attempt" integer DEFAULT 1 NOT NULL,
	"stats" jsonb,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "team_players" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"is_starter" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"owner_id" text NOT NULL,
	"league_name" text NOT NULL,
	"record" text NOT NULL,
	"league_rank" integer NOT NULL,
	"total_points" real NOT NULL,
	"health_score" integer NOT NULL,
	"sync_platform" text,
	"sync_league_id" text,
	"sync_team_id" text,
	"last_sync_date" timestamp,
	"sync_enabled" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "tiber_memory" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"insights" jsonb DEFAULT '[]',
	"tags" text[] DEFAULT '{}',
	"source" text,
	"confidence" real DEFAULT 0.8,
	"last_accessed" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "trade_analysis" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"players_given" text NOT NULL,
	"players_received" text NOT NULL,
	"trade_value" real,
	"recommendation" text,
	"reasoning" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar NOT NULL,
	"consent_consensus" boolean DEFAULT false,
	"fire_score" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "user_profiles_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "user_ranks" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"format" varchar NOT NULL,
	"season" integer,
	"pos" varchar NOT NULL,
	"player_id" varchar NOT NULL,
	"rank" integer NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "value_arbitrage" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"adp_value" real,
	"metrics_score" real,
	"value_gap" real,
	"recommendation" varchar(20) NOT NULL,
	"confidence" real,
	"reason_code" varchar(100),
	"weekly_change" real,
	"target_share" real,
	"yards_per_route_run" real,
	"air_yards" real,
	"red_zone_targets" integer,
	"snap_count_percent" real,
	"week" integer NOT NULL,
	"season" integer NOT NULL,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "value_arbitrage_player_id_week_season_unique" UNIQUE("player_id","week","season")
);
--> statement-breakpoint
CREATE TABLE "waiver_recommendations" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"player_id" integer NOT NULL,
	"priority" integer NOT NULL,
	"reasoning" text NOT NULL,
	"projected_impact" real,
	"usage_trend" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "weekly_performance" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_id" integer NOT NULL,
	"week" integer NOT NULL,
	"points" real NOT NULL,
	"projected_points" real NOT NULL
);
--> statement-breakpoint
ALTER TABLE "data_lineage" ADD CONSTRAINT "data_lineage_ingest_payload_id_ingest_payloads_id_fk" FOREIGN KEY ("ingest_payload_id") REFERENCES "public"."ingest_payloads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depth_charts" ADD CONSTRAINT "depth_charts_canonical_player_id_player_identity_map_canonical_id_fk" FOREIGN KEY ("canonical_player_id") REFERENCES "public"."player_identity_map"("canonical_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "depth_charts" ADD CONSTRAINT "depth_charts_team_code_nfl_teams_dim_team_code_fk" FOREIGN KEY ("team_code") REFERENCES "public"."nfl_teams_dim"("team_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draft_picks" ADD CONSTRAINT "draft_picks_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dynasty_trade_history" ADD CONSTRAINT "dynasty_trade_history_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fantasy_moves" ADD CONSTRAINT "fantasy_moves_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fire_events" ADD CONSTRAINT "fire_events_from_user_id_user_profiles_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fire_events" ADD CONSTRAINT "fire_events_to_user_id_user_profiles_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_logs" ADD CONSTRAINT "game_logs_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injuries" ADD CONSTRAINT "injuries_canonical_player_id_player_identity_map_canonical_id_fk" FOREIGN KEY ("canonical_player_id") REFERENCES "public"."player_identity_map"("canonical_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "injury_tracker" ADD CONSTRAINT "injury_tracker_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineup_optimization" ADD CONSTRAINT "lineup_optimization_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_data" ADD CONSTRAINT "market_data_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_rollups" ADD CONSTRAINT "market_rollups_canonical_player_id_player_identity_map_canonical_id_fk" FOREIGN KEY ("canonical_player_id") REFERENCES "public"."player_identity_map"("canonical_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "market_signals" ADD CONSTRAINT "market_signals_canonical_player_id_player_identity_map_canonical_id_fk" FOREIGN KEY ("canonical_player_id") REFERENCES "public"."player_identity_map"("canonical_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchup_analysis" ADD CONSTRAINT "matchup_analysis_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_composite_facts" ADD CONSTRAINT "player_composite_facts_canonical_player_id_player_identity_map_canonical_id_fk" FOREIGN KEY ("canonical_player_id") REFERENCES "public"."player_identity_map"("canonical_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_market_facts" ADD CONSTRAINT "player_market_facts_canonical_player_id_player_identity_map_canonical_id_fk" FOREIGN KEY ("canonical_player_id") REFERENCES "public"."player_identity_map"("canonical_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_season_facts" ADD CONSTRAINT "player_season_facts_canonical_player_id_player_identity_map_canonical_id_fk" FOREIGN KEY ("canonical_player_id") REFERENCES "public"."player_identity_map"("canonical_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_season_facts" ADD CONSTRAINT "player_season_facts_nfl_team_nfl_teams_dim_team_code_fk" FOREIGN KEY ("nfl_team") REFERENCES "public"."nfl_teams_dim"("team_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_value_history" ADD CONSTRAINT "player_value_history_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rookie_context_signals" ADD CONSTRAINT "rookie_context_signals_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rookie_riser_snapshots" ADD CONSTRAINT "rookie_riser_snapshots_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rookie_weekly_usage" ADD CONSTRAINT "rookie_weekly_usage_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sos_widgets" ADD CONSTRAINT "sos_widgets_dashboard_id_sos_dashboards_id_fk" FOREIGN KEY ("dashboard_id") REFERENCES "public"."sos_dashboards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_runs" ADD CONSTRAINT "task_runs_job_id_job_runs_job_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job_runs"("job_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "trade_analysis" ADD CONSTRAINT "trade_analysis_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_ranks" ADD CONSTRAINT "user_ranks_user_id_user_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "value_arbitrage" ADD CONSTRAINT "value_arbitrage_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiver_recommendations" ADD CONSTRAINT "waiver_recommendations_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "waiver_recommendations" ADD CONSTRAINT "waiver_recommendations_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "advanced_signals_player_season_idx" ON "advanced_signals" USING btree ("player_id","season");--> statement-breakpoint
CREATE INDEX "advanced_signals_week_idx" ON "advanced_signals" USING btree ("week");--> statement-breakpoint
CREATE INDEX "advanced_signals_trend_idx" ON "advanced_signals" USING btree ("trend_multiplier");--> statement-breakpoint
CREATE INDEX "bs_week_filters_idx" ON "buys_sells" USING btree ("season","week","position","format","ppr");--> statement-breakpoint
CREATE UNIQUE INDEX "consensus_unique_player_format_season" ON "consensus_board" USING btree ("format","season","player_id");--> statement-breakpoint
CREATE INDEX "consensus_format_season_rank_idx" ON "consensus_board" USING btree ("format","season","rank");--> statement-breakpoint
CREATE INDEX "consensus_format_season_updated_idx" ON "consensus_board" USING btree ("format","season","updated_at");--> statement-breakpoint
CREATE INDEX "consensus_changelog_timestamp_idx" ON "consensus_changelog" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "consensus_changelog_player_idx" ON "consensus_changelog" USING btree ("player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "explanation_player_format_season" ON "consensus_explanations" USING btree ("player_id","format","season");--> statement-breakpoint
CREATE UNIQUE INDEX "unique_consensus_rank" ON "consensus_ranks" USING btree ("season","mode","position","rank");--> statement-breakpoint
CREATE INDEX "lineage_job_id_idx" ON "data_lineage" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "lineage_table_idx" ON "data_lineage" USING btree ("table_name");--> statement-breakpoint
CREATE INDEX "lineage_source_job_idx" ON "data_lineage" USING btree ("source_job_id");--> statement-breakpoint
CREATE INDEX "lineage_execution_idx" ON "data_lineage" USING btree ("started_at","completed_at");--> statement-breakpoint
CREATE INDEX "dataset_versions_dataset_season_week_idx" ON "dataset_versions" USING btree ("dataset","season","week");--> statement-breakpoint
CREATE INDEX "dataset_versions_committed_at_idx" ON "dataset_versions" USING btree ("committed_at");--> statement-breakpoint
CREATE INDEX "dataset_versions_dataset_source_idx" ON "dataset_versions" USING btree ("dataset","source");--> statement-breakpoint
CREATE INDEX "depth_player_team_idx" ON "depth_charts" USING btree ("canonical_player_id","team_code");--> statement-breakpoint
CREATE INDEX "depth_team_position_idx" ON "depth_charts" USING btree ("team_code","position");--> statement-breakpoint
CREATE INDEX "depth_season_week_idx" ON "depth_charts" USING btree ("season","week");--> statement-breakpoint
CREATE INDEX "depth_active_idx" ON "depth_charts" USING btree ("is_active") WHERE "depth_charts"."is_active" = true;--> statement-breakpoint
CREATE INDEX "ingest_source_endpoint_idx" ON "ingest_payloads" USING btree ("source","endpoint");--> statement-breakpoint
CREATE INDEX "ingest_season_week_idx" ON "ingest_payloads" USING btree ("season","week");--> statement-breakpoint
CREATE INDEX "ingest_status_idx" ON "ingest_payloads" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ingest_job_id_idx" ON "ingest_payloads" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "injuries_player_season_idx" ON "injuries" USING btree ("canonical_player_id","season");--> statement-breakpoint
CREATE INDEX "injuries_status_idx" ON "injuries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "injuries_week_idx" ON "injuries" USING btree ("week");--> statement-breakpoint
CREATE INDEX "injuries_active_idx" ON "injuries" USING btree ("is_resolved") WHERE "injuries"."is_resolved" = false;--> statement-breakpoint
CREATE INDEX "job_runs_status_idx" ON "job_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "job_runs_type_idx" ON "job_runs" USING btree ("type");--> statement-breakpoint
CREATE INDEX "job_runs_season_week_idx" ON "job_runs" USING btree ("season","week");--> statement-breakpoint
CREATE INDEX "job_runs_started_at_idx" ON "job_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "job_runs_created_at_idx" ON "job_runs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "job_runs_status_started_idx" ON "job_runs" USING btree ("status","started_at");--> statement-breakpoint
CREATE INDEX "mr_player_rollup_idx" ON "market_rollups" USING btree ("canonical_player_id","rollup_type");--> statement-breakpoint
CREATE INDEX "mr_season_week_idx" ON "market_rollups" USING btree ("season","week");--> statement-breakpoint
CREATE INDEX "mr_validity_idx" ON "market_rollups" USING btree ("valid_from","valid_to");--> statement-breakpoint
CREATE INDEX "mr_quality_idx" ON "market_rollups" USING btree ("quality_gates_passed");--> statement-breakpoint
CREATE INDEX "market_player_signal_idx" ON "market_signals" USING btree ("canonical_player_id","signal_type");--> statement-breakpoint
CREATE INDEX "market_season_week_idx" ON "market_signals" USING btree ("season","week");--> statement-breakpoint
CREATE INDEX "market_source_type_idx" ON "market_signals" USING btree ("source","signal_type");--> statement-breakpoint
CREATE INDEX "market_validity_idx" ON "market_signals" USING btree ("valid_from","valid_to");--> statement-breakpoint
CREATE INDEX "monitoring_job_runs_job_name_idx" ON "monitoring_job_runs" USING btree ("job_name");--> statement-breakpoint
CREATE INDEX "monitoring_job_runs_status_idx" ON "monitoring_job_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "monitoring_job_runs_started_at_idx" ON "monitoring_job_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "teams_conference_idx" ON "nfl_teams_dim" USING btree ("conference");--> statement-breakpoint
CREATE INDEX "teams_division_idx" ON "nfl_teams_dim" USING btree ("division");--> statement-breakpoint
CREATE INDEX "player_advanced_2024_player_id_idx" ON "player_advanced_2024" USING btree ("player_id");--> statement-breakpoint
CREATE INDEX "player_advanced_2024_position_idx" ON "player_advanced_2024" USING btree ("position");--> statement-breakpoint
CREATE INDEX "pcf_dynasty_rank_idx" ON "player_composite_facts" USING btree ("dynasty_rank");--> statement-breakpoint
CREATE INDEX "pcf_redraft_rank_idx" ON "player_composite_facts" USING btree ("redraft_rank");--> statement-breakpoint
CREATE INDEX "pcf_momentum_idx" ON "player_composite_facts" USING btree ("momentum_score");--> statement-breakpoint
CREATE INDEX "pcf_quality_idx" ON "player_composite_facts" USING btree ("quality_gates_passed");--> statement-breakpoint
CREATE INDEX "pcf_talent_grade_idx" ON "player_composite_facts" USING btree ("overall_talent_grade");--> statement-breakpoint
CREATE UNIQUE INDEX "pim_sleeper_id_idx" ON "player_identity_map" USING btree ("sleeper_id") WHERE "player_identity_map"."sleeper_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "pim_espn_id_idx" ON "player_identity_map" USING btree ("espn_id") WHERE "player_identity_map"."espn_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "pim_yahoo_id_idx" ON "player_identity_map" USING btree ("yahoo_id") WHERE "player_identity_map"."yahoo_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "pim_rotowire_id_idx" ON "player_identity_map" USING btree ("rotowire_id") WHERE "player_identity_map"."rotowire_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "pim_fantasy_data_id_idx" ON "player_identity_map" USING btree ("fantasy_data_id") WHERE "player_identity_map"."fantasy_data_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "pim_fantasypros_id_idx" ON "player_identity_map" USING btree ("fantasypros_id") WHERE "player_identity_map"."fantasypros_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "pim_mysportsfeeds_id_idx" ON "player_identity_map" USING btree ("mysportsfeeds_id") WHERE "player_identity_map"."mysportsfeeds_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "pim_nfl_data_py_id_idx" ON "player_identity_map" USING btree ("nfl_data_py_id") WHERE "player_identity_map"."nfl_data_py_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "pim_position_team_idx" ON "player_identity_map" USING btree ("position","nfl_team");--> statement-breakpoint
CREATE INDEX "pim_name_idx" ON "player_identity_map" USING btree ("full_name");--> statement-breakpoint
CREATE INDEX "pim_first_name_idx" ON "player_identity_map" USING btree ("first_name");--> statement-breakpoint
CREATE INDEX "pim_last_name_idx" ON "player_identity_map" USING btree ("last_name");--> statement-breakpoint
CREATE INDEX "pim_active_status_idx" ON "player_identity_map" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "pim_active_position_idx" ON "player_identity_map" USING btree ("is_active","position");--> statement-breakpoint
CREATE INDEX "pim_position_name_idx" ON "player_identity_map" USING btree ("position","full_name");--> statement-breakpoint
CREATE INDEX "pmf_player_season_idx" ON "player_market_facts" USING btree ("canonical_player_id","season");--> statement-breakpoint
CREATE INDEX "pmf_season_week_idx" ON "player_market_facts" USING btree ("season","week");--> statement-breakpoint
CREATE INDEX "pmf_quality_idx" ON "player_market_facts" USING btree ("quality_gates_passed");--> statement-breakpoint
CREATE INDEX "pmf_momentum_idx" ON "player_market_facts" USING btree ("momentum_score");--> statement-breakpoint
CREATE INDEX "pmf_validity_idx" ON "player_market_facts" USING btree ("valid_from","valid_to");--> statement-breakpoint
CREATE INDEX "player_season_2024_position_idx" ON "player_season_2024" USING btree ("position");--> statement-breakpoint
CREATE INDEX "player_season_2024_team_idx" ON "player_season_2024" USING btree ("team");--> statement-breakpoint
CREATE INDEX "psf_season_position_idx" ON "player_season_facts" USING btree ("season","position");--> statement-breakpoint
CREATE INDEX "psf_team_season_idx" ON "player_season_facts" USING btree ("nfl_team","season");--> statement-breakpoint
CREATE INDEX "psf_quality_idx" ON "player_season_facts" USING btree ("quality_gates_passed");--> statement-breakpoint
CREATE INDEX "psf_freshness_idx" ON "player_season_facts" USING btree ("freshness_score");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_player_week_season" ON "player_usage_weekly" USING btree ("player_id","week","season");--> statement-breakpoint
CREATE INDEX "pwf_season_week_pos_idx" ON "player_week_facts" USING btree ("season","week","position");--> statement-breakpoint
CREATE INDEX "pwf_player_season_idx" ON "player_week_facts" USING btree ("player_id","season");--> statement-breakpoint
CREATE INDEX "pwfm_quality_idx" ON "player_week_facts_metadata" USING btree ("quality_gates_passed");--> statement-breakpoint
CREATE INDEX "pwfm_freshness_idx" ON "player_week_facts_metadata" USING btree ("freshness_score");--> statement-breakpoint
CREATE INDEX "pwfm_season_week_idx" ON "player_week_facts_metadata" USING btree ("season","week");--> statement-breakpoint
CREATE INDEX "qgr_job_table_idx" ON "quality_gate_results" USING btree ("job_id","table_name");--> statement-breakpoint
CREATE INDEX "qgr_record_idx" ON "quality_gate_results" USING btree ("record_identifier");--> statement-breakpoint
CREATE INDEX "qgr_overall_passed_idx" ON "quality_gate_results" USING btree ("overall_passed");--> statement-breakpoint
CREATE INDEX "qgr_quality_score_idx" ON "quality_gate_results" USING btree ("overall_quality_score");--> statement-breakpoint
CREATE INDEX "context_season_week_idx" ON "rookie_context_signals" USING btree ("season","week");--> statement-breakpoint
CREATE INDEX "context_player_season_idx" ON "rookie_context_signals" USING btree ("player_id","season");--> statement-breakpoint
CREATE INDEX "snapshots_created_at_idx" ON "rookie_riser_snapshots" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "snapshots_season_week_idx" ON "rookie_riser_snapshots" USING btree ("season","week");--> statement-breakpoint
CREATE INDEX "snapshots_heat_idx" ON "rookie_riser_snapshots" USING btree ("waiver_heat");--> statement-breakpoint
CREATE INDEX "rookie_usage_season_week_idx" ON "rookie_weekly_usage" USING btree ("season","week");--> statement-breakpoint
CREATE INDEX "rookie_usage_player_season_idx" ON "rookie_weekly_usage" USING btree ("player_id","season");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_schema_registry_commit" ON "schema_registry" USING btree ("git_commit");--> statement-breakpoint
CREATE INDEX "schema_registry_applied_at_idx" ON "schema_registry" USING btree ("applied_at");--> statement-breakpoint
CREATE INDEX "schema_registry_env_version_idx" ON "schema_registry" USING btree ("environment","app_version");--> statement-breakpoint
CREATE INDEX "schema_registry_migration_source_idx" ON "schema_registry" USING btree ("migration_source");--> statement-breakpoint
CREATE UNIQUE INDEX "season_state_latest_idx" ON "season_state" USING btree ("observed_at");--> statement-breakpoint
CREATE INDEX "season_state_source_idx" ON "season_state" USING btree ("source");--> statement-breakpoint
CREATE INDEX "season_state_season_week_idx" ON "season_state" USING btree ("season","week");--> statement-breakpoint
CREATE INDEX "season_state_observed_at_idx" ON "season_state" USING btree ("observed_at");--> statement-breakpoint
CREATE INDEX "task_runs_job_id_idx" ON "task_runs" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "task_runs_status_idx" ON "task_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "task_runs_task_type_idx" ON "task_runs" USING btree ("task_type");--> statement-breakpoint
CREATE INDEX "task_runs_job_task_idx" ON "task_runs" USING btree ("job_id","task_type");--> statement-breakpoint
CREATE INDEX "task_runs_started_at_idx" ON "task_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "task_runs_status_started_idx" ON "task_runs" USING btree ("status","started_at");