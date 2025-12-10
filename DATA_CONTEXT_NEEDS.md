# Data Context Needs for TIBER Platform

## Critical Data Gaps - PROGRESS UPDATE

### 1. **Current NFL Roster Data** ✅ **SOLVED**
- **Issue**: Player pool shows outdated team assignments (Hunter as COL instead of JAX)
- **Solution**: Implemented roster sync system merging Sleeper API + NFL data
- **Status**: Travis Hunter now correctly shows JAX team assignment
- **Results**: 11,396 players synced across 33 teams with current assignments

### 2. **2025 NFL Draft Results Integration**
- **Need**: Complete rookie class with draft positions, teams, and depth chart projections
- **Key Players**: Hunter (JAX), McConkey (LAC), other rookies in player pool
- **Sources**: NFL Draft API, team depth chart updates

### 3. **Current Depth Chart Data** 
- **Need**: Real-time depth chart positioning for opportunity analysis
- **Critical For**: Target competition, snap share projections, role security
- **Example**: JAX WR depth chart to properly evaluate Hunter's opportunity

### 4. **Recent Transaction Data**
- **Need**: Trades, signings, releases, IR moves
- **Impact**: Immediate opportunity shifts, target competition changes
- **Frequency**: Daily updates during season, weekly during offseason

### 5. **Current ADP Data** 
- **Need**: Live draft data from multiple platforms
- **Sources**: Sleeper, Yahoo, ESPN, FFPC, best ball sites
- **Use**: Validation of draft strategy decisions like Hunter vs Pickens

### 6. **Injury Status Updates**
- **Need**: Real-time injury reports and return timelines
- **Sources**: NFL injury reports, beat reporter intel
- **Impact**: Immediate opportunity shifts, handcuff value

## Data Integration Priorities

1. **NFL Official Roster API** - Most authoritative source
2. **Sleeper API Enhancement** - Already integrated, needs roster sync
3. **MySportsFeeds** - Already available, expand usage
4. **FantasyPros API** - ADP and expert consensus
5. **Twitter/X Feed Integration** - Beat reporter intel (if possible)

## Quick Wins Available

- **Sleeper API**: Already pulling 3,755 players, add team assignment sync
- **MySportsFeeds**: Already configured, expand to roster transactions
- **Player Pool Refresh**: Automated daily updates vs current static data

## What You Can Provide

- **Current roster assignments** for key players
- **2025 draft results** with team assignments
- **Recent significant transactions** affecting opportunity
- **Current depth chart intel** for target competition analysis

This would transform the platform from using outdated static data to providing real-time accurate analysis.