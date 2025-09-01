create table players (
  player_id text primary key,
  name text not null,
  team text,
  position text not null
);

create table player_week_facts (
  player_id text not null references players(player_id),
  season int not null,
  week int not null,
  usage_now numeric not null default 0,         -- 0-100 (EWMA xFP, share)
  talent numeric not null default 0,            -- 0-100 (OTC/Fusion north stabilized)
  environment numeric not null default 0,       -- 0-100 (OASIS team/off context)
  availability numeric not null default 0,      -- 0-100 (status, snaps expectation)
  market_anchor numeric not null default 0,     -- 0-100 (tiny weight)
  power_score numeric not null default 0,       -- 0-100 (final)
  confidence numeric not null default 0.5,      -- 0-1
  flags text[] not null default '{}',
  last_update timestamptz not null default now(),
  primary key (player_id, season, week)
);

create table power_ranks (
  season int not null,
  week int not null,
  ranking_type text not null,                   -- OVERALL | QB | RB | WR | TE
  rank int not null,
  player_id text not null references players(player_id),
  power_score numeric not null,
  delta_w int not null default 0,
  generated_at timestamptz not null default now(),
  primary key (season, week, ranking_type, rank)
);

create table events_queue (
  id bigserial primary key,
  event_type text not null,                     -- INJURY, DEPTH_CHART, QB_CHANGE, TRANSACTION
  scope jsonb not null,                         -- { player_id, team, position }
  created_at timestamptz not null default now(),
  processed boolean not null default false
);