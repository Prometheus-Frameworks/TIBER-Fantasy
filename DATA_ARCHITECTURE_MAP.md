# DATA ARCHITECTURE MAP
## Fantasy Football Analytics Platform - As-Built Documentation

---

## 📥 EXTERNAL DATA SOURCES

### 1. Sleeper API (Primary Source)
**Base URL:** `https://api.sleeper.app/v1`

#### Players Database
- **Data:** Player roster, IDs, basic info, fantasy positions, injury status (11,400 players)
- **Code:** 
  - `server/services/sleeperSyncService.ts` > `SleeperSyncService.syncPlayers()`
  - `server/adpSyncService.ts` > `fetchSleeperADP()`
  - `server/teamSync.ts:180` > fetches `/players/nfl`
- **Schedule:** 
  - Live sync on app boot (server/routes.ts:191)
  - Cached locally at `server/data/sleeper_cache/players.json`
  - 6-hour cache expiry

#### Season Projections
- **Data:** Weekly/season projections (pass_yds, rush_yds, rec_yds, fantasy_points)
- **Code:** 
  - `server/services/sleeperProjectionsService.ts` > `getSleeperProjections()`
  - `server/routes.ts:935,963` > `/stats/nfl/regular/2024` and weekly variants
- **Schedule:** On-demand API calls with fallback to league matchup data

#### ADP Data
- **Data:** Average Draft Position (overall & positional) for PPR/Standard/Dynasty
- **Code:**
  - `server/adpSyncService.ts:122` > `/players/nfl`
  - `server/services/consensusBenchmark.ts:97` > `/adp/nfl/ppr`
  - `server/services/enhancedEcrProvider.ts:258` > `/adp/nfl/ppr?season=2025`
- **Schedule:** Auto-sync every N hours (configurable, default disabled)

#### Trending Players
- **Data:** Add/drop trends, ownership changes
- **Code:** `server/sleeperRoutes.ts:426` > `/players/nfl/trending/add`
- **Schedule:** On-demand

#### League Data (User-specific)
- **Data:** Rosters, matchups, users, league settings
- **Code:** `server/teamSync.ts:115,131,146` > `/league/{id}`, `/league/{id}/rosters`, `/league/{id}/users`
- **Schedule:** On-demand when user connects league

#### NFL State (Season/Week info)
- **Data:** Current season, week number, season type
- **Code:** 
  - `server/sleeperRoutes.ts:501` > `/state/nfl`
  - `server/services/SeasonService.ts` > season detection
- **Schedule:** Polled periodically

### 2. ESPN API (Secondary Source)
**Base URL:** ESPN API (site.api.espn.com)

- **Data:** Game data, team info, scores, venues, attendance
- **Code:** `server/espnAPI.ts` (419 lines) - comprehensive ESPN integration
- **Schedule:** On-demand
- **Status:** Implemented but not heavily used (adapter at `server/platformSync/adapters/espnAdapter.ts`)

### 3. NFL.com Data (Tertiary)
- **Data:** Team/player info for cross-platform identity resolution
- **Code:** `server/platformSync/adapters/nflAdapter.ts`
- **Schedule:** On-demand
- **Status:** Adapter exists for identity mapping

### 4. FantasyPros (Planned/Partial)
- **Data:** Expert consensus rankings, ADP
- **Code:** `server/adpSyncService.ts:87` > `fetchFantasyProsADP()` method exists
- **Schedule:** Auto-sync (if enabled)
- **Status:** Method defined but **NOT IMPLEMENTED** (returns empty array)

### 5. Grok AI Projections (Experimental)
- **Data:** AI-generated player projections
- **Code:** `server/services/grokProjectionsService.ts` > `fetchGrokProjections()`
- **Schedule:** On-demand via `/api/grok-projections`
- **Status:** Active, uses external AI service

### 6. Data Sources NOT Currently Active
- MySportsFeeds (enum exists, no implementation found)
- Yahoo (enum exists, no implementation found)
- Manual data entry (enum exists, no UI found)

---

## 💾 DATABASE TABLES (76 Total Tables)
**Schema File:** `shared/schema.ts` (2,882 lines)

### BRONZE LAYER - Raw Data Storage (8 tables)

#### `ingest_payloads` - Central raw data repository
- **Stores:** Raw JSON payloads from all external APIs
- **Populated by:** `server/services/BronzeLayerService.ts` > `storeRawPayload()`
- **Sources:** sleeper, nfl_data_py, fantasypros, mysportsfeeds, espn, yahoo, manual, computed
- **Indexes:** source+endpoint, season+week, status, jobId, unique checksum
- **Data Volume:** Deduplication via checksumHash

#### `dataset_versions` - Version tracking
- **Stores:** Data version commits per dataset/season/week
- **Populated by:** ETL orchestrator after each layer transformation
- **Tracks:** bronze_players, silver_players, gold_player_week, etc.

#### `monitoring_job_runs` - Simple job tracking
- **Stores:** Job execution history (simplified monitoring)
- **Populated by:** `server/services/MonitoringService.ts`
- **Fields:** jobName, status, startedAt, finishedAt, durationMs, details

