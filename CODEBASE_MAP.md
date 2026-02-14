# CODEBASE_MAP.md — File-to-Feature Ownership Index

> Comprehensive index of every `.ts` and `.tsx` file in the Tiber Fantasy project (739 files).
> Organized by feature/module ownership for coding agent navigation.
>
> Last updated: 2026-02-14

---

## 1. FORGE — Player Evaluation Engine

MODULE.md: `server/modules/forge/MODULE.md`

### Backend — Core Engine

| File | Role |
|------|------|
| server/modules/forge/index.ts | FORGE module entry point, route registration |
| server/modules/forge/routes.ts | FORGE API route definitions (`/api/forge/*`) |
| server/modules/forge/types.ts | FORGE TypeScript type definitions |
| server/modules/forge/forgeEngine.ts | E-side: data fetching engine |
| server/modules/forge/forgeGrading.ts | G-side: scoring/grading engine |
| server/modules/forge/forgeService.ts | FORGE orchestration service |
| server/modules/forge/forgeGateway.ts | FORGE gateway for external consumers |
| server/modules/forge/forgeSnapshot.ts | FORGE snapshot persistence utility |
| server/modules/forge/forgeStateService.ts | FORGE state management service |
| server/modules/forge/forgeFootballLens.ts | Football Lens evaluation layer |
| server/modules/forge/forgeAlphaModifiers.ts | Alpha score modifier functions |
| server/modules/forge/forgePlayerContext.ts | Player context data assembly |
| server/modules/forge/alphaEngine.ts | Alpha score calculation engine |
| server/modules/forge/alphaV2.ts | Alpha v2 scoring implementation |
| server/modules/forge/recursiveAlphaEngine.ts | Recursive alpha computation |
| server/modules/forge/robustNormalize.ts | Robust normalization utilities |
| server/modules/forge/contextModifiers.ts | Context-based score modifiers |
| server/modules/forge/dvpMatchupService.ts | Defense vs Position matchup service |
| server/modules/forge/environmentService.ts | Team environment scoring |
| server/modules/forge/envMatchupRefresh.ts | Environment matchup data refresh |
| server/modules/forge/matchupService.ts | Matchup analysis service |
| server/modules/forge/sosService.ts | SoS integration for FORGE |
| server/modules/forge/qbContextPopulator.ts | QB context data populator |
| server/modules/forge/tiberTiers.ts | Tiber tiers generation from FORGE |
| server/modules/forge/fibonacciPatternResonance.ts | Fibonacci pattern resonance scoring |

### Backend — Features (Position-Specific)

| File | Role |
|------|------|
| server/modules/forge/features/wrFeatures.ts | WR-specific FORGE features |
| server/modules/forge/features/rbFeatures.ts | RB-specific FORGE features |
| server/modules/forge/features/teFeatures.ts | TE-specific FORGE features |
| server/modules/forge/features/qbFeatures.ts | QB-specific FORGE features |

### Backend — Context

| File | Role |
|------|------|
| server/modules/forge/context/contextFetcher.ts | Context data fetching layer |

### Backend — Helpers / Utils

| File | Role |
|------|------|
| server/modules/forge/helpers/sosMultiplier.ts | SoS multiplier helper for FORGE alpha |
| server/modules/forge/utils/scoring.ts | FORGE scoring utility functions |

### Backend — Simulation

| File | Role |
|------|------|
| server/modules/forge/simulation/forgeSimService.ts | FORGE simulation service |

### Backend — Tests

| File | Role |
|------|------|
| server/modules/forge/__tests__/recursiveAlphaEngine.test.ts | Recursive alpha engine unit tests |
| server/modules/__tests__/recursiveAlphaEngine.test.ts | Recursive alpha engine tests (alt location) |

### Backend — Related Services

| File | Role |
|------|------|
| server/services/forgeContextLoader.ts | FORGE context data loader |
| server/services/forgeRebuildService.ts | FORGE rebuild/recalculation service |
| server/services/fantasyWrRankingsService.ts | Fantasy WR rankings powered by FORGE |
| server/config/forgeSeason.ts | FORGE season configuration |

### Backend — Related Routes

| File | Role |
|------|------|
| server/routes/adminForge.ts | Admin FORGE route definitions |
| server/routes/forgeSimRoutes.ts | FORGE simulation routes |

### Frontend — Pages

| File | Role |
|------|------|
| client/src/pages/ForgeLab.tsx | FORGE Lab admin page |
| client/src/pages/ForgeLabEquationSandbox.tsx | FORGE equation sandbox page |
| client/src/pages/ForgeTransparency.tsx | FORGE transparency/explainability page |
| client/src/pages/ForgeWorkbench.tsx | Interactive FORGE query workbench |
| client/src/pages/TiberTiers.tsx | Tiber Tiers page (FORGE-powered rankings) |
| client/src/pages/admin/ForgeHub.tsx | Admin FORGE hub page |
| client/src/pages/admin/ForgeSimulation.tsx | Admin FORGE simulation page |

### Frontend — Components

| File | Role |
|------|------|
| client/src/components/ForgeRankingsTable.tsx | FORGE rankings data table |
| client/src/components/ForgeTransparencyPanel.tsx | FORGE transparency detail panel |
| client/src/components/AlphaRankingsLayout.tsx | Alpha rankings layout wrapper |

### Frontend — API / Types / Data

| File | Role |
|------|------|
| client/src/api/forge.ts | FORGE API client functions |
| client/src/types/forge.ts | FORGE frontend type definitions |
| client/src/forgeLab/equations.ts | ForgeLab equation definitions |

---

## 2. LLM Gateway — AI Provider Routing

MODULE.md: `server/llm/MODULE.md`

| File | Role |
|------|------|
| server/llm/index.ts | LLM Gateway entry point, `callLLM()` |
| server/llm/config.ts | LLM task types, priority tiers, provider config |
| server/llm/fallback.ts | Provider fallback chain logic |
| server/llm/logger.ts | LLM call logging |
| server/llm/types.ts | LLM Gateway TypeScript types |
| server/llm/providers/openrouter.ts | OpenRouter provider adapter |
| server/llm/providers/openai.ts | OpenAI provider adapter |
| server/llm/providers/anthropic.ts | Anthropic provider adapter |
| server/llm/providers/gemini.ts | Gemini provider adapter |

---

## 3. X Intelligence — X/Twitter Scanning

MODULE.md: `server/services/MODULE_XINTEL.md`

| File | Role |
|------|------|
| server/services/xIntelligenceScanner.ts | Grok-powered X/Twitter scanning service |
| client/src/pages/XIntelligence.tsx | X Intelligence frontend page |

---

## 4. Data Lab / DataDive — Snapshot Analytics

MODULE.md: none

| File | Role |
|------|------|
| server/services/datadiveSnapshot.ts | DataDive snapshot generation service |
| server/services/datadiveContext.ts | DataDive context assembly |
| server/services/datadiveAuto.ts | DataDive automatic snapshot scheduling |
| server/routes/dataLabRoutes.ts | Data Lab API routes (`/api/data-lab/*`) |
| client/src/pages/TiberDataLab.tsx | Tiber Data Lab frontend page |

---

## 5. OVR System — Madden Ratings

