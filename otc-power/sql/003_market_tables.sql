-- Market data tables for ECR and points backfill

create table if not exists bt_week_points (
  season int not null,
  week int not null,
  player_id text not null,
  points numeric not null,
  source text not null default 'Sleeper',
  primary key (season, week, player_id)
);

create table if not exists bt_market_rank (
  season int not null,
  week int not null,
  ranking_type text not null,
  player_id text not null,
  market_rank int not null,
  source text not null default 'FantasyPros',
  primary key (season, week, ranking_type, player_id)
);

create table if not exists bt_market_rank_unmatched (
  season int not null,
  week int not null,
  ranking_type text not null,
  rank int not null,
  name text not null,
  team text,
  pos text,
  source text not null default 'FantasyPros'
);

create table if not exists players_aliases (
  alias text primary key,
  player_id text not null references players(player_id)
);

-- Indexes for performance
create index if not exists idx_bt_week_points_season_week on bt_week_points (season, week);
create index if not exists idx_bt_market_rank_season_week_type on bt_market_rank (season, week, ranking_type);
create index if not exists idx_bt_market_rank_unmatched_season_week on bt_market_rank_unmatched (season, week);