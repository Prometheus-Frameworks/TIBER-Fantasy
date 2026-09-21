# Team MCP stdio checkpoint — #383

Status: local transport implemented; live source access disabled. This follows the [contract checkpoint](team-contracts-checkpoint-2026-09-21.md). Joe authorized the stdio entry step after accepting the contract work. No hosted endpoint, private studies or fantasy actions are exposed.

## Run

From the repository root, after installing the existing locked dependencies:

```sh
node --import tsx server/mcp/teamStdioServer.ts
```

The process speaks MCP on stdin/stdout; it is not an interactive terminal prompt. Configure a compatible local MCP host with that command, the repository root as its working directory, and no provider or database credentials. Host-specific UI configuration and acceptance remain pending. No package script or dependency upgrade was required.

The entry exposes exactly:

- `tiber_team_describe_capabilities`
- `tiber_team_get_roster_context`
- `tiber_team_get_player_evidence`

Capabilities report `source_mode: disabled`. Valid source reads return a sanitized `source_unavailable` refusal. There is no environment toggle, fixture fallback or live-reader binding. This executable proves connectivity, not useful live football coverage.

## Implementation

`buildTeamMcpServer(deps)` registers one shared set of tool definitions with the installed MCP SDK. It passes each complete strict Zod object, not `.shape`, so unknown properties cannot be stripped before the handler validates them. Schema-invalid protocol calls receive SDK validation errors; domain-invalid requests and source failures retain the bounded contract result. SDK validation errors are not claimed to have the versioned domain envelope.

`startTeamStdio(deps)` installs the existing stdout protection before connecting stdio. Console log/info/debug output goes to stderr; the SDK owns stdout. Importing the module does not patch console, connect transport or open sockets. The executable guard loads only the pure roster parser from the Team service, supplying unavailable readers. Unexpected startup failure emits a fixed diagnostic without exception details.

Dependency metadata (`disabled`, `synthetic`, or unspecified injected readers) describes the composition; it never selects a reader or grants source rights. The contract stage now reports `read_only_tools` rather than the superseded `injected_contract_only` label.

## Validation

### Second P2 review repair (September 21, PR #406)

Starting head: `bc5552c66d9c5968c2e5d2d2d9b6ebac2c333157`. Re-review comments 4061823622 and 4061823626 identified constructor-spoofed custom prototypes and exponential shared-reference expansion before the size check.

The plain-container check now requires the native constructor's own `prototype` descriptor to point back to the exact inspected prototype. Borrowing `Object` or `Array` no longer admits a custom prototype. Proxies are rejected before reflection to prevent trap-based spoofing. Cross-realm ordinary containers and null-prototype objects remain supported; inherited accessors are not invoked.

Snapshot traversal reserves the fixed success envelope and charges UTF-8 JSON bytes for every expanded occurrence, key, separator and delimiter before copying. Oversized output returns `response_too_large` during traversal; malformed data remains `internal_error`. Arrays append validated values without unchecked preallocation. The final byte guard remains as defense in depth. This bounds encoder expansion, not memory already consumed by an injected reader or its input object.

Both regressions were reproduced before repair: the spoof returned `ok`, and a depth-100 DAG exhausted a dedicated test child's 128 MiB heap. The regression test now exercises object and array DAGs under that heap cap and a 10-second process deadline, expects `response_too_large`, then verifies a normal result still succeeds. This is a regression deadline, not a production latency guarantee.

Validation: **55 Jest contract tests and six Node/tsx tests pass**, including exact byte-cap and one-byte-over cases with multibyte characters, escaped keys/values and a lone surrogate. The targeted strict TypeScript command below passes with `server/mcp/__tests__/teamIsolationGuards.ts` included; `git diff --check` passes. Dependencies and source-disabled executable bindings are unchanged. Independent review of the new published head remains pending; no finding is self-resolved and no merge, source activation or deployment is authorized.

### P2 review repair (September 21, PR #406)

The initial review at `d4e58986ee2613525c9dfd8bac927626a3abb58e` found two gaps. Results now recursively snapshot plain JSON data before encoding, rejecting non-finite numbers, negative zero, nested undefined, sparse/extended arrays, cycles, symbols, accessors, hidden properties and non-plain objects rather than silently coercing them. Genuine null, omitted keys and repeated non-cyclic references retain their meaning. Serialization hooks are not invoked; nesting beyond 100 levels fails closed. Cross-realm plain objects/arrays (including structuredClone output) are supported.

The synthetic child now installs guards before dynamically importing the tested graph. The actual executable test preloads the same guards before its entry module, covering the dynamic parser/service import inside main as well. Guards terminate the test child on attempted fetch, HTTP requests, socket connections or listeners, even if application code would catch an exception. A negative-control test verifies import-time fetch, HTTPS request and listener attempts are caught. These are test-only controls, not a production network sandbox.

Repair validation: 47 contract tests and five protocol tests pass, plus targeted strict TypeScript checking (include `server/mcp/__tests__/teamIsolationGuards.ts` in the command below). The original counts below describe the pre-review checkpoint. The first repair run caught a cross-realm prototype compatibility issue in synthetic cloned inputs; the final rerun includes that correction. No source activation or deployment.

All 33 isolated contract tests and four protocol tests pass. The latter cover SDK initialize/discovery, strict unknown-key rejection on all tools, duplicate IDs, invalid locators, concurrency refusal, provenance and unavailable states, the actual source-disabled executable, cold-import isolation, and a synthetic roster → two-player evidence exchange over child-process stdio. The synthetic child blocks fetch, HTTP requests, socket connections and listeners; its console diagnostic is verified on stderr with no client protocol errors.

```sh
npm test -- --runTestsByPath server/modules/draftReview/__tests__/teamToolDefinitions.test.ts --coverage=false
node --import tsx --test server/mcp/__tests__/teamStdio.protocol.ts
```

The `.protocol.ts` suite deliberately runs through Node's test runner and tsx to exercise native ESM, `import.meta` entry guards and real child-process transport. It is not included in the default Jest pattern; run both commands for this slice.

Targeted strict typecheck also passes:

```sh
./node_modules/.bin/tsc --noEmit --strict --skipLibCheck --esModuleInterop --moduleResolution bundler --module esnext --target es2022 --types node,jest server/mcp/teamStdioServer.ts server/mcp/__tests__/teamStdio.protocol.ts server/mcp/__tests__/teamStdioSyntheticFixture.ts server/modules/draftReview/__tests__/teamToolDefinitions.test.ts
```

These tests establish SDK-client transport compatibility. They do not establish acceptance in a named desktop/mobile host, live provider rights, real roster coverage or a hosted connection. No production build or repository-wide typecheck claim is made.

## Resume

Review this bounded transport diff, then resolve the existing source-use check before binding production readers or running live acceptance. Preserve the current artifact admission checks, source clocks and missing-data semantics. Record a real supported-client trace only after those prerequisites are satisfied. Fable routing, publication, merge and deployment have not occurred in this step.