MODULE.md: none

| File | Role |
|------|------|
| server/modules/ovr/index.ts | OVR module entry point |
| server/modules/ovr/ovrForgeAdapter.ts | OVR-to-FORGE adapter |
| server/services/ovrService.ts | OVR calculation service |
| server/services/ovrEngine.ts | OVR scoring engine |
| server/services/ovrCache.ts | OVR result caching |
| server/services/sleeperOvrScorer.ts | Sleeper-based OVR scoring |
| server/routes/ovrRoutes.ts | OVR API routes |

---

## 6. SoS — Strength of Schedule

MODULE.md: `server/modules/sos/MODULE.md`

### Backend

| File | Role |
|------|------|
| server/modules/sos/sos.service.ts | SoS core service |
| server/modules/sos/sos.controller.ts | SoS controller |
| server/modules/sos/sos.router.ts | SoS route definitions |
| server/modules/sos/sos.types.ts | SoS type definitions |
| server/modules/sos/contextSosService.ts | Context-aware SoS service |
| server/modules/sos/dashboard.service.ts | SoS dashboard service |
| server/modules/sos/dashboard.controller.ts | SoS dashboard controller |
| server/modules/sos/teamRankings.service.ts | Team rankings by SoS |

### Frontend

| File | Role |
|------|------|
| client/src/components/SOSBarChart.tsx | SoS bar chart visualization |
| client/src/components/sos/SOSTable.tsx | SoS data table |
| client/src/components/sos/SOSLegend.tsx | SoS color legend |
| client/src/components/sos/dashboard/FilterWidget.tsx | SoS dashboard filter widget |
| client/src/components/sos/dashboard/ROSSOSWidget.tsx | Rest-of-season SoS widget |
| client/src/components/sos/dashboard/SOSWidget.tsx | SoS dashboard widget |
| client/src/components/sos/dashboard/WeeklySOSWidget.tsx | Weekly SoS widget |
| client/src/lib/sosColors.ts | SoS color utility functions |
| client/src/pages/SchedulePage.tsx | Schedule/SoS frontend page |

---

## 7. Consensus — Community Rankings

MODULE.md: `server/consensus/MODULE.md`

| File | Role |
|------|------|
| server/consensus/commandRouter.ts | Consensus command routing |
| server/consensus/curves.ts | Consensus ranking curves |
| server/consensus/dynastySoftenerV2.ts | Dynasty consensus softening |
| server/consensus/injuryProfiles.ts | Injury impact profiles |
| server/consensus/inMemoryStore.ts | In-memory consensus data store |
| server/consensus/test-curves.ts | Consensus curves test utility |
| server/consensus/__tests__/injuryProfiles.v2.test.ts | Injury profiles v2 tests |
| server/consensus.ts | Legacy consensus entry point |
| server/consensusEngine.ts | Consensus ranking engine |
| server/consensusSeeding.ts | Consensus initial seeding |
| server/adaptiveConsensus.ts | Adaptive consensus algorithm |
| server/services/consensusBenchmark.ts | Consensus benchmark service |
| server/services/tiberConsensusService.ts | Tiber consensus service |
| server/services/tiberConsensusPlayerService.ts | Tiber consensus player service |
| server/seeds/consensus-initial-data.ts | Consensus seed data |
| server/seeds/consensus-seed.ts | Consensus seeding script |
| client/src/hooks/useConsensus.ts | Consensus React hook |
| shared/types/adaptiveConsensus.ts | Adaptive consensus types |
| shared/types/consensus.ts | Consensus shared types |
| shared/types/consensusSeeding.ts | Consensus seeding types |

---

## 8. Player Identity — Player Resolution

MODULE.md: none

| File | Role |
|------|------|
| server/services/PlayerIdentityService.ts | Core player identity resolution service |
| server/services/PlayerIdentityMigration.ts | Player identity migration utility |
| server/services/SleeperIdentitySync.ts | Sleeper-to-identity sync |
| server/services/identity/rosterIdentityEnrichment.ts | Roster-based identity enrichment |
| server/services/playerAliases.ts | Player alias/nickname mapping |
| server/services/playerNameDetector.ts | Player name detection/parsing |
| server/routes/playerIdentityRoutes.ts | Player identity API routes |
| server/routes/playerMappingRoutes.ts | Player mapping API routes |
| server/playerMapping.ts | Player mapping utilities |
| server/scripts/backfillGsisId.ts | GSIS ID backfill script |
| server/scripts/identityConsolidation.ts | Identity consolidation script |
| server/scripts/mapStarPlayers.ts | Star player mapping script |
| client/src/pages/admin/PlayerMapping.tsx | Admin player mapping page |
| client/src/pages/admin/PlayerMappingTest.tsx | Admin player mapping test page |

---

## 9. ETL Pipeline — Data Processing

MODULE.md: `server/etl/MODULE.md`

| File | Role |
|------|------|
| server/etl/CoreWeekIngest.ts | Bronze layer: core weekly data ingestion |
| server/etl/silverWeeklyStatsETL.ts | Silver layer: weekly stats ETL |
| server/etl/goldDatadiveETL.ts | Gold layer: DataDive ETL |
| server/etl/nightlyBuysSellsUpdate.ts | Nightly buys/sells update pipeline |
| server/routes/etlRoutes.ts | ETL trigger API routes |
| server/routes/nightlyProcessingRoutes.ts | Nightly processing trigger routes |
| server/services/BronzeLayerService.ts | Bronze layer service |
| server/services/SilverLayerService.ts | Silver layer service |
| server/services/GoldLayerService.ts | Gold layer service |
| server/services/dataIngestionService.ts | Data ingestion orchestration |
| server/ingest/nflfastr.ts | NFLfastR data ingestion |
| server/downstream/pushAllBoxes.ts | Downstream box-score push orchestrator |

### ETL Test / Debug Scripts (Root)

| File | Role |
|------|------|
| _check_bronze.ts | Bronze layer check script |
| _test_bronze_to_silver.ts | Bronze→Silver pipeline test |
| _test_full_pipeline.ts | Full ETL pipeline test |
| _verify.ts | ETL verification script |

---

## 10. Enrichment — Stat Enrichment

MODULE.md: `server/enrichment/MODULE.md`

| File | Role |
|------|------|
| server/enrichment/index.ts | Enrichment module entry point |
| server/enrichment/wrBox.ts | WR stat enrichment box |
| server/enrichment/rbBox.ts | RB stat enrichment box |
| server/enrichment/qbBox.ts | QB stat enrichment box |
| server/enrichment/fantasyBox.ts | Fantasy scoring enrichment box |
| server/enrichment/idpBox.ts | IDP stat enrichment box |

---

## 11. Voice — Tiber Voice System

MODULE.md: `server/voice/MODULE.md`

| File | Role |
|------|------|
| server/voice/intentParser.ts | Voice intent parsing |
| server/voice/reasons.ts | Voice reasoning engine |
| server/voice/dataAdapter.ts | Voice data adapter |
| server/voice/types.ts | Voice type definitions |
| server/voice/deciders.ts | Voice decision routing |
| server/voice/deciders/startSit.ts | Start/Sit voice decider |
| server/voice/deciders/trade.ts | Trade voice decider |
| server/voice/deciders/waiver.ts | Waiver voice decider |
| server/routes/voice.ts | Voice API routes |

