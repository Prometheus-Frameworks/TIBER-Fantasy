# Railway `forge_grade_cache` lineage audit

**Tracker:** [Fantasy #310](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/310)
**Date:** 2026-08-09
**Method:** read-only **with respect to production and the database** — public HTTP
GETs plus repository reads, no DB connection, no DDL, no Railway/Replit mutation.
The audit script does write its own local artifacts under `docs/audits/assets/`;
that is its deliverable.

**Artifacts:** [`assets/310-cache-audit-manifest.json`](assets/310-cache-audit-manifest.json)
· [`assets/310-live-cohort-observed.json`](assets/310-live-cohort-observed.json) *(frozen — see §0)*
**Regenerate derived findings:** `npx tsx scripts/audit/forgeCacheAudit.ts --offline`
(rewrites the manifest only; the frozen cohort is an input and is never written)
**Verify:** `npx tsx scripts/audit/forgeCacheAudit.ts --check`. It **rebuilds the
expected manifest** from the frozen cohort and the digest-pinned static artifact
and requires the committed one to equal it — so every derived finding (median,
clamping counts, comparability verdict) is verified by construction, not merely
spot-checked. On top of that it pins the complete frozen-cohort file digest, the
manifest/cohort agreement, the evidence status, the absence of
producer-attribution claims, the static-artifact digest, and this report's
consistency **against the current manifest's descriptive comparison** rather than
any hardcoded figure.

## 0. Evidence status of the observed cohort — read this first

```text
unverified_predates_lineage_guard
```

The 357 committed rows were captured **before** `scripts/audit/forgeCacheResponseGuard.ts`
existed. That guard is what binds a response to a producer path. Without it,
**nothing was recorded at capture time that can say which producer served those
bytes.** The same endpoint serves promoted scoring-service items whenever
`SCORING_SERVICE_BASE_URL` is configured and the call succeeds, so "these rows
came from the legacy cache" was an *inference from what the endpoint usually
serves* — not an observation.

This is visible in the committed bytes, not merely inferred from the guard's
absence. The guard's `ObservedPositionSource` declares `layer` and `source`
fields; the frozen `observation.per_position` records carry only `asOf` and
`fallbackReason` — for all four positions:

```json
"QB": { "asOf": "2026-08-08T19:03:54.986Z", "fallbackReason": "config_error" }
```

The serving layer was never captured, so it cannot be read back out.

**The observation file is frozen, wording and all.** The cohort at
[`assets/310-live-cohort-observed.json`](assets/310-live-cohort-observed.json)
is the dated 2026-08-09 record and remains **byte-for-byte unchanged** at

```
sha256 118c5cc60bc59c6f3b9ca8d35ebcce4cf4e4442adacbb72fa77fd5109204f106
```

Its internal `source_description` still says *"(which serves Railway
forge_grade_cache)"* — an attribution §0 shows the capture cannot support. That
wording is **superseded externally**, not rewritten: the manifest quotes it
verbatim under `frozen_cohort.superseded_source_description`, states the
supersession, and carries the audit's current, neutral description alongside.
Correcting a claim must never rewrite the record that made it.

| The frozen rows **can** support | The frozen rows **cannot** support |
|---|---|
| Structural observations: row counts, per-position counts, identifier shape and namespace | That the response came from `forge_grade_cache` |
| Descriptive numeric observations computed from the captured alphas: clamping bounds, floor/ceiling concentration, joined-row agreement and spread | That the response came from the promoted scoring service |
| | That the response came from **any** other named producer path |

Production GETs are **not** re-run into this artifact. The observation is
closed: `--check` fails if a single byte of the file moves, `--offline` refuses
a modified cohort, and the script has no default mode that fetches. A future
guarded observation (`--observe-to <new dated path>`) is a new, separately
dated artifact that records the serving layer — it never overwrites this one.

## Terminal finding

```text
observed_ranking_cohort_quarantined_insufficient_provenance
```

