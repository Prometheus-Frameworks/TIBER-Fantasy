# FORGE Data Source Contract v1.0

> Interface specification for any new data module consumed by the FORGE engine.
>
> **Last updated:** 2026-02-15
>
> **Key files:**
> - `server/modules/forge/forgeEngine.ts` — Engine, metric configs, context fetcher, metric lookup
> - `server/modules/forge/forgeGrading.ts` — Weight application, mode adjustments, tier assignment
> - `server/modules/forge/types.ts` — Type definitions
> - `server/modules/forge/features/wrFeatures.ts` (and `rb`/`te`/`qb`) — Position-specific feature builders

---

## Table of Contents

1. [How FORGE Consumes Data](#1-how-forge-consumes-data)
2. [Required Function Signature](#2-required-function-signature)
3. [Data Quality Requirements](#3-data-quality-requirements)
4. [Adding a New Metric Source](#4-adding-a-new-metric-source)
5. [Adding Metrics to Existing Pillars](#5-adding-metrics-to-existing-pillars)
6. [Creating a New Pillar (Advanced)](#6-creating-a-new-pillar-advanced)
7. [Registration Checklist](#7-registration-checklist)
8. [Worked Example: Personnel Grouping Module](#8-worked-example-personnel-grouping-module)

---

## 1. How FORGE Consumes Data

FORGE evaluates players through a four-pillar system: **Volume**, **Efficiency**, **Team Context**, and **Stability**. Each pillar aggregates weighted metrics pulled from different data sources.

### Architecture

```
Your Data Module
      │
      │  getMetricForPlayer(playerId, season, weekStart, weekEnd)
      │  → Record<string, number | null>
      ▼
┌──────────────────────────────────────────────────┐
│              fetchForgeContext()                   │
│  Gathers all data into a ForgeContext object       │
│  (roleBank, teamContext, sosData, recursion, etc.) │
└──────────────────┬───────────────────────────────┘
                   │ ForgeContext
                   ▼
┌──────────────────────────────────────────────────┐
│           createMetricLookup(context)              │
│  Builds: (metricKey, source) → number | null       │
│  Routes to correct data bucket based on source     │
└──────────────────┬───────────────────────────────┘
                   │ MetricLookupFn
                   ▼
┌──────────────────────────────────────────────────┐
│           computePillarScore(pillarConfig, lookup) │
│  Iterates PillarMetricConfig[], looks up values,   │
│  applies weights, inversion, caps → 0-100 score    │
└──────────────────────────────────────────────────┘
```

### MetricSource Types

The engine defines where to look for data via the `MetricSource` type:

```typescript
type MetricSource =
  | 'snapshot_player_week'   // Weekly player snapshot data
  | 'snapshot_team_context'  // Team-level context (pass volume, pace)
  | 'sos_table'              // Strength of schedule scores
  | 'role_bank'              // Position role bank tables (volume, efficiency, usage)
  | 'qb_alpha'               // QB context scores (blended into teamContext)
  | 'recursion'              // Prior alpha / momentum from recursive engine
  | 'derived';               // Computed on-the-fly from other context fields
```

### Pillar Metric Configuration

Each metric within a pillar is defined as:

```typescript
type PillarMetricConfig = {
  metricKey: string;      // e.g., 'targets_per_game'
  source: MetricSource;   // e.g., 'role_bank'
  weight: number;         // e.g., 0.25 (weights within a pillar should sum to ~1.0)
  invert?: boolean;       // If true, value = 100 - value (for "lower is better" metrics)
  cap?: {                 // Optional min/max clamp after inversion
    min?: number;
    max?: number;
  };
};
```

### Existing Metric Sources

| Source | Example Metric Keys | Used In |
|--------|-------------------|---------|
| `role_bank` | `volume_score`, `targets_per_game`, `target_share_avg`, `efficiency_score`, `ppr_per_target`, `carries_per_game`, `opportunities_per_game`, `red_zone_touches_per_game`, `consistency_score`, `high_value_usage_score` | Volume, Efficiency, Stability |
| `snapshot_team_context` | `team_pass_volume`, `team_pace`, `team_run_volume`, `team_red_zone_drives` | Team Context |
| `sos_table` | `pass_defense_sos`, `run_defense_sos`, `te_defense_sos` | Team Context |
| `derived` | `availability_score`, `route_stability`, `snap_floor`, `depth_chart_insulation`, `qb_continuity` | Stability (WR) |
| `qb_alpha` | QB context scores | Blended into Team Context by forgeGrading |
| `recursion` | `prior_alpha`, `alpha_momentum` | Recursive smoothing |

### Position Pillar Weights (Redraft Mode)

| Position | Volume | Efficiency | Team Context | Stability |
|----------|--------|-----------|-------------|-----------|
| **WR** | 0.55 | 0.15 | 0.18 | 0.12 |
| **RB** | 0.50 | 0.25 | 0.10 | 0.15 |
| **TE** | 0.55 | 0.15 | 0.15 | 0.15 |
| **QB** | 0.25 | 0.45 | 0.18 | 0.12 |

### WR Volume Pillar Example (Intra-Pillar Weights)

```typescript
const WR_VOLUME_METRICS: PillarMetricConfig[] = [
  { metricKey: 'volume_score',          source: 'role_bank', weight: 0.35 },
  { metricKey: 'targets_per_game',      source: 'role_bank', weight: 0.25 },
  { metricKey: 'target_share_avg',      source: 'role_bank', weight: 0.20 },
  { metricKey: 'routes_per_game',       source: 'role_bank', weight: 0.10 },
  { metricKey: 'deep_targets_per_game', source: 'role_bank', weight: 0.10 },
];
// Weights sum: 0.35 + 0.25 + 0.20 + 0.10 + 0.10 = 1.00
```

---

## 2. Required Function Signature

Any data module that feeds FORGE **must** expose a function with this signature:

```typescript
async function getMetricForPlayer(
  playerId: string,
  season: number,
  weekStart?: number,
  weekEnd?: number
): Promise<Record<string, number | null>>
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `playerId` | `string` | Yes | Canonical player ID (from `player_identity_map`) |
| `season` | `number` | Yes | NFL season year (e.g., `2025`) |
| `weekStart` | `number` | No | Start of week range (inclusive). If omitted, use full season. |
| `weekEnd` | `number` | No | End of week range (inclusive). If omitted, use `weekStart` or latest available. |

**Return value:**

```typescript
{
  metricKey1: number | null,
  metricKey2: number | null,
  // ...one entry per metric your module provides
}
```

**Example return:**

```typescript
// Personnel Grouping module returns:
{
  personnel_11_pct: 72.5,         // % of snaps in 11 personnel (0-100)
  personnel_12_pct: 18.3,         // % of snaps in 12 personnel (0-100)
  personnel_full_time_pct: 85.0,  // % of snaps in player's primary grouping (0-100)
  personnel_versatility: 42.0,    // Cross-grouping usage score (0-100)
}
```

**Rules:**

1. Return `null` for any metric where data is unavailable — do NOT return `0` as a substitute for missing data.
2. All keys must use `snake_case`.
3. The function must be `async` — FORGE calls data sources concurrently.
4. Must resolve within **2 seconds** per player. FORGE batches up to 150 players; slow sources bottleneck the entire pipeline.

---

## 3. Data Quality Requirements

### 3.1 Value Types

All metric values must be `number | null`. No strings, booleans, or objects.

```typescript
// ✅ Good
{ personnel_full_time_pct: 85.0 }
{ personnel_full_time_pct: null }  // Data not available

// ❌ Bad
{ personnel_full_time_pct: "85%" }
{ personnel_full_time_pct: true }
{ personnel_full_time_pct: { value: 85, confidence: 0.9 } }
```

### 3.2 Null Handling

FORGE's `computePillarScore()` **skips** null metrics entirely. The weight is redistributed to metrics that do have values:

```typescript
// From computePillarScore():
for (const metric of pillarConfig.metrics) {
  let value = lookup(metric.metricKey, metric.source);
  if (value == null) continue;  // Skipped — weight not counted
  total += value * metric.weight;
  weightSum += metric.weight;
}
return total / weightSum;  // Only counted weights
```

**Implication:** If your module returns `null`, the pillar score is computed from the remaining metrics. This is generally safe, but means your metric has zero influence when null. If ALL metrics in a pillar are null, the pillar defaults to `50`.

### 3.3 Normalization

FORGE expects values on a **0-100 scale** for direct scoring. The engine has two normalization paths:

1. **Score metrics** (names ending in `_score`, `_index`): Clamped directly to `[0, 100]`.
2. **Raw metrics** (everything else): Normalized via `normalizeMetric()` using predefined ranges.

**Your options:**

| Strategy | When to Use | What to Do |
|----------|------------|------------|
| **Pre-normalized (recommended)** | Your values are already 0-100 | Name them `*_score` or `*_index` — FORGE clamps to [0, 100] automatically |
| **Raw with normalization range** | Your values are on a natural scale (e.g., 0-1 for rates, 0-40 for counts) | Add an entry to `normalizationRanges` in `normalizeMetric()` in `forgeEngine.ts` |

```typescript
// Adding normalization ranges in forgeEngine.ts → normalizeMetric():
const normalizationRanges: Record<string, { min: number; max: number }> = {
  // ... existing ranges ...
  personnel_full_time_pct: { min: 0, max: 100 },  // Already 0-100, just clamp
  personnel_versatility:   { min: 0, max: 100 },
};
```

### 3.4 Minimum Sample Size

Document what constitutes `LOW_SAMPLE` for your data. FORGE's confidence system already penalizes players with < 4 games:

| Games Played | Confidence Adjustment |
|-------------|----------------------|
| < 4 games | -30 points |
| < 6 games | -15 points |

**Your module should:**

1. Define its own minimum sample threshold (e.g., "Personnel data requires ≥ 3 games with snap tracking").
2. Return `null` for metrics when below the threshold — don't extrapolate from insufficient data.
3. Document the threshold in your module's README or comments.

### 3.5 Inversion

If your metric is "lower is better" (e.g., `sack_rate`, `opp_std_dev`), set `invert: true` in the `PillarMetricConfig`. FORGE will apply `value = 100 - value` before weighting.

---

## 4. Adding a New Metric Source

If your data doesn't fit an existing `MetricSource` category, you'll need to register a new source type.

### Step 1: Decide Source Type

| Question | If Yes → |
|----------|---------|
| Does your data live in a `{pos}_role_bank` table? | Use `source: 'role_bank'` (no changes needed) |
| Is it team-level context (pace, volume, etc.)? | Use `source: 'snapshot_team_context'` |
| Is it computed on-the-fly from other context fields? | Use `source: 'derived'` and implement in `computeDerivedMetric()` |
| Does it need its own data path? | **Create a new MetricSource value** (see below) |

### Step 2: Register New MetricSource (if needed)

**File: `server/modules/forge/forgeEngine.ts`**

```typescript
// Before:
export type MetricSource =
  | 'snapshot_player_week'
  | 'snapshot_team_context'
  | 'sos_table'
  | 'role_bank'
  | 'qb_alpha'
  | 'recursion'
  | 'derived';

// After:
export type MetricSource =
  | 'snapshot_player_week'
  | 'snapshot_team_context'
  | 'sos_table'
  | 'role_bank'
  | 'qb_alpha'
  | 'recursion'
  | 'derived'
  | 'personnel_grouping';   // ← New source
```

### Step 3: Add Data Bucket to ForgeContext

**File: `server/modules/forge/forgeEngine.ts`**

```typescript
export type ForgeContext = {
  playerId: string;
  playerName: string;
  position: Position;
  nflTeam?: string;
  season: number;
  week: number | 'season';
  gamesPlayed: number;
  roleBank: Record<string, number | null>;
  teamContext: Record<string, number | null>;
  sosData: Record<string, number | null>;
  recursion: { priorAlpha?: number; alphaMomentum?: number };
  personnelGrouping?: Record<string, number | null>;  // ← New bucket
};
```

### Step 4: Fetch Data in Context Builder

**File: `server/modules/forge/forgeEngine.ts`** — inside `fetchForgeContext()` (or `context/contextFetcher.ts`):

```typescript
// Add your fetch call alongside existing data fetches
const personnelData = await getMetricForPlayer(playerId, season, weekStart, weekEnd);

// Include in the returned ForgeContext
return {
  // ... existing fields ...
  personnelGrouping: personnelData,
};
```

### Step 5: Wire into Metric Lookup

**File: `server/modules/forge/forgeEngine.ts`** — inside `createMetricLookup()`:

```typescript
export function createMetricLookup(context: ForgeContext): MetricLookupFn {
  return (metricKey: string, source: MetricSource): number | null => {
    let rawValue: number | null = null;

    switch (source) {
      case 'role_bank':
        rawValue = context.roleBank[metricKey] ?? null;
        break;
      case 'snapshot_team_context':
        rawValue = context.teamContext[metricKey] ?? null;
        break;
      case 'sos_table':
        rawValue = context.sosData[metricKey] ?? null;
        break;
      // ... existing cases ...

      case 'personnel_grouping':                              // ← New case
        rawValue = context.personnelGrouping?.[metricKey] ?? null;
        break;

      default:
        rawValue = null;
    }

    // ... existing normalization logic ...
  };
}
```

### Step 6: Register Metrics in Pillar Config

See [Section 5](#5-adding-metrics-to-existing-pillars) below.

---

## 5. Adding Metrics to Existing Pillars

To add a metric to an existing pillar (Volume, Efficiency, Team Context, or Stability):

### Step 1: Choose the Pillar

| Pillar | What Belongs Here |
|--------|------------------|
| **Volume** | Usage, opportunity, touch counts, snap share, route participation |
| **Efficiency** | Production per opportunity, EPA, yards per route, catch rate |
| **Team Context** | Team-level environment (pace, pass rate, SoS, offensive quality) |
| **Stability** | Role security, consistency, floor protection, availability, depth chart position |

### Step 2: Add the PillarMetricConfig Entry

**File: `server/modules/forge/forgeEngine.ts`**

```typescript
const WR_PILLARS: PositionPillarConfig = {
  // ...
  stability: {
    metrics: [
      { metricKey: 'availability_score',      source: 'derived', weight: 0.20 },  // Was 0.25
      { metricKey: 'route_stability',         source: 'derived', weight: 0.20 },  // Was 0.25
      { metricKey: 'snap_floor',              source: 'derived', weight: 0.15 },  // Was 0.20
      { metricKey: 'depth_chart_insulation',  source: 'derived', weight: 0.15 },  // Unchanged
      { metricKey: 'qb_continuity',           source: 'derived', weight: 0.15 },  // Unchanged
      // ↓ NEW metric
      { metricKey: 'personnel_full_time_pct', source: 'personnel_grouping', weight: 0.15 },
    ],
    // New weights sum: 0.20 + 0.20 + 0.15 + 0.15 + 0.15 + 0.15 = 1.00 ✅
  },
};
```

### Step 3: Rebalance Weights

**Critical rule:** Intra-pillar weights must sum to **~1.0**.

When adding a new metric, you must reduce existing weights proportionally. Guidelines:

| New Metric Weight | Interpretation |
|------------------|---------------|
| 0.05 – 0.10 | Minor signal, supplementary |
| 0.10 – 0.20 | Moderate influence |
| 0.20 – 0.30 | Major contributor |
| > 0.30 | Dominant signal (use sparingly) |

**Weight reduction formula:**

```
new_weight_for_existing = old_weight × (1 - new_metric_weight)
```

Example: Adding a 0.15 weight metric to WR Stability (5 existing metrics each ~0.20):

```
Each existing metric: 0.20 × (1 - 0.15) / (1.00 - 0.00) ≈ 0.17
Redistribute the 0.15 across 5 metrics: each loses 0.03
```

### Step 4: Add Normalization Range (if raw metric)

If your metric is NOT a `*_score` or `*_index`, add a normalization range:

```typescript
// In forgeEngine.ts → normalizeMetric()
const normalizationRanges: Record<string, { min: number; max: number }> = {
  // ... existing ...
  personnel_full_time_pct: { min: 30, max: 100 },
};
```

---

## 6. Creating a New Pillar (Advanced)

Adding a 5th pillar (e.g., "Scheme Fit") is rare and affects the entire scoring pipeline. Requirements:

### 6.1 Engine Changes

**File: `server/modules/forge/forgeEngine.ts`**

1. Add the pillar to `PositionPillarConfig`:

```typescript
export type PositionPillarConfig = {
  volume: PillarConfig;
  efficiency: PillarConfig;
  teamContext: PillarConfig;
  stability: PillarConfig;
  schemeFit: PillarConfig;   // ← New pillar
};
```

2. Add the pillar to `ForgePillarScores`:

```typescript
export type ForgePillarScores = {
  volume: number;
  efficiency: number;
  teamContext: number;
  stability: number;
  schemeFit: number;          // ← New pillar
  dynastyContext?: number;
};
```

3. Define metric configs for every position (WR_PILLARS, RB_PILLARS, TE_PILLARS, QB_PILLARS):

```typescript
const WR_PILLARS: PositionPillarConfig = {
  // ... existing pillars ...
  schemeFit: {
    metrics: [
      { metricKey: 'route_tree_diversity', source: 'personnel_grouping', weight: 0.40 },
      { metricKey: 'personnel_full_time_pct', source: 'personnel_grouping', weight: 0.30 },
      { metricKey: 'motion_usage_rate', source: 'personnel_grouping', weight: 0.30 },
    ],
  },
};
```

### 6.2 Grading Changes

**File: `server/modules/forge/forgeGrading.ts`**

1. Add the pillar to `ForgeWeights`:

```typescript
export type ForgeWeights = {
  volume: number;
  efficiency: number;
  teamContext: number;
  stability: number;
  schemeFit: number;   // ← New pillar
};
```

2. Update `POSITION_WEIGHTS` and `DYNASTY_WEIGHTS` — all weights must still sum to **1.0**:

```typescript
const POSITION_WEIGHTS: Record<Position, ForgeWeights> = {
  WR: { volume: 0.50, efficiency: 0.13, teamContext: 0.15, stability: 0.10, schemeFit: 0.12 },
  // ... etc
};
```

3. Update `computeBaseAlpha()` to include the new pillar:

```typescript
function computeBaseAlpha(pillars: ForgePillarScores, weights: ForgeWeights): number {
  const { volume, efficiency, teamContext, stability, schemeFit } = pillars;
  const { volume: wV, efficiency: wE, teamContext: wT, stability: wS, schemeFit: wSF } = weights;
  const totalWeight = wV + wE + wT + wS + wSF || 1;
  const alpha = (volume * wV + efficiency * wE + teamContext * wT + stability * wS + schemeFit * wSF) / totalWeight;
  return Math.max(0, Math.min(100, alpha));
}
```

### 6.3 Type Changes

**File: `server/modules/forge/types.ts`**

Update `ForgeSubScores`, `AlphaWeights`, `ALPHA_WEIGHTS`, `ForgeFeatureBundleBase`.

### 6.4 Frontend Changes

Update `client/src/types/forge.ts` and any components displaying pillar breakdowns (ForgeTransparencyPanel, ForgeWorkbench, etc.).

---

## 7. Registration Checklist

Complete step-by-step file edits to wire a new data source into FORGE:

### Scenario A: New metric using existing source (e.g., adding a role_bank column)

- [ ] **DB**: Ensure the column exists in the position's role bank table (e.g., `wr_role_bank.personnel_full_time_pct`)
- [ ] **`forgeEngine.ts`**: Add `PillarMetricConfig` entry to the appropriate position pillar
- [ ] **`forgeEngine.ts`**: Add normalization range in `normalizeMetric()` (if not a `*_score`/`*_index`)
- [ ] **`forgeEngine.ts`**: Rebalance intra-pillar weights to sum to ~1.0
- [ ] **Test**: Hit `GET /api/forge/transparency/:playerId` — verify new metric appears in raw metrics
- [ ] **Test**: Hit `GET /api/forge/eg/player/:playerId` — verify pillar score changed

### Scenario B: New metric source type

- [ ] **`forgeEngine.ts`**: Add value to `MetricSource` union type
- [ ] **`forgeEngine.ts`**: Add data bucket to `ForgeContext` type
- [ ] **`forgeEngine.ts`**: Add fetch call in context builder (`fetchForgeContext()` or `context/contextFetcher.ts`)
- [ ] **`forgeEngine.ts`**: Add `case` in `createMetricLookup()` switch statement
- [ ] **`forgeEngine.ts`**: Add `PillarMetricConfig` entries to position pillars
- [ ] **`forgeEngine.ts`**: Add normalization ranges if needed
- [ ] **`forgeEngine.ts`**: Rebalance intra-pillar weights
- [ ] **Your module**: Implement `getMetricForPlayer()` with the required signature
- [ ] **Your module**: Handle player ID resolution (canonical → GSIS/Sleeper via `player_identity_map`)
- [ ] **Your module**: Document `LOW_SAMPLE` threshold
- [ ] **Test**: Verify the full pipeline produces sensible scores
- [ ] **Test**: Check null handling — your module returning all nulls should not crash FORGE

### Scenario C: New pillar

- [ ] All items from Scenario B, plus:
- [ ] **`forgeEngine.ts`**: Update `PositionPillarConfig` and `ForgePillarScores` types
- [ ] **`forgeGrading.ts`**: Update `ForgeWeights` type
- [ ] **`forgeGrading.ts`**: Update `POSITION_WEIGHTS` and `DYNASTY_WEIGHTS` (must sum to 1.0)
- [ ] **`forgeGrading.ts`**: Update `computeBaseAlpha()` to include new pillar
- [ ] **`types.ts`**: Update `ForgeSubScores`, `AlphaWeights`, `ALPHA_WEIGHTS`, `ForgeFeatureBundleBase`
- [ ] **Frontend**: Update `client/src/types/forge.ts` and pillar display components
- [ ] **Test**: Verify all 4 positions produce valid alpha scores
- [ ] **Test**: Verify all 3 modes (redraft, dynasty, bestball) produce valid results

---

## 8. Worked Example: Personnel Grouping Module

This example walks through integrating a hypothetical **Personnel Grouping Intelligence** module that tracks what personnel formations each player participates in.

### 8.1 Module Service

```typescript
// server/modules/personnel/personnelService.ts

import { db } from '../../infra/db';
import { sql } from 'drizzle-orm';

const LOW_SAMPLE_GAMES = 3;

export async function getPersonnelMetricsForPlayer(
  playerId: string,
  season: number,
  weekStart?: number,
  weekEnd?: number
): Promise<Record<string, number | null>> {
  const result = await db.execute(sql`
    SELECT
      personnel_11_snap_pct,
      personnel_12_snap_pct,
      primary_grouping_snap_pct,
      grouping_versatility_score,
      games_with_personnel_data
    FROM player_personnel_stats
    WHERE player_id = ${playerId}
      AND season = ${season}
      ${weekStart ? sql`AND week >= ${weekStart}` : sql``}
      ${weekEnd ? sql`AND week <= ${weekEnd}` : sql``}
    ORDER BY week DESC
    LIMIT 1
  `);

  if (result.rows.length === 0) {
    return {
      personnel_11_pct: null,
      personnel_12_pct: null,
      personnel_full_time_pct: null,
      personnel_versatility: null,
    };
  }

  const row = result.rows[0] as Record<string, any>;
  const games = parseInt(row.games_with_personnel_data) || 0;

  if (games < LOW_SAMPLE_GAMES) {
    return {
      personnel_11_pct: null,
      personnel_12_pct: null,
      personnel_full_time_pct: null,
      personnel_versatility: null,
    };
  }

  return {
    personnel_11_pct: parseFloat(row.personnel_11_snap_pct) ?? null,
    personnel_12_pct: parseFloat(row.personnel_12_snap_pct) ?? null,
    personnel_full_time_pct: parseFloat(row.primary_grouping_snap_pct) ?? null,
    personnel_versatility: parseFloat(row.grouping_versatility_score) ?? null,
  };
}
```

### 8.2 Engine Integration

We want to add `personnel_full_time_pct` as a **Stability** metric for WR. A player who is on the field for a high percentage of their primary personnel grouping has a more stable/secure role.

**Decision:** Use existing `role_bank` source? No — personnel data lives in its own table. We'll add a new source type.

#### Add MetricSource

```typescript
// forgeEngine.ts — MetricSource union
export type MetricSource =
  | 'snapshot_player_week'
  | 'snapshot_team_context'
  | 'sos_table'
  | 'role_bank'
  | 'qb_alpha'
  | 'recursion'
  | 'derived'
  | 'personnel';   // ← Added
```

#### Add to ForgeContext

```typescript
// forgeEngine.ts — ForgeContext type
export type ForgeContext = {
  // ... existing fields ...
  personnel?: Record<string, number | null>;  // ← Added
};
```

#### Fetch Data

```typescript
// Inside fetchForgeContext() or context builder
import { getPersonnelMetricsForPlayer } from '../personnel/personnelService';

const personnelData = await getPersonnelMetricsForPlayer(playerId, season, weekStart, weekEnd);

return {
  // ... existing context ...
  personnel: personnelData,
};
```

#### Wire Metric Lookup

```typescript
// forgeEngine.ts — createMetricLookup() switch
case 'personnel':
  rawValue = context.personnel?.[metricKey] ?? null;
  break;
```

#### Add Normalization Range

```typescript
// forgeEngine.ts — normalizeMetric() ranges
personnel_full_time_pct: { min: 30, max: 100 },
```

#### Register in WR Stability Pillar

```typescript
// forgeEngine.ts — WR_PILLARS.stability
stability: {
  metrics: [
    { metricKey: 'availability_score',      source: 'derived',   weight: 0.20 },  // Was 0.25
    { metricKey: 'route_stability',         source: 'derived',   weight: 0.20 },  // Was 0.25
    { metricKey: 'snap_floor',              source: 'derived',   weight: 0.15 },  // Was 0.20
    { metricKey: 'depth_chart_insulation',  source: 'derived',   weight: 0.15 },  // Unchanged
    { metricKey: 'qb_continuity',           source: 'derived',   weight: 0.15 },  // Unchanged
    { metricKey: 'personnel_full_time_pct', source: 'personnel', weight: 0.15 },  // ← NEW
  ],
  // Sum: 0.20 + 0.20 + 0.15 + 0.15 + 0.15 + 0.15 = 1.00 ✅
},
```

### 8.3 Verification

After integration, verify with these API calls:

```bash
# 1. Check raw metric appears in transparency view
curl /api/forge/transparency/PLAYER_ID | jq '.rawMetrics.personnel_full_time_pct'

# 2. Check pillar score changed (compare before/after)
curl /api/forge/eg/player/PLAYER_ID?position=WR&mode=redraft | jq '.pillars.stability'

# 3. Verify null handling — use a player with no personnel data
curl /api/forge/eg/player/UNKNOWN_PLAYER?position=WR | jq '.pillars.stability'
# Should still return a valid 0-100 score (from remaining metrics)

# 4. Check batch scoring still works
curl /api/forge/eg/batch?position=WR&mode=redraft&limit=50
# All players should have valid alpha scores
```

### 8.4 Summary of Files Changed

| File | Change |
|------|--------|
| `server/modules/personnel/personnelService.ts` | **New** — data fetching service |
| `server/modules/forge/forgeEngine.ts` | Add `MetricSource`, `ForgeContext` field, `createMetricLookup()` case, normalization range, WR pillar config |
| `server/modules/forge/forgeEngine.ts` | Rebalance WR stability weights |

No changes needed to `forgeGrading.ts` (pillar weights unchanged), `types.ts`, or frontend code.
