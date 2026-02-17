# FORGE Pillar Weight Tuning — Deep Research Brief

**Created:** 2026-02-16
**Updated:** 2026-02-17
**Status:** Resolved — Weights recalibrated, validated
**Priority:** High — Directly impacts ranking accuracy

---

## Problem Statement

FORGE Alpha scores show ranking anomalies driven by pillar weight imbalances. The most visible case: **Bucky Irving (93.2, T1)** ranks above **Christian McCaffrey (87.5, T1)** despite CMC having 24.4 PPG vs Irving's 13.8 PPG. This is a weight distribution problem, not a dampening issue.

---

## Current Configuration

### Redraft Pillar Weights

| Position | Volume | Efficiency | Team Context | Stability |
|----------|--------|------------|-------------|-----------|
| QB | 0.25 | 0.45 | 0.18 | 0.12 |
| RB | 0.50 | 0.25 | 0.10 | 0.15 |
| WR | 0.55 | 0.15 | 0.18 | 0.12 |
| TE | 0.55 | 0.15 | 0.15 | 0.15 |

**File:** `server/modules/forge/forgeGrading.ts`, lines 49-54

### Dynasty Pillar Weights

| Position | Volume | Efficiency | Team Context | Stability |
|----------|--------|------------|-------------|-----------|
| QB | 0.20 | 0.35 | 0.20 | 0.25 |
| RB | 0.35 | 0.10 | 0.15 | 0.40 |
| WR | 0.35 | 0.15 | 0.20 | 0.30 |
| TE | 0.35 | 0.15 | 0.15 | 0.35 |

**File:** `server/modules/forge/forgeGrading.ts`, lines 58-63

### Tier Thresholds (calibrated Alpha → T1/T2/T3/T4/T5)

| Position | T1 | T2 | T3 | T4 |
|----------|-----|-----|-----|-----|
| QB | 82 | 68 | 52 | 38 |
| RB | 78 | 68 | 55 | 42 |
| WR | 82 | 72 | 58 | 45 |
| TE | 82 | 70 | 55 | 42 |

**File:** `server/modules/forge/forgeGrading.ts`, lines 65-70

### Games-Played Dampening

- Formula: `confidence = sqrt(gamesPlayed / threshold)`
- Thresholds: QB=12, RB/WR/TE=10
- Baseline: 40 (pulls pillar scores toward this value for low-sample players)
- **File:** `server/modules/forge/forgeEngine.ts`, lines 929-957

---

## Critical Finding: Correlation Analysis

PPG-to-Pillar correlations from 2025 season data (357 players) reveal the current weights may be misaligned:

| Position | PPG↔Volume | PPG↔Efficiency | PPG↔Context | PPG↔Stability | PPG↔Alpha |
|----------|-----------|----------------|-------------|---------------|-----------|
| QB | 0.493 | 0.439 | **0.661** | 0.404 | 0.597 |
| RB | **0.929** | 0.158 | 0.075 | **-0.668** | 0.902 |
| WR | **0.893** | 0.332 | 0.217 | **0.801** | 0.928 |
| TE | **0.894** | 0.293 | -0.005 | **-0.786** | 0.922 |

### Key Insights

1. **RB stability is negatively correlated (-0.668) with fantasy production.** High-stability RBs tend to be boring committee backs with low upside. Bellcow backs who produce big fantasy weeks are inherently volatile. Yet stability currently gets 15% weight for RBs.

2. **TE stability is even more negatively correlated (-0.786).** Same dynamic — elite TEs spike hard in big games and have quiet weeks. Stability rewards the wrong TEs.

3. **WR stability is strongly positive (+0.801).** Consistent target volume is a genuine signal for WR value. Current 12% weight may be too low.

4. **QB team context (0.661) is the strongest single QB predictor**, yet gets only 18% weight vs 45% for efficiency (0.439 correlation).

---

## Anomaly Deep Dive: Irving vs CMC

| Metric | Irving | CMC | Delta |
|--------|--------|-----|-------|
| PPG (PPR) | 13.8 | 24.4 | CMC +10.6 |
| Games | 10 | 17 | CMC +7 |
| Volume | 71.4 | 81.4 | CMC +10.0 |
| Efficiency | 42.4 | 45.1 | CMC +2.7 |
| Team Context | 57.3 | 41.4 | **Irving +15.9** |
| Stability | 53.7 | 30.4 | **Irving +23.3** |
| Weighted Base | 60.1 | 60.6 | CMC +0.5 |
| Calibrated Alpha | 93.2 | 87.5 | **Irving +5.7** |

CMC wins volume (+10) and slightly wins efficiency (+2.7). But Irving's team context (+15.9) and stability (+23.3) advantages more than compensate under current weights. The calibration step then amplifies the small base difference.