> **Renamed.** The superseded name was `legacy_forge_cache_quarantined_insufficient_provenance`.
> It asserted, in its own wording, that the cohort *came from the legacy cache* —
> the precise attribution §0 shows the capture cannot support. The finding is now
> named for the **observed cohort**, not for a producer; the manifest retains the
> old name under `disposition.superseded_finding_name`.

This is an **audit classification and a required disposition — not an
already-enforced runtime state.** Nothing in this audit changes the production
consumer; the Rankings surface still reads the cache today. Enforcement belongs
to Fantasy #307 Phase B.

Read it as: the observed 2025 ranking cohort **cannot be shown to be reproducible
or source-attributable from available evidence**, so it is **classified for
quarantine**. It **must not** occupy a canonical or current ranking mode. It may
remain reachable as clearly labelled 2025 legacy diagnostic/review data.

**Quarantine here is a policy response to insufficient provenance.** It is not a
verdict that any particular producer served these rows, and it is not a claim
that the scores are wrong. Nothing here says the scores are wrong; it says their
lineage cannot be established, which is the condition #310 defined as failing
closed. The 50-row GSIS join in §5 remains a valid *descriptive* comparison;
what stays blocked is producer/causal attribution — by the missing provenance,
not by a missing join.

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
| scoring-service outcome | `scoringFallbackReason=config_error` on **all four** positions |
| serving layer | **not recorded** — see §0 |

**Correction worth recording:** at small `limit` values the response instead
reports `insufficient_coverage`, because the meaningful-input gate
(`>= max(10, 0.6n)`) cannot be met by a 3-row sample. At a realistic cohort size
the gate **passes** and the scoring service is genuinely attempted — it then fails
with `config_error`, which `scoringServiceClient.ts:213` raises when
`SCORING_SERVICE_BASE_URL` is unset. So the Forecast scoring service is **not
configured in this environment**, and the readiness gate is not what rejected
the cohort.

**What this does not establish:** that FORGE served these particular rows. The
recorded `config_error` says the scoring-service *call failed*; the serving
layer itself was not captured (§0). Earlier revisions read the fallback reason
as proof that the legacy cache answered — it is consistent with that, but it is
not evidence of it.

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

| measure | value |
|---|---|
| rows | 357 |
| distinct identifiers | **357** (zero duplicates) |
| GSIS-shaped (`00-` + 7 digits) | **357 (100.0%)** |
| other namespaces | 0 |
| canonical coverage | **not recorded** — the capture predates the per-item identity envelope |
| cross-surface resolvability | **unavailable — requires database** |

These are measurements of the **producer's own key**, which is what this cohort
recorded and the only key the static artifact (§5) can be joined on. Fantasy
#313 has since made a ranking item's `playerId` the canonical public key —
`null` whenever identity does not resolve — and moved the producer key to
`identity.sourceId`. The audit tooling now reads that field, so a future guarded
observation records the producer key rather than a mix of canonical keys and
blanks. Canonical coverage is reported as *not recorded* rather than as zero:
this capture predates the envelope, so the canonical state was never observed.

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

### 5.1 The lineages are now joinable (refreshed against main `ee68666`)

**This section was rewritten after TIBER-Fantasy PR #318 landed.** As originally
published it said the two artifacts shared no join key and that no comparison
could be performed. #318 replaced the bundled artifact
(`cc2254a8…` → `de0e2c19…`) and gave it real GSIS identifiers, which made the
earlier conclusion false. The original finding is preserved below as a dated
record rather than quietly deleted.

| | Railway `forge_grade_cache` | `FORGE_PLAYER_STATIC_V1` (was) | `FORGE_PLAYER_STATIC_V1` (main `ee68666`) |
|---|---|---|---|
| rows | 357 | 59 | **50** |
| identifier namespace | GSIS, 100% | 45 `tiber-data-player-…`, 14 `…-fixture` | **GSIS, 100%** |
| **direct ID intersection** | — | **0** | **50** |
| `generated_baseline` rows | n/a | 14 | **0** |
| repeated names | n/a | 7 names × 2 rows | **0** |
| sha256 | n/a (database) | `cc2254a8…` | `de0e2c19…` |

