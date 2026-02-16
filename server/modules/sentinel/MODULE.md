# Quality Sentinel Module

## Purpose
Quality Sentinel is a lightweight backend validation layer that checks module outputs before they are returned to API clients. It detects obvious data quality issues early and creates an auditable event stream for operational follow-up.

## Architecture
- **Rule engine (sync):** `evaluate(module, data)` executes module-specific checks in-process with no I/O.
- **Event persistence (async):** failed checks are written to `sentinel_events` via `recordEvents()` using fire-and-forget calls.
- **Admin API:** `/api/sentinel/*` endpoints expose grouped issues, raw events, health summaries, and mute controls.

## Rule DSL
Rules are defined in `sentinelRules.ts` as `SentinelRule` objects:
- `id`: stable machine key (`forge.alpha_bounds`)
- `module`: owning module (`forge`, `personnel`, etc.)
- `severity`: `info | warn | block`
- `check(data)`: pure function returning pass/fail + confidence + message + optional details

To add a rule:
1. Add a new `SentinelRule` in `sentinelRules.ts`.
2. Ensure `details` include a stable entity key (`playerId`, `position`, etc.) for fingerprinting.
3. Integrate `evaluate()` in the target route if not already present.

## Performance Budget
- `evaluate()` is synchronous and designed for inline use.
- Target budget: **<5ms per call** for standard payload sizes.
- No DB/network calls are allowed inside rule checks.

## Integration Pattern
Use Sentinel after module computation and before `res.json`:
1. `const report = evaluate('<module>', data)`
2. `recordEvents(report.events)` without awaiting
3. Include `_sentinel` metadata in response payload

## Event Lifecycle
1. **Event:** failed rule evaluation persisted in `sentinel_events`.
2. **Fingerprint grouping:** issues are grouped by fingerprint (`ruleId + module + key`).
3. **Issue state:**
   - `open`: seen in last 24 hours
   - `resolved`: no events in >24 hours
   - `muted`: fingerprint exists in `sentinel_mutes`
4. **Mute flow:** `POST /api/sentinel/mute/:fingerprint` stores mute metadata and suppresses muted issues from default `/issues` view.
