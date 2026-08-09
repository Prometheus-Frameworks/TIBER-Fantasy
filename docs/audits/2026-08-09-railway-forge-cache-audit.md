# Railway `forge_grade_cache` lineage audit

**Tracker:** [Fantasy #310](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/310)
**Date:** 2026-08-09
**Method:** read-only **with respect to production and the database** — public HTTP
GETs plus repository reads, no DB connection, no DDL, no Railway/Replit mutation.
The audit script does write its own local artifacts under `docs/audits/assets/`;
that is its deliverable.

**Artifacts:** [`assets/310-cache-audit-manifest.json`](assets/310-cache-audit-manifest.json)
· [`assets/310-live-cohort-observed.json`](assets/310-live-cohort-observed.json)
**Reproduce:** `npx tsx scripts/audit/forgeCacheAudit.ts`
**Verify:** `npx tsx scripts/audit/forgeCacheAudit.ts --check` (asserts the two
committed artifacts agree on counts, positions, timestamps and digest)

## Terminal finding

```text
legacy_forge_cache_quarantined_insufficient_provenance
```

This is an **audit classification and a required disposition — not an
already-enforced runtime state.** Nothing in this audit changes the production
consumer; the Rankings surface still reads the cache today. Enforcement belongs
to Fantasy #307 Phase B.

Read it as: the Railway `forge_grade_cache` **cannot be shown to be reproducible
or source-attributable from available evidence**, so it is **classified for
quarantine**. It **must not** occupy a canonical or current ranking mode. It may
remain reachable as clearly labelled 2025 legacy diagnostic/review data.

This is a statement about *evidence*, not about score quality. Nothing here says
the scores are wrong; it says their lineage cannot be established, which is the
condition #310 defined as failing closed.

---

## 1. What the cache is, from repository evidence

`server/modules/forge/forgeGradeCache.ts`:

- selects candidates from position role-bank tables (`{pos}_role_bank`) joined to
  `datadive_snapshot_player_week` (offence) or `idp_player_season` (defence) —
  lines 52–73;
- runs the **in-repository legacy FORGE engine** (`runForgeEngine` → `gradeForge`)
  — line 88;
- writes scores with `computedAt` and `version: 'v1'` — lines 104, 130–131.

`FORGE_EXTERNALIZATION_TRANSITION_SPEC.md:7` records that the module
classification audit marks this engine `LEGACY_CORE_TEMP`; `:536` "Stage 0:
Freeze in-repo FORGE"; `:582` "Stage 6: Delete legacy in-repo FORGE once safe".
So the engine behind the cache is transitional legacy behaviour by the
architecture's own classification.

### Live observation (2026-08-09, read-only)

| | |
|---|---|
| cohort served | **357 rows** — QB 38 / RB 95 / WR 146 / TE 78 |
| `computedAt` | `2026-08-08T19:03:54Z` – `19:04:29Z` (per position) |
| declared scope | `season=2025, asOfWeek=18` |
| serving reason | `scoringFallbackReason=config_error` on **all four** positions |

**Correction worth recording:** at small `limit` values the response instead
reports `insufficient_coverage`, because the meaningful-input gate
(`>= max(10, 0.6n)`) cannot be met by a 3-row sample. At a realistic cohort size
the gate **passes** and the scoring service is genuinely attempted — it then fails
with `config_error`, which `scoringServiceClient.ts:213` raises when
`SCORING_SERVICE_BASE_URL` is unset. So FORGE is serving because the Forecast
scoring service is **not configured in this environment**, not because the
readiness gate rejected the cohort.

---

## 2. Lineage and source inspection

### 2.1 Source snapshot: not recoverable

**Finding: no recoverable source snapshot exists in repository evidence.**

The operator reports the cache was populated from an older Replit database.
A search of `docs/` and `server/` finds only unrelated deployment/session history
(`docs/cowork-sessions/003`, `004`, `TIBERCLAW_ARCHITECTURE.md:405`,
`DB_WORKFLOW.md:65`) and AI-integration credentials. There is:

- no migration script, dump reference, or export manifest;
- no source database/schema version record;
- no `scripts/` tooling for a cache or database migration.

The Replit origin is therefore **neither established nor refuted** by this audit.
It remains operator-reported. Per #310 this is an audit *output*, and the typed
outcome is "no recoverable source snapshot exists".

### 2.2 The cache schema persists no provenance

`shared/schema.ts:4777–4836`, checked field by field:

| Needed for reproducibility | Persisted? |
|---|---|
| input manifest | ❌ |
| source table snapshot identity | ❌ |
| source content hash | ❌ |
| evidence-freshness attestation | ❌ |
| builder commit / engine version pin | ❌ |
| score computation time (`computed_at`) | ✅ |
| cache version string (`version`) | ✅ |

### 2.3 Computation time vs evidence time: not separable

`computed_at` = 2026-08-08 answers *when the score was recomputed*. Nothing in the
cache records when its football evidence was produced, so the newest and oldest
source-evidence times **cannot be separated from the computation time**. A 2026
timestamp over 2025 Week 18 football is exactly the confusion #307 exists to
prevent, and the cache itself offers no field that would resolve it.

### 2.4 Fixture / generated-baseline classification: undeterminable

The cache stores no per-row provenance, so player-specific rows cannot be
distinguished from generated baselines or fixtures **from the cache**. Per #310,
missing provenance fails closed as non-evidence — which applies to the whole
cohort, not a subset.

---

## 3. Identity coverage

| | |
|---|---|
| rows | 357 |
| distinct identifiers | **357** (zero duplicates) |
| GSIS-shaped (`00-` + 7 digits) | **357 (100.0%)** |
| other namespaces | 0 |
| cross-surface resolvability | **unavailable — requires database** |

Internal identity hygiene is clean. Cross-surface resolvability is *not*
assertable here: it needs `player_identity_map`, which this audit did not access.
Fantasy #308 owns that measurement and establishes the related fact that the
crosswalk did not consult `gsis_id` at all, so `/player/00-0036963` 404'd for the
row ranked #1 in this very cohort.

---

## 4. Reproducibility and semantic currency

### 4.1 Deterministic recompute: not possible

**Blockers, all three independent:**

1. no builder commit or engine version pinned in the cache;
2. the source tables (position role banks, `datadive_snapshot_player_week`) are
   not in this repository;
3. no source snapshot identity or content hash persisted, so even with database
   access there is nothing to pin *to*.

A recompute today would produce *some* numbers, but nothing would establish they
were the same inputs. That is not a deterministic reproduction.

### 4.2 Scoring formula, bounds, and tiering — documented from source

- **Pillar weights:** `POSITION_WEIGHTS` / view-mode adjustments,
  `forgeGrading.ts:49–125`.
- **Base alpha:** weighted pillar mean, clamped `[0, 100]` (`:139–155`).
- **Recursion:** prior-alpha blend with momentum clamped `±3` (`:178–184`).
- **Calibration:** `calibrateAlpha()` (`:127–137`) maps each position's raw
  `p10 → p90` onto `[outMin, outMax]` **with a hard clamp at both ends**.
- **Tiering:** `mapAlphaToTier()` (`:189–197`) against `POSITION_TIER_THRESHOLDS`.
- **Rounding:** alpha rounded to 1dp (`:259`).

### 4.3 The 25.0 / 95.0 bounds are **designed**, not a cohort artifact

`server/modules/forge/types.ts:525–550` declares, for **all four** skill positions,
`outMin: 25, outMax: 95`:

| position | p10 | p90 | outMin | outMax |
|---|---:|---:|---:|---:|
| WR | 31 | 76 | 25 | 95 |
| RB | 23 | 68 | 25 | 95 |
| TE | 29 | 64 | 25 | 95 |
| QB | 35 | 73 | 25 | 95 |

This answers audit question 6 definitively: **designed calibration bound**.

But the cohort adds a finding the bounds alone do not:

| position | n | min | max | at floor 25.0 | at ceiling 95.0 |
|---|---:|---:|---:|---:|---:|
| QB | 38 | 33.8 | 86.5 | 0 (0.0%) | 0 |
| RB | 95 | 25.0 | 95.0 | **20 (21.1%)** | 5 |
| WR | 146 | 25.0 | 95.0 | **59 (40.4%)** | 1 |
| TE | 78 | 25.0 | 95.0 | **37 (47.4%)** | 1 |
| **total** | **357** | | | **116 (32.5%)** | **7** |

**Roughly a third of the served board sits exactly on the floor.** Those rows are
mutually indistinguishable in alpha — their relative order carries no information
from the score. Nearly half the TE board is in that state. This is a presentation
hazard independent of provenance, and it is why the cache should not drive a
ranked surface even as history without that caveat attached.

---

## 5. Comparison with the FORGE producer candidate

### 5.1 The comparison #310 asks for cannot be performed as specified

The two artifacts **share no join key**:

| | Railway `forge_grade_cache` | Bundled `FORGE_PLAYER_STATIC_V1` |
|---|---|---|
| rows | 357 | 59 |
| identifier namespace | GSIS, 100% | 45 `tiber-data-player-…`, 14 `…-fixture` |
| **direct ID intersection** | **0** | **0** |
| alpha range | 25.0 – 95.0 (declared bounds) | 2.86 – 100 |
| `generated_at` | n/a (`computed_at` 2026-08-08) | 2026-01-08 |
| sha256 | n/a (database) | `cc2254a8…d9b5cf14` |

Name is **not** a usable fallback key either: the static artifact contains
**7 player names appearing on 2 rows each (14 rows total)** — one from each of its
two cohorts. Amon-Ra St. Brown is one of them.

Any join across these two artifacts therefore requires an explicit
identity-resolution step that does not exist yet. Per #310 this audit states the
method rather than inventing one: **no defensible join is available, so no
score-difference attribution is published.**

### 5.2 Representative side-by-side — Amon-Ra St. Brown

The single clearest illustration. Amon-Ra exists **three times across two
artifacts under three identifier namespaces with three different scores**:

| source | identifier | alpha | tier | evidence status |
|---|---|---:|---|---|
| Railway `forge_grade_cache` | `00-0036963` | **95.0** | T1 | *no provenance persisted* (17 games, rawAlpha 77.2) |
| `FORGE_PLAYER_STATIC_V1` | `real-player-2025-amon-ra-st-brown-strong-wr2-fixture` | **88.07** | elite | ⚠️ **`generated_baseline` — not player evidence** |
| `FORGE_PLAYER_STATIC_V1` | `tiber-data-player-2025-amon-ra-st-brown` | **30.13** | low | `player_specific` |

The 88.07 row **must not be read as source-backed player evidence**; the
artifact's own `score_source_policy` forbids it, and FORGE #49 (finding 2) tracks
that fixture rows occupy the top alphas. Confirmed here: the five highest static
alphas — Bowers 100, Chase 99.91, Bijan 97.56, Allen 92.69, Amon-Ra 88.07 — are
**all** `generated_baseline`.

A naive comparison of "95.0 vs 88.07" would compare a provenance-less cache score
against a fabricated baseline and read as near-agreement. The honest reading is
that these three numbers are not comparable at all.

### 5.3 Difference attribution

Not published — see 5.1. Attributing differences to inputs, cohort scale, engine
version, identity, or cache transformation requires a valid join, and there is
none. Publishing a category breakdown over a name-matched join would be
fabricated precision.

---

## 6. Consumer disposition

Per #310's fail-closed rule, provenance and reproducibility are both
insufficient, so:

These are **required dispositions this audit records**, not changes it makes.

- ❌ **No cache manifest/digest is added.** That is conditional on lineage and
  reproducibility being sufficient; neither is.
- ⛔ **Must be quarantined** from canonical/current ranking modes with the typed
  reason `legacy_forge_cache_quarantined_insufficient_provenance`. *Not yet
  enforced — #307 Phase B owns the consumer change.*
- 📌 **May be retained for 2025 history**, labelled legacy diagnostic/review
  data, with these limitations stated: unrecoverable source window, no
  deterministic recompute, and 32.5% of rows pinned at the calibration floor.
- ✅ **No score was synced** into or out of the static artifact in either
  direction — this one *is* a property of the work done here.

This aligns with #307: 2025 FORGE may remain reachable in a clearly labelled
archive, but must not silently occupy the current 2026 surface. #307 Phase A adds
the `seasonMeta.isArchiveView` signal that makes that labelling possible; the
final archive semantics and the actual quarantine enforcement are Phase B and
depend on this finding.

**To be unambiguous: this PR is additive — a report, two linked artifacts, one
script, and their tests. It changes no runtime path and no production consumer.**

**Authority unchanged:** Fantasy #291 remains the authority for the bundled
artifact's byte parity; FORGE #49 remains the authority for producer cohort scale
and fixture rows. Nothing here promotes, deploys, deletes, or mutates anything.

---

## 7. What could not be established

| Question | Status | Why |
|---|---|---|
| Exact source export identifier + SHA-256 | **unavailable** | no migration/dump/manifest evidence in-repo |
| Source database/schema version, migration path | **unavailable** | same |
| Replit origin true or false | **unresolved** | operator-reported; no corroborating artifact |
| Per-table row counts, null rates, PK checks | **unavailable** | requires database access |
| Min/max source season/week/as-of timestamps | **unavailable** | not persisted; requires source tables |
| Fixture vs generated vs player-specific split *in the cache* | **unavailable** | no per-row provenance |
| Deterministic recompute parity | **not possible** | three independent blockers, §4.1 |
| Cross-surface identity resolvability | **unavailable** | requires `player_identity_map`; see #308 |
| Score-difference attribution vs producer candidate | **not performed** | no valid join, §5.1 |

Every one of these is a *reason the cache fails closed*, not a gap to be filled by
assumption. No credential was requested and no lineage was manufactured.
