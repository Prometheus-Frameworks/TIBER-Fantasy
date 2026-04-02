# TIBER Rankings v2 Definition (Spec / Audit)

**Status:** Draft architecture + product definition (spec-first, no ranking rebuild in this PR).

## 1) Current-state diagnosis

### What users currently see when opening Rankings

- The primary user path is **Home → “Open Rankings” → `/tiers`**. In routing, `/rankings` currently hard-redirects to `/tiers`. That means “Rankings” as a concept is effectively represented by the `TiberTiers` page today, not a broader rankings product system.  
- `TiberTiers` itself is explicitly framed as **“Tiber Tiers”** and fetches `/api/forge/tiers` (cached FORGE outputs by position/week), then renders a table with alpha, tier, pillars, confidence, and issues.  

### Why this is outdated/incomplete

- The UI framing and route alias imply one coherent “Rankings” product, but the codebase contains multiple independent ranking stacks (`/api/forge/tiers`, `/api/rankings*`, `/api/power/*`, deprecated `/api/tiber/rankings`, admin sandbox routes) with different semantics and quality levels.
- Some ranking endpoints are explicitly temporary/sample/hardcoded (“consensus not working”, “force Grok system”), which conflicts with a canonical product claim.
- Multiple ranking-oriented pages/components exist but are **not mounted in current app routes** (`/rankings/wr`, `/rankings/rb`, `/rankings-hub` style surfaces), so the system has partial/orphaned ranking surfaces.

### Where ranking logic is fragmented in-repo

1. **Canonical-visible path:** `/tiers` + `/api/forge/tiers`.
2. **Legacy generic ranking APIs:** `/api/rankings`, `/api/rankings/redraft|dynasty|qb|rb|wr|te`, `/api/redraft/rankings`.
3. **Power rankings lane:** `/api/power/:type`, `/api/power/player/:id`, `/api/power/health`, plus `/api/rankings/stats/:type` alias logic.
4. **OTC final/consensus lane:** `/api/rankings/otc-final`, `/api/consensus/*`.
5. **Admin sandbox lane:** `/api/admin/*-rankings-sandbox` and corresponding admin pages.
6. **Deprecated legacy lane:** `/api/tiber/rankings` route set marked deprecated and intended to sunset.

### Why “rankings” is currently overloaded/misleading

“Rankings” currently means different things depending on route:
- cached FORGE alpha tiers,
- weekly EPA + usage composite table,
- sample/fallback consensus tables,
- power-rank tables from static/hardcoded lists,
- experimental sandbox formulas,
- deprecated TIBER score tables.

So “rankings” is not a single product contract right now; it is a shared label across mixed maturity surfaces.

---

## 2) Current ranking surface inventory

