# OVR & PlayerCompass Usage Review

> Scope: docs-only usage review of the OVR and PlayerCompass surfaces (issue #250).
> Mirrors the Sentinel audit method: map current usage first, decide cleanup second,
> touch code third. **No runtime changes** in this PR.
> Method note: findings are from static analysis of the repo. The app was **not run**
> and **no database was queried** in this environment, so live row counts and runtime
> rendering were not directly observed; data-source behavior is read from the code paths.
> Date: 2026-06-20

## Summary

Both surfaces are **mounted on the backend but effectively orphaned on the
frontend.** OVR and PlayerCompass each expose multiple live routes, but no
currently-routed page or primary-nav entry consumes them, and there is **zero
automated test coverage**. Several of the richer compute services
(`ovrService`, `ovrEngine`, `ovrCache`, `modules/ovr`) are imported by nobody.
No current core surface (Management, Data Lab, Player/Team Research, Rankings,
FORGE) depends on either surface.

| Question | OVR | PlayerCompass / Compass |
| --- | --- | --- |
| Routes mounted? | **Yes** — `/api/ovr/*` router + inline `ovrEngine` endpoints | **Yes** — live `/api/compass/:position`, bridge, `rb`/`te`-compass, compare, player-compass, several legacy |
| Frontend pages link to them? | Only `HomeTab` → **`TiberDashboard` (not routed)** | Only Compass table components — **imported nowhere** |
| In primary navigation? | **No** | **No** |
| What computes outputs? | `ovrRoutes` (inline), `ovrService`, `ovrEngine`, `sleeperOvrScorer`, `ovrCache`, `modules/ovr` | `playerCompass.ts`, `playerCompassService.ts`, `playerCompassPlayerService.ts`, `rbCompassCalculations`, `predictionEngine` |
| What consumes outputs? | Orphaned `HomeTab`; internal `/api/merged-player-data` self-fetch | Orphaned compass components + dead `apiClient` methods |
| Core-surface dependency? | **None** | **None** (only internal `unifiedPlayerService` pool + legacy `dynastyRoutes`) |
| Live / fallback / sample data? | **Live DB** (but OVR = `avgPoints`); rich engine path orphaned | **Mixed** — live Sleeper path + **hardcoded sample** legacy paths |
| Test coverage? | **None** | **None** |

## 1–2. Routes mounted

### OVR
| Route | Source | Notes |
| --- | --- | --- |
| `GET /api/ovr` | `routes/ovrRoutes.ts` (mounted `routes.ts:2879`) | Live; top-150 from `players` table; OVR = rounded `avgPoints` w/ `calculateSimpleOVR` fallback |
| `GET /api/ovr/health` | `ovrRoutes.ts` | DB player counts |
| `GET /api/ovr/:playerId` | `ovrRoutes.ts` | Single player |
| `POST /api/ovr/seed`, `/update`, `GET /player/:id`, `POST /compass`, `GET /health` | inline `routes.ts:4751-4861` | Backed by in-memory `ovrEngine` state (manually seeded; empty by default) |
| `GET /api/rankings-deprecated` (ratings) | `routes.ts:820` | **Deprecated**, points users to `/api/ovr` |

### Compass
| Route | Source | Notes |
| --- | --- | --- |
| `GET /api/compass/:position` | `registerCompassRoutes` (`routes.ts:2024`) | **Live** Sleeper-synced; `PlayerCompassService` (`server/playerCompass.ts`); LRU-cached |
| `GET /api/compass/WR` (bridge) | `routes.ts:2615` | Proxies to live `/api/compass/wr` |
| `GET /api/player-compass/players` | `routes.ts:4049` | **Hardcoded sample data** (`SAMPLE_COMPASS_PLAYERS`) |
| `GET /api/compass-legacy/:position` | `routes.ts:2031` | **Hardcoded sample** (`getSamplePlayersForCompass`) |
| `GET /api/compass/rb/legacy` | `routes.ts:2103` | Kimi-K2 RB methodology |
| `app.use('/api/rb-compass')`, `/api/te-compass` | `routes.ts:2349-2350` | Mounted position routers |
| `app.use('/api/compass-compare')` | `routes.ts:2739` | Compare routes |
| `app.use('/api/predictions')` | `createCompassRouter()` `routes.ts:2742` | Prediction-engine compass router |
| `GET /api/compass-legacy-algorithm/:position` | `routes.ts:869` | **Deprecated** stub |

**Dead route files:** `compassWrRoute.ts`, `compassQbRoute.ts`, `compassRbRoute.ts`,
`compassTeRoute.ts` exist but are **not imported or mounted** anywhere. The live
`/api/compass/:position` handles all four positions.

## 3–4. Frontend consumers & navigation

- **OVR:** `client/src/components/tabs/HomeTab.tsx` queries `/api/ovr?format=redraft&limit=3`.
  HomeTab is only used by `client/src/pages/TiberDashboard.tsx` — and **`TiberDashboard`
  is never imported or routed in `App.tsx`** (the router mounts a different
  `@/pages/Dashboard`, which does not reference OVR). So OVR has **no reachable
  frontend consumer**.
- **Compass:** `WRCompass.tsx`, `WRCompassTable.tsx`, `RBCompassTable.tsx`,
  `QBCompassTable.tsx`, `TECompassTable.tsx`, `PositionCompassTable.tsx` all call
  `/api/compass/*` — but **none of these components is imported by any page**.
- **Dead client API methods:** `apiClient.compassPos`, `compassPlayer`,
  `compassWRLegacy` are defined but called nowhere. `compassPlayer` even targets
  `GET /api/compass/player/:id`, which **does not exist on the backend**.
- **Primary navigation:** `TiberLayout.tsx` has **no** OVR/Compass/ratings entry.
  Neither surface is reachable through the app shell.

## 5. What computes outputs

- **OVR:** `ovrRoutes.ts` (trivial inline calc), plus the richer-but-**orphaned**
  `services/ovrService.ts`, `services/ovrEngine.ts`, `services/ovrCache.ts`,
  `services/sleeperOvrScorer.ts`, and `modules/ovr/ovrForgeAdapter.ts`
  (`getOvrForgeSnapshot`/`getOvrForgeScoreForPlayer`). Confirmed import check:
  `ovrService`, `ovrCache`, and `modules/ovr` are imported by **no other module**.
- **Compass:** two distinct `PlayerCompassService` classes exist —
  `server/playerCompass.ts` (used by the live route) and
  `server/services/playerCompassService.ts` (used by legacy/internal paths) —
  plus `playerCompassPlayerService.ts`, `rbCompassCalculations.ts`, and
  `predictionEngine.createCompassRouter`.

## 6–7. What consumes outputs / core-surface dependencies

- No routed page calls `/api/ovr` or `/api/compass`.
- Internal-only couplings (not core product surfaces):
  - `services/unifiedPlayerService.ts` imports `PlayerCompassService` and backs the
    `/api/players` pool endpoints (`routes.ts:4551`).
  - `routes/dynastyRoutes.ts` (`/api/dynasty*`) instantiates `PlayerCompassService`.
  - `server/routes.ts` internal `/api/merged-player-data` self-fetches `/api/ovr`.
  - A separate **inline** OVR scaling exists in the NFLfastR rankings endpoint
    (`routes.ts:~1164`) — unrelated to the OVR module; it just maps composite EPA → 1-99.
- **Management, Data Lab labs, Player Research, Team Research, current Rankings
  (`/tiers` + FORGE) do not import or call OVR or PlayerCompass.**

## 8. Data behavior

| Path | Behavior |
| --- | --- |
| `/api/ovr` | **Live DB** (`players` table), but "OVR" is just rounded `avgPoints` (or position-baseline fallback) — not the rich engine |
| `/api/ovr/seed\|update\|player\|compass` | **In-memory** `ovrEngine` state; empty unless seeded at runtime |
| `/api/compass/:position` (+ WR bridge) | **Live** Sleeper-synced data |
| `/api/player-compass/players` | **Hardcoded sample** (`SAMPLE_COMPASS_PLAYERS`; code comment: "will integrate with actual PlayerCompassService") |
| `/api/compass-legacy/:position` | **Hardcoded sample** (`getSamplePlayersForCompass`, 2024 stat lines) |

## 9. Test coverage

**None.** No `*.test.ts(x)` under `server/`, `client/`, or `shared/` references
`ovr` or `compass`.

## 10. Recommendation (next step per surface)

Suggested status for both: **`DORMANT_BACKEND` — keep behind a decision gate, do not
expand.** Both are real and partially live, but neither is wired to a reachable UI or
a core surface, so neither should be treated as load-bearing.

### OVR
**Freeze and consolidate.** Pick the canonical path before any cleanup:
1. Decide whether OVR is superseded by FORGE Alpha (the live ratings system). If so,
   schedule the orphaned compute (`ovrService`, `ovrEngine`, `ovrCache`, `modules/ovr`)
   and dead `/api/ovr/seed|update|...` endpoints for a later deletion PR.
2. If OVR is kept, either (a) route `TiberDashboard`/`HomeTab` (or move the OVR widget
   into a routed page), or (b) document `/api/ovr` as internal/admin-only.
3. Remove or formally deprecate `/api/rankings-deprecated`.

### PlayerCompass / Compass
**Freeze and de-duplicate.** Before cleanup:
1. Confirm the live `/api/compass/:position` is the single source of truth, then plan
   removal of the unmounted route files (`compass{Wr,Qb,Rb,Te}Route.ts`) and the dead
   `apiClient` methods (`compassPos`, `compassPlayer`, `compassWRLegacy`).
2. Resolve the duplicate `PlayerCompassService` classes
   (`server/playerCompass.ts` vs `server/services/playerCompassService.ts`).
3. Replace or retire the **sample-data** endpoints (`/api/player-compass/players`,
   `/api/compass-legacy/:position`) so no surface can ship hardcoded 2024 stats.
4. If Compass is kept as a product surface, wire one of the existing table components
   into a routed page + nav; otherwise mark the components for removal.

### Cross-cutting follow-ups (each a separate, later PR — out of scope here)
- Add at least one route smoke test for `/api/ovr` and `/api/compass/:position`.
- Add OVR and Compass entries to the API registry / API Lexicon, or document them as
  internal, to match the Sentinel-audit follow-up pattern.