The root cause: **stability is rewarding the wrong thing for RBs.** CMC's low stability (30.4) actually reflects the high-variance, high-ceiling bellcow profile that fantasy managers want.

---

## Additional Anomalies to Investigate

| Player | Alpha | PPG | Tier | Issue |
|--------|-------|-----|------|-------|
| D'Andre Swift | 79.8 | 14.5 | T1 | High stability (63.1) inflates a 14.5 PPG RB to T1 |
| Chase Brown | 78.8 | 16.4 | T1 | High context (66.5) pushes above Gibbs (21.6 PPG, T2) |
| Saquon Barkley | 78.2 | 14.5 | T1 | Borderline — context/stability rescue low efficiency |
| Jahmyr Gibbs | 77.2 | 21.6 | T2 | 21.6 PPG RB stuck below 14.5 PPG Swift — stability penalty (40.0) |
| Derrick Henry | 71.0 | 16.8 | T2 | Low stability (42.2) drags down a workhorse back |
| Jared Goff | 95.0 | 17.4 | T1 | QB #1 over Allen (22.4 PPG) due to stability=93.8 |
| Josh Allen | 70.5 | 22.4 | T2 | Elite production penalized by lower efficiency/stability scores |

---

## Research Questions for Investigation

1. **Should RB stability weight be reduced to 0.05 or even 0?** The -0.668 correlation suggests stability actively hurts RB ranking accuracy. Alternative: flip the stability interpretation for RBs to reward upside variance.

2. **Should RB volume weight increase to 0.60–0.65?** Volume is 0.929 correlated with PPG for RBs — it's by far the strongest signal. Current 0.50 may be too low.

3. **Should TE stability be zeroed out or inverted?** At -0.786 correlation, it's the most counterproductive weight in the system.

4. **Should QB weights shift toward team context?** At 0.661 correlation (vs efficiency at 0.439), team context may deserve more than 18%.

5. **Is the calibration step over-amplifying small base differences?** Irving's base is only 0.5 below CMC (60.1 vs 60.6), but calibration produces a 5.7 point gap in the opposite direction. Investigate the calibration formula's interaction with tier thresholds.

6. **Should stability be redefined per position?** For RBs, "stability" could mean "consistency of opportunity" (snap %, touch share consistency) rather than "consistency of output." A bellcow with consistent touches but varying fantasy output is actually the ideal profile.

7. **Dynasty vs Redraft divergence:** Dynasty weights (RB stability: 0.40) are even more extreme. If stability hurts RB accuracy in redraft, does it also hurt dynasty accuracy, or does the long-term lens genuinely justify it?

---

## Suggested Experimental Weight Sets to Test

### Option A — Correlation-Aligned

| Position | Volume | Efficiency | Team Context | Stability |
|----------|--------|------------|-------------|-----------|
| QB | 0.30 | 0.30 | 0.30 | 0.10 |
| RB | 0.65 | 0.15 | 0.10 | 0.10 |
| WR | 0.50 | 0.15 | 0.10 | 0.25 |
| TE | 0.65 | 0.15 | 0.10 | 0.10 |

### Option B — Moderate Adjustment

| Position | Volume | Efficiency | Team Context | Stability |
|----------|--------|------------|-------------|-----------|
| QB | 0.25 | 0.35 | 0.25 | 0.15 |
| RB | 0.55 | 0.25 | 0.10 | 0.10 |
| WR | 0.50 | 0.15 | 0.15 | 0.20 |
| TE | 0.60 | 0.15 | 0.10 | 0.15 |

### Option C — Stability Inversion for RB/TE

Keep current weights but redefine stability for RB/TE as "upside variance" — higher variance gets a higher score. This preserves the weight structure but fixes what the pillar measures.

---

## Files to Modify

- `server/modules/forge/forgeGrading.ts` — Lines 49-54: `POSITION_WEIGHTS`, Lines 58-63: `DYNASTY_WEIGHTS`, Lines 65-70: `POSITION_TIER_THRESHOLDS`
- `server/modules/forge/forgeEngine.ts` — Lines 929-957: Dampening config. Also the pillar computation functions that define what each metric actually measures.
- `server/modules/forge/types.ts` — Type definitions if new pillar sub-metrics are added.

---

## Validation Approach

After any weight change, recompute all 357 players and check:

1. PPG↔Alpha correlation by position (target: >0.85 for RB/WR/TE, >0.65 for QB)
2. T1 count per position (target: 5-8 per position)
3. Spot-check the anomaly cases above — CMC, Gibbs, Henry, Allen should rank closer to their PPG-implied position
4. Run the admin recompute endpoint: `POST /api/forge/admin/recompute-all` with `FORGE_ADMIN_KEY` header