#### `job_runs` - Master orchestration tracking
- **Stores:** UPH job execution state (WEEKLY/SEASON/BACKFILL/INCREMENTAL)
- **Populated by:** `server/services/UPHCoordinator.ts` > job orchestration
- **Fields:** jobId (PK), type, status, season, week, sources[], metadata

#### `task_runs` - Granular task tracking
- **Stores:** Individual Bronze/Silver/Gold/QualityGate task execution
- **Populated by:** UPHCoordinator during DAG execution
- **Fields:** id, jobId (FK), taskType, status, retryCount, executionTime

#### `intelligent_schedule_state` - Smart scheduler state
- **Stores:** Intelligent scheduling state for data-driven triggers
- **Populated by:** `server/services/IntelligentScheduler.ts`
- **Fields:** scheduleId, enabled, lastRun, nextRun, triggerConditions

#### `schedule_triggers` - Event-based triggers
- **Stores:** Dataset change triggers for cascading updates
- **Populated by:** IntelligentScheduler on dataset changes

#### `schema_registry` - Schema evolution tracking
- **Stores:** Database schema versions and drift detection
- **Populated by:** `server/services/SchemaDriftService.ts`
- **Fields:** version, sqlHash, appliedAt, driftDetected

### SILVER LAYER - Normalized Canonical Data (18 tables)

#### `player_identity_map` - Cross-platform identity resolution
- **Stores:** Canonical player_id mapping across 8+ platforms
- **Populated by:** `server/services/PlayerIdentityService.ts` > `resolveIdentity()`
- **Platforms:** sleeper_id, espn_id, yahoo_id, fantasypros_id, nfl_id, pfr_id, rotowire_id, stats_id
- **Quality:** confidence_score, verified, lastVerified

#### `nfl_teams_dim` - Team dimension table
- **Stores:** NFL team master data (abbreviation, name, colors, logos)
- **Populated by:** `server/processors/TeamsDimProcessor.ts` (Silver layer)
- **Fields:** team_abbr (PK), full_name, short_name, conference, division

#### `players` - Canonical player dimension
- **Stores:** Normalized player master data
- **Populated by:** `server/processors/PlayersDimProcessor.ts` (Silver layer)
- **Fields:** id (PK), name, position, team, age, yearsExp, status, fantasyPositions[]
- **Data Quality:** Uses playerIdentityMap for deduplication

#### `market_signals` - Market indicators
- **Stores:** ADP, ownership, trending data
- **Populated by:** `server/processors/MarketSignalsProcessor.ts`
- **Fields:** playerId, adp, ownership, trendDirection, source, recordedAt

#### `injuries` - Injury tracking
- **Stores:** Player injury status and timeline
- **Populated by:** `server/processors/InjuriesProcessor.ts`
- **Fields:** playerId, injuryType, severity, status, reportedDate, expectedReturn

#### `depth_charts` - Team depth chart positions
- **Stores:** Player depth chart position by team
- **Populated by:** `server/processors/DepthChartsProcessor.ts`
- **Fields:** playerId, team, position, depth, updatedAt

#### Other Silver Tables:
- `teams` - Team data
- `season_state` - Current season/week state
- `schedule` - NFL game schedule
- `player_injuries` - Injury details
- `player_bios` - Player biographical data
- `player_usage_weekly` - Weekly usage metrics
- `defense_dvp` - Defense vs Position stats
- `sos_scores` - Strength of Schedule
- `defense_context` - Defensive context
- `team_offensive_context` - Offensive context (week-level)
- `team_defensive_context` - Defensive context (week-level)
- `team_receiver_alignment_matchups` - WR alignment matchups
- `team_coverage_matchups` - Coverage scheme matchups

### GOLD LAYER - Analytics-Ready Facts (24 tables)

#### `player_week_facts` - Weekly player analytics
- **Stores:** Enriched weekly performance facts
- **Populated by:** `server/processors/facts/WeeklyFactsProcessor.ts` (Gold layer)
- **Fields:** playerId, season, week, snapShare, targetShare, touchShare, redZoneUse, gameScript, opponent, projection, actual
- **Indexes:** playerId+season+week (unique), performance metrics

#### `player_season_facts` - Season aggregations
- **Stores:** Season-level aggregated facts
- **Populated by:** `server/processors/facts/SeasonFactsProcessor.ts`
- **Fields:** playerId, season, totalSnaps, avgSnapShare, touchDistribution, efficiency, consistency

#### `player_market_facts` - Market analytics
- **Stores:** Market-driven fantasy metrics (ADP, trends, value)
- **Populated by:** `server/processors/facts/MarketFactsProcessor.ts`
- **Fields:** playerId, format (dynasty/redraft), adpRank, adpTrend, ownership, value

#### `player_composite_facts` - Multi-source fusion
- **Stores:** Composite analytics from all sources
- **Populated by:** `server/processors/facts/CompositeFactsProcessor.ts`
- **Fields:** playerId, overallRating, vorpScore, tierAssignment, format, confidence

