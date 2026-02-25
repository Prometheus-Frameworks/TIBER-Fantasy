# Codex Task — Milestone 1: API Platform MVP

**Assigned to:** Codex  
**Date:** 2026-02-25  
**Reads first:** `docs/ARCHITECTURE_BLUEPRINT.md`, `docs/ADR/0001-api-versioning.md`, `docs/ADR/0002-auth-model.md`, `docs/ADR/0003-precompute-policy.md`

---

## Objective

Stand up the foundational API platform layer that turns TIBER's existing endpoints into a proper, auth-gated, versioned platform. This is **infrastructure only** — do not change scoring logic, database ETL, or frontend code.

---

## What to Build

### 1. Database Schema — `api_keys` and `api_request_log`

Add two new tables to `shared/schema.ts`:

**`api_keys`**
```typescript
id: uuid, primaryKey, default gen_random_uuid()
key_hash: text, notNull, unique        // SHA-256 of raw key — never store raw
owner_label: text, notNull             // human-readable label e.g. "BossManJ"
tier: text, notNull, default "internal" // "internal" | "trusted" | "public"
rate_limit_rpm: integer, notNull, default 60
created_at: timestamptz, notNull, default now()
revoked_at: timestamptz, nullable
last_used_at: timestamptz, nullable
```

**`api_request_log`**
```typescript
id: uuid, primaryKey, default gen_random_uuid()
api_key_id: uuid, notNull              // FK → api_keys.id
method: text, notNull
route: text, notNull
status: integer, notNull
duration_ms: integer, notNull
request_id: text, notNull
created_at: timestamptz, notNull, default now()
```

After adding to schema, run: `npm run db:push`

---

### 2. Error Codes — `server/api/v1/errors/codes.ts`

Create this file with the standard error code set:

```typescript
export const ErrorCodes = {
  AUTH_MISSING_KEY: "AUTH_MISSING_KEY",
  AUTH_INVALID_KEY: "AUTH_INVALID_KEY",
  AUTH_REVOKED_KEY: "AUTH_REVOKED_KEY",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  UPSTREAM_TIMEOUT: "UPSTREAM_TIMEOUT",
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
```

---

### 3. Middleware — `server/api/v1/middleware/`

Create four middleware files:

#### `requestId.ts`
- Generate a UUID `request_id` for every request
- Attach to `req.requestId`
- Set response header `x-request-id`

#### `errorFormat.ts`
- Express error handler (4-argument signature)
- All errors return this exact shape:
```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  },
  "meta": {
    "version": "v1",
    "request_id": "...",
    "generated_at": "2026-02-25T00:00:00.000Z"
  }
}
```

