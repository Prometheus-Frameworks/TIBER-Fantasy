# Feature Link Map

**Last Updated:** 2025-01-01  
**Purpose:** Document how major features connect, their identity keys, data sources, and known drift risks.

---

## 1. Identity Spine

### ID Formats in Use

| ID Type | Format | Example | Primary Use |
|---------|--------|---------|-------------|
| `canonical_id` | `{firstname}-{lastname}` or `{firstname}-{lastname}-{suffix}` | `jamarr-chase`, `mike-williams-1` | Internal player identity, cross-platform resolution |
| `gsis_id` (nfl_data_py) | `00-xxxxxxx` | `00-0036900` | NFL official data, weekly stats, play-by-play |
| `sleeper_id` | Numeric string | `4866` | Sleeper API, league rosters |

### Which ID Each Endpoint Expects

| Endpoint | Expected ID Format | Notes |
|----------|-------------------|-------|
| `/player/:playerId` (frontend route) | `canonical_id` | URL slug, e.g., `/player/jamarr-chase` |
| `/api/player-identity/player/:id` | `canonical_id` | Returns full identity record |
| `/api/metric-matrix/player-vector` | `canonical_id` | Query param `?playerId=` |
| `/api/tiber-score` | `canonical_id` | Query param `?playerId=` |
| `/api/players/similar` | `canonical_id` | Research hub endpoint |
| `/api/tiers/neighbors` | `canonical_id` | Tier context endpoint |
| `/api/league/ownership` | `canonical_id` | Ownership lookup |

### Identity Resolution Tables

- **`player_identity_map`**: Master identity table bridging IDs
  - Columns: `canonical_id`, `sleeper_id`, `nfl_data_py_id`, `full_name`, `position`, `team`, etc.
  - Used by: Ownership service, player lookup, platform sync

- **`canonical_player_pool`**: Authoritative player roster
  - Columns: `canonical_id`, `gsis_id`, `full_name`, `position`, `team`, `is_active`
  - Primary source for player existence checks

---

## 2. Time Spine

### Current Week System

**Endpoint:** `GET /api/system/current-week`

**Response:**
```json
{
  "success": true,
  "currentWeek": 17,
  "season": 2024,
  "weekStatus": "in_progress|completed",
  "upcomingWeek": 17
}
```

**Logic:** Uses `getCurrentWeek()` helper that determines week based on NFL schedule dates.

### Player Week Availability

**Endpoint:** `GET /api/player-identity/player/:playerId/weeks?season=2025`

**Response:**
```json
{
  "success": true,
  "data": {
    "playerId": "jamarr-chase",
    "season": 2025,
    "availableWeeks": [1, 2, 3, 4, 5],
    "latestWeek": 5,
    "totalWeeks": 5
  }
}
```

**Used by:** PlayerPage week dropdown - marks weeks without data as disabled.

### Week Fallback Behavior

1. Frontend fetches player's available weeks
2. If current system week > player's latest week, defaults to `latestWeek`
3. Dropdown shows all weeks 1-18 but grays out weeks without data
4. Season mode aggregates across all available weeks

---

## 3. Feature Inventory

### 3.1 TIBER Score + TiberScoreCard

| Aspect | Value |
|--------|-------|
| **Routes** | `GET /api/tiber-score?playerId=X&season=Y&week=Z` |
| **Tables** | `tiber_scores`, `player_usage`, `weekly_stats` |
| **Caches** | None (computed on demand) |
| **Dependencies** | Player identity resolution, week system |
| **Component** | `TiberScoreCard.tsx` |

### 3.2 Metric Matrix Player Vector + MetricMatrixCard

| Aspect | Value |
|--------|-------|
| **Routes** | `GET /api/metric-matrix/player-vector?playerId=X&season=Y&week=Z` |
| **Tables** | `player_usage`, `metric_matrix_player_vectors` (cache table) |
| **Caches** | `metric_matrix_player_vectors` with `computed_at` timestamp |
| **Dependencies** | `player_usage` data, percent scale enforcement |
| **Component** | `MetricMatrixCard.tsx` |

**Key Metrics Returned:**
- `snap_share_pct`, `target_share_pct`, `redzone_share_pct`
- `yards_per_target`, `yards_after_catch`, `target_premium`
- Plus computed axes for similarity comparisons

### 3.3 Metric Matrix Coverage

| Aspect | Value |
|--------|-------|
| **Routes** | `GET /api/metric-matrix/coverage?season=Y&week=Z` |
| **Tables** | `player_usage` |
| **Purpose** | Reports non-null % for `snap_share_pct`, `target_share_pct` |

**Response includes:**
- `totalRows`, `coverage.snap_share_pct.pct`, `coverage.target_share_pct.pct`
- `missingSnapShareSample` by team/position

### 3.4 Similar Players

| Aspect | Value |
|--------|-------|
| **Routes** | `GET /api/players/similar?playerId=X&season=Y&week=Z&limit=5` |
| **Tables** | `metric_matrix_player_vectors`, `player_identity_map` |
| **Caches** | LRU cache on vector computation |
| **Dependencies** | Metric Matrix vectors, identity resolution |
| **Service** | `similarPlayersService.ts` |

**Returns:** Players with smallest Euclidean distance on normalized metric axes.

### 3.5 Tier Neighbors

| Aspect | Value |
|--------|-------|
| **Routes** | `GET /api/tiers/neighbors?playerId=X&position=WR&mode=dynasty` |
| **Tables** | `forge_alpha_scores` (source of tier data) |
| **Dependencies** | FORGE Alpha scores, tier thresholds |
| **Service** | `tiersNeighborsService.ts` |

