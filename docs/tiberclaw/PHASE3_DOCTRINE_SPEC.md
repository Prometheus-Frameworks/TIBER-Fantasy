# Phase 3 — Doctrine Layer Spec
**For: Claude Code / Codex**
**Status: Ready to implement**
**Commit baseline: `784d8c72` (main)**

---

## What You Are Building

Five TypeScript modules in `server/doctrine/`. Each module consumes Tiber engine scores and league context via authenticated HTTP calls, applies dynasty-specific reasoning, and returns a `DoctrineEvaluation` object. That evaluation object is the only thing that ever reaches the LLM gateway — raw metrics never do.

No frontend. No new routes in this phase. No schema changes. Pure TypeScript logic files.

---

## What Is Already Live (Do Not Rebuild)

| System | Status | Where |
|---|---|---|
| `x-tiber-key` auth | Live | All `/api/v1/*` endpoints |
| FORGE scoring | Live | `GET /api/v1/forge/player/:id`, `POST /api/v1/forge/batch` |
| FIRE scoring | Live | `GET /api/v1/fire/player/:id`, `GET /api/v1/fire/batch` |
| Player search | Live | `GET /api/v1/players/search?name=...` |
| League context | Live | `GET /api/v1/league/:id/context` |
| League picks | Live | `GET /api/v1/league/:id/picks` |
| Scoring profile | Live | `GET /api/v1/league/:id/scoring` |
| LLM gateway | Live | `server/llm/` — `callLLM()` entry point |
| `server/doctrine/` directory | Created | Empty, ready for your files |

---

## Output Contract — DoctrineEvaluation

Every module must return this exact shape. No exceptions.

```typescript
// server/doctrine/types.ts  ← your first file

export type DoctrineEntityType =
  | 'player'
  | 'roster'
  | 'trade'
  | 'pick'
  | 'window';

export interface ContributingSignal {
  name: string;
  value: number | string;
  weight: number;    // 0–1, how much this signal moved the score
  direction: 'positive' | 'negative' | 'neutral';
}

export interface DoctrineEvaluation {
  module: string;                      // e.g. 'positional_aging_curves'
  entity_type: DoctrineEntityType;
  entity_id: string;                   // player gsis_id, roster external_id, etc.
  evaluation_score: number;            // 0–1 (0 = very bad signal, 1 = very good signal)
  confidence: number;                  // 0–1 (data completeness + model certainty)
  contributing_signals: ContributingSignal[];
  reasoning: string;                   // 1–3 sentence plain-English summary
  generated_at: string;                // ISO timestamp
  meta?: Record<string, unknown>;      // optional module-specific extras
}
```

`evaluation_score` interpretation per module:

| Module | Score = 1.0 | Score = 0.0 |
|---|---|---|
| `positional_aging_curves` | Peak prime production window | Steep cliff decline |
| `team_window_detection` | Championship window open | Clearly in rebuild |
| `asset_insulation_model` | Player fully insulated from scheme risk | Single point of failure |
| `league_market_model` | Player significantly undervalued vs. peers | Severely overvalued |
| `roster_construction_heuristics` | Textbook dynasty roster balance | Critical structural flaw |

---

## HTTP Calls Available to Doctrine Modules

All calls require header `x-tiber-key: <key>`. The key is available at `process.env.TIBER_API_KEY`.
Base URL: `http://localhost:${process.env.PORT ?? 5000}`.

### Player Data
```
GET /api/v1/players/search?name={name}
→ { players: [{ gsis_id, full_name, position, nfl_team, is_active }] }

GET /api/v1/forge/player/{gsis_id}?mode=dynasty&season=2025
→ {
    player_id, player_name, position,
    alpha: number,          // 0–100 unified FORGE score
    tier: string,           // 'Elite' | 'Starter' | 'Flex' | 'Bench' | 'Handcuff'
    pillars: {
      volume: number,       // 0–100
      efficiency: number,   // 0–100
      team_context: number, // 0–100
      stability: number     // 0–100
    },
    dynasty_adjustments: { age_penalty: number, ... }
  }

POST /api/v1/forge/batch
Body: { player_ids: string[], mode: "dynasty" }
→ { results: [<same shape as above>] }

GET /api/v1/fire/player/{gsis_id}
→ {
    player_id,
    opportunity_score: number,  // rolling 4-week
    role_score: number,
    xfpts_delta: number         // expected vs. actual FPTs
  }
```

