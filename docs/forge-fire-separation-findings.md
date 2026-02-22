# FORGE / FIRE Separation — Findings Report

**Date**: 2026-02-22
**Branch**: `claude/remove-fantasy-forge-L8GYm`
**Status**: Findings only — no code changes yet

---

## Background

FORGE (Football-Oriented Recursive Grading Engine) is intended to grade players using **raw production and efficiency signals** — yards, targets, routes, air yards, snap share, etc.

FIRE is the module responsible for **fantasy scoring outputs** — PPR points, half-PPR totals, position ranks by scoring format, and scoring-format-specific evaluations.

A separation was initiated a few days ago, but fantasy points fields have persisted across the FORGE engine and its UI surface. This report catalogs every instance and proposes a remediation path.

---

## Severity Classification

| Severity | Meaning |
|---|---|
| **P0 — Hard Violation** | Fantasy output displayed directly on a FORGE UI surface |
| **P1 — Module Violation** | Fantasy scoring totals fetched/cached as FORGE context |
| **P2 — Scoring Format Coupling** | FORGE scoring math is gated on a PPR format parameter |
| **P3 — Gray Area** | Raw fantasy points used as a *proxy* for a production signal FORGE genuinely needs |

---

## P0 — Hard Violations (UI displaying fantasy outputs on FORGE pages)

### `client/src/pages/ForgeLab.tsx`

Lines 588–635 render a **"Fantasy Summary" panel** inside the FORGE player detail view. It shows:

- PPR season total (`totalPpr`)
- PPR positional rank (`pprRankPos`)
- Last week PPR points (`lastWeekPpr`)
- Half-PPR rank (`halfPprRankPos`)

**Specific offending block** — lines 588–635:
```tsx
{playerContext?.fantasy && (
  <div data-testid="fantasy-summary">
    <span>Fantasy Summary</span>
    ...
    // "{position}{pprRankPos} in PPR with {totalPpr} points"
    // Grid cells: Games, Last Played, Data Through, PPR Rank
  </div>
)}
```

**Fix**: Remove the `fantasy` block from `ForgeLab.tsx` entirely. This panel belongs on a FIRE player card. The FORGE detail view should surface only the Alpha score and its pillar breakdown.

---

## P1 — Module Violations (Fantasy totals fetched/cached as FORGE state)

### `server/modules/forge/forgePlayerContext.ts`

The `ForgeFantasySummary` interface (lines 15–27) is a first-class member of `ForgePlayerContext` (line 47):

```ts
export interface ForgeFantasySummary {
  totalPpr: number | null;
  totalHalfPpr: number | null;
  totalStd: number | null;
  lastWeekPpr: number | null;
  lastWeekHalfPpr: number | null;
  lastWeekStd: number | null;
  pprRankPos: number | null;
  halfPprRankPos: number | null;
  // ...
}

export interface ForgePlayerContext {
  // ...
  fantasy: ForgeFantasySummary;  // <-- should not live here
}
```

The SQL query (lines 100–140) joins `forge_player_fantasy_summary` and selects all PPR totals and rank columns.

**Fix**: Remove `ForgeFantasySummary` and the `fantasy` key from `ForgePlayerContext`. Move to a `FirePlayerContext` type. The SQL join to `forge_player_fantasy_summary` should be dropped from this file.

---

### `server/modules/forge/forgeGradeCache.ts`

Lines 272–273 cache fantasy scoring aggregates as part of the FORGE grade record:

```ts
seasonFptsPpr: sql<number>`sum(${datadiveSnapshotPlayerWeek.fptsPpr})`,
ppgPpr: sql<number>`avg(${datadiveSnapshotPlayerWeek.fptsPpr})`,
```

**Fix**: Remove `seasonFptsPpr` and `ppgPpr` from the cache. If FIRE needs these, it maintains its own cache.

---

## P2 — Scoring Format Coupling (FORGE score is PPR-format-aware)

### `server/modules/forge/types.ts` — `ForgeScoreOptions`

```ts
export type PPRType = '0.5' | '1';

export interface ForgeScoreOptions {
  leagueType: LeagueType;
  pprType: PPRType;        // <-- should not exist in FORGE
}
```

### `server/modules/forge/alphaEngine.ts`

The `pprType` parameter changes the efficiency subscore via a reception bonus:

```ts
const pprWeight = options.pprType === '1' ? 1.0 : 0.5;
const efficiencyBoost = (recPerGame - posAvg) * pprWeight * 2;
```

**The problem**: FORGE is supposed to grade *how good a player is at football*, not *how many fantasy points they score in a specific scoring format*. Reception rate is already captured in the efficiency pillar via target share, yards per route, etc. Boosting based on PPR format imports a fantasy scoring concern into what is meant to be a format-neutral production grade.

**Fix**: Remove `pprType` from `ForgeScoreOptions`. The efficiency pillar should use reception rate as a pure production signal (e.g., normalized catch rate, yards after contact per route) rather than as a PPR-weighted multiplier. If scoring-format-adjusted rankings are needed, FIRE applies a thin PPR modifier on top of the FORGE Alpha.

---

### `server/modules/forge/routes.ts`

The batch endpoint documents `pprType` as a FORGE parameter (lines 388–414). Once `pprType` is removed from `ForgeScoreOptions`, this documentation and the route parameter should be removed or redirected to FIRE.

---

### `server/modules/forge/forgeService.ts`

Lines 149, 156, 160 accept and forward `pprType` through the FORGE scoring pipeline. Remove once `ForgeScoreOptions` no longer contains `pprType`.

