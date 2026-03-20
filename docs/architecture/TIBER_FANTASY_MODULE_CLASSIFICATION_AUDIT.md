# TIBER-Fantasy Module Classification Audit

_Last updated: 2026-03-20_

## A. Executive Summary

### Current repo state

TIBER-Fantasy is in a mixed-but-recoverable state.

The repo now has a credible core-facing pattern for outside intelligence systems:

- adapter layer
- player detail enrichment
- enrichment orchestrator

That matters because the codebase no longer has to choose between "everything lives in-repo forever" and "big-bang extraction." The external-model boundary under `server/modules/externalModels/` gives the product shell a stable way to consume model outputs without leaking remote payloads across the app.

At the same time, the repo still contains several in-repo model-like systems that behave as standalone engines, scoring stacks, or recommendation brains. Some are active and valuable. Some are duplicated. Some are obviously transitional. Some are hard to classify with confidence because runtime usage is unclear.

### Why the repo is still salvageable as core

The repo is still salvageable as the orchestration core because the pieces that most clearly belong in core already exist or are emerging:

- API and route surfaces
- identity, storage, and ELT/data plumbing
- adapter boundaries for external model repos
- orchestration surfaces that assemble insight into product responses
- validation and safety layers that protect contracts

In other words: the shell is real. The cleanup problem is mostly about reducing how many standalone intelligence engines still live inside the shell.

### Biggest cleanup risks

1. **Duplicate/overlapping brains**  
   OVR, Compass, dynasty heuristics, doctrine modules, and route-level recommendation logic overlap in purpose and increase drift risk.

2. **Hidden coupling to legacy data paths**  
   Some live engines still fall back to older tables or placeholder logic, which makes extraction harder because the true contract is not always obvious.

3. **Route-mounted model logic without clean boundaries**  
   Several engines are active through routes but are not yet isolated behind stable internal contracts.

4. **Unused or low-visibility modules that look productized**  
   `tiberMatrix` is the clearest example: it has tests and utilities, but this audit did not find clear live runtime wiring.

5. **Conflicting long-term doctrine**  
   The new external-model direction is cleaner than the older "keep every engine in the monorepo" pattern. If the repo keeps both philosophies alive, cleanup will stall.

---

## B. Classification Table

