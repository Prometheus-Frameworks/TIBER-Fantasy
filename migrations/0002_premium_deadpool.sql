CREATE TYPE "public"."schedule_action" AS ENUM('triggered_processing', 'adjusted_frequency', 'skipped_stale', 'backoff_applied', 'brand_recompute');--> statement-breakpoint
CREATE TYPE "public"."schedule_trigger_type" AS ENUM('data_freshness', 'upstream_change', 'sla_adjustment', 'brand_recompute', 'manual_trigger');--> statement-breakpoint
CREATE TABLE "intelligent_schedule_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"schedule_key" text NOT NULL,
	"last_run" timestamp,
	"next_run" timestamp,
	"frequency_ms" integer NOT NULL,
	"system_load" jsonb,
	"sla_metrics" jsonb,
	"trigger_source" "schedule_trigger_type" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"total_runs" integer DEFAULT 0 NOT NULL,
	"successful_runs" integer DEFAULT 0 NOT NULL,
	"average_execution_ms" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "intelligent_schedule_state_schedule_key_unique" UNIQUE("schedule_key")
);
--> statement-breakpoint
CREATE TABLE "schedule_triggers" (
	"id" serial PRIMARY KEY NOT NULL,
	"trigger_type" "schedule_trigger_type" NOT NULL,
	"trigger_source" text NOT NULL,
	"schedule_key" text NOT NULL,
	"action_taken" "schedule_action" NOT NULL,
	"execution_time_ms" integer,
	"success" boolean NOT NULL,
	"error_details" text,
	"trigger_data" jsonb,
	"schedule_state_before" jsonb,
	"schedule_state_after" jsonb,
	"job_id" text,
	"season" integer,
	"week" integer,
	"triggered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "intelligent_schedule_state_key_idx" ON "intelligent_schedule_state" USING btree ("schedule_key");--> statement-breakpoint
CREATE INDEX "intelligent_schedule_state_last_run_idx" ON "intelligent_schedule_state" USING btree ("last_run");--> statement-breakpoint
CREATE INDEX "intelligent_schedule_state_next_run_idx" ON "intelligent_schedule_state" USING btree ("next_run");--> statement-breakpoint
CREATE INDEX "intelligent_schedule_state_trigger_source_idx" ON "intelligent_schedule_state" USING btree ("trigger_source");--> statement-breakpoint
CREATE INDEX "intelligent_schedule_state_active_idx" ON "intelligent_schedule_state" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "intelligent_schedule_state_updated_at_idx" ON "intelligent_schedule_state" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "schedule_triggers_trigger_type_idx" ON "schedule_triggers" USING btree ("trigger_type");--> statement-breakpoint
CREATE INDEX "schedule_triggers_trigger_source_idx" ON "schedule_triggers" USING btree ("trigger_source");--> statement-breakpoint
CREATE INDEX "schedule_triggers_schedule_key_idx" ON "schedule_triggers" USING btree ("schedule_key");--> statement-breakpoint
CREATE INDEX "schedule_triggers_action_taken_idx" ON "schedule_triggers" USING btree ("action_taken");--> statement-breakpoint
CREATE INDEX "schedule_triggers_success_idx" ON "schedule_triggers" USING btree ("success");--> statement-breakpoint
CREATE INDEX "schedule_triggers_triggered_at_idx" ON "schedule_triggers" USING btree ("triggered_at");--> statement-breakpoint
CREATE INDEX "schedule_triggers_job_id_idx" ON "schedule_triggers" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "schedule_triggers_season_week_idx" ON "schedule_triggers" USING btree ("season","week");