### League Context
```
GET /api/v1/league/{leagueId}/context
→ {
    league: { id, league_name, platform, external_league_id, season, scoring_format },
    scoring_profile: {
      format: 'ppr' | 'half_ppr' | 'standard' | 'custom',
      rec_multiplier: number,
      te_premium: number,
      bonus_rec_te: number,
      pass_td_pts: number,
      rush_td_pts: number,
      rec_td_pts: number,
      dynasty_relevant: boolean
    },
    teams: [{ id, display_name, external_roster_id, external_user_id, is_commissioner }],
    picks_count: number
  }

GET /api/v1/league/{leagueId}/picks
→ {
    league_id, season,
    picks: [{
      id, season, round, source,
      original_roster_id, current_roster_id,
      original_team: { id, display_name } | null,
      current_team: { id, display_name } | null,
      synced_at
    }]
  }

GET /api/v1/league/{leagueId}/scoring
→ { league_id, league_name, season, scoring_profile }
```

---

## The Five Modules

Build in this order — each one informs the next.

---

### Module 1 — `types.ts`

Define the shared contract. Export:
- `DoctrineEvaluation` interface (above)
- `DoctrineEntityType` union
- `ContributingSignal` interface
- `DoctrineError` class (extends Error, carries `module` and `entity_id`)
- `makeEvaluation(partial: Partial<DoctrineEvaluation>): DoctrineEvaluation` — fills defaults and stamps `generated_at`

No external calls. No async.

---

### Module 2 — `positional_aging_curves.ts`

**Purpose:** Given a player's age and position, score how far through their production window they are.

**Export:**
```typescript
export async function evaluateAgingCurve(
  playerId: string,    // gsis_id
  playerAge: number,   // decimal age e.g. 27.4
  position: 'QB' | 'RB' | 'WR' | 'TE',
  forgeAlpha: number,  // current FORGE dynasty alpha, 0–100
  apiKey: string,
  baseUrl: string
): Promise<DoctrineEvaluation>
```

**Aging curve constants (embed directly):**
```typescript
const PRIME_WINDOWS = {
  QB:  { peak: [26, 33], cliff: 36 },
  RB:  { peak: [22, 26], cliff: 28 },
  WR:  { peak: [24, 29], cliff: 32 },
  TE:  { peak: [25, 30], cliff: 33 },
};

const AGE_DECAY_RATE = {
  QB:  0.03,   // 3% alpha decay per year past cliff
  RB:  0.08,
  WR:  0.05,
  TE:  0.04,
};
```

**Scoring logic:**
- Age within `peak` range → base score 0.75–1.0 scaled by FORGE alpha
- Age between peak end and cliff → linearly decays to 0.35
- Age past cliff → apply `AGE_DECAY_RATE` per year, floor at 0.05
- FORGE alpha above 70 adds up to +0.15 confidence (elite players age better)
- FORGE alpha below 40 subtracts confidence (-0.1)

**Contributing signals:** `age`, `position`, `years_from_peak`, `forge_alpha`, `prime_window_status`

---

### Module 3 — `team_window_detection.ts`

**Purpose:** Evaluate whether a dynasty team is in a championship window, rebuilding, or transitioning.

**Export:**
```typescript
export async function detectTeamWindow(
  leagueId: string,
  rosterId: string,         // external_roster_id from league context
  playerIds: string[],      // gsis_ids on this roster
  apiKey: string,
  baseUrl: string
): Promise<DoctrineEvaluation>
```

**Logic:**
1. Call `POST /api/v1/forge/batch` with all `playerIds`, `mode: "dynasty"`
2. Compute roster-level signals:
   - `elite_count`: players with FORGE alpha ≥ 70
   - `starter_count`: players with alpha 50–69
   - `median_alpha`: median of all alpha scores
   - `age_weighted_alpha`: sum(alpha × (1 - age_decay_factor)) / n — weight each player by how much prime window remains (use aging curve constants from Module 2)
   - `top3_alpha`: average of the three highest alpha scores
