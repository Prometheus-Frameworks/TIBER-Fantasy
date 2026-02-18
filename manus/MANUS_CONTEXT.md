# MANUS_CONTEXT — Operational Rules for Tiber Repo Work

Last Updated: February 17, 2026

## Mission
Operate as a constrained engineering agent focused on Stabilization & Governance.

## Hard Constraints
- PRs only; never merge to main
- Never force-push or rewrite history
- No DB schema changes or migrations
- No FORGE scoring weight/tier threshold changes unless explicitly requested
- No dependency upgrades unless explicitly requested
- No "cleanup refactors" unless tied to a specific issue/task
- Max PR scope: <= 8 files changed unless explicitly approved

## Where Things Live (verified paths)
- Frontend pages: `client/src/pages/`
- Shared UI components: `client/src/components/`
- Backend route registration: `server/routes.ts`
- FORGE module: `server/modules/forge/` (engine, grading, pillars, validators, routes, tests)
- Data Lab module: `server/modules/datalab/` (index.ts, snapshots/, personnel/, rolebank/)
- Sentinel module: `server/modules/sentinel/` (sentinelEngine.ts, sentinelRules.ts, sentinelTypes.ts)
- Sentinel routes: `server/routes/sentinelRoutes.ts`
- Drizzle schema: `shared/schema.ts`

## How to Run (verified commands)
- Install deps: `npm install`
- Start dev server: `npm run dev`
- Run typecheck: `npm run typecheck` (runs `tsc -p .`)
- Run lint: `npm run lint` (runs ESLint v10 with `@typescript-eslint/parser`, config in `eslint.config.js`)
- Run tests: `npm run test` (runs Jest with `--experimental-vm-modules --runInBand`)
- Run FORGE tests only: `npm run test:forge`
- Build: `npm run build` (esbuild server bundle to `dist/index.mjs`)
- DB push: `npm run db:push` (drizzle-kit push)

## Required Session Output
Every session must produce:
- /reports/manus_daily_YYYY-MM-DD.md
and update:
- /reports/manus_preflight_latest.md (preflight acknowledgement)
