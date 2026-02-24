# TIBER Data Architecture

## 3-Tier ELT Pipeline

TIBER processes NFL data through a Bronze → Silver → Gold pipeline managed by the ETL module (`server/etl/`).

### Bronze Layer — Raw Ingestion
- `CoreWeekIngest.ts`: Pulls raw weekly data from external sources
- Sources: Sleeper API, MySportsFeeds, nflverse/nflfastR (via Python bridge), nfl_data_py
- Data lands as-is with minimal transformation

### Silver Layer — Normalization
- `silverWeeklyStatsETL.ts`: Cleans, normalizes, and structures weekly stats
- Handles missing data, format inconsistencies, platform-specific quirks
- Unified player identification via GSIS ID mapping

### Gold Layer — Aggregated Metrics
- `goldDatadiveETL.ts`: Produces the metrics consumed by FORGE and the API
- Aggregated facts: rolling averages, rate stats, positional ranks
- `nightlyBuysSellsUpdate.ts`: Nightly refresh of buy/sell signals

## Database

- PostgreSQL with Drizzle ORM
- pgvector extension for embedding similarity (RAG chat, similar players)
- 131 tables defined in `shared/schema.ts`
- Key tables:
  - `weekly_player_data` — core stat spine
  - `player_identity_map` — cross-platform identity (GSIS ID primary key)
  - `forge_alpha_history` — recursive alpha scores over time
  - `qb_xfp_weekly` — FIRE QB expected fantasy points
  - `role_bank_*` — position-specific role classifications
  - `team_context` — scheme, OL grades, pace
  - `sos_*` — strength of schedule by position

## Player Identity Resolution

The identity layer (`server/services/identity/`) unifies players across platforms:

| Platform | ID Format |
|----------|-----------|
| NFL/GSIS | `00-XXXXXXX` (primary key) |
| Sleeper | Numeric string |
| ESPN | Numeric |
| Yahoo | Numeric |
| MySportsFeeds | Slug format |

All lookups resolve to GSIS ID first, then fan out to platform-specific IDs as needed.

## External Data Sources

| Source | What It Provides | Access Method |
|--------|-----------------|---------------|
| Sleeper API | Projections, ADP, league data, player metadata | Direct REST (no auth for public) |
| MySportsFeeds | Injury reports, roster automation | API key auth |
| nflverse/nflfastR | Play-by-play, EPA, CPOE, schedules | Python bridge (nfl_data_py + Flask) |
| nfl_data_py | Weekly stats, depth charts, snap counts | Python bridge |

## Data Quality

- **Sentinel** (`server/modules/sentinel/`): Automated anomaly detection in the scoring pipeline
- **Guardian/NoiseShield** (`server/guardian/`): Filters statistical noise before it reaches FORGE
- **Snapshot Validator** (`server/modules/forge/snapshotDataValidator.ts`): Guardrails for bad input data

## When Helping Users

- Know the data freshness: Bronze updates on ingest, Gold refreshes nightly
- If a user asks about a player and data seems stale, check which week the latest snapshot covers
- Identity resolution matters for Sleeper league sync — always resolve to GSIS ID
- The Python bridge is a separate Flask API; if NFL data seems missing, the Python service may need a restart