---

## P3 — Gray Areas (fantasy points used as a production proxy)

These are the most nuanced cases. Fantasy points are used as a *convenience proxy* for production volume, but FORGE arguably should derive the same signal from raw stats.

### Weekly `fantasyPointsPpr` in stability/momentum math

**Files**:
- `server/modules/forge/features/wrFeatures.ts` line 182
- `server/modules/forge/features/rbFeatures.ts` line 190
- `server/modules/forge/features/teFeatures.ts` line 162
- `server/modules/forge/features/qbFeatures.ts` line 173
- `server/modules/forge/alphaEngine.ts` lines 406–415, 479–482

All four position feature files do:
```ts
const weeklyPts = context.weeklyStats.map(w => w.fantasyPointsPpr);
// then use weeklyPts for std dev, floor rate, boom rate
```

**Assessment**: Floor/boom/volatility are legitimate FORGE stability signals. However, using `fantasyPointsPpr` as the input means the stability score shifts based on scoring format. A player with 8 receptions and 60 yards looks more "stable" in PPR than standard.

**Recommended fix**: Replace with a format-neutral composite (e.g., `yards + touchdowns * 6 + receptions * 0` or normalized touches-based production) or use the components directly. At minimum, use `fantasyPointsStd` to remove the PPR format dependency.

---

### `server/modules/forge/dvpMatchupService.ts` — DvP built on fantasy points allowed

The matchup scoring service uses `avg_pts_per_game_ppr` (fantasy points allowed) as its primary signal and applies position-specific fpts weights:

```ts
// WR: 0.15*fpts, RB: 0.25*fpts, TE: 0.30*fpts
function fptsToMatchupScore(fpts: number, position: string): number
```

**Assessment**: This is the largest gray area. "Points allowed per game" is a genuine defensive quality signal, but building it on top of fantasy scoring totals (rather than raw production allowed) means the DvP score inherits PPR format bias. An elite pass-catching RB opponent will inflate WR matchup scores in PPR regardless of actual coverage quality.

**Recommended fix**: Rebuild DvP signals using raw production allowed (receiving yards/game, rush yards/game, TDs/game, targets/game) and let FIRE apply a PPR multiplier when presenting matchup scores to users.

---

### `server/modules/forge/xfpVolumePillar.ts` — xFP as volume signal

Uses `x_ppr_v2` (expected PPR points) and `actual_ppr` from the DataDive model as part of the volume pillar.

**Assessment**: xFP models already capture opportunity volume (targets, carries, routes) so they are closer to a production signal than raw fantasy points. However, naming and units are fantasy-scoring-denominated.

**Recommended fix**: Confirm whether the underlying DataDive model outputs can be accessed in yardage/opportunity units rather than PPR-denominated units. If not, treat this as a lower-priority cleanup since the xFP model itself is the dependency, not FORGE's design.

---

## Summary Table

| File | Severity | Issue | Action |
|---|---|---|---|
| `ForgeLab.tsx` lines 588–635 | **P0** | Fantasy Summary panel rendered in FORGE UI | Remove panel, move to FIRE |
| `forgePlayerContext.ts` lines 15–47 | **P1** | `ForgeFantasySummary` / `fantasy` key in FORGE context | Remove interface + SQL join; move to FIRE |
| `forgeGradeCache.ts` lines 272–273 | **P1** | `seasonFptsPpr`, `ppgPpr` cached in FORGE grade | Remove from FORGE cache |
| `types.ts` line 26, 33–44 | **P2** | `PPRType` + `pprType` in `ForgeScoreOptions` | Remove from FORGE types |
| `alphaEngine.ts` lines 167–192 | **P2** | PPR reception boost in efficiency subscore | Replace with format-neutral reception rate signal |
| `routes.ts` lines 388–414 | **P2** | `pprType` documented as FORGE batch param | Remove/redirect to FIRE |
| `forgeService.ts` lines 149–160 | **P2** | `pprType` forwarded through FORGE service | Remove once `ForgeScoreOptions` is cleaned |
| `features/*.ts` (×4) | **P3** | `fantasyPointsPpr` used for floor/boom/volatility | Replace with format-neutral production composite |
| `dvpMatchupService.ts` | **P3** | DvP built entirely on fantasy points allowed | Rebuild on raw production allowed; move PPR layer to FIRE |
| `xfpVolumePillar.ts` | **P3** | `x_ppr_v2` / `actual_ppr` in volume pillar | Assess DataDive model outputs; lower priority |

---

## Proposed Remediation Order

1. **P0 first** — Remove the Fantasy Summary panel from `ForgeLab.tsx`. Zero risk, immediate separation visible to users.
2. **P1 next** — Strip `ForgeFantasySummary` from `ForgePlayerContext` and `forgeGradeCache`. This removes the DB join overhead and makes the module boundary explicit in the type system.
3. **P2 after types are clean** — Remove `pprType` from `ForgeScoreOptions`, `types.ts`, `routes.ts`, `forgeService.ts`, and the reception boost from `alphaEngine.ts`. Replace with a format-neutral reception rate contribution.
4. **P3 last** — Address stability volatility math and DvP service. These touch more logic and should be done after the cleaner P0–P2 work ships.

---

## Out of Scope for This Report

Fantasy points fields in unrelated pages (`TiberDataLab`, `MetricsDictionary`, `RoleBankRankings`, `WeeklyDataTable`, etc.) are not FORGE-surface violations — they are legitimate FIRE or data exploration surfaces and do not need to change as part of this work.
