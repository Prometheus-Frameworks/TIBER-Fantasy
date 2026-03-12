# TIBER Portability & Infrastructure Audit
**Date:** March 12, 2026  
**Scope:** Portability-first. Goal is Replit-optional, not Replit-free.

---

## ⚠️ P0 SECURITY — ACT NOW

**A GitHub Personal Access Token is stored in `.replit` under `[userenv.shared]`.**

```
replit-tiber = "github_pat_11BUNNJMI06..."
```

`.replit` **is tracked by git** and has been pushed to the public GitHub repo. The token is in commit history. It must be treated as fully compromised.

### Immediate steps (do these now, in order):

1. **Revoke the token at GitHub.com → Settings → Developer Settings → Personal access tokens → [the token] → Delete**
2. **Edit `.replit` in the Replit Shell** — remove the `[userenv.shared]` block:
   ```bash
   # Open in nano:
   nano .replit
   # Delete the [userenv] and [userenv.shared] block, save with Ctrl+O, exit with Ctrl+X
   ```
3. **Untrack `.replit` from git going forward** — already done: `.replit` has been added to `.gitignore`. You also need to stop git from tracking the current file:
   ```bash
   git rm --cached .replit
   git commit -m "security: stop tracking .replit, remove exposed PAT"
   git push origin main
   ```
4. **Purge token from git history** (recommended if repo is public). Use BFG Repo Cleaner:
   ```bash
   # Install BFG (requires Java)
   # Run against a fresh clone:
   bfg --replace-text secrets.txt  # file containing the token string
   git reflog expire --expire=now --all && git gc --prune=now --aggressive
   git push --force-with-lease origin main
   ```
   Alternatively, use GitHub's built-in secret scanning — it may have already flagged and invalidated this token.
5. **Issue a new PAT** and store it **only** in GitHub Repository Secrets (Settings → Secrets → Actions), never in tracked files.

---

## 1. Worker Map

All background jobs found in the codebase. Five are defined via `node-cron` in `server/cron/`. One scheduler is wired to server startup.

| Job | File | Schedule | Trigger | Wired to Web Process | Inputs | Outputs | Retry | Failure Impact |
|---|---|---|---|---|---|---|---|---|
| **Nightly Buys/Sells ETL** | `server/cron/weeklyUpdate.ts` | Daily 3 AM ET | `node-cron` | ❌ Not started (defined but `setupAllCronJobs()` is never called) | DB: tiberScores, playerIdentityMap | DB: buys/sells recommendations | None — logs error and exits | No new buy/sell recs for the day |
| **Weekly Buys/Sells Recompute** | `server/cron/weeklyUpdate.ts` | Tuesday 4 AM ET | `node-cron` | ❌ Not started | DB: current week from config | DB: weekly recs | None | Stale recommendations for new week |
| **Injury Sync** | `server/cron/injurySync.ts` | Daily 2 AM ET | `node-cron` | ❌ Not started | Sleeper API | DB: injury statuses | None | Stale IR/OUT flags in rankings |
| **Schedule Sync** | `server/cron/scheduleSync.ts` | Tuesday 1 AM ET | `node-cron` | ❌ Not started | Python: `scripts/sync_schedule.py` → NFLverse | DB: schedule table | None | Stale schedule data for matchup routes |
| **RB Context Check** | `server/cron/rbContextCheck.ts` | Daily 2:45 AM ET | `node-cron` | ❌ Not started | DB: play-by-play data | DB: RB EPA context metrics | None | Stale RB context scores |
| **Sleeper Sync Scheduler** | `server/services/sleeperSyncV2/scheduler.ts` | Configurable (default: 60 min interval) | `setInterval` | ✅ Started on server boot via `initBackground()` | DB: sleeperSyncState, Sleeper API | DB: league sync state | None — catches errors per league | Leagues stop syncing until restart |

### Key finding: cron jobs are defined but not activated

`setupAllCronJobs()` in `server/cron/weeklyUpdate.ts` is never called from `server/index.ts` or anywhere else. The five scheduled jobs exist in the codebase but **do not run in the current deployment**. Whether this is intentional (manual-trigger-only mode) or an oversight needs clarification.

Manual triggers exist at `POST /api/nightly/buys-sells/process` (admin-authenticated) for the Buys/Sells jobs.

---

## 2. Database Portability Check

