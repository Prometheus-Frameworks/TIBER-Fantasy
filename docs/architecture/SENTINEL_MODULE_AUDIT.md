# Sentinel Module Audit

> Scope: audit-only status review of the Quality Sentinel module (issue #246).
> No refactor performed. This documents what exists, what is wired, and where the gaps are.
> Date: 2026-06-20

## Summary

Sentinel is a **passive, in-process data-quality validation layer**. It is fully
mounted and reachable end-to-end (backend routes + frontend dashboard), but it is
**observational only** — `block`-severity failures are counted and surfaced as
metadata, never enforced. Production wiring covers only the **forge** and
**personnel** modules; `datalab`, `system`, and `rolebank` rules are effectively
dormant. The module is absent from the API registry.

| Audit question | Answer |
| --- | --- |
| Is Sentinel mounted? | **Yes** — `server/routes.ts:2890` |
| Does `/sentinel` work? | **Statically wired end-to-end** (frontend route + all 5 backend endpoints exist); runtime DB-backed behavior not verified here |
| Who produces data? | `forge/routes.ts` (score + batch), `personnelRoutes.ts` (profile single + batch) |
| Who consumes data? | `SentinelDashboard.tsx` (issues / events / health / mute / run) |
| Is `block` passive or enforcing? | **Passive** — data is always returned; blocks are metadata only |
| Is it in the API registry? | **No** — zero `/api/sentinel/*` entries in `apiRegistry.ts` |
| Does the DB have useful real events? | **Unverifiable here** (no `DATABASE_URL`); tables exist — see query below |

## 1. Mounting

Sentinel is mounted in the main Express app:

- `server/routes.ts:72` — `import sentinelRoutes from './routes/sentinelRoutes';`
- `server/routes.ts:2890` — `app.use('/api/sentinel', sentinelRoutes);`
- `server/routes.ts:2892` — logs `🛡️ Sentinel routes mounted at /api/sentinel/*`

**Status: mounted and active.**

## 2. Does `/sentinel` work?

The route is wired end-to-end:

- **Frontend route:** `client/src/App.tsx:104` — `<Route path="/sentinel" component={SentinelDashboard} />`
- **Nav/label:** `client/src/components/TiberLayout.tsx:55`; linked from `client/src/pages/Architecture.tsx:33`
- **Dashboard:** `client/src/pages/SentinelDashboard.tsx` calls:
  - `GET /api/sentinel/issues`
  - `GET /api/sentinel/events`
  - `GET /api/sentinel/health`
  - `POST /api/sentinel/mute/:fingerprint`
  - `POST /api/sentinel/run/:module` (built-in test scenarios)

All five are implemented in `server/routes/sentinelRoutes.ts` (plus an undocumented
`POST /api/sentinel/run/rule/:ruleId`). The dashboard is **statically wired
end-to-end**; runtime DB-backed behavior (live dashboard rendering, real query
results) was **not verified in this environment** — it depends on the
`sentinel_events` / `sentinel_mutes` tables being present and populated.

## 3. Producers and consumers

### Producers (call `evaluate()` + fire-and-forget `recordEvents()`)

| Location | Module | Notes |
| --- | --- | --- |
| `server/modules/forge/routes.ts:350` | `forge` | `GET /api/forge/score/:playerId` |
| `server/modules/forge/routes.ts:497,503` | `forge` | `GET /api/forge/batch` (per-player + batch report) |
| `server/routes/personnelRoutes.ts:41` | `personnel` | `/api/personnel/profile` (single) |
| `server/routes/personnelRoutes.ts:64` | `personnel` | `/api/personnel/profile` (batch) |
| `server/routes/sentinelRoutes.ts:89` | any | manual `POST /api/sentinel/run/:module` (debug/test only) |

**Only `forge` and `personnel` are wired into real product routes.** Grep of
`evaluate('<module>')` across `server/**` confirms no production call to
`datalab`, `system`, or `rolebank`.

### Consumers

- `SentinelDashboard.tsx` is the only reader of issues/events/health.

### Rule coverage vs. wiring (`server/modules/sentinel/sentinelRules.ts`)

| Module | Rules defined | Wired in production? |
| --- | --- | --- |
| `forge` | 8 (`alpha_bounds`, `alpha_nan`, `pillar_bounds`, `pillar_nan`, `tier_consistency`, `weight_sum`, `batch_empty`, `player_count`) | Yes |
| `personnel` | 4 (`snap_positive`, `pct_sum`, `snap_reasonable`, `classification_valid`) | Yes |
| `datalab` | 2 (`snapshot_exists`, `snapshot_recency`) | **No** — only via manual `/run` |
| `system` | 1 (`response_shape`) | **No** — only via manual `/run` |
| `rolebank` | **0** | Enum member with no rules; `evaluate('rolebank')` is a no-op |

## 4. Block: passive or enforcing?

**Passive (advisory only).** In every consumer, blocks are summed and exposed as
response metadata but never alter control flow:

```ts
// server/modules/forge/routes.ts:362  (also personnelRoutes.ts:52, forge batch :523)
return res.json({
  success: true,
  score: enrichedScore,            // <-- full data still returned
  _sentinel: { checked: true, warnings: ..., blocks: ... },
});
```

There is no code path anywhere that converts `report.blocks > 0` into an HTTP
error, a withheld/omitted payload, or a short-circuit. The `block` severity
(defined in `sentinelTypes.ts`) currently behaves identically to `warn`/`info`
except for how it is counted and color-coded in the dashboard. Per product
doctrine this is consistent with "human final decision authority," but the
`block` label is **aspirational**, not enforced.

## 5. API registry

`server/infra/apiRegistry.ts` (33 endpoints, powering the Admin API Lexicon)
contains **no `/api/sentinel/*` entries**. The Sentinel admin surface is therefore
undiscoverable through the in-app endpoint catalog. (Gap, not a defect.)

## 6. Database / real events

- Schema is defined: `shared/schema.ts:5517` (`sentinel_events`) and `:5539`
  (`sentinel_mutes`), with fingerprint/created-at indexes.
- This audit environment has **no `DATABASE_URL`**, so live row counts could not be
  checked. To verify whether real events exist in a running environment:

```sql
SELECT module, severity, count(*) AS n, max(created_at) AS last_seen
FROM sentinel_events
GROUP BY module, severity
ORDER BY n DESC;

SELECT count(*) FROM sentinel_mutes;
```

Expectation if traffic has hit FORGE/personnel routes: rows skewed toward `forge`
and `personnel`; `datalab`/`system` rows only if someone exercised the manual
`/run` endpoint or the dashboard test scenarios.

## 7. Test coverage

- `server/modules/sentinel/__tests__/sentinelEngine.test.ts` — unit tests for
  `evaluate`, `evaluateRule`, and mocked-DB smoke tests for `recordEvents`,
  `muteIssue`, `getIssues`, `getHealthSummary`.
- `server/routes/__tests__/apiSmoke.test.ts:75` — **mocks** the sentinel engine, so
  it does not exercise the real Sentinel routes.
- No integration test covers `sentinelRoutes.ts` directly.

## Observations / candidate follow-ups (not in scope for #246)

1. `rolebank` is a declared `SentinelModule` with zero rules — either add rules or
   drop it from the enum to avoid implying coverage.
2. `datalab` and `system` rules exist but are never invoked in production; either
   wire them into the relevant routes or mark them explicitly as test-only.
3. `block` severity is not enforced anywhere — decide whether it should remain
   purely observational (rename/clarify) or gain an opt-in enforcement mode.
4. Add the five `/api/sentinel/*` endpoints to `apiRegistry.ts` for discoverability.
5. The `MODULE.md` integration pattern claims `_sentinel` metadata is included —
   true for forge/personnel, but the broader "integrate `evaluate()` in the target
   route" guidance is only half-adopted.

## Recommendation

**Freeze as diagnostic, then harden selectively.** Suggested status: `FROZEN_DIAGNOSTIC`.

**Decision: keep (do not retire), but do not yet treat as full core safety
infrastructure.** Sentinel is real, mounted, unit-tested, and already wired into
the FORGE and personnel paths, so deleting it would discard working scaffolding.
At the same time it is not yet load-bearing safety infrastructure: `block` is
passive, the API registry omits it, `datalab`/`system`/`rolebank` coverage is
dormant, and no route-level integration test exercises the real Sentinel endpoints.
Freeze the current surface (no expansion of scope) and harden it deliberately via
follow-up work rather than letting it drift.

Suggested follow-ups (each a small, independent change — out of scope for this
audit-only PR):

1. Add the `/api/sentinel/*` endpoints to `apiRegistry.ts`, or explicitly document
   them as internal/admin-only.
2. Add a small route integration smoke test for `GET /api/sentinel/health`.
3. Clarify `block` as diagnostic-only in `MODULE.md`/types, or defer opt-in
   enforcement to a later issue.
4. Mark the dormant modules (`datalab`, `system`, `rolebank`) as dormant/test-only
   unless they are intentionally wired in later.
5. Consider admin/dev-gating the manual `POST /api/sentinel/run/*` endpoints if they
   are reachable in production.
