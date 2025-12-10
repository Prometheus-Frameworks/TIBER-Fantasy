# FORGE Scoring System Map

## Top-Level Architecture (E → F → O → R → G)
- **E – Engine/context ingestion**: `server/modules/forge/context/contextFetcher.ts` gathers identity, season/weekly stats, role metrics, environment, injury, and matchup context from Postgres + Datadive snapshots. It routes to enriched snapshots first and falls back to legacy weekly/season tables when needed.【F:server/modules/forge/context/contextFetcher.ts†L1-L199】
- **F – Feature builders**: Position-specific builders convert raw context into normalized feature bundles in `server/modules/forge/features/*Features.ts` (WR/RB/TE/QB).【F:server/modules/forge/index.ts†L45-L52】
- **O – Alpha engine + modifiers**: `server/modules/forge/alphaEngine.ts` combines features with weight tables to produce raw alpha, then optional environment/matchup modifiers (`contextModifiers.ts`) and SoS enrichment inside the HTTP routes pipeline.【F:server/modules/forge/contextModifiers.ts†L1-L129】【F:server/modules/forge/routes.ts†L35-L199】
- **R – Recursive/stability layer**: `server/modules/forge/recursiveAlphaEngine.ts` compares the current week to prior state (stored in `forge_player_state`) to compute surprise, stability adjustment, and momentum before finalizing alpha.【F:server/modules/forge/recursiveAlphaEngine.ts†L1-L117】
- **G – Grading/tiers**: `server/modules/forge/tiberTiers.ts` maps calibrated alpha to tier labels and mover rules, used downstream by rankings and Tiber surfaces.【F:server/modules/forge/types.ts†L260-L322】

## Modules by Role
| Module | Purpose | Inputs | Outputs | Dependencies | Path |
| --- | --- | --- | --- | --- | --- |
| `contextFetcher` | Build full player context (identity, season + weekly stats, role metrics, environment, injury, DvP, xFPTS). | Player ID, season, week, optional startWeek. | `ForgeContext` object. | Postgres via Drizzle; Datadive snapshot helpers; PlayerIdentityService; OasisEnvironmentService. | `server/modules/forge/context/contextFetcher.ts`【F:server/modules/forge/context/contextFetcher.ts†L41-L117】 |
| `forgeService` | Orchestrates scoring for single/batch requests; wires context → features → alpha. | Player IDs/filters, season/week. | Array of `ForgeScore` records. | Feature builders, `fetchContext`, `calculateAlphaScore`. | `server/modules/forge/forgeService.ts`【F:server/modules/forge/forgeService.ts†L14-L107】 |
| Feature builders | Normalize context into numeric features per position. | `ForgeContext`. | `ForgeFeatureBundle`. | Shared utils; position rules. | `server/modules/forge/features/*Features.ts`【F:server/modules/forge/index.ts†L45-L52】 |
| `alphaEngine` | Calculate raw alpha + subscores, apply calibration and optional modifiers. | Context, feature bundle, optional env/matchup modifiers. | `ForgeScore` (with alpha, subscores, trajectory, confidence). | `applyForgeEnvModifier`, `applyForgeMatchupModifier`, calibration constants. | `server/modules/forge/alphaEngine.ts`【F:server/modules/forge/contextModifiers.ts†L1-L129】 |
| `contextModifiers` | Safe, clamped env/matchup multipliers (default ±15–25%, bounded to alpha 25–90). | Raw alpha, envScore, matchupScore. | Adjusted alpha + multipliers. | None beyond math helpers. | `server/modules/forge/contextModifiers.ts`【F:server/modules/forge/contextModifiers.ts†L22-L129】 |
| `forgeAlphaModifiers` | Legacy multiplicative env/matchup adjustments (weights 0.40 / 0.25) with safety bound at zero. | Raw alpha, env/matchup scores, weights. | Modified alpha. | Modifier weight defaults. | `server/modules/forge/forgeAlphaModifiers.ts`【F:server/modules/forge/forgeAlphaModifiers.ts†L23-L69】 |
| `recursiveAlphaEngine` | Two-pass recursion: compares current alpha to expected, adjusts for surprise/volatility/momentum, persists state. | Context, features, prior week state. | `RecursiveForgeScore` with recursion metadata. | `calculateAlphaScore`, `forgeStateService`, tier assignment. | `server/modules/forge/recursiveAlphaEngine.ts`【F:server/modules/forge/recursiveAlphaEngine.ts†L1-L117】 |
| `tiberTiers` | Converts alpha into T1–T5 tiers with mover rules. | Final alpha, position, optional previous tier. | `TiberTierAssignment`. | Tier thresholds/mover constants. | `server/modules/forge/types.ts`【F:server/modules/forge/types.ts†L260-L322】 |
| `forgeGateway` | Canonical internal API (non-HTTP) for batch/single scoring. | Position/limit/week filters or player ID. | Sorted `ForgeScore` batch or single score. | `forgeService`. | `server/modules/forge/forgeGateway.ts`【F:server/modules/forge/forgeGateway.ts†L1-L47】 |
| `routes` | Express surface for preview and debug endpoints; enriches alpha with SoS multipliers before returning. | HTTP query params. | JSON payload `{meta, scores[]}` with SoS fields. | `forgeService`, SoS services, snapshots, FPR, QB context. | `server/modules/forge/routes.ts`【F:server/modules/forge/routes.ts†L1-L199】 |

