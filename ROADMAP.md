# Tiber Fantasy Platform Roadmap

## 🚧 Current Sprint: ELT Pipeline Foundation

### In Progress
- [ ] Process remaining 1,428 PENDING Bronze payloads (35 already processed)
- [ ] Set up automated ETL scheduling (cron jobs)
- [ ] Add comprehensive logging and monitoring

### Recently Completed ✅
- [x] **Full Bronze→Silver→Gold pipeline tested and working** (2026-01-04)
  - End-to-end test: 25 Bronze payloads → 25 Silver players → 798 Gold analytics records
  - Verified data quality: Barkley, Dowdle, Odunze, Hampton all present across layers
  - Silver ETL processed weeks 14-17: 1,250 player-week records
  - Gold ETL generated analytics metrics: TPRR, YPRR, ADOT, EPA, fantasy points
- [x] **Bronze→Silver processing implementation** (2026-01-04)
  - Integrated `SilverLayerService` into ETL routes
  - Implemented automatic payload status tracking (PENDING→SUCCESS/FAILED)
  - Successfully processed 35 payloads total → 35 players created
  - Fixed `getDataSourceStats` query bug
- [x] Bronze Layer raw data storage with deduplication (1,463 payloads stored)
- [x] Silver Layer ETL (bronze_nflfastr_plays → silver_player_weekly_stats - 5,033 records)
- [x] Gold Layer ETL (silver_player_weekly_stats → datadive_snapshot_player_week - 9,901 records)
- [x] Comprehensive test suite (`_check_bronze.ts`, `_verify.ts`, `_test_bronze_to_silver.ts`, `_test_full_pipeline.ts`)
- [x] ETL API routes with manual triggers (`/api/etl/bronze-to-silver`, `/api/etl/ingest-week`, `/api/etl/full-pipeline`)

---

## 🎯 Next Major Feature: Tiber Data Lab

**Vision:** Raw NFL data explorer, research-first interface. Not fantasy outputs, but the actual metrics that inform those outputs.

**Core Concept:** "Show your work" layer. If FORGE says a player is an 85, you should be able to go to Data Lab and see why—the raw numbers that fed that score.

### Interface Design
- **Position selector** (RB, WR, TE, QB)
- **Metric columns** that are position-relevant
- **Context toggles** (rushing vs receiving for RBs, etc.)
- **Sortable by any column**
- **Multi-select for custom views** (YPRR + targets, or carries + YPC + breakaway rate)

### Implementation Steps
- [ ] **Step 1: Audit NFLfastR player-level metrics**
  - Document available metrics: rushing attempts, yards, TDs, targets, receptions, air yards, YAC, routes run, EPA per play
  - Map metrics to positions (what's relevant for RB vs WR vs TE vs QB)
  - Identify which metrics are already in our Silver/Gold layers

- [ ] **Step 2: Design Data Lab schema**
  - Define metric catalog (name, description, position relevance, data source)
  - Create view/materialized view for fast metric queries
  - Design API endpoints for metric retrieval

- [ ] **Step 3: Build Data Lab UI**
  - Position selector component
  - Dynamic metric column builder
  - Sortable, filterable data table
  - Custom view save/load functionality

- [ ] **Step 4: Link to FORGE scores**
  - Add "Explain this score" button on player cards
  - Show breakdown of which metrics contributed to FORGE alpha
  - Highlight metrics that moved the score up/down

### Philosophy
This is the transparency layer that shows users how the sausage is made. Power users can dig into the raw data, casual users can verify FORGE's logic, everyone wins.

---

## 🔮 Future Ideas (Backlog)

- [ ] Historical trend views in Data Lab (week-over-week metric changes)
- [ ] Metric correlations explorer (which stats predict success?)
- [ ] Export custom views to CSV/JSON
- [ ] Community metric definitions (let users create custom calculated metrics)
- [ ] Data Lab → FORGE feedback loop (identify which metrics matter most)

---

## 📊 Technical Debt & Improvements

- [ ] Add rate limiting/retry logic to Bronze layer adapters
- [ ] Implement proper error handling in ETL pipelines
- [ ] Add comprehensive logging for ETL job monitoring
- [ ] Create automated ETL scheduling (cron jobs)
- [ ] Performance optimization for large Silver layer aggregations

---

**Last Updated:** 2026-01-04
