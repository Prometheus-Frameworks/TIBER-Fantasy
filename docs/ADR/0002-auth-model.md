# ADR 0002 — API Key Authentication + Rate Limiting

Date: 2026-02-25  
Status: Accepted

## Context
TIBER currently exposes endpoints without auth. Moving to an API platform requires:
- basic access control
- protection against abuse
- per-consumer observability (usage + health)

## Decision
1) All `/api/v1/*` endpoints require an API key.  
2) Clients supply the key via header: `x-tiber-key`.  
3) Raw keys are never stored. Only `key_hash` is stored.  
4) Keys support tiering: `internal | trusted | public`.  
5) Requests are rate-limited per key.  
6) Requests are logged per key for observability.

## Consequences
- Positive: Turns private tool into platform safely.
- Positive: Enables invite-only rollout first, then public keys later without re-architecture.
- Positive: Enables basic analytics and abuse detection.
- Negative: Slight friction for developers (must include header).
- Negative: Requires operational care (key creation + revocation flows).

## Implementation Notes
- MVP rate limiting may be in-memory (single instance) but must be replaced by Redis for multi-instance scaling.
- Standard auth failures return structured error codes:
  - AUTH_MISSING_KEY, AUTH_INVALID_KEY, AUTH_REVOKED_KEY
- Standard 429 error code:
  - RATE_LIMIT_EXCEEDED