#### Other Gold Tables:
- `player_week_facts_metadata` - Quality metadata for weekly facts
- `quality_gate_results` - Quality validation results
- `data_lineage` - Complete data lineage tracking
- `brand_signals` - Brand intelligence signals (Rookie Risers, Redraft, etc.)
- `buys_sells` - Buy/Sell recommendations
- `advanced_signals` - Advanced analytics signals
- `player_attributes` - Player attribute calculations
- `market_rollups` - Market data aggregations
- `player_season_2024` - 2024 season stats
- `player_advanced_2024` - 2024 advanced stats
- `wp_splits_weekly` - Win probability splits
- `game_logs` - Historical game logs
- `rookie_weekly_usage` - Rookie-specific usage
- `rookie_context_signals` - Rookie development signals
- `rookie_riser_snapshots` - Rookie Risers brand snapshots

### FEATURE/APPLICATION TABLES (26 tables)

#### User & Community (7 tables)
- `user_profiles` - User accounts
- `user_ranks` - User rankings submissions
- `fire_events` - Community "fire" voting
- `consensus_ranks` - Community consensus rankings
- `consensus_audit` - Ranking audit trail
- `consensus_board` - Consensus leaderboard
- `consensus_meta` - Consensus metadata

#### Dynasty & Trade Analysis (5 tables)
- `dynasty_trade_history` - Historical dynasty trades
- `trade_analysis` - Trade evaluation results
- `value_arbitrage` - Market value inefficiencies
- `metric_correlations` - Metric correlation analysis
- `player_value_history` - Historical player values

#### Fantasy Management (8 tables)
- `team_players` - User team rosters
- `lineup_optimization` - Optimal lineup recommendations
- `waiver_recommendations` - Waiver wire suggestions
- `fantasy_moves` - User fantasy actions log
- `draft_picks` - Draft pick tracking
- `position_analysis` - Position-specific analysis
- `weekly_performance` - Weekly team performance
- `matchup_analysis` - H2H matchup analysis

#### Content & Research (6 tables)
- `articles` - News articles
- `tiber_memory` - AI memory/context system
- `sos_dashboards` - SOS dashboard configs
- `sos_widgets` - SOS widget configs
- `sos_user_preferences` - User SOS preferences
- `consensus_explanations` - Ranking explanation text
- `consensus_changelog` - Consensus change log

---

## ⚙️ ETL JOBS & DATA TRANSFORMATIONS

### UPH Core Orchestration (3-Layer DAG)

#### UPH Coordinator - Master Orchestrator
- **File:** `server/services/UPHCoordinator.ts` (1,927 lines)
- **Job Types:** WEEKLY, SEASON, BACKFILL, INCREMENTAL
- **Execution Flow:**
  1. Bronze Ingestion (BRONZE_INGEST tasks)
  2. Silver Transformation (SILVER_TRANSFORM tasks)
  3. Gold Facts (GOLD_FACTS tasks)
  4. Quality Gates (QUALITY_GATE tasks)
- **Methods:**
  - `processWeeklyData(season, week)` - Weekly processing
  - `processSeasonData(season)` - Full season processing
  - `processIncrementalUpdate()` - Incremental updates
  - `backfillHistoricalData(dateRange)` - Historical backfill
- **Tracking:** Creates jobRuns + taskRuns records for lineage

#### Bronze Layer Service
- **File:** `server/services/BronzeLayerService.ts` (487 lines)
- **Transform:** External APIs → `ingest_payloads` table
- **Methods:**
  - `storeRawPayload(input)` - Idempotent storage with checksums
  - `batchStorePayloads(inputs[])` - Batch ingestion
  - `getPayloadsByFilters(filters)` - Query raw data
- **Features:** Deduplication, error tracking, metadata preservation

#### Silver Layer Service
- **File:** `server/services/SilverLayerService.ts` (500 lines)
- **Transform:** Bronze (`ingest_payloads`) → Normalized Silver tables
- **Methods:**
  - `processPayloads(filters)` - Transform Bronze to Silver
  - `resolveIdentities()` - Cross-platform player matching
  - `validateDataQuality()` - Quality checks
- **Processors:**
  - `PlayersDimProcessor` → `players` table
  - `TeamsDimProcessor` → `nfl_teams_dim` table
  - `MarketSignalsProcessor` → `market_signals` table
  - `InjuriesProcessor` → `injuries` table
  - `DepthChartsProcessor` → `depth_charts` table
- **Conflict Resolution:** Latest, source priority, or manual merge strategies

#### Gold Layer Service
- **File:** `server/services/GoldLayerService.ts` (869 lines)
- **Transform:** Silver tables → Gold analytics facts
- **Methods:**
  - `processWeeklyFacts(season, week)` - Weekly aggregation
  - `processSeasonFacts(season)` - Season rollup
  - `processMarketFacts(format)` - Market analytics
  - `processCompositeFacts()` - Multi-source fusion
- **Processors:**
  - `WeeklyFactsProcessor` → `player_week_facts`
  - `SeasonFactsProcessor` → `player_season_facts`
  - `MarketFactsProcessor` → `player_market_facts`
  - `CompositeFactsProcessor` → `player_composite_facts`
- **Quality Gates:** Enforced before Gold layer write

### Quality & Validation Services

#### Quality Gate Validator
- **File:** `server/services/quality/QualityGateValidator.ts`
- **When:** Runs between Silver→Gold transitions
- **Checks:** Completeness, consistency, accuracy, freshness
- **Output:** `quality_gate_results` table records

