# BUG: QB Passing Stats Zeroed in ETL Pipeline

**Reported by:** Max (OpenClaw connector — live analysis session)  
**Date:** 2026-02-28  
**Severity:** High — directly impacts FORGE efficiency pillar scoring for QBs  
**Session:** SESSION_005 (live buy/sell analysis)

---

## Summary

During live FORGE analysis of C.J. Stroud (2025 season), the following QB stats are returning as `0` or `null` in game log data despite the player being an active starter:

- `passingYards`
- `passingTDs`

CPOE (`completionPctOverExpected`) is **populating correctly** at `+0.69`, confirming the ETL pipeline is partially working for this player.

---

## Impact

The FORGE efficiency pillar for QBs relies heavily on passing yards and passing TDs as core volume-efficiency signals. When these fields are zeroed:

- Efficiency pillar is materially understated (Stroud returned **31.9** — likely significantly higher with correct data)
- Alpha score is suppressed (Stroud's T4 Alpha of **46.0** may be understating a legitimate dynasty asset)
- Any QB with a mid-season injury is especially vulnerable: zeroed weeks compound with missing weeks to produce a severely distorted season picture

This is **not** a Stroud-specific issue — any QB whose passing yards/TDs failed to ingest will be scored incorrectly.

---

## Reproduction

Run via TiberClaw connector:

```bash
# Pull game logs for CJ Stroud, 2025 season
./tools/player-gamelogs.sh <stroud_player_id> 2025

# Check passingYards and passingTDs fields — expect non-zero for active QB weeks
```

Also visible in FORGE score:
```bash
./tools/forge-player.sh <stroud_player_id> QB
# Efficiency pillar returns ~31.9 — inconsistent with CPOE of +0.69
```

---

## Root Cause (Hypothesis)

Likely one of:

1. **ETL field mapping mismatch** — `passingYards` / `passingTDs` column name differs between the data source schema and the DB insert query
2. **Source API response parsing** — the raw JSON field path changed in MySportsFeeds or nflverse and the parser is now hitting `undefined`
3. **QB-specific ETL branch** — the WR receiving ETL bug (already flagged) suggests position-specific ETL paths exist; QB path may have the same stale/missing field issue

---

## Requested Fix

1. Audit the QB ETL ingest path for `passingYards` and `passingTDs` field mapping
2. Verify against raw source data that these fields are present and non-zero for Stroud's weeks 1-8 (pre-injury weeks where EPA/play was positive)
3. Backfill corrected values for 2025 season if mapping was broken
4. Add a QA check: flag any active starter QB week where `passingYards === 0` and `snapCount > 20` — these are almost certainly bad ingests

---

## Additional Context

- Stroud pre-injury (Wks 1-8) had legitimate EPA/play: +1.13, +0.63, +0.92, +3.04 in best weeks
- CPOE of +0.69 is real — he's throwing accurately, the passing yards/TDs just aren't making it through
- Wk9: 23 snaps (injury game), Wks 10-12: missing (IR), return Wk13: rust/compromised stretch
- Wk15 was his best fantasy output (29.2 PPR) — efficiency may have been suppressed in FORGE even then
- Dynasty hold is defensible; clean 2026 season needed to confirm efficiency floor

---

## Related

- `reports/SESSION_005_game_log_api_request.md` — game log endpoint request (now resolved)
- CODEX-008: red zone stats + some Week 18 fields still pending backfill (separate issue)
- WR ETL bug: weeks 1-17 stale receiving data (separate issue, Replit in progress)
