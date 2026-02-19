
# Tiber Fantasy — Project Context File

> Last updated: February 19, 2026
> Purpose: Give any AI agent a complete, accurate understanding of what Tiber Fantasy is, what's built, what's live, and how everything connects.

---

## What Is Tiber Fantasy?

Tiber Fantasy is a free, independent fantasy football analytics platform. It provides NFL data, player grading, matchup analysis, and research tools — all without paywalls, ads, or paid data partnerships. The platform is built for dynasty fantasy football leagues and focuses exclusively on skill positions: QB, RB, WR, and TE (no kickers, no defense/special teams).

**Core philosophy:** Sophisticated analytics tools that normally cost money should be free and accessible to everyone.

**Primary focus:** Dynasty leagues, skill positions (QB, RB, WR, TE). The platform also includes a DST Streamer tool for weekly defense streaming recommendations as a utility feature, though defensive players are not part of the core grading or ranking systems.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query |
| Backend | Node.js/TypeScript (Express.js), Python (Flask for data pipelines) |
| Database | PostgreSQL (Neon-backed) with Drizzle ORM, pgvector extension |
| AI/LLM | Multi-provider gateway (OpenRouter, OpenAI, Anthropic, Google Gemini) |
| Data Sources | nflfastR (play-by-play), NFL-Data-Py (weekly stats), Sleeper API (projections/ADP), MySportsFeeds (injuries) |
| Design | Light mode, white/#fafafa/#f4f4f4 backgrounds, Ember accent (#e2640d), three-font system (Instrument Sans, JetBrains Mono, Newsreader) |

---

## What's Built and Live

### FORGE — Player Grading Engine
The core evaluation system. FORGE stands for Football-Oriented Recursive Grading Engine.

- Produces Alpha scores (0-100) for every skill-position player
- Four scoring pillars: Volume, Efficiency, Team Context, Stability
- Position-specific weighting and tier mapping (T1 through T5)
- Supports three orientation modes: Redraft, Dynasty, Best Ball
- Football Lens detects real-world football issues and applies adjustments
- Two-pass recursive scoring with momentum and prior blending
- Multi-week aggregation across all official snapshots for season-grounded scores
- QB Context system provides QB-aware scoring for skill positions
- **FPOE-first Efficiency Pillar**: Efficiency centers on derived `fpoe_per_game` (Fantasy Points Over Expected), making Volume and Efficiency complementary by design: `actual_fpts = xfp_volume + fpoe_efficiency`. WR/RB/TE use 70% FPOE; QB uses 50% FPOE plus EPA/CPOE/sack-rate
- **Correlation-tuned Pillar Weights (v1.1)**: RB (V:0.62/E:0.22/T:0.10/S:0.06), WR (0.48/0.15/0.15/0.22), TE (0.62/0.18/0.10/0.10), QB (0.28/0.32/0.28/0.12). Key insight: RB/TE stability is anti-correlated with PPG; WR stability is positive
- **Calibration**: Position-specific percentile anchors (p10/p90) mapping raw scores to 25-95 Alpha range. Validated via Spearman correlation (RB: 0.943, TE: 0.939, WR: 0.908, QB: 0.623)

**Key endpoints:**
- `/api/forge/eg/batch` — Batch player grades
- `/api/forge/eg/player` — Single player grade
- `/api/forge/simulation/*` — FORGE simulation tools

### Tiber Tiers (`/tiers`)
User-facing rankings powered by FORGE. Features position filters, adjustable weight sliders, preset scoring systems, season/weekly toggles, week range filtering, mode toggles, and Football Lens issue badges.

### Tiber Data Lab (`/tiber-data-lab`)
A research department with 8 sub-modules for deep player analysis:

| Module | Route | What It Does |
|--------|-------|-------------|
| **Receiving Lab** | `/tiber-data-lab/receiving` | Route efficiency, target distribution, air yards, YAC analysis, field splits, EPA metrics for pass catchers |
| **Rushing Lab** | `/tiber-data-lab/rushing` | Carry profiles, stuff rate, inside/outside splits, directional tendencies, receiving work for RBs |
| **QB Lab** | `/tiber-data-lab/qb` | CPOE, ANY/A, pressure metrics, formation analysis, scramble production, deep passing |
| **Red Zone Lab** | `/tiber-data-lab/red-zone` | Red zone snap rates, target shares, TD efficiency, rushing conversion rates |
| **Situational Lab** | `/tiber-data-lab/situational` | 3rd down conversion, early/late down splits, 2-minute drill, hurry-up efficiency |
| **Snapshots** | `/tiber-data-lab/snapshots` | Snapshot-based NFL data spine for reproducible analytics |
| **Personnel Groupings** | `/tiber-data-lab/personnel` | Formation intelligence with every-down grades and personnel breakdown |
| **Role Banks** | `/tiber-data-lab/role-banks` | Season-level positional archetype classifications |

**Data Lab API:** `/api/data-lab/lab-agg` — Aggregated player metrics with 117 fields per player. Supports filtering by season, position, and week range.

**AI Collaboration Features (recently added):**
- All 5 research modules have CSV export with AI-ready headers
- Each CSV includes a sample AI prompt in the header comments (e.g., "rank top 10 receivers by 0.4*EPA/Target + 0.3*Catch Rate + 0.3*YPRR")
- AI Prompt Hints popover on each module with "hidden gems" discovery prompts
- Designed for copy-paste workflows into ChatGPT, Claude, or any AI tool

**CSV column counts by module:**
- Receiving Lab: 45 columns (snap share, target share, EPA/target, YPRR, TPRR, FP/route, WOPR, RACR, xYAC, field splits, all 3 scoring formats)
- Rushing Lab: 34 columns (snap share, YPC, rush EPA, stuff rate, directional splits, receiving metrics, all 3 scoring formats)
- QB Lab: 33 columns (CPOE, ANY/A, EPA/play, pressure metrics, formation splits, rush/scramble production, all 3 scoring formats)
- Red Zone Lab: 25 columns (RZ snaps, target share, catch rate, TD rates, all 3 scoring formats)
- Situational Lab: 29 columns (3rd down, early/late down, 2-minute, hurry-up metrics, all 3 scoring formats)

### Data Pipeline Status (2025 Season)
Full 18-week season data is ingested and validated:

| Week | Players | Week | Players |
|------|---------|------|---------|
| 1 | 313 | 10 | 276 |
| 2 | 307 | 11 | 294 |
| 3 | 314 | 12 | 273 |
| 4 | 306 | 13 | 307 |
| 5 | 281 | 14 | 290 |
| 6 | 280 | 15 | 308 |
| 7 | 296 | 16 | 328 |
| 8 | 265 | 17 | 323 |
| 9 | 271 | 18 | 322 |

**Total season records:** 16,845
**Aggregated players available:** 150 WR, 136 RB, 75 QB, 126 TE

**Pipeline flow:** nflfastR play-by-play → `datadive_player_week_staging` → `datadive_snapshot_player_week` → Lab aggregation API (`/api/data-lab/lab-agg`) → Frontend modules

**Note:** The weekly snapshot data lives in `datadive_snapshot_player_week` and season-level aggregation in `datadive_snapshot_player_season`. The `/api/data-lab/snapshots` endpoint provides snapshot metadata. The lab-agg endpoint handles all cross-week aggregation for the research modules.

### Fantasy Lab (`/fantasy-lab`)
The real-time player evaluation layer, built on top of FORGE. Contains three engines that work together to surface buy-low/sell-high signals and rolling opportunity trends.

**FIRE — Rolling 4-Week Opportunity Engine**
- Computes a FIRE score (0-100) for each RB/WR/TE using a rolling 4-week window
- Three pillars: Opportunity (60%), Role (25%), Conversion (15%)
- Position-specific eligibility thresholds: RB ≥ 50 snaps, WR/TE ≥ 80 snaps
- Outputs `windowGamesPlayed`, `weeks_present`, and `confidence` (HIGH/MED/LOW) per player
- Confidence is computed from games played in the window, snap volume relative to threshold, and route data availability