---

## 12. Start/Sit — Recommendations

MODULE.md: `server/modules/startSit/MODULE.md`

### Backend

| File | Role |
|------|------|
| server/modules/startSit/startSitAgent.ts | Start/Sit recommendation agent |
| server/modules/startSit/dataAssembler.ts | Start/Sit data assembly |
| server/modules/startSit/testDataAssembler.ts | Start/Sit test data assembly |
| server/modules/startSitEngine.ts | Start/Sit engine (alt location) |

### Shared

| File | Role |
|------|------|
| shared/startSit.ts | Start/Sit shared types |
| shared/startSitHooks.ts | Start/Sit shared hook types |

### Frontend

| File | Role |
|------|------|
| client/src/components/StartSitQuick.tsx | Quick Start/Sit widget |

### Legacy (src/)

| File | Role |
|------|------|
| src/data/aggregator/startSitAggregator.ts | Start/Sit data aggregation |
| src/routes/startSitLiveRoutes.ts | Live Start/Sit routes |
| src/routes/startSitQuickRoutes.ts | Quick Start/Sit routes |

---

## 13. Metric Matrix — Player Vectors

MODULE.md: `server/modules/metricMatrix/MODULE.md`

### Backend

| File | Role |
|------|------|
| server/modules/metricMatrix/playerVectorService.ts | Player vector computation service |
| server/modules/metricMatrix/similarPlayersService.ts | Similar players finder service |
| server/modules/metricMatrix/tiersNeighborsService.ts | Tier neighbors service |
| server/modules/metricMatrix/leagueOwnershipService.ts | League ownership context service |
| server/modules/metricMatrix/__tests__/playerVectorService.test.ts | Player vector service tests |
| server/routes/metricMatrixRoutes.ts | Metric Matrix API routes |
| server/scripts/seedMetricMatrix.ts | Metric Matrix seed script |
| server/scripts/metricMatrixAudit.ts | Metric Matrix audit script |

### Frontend

| File | Role |
|------|------|
| client/src/components/metricMatrix/MetricMatrixCard.tsx | Metric Matrix display card |
| client/src/pages/MetricsDictionary.tsx | Metrics dictionary page |

---

## 14. OLC — Opponent-Level Context

MODULE.md: `server/olc/MODULE.md`

| File | Role |
|------|------|
| server/olc/index.ts | OLC module entry point |
| server/olc/adjusters.ts | OLC score adjusters |
| server/olc/cohesion.ts | OLC cohesion scoring |
| server/olc/logger.ts | OLC logging |
| server/olc/normalize.ts | OLC normalization utilities |
| server/olc/opponent.ts | Opponent analysis |
| server/olc/schema.ts | OLC data schema |
| server/olc/score.ts | OLC score computation |
| server/olc/sources.ts | OLC data sources |

---

## 15. Platform Sync — External Platforms

MODULE.md: `server/platformSync/MODULE.md`

| File | Role |
|------|------|
| server/platformSync/index.ts | Platform Sync entry point |
| server/platformSync/adapters/sleeperAdapter.ts | Sleeper platform adapter |
| server/platformSync/adapters/espnAdapter.ts | ESPN platform adapter |
| server/platformSync/adapters/yahooAdapter.ts | Yahoo platform adapter |
| server/platformSync/adapters/nflAdapter.ts | NFL.com platform adapter |
| server/platformSync/adapters/mysportsfeedsAdapter.ts | MySportsFeeds platform adapter |

---

## 16. Guardian — Data Quality

MODULE.md: none

| File | Role |
|------|------|
| server/guardian/noiseShield.ts | Data quality noise filtering |

---

## 17. Prediction Engine — Predictions

MODULE.md: none

| File | Role |
|------|------|
| server/services/predictionEngine.ts | Weekly prediction generation engine |

---

## 18. RAG / Chat — AI Chat System

MODULE.md: none

| File | Role |
|------|------|
| server/services/geminiEmbeddings.ts | Gemini embeddings for RAG |
| server/routes/ragRoutes.ts | RAG API routes |
| server/services/tiberService.ts | Tiber chat service |
| server/services/tiberPromptBuilder.ts | Tiber prompt construction |
| server/routes/tiberRoutes.ts | Tiber chat routes |
| server/routes/tiberDataRoutes.ts | Tiber data routes |
| server/scripts/embed-brain-os.ts | Brain OS embedding script |
| server/scripts/embed-theory.ts | Theory embedding script |
| server/scripts/embed-waiver-wisdom.ts | Waiver wisdom embedding script |
| server/scripts/seedPatternChunks.ts | Pattern chunk seeding for RAG |
| server/lib/format-detector.ts | Chat format detection |
| server/lib/responsePostProcessors.ts | Chat response post-processing |
| server/services/river-detection.ts | River layer consciousness detection |
| server/backups/system-prompt-backup-pre-three-layer.ts | System prompt backup |
| shared/models/chat.ts | Chat data models |
| client/src/pages/ChatHomepage.tsx | Chat homepage (legacy chat UI) |
| client/src/pages/RagStatus.tsx | RAG status dashboard page |
| client/src/components/TiberChat.tsx | Tiber chat component |
| client/src/components/TiberInsights.tsx | Tiber AI insights component |
| client/src/components/TiberBadge.tsx | Tiber branding badge |
| client/src/components/tiber/TiberScoreCard.tsx | Tiber score card component |

### Replit Integrations (Chat)

| File | Role |
|------|------|
| server/replit_integrations/chat/index.ts | Chat integration entry point |
| server/replit_integrations/chat/routes.ts | Chat integration routes |
| server/replit_integrations/chat/storage.ts | Chat integration storage |

---

## 19. ECR — Expert Consensus Rankings

MODULE.md: none

| File | Role |
|------|------|
| server/services/ecrLoader.ts | ECR data loader |
| server/services/ecrService.ts | ECR ranking service |
| server/services/enhancedEcrProvider.ts | Enhanced ECR data provider |
| server/adapters/ECRAdapter.ts | ECR data adapter |
| scripts/test-ecr-pipeline.ts | ECR pipeline test script |

---

## 20. Tiber Memory — AI Memory Pools

MODULE.md: none

| File | Role |
|------|------|
| server/services/tiberMemoryManager.ts | Tiber memory pool manager |
| server/routes/tiberMemoryRoutes.ts | Tiber memory API routes |

---

## 21. Compass — Player Compass Profiles

MODULE.md: none

| File | Role |
|------|------|
| server/compassCalculations.ts | Compass score calculations |
| server/compassDataAdapter.ts | Compass data adapter |
| server/playerCompass.ts | Player compass profile generator |
| server/rbCompassCalculations.ts | RB compass calculations |
| server/rbCompassDataAdapter.ts | RB compass data adapter |
| server/rbPlayerCompass.ts | RB player compass profiles |
| server/services/playerCompassService.ts | Player compass service |
| server/services/playerCompassPlayerService.ts | Compass player-level service |
| server/routes/compassRoutes.ts | Compass API routes (general) |
| server/routes/compassWrRoute.ts | WR compass routes |
| server/routes/compassRbRoute.ts | RB compass routes |
| server/routes/compassQbRoute.ts | QB compass routes |
| server/routes/compassTeRoute.ts | TE compass routes |
| server/routes/compassCompareRoutes.ts | Compass comparison routes |
| client/src/components/PositionCompassTable.tsx | Position compass table |
| client/src/components/WRCompass.tsx | WR compass visualization |
| client/src/components/WRCompassTable.tsx | WR compass data table |
| client/src/components/QBCompassTable.tsx | QB compass data table |
| client/src/components/RBCompassTable.tsx | RB compass data table |
| client/src/components/TECompassTable.tsx | TE compass data table |