Every one of the 50 static rows intersects the observed cache cohort, and no
ambiguous-name blocker remains, so a join is now defensible on `gsis_player_id`.

> The audit tooling derives this verdict from the measured identifiers rather
> than asserting it, and `--check` now hashes the static artifact, so a future
> replacement of those bytes fails loudly instead of silently invalidating the
> findings the way #318 did.

### 5.2 Descriptive comparison across the 50 shared players

Published now that a join exists. **Descriptive only** — it reports where the two
artifacts agree and differ, and deliberately attributes nothing, because the
cache does not persist the lineage that would support attribution.

| measure | value |
|---|---:|
| joined rows | 50 |
| **exact agreement** | **0** |
| within ±1.0 alpha | 2 |
| within ±5.0 alpha | 18 |
| median delta (cache − static) | -3.215 |
| range | -26.01 … +22.30 |

Largest absolute disagreements:

| player | GSIS | pos | static alpha | cache alpha | delta |
|---|---|---|---:|---:|---:|
| Mark Andrews | `00-0034753` | TE | 70.01 | 44 | -26.01 |
| Zay Flowers | `00-0039064` | WR | 82.23 | 59.3 | -22.93 |
| Jacoby Brissett | `00-0033119` | QB | 57.7 | 80 | +22.30 |
| T.Hill | `00-0033040` | WR | 34.76 | 55.2 | +20.44 |
| Brock Bowers | `00-0039338` | TE | 72.43 | 90 | +17.57 |

**The two artifacts agree exactly on none of the 50 shared players.**

That is a measurement, not an explanation: it
does not establish which artifact is closer to correct, nor why they differ.
Answering that needs the input manifest, source snapshot identity and engine
version pin that §6 shows the cache does not persist — which is precisely the
terminal finding, now supported by a joinable comparison rather than blocked
by the absence of one.

### 5.2b Original finding, superseded — retained as a dated record

As observed on 2026-08-09 against static artifact `cc2254a8…`, the two artifacts
shared **no** join key: 0 direct ID intersection, and name was unusable as a
fallback because 7 player names appeared on 2 rows each. Amon-Ra St. Brown then
existed three times across two artifacts under three namespaces with three
scores (cache `00-0036963` 95.0; static `…-fixture` 88.07, `generated_baseline`
and explicitly not player evidence; static `tiber-data-player-…` 30.13,
`player_specific`). Under that artifact no defensible join existed and no
difference attribution was published.

### 5.3 Difference attribution

Still not published — but for a different reason than before. A valid join now
exists (§5.2), so the blocker is no longer identity. Attributing the measured
differences to inputs, cohort scale, engine version, or cache transformation
requires the reproducibility fields §6 shows the cache does not persist. Publishing a category breakdown over a name-matched join would be
fabricated precision.

---

## 6. Consumer disposition

Per #310's fail-closed rule, provenance and reproducibility are both
insufficient, so:

These are **required dispositions this audit records**, not changes it makes.

- ❌ **No cache manifest/digest is added.** That is conditional on lineage and
  reproducibility being sufficient; neither is.
- ⛔ **Must be quarantined** from canonical/current ranking modes with the typed
  reason `observed_ranking_cohort_quarantined_insufficient_provenance` (the
  previous name, `legacy_forge_cache_quarantined_insufficient_provenance`, is
  superseded — it asserted a producer origin §0 shows is unsupported). *Not yet
  enforced — #307 Phase B owns the consumer change.* The quarantine is a
  response to insufficient provenance, not a finding about which producer
  served the rows.
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
| Score-difference attribution vs producer candidate | **not performed** | join now exists (§5.1); blocked instead by the missing lineage the terminal finding names, §5.3 |
| Which producer path served the observed cohort | **unverified** | captured before the lineage guard, §0 |

Every one of these is a *reason the cache fails closed*, not a gap to be filled by
assumption. No credential was requested and no lineage was manufactured.
