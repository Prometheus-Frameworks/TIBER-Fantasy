-- Fantasy #327 (PR A): canonical TIBER NFL-player identity on the existing registry.
--
-- Operator decision (settled): TIBER owns its canonical entity identities;
-- provider identifiers (GSIS, Sleeper, ESPN, ...) are typed aliases or
-- domain-specific join keys. `tiber_player_id` is the opaque canonical
-- identity, wire format `tbr_p_<ULID>` — no name, team, season, or provider
-- information encoded.
--
-- Backfill note: values are minted by the application backfill
-- (PlayerIdentityService.backfillTiberPlayerIds), not by SQL, so the mint
-- format lives in exactly one place. The column stays nullable; merged rows
-- (merged_into IS NOT NULL) intentionally never receive their own id and
-- resolve through the surviving row.

ALTER TABLE player_identity_map
  ADD COLUMN IF NOT EXISTS tiber_player_id text;

CREATE UNIQUE INDEX IF NOT EXISTS pim_tiber_player_id_idx
  ON player_identity_map (tiber_player_id)
  WHERE tiber_player_id IS NOT NULL;

-- GSIS alias uniqueness — the previously missing index behind the fail-closed
-- GSIS resolution machinery. Creation is census-gated: if duplicate or
-- blank/whitespace-padded gsis_id values exist, this migration fails with an
-- explicit report instead of silently indexing bad state. Run
-- PlayerIdentityService.censusGsisIdentity() to enumerate offenders first.
-- The resolvers' duplicate/ambiguity fail-closed behavior is retained even
-- after the index exists (operator decision #6).
DO $$
DECLARE
  duplicate_count integer;
  blank_count integer;
BEGIN
  SELECT count(*) INTO duplicate_count FROM (
    SELECT gsis_id FROM player_identity_map
    WHERE gsis_id IS NOT NULL
    GROUP BY gsis_id
    HAVING count(*) > 1
  ) AS dupes;

  SELECT count(*) INTO blank_count FROM player_identity_map
  WHERE gsis_id IS NOT NULL AND (gsis_id = '' OR gsis_id <> btrim(gsis_id));

  IF duplicate_count > 0 OR blank_count > 0 THEN
    RAISE EXCEPTION
      'pim_gsis_id_idx census gate failed: % duplicated gsis_id value(s), % blank/whitespace-padded value(s). Resolve via the identity review queue (censusGsisIdentity) before re-running this migration.',
      duplicate_count, blank_count;
  END IF;

  EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS pim_gsis_id_idx
    ON player_identity_map (gsis_id)
    WHERE gsis_id IS NOT NULL';
END $$;
