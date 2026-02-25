# ADR 0001 — API Versioning Strategy

Date: 2026-02-25  
Status: Accepted

## Context
TIBER is shifting to an API platform consumed by agents and third-party clients. Existing endpoints were built primarily for the first-party web app and may change as the system evolves. External consumers require stability.

## Decision
1) All public endpoints will exist under `/api/v1/*`.  
2) `/api/v1/*` response shapes are treated as contracts and cannot change in breaking ways.  
3) Breaking changes require a new version namespace (`/api/v2/*`).  
4) Non-public or experimental endpoints may exist under `/api/internal/*` and may change without notice.  
5) All v1 responses include:
- `meta.version = "v1"`
- `meta.request_id`
- `meta.generated_at`

## Consequences
- Positive: Stable foundation for agents/plugins; reduces downstream breakage and support burden.
- Positive: Allows internal refactors without fear, as long as contracts remain stable.
- Negative: Slight duplication when v2 is introduced; requires parallel maintenance during migration.
- Negative: Slower iteration on public endpoints due to contract discipline.

## Notes
A "contract change" includes:
- removing fields
- changing field types
- changing semantics of an existing field
- renaming fields
- changing tier labels, enums, or error codes in incompatible ways