| Check | Status | Notes |
|---|---|---|
| All DB access goes through env vars | ✅ Yes | `server/infra/db.ts` reads `DATABASE_URL`. Throws if unset. |
| Drizzle config uses env var | ✅ Yes | `drizzle.config.ts` reads `DATABASE_URL`, throws if missing |
| Migrations run against non-Replit Postgres | ✅ Yes | `ci-qa-ratings.yml` runs against containerized Postgres 15. Migration applied via `npm run db:push`. |
| Any code assumes Replit-local Postgres | ⚠️ One comment | `server/infra/db.ts` has a comment referencing Neon/Replit in the `rejectUnauthorized: false` explanation. This is documentation-only, no functional assumption. |
| Seed/setup scripts work on external Postgres | ✅ Likely yes | `scripts/seed/` and `server/scripts/` use `DATABASE_URL`. CI workflow confirms this pattern works. |
| Connection pool tuned for managed DB | ✅ Yes | 15s connection timeout, `keepAlive`, `statement_timeout` set per connection — handles Neon cold starts. |
| SSL handling | ✅ Conditional | SSL enabled in `NODE_ENV=production`, disabled in dev. Correct for both local dev and managed cloud DB. |

**Conclusion:** Database access is genuinely portable. Swapping to Render, Railway, Neon, Supabase, or local Docker requires only a `DATABASE_URL` change.

---

## 3. Infra Separation Report

| Component | Can run independently? | What it needs | Blocker |
|---|---|---|---|
| **API app** (`server/index.ts`) | ✅ Yes | `DATABASE_URL`, `NODE_ENV`, `PORT` | None — fully self-contained |
| **Frontend build** (`vite build`) | ✅ Yes | Node 20, `npm ci`, `npm run build` | None |
| **ETL / sync workers** (`server/cron/`) | ⚠️ Partially | Same DB, Python 3.11 (for schedule sync), external APIs (Sleeper) | Not exported as standalone entry points. Currently defined as functions, not runnable as isolated processes. |
| **Recompute / rankings jobs** (`server/scripts/`) | ⚠️ Partially | `DATABASE_URL`, `tsx` | Scripts are runnable via `tsx scripts/foo.ts` but have no single orchestration entry point. |
| **Tests** | ✅ Yes | `DATABASE_URL` (for DB-touching tests), `npm run test` | CI workflow confirms test isolation works |
| **Python scripts** (`scripts/*.py`) | ⚠️ Partially | Python 3.11, psycopg2/pandas, `DATABASE_URL` | No `requirements.txt` — Python dependencies are implicit via Replit's Nix environment |

### Critical gap: Python dependency manifest is missing

`scripts/*.py` and `server/scripts/*.py` import pandas, psycopg2, requests, and other packages. There is no `requirements.txt` or `pyproject.toml`. Outside Replit's Nix environment, these scripts will fail with import errors. This is the largest operational portability gap.

---

## 4. Replit Lock-In List

| Dependency | Location | Severity | Fix |
|---|---|---|---|
| **GitHub PAT in `.replit`** | `.replit` `[userenv.shared]` | 🔴 CRITICAL | Revoke, remove, add to proper secrets — see P0 section above |
| **`.replit` tracked by git** | `.gitignore` missing `.replit` | 🔴 CRITICAL | Fixed: `.replit` added to `.gitignore`. Run `git rm --cached .replit` |
| **`postgresql-16` Nix module** | `.replit` `modules` | 🟡 Medium | This gives the dev environment a local Postgres. Portable dev needs a `docker-compose.yml` or external DB instead |
| **Replit URL fallback in `apiConfig.ts`** | `server/utils/apiConfig.ts:36-38` | 🟡 Medium | Fixed: removed `REPL_SLUG`/`REPL_OWNER` fallback — production now warns and falls back to localhost |
| **`deploymentTarget = "autoscale"`** | `.replit` `[deployment]` | 🟢 Low | Replit-specific. Non-issue once `.replit` is untracked. Render/Railway have their own deploy configs |
| **Python deps implicit via Nix** | `.replit` `[nix]` packages | 🟡 Medium | `arrow-cpp`, `glibcLocales`, `imagemagick`, `jq`, `libxcrypt`, `pkg-config`, `xsimd` are system-level deps for Python scripts. Need `requirements.txt` + Docker/Nix equivalent |
| **No `docker-compose.yml`** | Repo root | 🟡 Medium | Local dev outside Replit requires a local Postgres. No compose file means manual setup |
| **`node-cron` jobs never started** | `server/cron/weeklyUpdate.ts` | 🟡 Medium | Cron jobs are dead code in current deployment. Need activation path or standalone worker entry point |
| **`REPL_IDENTITY`, `WEB_REPL_RENEWAL`** | GitHub connector SDK snippet | 🟢 Low | Only in the connector integration code, not in core app. Non-blocking |

---

## 5. Portability Refactor Plan

### P0 — Security cleanup (do today)

