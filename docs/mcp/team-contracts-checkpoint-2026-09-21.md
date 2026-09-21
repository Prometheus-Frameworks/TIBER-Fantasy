# Team MCP contracts checkpoint — #383

## Scope and authority

Joe authorized the next coding step: tool contracts and isolated tests, before involving Fable. This local change implements that slice only, based on main `71ca2a09482ed29c3ae878a050fc6f030d1bbd6c`, branch `codex/383-team-mcp-contracts`.

## Implemented

- `createTeamToolDefinitions` returns exactly three read-only definitions: capabilities, public roster context and admitted player evidence.
- Strict Zod inputs; roster locator bounded to 256 characters before trimming; one–three distinct exact Sleeper player IDs, preserving the current public route's defense-ID syntax.
- Required injected parser/readers with type-only service references. No default production wiring or SDK dependency. The existing pure roster parser is used in tests, avoiding duplicate URL semantics.
- Versioned JSON text envelope, complete-result 1,100,000-byte UTF-8 cap, static sanitized errors, and a single active roster read per contract instance. A future server must create one shared instance.
- Nested source schemas, provenance, unknown clocks, unavailable fields and instruction-like display strings pass through without reinterpretation. Expected source unavailability is normal domain data.

The proposed three tools are not registered in a runnable server yet. Capability discovery accurately reports `injected_contract_only`; wiring a production composition later requires revisiting that stage/source disclosure. A successful envelope means retrieval completed, not that every evidence field is available.

## Validation

33 tests passed:

```sh
npm test -- --runTestsByPath server/modules/draftReview/__tests__/teamToolDefinitions.test.ts --coverage=false
```

The test suite replaces `fetch` with a rejecting spy and checks it was never invoked. It injects synthetic readers, tests actual pure URL parsing, preserves null/missing historical evidence, verifies concurrency recovery, exercises exact byte boundaries and rejects production service imports in the contract module. It does not invoke real artifact readers or establish artifact admission.

Targeted strict TypeScript check passed, including the new tests and their transitive source types:

```sh
./node_modules/.bin/tsc --noEmit --strict --skipLibCheck --esModuleInterop --moduleResolution bundler --module esnext --target es2022 --types node,jest server/modules/draftReview/mcp/teamToolDefinitions.ts server/modules/draftReview/mcp/teamToolResults.ts server/modules/draftReview/__tests__/teamToolDefinitions.test.ts
```

The initial test run exposed a Jest table-format error in the empty-ID case; converting array rows to named objects repaired it. The final full targeted rerun and typecheck passed. Dependencies were installed from the existing lockfile with lifecycle scripts disabled; package manifests and lockfile are unchanged. No repository-wide typecheck or build claim is made.

## Resume point

Next slice: an isolated stdio builder/entry point and protocol tests. Preserve strict object validation when registering with the installed SDK; passing only schema shapes must not silently strip unknown keys before handler validation. Add explicit unknown-key checks through the real protocol. Establish clean stdout, no DB/listener startup, and one shared contract instance per server.

Then wire existing source readers only under the appropriate source-use scope. Confirm one supported client and record a real trace before calling the connector usable. No live Sleeper call, historical artifact acquisition/admission, private-study access, SDK upgrade, package script, provider activation, Fable dispatch, PR, merge or deployment belongs to this checkpoint.

The proposal's `internal_error` is used for result-encoding failures; injected reader failures map to `source_unavailable`. Parser exceptions are generic `invalid_input` with no raw error leak. More detailed production error taxonomy can be reviewed in the wiring slice without exposing provider exception text.