| Surface | File / endpoint path | Current role | Current data source | Product status | Recommendation | Why |
|---|---|---|---|---|---|---|
| Rankings entry CTA | `client/src/pages/Dashboard.tsx` (`Open Rankings` → `/tiers`) | Primary user entry | Navigation only | CANONICAL (entry) | KEEP | It points to the only coherent public rankings surface. |
| Rankings alias route | `client/src/App.tsx` (`/rankings` → `/tiers`) | Backward-compatible alias | Redirect only | CANONICAL (alias) | KEEP | Good compatibility bridge while v2 is defined. |
| Tiber Tiers page | `client/src/pages/TiberTiers.tsx` | Current visible rankings page | `/api/forge/tiers` | CANONICAL (current) | REPLACE (via v2 rebuild path) | It is the real production surface today, but still branded/structured as old “tiers-first” rather than explicit rankings modes. |
| FORGE tiers API | `server/modules/forge/routes.ts` (`GET /api/forge/tiers`) | Backing API for visible rankings | `forge_grade_cache` cache read (`getGradesFromCache`) | CANONICAL (current) | KEEP as v2 base contract seed | Most stable existing contract for visible user rankings. |
| Tiers neighbors API | `server/routes.ts` (`GET /api/tiers/neighbors`) | Player-page “around this player” context | `tiersNeighborsService` / metric matrix integration | CANONICAL supporting | KEEP | Useful explainability adjacency surface, should align with v2 rank identity. |
| Player-page tiers back-link | `client/src/pages/PlayerPage.tsx` | Navigates user back to tiers | `/tiers` + `/api/tiers/neighbors` | CANONICAL supporting | KEEP | Existing dependency on tiers as the live rankings spine. |
| FORGE landing “Enter FORGE” | `client/src/pages/ForgeLanding.tsx` | Marketing/engine entry to rankings | Link to `/tiers` | CANONICAL supporting | KEEP | Fine as discoverability into canonical route. |
| Legacy generic rankings API | `server/routes.ts` (`GET /api/rankings`) | DB-driven weekly ranking table | `silver_player_weekly_stats` with composite scoring | LEGACY | HIDE/FOLD | Different scoring semantics and not the product-facing route users see. |
| Mode-specific generic APIs | `server/routes.ts` (`/api/rankings/redraft|dynasty|qb|rb|wr|te`) | Older rankings endpoints | `getRankings()` helper + Sleeper fallback/sample list | LEGACY | HIDE/FOLD | Mixed fallback/sample behavior; no explicit v2 trust contract. |
| API-client style redraft API | `server/routes.ts` (`GET /api/redraft/rankings`) | Alternate compatibility endpoint | `getRankings('redraft')` path | LEGACY | FOLD into v2 contract later | Duplicative with generic rankings lane. |
| OTC final rankings API | `server/routes.ts` (`GET /api/rankings/otc-final`) | “Authoritative” endpoint label | Hardcoded sample list fallback | LEGACY | HIDE | Endpoint claims final authority but currently returns sample data. |
| Rankings stats alias | `server/routes.ts` (`GET /api/rankings/stats/:type`) | Alias for power-style rankings | `power_ranks` query + forced fallback | LEGACY | HIDE | Adds naming confusion (`rankings` alias over power logic). |
| Power rankings API | `server/routes.ts` (`GET /api/power/:type`) | Separate rankings product lane | DB query but forced hardcoded Week 1 style fallback | EXPERIMENTAL | KEEP INTERNAL_ONLY for now | Useful as separate experimentation lane, not safe canonical user rankings. |
| Power player history API | `server/routes.ts` (`GET /api/power/player/:id`) | Player trend history | `player_week_facts` + players join | EXPERIMENTAL | KEEP INTERNAL_ONLY | Potentially useful metadata, but separate from current canonical rankings. |
| Power health API | `server/routes.ts` (`GET /api/power/health`) | Health diagnostics | `player_week_facts`, `power_ranks` counts | INTERNAL_ONLY | KEEP | Operational endpoint. |
| Power processing APIs | `server/routes/powerProcessing.ts` (`POST /api/power/process`, health) | Tool-assisted ranking generation | Internal + hardcoded consensus arrays + external call flow | EXPERIMENTAL | KEEP INTERNAL_ONLY | Explicitly process/experiment-oriented; not user-facing canonical. |
| Deprecated TIBER rankings API | `server/routes/tiberRoutes.ts` (`GET /api/tiber/rankings`) | Old TIBER score ranking endpoint | `tiber_scores` + identity joins | LEGACY | HIDE then SUNSET | Marked deprecated in-file, successor points to `/api/v1/*`. |
| Admin WR/RB/TE/QB sandbox APIs | `server/routes.ts` (`/api/admin/*-rankings-sandbox`) | Formula experiments | Position-specific sandbox calculations | INTERNAL_ONLY | KEEP INTERNAL_ONLY | Valuable R&D, not production rankings contract. |
| Admin sandbox pages | `client/src/pages/WRRankingsSandbox.tsx`, `client/src/pages/QBRankingsSandbox.tsx` | UI to run sandbox formulas | `/api/admin/*-rankings-sandbox` | INTERNAL_ONLY | KEEP + clearly label | Correctly admin-scoped in routes today. |
| ForgeHub links to `/rankings/wr|rb|te|qb` | `client/src/pages/admin/ForgeHub.tsx` | Admin shortcuts to positional rankings pages | Links only | UNCLEAR | REPLACE/FIX links | Linked routes are not mounted in current `App.tsx`; creates dead-path confusion. |
| Unmounted ranking pages | `client/src/pages/WRRankings.tsx`, `RBRankings.tsx`, `RankingsHub.tsx` | Alternate ranking UIs | sandbox + forge batch APIs | LEGACY/UNCLEAR | HIDE or fold selectively | Useful historical work but not in active router; treat as non-canonical until intentionally reintroduced. |
| Consensus API family | `server/routes.ts` + `server/consensus*.ts` (`/api/consensus/*`) | Consensus board workflows | `consensus_board`, `consensus_meta`, command/seed routes | EXPERIMENTAL | KEEP as separate lane | Important signal source layer, but not equivalent to canonical user rankings surface. |

---

## 3) Definition: what Rankings should mean on TIBER

## TIBER Rankings v2 (product definition)

**Rankings on TIBER = a decision surface, not just a sorted table.**

Every v2 ranking output must declare:

1. **Lens** (what decision it is for)  
   - Example: weekly lineup optimization vs long-horizon asset value.
2. **Time horizon** (how far forward the signal is intended to hold)  
   - Example: this week, rest-of-season, multi-year.
3. **Source stack** (which signal layers were used)  
   - Must be explicit and machine-readable.
4. **Explanation spine** (why placement happened)  
   - Must include pillar/category-level explanation objects.
5. **Trust semantics**  
   - Freshness (`asOf`), confidence, and stability/volatility tags.

### Candidate ranking modes for v2

1. **Weekly (build first)**
   - **Lens:** start/sit + short-horizon lineup decisions.
   - **Horizon:** next matchup window (week-scoped).
   - **Buildability now:** **Yes** (existing FORGE + matchup/env + cache patterns already present).

2. **Rest of Season (ROS)**
   - **Lens:** medium-horizon roster optimization.
   - **Horizon:** remainder of current season.
   - **Buildability now:** **Partial** (some inputs exist; contract needs explicit accumulation/forward assumptions).

