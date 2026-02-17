# FORGE Pillar Redesign — Full Task Spec

**Created:** 2026-02-17
**Status:** Open — Ready for implementation
**Priority:** High (Volume), Medium (Stability), Low (QB Context)
**Depends on:** Pillar weight tuning resolution (`.claude/tasks/pillar-weight-tuning.md`)
**Source research:** `attached_assets/FORGE_Future_Work_Deep_Research_1771289101501.pdf`

---

## 1. Volume Pillar Redesign — Expected Fantasy Points (xFP)

### Problem

Volume currently measures raw opportunity count (touches, targets). This rewards high-usage players regardless of per-play production. Not all touches are created equal — an RB target is worth ~2.5-2.8x a carry in PPR, and goal-line/end-zone work is disproportionately valuable.

**Diagnostic case:** Bucky Irving (71.4 volume, 13.8 PPG) nearly matches CMC (81.4 volume, 24.4 PPG) because both get lots of touches, but CMC's touches are far more valuable.

### Target Definition

**Volume = expected scoring from opportunity, independent of player efficiency.**

This is what xFP (Expected Fantasy Points) does: strip away talent/efficiency and score only the opportunity profile.

### Implementation Spec

**Step 1: Build per-opportunity expected value table**

For RB/WR/TE (PPR scoring):

| Opportunity Type | Approximate xFP Value | Notes |
|---|---|---|
| RB carry (between 20s) | ~0.4-0.5 pts | Baseline carry value |
| RB carry (red zone, inside 20) | ~0.7-0.9 pts | Red zone carry premium |
| RB carry (inside 5) | ~1.2-1.5 pts | Goal-line premium |
| RB target | ~1.2-1.5 pts | ~2.5-2.8x a carry in PPR |
| WR target | ~1.5-1.8 pts | Higher value per target |
| WR deep target (air yards > 15) | ~2.0-2.5 pts | Deep target premium |
| WR end-zone target | ~2.5-3.0 pts | End-zone premium |
| TE target | ~1.3-1.6 pts | Between RB and WR |

These values should be derived from league-wide averages from nflverse play-by-play data. Exact values should be computed, not hardcoded — the table above is directional guidance.

**Step 2: Compute xFP per game**

For each player-week:
```
xFP_week = Σ(opportunity_count_by_type × expected_points_value_by_type)
```

Season level:
```
xFP_per_game = mean(xFP_week across all weeks played)
```

**Step 3: Map to 0-100 pillar score**

```
VolumeScore = normalize(xFP_per_game within position and season)
```

Use the same percentile-based normalization as other pillars.

### Data Requirements

From nflverse play-by-play (`bronze_pbp` or similar):
- Carry location (yard line → red zone / goal line classification)
- Target data with air yards
- End-zone target flags
- Per-player per-week aggregation

Much of this data likely already exists in the snapshot/datadive pipeline. Check `server/modules/datalab/snapshots/` and `server/modules/forge/forgeEngine.ts` for existing data availability.

### Pillar Separation — Avoiding Double Counting

**Critical design rule:** Volume and Efficiency must not cannibalize each other.

Clean decomposition:
- **Volume pillar:** xFP per game (pure opportunity-priced, efficiency-independent)
- **Efficiency pillar:** Fantasy Points Over Expected (FPOE) per game — actual scoring minus xFP

This way Volume tells you what the player *should* score given their opportunities at league-average efficiency, and Efficiency tells you what they did *above or below* that expectation.

If Efficiency is also redesigned to use FPOE, the two pillars become perfectly complementary.

### Expected Outcome

After redesign:
- Irving's Volume drops because his touches are lower quality (fewer targets, fewer goal-line carries per touch)
- Bijan Robinson's Volume stays high because his opportunity profile is richer
- The Irving-over-Bijan inversion is eliminated without further weight hacking

### Validation

- Spearman correlation (Alpha vs PPG) should remain ≥0.94 for RB, ≥0.93 for TE
- Top-K recall: of top 12 PPG players per position, ≥10 should land in T1/T2
- Irving should rank below Robinson, Achane, and other high-PPG RBs

---

## 2. Stability Pillar Redesign — Role Consistency

### Problem

Stability currently measures week-to-week *scoring* variance. Low variance = high stability. But for RB/TE, low scoring variance actually correlates *negatively* with PPG (RB: -0.668, TE: -0.786) because boring committee backs score consistently low while elite bellcows have volatile scoring.

We band-aided this by reducing stability weight (RB 0.15→0.06, TE 0.15→0.10), but ideally the pillar itself should be useful signal, not suppressed.

### Target Definition

**Stability = consistency of opportunity/role, not consistency of scoring output.**

A bellcow who dominates touches every week should score high on stability even if his point totals swing wildly.

### Implementation Spec

**Step 1: Choose role metrics by position**

| Position | Primary Metric (60% weight) | Secondary Metric (40% weight) |
|---|---|---|
| RB | Touch share consistency | Snap share consistency |
| WR | Route participation consistency | Target share consistency |
| TE | Route participation consistency | Target share consistency |
| QB | Dropback volume consistency | Designed rush share consistency |

Route participation = percentage of team dropbacks where the player ran a route (excluding blocking assignments).

**Step 2: Compute weekly role metrics**

For each player-week, compute:
- `touch_share` = player touches / team total touches
- `snap_share` = player snaps / team total offensive snaps
- `route_participation` = player routes run / team total pass plays
- `target_share` = player targets / team total targets

