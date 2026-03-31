# TIBER Product Shell Realignment Plan (Phase 1)

## A) Current-state diagnosis

### Why the current UI feels behind the repo

TIBER-Fantasy’s backend and architecture documents clearly describe a shell/orchestration product with promoted external-model surfaces under `server/modules/externalModels/`. The visible app shell still feels like an older fantasy dashboard because:

- `/` is still framed as a table-first player-stat board instead of a product front door.
- Main navigation mixes user-facing product routes, promoted orchestration routes, and builder/system routes at nearly equal visual weight.
- Legacy/internal naming (for example “Promoted Data Lab” or `legacy-chat`) leaks directly into top-level UX.
- Route hierarchy is broad and technically complete, but not meaningfully tiered by user intent.

### Where homepage/nav/product language are out of sync with architecture

- **Homepage mismatch:** the architecture emphasizes orchestration and promoted research lanes, but home emphasizes generic ranking-table workflows.
- **Nav mismatch:** promoted research surfaces (Command Center / Player Research / Team Research) are present but semantically crowded by mixed labels and internal tools.
- **Language mismatch:** terms such as “Promoted Data Lab,” “FORGE & System,” and “Tiber Chat β” in primary nav blur product boundaries between user workflows and operator workflows.

### Over-promoted, under-promoted, misplaced surfaces

- **Over-promoted in primary experience:** admin/builder endpoints (`/admin/*`, forge internals, lexicon/architecture diagnostics) and `legacy-chat`.
- **Under-promoted in primary experience:** research-orchestration front door (`/tiber-data-lab/command-center`), research workspaces, and direct “TIBER as platform shell” orientation.
- **Misplaced framing:** Data Lab promoted lane appears as technical taxonomy rather than as user-facing research workflows.

---

## B) Route classification table (mounted routes in `client/src/App.tsx`)

