# ARCHITECTURE.md — Tiber Fantasy

> Top-level navigation document for coding agents. Read this first.

**Project**: Tiber Fantasy — Free NFL fantasy football analytics platform  
**Stack**: Node.js/TypeScript (Express), React 18/TypeScript, PostgreSQL + Drizzle ORM, Tailwind CSS + shadcn/ui  
**Run**: `npm run dev` (Express backend + Vite frontend on port 5000)

---

## 1. Quick Start for Agents

1. Read this file for orientation.
2. Read `replit.md` for project context, user preferences, and detailed feature specs.
3. For any module-level work, read the module's `MODULE.md` before editing (see Module Index below).
4. To find which module owns a file, check `CODEBASE_MAP.md` — every `.ts`/`.tsx` file is indexed by feature.
5. Schema lives in `shared/schema.ts` — always check it before adding tables or types.
6. Routes are a monolith in `server/routes.ts` (10,644 lines). Search before adding new endpoints.
7. Frontend routes are in `client/src/App.tsx`. Layout is `client/src/components/TiberLayout.tsx`.
8. Push DB changes with `npm run db:push` (never write raw SQL migrations).

---

## 2. Directory Map

```
├── client/src/                 React frontend
│   ├── api/                    API client helpers (forge.ts)
│   ├── components/             75+ components (ui/, admin/, sos/, tabs/, tiber/, shared/)
│   ├── config/                 nav.ts (sidebar navigation config)
│   ├── data/                   Static data adapters
│   ├── forgeLab/               ForgeLab equation definitions
│   ├── hooks/                  Custom hooks (useConsensus, useCurrentNFLWeek, useLeagueContext, etc.)
│   ├── lib/                    Utilities (apiClient, queryClient, utils, sosColors, etc.)
│   ├── pages/                  29 pages + admin/ subpages
│   ├── state/                  Global state (founderMode)
│   ├── styles/                 Extra CSS (nprogress)
│   └── types/                  Frontend types (forge.ts)
│
├── server/                     Node.js backend
│   ├── routes.ts               ⚠️  MONOLITH — 228 route definitions, 10,644 lines
│   ├── storage.ts              Storage interface (IStorage)
│   ├── routes/                 Modular route files (dataLabRoutes, forgeSimRoutes, etc.)
│   ├── services/               Business logic (identity/, ownership/, projections/, quality/, trade/)
│   ├── modules/                Feature modules (forge/, ovr/, sos/, startSit/, metricMatrix/, team-analytics/)
│   ├── llm/                    LLM Gateway (providers/, config, fallback)
│   ├── etl/                    ETL pipeline (Bronze→Silver→Gold)
│   ├── enrichment/             Position-specific stat enrichment
│   ├── consensus/              Community rankings engine
│   ├── voice/                  Tiber Voice (intent parsing, reasoning)
│   ├── guardian/               Data quality (noiseShield)
│   ├── olc/                    Opponent-level context scoring
│   ├── platformSync/           External platform adapters (Sleeper)
│   ├── ingest/                 Data ingestion
│   ├── infra/                  Infrastructure (db.ts, apiRegistry)
│   ├── middleware/             Express middleware (adminAuth, rateLimit)
│   ├── config/                 Server configuration
│   ├── cron/                   Scheduled tasks
│   ├── scripts/                One-off scripts
│   ├── seeds/                  Database seed data
│   └── adapters/               Data source adapters
│
├── shared/                     Shared between client & server
│   ├── schema.ts               ⚠️  131 DB tables, all Drizzle models, insert schemas, types
│   ├── config/                 Shared configuration
│   ├── models/                 Shared data models
│   └── types/                  Shared TypeScript types
│
├── docs/                       Project documentation
│   ├── diagrams/               Mermaid diagrams (system overview, FORGE pipeline, etc.)
│   ├── dev/                    Developer docs (FEATURE_LINK_MAP, LEAGUE_OWNERSHIP_NOTES)
│   ├── internal/               Internal docs (credits, CI setup)
│   └── metric-matrix/          Metric Matrix specs (axis_map, schema)
│
├── config/                     Runtime config files (compass, deepseek, ovr, xfp coefficients)
├── knowledge/                  RAG knowledge base (core/, theory/)
├── data/                       Runtime data (current_intel.json, forge snapshots, player pool)
├── migrations/                 Drizzle SQL migrations (auto-generated)
└── scripts/                    Top-level utility scripts
```

