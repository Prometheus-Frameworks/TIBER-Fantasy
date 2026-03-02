# ROADMAP: TIBER Rookie Grading Engine

**Filed by:** Max (OpenClaw connector)  
**Date:** 2026-03-01  
**Priority:** High — combine is live, draft is ~8 weeks out  
**Session:** SESSION_006

---

## Overview

TIBER needs a pre-entry rookie grading engine. The existing FORGE system requires NFL on-field data — rookies have none. This roadmap defines a two-phase system that generates a **Rookie Alpha** (0-100) before the draft, then transitions players into standard FORGE scoring as NFL data accumulates.

---

## What's Already Built (Max — 2026-03-01)

### 1. 2026 Combine DB
`data/rookies/2026_combine_results.json`
- 91 players: 41 WR, 21 TE, 17 RB, 12 QB
- Fields: height, weight, 40yd, 10yd split, vertical, broad jump, 3-cone, shuttle

### 2. TIBER-RAS v1 (class-relative)
`data/rookies/2026_rookie_grades.json`
- Custom athleticism score built from combine data
- Percentile ranked within the 2026 combine class by position (0-10 scale per metric, averaged)
- **v1 limitation:** Ranked within this year's class only — not vs historical peers
- Metrics: speed (40/10yd), explosion (vert/broad), agility (cone/shuttle), size (ht/wt)
- All inverted correctly (lower 40 time = higher score, etc.)

**2026 TIBER-RAS Leaders:**
- WR: Jeff Caldwell (9.14), Bryce Lance (8.07), J. Michael Sturdivant (6.90), Deion Burks (6.27)
- RB: Mike Washington Jr. (8.28), Jeremiyah Love (6.14), Seth McGowan (5.48)
- TE: Kenyon Sadiq (6.58), Eli Stowers (6.40), Sam Roush (6.44)
- QB: Taylen Green (7.94), Cole Payton (5.75)

---

## What Replit Needs to Build

### Phase 1: Historical RAS Calibration (TIBER-RAS v2)

**Problem:** v1 ranks within the 2026 class only. A true RAS needs historical context — is Jeff Caldwell's 40 time elite vs all WRs since 1987, not just vs 2026 classmates.

**Data source:** `nflverse` — has combine data going back to 1987 including all measurables.

**Task:**
1. Ingest `nflverse` historical combine data via `nfl_data_py` (already in the stack)
2. Build position-stratified percentile tables for each metric (40yd, vert, broad, etc.) using historical distribution
3. Re-score all 2026 players against historical peers
4. Store as `tiber_ras_v2` in the rookie grades table

```python
# nfl_data_py call
import nfl_data_py as nfl
combine = nfl.import_combine_data(range(1987, 2026))
# Filter by position, build percentile distributions
```

---

### Phase 2: College Production Intake

**Problem:** Athletic freaks who didn't produce in college (or vice versa) need production signals to separate from pure athleticism profiles.

**Key metrics needed per player:**
- `dominator_rating` — target/carry share vs team total (measures true alpha status)
- `yprr` / `yards_per_route_run` — efficiency metric for WR/TE
- `breakout_age` — age at which player hit 20%+ dominator rating (earlier = better)
- `college_target_share` — % of team targets in final season
- `college_ypc` / `college_yards_per_carry` — for RB
- `college_completion_pct`, `college_td_pct` — for QB

**Data sources:**
- `nflverse` has some college stats
- `cfbfastR` / college football reference for deeper production data
- PFF college grades (if accessible)

**Task:**
1. Pull college production for all 91 players in `2026_combine_results.json`
2. Store in `data/rookies/2026_college_production.json`
3. Link to combine data via player name (or add GSIS ID mapping post-draft)

---

### Phase 3: Rookie Alpha Score

The full grading formula once all data is assembled:

```
Rookie Alpha = weighted average of:
  - TIBER-RAS v2 (0-10 → normalized to 0-100): 30%
  - College Production Score (0-100):           40%
  - Draft Capital Score (0-100):                20%
  - Age at Entry Score (0-100):                 10%
```

**Pillar breakdown:**

| Pillar | Inputs | Weight |
|--------|--------|--------|
| Athleticism (RAS) | 40yd, vert, broad, cone, shuttle, size | 30% |
| Production | Dominator rating, YPRR, breakout age, target share | 40% |
| Draft Capital | Round + pick (logarithmic decay) | 20% |
| Age at Entry | Younger = higher score | 10% |