---

## 22. Rankings — Various Ranking Pages/Services

MODULE.md: none

### Backend

| File | Role |
|------|------|
| server/advancedRankings.ts | Advanced rankings calculations |
| server/services/rankingsFusionService.ts | Rankings fusion service |
| server/services/roleBankService.ts | Role Bank rankings service |
| server/routes/roleBankRoutes.ts | Role Bank API routes |
| server/routes/redraftRoutes.ts | Redraft rankings routes |
| server/routes/redraftWeeklyRoutes.ts | Weekly redraft routes |
| server/routes/populationStatsRoutes.ts | Population stats routes |
| server/scripts/computeAllWRRoleBank.ts | Compute all WR Role Bank |
| server/scripts/computeAllRBRoleBank.ts | Compute all RB Role Bank |
| server/scripts/computeAllTERoleBank.ts | Compute all TE Role Bank |
| server/scripts/computeAllQBRoleBank.ts | Compute all QB Role Bank |
| server/scripts/validateRankings.ts | Rankings validation script |

### Frontend — Pages

| File | Role |
|------|------|
| client/src/pages/RankingsHub.tsx | Rankings hub page |
| client/src/pages/WRRankings.tsx | WR rankings page |
| client/src/pages/WRRankingsSandbox.tsx | WR rankings sandbox |
| client/src/pages/RBRankings.tsx | RB rankings page |
| client/src/pages/QBRankings.tsx | QB rankings page |
| client/src/pages/QBRankingsSandbox.tsx | QB rankings sandbox |
| client/src/pages/TERankings.tsx | TE rankings page |
| client/src/pages/RoleContextRankings.tsx | Role context rankings page |
| client/src/pages/LeadersPage.tsx | Leaders/top performers page |

### Frontend — Components

| File | Role |
|------|------|
| client/src/components/RankingsList.tsx | Rankings list component |
| client/src/components/RankingsTable.tsx | Rankings data table |
| client/src/components/RoleBankRankings.tsx | Role Bank rankings display |
| client/src/components/WRAnalyticsTable.tsx | WR analytics table |
| client/src/components/RBAnalyticsTable.tsx | RB analytics table |
| client/src/components/QBAnalyticsTable.tsx | QB analytics table |
| client/src/components/TEAnalyticsTable.tsx | TE analytics table |
| client/src/components/WRFormulaWeightsPanel.tsx | WR formula weights panel |
| client/src/components/RBFormulaWeightsPanel.tsx | RB formula weights panel |
| client/src/components/UsageLeaders.tsx | Usage leaders display |

### Frontend — Lib

| File | Role |
|------|------|
| client/src/lib/dynastyTiers.ts | Dynasty tier definitions |
| client/src/lib/redraftApi.ts | Redraft rankings API client |

---

## 23. Trade — Trade Analysis

MODULE.md: none

| File | Role |
|------|------|
| server/services/trade/evaluateTradePackage.ts | Trade package evaluation |
| server/services/trade/tradeLogic.ts | Trade logic/calculations |
| server/api/trade-eval/index.ts | Trade evaluation API |
| server/routes/tradeAnalyzerRoutes.ts | Trade analyzer routes |

---

## 24. Waiver — Waiver Recommendations

MODULE.md: none

| File | Role |
|------|------|
| server/services/waiverWisdomEngine.ts | Waiver wisdom recommendation engine |
| server/scripts/buildWaiverCandidates.ts | Waiver candidate builder script |
| client/src/components/WaiversList.tsx | Waivers list component |

---

## 25. DST Streamer — Defense Streaming

MODULE.md: none

| File | Role |
|------|------|
| server/modules/dstStreamer.ts | DST streaming recommendation module |

---

## 26. Sleeper Sync — Sleeper Platform Integration

MODULE.md: none

### Backend — Core Sync

| File | Role |
|------|------|
| server/integrations/sleeperClient.ts | Sleeper API client |
| server/services/sleeperSyncService.ts | Sleeper sync orchestration service |
| server/services/sleeperLeagueSync.ts | Sleeper league sync service |
| server/services/sleeperLiveStatusSync.ts | Sleeper live status sync |
| server/services/sleeperDataNormalizationService.ts | Sleeper data normalization |
| server/services/sleeperProjectionsService.ts | Sleeper projections service |
| server/services/sleeperSnapService.ts | Sleeper snap count service |
| server/services/sleeperSnapPipeline.ts | Sleeper snap pipeline |
| server/services/rosterSync.ts | Roster sync service |
| server/routes/leagueSyncRoutes.ts | League sync API routes |
| server/routes/sleeperSyncV2Routes.ts | Sleeper Sync v2 routes |
| server/scripts/runSleeperSync.ts | Run Sleeper sync script |
| server/scripts/ingestSleeperOwnership.ts | Ingest Sleeper ownership data |
| server/leagueImport.ts | League import utilities |
| server/leagueSync.ts | Legacy league sync |
| server/expandedSleeperCollector.ts | Expanded Sleeper data collector |

### Backend — Sleeper Sync v2

| File | Role |
|------|------|
| server/services/sleeperSyncV2/index.ts | Sleeper Sync v2 entry point |
| server/services/sleeperSyncV2/syncService.ts | Sleeper Sync v2 service |
| server/services/sleeperSyncV2/identityResolver.ts | Sleeper Sync v2 identity resolver |
| server/services/sleeperSyncV2/rosterDiff.ts | Sleeper Sync v2 roster diff |
| server/services/sleeperSyncV2/scheduler.ts | Sleeper Sync v2 scheduler |

### Backend — Sleeper Sync Tests

| File | Role |
|------|------|
| server/routes/__tests__/leagueSyncRoutes.test.ts | League sync route tests |
| server/services/__tests__/rosterDiff.test.ts | Roster diff tests |

### Frontend

| File | Role |
|------|------|
| client/src/components/SyncLeagueModal.tsx | League sync modal UI |
| client/src/hooks/useLeagueContext.ts | League context hook |

### Legacy (src/)

| File | Role |
|------|------|
| src/data/providers/sleeper.ts | Sleeper data provider |
| src/data/providers/sleeperLeagues.ts | Sleeper leagues provider |

---

## 27. Frontend Core — Layout, Navigation, Hooks, Lib, Shared Components, UI

### Entry / Routing

| File | Role |
|------|------|
| client/src/main.tsx | React app entry point |
| client/src/App.tsx | All frontend routes (wouter) |

### Layout / Navigation