| Module | Paths | Purpose | Classification | Why | Recommended Action |
|---|---|---|---|---|---|
| External model adapter layer + player detail enrichment orchestrator | `server/modules/externalModels/**` | Stable boundary for promoted lab/model repos, plus reusable player-detail enrichment assembly | **CORE** | This is the clearest example of the desired architecture: adapters at the edge, stable TIBER-facing contracts, orchestration inside core | Keep in core. Expand this boundary instead of adding direct model fetches elsewhere |
| FORGE offensive + IDP engines | `server/modules/forge/**` | Main Alpha grading engine, support services, routes, calibration, IDP branch | **LEGACY_CORE_TEMP** | FORGE is central and active, but it is still a large standalone intelligence engine living inside the shell. It should be stabilized before any future extraction, not expanded ad hoc | Freeze contracts, reduce route leakage, and treat future extraction as a deliberate later-stage program |
| CATALYST | `server/modules/catalyst/**` | Standalone leverage/clutch scoring engine with its own batch/player routes and compute script | **EXTRACT** | CATALYST behaves like an independent model system with its own compute lifecycle and API surface. It fits the external-model direction better than permanent in-repo residence | Preserve outputs, define canonical contract, then move compute/runtime behind an adapter |
| FIRE / Fantasy Lab opportunity-role engine | `server/routes/fireRoutes.ts`, `server/modules/fantasyLab/README.md` | In-season rolling opportunity/role/conversion scoring for QB/RB/WR/TE | **EXTRACT** | FIRE is an intelligence engine, not just shell orchestration. It is active and useful, but long-term it fits the new external-model doctrine better as a separately versioned model service | Freeze payloads, formalize internal consumer contract, then extract behind adapter/orchestrator |
| Data Lab role banks | `server/modules/datalab/rolebank/**`, `server/services/roleBankService.ts` | Role scoring/role tiering data products used by multiple football systems | **CORE** | These read more like internal feature-store and derived-data infrastructure than productized standalone brains. They are tightly coupled to identity/data plumbing and feed core experiences | Keep in core, but prevent them from growing into independent recommendation engines |
| SoS / matchup context engine | `server/modules/sos/**`, `server/modules/forge/{sosService.ts,matchupService.ts,dvpMatchupService.ts,environmentService.ts}` | Schedule and matchup context services used by product surfaces and FORGE modifiers | **CORE** | These are contextual support services for core orchestration and scoring, not obviously separate product brains on their own | Keep in core with tighter contracts and reduced legacy/placeholder logic |
| Sentinel | `server/modules/sentinel/**` | Validation and guardrail layer for model/system outputs | **CORE** | Sentinel is not a scoring brain; it is a quality/safety layer that helps core consume model outputs safely | Keep in core and use it to police future extraction boundaries |
| Metric Matrix | `server/modules/metricMatrix/**`, `server/routes/metricMatrixRoutes.ts` | Player vectorization, similarity search, tier neighbors, league ownership analytics | **EXTRACT** | This is a self-contained model-like analytics engine with its own cache, routes, and semantics. It is a good candidate for a dedicated service or promoted lab | Preserve route contract, then extract compute and storage behind adapter-style access |
| Start/Sit | `server/modules/startSit/**`, `server/modules/startSitEngine.ts`, related start/sit routes | Recommendation engine that assembles inputs and produces verdicts | **EXTRACT** | Recommendation logic is exactly the kind of standalone intelligence layer that should not permanently live in the product shell | Freeze outputs and move toward an external decision-service pattern |
| tiberMatrix | `server/modules/tiberMatrix/**` | Offensive role-assignment heuristics and calibration utilities | **UNKNOWN** | This audit found tests and calibration helpers, but no clear live route wiring or broad runtime usage outside the module itself | Do not expand. Confirm whether it has live consumers. If yes, plan extraction; if no, deprecate and later delete |
| Doctrine evaluation modules | `server/doctrine/asset_insulation_model.ts`, `server/doctrine/league_market_model.ts` | Standalone reasoning modules that consume FORGE/FIRE through API calls | **EXTRACT** | These are explicit higher-order intelligence modules. They already behave like separately bounded reasoning units and should not become permanent in-repo brains | Keep contracts stable, then move them into a doctrine/intelligence service outside core |
| OVR composite rating surface | `server/modules/ovr/**`, `server/routes/ovrRoutes.ts`, `server/services/ovrService.ts` | Madden-style 1–99 composite rating system | **DEPRECATE_NOW** | OVR overlaps with other player-evaluation surfaces, mixes multiple paradigms, and does not fit the cleaner core-via-adapter direction | Stop new feature growth, decide whether to replace with a consumer-facing derived view or retire it |
| Inline/stateful OVR engine endpoints | `server/services/ovrEngine.ts`, inline `/api/ovr/*` engine endpoints in `server/routes.ts` | Separate stateful OVR engine for seeding/updating ratings | **DELETE_AFTER_REPLACEMENT** | This is effectively a second OVR implementation, which increases confusion and maintenance cost | Replace with one canonical path or remove once the chosen OVR direction is settled |
| PlayerCompass service stack | `server/services/playerCompassService.ts`, `server/services/playerCompassPlayerService.ts` | Compass-style player evaluation with dynasty/redraft splits and team-environment dependency | **DEPRECATE_NOW** | It is a standalone evaluation brain, still references older environment assumptions, and overlaps with doctrine/OVR/other ranking logic | Freeze now. Either replace with an extracted intelligence service or retire in favor of cleaner consumers |
| Legacy Compass profile generator + legacy compass routes | `server/playerCompass.ts`, `server/routes/compassRoutes.ts`, `server/routes/compassQbRoute.ts`, `server/routes/compassRbRoute.ts`, `server/routes/compassWrRoute.ts`, `server/routes/compassTeRoute.ts` | Older compass/profile-generation path with parallel implementation style | **DELETE_AFTER_REPLACEMENT** | This is clear duplication relative to the newer service-based compass path and conflicts with the architecture direction | Keep only until consumers are migrated, then remove |
| Dynasty heuristic bundles / hardcoded valuation logic | `server/dynastyScoringAlgorithm.ts`, `server/dynastyDeclineDetection.ts`, `server/expandedDynastyDatabase.ts` | Standalone dynasty scoring and heuristic valuation logic | **DEPRECATE_NOW** | These are intelligence-heavy modules with hardcoded or self-contained heuristics that do not naturally belong in the long-term shell | Freeze immediately and fold future work into extracted doctrine/intelligence services instead |