**Output:** Each player gets a `rookie_alpha` (0-100) and a `rookie_tier` (T1-T5) using the same FORGE tier thresholds.

---

### Phase 4: Post-Draft Landing Spot Adjustment

Once teams draft players (late April):

1. Pull team context score from existing TIBER team data
2. Adjust `rookie_alpha` up/down based on:
   - Depth chart opportunity (is there a clear path to targets/carries?)
   - Scheme fit (does the offense fit the player's profile?)
   - QB quality (passing game strength)
3. Generate a `landing_spot_adjustment` (+/- 0-15 points)

This is where the **World Model** connects to the rookie engine — the same team intelligence layer serves both veteran projections and rookie opportunity scoring.

---

### Phase 5: NFL Data Transition

As rookies play actual NFL games:
- Week 1-4: Blend `rookie_alpha` (80%) + emerging NFL FORGE data (20%)
- Week 5-8: 50/50 blend
- Week 9+: Full FORGE takeover, `rookie_alpha` archived as reference point

This gives continuity — no cliff where a player "disappears" from TIBER between draft and first NFL data.

---

## New API Endpoints Needed

```
GET /api/rookies/2026                          — All 2026 rookie grades
GET /api/rookies/2026/:playerId                — Single player rookie profile
GET /api/rookies/2026/position/:pos            — By position (WR/RB/TE/QB)
GET /api/rookies/2026/leaderboard              — Sorted by rookie_alpha
```

Auth: Same `x-tiber-key` header as v1 API.

---

## New DB Table Needed

```sql
CREATE TABLE rookie_profiles (
  id SERIAL PRIMARY KEY,
  season INT NOT NULL,
  player_name VARCHAR(100) NOT NULL,
  position VARCHAR(5) NOT NULL,
  college VARCHAR(100),
  
  -- Combine measurables
  height_in FLOAT,
  weight_lbs FLOAT,
  forty FLOAT,
  ten_split FLOAT,
  vertical FLOAT,
  broad_jump FLOAT,
  three_cone FLOAT,
  shuttle FLOAT,
  
  -- TIBER-RAS
  tiber_ras_v1 FLOAT,       -- class-relative
  tiber_ras_v2 FLOAT,       -- historical-relative (pending)
  
  -- College production
  dominator_rating FLOAT,
  yprr FLOAT,
  breakout_age FLOAT,
  college_target_share FLOAT,
  college_ypc FLOAT,
  
  -- Scoring
  athleticism_score FLOAT,
  production_score FLOAT,
  draft_capital_score FLOAT,
  age_score FLOAT,
  rookie_alpha FLOAT,
  rookie_tier VARCHAR(5),
  landing_spot_adjustment FLOAT,
  
  -- Meta
  draft_round INT,
  draft_pick INT,
  nfl_team VARCHAR(5),
  gsis_id VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Content Angle (X / @TiberAnalytics)

The rookie engine powers a content series:
- **Combine weekend:** Drop TIBER-RAS leaderboards by position as results come in
- **Pre-draft:** Full rookie profile cards (same format as Zay Flowers card) for top prospects
- **Draft night:** Live rookie alpha scores as players are picked + landing spot reaction
- **Post-draft:** "TIBER's Rookie Rankings" — full 2026 class sorted by adjusted rookie alpha

This is a high-engagement content cycle that runs April-August and establishes @TiberAnalytics as a serious analytics voice during the NFL offseason.

---

## Immediate Next Steps for Replit

1. **Pull nflverse historical combine data** → build TIBER-RAS v2 percentile tables
2. **Pull college production stats** for all 91 players in `2026_combine_results.json`
3. **Create `rookie_profiles` DB table** (schema above)
4. **Build `/api/rookies/2026` endpoints** (basic CRUD to start)
5. **Wire into FORGE transition logic** for Week 1+ blending (Phase 5)

---

## Files

| File | Description |
|------|-------------|
| `data/rookies/2026_combine_results.json` | Raw combine data, 91 players |
| `data/rookies/2026_rookie_grades.json` | TIBER-RAS v1 scores (class-relative) |
| `reports/ROADMAP_rookie_grading_engine.md` | This document |

---

*Filed by Max (OpenClaw connector) — SESSION_006*
