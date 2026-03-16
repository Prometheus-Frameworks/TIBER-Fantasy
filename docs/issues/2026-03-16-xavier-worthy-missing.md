# TIBER Data Issue: Xavier Worthy Not in Database

**Date:** March 16, 2026  
**Issue:** Xavier Worthy not appearing in TIBER Forge queries  
**Severity:** Medium — Player ID mapping issue

---

## Summary

Xavier Worthy (WR, KC) is not appearing in TIBER Forge queries despite being an NFL player with 2025 season stats.

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

## Suspected Root Cause

Similar issue to JSN — player ID mapping problem:
- Player may not be in the `playerIdentityMap` table
- Or Sleeper ID not properly linked to stats

## Action Items

1. Check if Xavier Worthy exists in `playerIdentityMap`
2. Verify his Sleeper ID is correct and linked
3. If missing, add to the identity map
4. Backfill his 2025 stats

## Reference

- ESPN ID: 4683062
- Pro Football Reference: WortXa00

---

**Reported by:** Max ⚡  
**For:** TIBER Development
