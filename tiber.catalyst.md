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

## `catalyst_scores.components` Schema
The `components` JSONB column stores the decomposed factors for every player-season-week row. All agents implementing CATALYST must write these exact fields:

```jsonc
{
  "leverage_factor": 2.34,      // mean sigmoid-weighted WPA leverage across player's plays (1.0 = neutral, up to ~6.0)
  "opponent_factor": 1.12,      // mean opponent quality multiplier from defense_dvp z-scores × position role coefficient
  "script_factor": 1.08,        // mean game-script multiplier (1.0 = neutral, 1.2 = trailing ≤8 pts boost)
  "recency_factor": 0.87,       // mean recency decay weight (0.94^weeks_ago, 1.0 = current week)
  "base_epa_sum": 14.72,        // sum of raw EPA across all qualifying plays (before any multipliers)
  "weighted_epa_sum": 22.41,    // sum of EPA × all multipliers (leverage × opponent × script × recency)
  "play_count": 87,             // total qualifying plays included in calculation
  "avg_leverage": 2.34          // convenience duplicate of leverage_factor for quick display
}
```

**Rules:**
- All numeric fields are required (no nulls) — use 0.0 defaults for missing factors
- `play_count` must be an integer ≥ 30 for a score to be produced (below threshold → no row written)
- `leverage_factor` and `avg_leverage` are identical — both stored for API convenience vs display convenience
- `weighted_epa_sum / play_count` ≈ `catalyst_raw` (the final raw score before percentile mapping)

---

## Build Phases

### Phase 0: PBP Data Enrichment
**Goal:** Ensure `bronze_nflfastr_plays` has `score_differential` and `wp` (win probability) columns needed for CATALYST math.

