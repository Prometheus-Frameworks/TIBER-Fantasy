# FIRE Pipeline — Fantasy Intended Recursive Engine

## What FIRE Is

FIRE is TIBER's opportunity-role intelligence layer, currently live for QBs (QB FIRE v1). It models Expected Fantasy Points (xFP) based on a quarterback's opportunity pipeline and role context, then compares actual production to identify overperformers and underperformers.

FIRE sits alongside FORGE — FORGE grades all skill positions on 4 pillars, while FIRE specifically models the opportunity-to-production pipeline for deeper "why" analysis.

## How FIRE Differs from FORGE

| | FORGE | FIRE |
|---|---|---|
| Scope | All skill positions (QB, RB, WR, TE) | Currently QB only (expansion planned) |
| Method | 4-pillar grading → Alpha score | xFP opportunity-role pipeline → over/under expectation |
| Output | Alpha (0–100) + Tier | xFP, actual FP, delta, role classification |
| Purpose | "How good is this player?" | "Is this player beating or losing to his opportunity?" |

## QB FIRE v1 Architecture

```
Sleeper projections + nflverse play-by-play
    ↓
xFP Opportunity Model — expected fantasy points given:
  - Pass attempts, completion rate context
  - Rush attempts, designed runs vs scrambles
  - Red zone opportunities
  - Team pace and play volume
    ↓
Role Classification:
  - Elite gunslinger, game manager, dual-threat, etc.
    ↓
Delta = Actual FP − xFP
  - Positive delta = outperforming role
  - Negative delta = underperforming role
    ↓
Feeds into FORGE Volume pillar (xFP replaces discrete stat bins for QBs)
```

## Database

- Table: `qb_xfp_weekly` (migration 0012)
- 662 rows populated at launch
- Columns: player_id, week, season, xfp, actual_fp, delta, role_tag

## Integration with FORGE

FORGE's QB Volume pillar now uses continuous xFP from FIRE instead of discrete stat bins. This makes the volume signal smoother and more context-aware.

FORGE's FPOE efficiency pillar also connects — FPOE measures production vs expectation across all positions, while FIRE's xFP delta is the QB-specific deep dive.

## When Helping Users

- Use FIRE data to explain *why* a QB's FORGE score is what it is
- "Josh Allen's Alpha is T1 because his FIRE delta is +4.2 — he's consistently outproducing his opportunity"
- "Geno Smith looks fine on volume but his FIRE delta is -2.8 — he's leaving points on the table"
- FIRE is especially useful for dynasty trade evaluation (is this QB actually good or just in a great situation?)
- Distinguish between "high xFP, low actual" (buy low?) vs "low xFP, high actual" (sell high / regression risk)
