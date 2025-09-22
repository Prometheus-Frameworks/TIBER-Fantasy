CREATE TABLE "player_attributes" (
	"season" integer NOT NULL,
	"week" integer NOT NULL,
	"otc_id" text NOT NULL,
	"team" text NOT NULL,
	"position" text NOT NULL,
	"opp_team" text,
	"status_injury" text,
	"pass_att" integer,
	"pass_cmp" integer,
	"pass_yd" integer,
	"pass_td" integer,
	"pass_int" integer,
	"sacks_taken" integer,
	"rush_att" integer,
	"rush_yd" integer,
	"rush_td" integer,
	"targets" integer,
	"receptions" integer,
	"rec_yd" integer,
	"rec_td" integer,
	"fumbles_lost" integer,
	"two_pt_made" integer,
	"air_yards" integer,
	"a_dot" real,
	"yac" integer,
	"epa_total" real,
	"epa_per_play" real,
	"team_plays" integer,
	"opp_def_rank" real,
	"pace_situation_adj" real,
	"implied_team_total" real,
	"adp_sf" real,
	"fantasy_pts_halfppr" real,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "player_attributes_season_week_otc_id_pk" PRIMARY KEY("season","week","otc_id")
);
--> statement-breakpoint
CREATE INDEX "player_attributes_season_week_idx" ON "player_attributes" USING btree ("season","week");--> statement-breakpoint
CREATE INDEX "player_attributes_otc_id_season_idx" ON "player_attributes" USING btree ("otc_id","season");--> statement-breakpoint
CREATE INDEX "player_attributes_position_idx" ON "player_attributes" USING btree ("position");--> statement-breakpoint
CREATE INDEX "player_attributes_team_idx" ON "player_attributes" USING btree ("team");--> statement-breakpoint
CREATE INDEX "player_attributes_pos_season_week_idx" ON "player_attributes" USING btree ("position","season","week");--> statement-breakpoint
CREATE INDEX "player_attributes_team_season_week_idx" ON "player_attributes" USING btree ("team","season","week");