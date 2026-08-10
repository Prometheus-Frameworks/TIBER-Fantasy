# GSIS uniqueness and collision policy

Fantasy [#308](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/308).

## Current state

`player_identity_map` carries a `gsis_id` column (`shared/schema.ts`), but unlike
every other platform-ID column it has **no unique index**. Compare:

| column | unique index |
|---|---|
| `sleeper_id` | `pim_sleeper_id_idx` (partial, `WHERE NOT NULL`) |
| `espn_id` | `pim_espn_id_idx` |
| `yahoo_id` | `pim_yahoo_id_idx` |
| `rotowire_id` | `pim_rotowire_id_idx` |
| `fantasy_data_id` | `pim_fantasy_data_id_idx` |
| `fantasypros_id` | `pim_fantasypros_id_idx` |
| `mysportsfeeds_id` | `pim_mysportsfeeds_id_idx` |
| `nfl_data_py_id` | `pim_nfl_data_py_id_idx` |
| **`gsis_id`** | **none** |

## Why no migration ships in this PR

`CREATE UNIQUE INDEX` against live data containing duplicates **fails**, and
repairing a duplicate is an identity decision (which canonical row wins, what
happens to the loser's other platform IDs) that belongs to an operator, not to an
implicit migration. Whether duplicates exist cannot be determined from the
repository — it requires database access this work did not have.

So the order is fixed: **census first, migration second.**

## Step 1 — run the read-only census

```bash
npx tsx scripts/identity/gsisIdentityCensus.ts          # human-readable
npx tsx scripts/identity/gsisIdentityCensus.ts --json   # machine-readable
```

Requires `DATABASE_URL`. Performs no writes and no DDL. Exit codes: `0` a unique
index would apply cleanly, `1` duplicates block it, `2` the census could not run.

It reports total rows, `gsis_id` present/null, distinct values, duplicated values
and the rows involved, malformed values (not matching `00-` + seven digits), and
samples of both duplicates and malformed values.

## Step 2 — disposition

### Census clean (`uniqueIndexSafe: true`)

Apply a partial unique index matching the sibling columns:

```sql
CREATE UNIQUE INDEX pim_gsis_id_idx
  ON player_identity_map (gsis_id)
  WHERE gsis_id IS NOT NULL;
```

Partial, so nulls stay permitted — a player with no known GSIS is normal, not an
error.

### Census dirty (`uniqueIndexSafe: false`)

Do **not** apply the index. Deterministic collision policy, in order:

1. **Report, never auto-merge.** The census lists every duplicated `gsis_id` with
   its competing `canonical_id`s. Merging identities is operator work; the
   existing `merged_into` / `needs_review` columns are the mechanism.
2. **Runtime already fails closed.** `getCanonicalIdByGsisId` returns
   `{ status: 'ambiguous' }` and `resolveCanonicalIdsByGsis` puts the value in
   the `ambiguous` set. Neither picks a winner. At the ranking boundary such a
   row is emitted as `identity.status: 'unresolved'` with
   `reason: 'gsis_ambiguous_duplicate_crosswalk_rows'` — visible, non-linkable,
   never silently mapped to an arbitrary player. Query failures are separately
   typed as `unavailable` / `gsis_identity_lookup_unavailable`; they are never
   treated as evidence that a GSIS is absent and never permit a same-text
   canonical fallback.
3. **Re-run the census after each repair** until it exits `0`, then apply the
   index.

This means correctness does not depend on the index existing. The index is a
durability guarantee; the fail-closed runtime is the safety guarantee.

## Operator activation gates — no unmeasured production claims

This change was built without `DATABASE_URL`. No database-wide GSIS census and
no production ranking-cohort coverage figure is recorded by this PR. In
particular, example counts must not be copied into an operator decision as if
they were live measurements.

Two separate gates apply:

1. **Runtime visibility gate (already fail-safe):** every actual Rankings v2
   response measures its own returned cohort in `identityCoverage`. Unresolved
   or ambiguous rows remain visibly present and keep their producer ID in
   `identity.sourceId`; only the player deep link is withheld. A sparse
   crosswalk therefore cannot blank the board.
2. **Database uniqueness gate (operator activation required):** do not create a
   unique GSIS index, declare production identity coverage sufficient, or add a
   stricter row-hiding policy until an operator runs the census above against
   the target environment, records its output, inspects all position cohorts,
   and disposes any duplicates. Repository tests and request-local coverage are
   not substitutes for that production evidence.

A request-local coverage envelope has this shape; the values below are labels,
not fabricated sample counts:

```text
total, canonical, resolved, unresolved, ambiguous, coverageRatio, byReason
```

Activation record checklist:

- target environment and observation timestamp;
- census output and exit code;
- Rankings v2 season/week/position query for each measured cohort;
- returned `identityCoverage` envelopes;
- duplicate disposition or explicit confirmation that none were observed;
- operator decision on the uniqueness migration and any stricter policy.

Until that record exists, the current visible/non-linked unresolved behavior is
the terminal safe state.

## Rankings v2 compatibility revision

Canonical-only nullable `playerId` is a consumer-visible contract change. The
public version is `v2-canonical-identity-2026-08-09`; clients must validate that
exact revision before interpreting the identity envelope. Older
`v2-scaffold-2026-04-02` payloads are not silently coerced into the new shape.