## Data Sources (Postgres)
- **Primary enriched path (2025+)**: Datadive snapshot helpers (`getEnrichedPlayerWeek`, `getSnapshotSeasonStats`) pull from enriched snapshot tables; used when `USE_DATADIVE_FORGE` is true.【F:server/modules/forge/context/contextFetcher.ts†L153-L185】
- **Legacy fallbacks**: `weekly_stats`/`silver_player_weekly_stats`, `playerSeasonFacts`, `playerSeason2024`, `playerAdvanced2024`, and `game_logs` are still read when enriched data is missing.【F:server/modules/forge/context/contextFetcher.ts†L15-L199】
- **Context tables**: `defense_vs_position_stats`, `qb_epa_adjusted`, `player_live_status`, and team environment data via `OasisEnvironmentService` feed matchup/environment inputs.【F:server/modules/forge/context/contextFetcher.ts†L12-L149】
- **Potentially stale/duplicate sources**: legacy 2024 season tables (`playerSeason2024`, `playerAdvanced2024`) and weekly_stats fallbacks coexist with Datadive snapshots, so double-counting risk exists when both paths are enabled; note the explicit fallback chain in `fetchSeasonStats` and `fetchWeeklyStats` (legacy vs enriched).【F:server/modules/forge/context/contextFetcher.ts†L153-L199】

## Modifiers
- **Location**: `server/modules/forge/contextModifiers.ts` (current bounded modifiers) and `server/modules/forge/forgeAlphaModifiers.ts` (earlier multiplicative variant).【F:server/modules/forge/contextModifiers.ts†L1-L129】【F:server/modules/forge/forgeAlphaModifiers.ts†L23-L69】
- **Bounds**: Env multiplier default weight 0.15 and matchup 0.25 with outputs clamped to alpha 25–90; legacy modifiers cap implicitly via min-zero safety check (max theoretical ±40% env, ±25% matchup ≈ ±65% combined but guarded against negative).【F:server/modules/forge/contextModifiers.ts†L22-L129】【F:server/modules/forge/forgeAlphaModifiers.ts†L23-L69】
- **Safety test interaction**: Both modifier paths sanitize inputs (null→neutral 50) and clamp results, preventing swings beyond the calibrated band and zeroing non-finite results before returning.【F:server/modules/forge/contextModifiers.ts†L39-L124】【F:server/modules/forge/forgeAlphaModifiers.ts†L41-L69】

## Final Scoring Output
- **Data shape**: `ForgeScore` includes identifiers, position, `alpha`, `rawAlpha`, `subScores`, `trajectory`, `confidence`, games played, optional FPR and matchup info, data-quality flags, and `scoredAt` timestamp.【F:server/modules/forge/types.ts†L107-L146】
- **Return points**: HTTP preview endpoint responds with `{ success, meta, scores[] }`, adding SoS-adjusted `alpha`, `alphaBase`, `sosRos/Next3/Playoffs`, and multipliers; internal gateway returns `{ scores, meta }` without SoS enrichment.【F:server/modules/forge/routes.ts†L35-L199】【F:server/modules/forge/forgeGateway.ts†L1-L47】
- **Consumers/endpoints**: `/api/forge/preview` (Express route), `getForgeBatch`/`getForgeScoreForPlayer` gateway for other services (OVR, TIBER, Strategy) to ingest FORGE without HTTP.【F:server/modules/forge/routes.ts†L117-L199】【F:server/modules/forge/forgeGateway.ts†L1-L47】

## Rendered File Tree
```
server/modules/forge/
├── alphaEngine.ts
├── alphaV2.ts
├── context/
│   └── contextFetcher.ts
├── contextModifiers.ts
├── dvpMatchupService.ts
├── environmentService.ts
├── features/
│   ├── qbFeatures.ts
│   ├── rbFeatures.ts
│   ├── teFeatures.ts
│   └── wrFeatures.ts
├── fibonacciPatternResonance.ts
├── forgeAlphaModifiers.ts
├── forgeEngine.ts
├── forgeFootballLens.ts
├── forgeGateway.ts
├── forgeGrading.ts
├── forgePlayerContext.ts
├── forgeService.ts
├── forgeSnapshot.ts
├── forgeStateService.ts
├── helpers/
│   └── sosMultiplier.ts
├── index.ts
├── matchupService.ts
├── qbContextPopulator.ts
├── recursiveAlphaEngine.ts
├── routes.ts
├── sosService.ts
├── tiberTiers.ts
├── types.ts
└── utils/
    └── scoring.ts
```

## Notes on Undocumented Modules
If a module is not covered above (e.g., SoS/matchup helpers or QB context population), its role can be inferred from naming and imports: feeding environment/SoS inputs into the context and modifier layers that flow through the E→F→O→R→G pipeline.【F:server/modules/forge/index.ts†L1-L59】
