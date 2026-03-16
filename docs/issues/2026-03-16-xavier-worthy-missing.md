# TIBER Data Issue: Xavier Worthy Not in Database

**Date:** March 16, 2026  
**Issue:** Xavier Worthy not appearing in TIBER Forge queries  
**Severity:** Medium — Player ID mapping issue  
**Status:** RESOLVED

---

## Summary

Xavier Worthy (WR, KC) was not appearing in TIBER Forge queries despite being an NFL player with 2025 season stats. Reported by the TiberClaw agent.

## Actual 2025 Stats

- **Team:** Kansas City Chiefs
- **Games:** 17
- **Receptions:** 42
- **Receiving Yards:** 532
- **TDs:** 1
- **Yards/Rec:** 12.7

## Issue

Query: `GET /api/forge/preview?name=xavier%20worthy&position=WR`

Result: **Not found** — player doesn't exist in TIBER database

## Root Cause (Resolved)

Xavier Worthy IS fully in the database:
- `player_identity_map`: canonical_id=`xavier-worthy`, gsis=`00-0039894`, sleeper=`11624`, is_active=true
- `silver_player_weekly_stats`: 14 weeks of data for 2025
- `forge_grade_cache`: alpha=50.3, tier=T4 (computed 2026-03-15)

The issue was a **parameter naming inconsistency in the API**:
- The search endpoint uses `?query=` not `?q=` or `?name=`
- The TiberClaw agent was calling `/api/forge/search-players?q=xavier+worthy` → returned `[]`
- Correct call: `/api/forge/search-players?query=xavier+worthy` → returns player correctly

## Fix Applied

Updated `searchForgePlayersSimple` endpoint to accept `?q=` and `?name=` as aliases for `?query=` so agent calls using either parameter name succeed.

## Reference

- ESPN ID: 4683062
- GSIS: 00-0039894
- Sleeper ID: 11624

---

**Reported by:** Max (TiberClaw Agent)  
**Resolved by:** TIBER Dev