**Delta Engine — FORGE vs FIRE Comparison**
- Joins season-long FORGE Alpha with rolling FIRE scores per position pool
- Computes z-score delta (for ranking) and percentile delta (for display)
- Labels players BUY_LOW, SELL_HIGH, or NEUTRAL
- Label logic gates percentile-only triggers behind confidence — LOW confidence players can only be labeled via z-score threshold (≥1 or ≤-1), preventing false signals on small samples
- Each row includes a `why` object: `forge_vs_fire` summary, `window` label (e.g. "W11–W14"), `xfp_r`, `snaps_r`, `window_games_played`, and `top_role_driver` hint (e.g. "targets down", "routes up")
- Mode-aware: queries `forge_grade_cache` with version filter (future-proofed for dynasty/bestball)

**Player Trend (`/api/delta/eg/player-trend`)**
- Shows a player's FORGE vs FIRE percentile trajectory across multiple anchor weeks
- ⚠️ **Performance warning**: Runs full FORGE engine batch per anchor week — a 5-week request = 5 full FORGE computations. Can exhaust DB connection pool. Flagged for pre-season optimization (pre-compute into cache).

**Fantasy Lab UI Features (Phase 3):**
- FIRE table with confidence badges, games played, star/watchlist toggle
- Delta table with direction/confidence/sort filters
- FORGE vs FIRE scatter chart visualization
- Watchlist tab with per-player trend sparklines
- Data foundation: `fantasy_metrics_weekly_mv` materialized view (weekly opportunity + xFP v2 + market context)

**Key endpoints:**
- `GET /api/fire/eg/batch` — Batch FIRE scores by position
- `GET /api/fire/eg/player` — Single player FIRE score
- `GET /api/delta/eg/batch` — Delta rankings with buy/sell labels
- `GET /api/delta/eg/player-trend` — Per-player trend across weeks
- `GET /api/fantasy-lab/weekly` — Weekly metrics from materialized view
- `GET /api/fantasy-lab/player` — Single player weekly metrics
- `POST /api/admin/fantasy-lab/refresh` — Refresh materialized view

### IDP Lab (`/idp-lab`)
Defensive player analytics using a custom Havoc Index scoring system. Completely separate from the offensive FORGE/FIRE/Delta systems.

- **Havoc Index**: Bayesian-smoothed defensive impact score (0-100) with position-specific baselines
- Uses z-score normalization across 7 havoc event types (sacks, TFLs, forced fumbles, INTs, PDs, pressures, QB hits)
- Position-specific baselines for DL, EDGE, LB, CB, S
- Tier mapping: T1 (elite) through T5 (below average) with healthy distribution
- Prior snaps = 200, minimum snaps = 150 for eligibility

**Database tables:** `idp_players`, `idp_weekly_stats`, `idp_havoc_scores`, `idp_position_baselines`

**Key endpoints:**
- `GET /api/idp/rankings` — Havoc Index rankings with position filters
- `GET /api/idp/player/:id` — Individual player detail with weekly breakdown
- `GET /api/idp/export/csv` — CSV export of rankings

**UI features:** Rankings table with position filters, player detail modals, CSV export, Havoc formula explanation card

**Validated data:** 118 players, ~1,500 weekly records, 5 position baselines, tier distribution: T1 5.9%, T2 16.1%, T3 66.1%, T4 11.9%

### Other Live Features

- **Dashboard** (`/`) — Hero section, position-filter toolbar, FORGE-powered player table with tier badges and trend bars
- **Madden-Style OVR Ratings** (`/api/ovr/*`) — 1-99 player ratings (backend API available)
- **Defense vs Position (DvP)** (`/api/dvp/*`) — Fantasy points allowed by defenses against each position (backend API available)
- **Strategy Tab** — Start/Sit recommendations, Waiver Wire targets, SOS rankings
- **Weekly Takes** — Quick matchup insights
- **DST Streamer** — Weekly defense/special teams streaming recommendations (utility tool, separate from core skill-position focus)
- **Player Pages** (`/player/:playerId`) — Individual player profiles
- **Schedule** (`/schedule`) — NFL schedule view
- **RAG Chat** — AI chat powered by Google Gemini with knowledge of Tiber data
- **Tiber Memory** — Persistent memory system with FANTASY and GENERAL pools
- **X Intelligence Scanner** — Grok-powered X/Twitter scanning for fantasy trends, injuries, breakouts (backend infrastructure ready)
- **Sentinel Dashboard** — System health monitoring
- **Metrics Dictionary** (`/metrics-dictionary`) — Reference for all analytics terminology
- **Player Comparison** (`/api/player-comparison/*`) — Side-by-side player analysis (backend API available)
- **Consensus Benchmarks** (`/api/consensus/*`) — Community ranking baselines (backend API available)
- **FORGE Workbench** (`/forge-workbench`) — Interactive FORGE internals explorer