| Task | Description | Assignable to | Status |
|------|-------------|---------------|--------|
| 0.1 | Check if `raw_data` JSONB contains `score_differential` and `wp` fields | Codex / Claude Code | DONE (PR #30) |
| 0.2 | Add `score_differential` and `wp` columns to `bronze_nflfastr_plays` schema + backfill from `raw_data` | Codex / Claude Code | DONE (PR #30 + migration run) |
| 0.3 | Validate enrichment: spot-check 2024 Week 1 plays for correct values | Codex / Claude Code | DONE |
| 0.4 | Re-import 2025 PBP data using updated script (includes wp + score_differential) | Codex / Claude Code | Not started |

**Acceptance checks:**
- 100-play spot check across different game states (blowout, close game, overtime)
- `score_differential` range sanity: values between -50 and +50, no NULLs on plays that had prior scoring — PASS (range -46 to +46)
- `wp` range: all values between 0.0 and 1.0 — PASS (0.00004 to 0.9999)
- Coverage: >95% of plays have non-null `score_differential` and `wp` — PASS for 2024 (99% wp, 95% score_diff). 2025 = 0% (needs re-import, task 0.4)

### Phase 1: CATALYST Calculator (Python)
**Goal:** Compute per-player CATALYST scores from play-by-play data.

| Task | Description | Assignable to | Status |
|------|-------------|---------------|--------|
| 1.1 | Create `server/modules/catalyst/catalystCalculator.py` — core math (EPA base, sigmoid leverage, recency decay, game-script factor) | Replit Agent | DONE |
| 1.2 | Build opponent adjustment using `defense_dvp` z-scores instead of standalone team_strength table | Replit Agent | DONE |
| 1.3 | Create `catalyst_scores` DB table schema in `shared/schema.ts` | Replit Agent | DONE |
| 1.4 | Write results to `catalyst_scores` table (player, season, week, raw, alpha, play_count, avg_leverage) | Replit Agent | DONE |
| 1.5 | Position-specific percentile calibration (ECDF → 0-100 alpha mapping) | Replit Agent | DONE (per-week ECDF) |
| 1.6 | Run on 2024 full season, validate top-10 per position against expectations | Replit Agent | DONE |

**Acceptance checks:**
- Distribution sanity: CATALYST raw scores roughly normal, no extreme outliers beyond 3 stddev
- Play count thresholds: minimum 30 plays to produce a score (avoid small-sample noise)
- Alpha distribution: 0-100 spread with ~50 median per position (by ECDF definition)
- Known-good validation: Josh Allen, Saquon Barkley, Ja'Marr Chase should rank top-10 at their positions for 2024
- Known-bad validation: players with high raw fantasy points but low leverage situations should score lower than their raw stats suggest
- No NaN or Infinity values in any output field

### Phase 2: TypeScript API Layer
**Goal:** Expose CATALYST scores via REST API.

| Task | Description | Assignable to | Status |
|------|-------------|---------------|--------|
| 2.1 | Create `server/modules/catalyst/catalystRoutes.ts` — batch + player endpoints | Replit Agent | DONE |
| 2.2 | `/api/catalyst/batch?position=QB&season=2024` — returns ranked players with CATALYST scores | Replit Agent | DONE |
| 2.3 | `/api/catalyst/player/:gsisId` — returns player detail with weekly breakdown | Replit Agent | DONE |
| 2.4 | Wire routes into `server/routes.ts` | Replit Agent | DONE |

**Acceptance checks:**
- Batch endpoint p95 latency < 500ms (pre-computed scores, just DB reads)
- Player detail endpoint p95 latency < 200ms
- Batch returns 50+ players per position with correct schema
- Player detail returns weekly breakdown array sorted by week ascending
- 404 for unknown gsis_id, 400 for invalid position/season params
- Response shape matches `catalyst_scores.components` field spec exactly

### Phase 3: Frontend Integration
**Goal:** Surface CATALYST in existing Fantasy Lab and player views.

| Task | Description | Assignable to | Status |
|------|-------------|---------------|--------|
| 3.1 | Add CATALYST column to Fantasy Lab table (alongside FIRE score) | Replit Agent | Not started |
| 3.2 | Add CATALYST gauge/badge to player detail modal | Replit Agent | Not started |
| 3.3 | Color coding: green (>65), neutral (45-65), red (<45) | Replit Agent | Not started |
| 3.4 | Add CATALYST to sidebar nav if standalone page warranted | Replit Agent | Not started |

**Acceptance checks:**
- CATALYST column visible in Fantasy Lab with sortable header
- Color coding renders correctly at boundary values (44, 45, 65, 66)
- Player detail modal shows CATALYST gauge with numeric value
- No layout breakage on mobile-width viewports
- Loading/skeleton state while CATALYST data fetches

### Phase 4: FORGE Integration (after validation)
**Goal:** Blend CATALYST into FORGE Efficiency pillar at calibrated weight.

| Task | Description | Assignable to | Status |
|------|-------------|---------------|--------|
| 4.1 | Analyze CATALYST vs current Alpha correlation to determine optimal weight | Replit Agent | Not started |
| 4.2 | Add CATALYST as optional Efficiency sub-pillar (10-15% initial weight, NOT 25-30%) | Replit Agent | Not started |
| 4.3 | A/B comparison: Alpha with vs without CATALYST for known breakouts/busts | Replit Agent | Not started |
| 4.4 | Finalize weight and ship | Replit Agent | Not started |

**Acceptance checks:**
- Correlation analysis: CATALYST-Alpha Pearson r between 0.3 and 0.7 (useful but not redundant)
- Alpha shift: mean absolute change < 5 points when CATALYST added (not destabilizing)
- Tier stability: <10% of players change tiers with CATALYST integration
- Breakout detection: at least 3 known 2024 breakouts (e.g. Puka Nacua, Brock Bowers) score higher with CATALYST than without
- Regression detection: at least 3 known 2024 regressions score lower with CATALYST

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
**Current phase:** Phase 1 + Phase 2 COMPLETE → Phase 3 (Frontend) next
**Phase 0 summary:** PR #30 (Codex) added columns + migration + validation script. Migration run, 2024 backfill done (99% wp, 95% score_diff). 2025 needs re-import (task 0.4).
**Phase 1 summary:** Calculator built and run. 5,029 player-week scores for 2024. Per-week ECDF percentiles. catalyst_raw = weighted_epa_sum / play_count. NaN/Inf guards added.
**Phase 2 summary:** API routes live. `/api/catalyst/batch` and `/api/catalyst/player/:gsisId` both tested and working.
**Next action:** Phase 3 — Frontend integration (Fantasy Lab column + player detail gauge).
**Last updated:** 2026-02-24