#### Data Lineage Tracker
- **File:** `server/services/quality/DataLineageTracker.ts`
- **When:** Every transformation step
- **Output:** `data_lineage` table (tracks sourceTable → targetTable, jobId, timestamp)

#### Confidence Scorer
- **File:** `server/services/quality/ConfidenceScorer.ts`
- **When:** Gold layer fact creation
- **Output:** confidence_score field in facts tables

### Scheduled ETL Jobs

#### 1. Weekly Hot List Update
- **File:** `server/cron/weeklyUpdate.ts` > `setupWeeklyHotListCron()`
- **Schedule:** Tuesday 2 AM ET (cron: `0 2 * * 2`)
- **Purpose:** Update hot players after Monday Night Football
- **ETL:** `server/etl/weeklyHotListUpdate.ts` > `weeklyHotListETL.updateHotListFromLiveData(week)`
- **Writes to:** Hot list analytics (not explicitly shown in schema)

#### 2. Nightly Buys/Sells Computation
- **File:** `server/cron/weeklyUpdate.ts` > `setupNightlyBuysSellsCron()`
- **Schedule:** Daily 3 AM ET (cron: `0 3 * * *`)
- **Purpose:** Compute Buy/Sell recommendations
- **ETL:** `server/etl/nightlyBuysSellsUpdate.ts` > `nightlyBuysSellsETL.processNightlyBuysSells()`
- **Writes to:** `buys_sells` table

#### 3. Weekly Data Processing
- **File:** `server/cron/weeklyUpdate.ts` > `setupWeeklyDataProcessing()`
- **Schedule:** Tuesday 4 AM ET (cron: `0 4 * * 2`)
- **Purpose:** Comprehensive weekly processing
- **ETL:** Calls Buys/Sells ETL for new week + health check

#### 4. UPH Nightly Scheduler (Advanced)
- **File:** `server/services/UPHScheduler.ts`
- **Schedules:**
  - `nightly-weekly-processing` - Daily 2 AM (cron: `0 2 * * *`) - WEEKLY job type
  - `weekly-season-processing` - Sunday 1 AM (cron: `0 1 * * 0`) - SEASON job type
  - `incremental-processing` - Every 6 hours (cron: `0 */6 * * *`) - INCREMENTAL job type
- **Purpose:** Orchestrates UPHCoordinator jobs
- **Status:** Active with health monitoring

#### 5. Intelligent Scheduler (Event-Driven)
- **File:** `server/services/IntelligentScheduler.ts`
- **Trigger:** Data-driven, not cron-based
- **Schedules:**
  - `incremental_processing` - Polls every ~126s (2.1 min)
  - `weekly_processing` - Polls every 30 min
  - `brand_recompute` - Polls every ~5 min
  - `brand_week_rollover` - Event-driven
  - `brand_signal_refresh` - Event-driven
- **Purpose:** React to dataset changes, trigger dependent jobs
- **Method:** `onDatasetChange(dataset, season, week)` triggers cascading updates

#### 6. Brand Signals Brain
- **File:** `server/services/BrandSignalsBootstrap.ts`
- **Purpose:** Recompute brand intelligence signals (Rookie Risers, Redraft Buy/Sell)
- **Triggers:** Via IntelligentScheduler on data changes
- **Writes to:** `brand_signals` table

### Ad-Hoc ETL Endpoints (Manual Trigger)

- **POST /api/unified-players/refresh** - Refresh unified player data
- **POST /api/snap/pipeline/:position** - Trigger snap percentage pipeline
- **POST /api/wr-game-logs/generate** - Generate WR game logs
- **POST /api/generate/wr-snap-data** - Generate WR snap data
- **POST /api/consensus/rebuild** - Rebuild consensus rankings
- **POST /api/consensus/seed** - Seed consensus with initial data

---

## 🔌 API ENDPOINTS (Data Serving Layer)

### Core Rankings & Ratings

#### GET /api/rankings
- **Returns:** VORP-based player rankings (redraft/dynasty modes)
- **Queries:** Sleeper projections → VORP calculation (in-memory)
- **Code:** `server/routes.ts:1148` (rate limited)
- **Features:** Position filter, num_teams, starters config, dynasty age penalties
- **Performance:** ~700ms (VORP calculation is O(n²))

#### GET /api/ratings
- **Returns:** Player ratings (1-99 Madden-style OVR scores)
- **Queries:** `player_composite_facts` JOIN `player_season_facts`
- **Code:** `server/routes.ts:719`
- **Consumed by:** `Rankings.tsx` (client/src/pages/Rankings.tsx:92)

#### GET /api/ratings/player/:playerId
- **Returns:** Individual player rating details with debug info
- **Queries:** `player_composite_facts` + calculation breakdown
- **Code:** `server/routes.ts:753`

### Player Comparison & Analysis

#### GET /api/player-usage-compare
- **Returns:** Side-by-side player usage comparison
- **Queries:** `player_usage_season_avg` JOIN `nflfastr_rosters` JOIN `schedule`
- **Code:** `server/routes.ts:605` (rate limited)
- **Consumed by:** `PlayerCompare.tsx` (client/src/pages/PlayerCompare.tsx:34)
- **Performance:** ~2.8s (complex 3-table join)

