# TIBER Weekly Security Runbook

~10 minutes, once a week. Usable from a phone/jobsite — each step is one question and one command. From the Issue #192 audit (Track 5).

## 1. New public routes?

```bash
git log --since="1 week ago" -p -- server/routes.ts server/routes/ | grep -E "^\+.*(app|router)\.(get|post|put|delete)\("
```

Any new `/api/admin/*` or `/api/debug/*` route **without** `requireAdminAuth`? → stop and fix before anything else. Any new expensive/state-mutating route without a `rateLimiters.*` tier? → note it.

## 2. New artifact consumers/producers?

```bash
git log --since="1 week ago" --stat -- server/modules/externalModels server/ingest | head -40
```

New adapter? Confirm it uses zod validation + `contract_version` pinning + fail-closed errors. Copy the pattern in `server/modules/externalModels/playerOwnership/`.

## 3. New agent docs/prompts?

```bash
git log --since="1 week ago" --name-only --pretty=format: -- '*.md' tiber_config_doctrine.json server/services/geminiEmbeddings.ts | sort -u
```

Any new file that reads like instructions-to-an-agent? Note it and confirm it complies with `SECURITY_POLICY.md` (data, not authority).

## 4. Secrets/env/deploy changes?

```bash
git log --since="1 week ago" -p -- .env.example .gitignore .github/workflows nixpacks.toml railway.toml
```

New env var documented with a placeholder only? Nothing secret-shaped committed?

## 5. New cross-repo feedback loops?

Any new promoted-artifact path or `TIBER-*` repo consumed/produced this week? If yes, confirm the consuming adapter validates schema + provenance.

## 6. Fail-open behavior spotted?

In any file touched this week, look for silent-empty fallbacks:

```bash
git log --since="1 week ago" -p -- server | grep -n "return \[\]"
```

A `catch` that returns `[]`/defaults instead of erroring is a poisoning/staleness vector — note it.

## 7. Dependency advisories?

```bash
npm run security:audit
```

Advisory-only for now — **expect this to exit non-zero** until the pre-existing high/critical advisories are triaged (15 high / 3 critical as of 2026-06-09). Look for *new* highs/criticals vs. last week, and merge or close any open Dependabot PRs. CI also runs this weekly and on dependency-file changes (`.github/workflows/security-audit.yml`, report-only).

## 8. Follow-ups

Add anything found to the running list below. Open a GitHub issue for anything High severity.

| Date | Finding | Severity | Issue/PR |
|------|---------|----------|----------|
| | | | |