---

## 3. Module Index

| # | Module | Path | Description | Docs |
|---|--------|------|-------------|------|
| 1 | **FORGE** | `server/modules/forge/` | Core player evaluation engine. Alpha scores (0-100) via 4 pillars: Volume, Efficiency, Team Context, Stability. E+G architecture, Football Lens, Recursive Alpha, QB Context. ~30 files. API: `/api/forge/*` | `server/modules/forge/MODULE.md` |
| 2 | **LLM Gateway** | `server/llm/` | Provider-agnostic AI routing. 4 providers (OpenRouter, OpenAI, Anthropic, Gemini), 9 task types, 3 priority tiers, automatic fallback chain. | `server/llm/MODULE.md` |
| 3 | **X Intelligence** | `server/services/xIntelligenceScanner.ts` | Grok-powered X/Twitter scanning for fantasy trends. File-based storage at `data/current_intel.json`. API: `POST /api/intel/x-scan`, `GET /api/intel/x-feed`, `DELETE /api/intel/x-feed` | `server/services/MODULE_XINTEL.md` |
| 4 | **Data Lab (DataDive)** | `server/services/datadive*.ts`, `server/routes/dataLabRoutes.ts` | Snapshot-based NFL data spine for reproducible analytics. Frontend: `TiberDataLab.tsx`. API: `/api/data-lab/*` | _no manifest yet_ |
| 5 | **OVR System** | `server/modules/ovr/`, `server/services/ovrService.ts`, `server/services/ovrEngine.ts` | Madden-style 1-99 player ratings. Uses FORGE adapter. API: `/api/ovr/*` | _no manifest yet_ |
| 6 | **SoS** | `server/modules/sos/` | Position-specific Strength of Schedule analysis. Controller/Service/Router pattern. Integrated into FORGE. | `server/modules/sos/MODULE.md` |
| 7 | **Consensus** | `server/consensus/` | Community-driven rankings engine. Curves, dynasty softener, injury profiles, in-memory store. | `server/consensus/MODULE.md` |
| 8 | **Player Identity** | `server/services/PlayerIdentityService.ts`, `server/services/identity/` | Unified player resolution across fantasy platforms. Identity bridge, GSIS IDs, cross-platform mapping. | _no manifest yet_ |
| 9 | **ETL Pipeline** | `server/etl/` | Bronze→Silver→Gold data layers. CoreWeekIngest, silverWeeklyStatsETL, goldDatadiveETL, nightlyBuysSellsUpdate. | `server/etl/MODULE.md` |
| 10 | **Enrichment** | `server/enrichment/` | Position-specific stat enrichment boxes (WR, RB, QB, TE, IDP, Fantasy). | `server/enrichment/MODULE.md` |
| 11 | **Voice** | `server/voice/` | Tiber Voice system. Intent parsing, reasoning, comparison engine, data adapters. | `server/voice/MODULE.md` |
| 12 | **Start/Sit** | `server/modules/startSit/` | Weekly start/sit recommendation engine. | `server/modules/startSit/MODULE.md` |
| 13 | **Metric Matrix** | `server/modules/metricMatrix/` | Player vectors, similar players, tier neighbors, league ownership context. | `server/modules/metricMatrix/MODULE.md` |
| 14 | **OLC** | `server/olc/` | Opponent-level context scoring system. | `server/olc/MODULE.md` |
| 15 | **Platform Sync** | `server/platformSync/` | External platform adapters (Sleeper, etc.). Subdirectory: `adapters/`. | `server/platformSync/MODULE.md` |
| 16 | **Guardian** | `server/guardian/noiseShield.ts` | Data quality noise filtering. | _no manifest yet_ |
| 17 | **Prediction Engine** | `server/services/predictionEngine.ts` | Weekly prediction generation. | _no manifest yet_ |
| 18 | **RAG Chat** | `server/services/geminiEmbeddings.ts`, `server/routes/ragRoutes.ts` | AI chat with Gemini embeddings. Knowledge base in `knowledge/`. | _no manifest yet_ |
| 19 | **ECR** | `server/services/ecrLoader.ts`, `server/services/ecrService.ts`, `server/services/enhancedEcrProvider.ts` | Expert Consensus Rankings loader and provider. | _no manifest yet_ |
| 20 | **Tiber Memory** | `server/routes/tiberMemoryRoutes.ts` | Dual memory pools (FANTASY vs GENERAL) for AI context. | _no manifest yet_ |

