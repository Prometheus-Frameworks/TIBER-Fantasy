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
   never silently mapped to an arbitrary player.
3. **Re-run the census after each repair** until it exits `0`, then apply the
   index.

This means correctness does not depend on the index existing. The index is a
durability guarantee; the fail-closed runtime is the safety guarantee.

## Coverage gate before fail-closed non-linking

100% of the live ranking cohort (357 rows observed 2026-08-09) is GSIS-shaped, so
enabling fail-closed non-linking against a sparse crosswalk would blank the board.
Every ranking response therefore reports `identityCoverage`:

```json
{ "total": 357, "canonical": 0, "resolved": 340, "unresolved": 17,
  "ambiguous": 0, "coverageRatio": 0.952,
  "byReason": { "gsis_not_in_identity_map": 17 } }
```

Unresolved rows still render — they lose only their deep link. Check
`coverageRatio` against production before treating unresolved rows more strictly
than that.