| File | Role |
|------|------|
| client/src/components/TiberLayout.tsx | Main sidebar layout (220px fixed) |
| client/src/components/Navigation.tsx | Navigation component |
| client/src/components/mobile-nav.tsx | Mobile navigation |
| client/src/config/nav.ts | Navigation configuration |

### Hooks

| File | Role |
|------|------|
| client/src/hooks/use-mobile.tsx | Mobile detection hook |
| client/src/hooks/use-toast.ts | Toast notification hook |
| client/src/hooks/useCurrentNFLWeek.ts | Current NFL week hook |
| client/src/hooks/useDebounce.ts | Debounce utility hook |
| client/src/hooks/useFounderMode.ts | Founder mode toggle hook |
| client/src/hooks/useNav.ts | Navigation hook |
| client/src/hooks/usePlayerNames.ts | Player names lookup hook |
| client/src/hooks/usePlayerPool.ts | Player pool data hook |
| client/src/hooks/useTopProgress.tsx | Top progress bar hook |

### Lib / Utilities

| File | Role |
|------|------|
| client/src/lib/apiClient.ts | API client for backend requests |
| client/src/lib/queryClient.ts | TanStack Query client setup |
| client/src/lib/utils.ts | General utility functions |
| client/src/lib/fetchWithProgress.ts | Fetch with progress indicator |
| client/src/lib/nameResolver.ts | Player name resolution |
| client/src/lib/normalize.ts | Data normalization utilities |
| client/src/lib/playerPool.ts | Player pool utilities |
| client/src/lib/pulseUtils.ts | Pulse (trend) utility functions |
| client/src/lib/recentPlayers.ts | Recent players tracking |
| client/src/lib/unifiedApi.ts | Unified API client |

### State

| File | Role |
|------|------|
| client/src/state/founderMode.ts | Founder mode global state |

### Data Adapters

| File | Role |
|------|------|
| client/src/data/adapters.ts | Frontend data adapters |

### Pages — General

| File | Role |
|------|------|
| client/src/pages/Dashboard.tsx | Homepage dashboard |
| client/src/pages/TiberDashboard.tsx | Tiber dashboard page |
| client/src/pages/AnalyticsPage.tsx | Analytics overview page |
| client/src/pages/Architecture.tsx | Architecture visualization page |
| client/src/pages/not-found.tsx | 404 not found page |
| client/src/pages/admin/HomepageRedesign.tsx | Admin homepage redesign page |
| client/src/pages/admin/ApiLexicon.tsx | Admin API lexicon page |
| client/src/pages/admin/PlayerResearch.tsx | Admin player research page |

### Shared Components

| File | Role |
|------|------|
| client/src/components/shared/ComingSoon.tsx | Coming soon placeholder |
| client/src/components/Button.tsx | Custom button component |
| client/src/components/Section.tsx | Section layout component |
| client/src/components/GlowCard.tsx | Glow effect card |
| client/src/components/GlowCTA.tsx | Glow CTA button |
| client/src/components/Skeleton.tsx | Loading skeleton |
| client/src/components/Footer.tsx | Page footer |
| client/src/components/FounderModal.tsx | Founder mode modal |
| client/src/components/SystemCard.tsx | System status card |
| client/src/components/TeamLogo.tsx | NFL team logo component |
| client/src/components/data-attribution-footer.tsx | Data attribution footer |
| client/src/components/signal-footer.tsx | Signal footer component |
| client/src/components/view-sources-modal.tsx | View sources modal |

### Player Components

| File | Role |
|------|------|
| client/src/components/EnhancedPlayerCard.tsx | Enhanced player card |
| client/src/components/PlayerRow.tsx | Player row component |
| client/src/components/PlayerSearchBar.tsx | Player search bar |
| client/src/components/player-search.tsx | Player search component |
| client/src/components/PlayerDetailDrawer.tsx | Player detail side drawer |
| client/src/components/PlayerGameCard.tsx | Player game card |
| client/src/components/PlayerAnalyticsChart.tsx | Player analytics chart |
| client/src/components/PlayerNFLAnalytics.tsx | Player NFL analytics view |
| client/src/components/PaginatedPlayerTable.tsx | Paginated player table |
| client/src/components/player-recommendations.tsx | Player recommendations |
| client/src/components/performance-chart.tsx | Performance chart |
| client/src/components/AnalyticsTable.tsx | Analytics data table |
| client/src/components/WeeklyDataTable.tsx | Weekly data table |
| client/src/components/HealthBadge.tsx | Health status badge |
| client/src/components/HealthBar.tsx | Health bar visualization |
| client/src/components/HealthWidget.tsx | Health widget |
| client/src/components/PreseasonIntel.tsx | Preseason intel display |
| client/src/components/RookieClass2025.tsx | 2025 rookie class display |
| client/src/components/RookieSpotlight.tsx | Rookie spotlight component |
| client/src/components/ADPStatusIndicator.tsx | ADP status indicator |
| client/src/components/position-analysis.tsx | Position analysis component |
| client/src/components/fantasy-lineup.tsx | Fantasy lineup display |
| client/src/components/team-overview.tsx | Team overview component |

### Player Pages

| File | Role |
|------|------|
| client/src/pages/PlayerPage.tsx | Individual player profile page |
| client/src/pages/PlayerComparePilot.tsx | Player comparison pilot page |
| client/src/pages/MatchupsPage.tsx | Matchups analysis page |
| client/src/pages/TeamReportsPage.tsx | Team reports page |

### Tab Components

| File | Role |
|------|------|
| client/src/components/tabs/AdminTab.tsx | Admin tab content |
| client/src/components/tabs/HomeTab.tsx | Home tab content |
| client/src/components/tabs/LeaguesTab.tsx | Leagues tab content |
| client/src/components/tabs/MatchupsTab.tsx | Matchups tab content |
| client/src/components/tabs/MovesTab.tsx | Moves tab content |
| client/src/components/tabs/PlaybookTab.tsx | Playbook tab content |
| client/src/components/tabs/RankingsTab.tsx | Rankings tab content |
| client/src/components/tabs/StrategyTab.tsx | Strategy tab content |
| client/src/components/tabs/WeeklyTakesTab.tsx | Weekly takes tab content |

### UI Components (shadcn/ui)