---

## 4. Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `shared/schema.ts` | ~5,200 | **131 database tables**, all Drizzle models, insert schemas, enums, types. Read before any DB work. |
| `server/routes.ts` | ~10,644 | **228 route definitions** (monolith). Search here before adding endpoints. |
| `server/storage.ts` | — | Storage interface (`IStorage`). Update when adding CRUD operations. |
| `client/src/App.tsx` | ~95 | **All frontend routes** (wouter). Add new pages here. |
| `client/src/components/TiberLayout.tsx` | ~101 | **Sidebar navigation** layout. Fixed 220px sidebar with Core/Intelligence/System sections. |
| `client/src/index.css` | — | **Design system CSS**. All custom properties, colors, typography, component styles. |
| `client/src/config/nav.ts` | — | Navigation configuration. |
| `client/src/lib/queryClient.ts` | — | TanStack Query setup with default fetcher. |
| `client/src/lib/apiClient.ts` | — | API client for backend requests. |
| `replit.md` | — | Project documentation, user preferences, feature specs. |
| `drizzle.config.ts` | — | Drizzle ORM config. **Do not edit.** |
| `package.json` | — | Dependencies. **Do not edit directly** — use packager tool. |

---

## 5. Database

- **Engine**: PostgreSQL (Neon-backed) with `pgvector` extension
- **ORM**: Drizzle ORM
- **Schema**: `shared/schema.ts` — 131 tables
- **Migrations**: `npm run db:push` (push-based, never write raw SQL migrations)
- **Force push**: `npm run db:push --force` (when data-loss warnings occur)
- **Connection**: Via `DATABASE_URL` env var, accessed through `server/infra/db.ts`

**Key table groups**:
- Bronze layer: `ingest_payloads` (raw data storage)
- Silver layer: `player_identity_map`, `nfl_teams_dim`, `market_signals`, `weekly_stats`, role banks
- Gold layer: `player_week_facts`, datadive snapshots
- FORGE: `qb_context_2025`, `sos_scores`, role bank tables (WR/RB/TE/QB)
- Orchestration: `job_runs`, `task_runs`, `dataset_versions`, `monitoring_job_runs`
- Platform: `sleeper_ownership`, `schedule`, `chat_sessions`, `chat_messages`, `chunks`

---

## 6. Frontend Architecture

- **Framework**: React 18 + TypeScript
- **Routing**: `wouter` — all routes in `client/src/App.tsx`
- **Layout**: `TiberLayout.tsx` — fixed 220px sidebar, three nav sections (Core, Intelligence, System)
- **Data fetching**: TanStack Query v5 (object form only) + `apiClient.ts`
- **Forms**: shadcn `Form` + `react-hook-form` + `zodResolver`
- **UI library**: shadcn/ui components in `client/src/components/ui/`
- **Icons**: `lucide-react` (actions), `react-icons/si` (logos)
- **Charts**: Recharts

**Pages** (`client/src/pages/`):
- `/` → `Dashboard.tsx` (homepage with FORGE-powered player table)
- `/tiers` → `TiberTiers.tsx` (FORGE rankings with weight sliders)
- `/tiber-data-lab` → `TiberDataLab.tsx` (DataDive snapshot explorer)
- `/schedule` → `SchedulePage.tsx`
- `/forge` → `ForgeTransparency.tsx`
- `/forge-workbench` → `ForgeWorkbench.tsx` (interactive FORGE query tool)
- `/player/:playerId` → `PlayerPage.tsx`
- `/x-intel` → `XIntelligence.tsx`
- `/legacy-chat` → `ChatHomepage.tsx`
- `/admin/*` → ForgeHub, ForgeLab, ForgeSimulation, PlayerMapping, ApiLexicon, etc.