| Path | Page / Component | Classification | Recommendation | Reason |
|---|---|---|---|---|
| `/` | `Dashboard` | PRIMARY_PRODUCT | keep (reframe as front door) | This is the canonical shell entry point and must explain the product lanes immediately. |
| `/tiers` | `TiberTiers` | PRIMARY_PRODUCT | keep | Core recurring decision surface. |
| `/rookies` | `RookieBoard` | PRIMARY_PRODUCT | keep | High-value product board and promoted external-artifact consumer. |
| `/tiber-data-lab` | `DataLabHub` | ORCHESTRATION_SURFACE | keep | Parent discovery surface for research/orchestration lane. |
| `/tiber-data-lab/personnel` | `PersonnelUsage` | LEGACY_OR_DEMOTE | hide-from-primary-nav | Useful specialist data view but not a core front-door route. |
| `/tiber-data-lab/role-banks` | `RoleContextRankings` | LEGACY_OR_DEMOTE | hide-from-primary-nav | Internal/specialist analytical surface, not primary user lane. |
| `/tiber-data-lab/receiving` | `ReceivingLab` | LEGACY_OR_DEMOTE | hide-from-primary-nav | Legacy lab-like specialist page. |
| `/tiber-data-lab/rushing` | `RushingLab` | LEGACY_OR_DEMOTE | hide-from-primary-nav | Legacy lab-like specialist page. |
| `/tiber-data-lab/qb` | `QBLab` | LEGACY_OR_DEMOTE | hide-from-primary-nav | Legacy lab-like specialist page. |
| `/tiber-data-lab/situational` | `SituationalLab` | LEGACY_OR_DEMOTE | hide-from-primary-nav | Specialist/internal analysis page. |
| `/tiber-data-lab/breakout-signals` | `BreakoutSignalsLab` | SPECIALIST_MODEL_SURFACE | keep (secondary nav) | Promoted model surface; important but should not crowd primary top lane. |
| `/tiber-data-lab/role-opportunity` | `RoleOpportunityLab` | SPECIALIST_MODEL_SURFACE | keep (secondary nav) | Promoted model surface in specialist lane. |
| `/tiber-data-lab/age-curves` | `AgeCurvesLab` | SPECIALIST_MODEL_SURFACE | keep (secondary nav) | Promoted model surface in specialist lane. |
| `/tiber-data-lab/point-scenarios` | `PointScenariosLab` | SPECIALIST_MODEL_SURFACE | keep (secondary nav) | Promoted model surface in specialist lane. |
| `/tiber-data-lab/player-research` | `PlayerResearchLab` | ORCHESTRATION_SURFACE | keep (promote) | Strong cross-model orchestrated workflow. |
| `/tiber-data-lab/team-research` | `TeamResearchLab` | ORCHESTRATION_SURFACE | keep (promote) | Strong cross-model orchestrated workflow. |
| `/tiber-data-lab/command-center` | `DataLabCommandCenterLab` | ORCHESTRATION_SURFACE | keep (promote) | Best “research front door” route for promoted lane. |
| `/personnel` | `Redirect` | LEGACY_OR_DEMOTE | keep alias only | Backward-compatible deep-link alias. |
| `/schedule` | `SchedulePage` | PRIMARY_PRODUCT | keep | Core weekly planning surface and team-context entry point. |
| `/legacy-chat` | `ChatHomepage` | LEGACY_OR_DEMOTE | keep route, demote in nav | Still accessible but should not read as flagship modern surface. |
| `/player/:playerId` | `PlayerPage` | PRIMARY_PRODUCT | keep | Core detail route used by rankings/research flows. |
| `/forge` | `ForgeLanding` | BUILDER_ADMIN | move to System/Builder nav section | Engine framing is useful but not primary user journey. |
| `/forge/inspect` | `ForgeTransparency` | BUILDER_ADMIN | move to System/Builder nav section | Diagnostic/internals orientation. |
| `/rankings` | `Redirect` | LEGACY_OR_DEMOTE | keep alias only | Backward-compatible alias to `/tiers`. |
| `/x-intel` | `XIntelligence` | ORCHESTRATION_SURFACE | keep (secondary promote) | Intelligence ingest/scanner surface with platform value. |
| `/architecture` | `Architecture` | BUILDER_ADMIN | demote to System/Builder | Internal architecture reference page. |
| `/metrics-dictionary` | `MetricsDictionary` | BUILDER_ADMIN | demote to System/Builder | Internal-support glossary, not front-door product route. |
| `/forge-workbench` | `ForgeWorkbench` | SPECIALIST_MODEL_SURFACE | keep (secondary nav) | Specialist model/workbench route, not primary for most users. |
| `/fantasy-lab` | `FantasyLab` | SPECIALIST_MODEL_SURFACE | keep (secondary nav) | Specialist lab surface for deeper workflows. |
| `/idp-lab` | `IdpLab` | SPECIALIST_MODEL_SURFACE | keep (secondary nav) | Specialist model/lab surface. |
| `/catalyst-lab` | `CatalystLab` | SPECIALIST_MODEL_SURFACE | keep (secondary nav) | Specialist model/lab surface. |
| `/tiberclaw` | `TiberClawPage` | ORCHESTRATION_SURFACE | keep (promote) | External/agent-facing articulation of TIBER platform value. |
| `/sentinel` | `SentinelDashboard` | BUILDER_ADMIN | demote to System/Builder | Quality/guardrail system surface, primarily internal. |
| `/admin/forge-hub` | `ForgeHub` | BUILDER_ADMIN | keep, hide-from-primary-nav emphasis | Builder/admin control surface. |
| `/admin/player-mapping` | `PlayerMapping` | BUILDER_ADMIN | keep, hide-from-primary-nav emphasis | Admin utility route. |
| `/admin/player-mapping-test` | `PlayerMappingTest` | BUILDER_ADMIN | keep, hide-from-primary-nav emphasis | Admin/dev utility route. |
| `/admin/player-research` | `PlayerResearch` | BUILDER_ADMIN | keep, hide-from-primary-nav emphasis | Admin-only research tooling. |
| `/admin/api-lexicon` | `ApiLexicon` | BUILDER_ADMIN | keep, hide-from-primary-nav emphasis | Internal contract/tooling documentation. |
| `/admin/rag-status` | `RagStatus` | BUILDER_ADMIN | keep, hide-from-primary-nav emphasis | Internal operational diagnostics. |
| `/admin/forge-lab` | `ForgeLab` | BUILDER_ADMIN | keep, hide-from-primary-nav emphasis | Builder experimentation surface. |
| `/admin/forge-simulation` | `ForgeSimulation` | BUILDER_ADMIN | keep, hide-from-primary-nav emphasis | Builder simulation utility. |
| `/admin/wr-rankings-sandbox` | `WRRankingsSandbox` | BUILDER_ADMIN | keep, hide-from-primary-nav emphasis | Sandbox/dev surface. |
| `/admin/qb-rankings-sandbox` | `QBRankingsSandbox` | BUILDER_ADMIN | keep, hide-from-primary-nav emphasis | Sandbox/dev surface. |
| `/dev/forge` | `Redirect` | LEGACY_OR_DEMOTE | keep alias only | Backward-compatible alias to admin forge lab. |
| `/admin` | `Redirect` | BUILDER_ADMIN | keep | Entry alias for builder admin cluster. |

