# Sleeper Sync API v1.0 - Final Documentation

## Overview
Complete Sleeper API integration system with modular architecture, comprehensive caching, and production-ready error handling. All endpoints follow a consistent contract with proper meta fields and graceful degradation.

## API Endpoints

### Health Check
**GET** `/api/sleeper/health`
- **Purpose**: Service availability and feature flag status
- **Responses**:
  - `200`: Service enabled and operational
  - `503`: Service disabled via `USE_SLEEPER_SYNC=false`

Both responses include full contract with `meta` field:
```json
{
  "ok": false,
  "code": "SERVICE_DISABLED", 
  "message": "Sleeper Sync is currently disabled",
  "details": "Set USE_SLEEPER_SYNC=true to enable",
  "meta": {
    "source": "sleeper",
    "generatedAt": "2025-01-19T01:30:45.123Z"
  }
}
```

### Players Cache
**GET** `/api/sleeper/players`
- **Purpose**: Comprehensive player database with intelligent caching
- **Cache Strategy**: In-memory with configurable TTL and stale-while-revalidate
- **Response**: `{ ok: true, data: { players: {...}, count: N, cached: boolean }, meta: {...} }`

### User Resolution  
**GET** `/api/sleeper/user/:username`
- **Purpose**: Convert username to user ID and profile data
- **Validation**: Username must be non-empty string
- **Errors**: `400` for invalid input, `404` for user not found

### User Leagues
**GET** `/api/sleeper/leagues/:userId?season=YYYY`
- **Purpose**: Fetch leagues for user in specific season
- **Season Validation**: Must be four-digit year, **2018 through next year** (dynamic). Invalid seasons return **422**.
- **Current Logic**: `season >= 2018 && season <= new Date().getFullYear() + 1`

### League Context
**GET** `/api/sleeper/league/:leagueId/context`
- **Purpose**: Complete league data including rosters, users, and settings
- **Response**: Comprehensive league object with all related data
- **Partial Success**: Returns `206` when some data unavailable:

```json
{
  "ok": false,
  "missing": ["players"],
  "meta": { "source": "sleeper", "generatedAt": "..." },
  "data": { ...available_context... }
}
```

### Cache Management
**POST** `/api/sleeper/clear-cache`
- **Purpose**: Force cache invalidation for testing/debugging
- **Method**: POST (not GET) to prevent accidental clearing
- **Body**: `{}` (empty JSON object)

## Error Response Contract

**All errors include `meta` field** for consistent monitoring and debugging:

```json
{
  "ok": false,
  "code": "ERR_CODE",
  "message": "Human-readable error description",
  "details": "Additional context or troubleshooting info",
  "meta": {
    "source": "sleeper",
    "generatedAt": "2025-01-19T01:30:45.123Z"
  }
}
```

**Common Error Codes:**
- `SERVICE_DISABLED`: Feature flag disabled
- `VALIDATION_ERROR`: Invalid input parameters
- `USER_NOT_FOUND`: Username doesn't exist
- `LEAGUE_NOT_FOUND`: League ID doesn't exist  
- `UPSTREAM_ERROR`: Sleeper API failure
- `CACHE_ERROR`: Internal caching issue

## Performance Targets

**Performance targets** (upstream latency may vary):
- **Cold Cache**: 2-3 seconds (initial player fetch)
- **Warm Cache**: 50-200ms (cached responses)
- **League Context**: 0.5-1.0 seconds (multiple API calls)

## Caching Architecture

### Cache Metadata Access
Use `getPlayersCacheMeta()` for accessing cache statistics:

```typescript
const cacheStats = sleeperSyncService.getPlayersCacheMeta();
// Returns: { hits, misses, size, lastUpdate, staleDuration }
```

Note: `getCacheMetadata()` exists as a temporary compatibility alias but `getPlayersCacheMeta()` is preferred.

### Cache Behavior
- **Intelligent TTL**: Longer cache during season, shorter in offseason
- **Stale-While-Revalidate**: Serves stale data while refreshing in background
- **Memory Management**: Automatic cleanup of expired entries
- **Monitoring**: Comprehensive metrics via cache metadata

## Feature Flag Integration

### Environment Variable
```bash
USE_SLEEPER_SYNC=true   # Enable service
USE_SLEEPER_SYNC=false  # Disable service (503 responses)
```

### Graceful Degradation
When disabled, all endpoints return `503` with proper error contract including `meta` field. No exceptions or malformed responses.

## Testing

### Hardened Test Suite
Use the comprehensive test script: `./scripts/test-sleeper-sync.sh`

Features:
- **Dynamic season validation**: Tests current year logic, not hardcoded values
- **HTTP method support**: Proper GET/POST testing with JSON payloads
- **Timeout protection**: 4s connection, 10s max to prevent CI hangs
- **Contract validation**: Verifies `meta` fields and response structure
- **Feature flag awareness**: Accepts 200/503 based on `USE_SLEEPER_SYNC`
- **Graceful fallbacks**: Works with/without `jq` installed

```bash
# Basic usage
./scripts/test-sleeper-sync.sh

# Custom parameters
./scripts/test-sleeper-sync.sh "https://api.example.com" "username" "user123" "league456"
```

## Modular Architecture

### Service Extraction
- **Location**: `server/sleeperRoutes.ts`
- **Integration**: Pluggable via `server/routes.ts`
- **Logging**: Structured JSON logging with source attribution
- **Monitoring**: Built-in health checks and performance metrics

### TypeScript Compliance
- Full TypeScript interfaces for all data structures
- Proper error typing with discriminated unions  
- Generic response wrappers with type safety
- Contract enforcement at compile time

## What Changed vs. Initial Handoff

This final documentation corrects several discrepancies between the initial handoff summary and the actual hardened implementation:

**Season Validation**: Updated from hardcoded "2020-2030" to dynamic "2018 through next year" calculation that matches the actual validation logic. **Error Responses**: Clarified that ALL errors include the `meta` field for consistent monitoring, not just success responses. **Cache Function**: Documented `getPlayersCacheMeta()` as the preferred method with `getCacheMetadata()` noted only as a compatibility alias. **Performance**: Reframed response times as "targets" rather than guarantees since upstream Sleeper API latency varies. **Health Endpoint**: Documented 503 behavior when feature flag is disabled, including full error contract compliance. **Test Script**: Referenced the hardened test suite with dynamic season logic and proper timeout handling.

These corrections ensure the documentation accurately reflects the production-ready implementation and prevents confusion during QA testing and future maintenance.

---

**Status**: Production-ready with comprehensive error handling and monitoring  
**Integration**: Fully modular and feature-flag controlled  
**Testing**: Complete test coverage with hardened validation script