3. Score formula:
   - Base: `age_weighted_alpha / 100`
   - `elite_count >= 2` → +0.15
   - `elite_count === 0` → -0.20
   - `top3_alpha < 45` → -0.15 (no core)
   - `median_alpha < 35` → -0.10 (weak depth)
   - Clamp result to [0, 1]
4. Classify window:
   - Score ≥ 0.70 → `'championship_window'`
   - Score 0.45–0.69 → `'transitioning'`
   - Score < 0.45 → `'rebuild'`

**entity_id:** `rosterId`
**entity_type:** `'roster'`
**meta:** include `{ window_classification, elite_count, starter_count, median_alpha, age_weighted_alpha }`

---

### Module 4 — `asset_insulation_model.ts`

**Purpose:** Score how insulated a player's value is from scheme changes, injury risk, and role competition. High score = durable value. Low score = single point of failure.

**Export:**
```typescript
export async function evaluateAssetInsulation(
  playerId: string,       // gsis_id
  position: 'QB' | 'RB' | 'WR' | 'TE',
  apiKey: string,
  baseUrl: string
): Promise<DoctrineEvaluation>
```

**Logic:**
1. Fetch FORGE player: alpha, pillars (volume, efficiency, team_context, stability), tier
2. Fetch FIRE player: opportunity_score, role_score, xfpts_delta
3. Compute insulation signals:
   - `scheme_independence`: `efficiency / 100` — efficient players survive scheme changes better than volume-dependent ones
   - `role_security`: `(role_score / 100) * 0.6 + (stability / 100) * 0.4`
   - `opportunity_durability`: `opportunity_score / 100` — consistent opportunity = insulated from snap-count risk
   - `team_dependency`: `1 - (team_context / 100)` — high team_context score means value is tied to that team's success; inverted here because a player insulated from team context is safer
4. Weighted score:
   ```
   score = (scheme_independence * 0.30)
         + (role_security * 0.35)
         + (opportunity_durability * 0.25)
         + ((1 - team_dependency) * 0.10)
   ```
5. Position modifier:
   - RB: multiply score by 0.85 (structurally fragile asset class)
   - TE: multiply by 1.05 (positional scarcity provides insulation)
   - QB: multiply by 1.10 (franchise players are scheme-independent)
   - WR: no modifier

**Contributing signals:** `scheme_independence`, `role_security`, `opportunity_durability`, `team_dependency`

---

### Module 5 — `league_market_model.ts`

**Purpose:** Compare a player's FORGE score against their implied market value within the specific league. Surfaces undervalued and overvalued assets.

**Export:**
```typescript
export async function evaluateMarketPosition(
  playerId: string,
  leagueId: string,
  allLeaguePlayerIds: string[],   // full pool to compare against (all rostered players)
  apiKey: string,
  baseUrl: string
): Promise<DoctrineEvaluation>
```

**Logic:**
1. Fetch FORGE for target player and batch FORGE for the full pool
2. Compute position-group percentile rank: where does this player rank among same-position players in the league?
   - `position_rank_pct`: 0 = worst in position group, 1 = best
3. Compute `alpha_zscore`: (player_alpha - position_mean_alpha) / position_std_alpha
4. Estimate implied market value tier based on position rank:
   - Top 3 at position → "premium"
   - Top 6 → "starter"
   - Top 10 → "flex"
   - Below → "bench/handcuff"
5. Compare implied tier vs. FORGE tier. Mismatches surface market inefficiencies:
   - FORGE tier > implied tier → undervalued (score > 0.6)
   - FORGE tier < implied tier → overvalued (score < 0.4)
   - Match → neutral (score around 0.5)
6. Scoring:
   ```
   base = 0.5
   base += (position_rank_pct - 0.5) * 0.6    // position rank shifts base
   base += clamp(alpha_zscore * 0.1, -0.2, 0.2) // z-score refines
   score = clamp(base, 0, 1)
   ```