3. **Dynasty**
   - **Lens:** long-horizon asset value.
   - **Horizon:** multi-season.
   - **Buildability now:** **Partial** (there are dynasty references and weights, but current visible canonical page is not mode-explicit).

4. **Rookie**
   - **Lens:** incoming/early-career valuation.
   - **Horizon:** draft + early development windows.
   - **Buildability now:** **Partial to Yes** as a separate promoted board (`/rookies`), but should not be faked into weekly rankings without explicit lensing.

5. **Best Ball (defer for now)**
   - **Lens:** spike-week portfolio value.
   - **Horizon:** season tournament format.
   - **Buildability now:** **Not honest yet as canonical mode** (do not expose as “done” until explanation + volatility semantics are real).

---

## 4) Allowed input layers for Rankings v2

Rankings v2 can consume these input classes:

1. **Player performance + role layer (required baseline)**
   - Production, usage, efficiency, role stability, workload shape.
2. **FORGE-derived layer (required in v2 phase 1)**
   - Alpha/tier + subscore pillars + confidence/trajectory-like metadata.
3. **Context layer (allowed with explicit weighting)**
   - Team environment, matchup context, schedule context (when available and declared).
4. **Promoted artifact layer (allowed as additive context)**
   - Breakout/role/ARC/scenario outputs as explanatory context, **not hidden replacement scoring unless contract says so**.
5. **Confidence / stability layer (required)**
   - Freshness timestamps, sample sufficiency, volatility/stability indicators.
6. **Consensus / market layer (optional additive)**
   - Allowed as comparison or override policy only if explicitly declared.

### Team State policy (important)

- Team State in TIBER-Fantasy is currently a **read-only consumer boundary** (`/api/data-lab/team-state`) for upstream artifacts.
- For v2 phase 1, Team State should be **explanatory/annotation-first**, not a mandatory hard ranking driver.
- Team State-driven re-ranking should be deferred until:
  - artifact reliability and refresh cadence are stable,
  - weighting policy is explicit,
  - and confidence semantics can show when Team State materially moved a rank.

### Explicit exclusions for first v2 build

- No hidden hardcoded samples/fallback rankings presented as canonical.
- No blending lanes that do not expose source/freshness/confidence.
- No silent mode switching between weekly/dynasty semantics.

---

## 5) Explanation spine

A v2 ranking item should carry an explanation envelope like:

- **Lens:** weekly / ROS / dynasty / rookie.
- **Placement summary:** short sentence on why this rank band.
- **Pillars:**
  - talent / efficiency,
  - role / usage,
  - team environment,
  - sustainability / fragility,
  - volatility / confidence.
- **Context adjustments:** matchup/schedule/team-state-like adjustments with directionality and magnitude where possible.
- **Trust block:** freshness timestamp, sample quality, confidence band, and caveat flags.

This transforms rankings from “table rows” into “decision objects.”

---

## 6) First honest rebuild path

### Phase 1 — Classify + isolate legacy surfaces

- Keep `/tiers` live as current canonical user ranking entry.
- Mark non-canonical ranking lanes as `LEGACY`, `EXPERIMENTAL`, or `INTERNAL_ONLY` in docs and endpoint descriptions.
- Remove/fix dead links (e.g., ForgeHub links to unmounted `/rankings/*` pages).

### Phase 2 — Define one canonical rankings contract

- Introduce a single explicit v2 contract shape for public rankings responses:
  - `mode`, `lens`, `horizon`, `asOf`, `sourceStack`, `items[]`, `explanation`, `trust`.
- Keep old endpoints during migration but route public UI only through canonical contract.

### Phase 3 — Rebuild one visible mode first (Weekly)

- Implement weekly mode first on one visible route (likely `/tiers` replacement or `/rankings` canonical route).
- Use existing FORGE cache + context layers with explicit trust/freshness semantics.

### Phase 4 — Attach explanation metadata

- Add item-level explanation spine fields and surface them in UI (without huge redesign).
- Make “why here” inspectable from rank row.

### Phase 5 — Add advanced context carefully

- Integrate Team State and broader promoted artifacts as declared additive layers once readiness and weighting are proven.
- Expand to ROS/Dynasty only after weekly mode contract is stable and trusted.

---

## 7) Explicit deferrals

Intentionally out of scope for first Rankings v2 rebuild:

- Full scenario integration as rank-driving logic.
- Fully opponent-adjusted all-surface systems.
- Full Team State-driven re-ranking.
- Consensus blending as opaque rank driver.
- Best-ball canonical mode launch.
- Large UI redesign across the app.
- Rewriting every legacy endpoint in one pass.

---

## Practical next implementation task (after this spec)

**Recommended next PR:**

1. Add a small canonical rankings contract definition (schema/types + endpoint doc),
2. classify existing ranking endpoints in-code with explicit status tags/comments,
3. fix dead admin links to unmounted ranking routes,
4. wire one weekly canonical route behind the current `/tiers` UI path without changing ranking math yet.

This keeps the next step small, honest, and directly executable.