#### `auth.ts`
- Read `x-tiber-key` header
- If missing → 401 `AUTH_MISSING_KEY`
- Hash with SHA-256
- Lookup in `api_keys` where `key_hash = hash AND revoked_at IS NULL`
- If not found → 401 `AUTH_INVALID_KEY`
- If `revoked_at` is set → 403 `AUTH_REVOKED_KEY`
- If valid → attach `req.tiberAuth = { apiKeyId, tier, ownerLabel, rateLimitRpm }`
- Update `last_used_at` (fire and forget, don't await in hot path)

#### `rateLimit.ts`
- In-memory token bucket per `apiKeyId`
- Refill rate = `rateLimitRpm` tokens per 60 seconds
- Burst = same as `rateLimitRpm` (no burst bonus for MVP)
- On exceed → 429 with error code `RATE_LIMIT_EXCEEDED`
- Note in file comment: "MVP — replace with Redis before multi-instance deploy"

---

### 4. Request Logger — `server/api/v1/middleware/requestLogger.ts`

- After-response middleware (use `res.on('finish', ...)`)
- Write one row to `api_request_log` per request
- Capture: `api_key_id`, `method`, `route` (use `req.route?.path`), `status`, `duration_ms`, `request_id`
- Fire-and-forget (do not block response)

---

### 5. Standard Response Helper — `server/api/v1/contracts/response.ts`

```typescript
export function v1Success(data: unknown, requestId: string) {
  return {
    data,
    meta: {
      version: "v1",
      request_id: requestId,
      generated_at: new Date().toISOString(),
    },
  };
}

export function v1Error(code: ErrorCode, message: string, requestId: string, details?: unknown) {
  return {
    error: { code, message, ...(details ? { details } : {}) },
    meta: {
      version: "v1",
      request_id: requestId,
      generated_at: new Date().toISOString(),
    },
  };
}
```

---

### 6. V1 Routes — `server/api/v1/routes.ts`

Wire all middleware and mount the first four v1 endpoints by **proxying to the existing domain services** (do not rewrite scoring logic):

```
GET  /api/v1/forge/player/:playerId   → calls existing FORGE engine logic
POST /api/v1/forge/batch              → calls existing FORGE batch logic
GET  /api/v1/fire/player/:playerId    → calls existing FIRE logic
GET  /api/v1/catalyst/player/:playerId → calls existing CATALYST logic
```

Each endpoint:
1. Calls existing service/function
2. Wraps result in `v1Success(data, req.requestId)`
3. On error, calls next(err) → caught by `errorFormat.ts`

Middleware order on the v1 router:
1. `requestId`
2. `auth`
3. `rateLimit`
4. route handlers
5. `requestLogger` (post-response)
6. `errorFormat` (error handler)

---

### 7. Mount V1 Router in `server/index.ts`

Add one line to mount the v1 router **before** the existing route mounts:

```typescript
import v1Router from "./api/v1/routes";
app.use("/api/v1", v1Router);
```

Existing routes stay untouched. The web app keeps working exactly as before.

---

### 8. Admin Key Generation Script — `scripts/generate-api-key.ts`

A one-time script (not an API endpoint) to create the first internal key:

```
npx tsx scripts/generate-api-key.ts --label "BossManJ" --tier internal
```

Output:
```
Generated API key for BossManJ (internal)
Key: tiber_sk_xxxxxxxxxxxxxxxxxxxxxxxx
Key hash stored in database. This is the only time the raw key is shown.
```

Logic:
- Generate 32 random bytes → hex string → prefix with `tiber_sk_`
- SHA-256 hash it
- Insert into `api_keys`
- Print raw key to stdout once, never again

---

## Acceptance Criteria

- [ ] `npm run db:push` runs without error (two new tables exist)
- [ ] `npx tsx scripts/generate-api-key.ts --label "BossManJ" --tier internal` prints a key
- [ ] `GET /api/v1/forge/player/:id` with valid key → 200 with `data` + `meta` envelope
- [ ] `GET /api/v1/forge/player/:id` with no key → 401 `AUTH_MISSING_KEY`
- [ ] `GET /api/v1/forge/player/:id` with invalid key → 401 `AUTH_INVALID_KEY`
- [ ] After 60 requests in under a minute → 429 `RATE_LIMIT_EXCEEDED`
- [ ] `api_request_log` has rows after requests are made
- [ ] Existing routes (`/api/forge/*`, `/api/fire/*`, etc.) still work unchanged
- [ ] `npm run test` still passes (no regressions)

---

## Do NOT

- Change any scoring engine logic (FORGE, FIRE, CATALYST)
- Modify existing routes outside `server/api/v1/`
- Change the frontend
- Add Redis (that's Milestone 2)
- Add daily rollup tables (nice-to-have, not required for M1)
- Run `npm run db:push --force` unless `npm run db:push` fails with a data-loss warning

---

## Files to Create

```
server/api/v1/
  routes.ts
  errors/codes.ts
  middleware/
    requestId.ts
    auth.ts
    rateLimit.ts
    errorFormat.ts
    requestLogger.ts
  contracts/
    response.ts

scripts/
  generate-api-key.ts
```

Files to modify:
- `shared/schema.ts` — add two tables
- `server/index.ts` — mount v1 router