| File | Role |
|------|------|
| client/src/components/ui/accordion.tsx | Accordion UI component |
| client/src/components/ui/alert-dialog.tsx | Alert dialog UI component |
| client/src/components/ui/alert.tsx | Alert UI component |
| client/src/components/ui/aspect-ratio.tsx | Aspect ratio UI component |
| client/src/components/ui/avatar.tsx | Avatar UI component |
| client/src/components/ui/badge.tsx | Badge UI component |
| client/src/components/ui/breadcrumb.tsx | Breadcrumb UI component |
| client/src/components/ui/button.tsx | Button UI component |
| client/src/components/ui/calendar.tsx | Calendar UI component |
| client/src/components/ui/card.tsx | Card UI component |
| client/src/components/ui/carousel.tsx | Carousel UI component |
| client/src/components/ui/chart.tsx | Chart UI component |
| client/src/components/ui/checkbox.tsx | Checkbox UI component |
| client/src/components/ui/collapsible.tsx | Collapsible UI component |
| client/src/components/ui/command.tsx | Command palette UI component |
| client/src/components/ui/context-menu.tsx | Context menu UI component |
| client/src/components/ui/dialog.tsx | Dialog UI component |
| client/src/components/ui/drawer.tsx | Drawer UI component |
| client/src/components/ui/dropdown-menu.tsx | Dropdown menu UI component |
| client/src/components/ui/form.tsx | Form UI component |
| client/src/components/ui/hover-card.tsx | Hover card UI component |
| client/src/components/ui/input-otp.tsx | OTP input UI component |
| client/src/components/ui/input.tsx | Input UI component |
| client/src/components/ui/label.tsx | Label UI component |
| client/src/components/ui/menubar.tsx | Menubar UI component |
| client/src/components/ui/navigation-menu.tsx | Navigation menu UI component |
| client/src/components/ui/pagination.tsx | Pagination UI component |
| client/src/components/ui/popover.tsx | Popover UI component |
| client/src/components/ui/progress.tsx | Progress bar UI component |
| client/src/components/ui/radio-group.tsx | Radio group UI component |
| client/src/components/ui/resizable.tsx | Resizable panel UI component |
| client/src/components/ui/scroll-area.tsx | Scroll area UI component |
| client/src/components/ui/select.tsx | Select UI component |
| client/src/components/ui/separator.tsx | Separator UI component |
| client/src/components/ui/sheet.tsx | Sheet UI component |
| client/src/components/ui/sidebar.tsx | Sidebar UI component |
| client/src/components/ui/skeleton.tsx | Skeleton loader UI component |
| client/src/components/ui/slider.tsx | Slider UI component |
| client/src/components/ui/switch.tsx | Switch UI component |
| client/src/components/ui/table.tsx | Table UI component |
| client/src/components/ui/tabs.tsx | Tabs UI component |
| client/src/components/ui/textarea.tsx | Textarea UI component |
| client/src/components/ui/toast.tsx | Toast UI component |
| client/src/components/ui/toaster.tsx | Toaster container UI component |
| client/src/components/ui/toggle-group.tsx | Toggle group UI component |
| client/src/components/ui/toggle.tsx | Toggle UI component |
| client/src/components/ui/tooltip.tsx | Tooltip UI component |
| client/src/components/ui/Username.tsx | Username display UI component |

### Replit Integrations (Audio)

| File | Role |
|------|------|
| client/replit_integrations/audio/audio-utils.ts | Audio utility functions |
| client/replit_integrations/audio/index.ts | Audio integration entry point |
| client/replit_integrations/audio/useAudioPlayback.ts | Audio playback hook |
| client/replit_integrations/audio/useVoiceRecorder.ts | Voice recorder hook |
| client/replit_integrations/audio/useVoiceStream.ts | Voice streaming hook |

---

## 28. Backend Core — Routes, Storage, Middleware, Infra, Config, Schemas

### Entry / Core

| File | Role |
|------|------|
| server/index.ts | Express server entry point |
| server/routes.ts | Monolith route file (228 routes, ~10k lines) |
| server/storage.ts | Storage interface (IStorage) |
| server/routes-backup.ts | Routes backup |
| server/routes-debug.ts | Debug routes |
| server/routes-deprecated-backup.ts | Deprecated routes backup |

### Infrastructure

| File | Role |
|------|------|
| server/infra/db.ts | Database connection (Drizzle + PostgreSQL) |
| server/infra/apiRegistry.ts | API endpoint registry |

### Middleware

| File | Role |
|------|------|
| server/middleware/adminAuth.ts | Admin authentication middleware |
| server/middleware/rateLimit.ts | Rate limiting middleware |
| server/middleware/security.ts | Security middleware |
| server/middleware/signature.ts | Request signature middleware |

### Schemas

| File | Role |
|------|------|
| server/schemas/adminSchemas.ts | Admin API validation schemas |

### Config

| File | Role |
|------|------|
| server/config/forgeSeason.ts | Season configuration (also FORGE) |

### Init / Setup

| File | Role |
|------|------|
| server/init/setupDatabase.ts | Database setup/initialization |

### Cron Jobs

| File | Role |
|------|------|
| server/cron/injurySync.ts | Injury data sync cron |
| server/cron/rbContextCheck.ts | RB context check cron |
| server/cron/scheduleSync.ts | Schedule sync cron |
| server/cron/weeklyUpdate.ts | Weekly update cron |

### Data Sources / Clients

| File | Role |
|------|------|
| server/data/adpClient.ts | ADP data client |
| server/data/injuryClient.ts | Injury data client |
| server/data/newsClient.ts | News data client |
| server/data/sources/alignments.ts | Alignment data source |
| server/data/sources/defenseSplits.ts | Defense splits data source |
| server/data/sources/vegas.ts | Vegas lines data source |
| server/data/sources/weather.ts | Weather data source |

### Adapters

| File | Role |
|------|------|
| server/adapters/MySportsFeedsAdapter.ts | MySportsFeeds data adapter |
| server/adapters/NFLDataPyAdapter.ts | NFL Data Py adapter |
| server/adapters/SleeperAdapter.ts | Sleeper data adapter |

### Library / Utilities

| File | Role |
|------|------|
| server/lib/advancedMetricRegistry.ts | Advanced metric registry |
| server/lib/dataAvailability.ts | Data availability checker |
| server/lib/scoring.ts | Scoring utility functions |
| server/lib/timebox.ts | Timebox utility |
| server/lib/weekly-data.ts | Weekly data helpers |
| server/lib/weeklyStatsHelpers.ts | Weekly stats helper functions |

### Processors

| File | Role |
|------|------|
| server/processors/DepthChartsProcessor.ts | Depth chart processing |
| server/processors/InjuriesProcessor.ts | Injury data processing |
| server/processors/MarketSignalsProcessor.ts | Market signals processing |
| server/processors/PlayersDimProcessor.ts | Players dimension processing |
| server/processors/TeamsDimProcessor.ts | Teams dimension processing |
| server/processors/facts/CompositeFactsProcessor.ts | Composite facts processing |
| server/processors/facts/MarketFactsProcessor.ts | Market facts processing |
| server/processors/facts/SeasonFactsProcessor.ts | Season facts processing |
| server/processors/facts/WeeklyFactsProcessor.ts | Weekly facts processing |

### Routes — General / Cross-cutting

| File | Role |
|------|------|
| server/routes/adpRoutes.ts | ADP data routes |
| server/routes/analyticsRoutes.ts | Analytics routes |
| server/routes/articleRoutes.ts | Article routes |
| server/routes/attributesRoutes.ts | Player attributes routes |
| server/routes/buysSellsRoutes.ts | Buys/sells routes |
| server/routes/competence.ts | Competence routes |
| server/routes/debug-calculation.ts | Debug calculation routes |
| server/routes/debug/week-summary.ts | Weekly summary debug routes |
| server/routes/dynastyRoutes.ts | Dynasty routes |
| server/routes/gameLogRoutes.ts | Game log routes |
| server/routes/leagueDashboardRoutes.ts | League dashboard routes |
| server/routes/matchupRoutes.ts | Matchup routes |
| server/routes/playerComparePilotRoutes.ts | Player comparison pilot routes |
| server/routes/playerComparisonRoutes.ts | Player comparison routes |
| server/routes/powerProcessing.ts | Power processing routes |
| server/routes/public.ts | Public routes |
| server/routes/rookieEvaluationRoutes.ts | Rookie evaluation routes |
| server/routes/rookieRoutes.ts | Rookie routes |
| server/routes/strategyRoutes.ts | Strategy routes |
| server/routes/teamReportsRoutes.ts | Team reports routes |
| server/routes/teCompassRoutes.ts | TE compass routes (also Compass) |
| server/routes/uphAdminRoutes.ts | UPH admin routes |
| server/routes/userIntegrationRoutes.ts | User integration routes |
| server/routes/weeklyTakesRoutes.ts | Weekly takes routes |
| server/routes/rbCompassRoutes.ts | RB compass routes (also Compass) |

