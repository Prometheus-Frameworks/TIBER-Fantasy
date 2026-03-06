# TIBER Data Quality Issue: FORGE Stats Discrepancy

**Date:** March 7, 2026  
**Issue:** FORGE engine returning inaccurate 2025 season player stats  
**Severity:** HIGH - Affects core TIBER functionality and trust in system

---

## Summary

During a roster review for the H4MMER dynasty team, a significant discrepancy was discovered between actual 2025 NFL player stats and what TIBER's FORGE engine was returning.

## The Problem

### Expected Data (Actual 2025 Season)
| Player | Receptions | Yards | TDs | Targets |
|--------|-----------|-------|-----|---------|
| Jaxon Smith-Njigba | 119 | 1,793 | 10 | 163 |
| Chris Olave | 100 | 1,163 | 9 | 156 |

### FORGE API Response (As of March 7, 2026)
| Player | Alpha | Volume Stats Returned |
|--------|-------|---------------------|
| Jaxon Smith-Njigba | 74.6 | 99 targets, 82 receptions, 1,104 yards |
| Chris Olave | 87.7 | 118 targets, 87 receptions, 1,243 yards |

**The data is off by ~600-700 yards for JSN, representing an entire month's production missing.**

## Impact

1. **Incorrect Player Rankings** - JSN ranked below Olave when actual production suggests otherwise
2. **Bad Buy/Sell Recommendations** - Can't trust FORGE scores for roster decisions
3. **Data Trust Erosion** - If one player is this wrong, how many others are?
4. **Broken Roster Analysis** - Can't accurately assess team strength

## Suspected Root Causes

1. **Incomplete 2025 Season Sync**
   - Player stats ingestion pipeline may have failed mid-season
   - Week 17+ data may not have been processed

2. **Player ID Mapping Issues**
   - JSN's Sleeper ID may not be properly linked to his stats record
   - Identity map could be pointing to wrong data source

3. **Data Pipeline Failure**
   - Sleeper/nflverse/College stats not fully loaded
   - Game log ETL pipeline incomplete

## Next Steps

1. **Verify 2025 Stats Sync Status**
   - Check if `POST /api/sync/rosters` completed for 2025
   - Review data pipeline logs for 2025 week 17-18

2. **Audit Player Identity Map**
   - Verify JSN's `playerIdentityMap` record
   - Cross-reference Sleeper ID with gsis_id

3. **Run Full Data Reconciliation**
   - Compare TIBER DB vs actual 2025 leaderboards
   - Identify all players with >500 yard discrepancies

4. **Fix and Resync**
   - Patch player ID mappings
   - Re-run stats pipeline for 2025
   - Re-score all FORGE rankings

## Test Queries to Verify Fix

```bash
# Should return full 2025 stats
curl "https://tiber-fantasy.replit.app/api/forge/preview?name=jaxon&position=WR"

# Should show 1,793 yards for JSN
# If still broken, data issue confirmed
```

---

**Reported by:** Max ⚡  
**For:** TIBER Development  
**Priority:** Urgent
