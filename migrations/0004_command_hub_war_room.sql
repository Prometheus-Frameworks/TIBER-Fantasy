ALTER TABLE "playbook_entries" ADD COLUMN "team_id" text;
ALTER TABLE "playbook_entries" ADD COLUMN "scoring_format" text;
ALTER TABLE "playbook_entries" ADD COLUMN "week" integer;
ALTER TABLE "playbook_entries" ADD COLUMN "season" integer;
ALTER TABLE "playbook_entries" ADD COLUMN "outcome" text;
ALTER TABLE "playbook_entries" ADD COLUMN "regret_score" integer;
ALTER TABLE "playbook_entries" ADD COLUMN "resolved_at" timestamp;