---

## 7. Design System

| Property | Value |
|----------|-------|
| Mode | Light only |
| Background | `#ffffff` (primary), `#fafafa` (secondary), `#f4f4f4` (tertiary) |
| Accent | Ember `#e2640d` |
| UI Font | Instrument Sans |
| Data Font | JetBrains Mono |
| Editorial Font | Newsreader |
| Sidebar | Fixed 220px, defined in `TiberLayout.tsx` |
| CSS | Custom properties in `client/src/index.css` |

---

## 8. External Dependencies

| Source | Purpose | Integration Point |
|--------|---------|-------------------|
| **MySportsFeeds API** | Injury reports, NFL roster automation | `server/services/`, env: `MYSPORTSFEEDS_API_KEY` |
| **Sleeper API** | Player projections, game logs, ADP, league sync, rosters | `server/integrations/sleeperClient.ts`, `server/platformSync/` |
| **NFLfastR / nflverse** | Play-by-play parquet files, NFL schedule data | `server/etl/`, Python scripts |
| **NFL-Data-Py** | Weekly statistics, depth charts, snap counts | Python bridge in `server/python/` |
| **OpenRouter** | LLM routing (Grok, Claude, etc.) | `server/llm/providers/openrouter.ts` (Replit integration) |
| **OpenAI** | LLM provider | `server/llm/providers/openai.ts` (Replit integration) |
| **Anthropic** | LLM provider | `server/llm/providers/anthropic.ts` (Replit integration) |
| **Google Gemini** | RAG embeddings, chat generation | `server/services/geminiEmbeddings.ts` (Replit integration) |

---

## 9. Common Agent Tasks

### "Add a new page"
1. Create component in `client/src/pages/YourPage.tsx`
2. Add route in `client/src/App.tsx`
3. Add nav entry in `client/src/components/TiberLayout.tsx` (appropriate section)

### "Add a new API endpoint"
1. Search `server/routes.ts` for similar endpoints first
2. Prefer creating a modular route file in `server/routes/` and mounting it in `server/routes.ts`
3. Update `server/storage.ts` if new CRUD operations are needed

### "Add a new database table"
1. Add Drizzle model in `shared/schema.ts`
2. Create insert schema with `createInsertSchema` + `.omit` auto-generated fields
3. Export insert type (`z.infer`) and select type (`$inferSelect`)
4. Run `npm run db:push`
5. Update `server/storage.ts` with new CRUD methods

### "Refactor FORGE"
1. Read `server/modules/forge/MODULE.md` first
2. Understand E+G architecture: Engine (`forgeEngine.ts`) fetches data, Grading (`forgeGrading.ts`) scores
3. Check `server/modules/forge/` for ~30 files across context/, features/, helpers/, simulation/, utils/
4. Frontend touchpoints: `ForgeWorkbench.tsx`, `ForgeLab.tsx`, `ForgeTransparency.tsx`, `TiberTiers.tsx`
5. API routes: `/api/forge/*` registered via `server/modules/forge/index.ts`

### "Work on LLM / AI features"
1. Read `server/llm/MODULE.md`
2. All LLM calls go through `callLLM()` in `server/llm/index.ts`
3. Add new task types in `server/llm/config.ts`
4. Provider keys managed via Replit integrations (do not hardcode)

### "Work on player identity / mapping"
1. Read `server/services/PlayerIdentityService.ts` and `server/services/identity/`
2. Central table: `player_identity_map` in `shared/schema.ts`
3. GSIS ID is primary NFL identifier (format: `00-XXXXXXX`)
4. Identity enrichment log tracks all match attempts

### "Fix data pipeline issues"
1. Understand ETL flow: Bronze (raw ingest) → Silver (normalized) → Gold (analytics-ready)
2. Entry points in `server/etl/`
3. Enrichment in `server/enrichment/`
4. Check `server/guardian/noiseShield.ts` for data quality filtering

### "Change styling / design"
1. Read `client/src/index.css` for the design system
2. Use CSS custom properties, not hardcoded values
3. Light mode only — no dark mode toggle
4. Ember accent: `#e2640d`
5. Use shadcn/ui components from `client/src/components/ui/`
