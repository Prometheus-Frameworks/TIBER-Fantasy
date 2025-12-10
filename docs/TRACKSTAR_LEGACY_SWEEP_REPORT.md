# TRACKSTAR Legacy Naming Sweep

## Renamed services, providers, and helpers
- `oasisEnvironmentService` → `teamEnvironmentService` (and class renamed) across rankings, compass, OVR, OLC adjusters, and forge context fetcher.
- `oasisSosService` → `contextSosService`, with defensive projection types renamed to environment terminology.
- `oasisContextualTeamMapping` → `teamContextMapping` (context tag field now `contextTags`).
- `oasis` matchup provider → `context` provider (`fetchEnvironmentMatchup`, environment types).
- `otcConsensusService`/`otcConsensusPlayerService` → `tiberConsensusService`/`tiberConsensusPlayerService`.

## Route updates
- Added brand-aligned `/api/environment/*` routes (environment, pace, teams, matchup, _index, _debug) plus `/api/pace` for pace-only access.
- Legacy `/api/oasis/*` routes remain as deprecated aliases forwarding to the new handlers (annotated with TRACKSTAR deprecation comments).
- Added an environment matchup stub to mirror prior neutral fallback behavior for provider calls.

## Notable decisions
- Kept output shapes/behavior intact while renaming identifiers; legacy routes preserved to avoid breaking clients.
- Retained historical references in documentation/attached assets but updated active code paths and imports to new naming.
