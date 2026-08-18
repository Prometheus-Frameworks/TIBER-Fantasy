# `contextEntityModel` — context-bound entity model persistence (Fantasy #332)

Durable, operator-local context about a canonical TIBER entity: what an
operator said mattered about it, in which workspace, and what has been observed
since. Built so that a session with no conversational memory can retrieve it and
explain it accurately.

## Layering

Three layers, kept separate on purpose. MCP is the outermost one and the least
important: delete it and everything below still works.

| File | Layer | Depends on |
|---|---|---|
| `domain.ts` | Domain object, digests, invariants | nothing but `zod` and the #327 id pattern |
| `store.ts` | Persistence port | domain |
| `contextEntityModelService.ts` | Application operations | domain, store port, resolver |
| `entityResolver.ts` | Identity resolution | an injected `IdentityGateway` |
| `drizzleContextEntityModelStore.ts` | PostgreSQL adapter | drizzle, `@shared/schema` |
| `mcp/toolDefinitions.ts` | MCP tool contract (no SDK import) | service |
| `composition.ts` | Composition root — the only file that touches live infra | `infra/db`, `PlayerIdentityService` |

`server/mcp/contextEntityStdioServer.ts` is the transport entrypoint. It
contains no domain logic; it hands `CONTEXT_ENTITY_TOOLS` to the SDK's
`McpServer` and connects stdio.

Importing anything except `composition.ts` is free of infrastructure side
effects, which is why the tests run without a database.

## Operations

| Operation | Access | Notes |
|---|---|---|
| `resolveEntity(locator)` | read | Fails closed on ambiguity, absence, incompleteness, broken merges, and outages. |
| `getEntityModel({workspaceId, locator})` | read | Latest version plus the full observation lineage. |
| `saveEntityModel(input)` | write | Requires operator confirmation. Idempotent by content digest. |
| `appendEntityObservation(input)` | write | Never touches the model row. Not idempotent. |

Refusals are returned as typed results (`{status: 'refused', reason, detail}`),
not thrown — an ambiguous identity is an answer a human has to see, not an
exception to swallow.

## Invariants worth not breaking

1. **A name is never an identity.** Names locate a registry row; the canonical
   `tiber_player_id` that row returns is what gets stored. Name resolution
   requires an exact normalised match, above a confidence floor, with exactly
   one candidate — anything else is refused. The match then finishes through
   the merge-aware `getByTiberPlayerId` path, because the registry's name
   search does not filter merged rows and a merged loser keeps its minted id
   as a historical redirect; binding to that id would split the entity's
   history.
2. **Stored models are immutable.** There is no update or delete anywhere in
   the store port or its Postgres implementation. A changed interpretation is a
   new version row; new information is a new observation row. This is what makes
   the original creation state replayable.
3. **Timestamps are observed, never defaulted.** The service reads one injected
   clock per write and supplies every timestamp; the tables carry no
   `DEFAULT now()`. Caller-supplied creation times are not accepted at all, and
   a caller-supplied `observedAt` in the future is refused.
4. **The persistence contract stays provider-neutral.** No position, role,
   scoring format, league, or other football-use-case field belongs on the
   durable wrapper — those live inside the operator's own words or the agent's
   structured payload. A test asserts the exact field list.
5. **Outages are not empty results.** The store throws
   `ContextEntityStoreUnavailableError`, which surfaces as `store_unavailable`.
   A fresh session must never read a database problem as "the operator never
   saved anything".
6. **Writes are attributed and confirmed.** Workspace and operator are required
   on every write; persistence additionally requires an operator confirmation.
   Enforced in the service, so it holds for any transport. The whole provenance
   record is validated, not just the boolean — `confirmed: true` with an empty
   statement is not a confirmation, and checking only the flag would make the
   guarantee cosmetic.

## Storage

PostgreSQL, via `shared/schema.ts` (`context_entity_models`,
`context_entity_observations`) and migration
`migrations/0015_context_entity_models.sql`. Two new tables, no changes to any
existing table, no foreign keys into existing tables.

`subject_id` holds a canonical `tiber_player_id` but is deliberately not a
foreign key: identity is resolved at the application boundary through
`PlayerIdentityService`, which fails closed on states a database constraint
cannot express (ambiguity, outage, broken merge chain), and the registry's own
canonical column is nullable during backfill.

The migration is hand-authored rather than generated. This repo's drizzle
snapshot chain stops at `migrations/meta/0003_snapshot.json` while the live
schema is roughly eleven migrations ahead, so `drizzle-kit generate` diffs
against 0003 and proposes re-creating unrelated tables behind interactive
create-or-rename prompts. Migrations 0004–0014 are hand-authored for the same
reason. Repairing that chain is a real piece of work, and a much larger one
than this pilot.

`__tests__/inMemoryContextEntityModelStore.ts` is a **test fixture**, not an
alternative persistence authority — it lives under `__tests__/` so nothing in
the production graph can reach it, and it reproduces the same unique
constraints Postgres enforces.

## Known limits

- `sequence` on observations is assigned from the current lineage length rather
  than atomically in the database. Safe for the single-operator pilot; two
  genuinely concurrent appends collide on the unique index and the loser fails
  loudly rather than sharing a position.
- There is no workspace registry and no authorisation. `workspaceId` is an
  operator-supplied label that scopes storage, not an authenticated tenant. See
  `docs/mcp/context-bound-entity-model-v0.md` for what that defers and why.
- `drizzleContextEntityModelStore.ts` has no unit tests; it is covered by the
  end-to-end trace (`scripts/contextEntityGoldenTrace.mjs`) against a real
  PostgreSQL instance, because a mocked drizzle chain would prove the mock
  rather than the SQL.