---

## C. Priority Extraction List

Top 5 areas that should eventually leave core first:

1. **FIRE / Fantasy Lab opportunity-role engine**  
   Active, valuable, engine-shaped, and already conceptually separate from shell concerns.

2. **CATALYST**  
   Has its own compute flow, its own routes, and a clean standalone mental model.

3. **Doctrine evaluation modules**  
   These are explicitly reasoning-layer modules and should become consumers of core, not residents inside it.

4. **Metric Matrix**  
   Self-contained analytics/vector engine with its own semantics and storage patterns.

5. **Start/Sit**  
   Recommendation-layer logic is a classic extract target once contracts are frozen.

**Close runners-up:** OVR and PlayerCompass. They may need deprecation before extraction because the current shape is overlapping and internally inconsistent.

---

## D. Safe-to-Keep Core List

These areas clearly fit `TIBER-Fantasy` as product shell and orchestration core:

- `server/modules/externalModels/**` adapter boundary
- player-detail enrichment orchestration surfaces
- route/API shells and response contract enforcement
- identity resolution, storage access, and ELT/data movement layers
- Data Lab derived-data infrastructure such as role banks when kept as internal feature products
- SoS/context support services used to enrich core outputs
- Sentinel validation and safety checks

Short version: **interfaces, orchestration, validation, identity, and internal support data belong in core. Full standalone brains generally do not.**

---

## E. Orphan / Dead / Unclear List

### Likely unclear

- **`server/modules/tiberMatrix/**`**  
  Clear internal tests and calibration helpers exist, but this audit did not find strong runtime references beyond the module itself.

### Likely duplicate / legacy

- **`server/playerCompass.ts` and compass-specific legacy routes**  
  Parallel implementation style relative to newer `services/playerCompassService.ts` flow.

- **Stateful OVR engine in `server/services/ovrEngine.ts` plus inline engine endpoints in `server/routes.ts`**  
  Looks like a second, partially separate OVR stack.

### Likely misleadingly "live" but architecturally unstable

- **PlayerCompass service stack**  
  Still wired, but contains older environment assumptions and overlaps with newer doctrine/external-model direction.

- **Dynasty heuristic bundles**  
  They may still be callable or useful, but they are not a clean long-term home for standalone football reasoning.

---

## F. Staged Cleanup Plan

### Stage 1: label / freeze

- Publish and keep this classification audit current
- Mark `EXTRACT`, `DEPRECATE_NOW`, and `DELETE_AFTER_REPLACEMENT` areas as no-new-scope zones unless explicitly justified
- Prefer adapter/orchestrator integration for any new model work
- Stop adding new route-level football reasoning outside declared core surfaces

### Stage 2: extract

- Extract the cleanest standalone engines first: FIRE, CATALYST, doctrine modules, Metric Matrix, Start/Sit
- Define canonical request/response contracts before moving runtime ownership
- Keep TIBER-Fantasy as the consumer/orchestrator, not the new host for replacement logic

### Stage 3: adapter replacement

- Replace in-repo direct engine calls with adapter/service boundaries under `server/modules/externalModels/`
- Reuse the same pattern already established for role-opportunity enrichment
- Ensure routes consume stable TIBER-facing contracts rather than raw external payloads

### Stage 4: delete legacy

- Remove duplicate OVR/Compass paths after one canonical consumer path exists
- Delete legacy modules only after route consumers, docs, and tests have been moved or retired
- Avoid partial deletion that leaves orphaned endpoints or stale documentation

### Stage 5: tighten contracts

- Enforce stricter DTOs and versioned contracts at model boundaries
- Reduce fallback behavior that hides legacy dependencies
- Make it obvious which services are core, which are external consumers, and which are on a removal path

---

## Bottom line

`TIBER-Fantasy` is still salvageable as the shell and orchestration core.

But that only stays true if the repo treats standalone model brains as **temporary in-repo residents unless explicitly justified**, and keeps pushing new intelligence work toward **adapter-consumed external services** instead of growing more permanent in-repo engines.