### Admin Tools (Internal)
- FORGE Hub, FORGE Lab, FORGE Simulation
- Player Mapping and Player Research
- API Lexicon (endpoint testing tool)
- RAG Status monitor
- WR and QB Rankings Sandboxes

---

## Architecture Patterns

- **3-Tier ELT:** Bronze (raw ingestion) → Silver (cleaned/enriched) → Gold (aggregated/scored)
- **Player Identity:** Unified via `gsis_id` (NFL's primary identifier) with an Identity Bridge across platforms
- **LLM Gateway:** Provider-agnostic `callLLM()` with automatic fallback chain, task-based routing for 9 task types
- **Data Quality:** Multi-dimensional validation, data lineage tracking, confidence scoring
- **Frontend State:** TanStack Query for server state, no global state management needed
- **Routing:** wouter (lightweight React router)
- **Styling:** Tailwind CSS + shadcn/ui component library

---

## What's Planned but Not Yet Built

- **Player Compass** — Dynamic, context-aware player profiles with tiers, scenario scores, and decision-making guidance (replaces rigid rankings)
- **TIBER Consensus** — Community-driven rankings aggregation
- **TIBER Brain OS** — Advanced AI insights layer
- **Public X/Twitter presence** — Content strategy based on Data Lab findings and hidden gems
- **FORGE Snapshot Pre-Computation** — Weekly FORGE scores saved to `forge_grade_cache` after each batch run, enabling sub-second player-trend queries (currently runs live and is expensive)
- **QB FIRE Support** — QB x_ppr_v2 data is currently NULL (27% of dataset); QB FIRE scoring is unavailable until xFP v2 data is populated for QBs

---

## Key Data Points for Content Creation

When creating posts, articles, or analysis based on Tiber data:

- All metrics are EPA-based (Expected Points Added), derived from nflfastR play-by-play data
- The platform covers the complete 2025 NFL season (Weeks 1-18)
- FORGE Alpha scores range from 0-100 with position-specific tier thresholds
- Three scoring format support: Standard, Half-PPR, Full PPR
- 117 enriched fields per player in the data pipeline
- Focus is dynasty-first but supports redraft and best ball modes
- All data is from free, open sources — no proprietary or paywalled data

---

## File Structure (Key Paths)

```
client/src/pages/              — All frontend pages (FantasyLab.tsx, IdpLab.tsx, etc.)
client/src/components/         — Shared UI components
client/src/lib/                — Utilities (csvExport.ts, queryClient, etc.)
server/routes.ts               — Main API route registration
server/routes/fireRoutes.ts    — FIRE, Delta, and player-trend endpoints
server/modules/datalab/        — Data Lab backend modules
server/modules/idp/            — IDP Lab (havocEngine.ts, idpRoutes.ts)
server/modules/forge/          — FORGE engine and grading (forgeEngine.ts, forgeGrading.ts)
server/services/               — Business logic services
server/llm/                    — LLM gateway and task routing
server/scripts/                — QA and sanity test scripts
shared/schema.ts               — Database schema (Drizzle ORM)
scripts/fire-delta-sanity.ts   — Integration test: FIRE + Delta endpoint validation
```

---

## How to Use This File

Paste this into any AI agent's context window (Claude, ChatGPT, Cursor, etc.) so it understands:
1. What Tiber Fantasy is and its mission
2. What features exist and are working
3. The data pipeline and what metrics are available
4. The tech stack and architecture patterns
5. What's planned next

This file should be updated whenever major features are added or the data pipeline changes.