- [ ] **Revoke the exposed GitHub PAT** at github.com/settings/tokens
- [ ] **Remove PAT from `.replit`** (edit manually in shell, remove `[userenv.shared]` block)
- [ ] **Untrack `.replit`**: `git rm --cached .replit && git commit -m "security: untrack .replit" && git push`
- [ ] **Purge from history** with BFG or GitHub secret scanning
- [ ] **Issue new PAT**, store only in GitHub Actions Secrets

Already done in this pass:
- ✅ `.replit` added to `.gitignore`
- ✅ `REPL_SLUG`/`REPL_OWNER` URL fallback removed from `server/utils/apiConfig.ts`

### P1 — Externalize Postgres (required for non-Replit hosting)

- [ ] Add `docker-compose.yml` at repo root with a `postgres:16` service and matching env vars
- [ ] Add `APP_BASE_URL` to `.env.example` with a note that it's required in production
- [ ] Add `requirements.txt` for all Python scripts (or `pyproject.toml`)
- [ ] Test full boot sequence (`npm run dev`) with `DATABASE_URL` pointed at external Postgres

**Recommended target for testing:** Neon free tier — the connection pool config in `server/infra/db.ts` is already tuned for it.

### P2 — Separate workers from web app

The five `node-cron` jobs currently are either dead (never started) or need to become proper standalone processes. Choose one path:

**Option A — Activate cron inside the web process (simpler, Replit-friendly)**  
Call `setupAllCronJobs()` from `initBackground()` in `server/index.ts`. Zero infrastructure change. Cron jobs run as long as the web process is up. Acceptable for Replit autoscale with always-on.

**Option B — Extract worker as a separate process (more portable)**  
Create `server/worker.ts` as a standalone entry point:
```typescript
// server/worker.ts
import { setupAllCronJobs } from './cron/weeklyUpdate';
setupAllCronJobs();
```
Add `worker` to build/deploy pipeline. Deploy as a separate service or a cron-job container on Render/Railway. This cleanly separates concerns.

For Python ETL scripts:
- [ ] Add a `requirements.txt` for all `scripts/*.py` dependencies
- [ ] Document which scripts are one-time backfills vs recurring ETL

### P3 — Document deploy targets

Create `docs/deploy/` with:

- [ ] `replit.md` — current Replit autoscale setup, build/run commands
- [ ] `render.md` — Web Service (API + frontend) + Cron Job (worker), Postgres add-on config
- [ ] `railway.md` — Service + Postgres plugin, environment variable setup
- [ ] `local.md` — `docker-compose up`, `npm run dev`, migration steps

Minimum env vars required on any host:
```
DATABASE_URL=
NODE_ENV=production
PORT=5000
APP_BASE_URL=https://your-domain.com
SESSION_SECRET=
FANTASYPROS_API_KEY=
MSF_USERNAME=
MSF_PASSWORD=
SPORTSDATA_API_KEY=
ENABLE_SLEEPER_SYNC=false
```

### P4 — Verify GitHub-driven CI/CD and local boot path

- [ ] **Fix `ci-qa-ratings.yml`** — it references `server/src/modules/ratings/` and `server/src/db/migrations/` paths that may not match the actual repo layout (`server/modules/`, `migrations/`). Verify and correct.
- [ ] **Add a basic smoke-test workflow** that: installs, builds, and hits `/health` — runs on every push to main
- [ ] **Verify Sleeper sync CI** (`sleeper-sync.yml`) passes end-to-end without Replit secrets
- [ ] **Confirm `npm run build` → `node dist/index.mjs` works** outside Replit with `DATABASE_URL` set

---

## Success Criteria Checklist

| Criterion | Status |
|---|---|
| TIBER runs locally with only env-var changes | ⚠️ Needs `docker-compose.yml` for local Postgres |
| Postgres swappable to Render/Railway/Neon/Supabase/Docker | ✅ `DATABASE_URL`-driven, pool tuned for managed DBs |
| Core workers run without main web app | ⚠️ Cron jobs defined but not activated; no standalone worker entry point |
| Deployment instructions for non-Replit target | ❌ Not yet written |
| No secret stored in tracked repo files | 🔴 GitHub PAT in `.replit` — must be rotated and removed |
| Replit is a convenience layer, not a survival dependency | ⚠️ After P0+P1 fixes, effectively yes |

---

## What Is Already Solid

- Database access is 100% env-var driven — the foundation is right
- Drizzle migrations run against standard Postgres — confirmed by CI
- Build pipeline (`build.sh` → `esbuild` + `vite`) is host-agnostic
- GitHub Actions CI exists and uses containerized Postgres — the right architecture
- `.env.example` is accurate and comprehensive
- `server/infra/db.ts` is already tuned for Neon/managed DB cold starts
- The API key system (`x-tiber-key`) is self-contained and not Replit-specific
