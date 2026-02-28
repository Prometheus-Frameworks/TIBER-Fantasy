# ROADMAP ITEM — True Recursive Weight Adaptation Engine

**Flagged by:** Max (OpenClaw agent)  
**Date:** 2026-02-28  
**Session:** Inside view audit of FORGE recursive engine  
**Priority:** Core — closes the gap between "smoothing" and true self-learning

---

## The Honest Assessment

FORGE v1 recursion works at the **player level** — it smooths volatility, detects momentum, and adjusts individual scores based on personal history. The signals are real. Chase Brown's momentum score of 95 and Zay Flowers' momentum of 35 are genuine detections.

But the **weights never change**.

The system doesn't learn that efficiency metrics are weakly predictive for WRs. It doesn't detect that volume is increasingly dominant for RBs. It doesn't notice that its own momentum scores at certain positions are more predictive than others. The backtest runs, humans read it, and weights get hand-tuned in `forgeGrading.ts`. That's not recursion — that's manual calibration with a feedback lag.

---

## What True Recursion Looks Like

```
Current (v1):
  Play-by-play data → FORGE scores → player-level adjustment → final Alpha
  Backtest → human reads it → manually updates weights → next season

True recursion (v2):
  Play-by-play data → FORGE scores → player-level adjustment → final Alpha
         ↑                                                           ↓
  Weight adaptation ←←← automated backtest ←←← outcome correlation ←←←
```

The system closes the loop. It observes how well its own scores predicted outcomes, identifies which pillars and metrics are actually moving the needle, and adjusts weights automatically before the next scoring cycle.

---

## What Needs to Be Built

### 1. Automated Weekly Backtest Pipeline

Currently `scripts/forge_backtest.py` runs manually. It needs to become an automated job:

- Trigger: after each week's Gold ETL completes
- Input: last N weeks of FORGE scores + actual fantasy outcomes
- Output: correlation matrix — which metrics and pillars are predictive by position
- Store results in: `forge_backtest_results` table (week, position, metric, correlation, p_value)

### 2. Weight Adaptation Engine

A service that reads backtest results and proposes weight adjustments:

```typescript
// Pseudocode
async function adaptWeights(position: Position, season: number, week: number) {
  const correlations = await getBacktestResults(position, season, week);
  
  // If efficiency correlation for WR < 0.05 for 4+ consecutive weeks
  // → reduce efficiency pillar weight by 0.02 (bounded)
  
  // If volume correlation for RB > 0.50 consistently
  // → increase volume pillar weight toward ceiling
  
  // Bounds: no pillar drops below 0.10 or rises above 0.70
  // Change rate: max ±0.03 per week (prevents overcorrection)
  
  return proposedWeights;
}
```

Key constraints:
- **Bounded:** Pillars can't go below 0.10 or above 0.70 — prevents degenerate solutions
- **Rate-limited:** Max ±0.03 change per week — prevents overcorrection on noise
- **Minimum sample:** Requires 4+ weeks of consistent signal before adapting
- **Reversible:** Every weight change is logged and can be rolled back

### 3. Weight Version Control

Every set of weights gets a version hash + timestamp:

```
forge_weight_history table:
  version_id | position | mode | volume | efficiency | team_context | stability
           | effective_from_week | effective_to_week | trigger | backtest_correlation
```

This means:
- Full audit trail of what weights were used when
- Can replay historical scoring with original weights
- Can A/B test new weights against old weights on held-out data

### 4. Pillar-Level Recursion

Currently recursion operates at the final Alpha level. True pillar-level recursion means:

- Momentum and volatility tracked **per pillar**, not just per total score
- A player can have high volume stability but volatile efficiency — treated differently
- Surprise calculated per pillar: "Volume met expectations, efficiency massively outperformed"

This gives richer signal for coaching to the user:
> "FORGE detected efficiency surprise this week. Usually this regresses — the volume signal is more reliable for this player."

### 5. Position-Specific Momentum Decay

Currently momentum uses the same decay structure across positions. In reality:

- **RB momentum** decays fast — usage is scheme-dependent and can flip week to week
- **WR momentum** is more durable — route trees and target share are stickier
- **TE momentum** is stickiest — role consolidation tends to persist
- **QB momentum** is scheme-sensitive — opponent drives week-to-week variance more

Each position should have its own momentum half-life calibrated from historical data.

---

## What This Enables

Once the weight adaptation loop is closed, FORGE becomes a system that:

1. **Detects its own blind spots** — if efficiency is consistently failing to predict outcomes, it reweights automatically
2. **Adapts to meta shifts** — when the league shifts to more RPO and QB rushing, the QB pillar weights adjust to reflect it
3. **Surfaces confidence levels** — "this score is based on weights that have been highly predictive recently" vs "these weights haven't been validated in 6 weeks"
4. **Improves every season** — the system that scored 2026 is better than the system that scored 2025, automatically

---

## Current State of Relevant Files

| File | Current State | What Changes |
|------|--------------|--------------|
| `server/modules/forge/recursiveAlphaEngine.ts` | Player-level recursion only | Add pillar-level recursion |
| `server/modules/forge/forgeGrading.ts` | Hardcoded POSITION_WEIGHTS constants | Read from DB weight table |
| `server/modules/forge/forgeStateService.ts` | Tracks player alpha history | Add pillar-level state tracking |
| `scripts/forge_backtest.py` | Manual run only | Automate as weekly ETL job |
| `shared/schema.ts` | No weight history table | Add `forge_weight_history`, `forge_backtest_results` |

---

## Build Sequence

1. **Automate the backtest** — make `forge_backtest.py` a scheduled job, store results in DB
2. **Add weight history table** — move hardcoded weights to DB, version them
3. **Build weight adaptation engine** — reads backtest results, proposes bounded adjustments
4. **Add pillar-level state tracking** — extend `forge_player_state` with per-pillar momentum/volatility
5. **Position-specific momentum decay** — calibrate from historical data per position
6. **A/B testing framework** — run old vs new weights in parallel, validate before promoting

---

## The North Star

FORGE v1 is a well-designed scoring system with manual calibration.  
FORGE v2 is a self-improving system that gets sharper every week it runs.

The difference isn't just technical — it's the difference between a tool that requires maintenance and a tool that maintains itself. That's what makes it defensible long-term.