#### GET /api/consensus/:format (dynasty/redraft)
- **Returns:** Community consensus rankings
- **Queries:** `consensus_ranks` + aggregation logic
- **Code:** `server/routes.ts:4493` (rate limited)
- **Service:** `server/services/otcConsensusService.ts`

#### GET /api/consensus/players
- **Returns:** Player list for consensus ranking
- **Queries:** `players` table filtered by position
- **Code:** `server/routes.ts:3602`

### Projections & Stats

#### GET /api/grok-projections
- **Returns:** AI-generated projections from Grok
- **Source:** External Grok API
- **Code:** `server/routes.ts:1092`
- **Service:** `server/services/grokProjectionsService.ts`

#### GET /api/projections/rb
- **Returns:** RB projections
- **Service:** `server/services/rbProjectionsService.ts`
- **Code:** `server/routes.ts:2066`

#### GET /api/logs/player/:playerId
- **Returns:** Player game logs
- **Queries:** `game_logs` table
- **Code:** `server/routes.ts:478`

### Player Data & Identity

#### GET /api/unified-players
- **Returns:** Unified player database with cross-platform IDs
- **Queries:** `players` JOIN `player_identity_map`
- **Code:** `server/routes.ts:2644`
- **Service:** `server/services/unifiedPlayerService.ts`

#### GET /api/unified-players/:id
- **Returns:** Single player with all platform IDs
- **Queries:** `player_identity_map` by canonical ID
- **Code:** `server/routes.ts:2681`

#### GET /api/players/resolve/:playerId
- **Returns:** Resolved player identity across platforms
- **Service:** `server/services/PlayerIdentityService.ts`
- **Code:** `server/routes.ts:2902`

#### POST /api/players/resolve
- **Body:** Player name or partial data
- **Returns:** Resolved canonical player ID
- **Code:** `server/routes.ts:2935`

### Team & Matchup Context

#### GET /api/team-context/:team/:position
- **Returns:** Team offensive/defensive context for position
- **Queries:** `team_offensive_context` OR `team_defensive_context`
- **Code:** Team context routes (not shown in grep)

#### GET /api/matchup/*
- **Returns:** Matchup intelligence data
- **Code:** Player matchup intelligence routes at `/api/matchup/*`

### Market & Trending

#### GET /api/sleeper/trending (via sleeperRoutes.ts)
- **Returns:** Trending players (add/drop)
- **Source:** Live Sleeper API
- **Code:** `server/sleeperRoutes.ts:426`

#### GET /api/value-arbitrage
- **Returns:** Market inefficiencies
- **Queries:** `value_arbitrage` table
- **Code:** Value arbitrage routes (not shown in grep)

### Health & Monitoring

#### GET /api/health
- **Returns:** System health status
- **Code:** `server/routes.ts:297`

#### GET /healthz
- **Returns:** Kubernetes-style health check
- **Code:** `server/routes.ts:184`

#### GET /readyz
- **Returns:** Readiness probe (DB connection check)
- **Code:** `server/routes.ts:200`

#### GET /metrics
- **Returns:** Prometheus-compatible metrics
- **Code:** `server/routes.ts:216`

### Dynasty & Trade Tools

#### GET /api/trade-history
- **Returns:** Historical dynasty trades
- **Queries:** `dynasty_trade_history`
- **Routes:** Trade history routes

#### GET /api/compass/* (WR/RB/QB/TE)
- **Returns:** Player Compass ratings (proprietary algorithm)
- **Code:** Multiple compass routes (`/api/compass/WR`, etc.)
- **Service:** `server/services/playerCompassService.ts`

### Content & Community

#### GET /api/articles
- **Returns:** Fantasy articles
- **Queries:** `articles` table
- **Routes:** Articles routes

#### GET /api/profile/:username
- **Returns:** User profile with rankings
- **Queries:** `user_profiles` JOIN `user_ranks`
- **Code:** `server/routes.ts:2604`

#### GET /api/leaderboard/fire
- **Returns:** Community "fire" leaderboard
- **Queries:** `fire_events` aggregated
- **Code:** `server/routes.ts:2607`

### Admin & Debug

#### GET /api/test-usage-data
- **Returns:** Test data from player_usage_season_avg
- **Code:** `server/routes.ts:575`

#### GET /api/test-simple
- **Returns:** Simple test endpoint
- **Code:** `server/routes.ts:569`

#### GET /api/current-week
- **Returns:** Current NFL season/week
- **Code:** `server/routes.ts:247`

---

## 🎨 FRONTEND COMPONENTS (Data Consumption)

### Main Pages (120+ pages total)

#### Rankings Pages
- **`client/src/pages/Rankings.tsx`**
  - Calls: `GET /api/ratings?position={pos}&format={format}&week={week}`
  - Query Key: `["ratings", pos, format, week, debugMode]`
  - Displays: OVR ratings (1-99), tier, VOR, bye week

- **`client/src/pages/PlayerRankings.tsx`**
  - Calls: Similar to Rankings.tsx
  - Alternative rankings view