---

## C) Recommended top-level product structure

Tight, user-legible shell hierarchy for this phase:

1. **Home** (`/`)  
   Product front door and lane orientation.
2. **Rankings** (`/tiers`)  
   Core decisioning board.
3. **Rookie Board** (`/rookies`)  
   Seasonal board and prospect intake.
4. **Schedule & Matchups** (`/schedule`)  
   Weekly planning and context.
5. **Research** (orchestration lane)
   - Command Center (`/tiber-data-lab/command-center`)
   - Player Research (`/tiber-data-lab/player-research`)
   - Team Research (`/tiber-data-lab/team-research`)
   - Data Lab Hub (`/tiber-data-lab`)
6. **Model Labs** (specialist model surfaces)
   - Breakout / Role & Opportunity / ARC / Point Scenarios
   - Fantasy Lab / IDP Lab / CATALYST / FORGE Workbench
7. **Agent & Intelligence**
   - TiberClaw
   - X Intelligence
   - Legacy Chat (demoted)
8. **System & Builder**
   - FORGE internals, Sentinel, metrics/architecture docs, admin routes

---

## D) Vocabulary cleanup notes

### Keep external/product-facing

- **TIBER**: keep as product shell brand.
- **TiberClaw**: keep as agent-facing brand/surface.
- **Research**: keep as user-facing framing for orchestration lane.
- **Command Center / Player Research / Team Research**: keep; clear intent.
- **Data Lab**: keep as umbrella term, but avoid overloading with internal jargon.

### Keep but position as specialist/internal vocabulary

- **FORGE**: keep, but split user-facing outcomes (Tiers) from builder internals (Hub/Inspect/Lab).
- **Fantasy Lab / IDP Lab / CATALYST Lab**: specialist surfaces; secondary nav placement.
- **Sentinel / API Lexicon / Architecture / Metrics Dictionary**: internal/operator language.

### Demote or reduce in primary UX copy

- **“Promoted Data Lab”**: replace with “Research” and “Model Labs” language externally.
- **`legacy-chat` / “Tiber Chat β”**: present as legacy or secondary assistant access, not flagship lane.
- **Mixed brand stacks in first impression** (e.g., too many equal-weight product nouns): avoid on home hero.

---

## E) Minimum viable implementation plan (this PR)

1. **Create this plan doc** in `docs/architecture/TIBER_PRODUCT_SHELL_REALIGNMENT_PLAN.md`.
2. **Refactor primary sidebar information architecture** in `client/src/components/TiberLayout.tsx`:
   - clearer section grouping by product layer
   - demote builder/admin/internal surfaces to explicit System & Builder section
   - demote legacy chat from primary assistant lane
   - rename “Dashboard” nav item to “Home”
3. **Refactor homepage role** in `client/src/pages/Dashboard.tsx`:
   - reposition as front door with lane cards and stronger shell explanation
   - keep real data widgets, but subordinate table to platform guidance
   - promote Tiers, Rookie Board, Research Command Center, and TiberClaw entry points
   - keep deep links intact; no route removals
4. **Add concise README positioning note** to reflect shell/front-door realignment without changing architecture doctrine.
5. **Run build + targeted checks** to verify routes compile and nav links remain valid.

