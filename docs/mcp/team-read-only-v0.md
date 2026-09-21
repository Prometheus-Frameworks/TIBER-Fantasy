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
