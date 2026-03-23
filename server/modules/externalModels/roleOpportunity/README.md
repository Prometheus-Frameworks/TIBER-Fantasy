# Role Opportunity external adapter

This adapter powers the read-only Role & Opportunity Lab in TIBER Data Lab.

## Inputs

Preferred upstream sources:
- TIBER-Data compatibility views / API endpoints surfaced through `ROLE_OPPORTUNITY_MODEL_BASE_URL` + `ROLE_OPPORTUNITY_MODEL_LAB_ENDPOINT_PATH`
- Stable exported JSON artifact at `ROLE_OPPORTUNITY_EXPORTS_PATH` (defaults to `./data/role-opportunity/role_opportunity_lab.json`)

## Contract

- Client: upstream API transport, timeout handling, artifact fallback, and explicit config/read errors
- Adapter: payload normalization/validation into stable TIBER-facing lab rows
- Service: stable `getRoleOpportunityLab()` and `getRoleOpportunityInsight()` interfaces
- Routes:
  - `GET /api/data-lab/role-opportunity[?season=<year>][&week=<week>]`
  - `GET /api/integrations/role-opportunity/:playerId?season=<year>&week=<week>`

## Product behavior

- Read only only; no writes, no recomputation, no local role scoring
- Surfaces role, deployment, and opportunity context complementary to WR Breakout Lab
- Explicit loading, malformed-payload, missing-data, and valid-empty states
- Frontend exposes client-side search, team/position filters, sortable metrics, and expandable detail sections for inspectability