#### Player Comparison
- **`client/src/pages/PlayerCompare.tsx`**
  - Calls: `GET /api/player-usage-compare?player1={name}&player2={name}`
  - Query Key: `['/api/player-usage-compare?player1=...&player2=...', player1Name, player2Name]`
  - Displays: Side-by-side usage stats, alignment, target share

#### Player Profiles
- **`client/src/pages/PlayerProfile.tsx`**
- **`client/src/pages/enhanced-player-profile.tsx`**
- **`client/src/pages/players/PlayerProfile.tsx`**
  - Calls: Multiple endpoints for player data
  - Uses: Player identity resolution, game logs, projections

#### Dynasty Analysis
- **`client/src/pages/Dynasty.tsx`**
- **`client/src/pages/enhanced-dynasty.tsx`**
- **`client/src/pages/dynasty-values.tsx`**
  - Calls: Dynasty-specific endpoints
  - Displays: Long-term values, age curves

#### Trade Analysis
- **`client/src/pages/TradeAnalyzerNew.tsx`**
- **`client/src/pages/trade-history.tsx`**
  - Calls: Trade evaluation endpoints
  - Uses: Dynasty trade history, value arbitrage

#### Consensus Rankings
- **`client/src/pages/ConsensusTransparency.tsx`**
- **`client/src/pages/ConsensusSeeding.tsx`**
- **`client/src/pages/experts/ArchitectJ.tsx`**
  - Calls: `/api/consensus/*` endpoints
  - Displays: Community rankings, expert comparisons

#### Analytics Dashboards
- **`client/src/pages/Analytics.tsx`**
- **`client/src/pages/player-analytics.tsx`**
- **`client/src/pages/premium-analytics.tsx`**
  - Calls: Multiple analytics endpoints
  - Displays: Advanced metrics, trends

#### Team Context
- **`client/src/pages/team-context.tsx`**
- **`client/src/pages/OASISTeamContext.tsx`**
- **`client/src/pages/QBEnvironmentContext.tsx`**
  - Calls: Team context endpoints
  - Displays: Offensive/defensive context, QB environment

#### Position-Specific Pages
- **`client/src/pages/WRCompass.tsx`**
- **`client/src/pages/RBCompass.tsx`**
- **`client/src/pages/compass/CompassHub.tsx`**
  - Calls: `/api/compass/{position}` endpoints
  - Displays: Position-specific ratings

#### Hot List & Trending
- **`client/src/pages/HotList.tsx`**
- **`client/src/pages/trending-players.tsx`**
  - Calls: Hot list & trending endpoints
  - Displays: Rising/falling players

#### League Integration
- **`client/src/pages/sleeper-connect.tsx`**
- **`client/src/pages/sleeper-database.tsx`**
- **`client/src/pages/leagues.tsx`**
  - Calls: Sleeper sync endpoints
  - Displays: User's Sleeper leagues, rosters

### Common Data Fetching Patterns

#### TanStack Query (Primary)
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['/api/endpoint', ...params],
  // Default fetcher configured in @lib/queryClient
});
```

#### Query Invalidation
- After mutations, components call `queryClient.invalidateQueries([queryKey])`
- Ensures fresh data after updates

#### Loading States
- All components show `<Skeleton>` during `isLoading`
- Error states display user-friendly messages

---

## 📊 COMPLETE DATA FLOW EXAMPLES

### Example 1: VORP Rankings (Redraft)

```
1. USER: Visits /rankings?format=redraft&position=RB
   ↓
2. FRONTEND: Rankings.tsx renders
   - useQuery({ queryKey: ["ratings", "RB", "redraft", week] })
   - Calls: GET /api/ratings?position=RB&format=redraft&week=6
   ↓
3. BACKEND: server/routes.ts:719 (GET /api/ratings)
   - Queries: player_composite_facts (Gold layer)
   - JOIN: player_season_facts for stats
   - Calculation: OVR rating (1-99) + VORP + tier assignment
   ↓
4. RESPONSE: JSON array of player ratings
   ↓
5. FRONTEND: Rankings.tsx displays table
   - Columns: Rank, Name, Team, Position, OVR, VORP, Tier, Bye
   - Sortable, filterable by position
```

### Example 2: Player Comparison (Usage Stats)

```
1. USER: Navigates to /compare?player1=dk%20metcalf&player2=tee%20higgins
   ↓
2. FRONTEND: PlayerCompare.tsx loads
   - useQuery({ queryKey: ['/api/player-usage-compare?...', 'dk metcalf', 'tee higgins'] })
   - Calls: GET /api/player-usage-compare?player1=dk%20metcalf&player2=tee%20higgins
   ↓
3. BACKEND: server/routes.ts:605 (GET /api/player-usage-compare) [RATE LIMITED]
   - SQL Query: 
     SELECT psa.*, r.player_name, r.position, s.opponent, s.location
     FROM player_usage_season_avg psa
     LEFT JOIN nflfastr_rosters r ON psa.player_id = r.player_id AND r.season = 2025
     LEFT JOIN schedule s ON s.week = 6 AND (s.home = r.team OR s.away = r.team)
     WHERE LOWER(r.player_name) IN ('dk metcalf', 'tee higgins')
   ↓
4. RESPONSE: { data: [player1_data, player2_data] }
   ↓
