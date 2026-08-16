# Canonical TIBER player identity — operator runbook

Operational procedure for the canonical `tiber_player_id` registry contract
(Fantasy #327; core merged in #329 as `d89cf98`).

**Identity model.** TIBER owns its canonical entity identities. `tiber_player_id`
(`tbr_p_<ULID>`, opaque) is the entity identity; GSIS, Sleeper, ESPN and other
provider identifiers are **typed aliases or domain-specific join keys**, never
the entity itself. GSIS remains the preferred statistical join authority for
GSIS-keyed governed datasets.

All commands below run **inside the target environment** (Railway), which
supplies `DATABASE_URL`. Credentials are never passed on the command line.

---

## Step 1 — Confirm migration 0014 is present and applied (read-only)

Run this **before** any backfill. It writes nothing.

```bash
railway run psql "$DATABASE_URL" -c "
SELECT
  (SELECT count(*) FROM information_schema.columns
     WHERE table_name = 'player_identity_map'
       AND column_name = 'tiber_player_id')            AS canonical_column,
  (SELECT count(*) FROM pg_indexes
     WHERE tablename = 'player_identity_map'
       AND indexname = 'pim_tiber_player_id_idx')      AS tiber_unique_index,
  (SELECT count(*) FROM pg_indexes
     WHERE tablename = 'player_identity_map'
       AND indexname = 'pim_gsis_id_idx')              AS gsis_unique_index;
"
```

**Required result: `1 | 1 | 1`.** That is the authoritative check — it inspects
the schema itself rather than trusting a bookkeeping row.

- Any `0` means migration 0014 has **not** fully applied. Do not run the
  backfill. Check the deploy logs for the migrator's census gate, which aborts
  by design on duplicate/blank/whitespace `gsis_id` values.
- Migration 0014 is not destructive and is safe to re-apply: both index
  creations are `IF NOT EXISTS` and the column add is `IF NOT EXISTS`.

Optional bookkeeping cross-check (Drizzle's own journal — schema `drizzle`,
table `__drizzle_migrations`):

```bash
railway run psql "$DATABASE_URL" -c \
  "SELECT hash, to_timestamp(created_at/1000) AS applied_at
     FROM drizzle.__drizzle_migrations
    ORDER BY created_at DESC LIMIT 5;"
```

This is informational only. Migrations `0008`–`0013` predate journal
registration in this repo, so an absent row is not by itself proof that the
schema change is missing — the schema query above is what decides.

---

## Step 2 — Pre-backfill census (read-only)

```bash
railway run npm run identity:census > census-pre-backfill.json
```

Expected on a freshly migrated production registry: `activeNull` equals the
number of pre-existing surviving rows (they predate the contract), `ok: true`.
Exit code `1` means the read failed and registry state was **not** observed —
an unavailable census is never treated as a clean one.

---

## Step 3 — Backfill (the only write step)

```bash
railway run npm run identity:backfill > backfill-receipt.json
```

- Mints a canonical id for every surviving row that lacks one.
- Skips merged rows by design: a merged row's identity lives on its survivor.
- Idempotent — safe to re-run; a second run mints `0`.
- Automatically takes a post-backfill census and embeds it in the receipt.

**Exit code `0` requires all of:** the backfill completed, the post-backfill
census was observable, and `activeNull == 0`. Anything else exits `1` with an
explicit `error` field. Residual `activeNull > 0` after a completed backfill
means some writer is bypassing the governed mint — stop and investigate rather
than re-running.

Preserve `backfill-receipt.json` as the operational receipt.

---

## Step 4 — Confirm and record

From the receipt: `ok: true`, `backfill.status: "complete"`, and
`census.activeNull: 0`. Attach the receipt to the tracking issue (#327).

---

## Notes

- **Retired writer.** `server/scripts/populatePlayerIdentityFromUsage.py` is
  retired: it hard-fails once `tiber_player_id` exists, because it cannot mint
  canonical identities. Use the governed registry paths instead.
- **Standing detector.** `npm run identity:census` can be re-run at any time; it
  is the detector for any future writer that bypasses the mint.
- **No consumer reads the column yet.** The search boundary, post-cutoff ledger,
  and client pages are unchanged until PR B/C of #327.