**Returns:** Players immediately above/below in tier rankings.

### 3.6 League Ownership

| Aspect | Value |
|--------|-------|
| **Routes** | `GET /api/league/ownership?playerId=X`, `GET /api/league/ownership/debug?leagueId=Y` |
| **Tables** | `league_teams`, `user_league_preferences`, `player_identity_map` |
| **Caches** | LRU cache (15-min TTL) per `leagueId` |
| **Dependencies** | Sleeper→Canonical ID bridge |
| **Service** | `ownershipService.ts` |

**Status Values:** `owned_by_me`, `owned_by_other`, `free_agent`, `disabled`, `fallback`

### 3.7 PlayerDetailDrawer

| Aspect | Value |
|--------|-------|
| **Component** | `PlayerDetailDrawer.tsx` |
| **Purpose** | Quick-view player stats, links to full profile |
| **Dependencies** | Metric Matrix card, TIBER score card |

### 3.8 PlayerPage (Full Profile)

| Aspect | Value |
|--------|-------|
| **Route** | `/player/:playerId` |
| **Component** | `PlayerPage.tsx` |
| **Sections** | Profile header, Metric Matrix, TIBER Score, Research Hub (similar players, tier neighbors), Ownership badge |
| **Dependencies** | All player data endpoints, week system, identity resolution |

---

## 4. Known Drift Risks + Guardrails

### 4.1 Percent Scaling

**Risk:** `snap_share_pct` and similar fields may be stored as decimals (0-1) instead of percentages (0-100).

**Guardrail:** `ensurePercentScale(value)` utility function
- Converts values ≤ 1 to percent scale (* 100)
- Applied in Metric Matrix vector computation

**Check:** Sample `player_usage` rows; flag if many values are ≤ 1.0.

### 4.2 NULL Handling

**Risk:** Missing data coerced to 0 distorts averages and rankings.

**Guardrails:**
- Never `COALESCE(value, 0)` for analytical fields
- Use `COUNT(field)` not `COUNT(*)` for coverage stats
- Frontend shows "No data" rather than "0%" for nulls

### 4.3 Vector Cache Invalidation

**Risk:** `metric_matrix_player_vectors` becomes stale after new week ingestion.

**Guardrails:**
- `computed_at` timestamp on each vector row
- Cache invalidation on weekly data refresh
- Audit check: flag if >20% of vectors older than 7 days

### 4.4 Identity Coverage (Split Checks)

Identity coverage is now measured by **two separate checks**:

#### 4.4.1 Roster Bridge Coverage (PRIMARY)

**What it measures:** Of all Sleeper player IDs on synced league rosters, how many resolve to a `canonical_id` via `player_identity_map.sleeper_id`.

**Why it matters:** This is what ownership + player UX **directly depends on**. If a rostered player can't be resolved, ownership detection fails for that player.

**Thresholds:**
- ≥85%: healthy
- 70-84%: warning  
- <70%: critical (blocks ownership accuracy)

**Response includes:** `mapped`, `total`, `coveragePct`, `unmappedSample` (up to 10 unresolved Sleeper IDs)

#### 4.4.2 Global Sleeper ID Population (SECONDARY)

**What it measures:** Of all active players in `player_identity_map`, how many have a non-null `sleeper_id`.

**Why it matters:** This is an **enrichment quality metric**, not a correctness dependency. Many active NFL players (practice squad, deep reserves) never appear on Sleeper, so low global coverage is expected.

**Thresholds:**
- ≥70%: healthy
- 40-69%: warning
- <40%: info (non-blocking)

**Key difference:** This check **cannot** trigger `critical` status. It uses `info` for low values instead, preventing false alarms about the overall system health.

**Guardrails:** 
- `/api/system/feature-audit` returns both checks with structured details
- Admin UI shows both in System Integrity card

### 4.5 Week Data Gaps

**Risk:** Frontend requests week that has no data yet.

**Guardrail:** `availableWeeks` endpoint informs dropdown which weeks have data; marks others as disabled.

---

## 5. Quick Reference: Smoke Test Player

For integration testing, use **Ja'Marr Chase**:

| ID Type | Value |
|---------|-------|
| `canonical_id` | `jamarr-chase` |
| `gsis_id` | `00-0036900` |
| Position | WR |

Test URLs:
```
/player/jamarr-chase
/api/player-identity/player/jamarr-chase
/api/metric-matrix/player-vector?playerId=jamarr-chase&season=2024&week=1
/api/league/ownership?playerId=jamarr-chase
```

---

## 6. File Index

| File | Purpose |
|------|---------|
| `server/routes/metricMatrixRoutes.ts` | Metric Matrix API routes |
| `server/modules/metricMatrix/playerVectorService.ts` | Vector computation |
| `server/modules/metricMatrix/similarPlayersService.ts` | Similar players logic |
| `server/modules/metricMatrix/tiersNeighborsService.ts` | Tier neighbors logic |
| `server/services/ownership/ownershipService.ts` | League ownership v1 |
| `client/src/pages/PlayerPage.tsx` | Full player profile page |
| `client/src/components/PlayerDetailDrawer.tsx` | Quick-view drawer |
| `client/src/components/metricMatrix/MetricMatrixCard.tsx` | Metric display card |
| `client/src/components/tiber/TiberScoreCard.tsx` | TIBER score display |
| `shared/schema.ts` | Database table definitions |