**Contributing signals:** `position_rank_pct`, `alpha_zscore`, `implied_market_tier`, `forge_tier`, `player_alpha`, `position_mean_alpha`

---

### Module 6 — `roster_construction_heuristics.ts`

**Purpose:** Evaluate the structural health of a dynasty roster. Are they balanced, overloaded at one position, thin on depth, or missing a key asset class?

**Export:**
```typescript
export async function evaluateRosterConstruction(
  leagueId: string,
  rosterId: string,
  playerIds: string[],      // all gsis_ids on this roster
  scoringProfile: ScoringProfile,  // from GET /api/v1/league/:id/scoring
  picks: PickRecord[],      // from GET /api/v1/league/:id/picks
  apiKey: string,
  baseUrl: string
): Promise<DoctrineEvaluation>
```

Where `ScoringProfile` and `PickRecord` are defined in `types.ts` (pull from the league endpoint response shapes).

**Logic:**
1. Batch FORGE for all players
2. Compute positional distribution:
   - `qb_count`, `rb_count`, `wr_count`, `te_count`
   - `qb_elite` (alpha ≥ 70), `rb_elite`, `wr_elite`, `te_elite`
3. Compute position scores:
   - QB score: `min(qb_elite, 1) * 0.5 + min(qb_count / 2, 1) * 0.5`
   - RB score: `min(rb_elite / 2, 1) * 0.6 + min(rb_count / 6, 1) * 0.4`
   - WR score: `min(wr_elite / 3, 1) * 0.6 + min(wr_count / 8, 1) * 0.4`
   - TE score: if `scoringProfile.te_premium > 0`: weight TE at 0.15, else 0.08
4. Pick capital score:
   - First-round picks (rounds 1): `+0.05` per pick owned (cap at +0.15)
   - Second-round picks: `+0.02` per pick (cap at +0.10)
   - No picks at all: `-0.10`
5. Weighted roster score:
   ```
   score = (qb_score * 0.15)
         + (rb_score * 0.25)
         + (wr_score * 0.35)
         + (te_score * (te_premium > 0 ? 0.15 : 0.08))
         + pick_capital_score
   ```
   Clamp to [0, 1]
6. Identify the lowest-scoring component and name it in `reasoning`.

**Contributing signals:** `qb_score`, `rb_score`, `wr_score`, `te_score`, `pick_capital_score`, `roster_size`, `elite_count`

---

## File Structure to Deliver

```
server/doctrine/
  types.ts
  positional_aging_curves.ts
  team_window_detection.ts
  asset_insulation_model.ts
  league_market_model.ts
  roster_construction_heuristics.ts
```

No `index.ts` barrel needed yet — Phase 4 will wire these into routes.

---

## Rules

1. **LLM Boundary**: These modules must never call `callLLM()`. They return `DoctrineEvaluation`. The LLM receives the evaluation — it does not produce it.

2. **No raw metrics to LLM**: FORGE alpha is never passed directly to a prompt. Pass the `DoctrineEvaluation` reasoning string.

3. **HTTP not import**: Doctrine modules call the v1 endpoints over HTTP (`fetch`). They do not import from FORGE/FIRE source files. This preserves the layer boundary.

4. **No schema changes**: Phase 3 adds zero new DB tables. All data comes from existing endpoints.

5. **No new routes**: Phase 3 is pure logic. Route wiring happens in Phase 4.

6. **Non-fatal on partial data**: If a player's FORGE data is missing, reduce `confidence` proportionally and continue. Never throw for missing data.

7. **TypeScript strict mode compatible**: No `any` types except at HTTP response boundaries. Use the interfaces in `types.ts`.

8. **Each file exports exactly one primary function** plus any helpers it needs internally.

---

## Verification

Once all six files are written, confirm by importing and calling each function with a sample `gsis_id` and `leagueId`. The active API key for testing is in `process.env.TIBER_API_KEY`. A real Sleeper league ID to use: `a15b00f5-7475-4922-8ba0-762e163fbe20` (Fifa Ballerz Dynasty, PPR, 2025 season).