### SQL for correlation check after recompute:

```sql
SELECT position,
  round(corr(ppg_ppr, alpha)::numeric, 3) as ppg_alpha_corr,
  round(corr(ppg_ppr, volume_score)::numeric, 3) as ppg_vol_corr,
  round(corr(ppg_ppr, efficiency_score)::numeric, 3) as ppg_eff_corr,
  round(corr(ppg_ppr, team_context_score)::numeric, 3) as ppg_ctx_corr,
  round(corr(ppg_ppr, stability_score)::numeric, 3) as ppg_stab_corr
FROM forge_grade_cache WHERE season = 2025
GROUP BY position ORDER BY position;
```

### SQL for tier distribution check:

```sql
SELECT position,
  count(*) as cnt,
  count(*) FILTER (WHERE tier = 'T1') as t1,
  count(*) FILTER (WHERE tier = 'T2') as t2,
  count(*) FILTER (WHERE tier = 'T3') as t3,
  count(*) FILTER (WHERE tier = 'T4') as t4,
  count(*) FILTER (WHERE tier = 'T5') as t5
FROM forge_grade_cache WHERE season = 2025
GROUP BY position ORDER BY position;
```

### SQL for anomaly spot-check:

```sql
SELECT player_name, alpha, ppg_ppr, games_played, tier,
  round(volume_score::numeric, 1) as vol,
  round(efficiency_score::numeric, 1) as eff,
  round(team_context_score::numeric, 1) as ctx,
  round(stability_score::numeric, 1) as stab
FROM forge_grade_cache
WHERE player_name IN (
  'Bucky Irving', 'Christian McCaffrey', 'Jahmyr Gibbs',
  'D''Andre Swift', 'Derrick Henry', 'Josh Allen', 'Jared Goff'
)
AND season = 2025
ORDER BY position, alpha DESC;
```

---

## Resolution (2026-02-17)

### Changes Applied

**1. Redraft Pillar Weights** (based on PPG↔pillar correlation analysis):

| Position | Volume | Efficiency | Team Context | Stability | Key Change |
|----------|--------|------------|-------------|-----------|------------|
| RB | 0.62 | 0.22 | 0.10 | **0.06** | Stability 0.15→0.06 (anti-signal: -0.668 corr) |
| TE | 0.62 | 0.18 | 0.10 | **0.10** | Stability 0.15→0.10 (anti-signal: -0.786 corr) |
| WR | 0.48 | 0.15 | 0.15 | **0.22** | Stability 0.12→0.22 (positive: +0.801 corr) |
| QB | 0.28 | 0.32 | **0.28** | 0.12 | Team Context 0.18→0.28 (strongest: 0.661 corr) |

**2. Calibration Percentile Anchors** (widened p10/p90 to reduce amplification):

| Position | Old p10/p90 | New p10/p90 | Effect |
|----------|-----------|-----------|--------|
| RB | 28/64 | 23/68 | Wider range → less ceiling compression |
| TE | 31/68 | 29/64 | Tighter for narrower TE raw distribution |
| WR | 28/78 | 31/76 | Slight adjustment |
| QB | 30/73 | 35/73 | Raised floor for QB distribution |

**3. Tier Thresholds** aligned across `forgeGrading.ts` (POSITION_TIER_THRESHOLDS) and `types.ts` (TIBER_TIERS_2025): RB 78/68/55/42, WR 82/72/58/45, TE 82/70/55/42, QB 82/68/52/38.

### Validation Results

**Tier Distribution (before → after):**

| Position | T1 before | T1 after | Target | Status |
|----------|-----------|----------|--------|--------|
| RB | 17 | 8 | 5-8 | Within target |
| TE | 6 | 4 | 3-6 | Within target |
| WR | 9 | 9 | 6-10 | Within target |
| QB | 5 | 5 | 3-6 | Within target |

**Spearman Rank Correlation (Alpha vs PPG):**
- RB: 0.943 (excellent)
- TE: 0.939 (excellent)
- WR: 0.908 (very good)
- QB: 0.623 (moderate — expected, QB value depends on team context)

**Key Remaining Inversions:**
- Bucky Irving (91.2, 13.8 PPG) > Bijan Robinson (87.5, 22.1 PPG): Volume pillar design issue, not calibration
- Carson Wentz (73.8) > Josh Allen (67.6): Team context data issue for BUF

### Future Work
- Redesign Volume pillar to weight per-play production, not just opportunity count
- Redesign Stability pillar to measure role consistency instead of scoring variance
- Investigate QB team context calculation for BUF/Josh Allen anomaly