### Routes — Tests

| File | Role |
|------|------|
| server/routes/__tests__/leagueDashboardRoutes.test.ts | League dashboard routes tests |
| server/routes/__tests__/userIntegrationRoutes.test.ts | User integration routes tests |

### Services — General

| File | Role |
|------|------|
| server/services/AdminService.ts | Admin service |
| server/services/AttributesService.ts | Player attributes service |
| server/services/BrandBus.ts | Brand event bus |
| server/services/BrandSignalsBootstrap.ts | Brand signals bootstrap |
| server/services/BrandSignalsIntegration.ts | Brand signals integration |
| server/services/defenseVsPositionService.ts | Defense vs position analysis |
| server/services/depthChartService.ts | Depth chart service |
| server/services/injurySyncService.ts | Injury sync service |
| server/services/IntelligentScheduler.ts | Intelligent scheduling service |
| server/services/leagueDashboardService.ts | League dashboard service |
| server/services/logsProjectionsService.ts | Logs/projections service |
| server/services/marketEngine.ts | Market engine |
| server/services/matchupAnalyzer.ts | Matchup analysis service |
| server/services/MonitoringService.ts | System monitoring service |
| server/services/nextManUpService.ts | Next man up service |
| server/services/nflfastrValidation.ts | NFLfastR validation service |
| server/services/playerAdvancedService.ts | Player advanced stats service |
| server/services/playerComparisonService.ts | Player comparison service |
| server/services/qwenPlayerService.ts | Qwen player service |
| server/services/rbContextCheck.ts | RB context check service |
| server/services/rbProjectionsService.ts | RB projections service |
| server/services/riskEngine.ts | Risk engine |
| server/services/rookieEvaluationService.ts | Rookie evaluation service |
| server/services/rookieStorageService.ts | Rookie storage service |
| server/services/SchemaDriftService.ts | Schema drift detection |
| server/services/SeasonService.ts | Season management service |
| server/services/seedArticles.ts | Article seed service |
| server/services/snapCountService.ts | Snap count service |
| server/services/teamEnvironmentService.ts | Team environment service |

### Services — System

| File | Role |
|------|------|
| server/services/system/featureAuditService.ts | Feature audit service |
| client/src/components/admin/SystemIntegrityCard.tsx | System integrity admin card |

### Services — Quality

| File | Role |
|------|------|
| server/services/quality/ConfidenceScorer.ts | Confidence scoring |
| server/services/quality/DataLineageTracker.ts | Data lineage tracking |
| server/services/quality/QualityConfig.ts | Quality configuration |
| server/services/quality/QualityGateValidator.ts | Quality gate validation |
| server/services/quality/__tests__/QualityIntegrationTest.ts | Quality integration tests |

### Services — Projections

| File | Role |
|------|------|
| server/services/projections/ingestProjections.ts | Projections ingestion |
| server/services/projections/sleeperProjectionsPipeline.ts | Sleeper projections pipeline |
| server/services/projections/sleeperProjectionsService.ts | Sleeper projections service |
| server/services/projections/sleeperSourceManager.ts | Sleeper source manager |

### Services — Ownership

| File | Role |
|------|------|
| server/services/ownership/ownershipService.ts | Player ownership service |
| server/services/ownership/__tests__/ownershipService.test.ts | Ownership service tests |

### Services — Tests

| File | Role |
|------|------|
| server/services/__tests__/leagueDashboardService.test.ts | League dashboard service tests |

### Replit Integrations (Server)

| File | Role |
|------|------|
| server/replit_integrations/audio/client.ts | Audio integration client |
| server/replit_integrations/audio/index.ts | Audio integration entry |
| server/replit_integrations/audio/routes.ts | Audio integration routes |
| server/replit_integrations/batch/index.ts | Batch integration entry |
| server/replit_integrations/batch/utils.ts | Batch integration utilities |
| server/replit_integrations/image/client.ts | Image integration client |
| server/replit_integrations/image/index.ts | Image integration entry |
| server/replit_integrations/image/routes.ts | Image integration routes |

### Metrics

| File | Role |
|------|------|
| server/metrics/registry.ts | Metrics registry |

### Plugins

| File | Role |
|------|------|
| server/plugins/redraftBuySell.ts | Redraft buys/sells plugin |
| server/plugins/rookieRisers.ts | Rookie risers plugin |

### Server — Standalone Analytics / Evaluation

| File | Role |
|------|------|
| server/analytics.ts | Analytics utilities |
| server/analyticsInventory.ts | Analytics inventory |
| server/advancedAnalytics.ts | Advanced analytics calculations |
| server/compute.ts | Computation utilities |
| server/playerAnalysisCache.ts | Player analysis caching |
| server/playerFiltering.ts | Player filtering logic |
| server/playerPool.ts | Player pool management |
| server/espnAPI.ts | ESPN API integration |
| server/nflDataPyAPI.ts | NFL Data Py API bridge |
| server/dataIntegrityFixer.ts | Data integrity repair |

### Server — ADP

| File | Role |
|------|------|
| server/adp/cache.ts | ADP cache |
| server/adp/sleeper.ts | Sleeper ADP data |
| server/adpSyncService.ts | ADP sync service |
| server/adpAccuracyValidator.ts | ADP accuracy validation |
| server/cleanADPService.ts | Clean ADP service |
| server/realTimeADPService.ts | Real-time ADP service |

### Server — Dynasty

| File | Role |
|------|------|
| server/dynastyDeclineDetection.ts | Dynasty decline detection |
| server/dynastyScoringAlgorithm.ts | Dynasty scoring algorithm |
| server/dynastyValuation.ts | Dynasty valuation |
| server/enhancedDynastyScoringAlgorithm.ts | Enhanced dynasty scoring |
| server/expandedDynastyDatabase.ts | Expanded dynasty database |
| server/expandedPlayerDatabase.ts | Expanded player database |

### Server — QB/RB/WR Evaluation

| File | Role |
|------|------|
| server/qbEnvironmentContextScore.ts | QB environment context scoring |
| server/qbEvaluationLogic.ts | QB evaluation logic |
| server/rbDraftCapitalContext.ts | RB draft capital context |
| server/rbPopulationStats.ts | RB population statistics |
| server/rbTouchdownRegression.ts | RB touchdown regression |
| server/rbTouchdownSustainability.ts | RB touchdown sustainability |
| server/wrEvaluationForecastScore.ts | WR evaluation forecast score |
| server/wrTouchdownRegression.ts | WR touchdown regression |
| server/vorp_calculator.ts | VORP calculator (underscore) |
| server/vorpCalculator.ts | VORP calculator (camelCase) |
| server/clean-vorp-endpoint.ts | Clean VORP endpoint |
| server/accuracyValidator.ts | Accuracy validation |
| server/debug-projections.ts | Debug projections utility |
| server/exportRBProjections.ts | Export RB projections |

