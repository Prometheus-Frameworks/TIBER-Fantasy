CREATE TYPE "public"."brand" AS ENUM('rookie_risers', 'dynasty', 'redraft', 'trade_eval', 'sos', 'consensus');--> statement-breakpoint
CREATE TABLE "brand_signals" (
	"id" serial PRIMARY KEY NOT NULL,
	"brand" "brand" NOT NULL,
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"player_id" text NOT NULL,
	"signal_key" text NOT NULL,
	"signal_value" real NOT NULL,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "brand_signals_unique" UNIQUE("brand","season","week","player_id","signal_key")
);
--> statement-breakpoint
CREATE INDEX "brand_signals_brand_season_week_idx" ON "brand_signals" USING btree ("brand","season","week");--> statement-breakpoint
CREATE INDEX "brand_signals_player_brand_idx" ON "brand_signals" USING btree ("player_id","brand");--> statement-breakpoint
CREATE INDEX "brand_signals_key_idx" ON "brand_signals" USING btree ("signal_key");--> statement-breakpoint
CREATE INDEX "brand_signals_value_idx" ON "brand_signals" USING btree ("signal_value");--> statement-breakpoint
CREATE INDEX "brand_signals_created_at_idx" ON "brand_signals" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "brand_signals_player_season_brand_idx" ON "brand_signals" USING btree ("player_id","season","brand");--> statement-breakpoint
CREATE INDEX "brand_signals_brand_signal_value_idx" ON "brand_signals" USING btree ("brand","signal_key","signal_value");