5. FRONTEND: PlayerCompare.tsx renders comparison
   - Side-by-side cards
   - Displays: Alignment %, Target Share %, Week 6 Opponent, Latest Snap %
   - Visual comparison bars
```

### Example 3: Weekly ETL Pipeline (Bronze → Silver → Gold)

```
TRIGGER: Tuesday 2 AM ET (after Monday Night Football)
   ↓
1. CRON JOB: server/cron/weeklyUpdate.ts
   - setupWeeklyHotListCron() fires
   ↓
2. ETL KICKOFF: weeklyHotListETL.updateHotListFromLiveData(currentWeek)
   ↓
3. BRONZE LAYER: BronzeLayerService.storeRawPayload()
   - Fetch: https://api.sleeper.app/v1/stats/nfl/regular/2024/{week}
   - Store: ingest_payloads table
     {
       source: 'sleeper',
       endpoint: '/stats/nfl/regular/2024/6',
       payload: { ...raw_json... },
       version: 'v1',
       jobId: 'weekly_2024_w6_20241008',
       season: 2024,
       week: 6,
       status: 'SUCCESS',
       checksumHash: 'abc123...'
     }
   - Creates: job_runs record (type: WEEKLY, status: RUNNING)
   - Creates: task_runs record (taskType: BRONZE_INGEST, status: SUCCESS)
   ↓
4. SILVER LAYER: SilverLayerService.processPayloads()
   - Reads: ingest_payloads WHERE source='sleeper' AND week=6 AND status='SUCCESS'
   - Transform: Raw JSON → Normalized tables
     - PlayersDimProcessor → players table (dedup via player_identity_map)
     - MarketSignalsProcessor → market_signals table
   - Quality Check: Data completeness, identity resolution
   - Creates: task_runs record (taskType: SILVER_TRANSFORM, status: SUCCESS)
   - Updates: ingest_payloads.status = 'PROCESSED'
   ↓
5. QUALITY GATE: QualityGateValidator.validate()
   - Checks: Completeness (>95% fields populated)
   - Checks: Consistency (no conflicting data)
   - Checks: Accuracy (values within expected ranges)
   - Result: Stored in quality_gate_results table
   - Creates: task_runs record (taskType: QUALITY_GATE, status: SUCCESS)
   ↓
6. GOLD LAYER: GoldLayerService.processWeeklyFacts(2024, 6)
   - Reads: Silver tables (players, market_signals, etc.)
   - WeeklyFactsProcessor: Aggregates weekly stats
     - Calculates: snapShare, targetShare, touchShare, redZoneUse, gameScript
     - Enriches: Adds opponent matchup, projections
     - Writes: player_week_facts table
   - SeasonFactsProcessor: Updates season aggregates
     - Writes: player_season_facts table
   - MarketFactsProcessor: Computes market metrics
     - Writes: player_market_facts table
   - Creates: task_runs record (taskType: GOLD_FACTS, status: SUCCESS)
   ↓
7. DATA LINEAGE: DataLineageTracker.track()
   - Records: data_lineage entries
     {
       sourceTable: 'ingest_payloads',
       targetTable: 'player_week_facts',
       jobId: 'weekly_2024_w6_20241008',
       operation: 'transform',
       recordsProcessed: 250
     }
   ↓
8. DATASET VERSION: Commit version
   - Records: dataset_versions
     {
       dataset: 'gold_player_week',
       season: 2024,
       week: 6,
       rowCount: 250,
       source: 'sleeper'
     }
   ↓
9. INTELLIGENT SCHEDULER: IntelligentScheduler.onDatasetChange()
   - Event: 'gold_player_week' dataset updated for 2024/W6
   - Triggers: Dependent jobs
     - brand_signal_refresh → Recomputes brand_signals
     - Buys/Sells computation (if configured)
   ↓
10. JOB COMPLETION: Update job_runs
    - Sets: status = 'SUCCESS', endedAt = now(), stats = { recordsProcessed: 250, ... }
    ↓
11. FRONTEND AUTO-REFRESH: TanStack Query cache invalidation
    - React Query detects data version change (if polling enabled)
    - OR user refreshes page
    - Calls: GET /api/ratings (fetches from updated player_composite_facts)
    - UI: Shows updated Week 6 rankings
```

### Example 4: User Connects Sleeper League

```
1. USER: Clicks "Connect Sleeper League" on /sleeper-connect
   ↓
2. FRONTEND: Prompts for League ID
   ↓
3. API CALL: POST /api/sleeper/sync (conceptual, actual endpoint may vary)
   ↓
4. BACKEND: server/teamSync.ts > TeamSyncService
   - Fetch League: GET https://api.sleeper.app/v1/league/{leagueId}
   - Fetch Rosters: GET https://api.sleeper.app/v1/league/{leagueId}/rosters
   - Fetch Users: GET https://api.sleeper.app/v1/league/{leagueId}/users
   - Fetch Players: GET https://api.sleeper.app/v1/players/nfl (cached)
   ↓
5. DATA STORAGE:
   - Bronze: Store raw payloads in ingest_payloads
   - Silver: 
     - Resolve player IDs via PlayerIdentityService
     - Store in team_players (user rosters)
     - Update players table if new players found
   ↓