**Step 3: Compute coefficient of variation (CV)**

CV is standard deviation divided by mean — it scales dispersion relative to the average:

```
mean_r = mean(r_w across weeks)
sd_r = stdev(r_w across weeks)
cv_r = sd_r / mean_r
```

**Step 4: Map to 0-100 pillar score**

```
RoleStability = 1 - clamp(cv_r / cv_cap, 0, 1)
```

Where `cv_cap` is a position-specific maximum CV (e.g., 0.5 for RB touch share). Values above the cap are fully unstable (score = 0).

Then blend primary and secondary:
```
StabilityScore = normalize(0.60 * primary_stability + 0.40 * secondary_stability)
```

### Minimum Participation Gate

CV gets unreliable when the mean is near zero. Apply minimum participation gates:
- RB: minimum 5 touches per game average
- WR/TE: minimum 10 routes per game average
- QB: minimum 15 dropbacks per game average

Players below the gate get a default low stability score (e.g., 25).

### Expected Outcome

After redesign:
- Derrick Henry and Saquon Barkley get high stability (consistent bellcow role despite volatile scoring)
- Committee RBs who split work inconsistently get low stability
- Stability weight can be increased back toward 0.15 for RB/TE since the signal is now positive
- WR stability should remain similar (target share consistency correlates with scoring consistency)

### Validation

- Stability should become positively correlated with PPG for all positions (or at minimum non-negative)
- After restoring RB/TE stability weights, Spearman should remain ≥0.93
- Henry/Barkley should have stability scores >65

---

## 3. QB Team Context Audit — Josh Allen Fix

### Problem

Josh Allen (22.4 PPG, top-3 fantasy QB) scores only 67.6 alpha — below Carson Wentz (73.8, 13.5 PPG). Team context is a legitimate driver of QB scoring (implied points, play volume, TD opportunity), so if the pipeline misassigns context, QB rankings go off the rails.

### Debug Checklist

1. **Team mapping correctness:** Verify `player_id → team_id` is correct for BUF for the 2025 season. Check for stale roster joins or mid-season trade artifacts.

2. **Market data freshness:** Check if implied totals / Vegas-derived features are updated for the scoring week. No off-season cached values.

3. **Pipeline completeness:** Check for NULLs defaulting to league-average or a floor/ceiling that unintentionally crushes elite contexts. BUF should have one of the highest team context scores in the league.

4. **Double dampening:** Check if dampening or confidence adjustments are applied to team context differently than other pillars, pulling a great offense down toward baseline.

### Instrumentation

Add debug logging to the FORGE compute pipeline that outputs raw context inputs for flagged players/teams:
```
[ForgeEngine] Context debug for BUF: implied_pts=X, proe=Y, pace=Z, offensive_epa=W → contextScore=N
```

This makes future context issues instantly diagnosable without SQL archaeology.

### Recommended Context Features

For a robust, explainable ContextScore backbone:
- **Implied team points** (from game lines / market expectations) — scoring environment proxy
- **Pass rate over expected (PROE)** — play-calling tendency proxy
- **Pace / plays-per-game** — volume proxy (more attempts = more fantasy chances)

Avoid over-weighting efficiency metrics inside team context — they're unstable year-to-year.

### Validation

- Josh Allen should rank in top 5 QB Alpha after fix
- Carson Wentz should not outrank any QB with >18 PPG
- BUF team context score should be top-8 in the league

---

## 4. Calibration Guardrails

### Monotonicity Unit Test

After any recompute, assert that calibration preserves raw score ordering:
```
For all player pairs (i, j) in same position:
  if raw_score_i > raw_score_j then alpha_i >= alpha_j
```

Current linear calibration is inherently monotone, but this test catches future regressions if calibration logic changes.

### Amplification Test

Assert that a small raw score gap cannot become a disproportionately large Alpha gap:
```
For all player pairs:
  alpha_gap / raw_gap <= K (e.g., 3.0x maximum amplification)
```

### Top-K Recall Test

After recompute, check:
```
Of the top 12 PPG players at each position, what fraction land in T1/T2?
```

Target: ≥10 of 12 (83%) should be in T1/T2. This is the user-facing "are my elites elite?" test.

### Inversion Penalty Count

Count inversions where a player with PPG gap ≥ X points is ranked below a lower-PPG player, separately for:
- Top tiers (T1/T2) — these matter most to users
- Whole population — background noise level

Target: zero inversions with PPG gap > 5 in T1/T2 after all pillar redesigns are complete.

---

## Implementation Order

1. **QB Context Audit** (Low effort, high diagnostic value) — fixes an obvious data bug, proves the pipeline works
2. **Volume Pillar → xFP** (High effort, highest impact) — fixes the core Irving-class problem
3. **Stability Pillar → Role Consistency** (Medium effort, unlocks weight restoration) — allows stability to be a real signal again
4. **Calibration Guardrails** (Low effort, permanent safety net) — add as unit tests alongside any pillar change

---

## Files to Modify

| File | Change |
|---|---|
| `server/modules/forge/forgeEngine.ts` | Volume pillar calculation, stability pillar calculation, context debug logging |
| `server/modules/forge/forgeGrading.ts` | Potentially restore stability weights after pillar redesign |
| `server/modules/forge/types.ts` | Update calibration anchors after pillar changes |
| `server/modules/datalab/snapshots/` | May need additional data fields (air yards, red zone flags, route participation) |
| `.claude/tasks/pillar-weight-tuning.md` | Update resolution notes with pillar redesign results |