### Server — Ratings

| File | Role |
|------|------|
| server/ratings/score.ts | Ratings score calculations |
| server/src/modules/ratings/ratingsCalculations.ts | Ratings calculations module |
| server/src/modules/ratings/ratingsConfig.ts | Ratings configuration |
| server/src/modules/ratings/ratingsService.ts | Ratings service |
| server/src/modules/ratings/ratingsTypes.ts | Ratings type definitions |
| server/src/db/index.ts | Database index (alt location) |
| server/src/db/migrations/0001_initial_schema.ts | Initial schema migration |

### Server — Benchmark / Stress Test

| File | Role |
|------|------|
| server/prometheusBenchmarkCluster.ts | Prometheus benchmark cluster |
| server/prometheusStressTest.ts | Prometheus stress test |

### Server — Competence

| File | Role |
|------|------|
| server/competence/charter.ts | Competence charter |

### Server — Batch Inputs

| File | Role |
|------|------|
| server/batchInputs/qbs2024.ts | 2024 QB batch input data |

### Server — Team Analytics

| File | Role |
|------|------|
| server/modules/team-analytics/dataLoader.ts | Team analytics data loader |

### Server — Scripts (Misc)

| File | Role |
|------|------|
| server/scripts/backfillSnapSharePct.ts | Backfill snap share percentage |
| server/scripts/backfillWeeklyUsage.ts | Backfill weekly usage data |
| server/scripts/importSnapCounts.ts | Import snap counts |
| server/scripts/syncAdvancedRegistryFields.ts | Sync advanced registry fields |
| server/scripts/validateTiberActual.ts | Validate Tiber actual data |
| server/scripts/validateTiberWeek6.ts | Validate Tiber Week 6 data |
| server/scripts/qaGoldDatadiveSanityCheck.ts | QA gold DataDive sanity check |

### Server — API Test/Debug Files

| File | Role |
|------|------|
| server/api/check-weekly-projections.ts | Check weekly projections |
| server/api/debug-sleeper-data.ts | Debug Sleeper data |
| server/api/export-positional-game-logs.ts | Export positional game logs |
| server/api/generate-wr-snap-data.ts | Generate WR snap data |
| server/api/parse-full-game-logs.ts | Parse full game logs |
| server/api/projections-analysis.ts | Projections analysis |
| server/api/sleeper-2024-direct-test.ts | Sleeper 2024 direct test |
| server/api/sleeper-pipeline-test.ts | Sleeper pipeline test |
| server/api/sleeper-test.ts | Sleeper test |
| server/api/test-2024-projections.ts | Test 2024 projections |
| server/api/test-adp-conversion.ts | Test ADP conversion |
| server/api/test-nfl-stats-direct.ts | Test NFL stats direct |
| server/api/test-real-data.ts | Test real data |
| server/api/test-real-data-validation.ts | Test real data validation |
| server/api/test-snap-percentages.ts | Test snap percentages |
| server/api/verify-2024-game-logs.ts | Verify 2024 game logs |
| server/api/weekly-projections-test.ts | Weekly projections test |

### Server — Test Data / Tests

| File | Role |
|------|------|
| server/tests/setup.ts | Test setup |
| server/test-data/testConsensusData.ts | Test consensus data |

---

## 29. Shared — Schema, Types, Config

MODULE.md: none

| File | Role |
|------|------|
| shared/schema.ts | Master database schema (131 tables, Drizzle models, types) |
| shared/config/seasons.ts | Season configuration |
| shared/models/chat.ts | Chat data models |
| shared/startSit.ts | Start/Sit shared types |
| shared/startSitHooks.ts | Start/Sit hook types |
| shared/tiberSignature.ts | Tiber signature/branding |
| shared/weekDetection.ts | NFL week detection utility |
| shared/types/adaptiveConsensus.ts | Adaptive consensus types |
| shared/types/competence.ts | Competence types |
| shared/types/consensus.ts | Consensus types |
| shared/types/consensusSeeding.ts | Consensus seeding types |
| shared/types/fantasy.ts | Fantasy shared types |
| shared/types/tiber.ts | Tiber shared types |
| domain/events.ts | Domain event definitions |

---

## 30. Other / Uncategorized

### Root-Level Config

| File | Role |
|------|------|
| drizzle.config.ts | Drizzle ORM configuration |
| tailwind.config.ts | Tailwind CSS configuration |
| vite.config.ts | Vite bundler configuration |

### Root-Level Scripts

| File | Role |
|------|------|
| scripts/buildPlayerPool.ts | Build player pool script |
| scripts/enable_vector_extension.ts | Enable pgvector extension |
| scripts/pingEndpoints.ts | Ping API endpoints health check |

### Root-Level Test Files

| File | Role |
|------|------|
| test-rookie-evaluation.ts | Rookie evaluation test |

### Legacy `src/` Directory

| File | Role |
|------|------|
| src/data/cache.ts | Data caching layer |
| src/data/interfaces.ts | Data interface definitions |
| src/data/normalizers/matchup.ts | Matchup data normalizer |
| src/data/normalizers/news.ts | News data normalizer |
| src/data/normalizers/usage.ts | Usage data normalizer |
| src/data/normalizers/volatility.ts | Volatility data normalizer |
| src/data/providers/context.ts | Context data provider |
| src/data/providers/news.ts | News data provider |
| src/data/providers/vegas.ts | Vegas data provider |
| src/data/resolvers/playerResolver.ts | Player resolver |
| src/modules/studs.ts | Studs module |
| src/routes/leagueAssistRoutes.ts | League assist routes |

### Trash / Archived

| File | Role |
|------|------|
| .trash/phase1/BatchEvaluationTest.tsx | Archived batch evaluation test |
| .trash/phase1/TEEvaluationTest.tsx | Archived TE evaluation test |

---

## Summary

| Feature Group | File Count |
|---------------|------------|
| FORGE | ~55 |
| LLM Gateway | 9 |
| X Intelligence | 2 |
| Data Lab / DataDive | 5 |
| OVR System | 7 |
| SoS | 15 |
| Consensus | 20 |
| Player Identity | 14 |
| ETL Pipeline | 16 |
| Enrichment | 6 |
| Voice | 9 |
| Start/Sit | 8 |
| Metric Matrix | 10 |
| OLC | 9 |
| Platform Sync | 6 |
| Guardian | 1 |
| Prediction Engine | 1 |
| RAG / Chat | 21 |
| ECR | 5 |
| Tiber Memory | 2 |
| Compass | 20 |
| Rankings | 22 |
| Trade | 4 |
| Waiver | 3 |
| DST Streamer | 1 |
| Sleeper Sync | 22 |
| Frontend Core | ~155 |
| Backend Core | ~160 |
| Shared | 14 |
| Other / Uncategorized | ~20 |
| **Total** | **~739** |