6. RESPONSE: { success: true, teams: [...], players: [...] }
   ↓
7. FRONTEND: Displays user's roster with enriched data
   - Shows: Player names, positions, teams, projections (from Gold layer)
   - Enables: Lineup optimization, trade analysis
```

---

## 🔍 KEY FINDINGS & OBSERVATIONS

### ✅ What's Actually Hooked Up & Working

1. **Sleeper API Integration** - Fully operational
   - Player database (11,400 players) syncs live on boot
   - Projections API works with fallback to league matchups
   - ADP data fetched on-demand
   - Trending players endpoint active

2. **3-Layer ELT Architecture** - Implemented & Active
   - Bronze Layer: Raw data storage working (ingest_payloads)
   - Silver Layer: Transformation services exist with processors
   - Gold Layer: Analytics facts generation implemented
   - UPH Coordinator: Orchestration framework operational

3. **Cron Jobs** - Running
   - Weekly Hot List: Tuesday 2 AM ET ✓
   - Nightly Buys/Sells: Daily 3 AM ET ✓
   - UPH Scheduler: Multiple schedules active ✓
   - Intelligent Scheduler: Event-driven triggers ✓

4. **Frontend Data Consumption** - Active
   - Rankings.tsx → /api/ratings (working)
   - PlayerCompare.tsx → /api/player-usage-compare (working)
   - 120+ pages using TanStack Query
   - Real-time data fetching with loading states

5. **Rate Limiting** - Newly Added
   - /api/rankings: 3 req/15min ✓
   - /api/player-usage-compare: 3 req/15min ✓
   - /api/consensus/:format: 3 req/15min ✓

### ⚠️ What's Partially Implemented

1. **ESPN Integration**
   - Adapter exists (`server/espnAPI.ts` - 419 lines)
   - NOT heavily used in current data flows
   - Could be activated for additional data sources

2. **Quality Gates**
   - Framework exists (QualityGateValidator, DataLineageTracker)
   - May not be enforced on all transformations
   - quality_gate_results table exists but usage unknown

3. **Brand Signals Brain**
   - Infrastructure exists (BrandSignalsBootstrap, IntelligentScheduler)
   - 2 plugins registered: rookie_risers, redraft
   - Unclear if actively computing brand_signals table

### ❌ What's NOT Implemented

1. **FantasyPros Integration**
   - Method exists: `fetchFantasyProsADP()` in adpSyncService.ts
   - Implementation: Returns empty array (placeholder)
   - NOT pulling real data

2. **MySportsFeeds, Yahoo**
   - Enums exist in dataSourceEnum
   - No adapter code found
   - No API calls found

3. **ADP Auto-Sync**
   - Config exists, methods implemented
   - Disabled by default (`enabled: false`)
   - No active sync running

### 🐛 Potential Issues & Gaps

1. **Schema Drift Detection Failing**
   - Boot logs show: "Database introspection failed: No schema content returned"
   - SchemaDriftService.ts trying to generate schema hash
   - Impact: Unknown if schema changes are being tracked

2. **Data Source Priority**
   - Multiple sources defined (sleeper, nfl_data_py, fantasypros, etc.)
   - Only Sleeper actively used
   - Conflict resolution strategies exist but may not be exercised

3. **Gold Layer Population**
   - Gold processors exist (WeeklyFactsProcessor, etc.)
   - Unclear if automatically triggered or manual
   - player_week_facts, player_season_facts may be empty or stale

4. **Frontend-Backend Mismatch**
   - Some frontend pages call endpoints that may not exist
   - Example: Many pages reference mock data or local state
   - Audit needed to confirm all API calls resolve

5. **Performance Bottlenecks**
   - VORP calculation: O(n²) complexity, ~700ms
   - Player comparison: 3-table join, ~2.8s
   - Rate limiting in place but may affect UX

---

## 📈 RECOMMENDATIONS

### Immediate Actions
1. **Verify Gold Layer Population** - Check if player_week_facts, player_season_facts are being populated
2. **Enable ADP Auto-Sync** - If FantasyPros is NOT available, enable Sleeper ADP sync
3. **Fix Schema Drift Detection** - Resolve database introspection failure
4. **Audit Frontend API Calls** - Ensure all useQuery calls have matching backend endpoints

### Data Quality
1. **Monitor Quality Gates** - Check quality_gate_results table for validation issues
2. **Review Data Lineage** - Verify data_lineage table tracks all transformations
3. **Test ETL Pipeline** - Manually trigger weekly ETL and verify Bronze→Silver→Gold flow

### Performance
1. **Optimize VORP Calculation** - Consider caching or pre-computation
2. **Index Player Comparison Query** - Add composite index on player_usage_season_avg
3. **Monitor Rate Limits** - Track 429 responses to ensure limits are appropriate

### Architecture
1. **Document ETL Triggers** - Clarify when UPH Coordinator runs vs Intelligent Scheduler
2. **Consolidate Scheduling** - Multiple schedulers (cron, UPHScheduler, IntelligentScheduler) may conflict
3. **Standardize Error Handling** - Ensure all ETL jobs log to monitoring_job_runs

---

**END OF DATA ARCHITECTURE MAP**
