# CATALYST Score — Build Tracker

## Overview
**CATALYST** (Contextual Adaptive Tactical Leverage Yield Score) is a play-level efficiency metric that measures how well a player performs in high-leverage situations. Unlike raw EPA or fantasy points, CATALYST weights production by game context — win probability swing, opponent quality, game script, and recency — to separate clutch performers from garbage-time stat padders.

**Design philosophy:** Build as a standalone metric first, validate against known outcomes, then integrate into FORGE Efficiency pillar at a calibrated weight.

## Data Dependencies (verified)
- `bronze_nflfastr_plays`: 98k+ plays across 2024-2025, contains `epa`, `wpa`, `play_type`, `yards_gained`, `passer_player_id`, `rusher_player_id`, `receiver_player_id`, `defteam`, `week`, `season`
- Missing from PBP: `score_differential` (not in current columns — needs ingestion or derivation from `raw_data` JSONB)
- FPOE: exists at season/game level in FORGE (`fpoe_per_game`), NOT at play level — CATALYST v1 will use EPA-only base value, add FPOE blending in v2
- Team strength: `defense_dvp` and `defense_vs_position_stats` tables exist — can derive opponent z-scores from these
- Player identity: `gsis_id` used across all systems

## Architecture Decision
- **Standalone module**: `server/modules/catalyst/` — NOT embedded inside FORGE initially
- **Python calculator**: Play-level aggregation with numpy (matches existing IDP ingestion pattern)
- **TypeScript API**: Express routes serving pre-computed scores
- **DB storage**: New `catalyst_scores` table (player, season, week, raw score, alpha, components)
- **Frontend**: New column in Fantasy Lab + optional standalone gauge in player detail

---

## Build Phases

### Phase 0: PBP Data Enrichment
**Goal:** Ensure `bronze_nflfastr_plays` has `score_differential` and `wp` (win probability) columns needed for CATALYST math.

| Task | Description | Assignable to | Status |
|------|-------------|---------------|--------|
| 0.1 | Check if `raw_data` JSONB contains `score_differential` and `wp` fields | Codex / Claude Code | Not started |
| 0.2 | Add `score_differential` and `wp` columns to `bronze_nflfastr_plays` schema + backfill from `raw_data` | Codex / Claude Code | Not started |
| 0.3 | Validate enrichment: spot-check 2024 Week 1 plays for correct values | Codex / Claude Code | Not started |

### Phase 1: CATALYST Calculator (Python)
**Goal:** Compute per-player CATALYST scores from play-by-play data.

| Task | Description | Assignable to | Status |
|------|-------------|---------------|--------|
| 1.1 | Create `server/modules/catalyst/catalystCalculator.py` — core math (EPA base, sigmoid leverage, recency decay, game-script factor) | Replit Agent | Not started |
| 1.2 | Build opponent adjustment using `defense_dvp` z-scores instead of standalone team_strength table | Replit Agent | Not started |
| 1.3 | Create `catalyst_scores` DB table schema in `shared/schema.ts` | Replit Agent | Not started |
| 1.4 | Write results to `catalyst_scores` table (player, season, week, raw, alpha, play_count, avg_leverage) | Replit Agent | Not started |
| 1.5 | Position-specific percentile calibration (ECDF → 0-100 alpha mapping) | Replit Agent | Not started |
| 1.6 | Run on 2024 full season, validate top-10 per position against expectations | Replit Agent | Not started |

### Phase 2: TypeScript API Layer
**Goal:** Expose CATALYST scores via REST API.

| Task | Description | Assignable to | Status |
|------|-------------|---------------|--------|
| 2.1 | Create `server/modules/catalyst/catalystRoutes.ts` — batch + player endpoints | Codex / Claude Code | Not started |
| 2.2 | `/api/catalyst/batch?position=QB&season=2024` — returns ranked players with CATALYST scores | Codex / Claude Code | Not started |
| 2.3 | `/api/catalyst/player/:gsisId` — returns player detail with weekly breakdown | Codex / Claude Code | Not started |
| 2.4 | Wire routes into `server/routes.ts` | Codex / Claude Code | Not started |

### Phase 3: Frontend Integration
**Goal:** Surface CATALYST in existing Fantasy Lab and player views.

| Task | Description | Assignable to | Status |
|------|-------------|---------------|--------|
| 3.1 | Add CATALYST column to Fantasy Lab table (alongside FIRE score) | Replit Agent | Not started |
| 3.2 | Add CATALYST gauge/badge to player detail modal | Replit Agent | Not started |
| 3.3 | Color coding: green (>65), neutral (45-65), red (<45) | Replit Agent | Not started |
| 3.4 | Add CATALYST to sidebar nav if standalone page warranted | Replit Agent | Not started |

### Phase 4: FORGE Integration (after validation)
**Goal:** Blend CATALYST into FORGE Efficiency pillar at calibrated weight.

| Task | Description | Assignable to | Status |
|------|-------------|---------------|--------|
| 4.1 | Analyze CATALYST vs current Alpha correlation to determine optimal weight | Replit Agent | Not started |
| 4.2 | Add CATALYST as optional Efficiency sub-pillar (10-15% initial weight, NOT 25-30%) | Replit Agent | Not started |
| 4.3 | A/B comparison: Alpha with vs without CATALYST for known breakouts/busts | Replit Agent | Not started |
| 4.4 | Finalize weight and ship | Replit Agent | Not started |

---

## Key Differences from Grok's Proposal
1. **No play-level FPOE** — v1 uses pure EPA as base value (FPOE is game-level in our pipeline)
2. **Standalone first** — not bolted into FORGE Efficiency at 25-30% immediately
3. **Conservative game-script boost** — 1.2x (not 1.4x) for trailing, with tuning based on data
4. **Opponent adjustment** — uses existing `defense_dvp` z-scores, not a separate team_strength table
5. **Integration weight** — 10-15% of Efficiency pillar after validation, not 25-30%

## Codex / Claude Code Task Criteria
Tasks marked "Codex / Claude Code" are:
- Well-scoped with clear inputs/outputs
- Don't require deep context of FORGE internals
- Primarily data plumbing, schema work, or CRUD API routes
- Can be described in a standalone PR description

Tasks marked "Replit Agent" are:
- Core math / calibration requiring iterative tuning
- Frontend work requiring visual judgment
- FORGE integration requiring deep system context
- Validation requiring domain knowledge

---

## Status
**Current phase:** Phase 0 (PBP Data Enrichment)
**Last updated:** 2026-02-24
