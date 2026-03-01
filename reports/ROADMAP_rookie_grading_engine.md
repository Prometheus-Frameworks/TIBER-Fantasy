# ROADMAP: Rookie Grading Engine (FORGE-R)

**Filed:** 2026-03-01  
**Session:** SESSION_006  
**Priority:** High — 2026 NFL Combine is live now  
**Filed by:** Max (OpenClaw connector)

---

## Why Now

The 2026 NFL Combine is happening this week. Every major fantasy platform will publish rookie grades in the next 30 days. TIBER needs a pre-entry scoring system that:

1. Gives rookies a FORGE-comparable Alpha score before they play a single NFL snap
2. Updates dynamically as NFL data populates week-by-week in Year 1
3. Powers the @TiberAnalytics player profile content series

---

## Data Foundation (Already Started)

`data/rookies/2026_combine_results.json` — seeded with full 2026 combine athleticism data:
- **QB:** 16 players
- **RB:** 20 players  
- **WR:** 39 players
- **TE:** 25 players

Fields: height, weight, 40yd, 10yd, vertical, broad jump, 3-cone, shuttle

### Still Needed
- **RAS scores** — ras.football is web-only, no API. Site currently has SQL errors (updating 2026 data). Options:
  - Manual scrape once DB stabilizes (est. 2-3 days post-combine)
  - Use raw combine numbers + build our own RAS-equivalent percentile score
- **College production stats** — dominator rating, yards/route, target share, breakout age
  - Source: nflverse college stats, PFF college, cfbfastR
- **Draft capital** — round + pick (post-April draft)
- **Landing spot** — team, depth chart position (post-draft)

---

## FORGE-R: Pre-Entry Alpha Architecture

Rookies have zero NFL data — FORGE v1 pillars can't run. FORGE-R maps pre-entry signals onto the same 0-100 Alpha scale.

### Pre-Entry Pillars

| Pillar | Inputs | Weight (WR) | Weight (RB) | Weight (TE) |
|--------|--------|-------------|-------------|-------------|
| **Athleticism** | RAS score, 40 time, burst score | 0.25 | 0.30 | 0.25 |
| **College Production** | Dominator rating, YPRR, breakout age | 0.40 | 0.35 | 0.35 |
| **Draft Capital** | Round, pick percentile | 0.20 | 0.20 | 0.20 |
| **Landing Spot** | Team scheme fit, depth chart opportunity | 0.15 | 0.15 | 0.20 |

### Transition to FORGE v1
- Weeks 1-4: FORGE-R only (no NFL data)
- Weeks 5-8: Blended (60% FORGE-R, 40% FORGE v1)
- Week 9+: FORGE v1 takes over, FORGE-R weight fades to 0
- Full transition complete: ~Week 13

---

## DB Schema (Proposed)

```sql
CREATE TABLE rookie_prospects (
  id SERIAL PRIMARY KEY,
  season INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  position VARCHAR(5) NOT NULL,
  school VARCHAR(100),
  -- Combine athleticism
  height_in INT,
  weight_lbs INT,
  forty DECIMAL(4,2),
  ten_split DECIMAL(4,2),
  vertical DECIMAL(4,1),
  broad_jump INT,
  three_cone DECIMAL(4,2),
  shuttle DECIMAL(4,2),
  -- RAS (to be added)
  ras_score DECIMAL(4,2),
  ras_size DECIMAL(4,2),
  ras_speed DECIMAL(4,2),
  ras_burst DECIMAL(4,2),
  ras_agility DECIMAL(4,2),
  -- College production (to be added)
  dominator_rating DECIMAL(5,2),
  college_yprr DECIMAL(4,3),
  breakout_age DECIMAL(4,1),
  -- Draft (post-April)
  draft_round INT,
  draft_pick INT,
  nfl_team VARCHAR(5),
  -- FORGE-R scores (computed)
  forge_r_alpha DECIMAL(5,1),
  forge_r_tier VARCHAR(3),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Immediate Actions for Replit Agent

1. **Create `rookie_prospects` table** using schema above
2. **Seed 2026 combine data** from `data/rookies/2026_combine_results.json`
3. **Add endpoint:** `GET /api/v1/rookies?season=2026&position=WR` — returns all prospects with available data
4. **Add endpoint:** `GET /api/v1/rookies/:name` — search by name, returns full profile
5. **RAS integration:** Once ras.football stabilizes (~2-3 days), build scraper or manual import script for RAS sub-scores

## Phase 2 (Post-Draft, April)
1. Add draft capital and landing spot data
2. Build FORGE-R scoring model
3. Expose `GET /api/v1/rookies/:id/forge-r` endpoint
4. Power content cards: rookie profile graphic same format as veteran cards

---

## Content Opportunity

The @TiberAnalytics rookie profile series can drop immediately post-draft:
- Same card template as veteran profiles
- FORGE-R Alpha instead of FORGE Alpha
- "Pre-Entry Score" label to distinguish from NFL data
- Thread format: card + 4 pillar breakdown tweets

**High-value targets for first cards:**
- WR: Jeff Caldwell (6'5", 4.31 — elite size/speed combo), Deion Burks (4.30, 42.5 vert), Bryce Lance (4.34, 41.5 vert)
- TE: Kenyon Sadiq (4.39 for 241 lbs — absurd), Eli Stowers (4.51, 45.5 vert)
- RB: Mike Washington Jr. (4.33, 223 lbs — rare size/speed)

---

## Related Roadmap
- `ROADMAP_world_model_team_intelligence.md` — landing spot scheme fit analysis feeds FORGE-R landing spot pillar
- `ROADMAP_consensus_intelligence_layer.md` — rookie ADP vs TIBER pre-entry Alpha delta
