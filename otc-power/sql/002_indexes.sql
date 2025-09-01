create index on player_week_facts (season, week);
create index on power_ranks (season, week, ranking_type);
create index on events_queue (processed, created_at);