# CODEX TASK — [Feature Name] ([Phase/Scope])

## Goal
[One paragraph describing what this task delivers. Be specific about the end state.]

## Non-goals (important)
- Do NOT [scope boundary 1]
- Do NOT [scope boundary 2]
- Do NOT write raw SQL migration files. Schema changes go through Drizzle ORM only.
- Do NOT break existing [related systems].

## Read first
- `ARCHITECTURE.md` (for project-wide orientation)
- `[relevant MODULE.md]`
- [Any other relevant docs]

## Current state
- [What exists today that this task builds on]
- [Key files the agent will touch]
- [Schema tables involved]

## Deliverables

### D1 — [First deliverable name]
[Numbered steps with specific file paths, function signatures, and expected behavior]

### D2 — [Second deliverable name]
[...]

### D3 — API route (if applicable)
[Endpoint definition with method, path, query params, response shape]

### D4 — Tests / sanity checks
[Specific verification steps with concrete expected outcomes]

## Output shape (if applicable)
```json
{
  "example": "response"
}
```

## Implementation guidance
- [Project-specific conventions to follow]
- Schema changes: Add to `shared/schema.ts`, run `npm run db:push`. Use `--force` if data-loss warning.
- Routes: Create modular route file in `server/routes/`, mount in `server/routes.ts`.
- New modules: Create under `server/modules/[name]/` with a `MODULE.md`.
- Follow existing patterns — check neighboring files before writing new code.

## Done criteria
- [Specific, verifiable conditions that define "done"]
- [Include a spot-check query if DB changes are involved]
- [Include an API call that should return valid data]
- No existing functionality is broken.

---

## Template Notes

These notes explain why each section matters when writing task prompts for AI coding agents (Codex, etc.) working on the Tiber Fantasy codebase. Remove this section when using the template for an actual task.

### Why non-goals matter
Non-goals prevent scope creep. Without explicit boundaries, agents will over-engineer or refactor adjacent systems. Always include "Do NOT write raw SQL migration files" since Tiber uses Drizzle push-based migrations exclusively. List the specific related systems that must not be broken (e.g., "Do NOT break existing ingestion/backfill jobs").

### Why "Read first" pointers are critical
Agents start with zero context. Pointing them to `ARCHITECTURE.md` gives project-wide orientation (stack, directory map, conventions). Pointing them to the relevant `MODULE.md` files gives module-specific architecture, file indexes, data flows, and API inventories. Without these, agents will guess at patterns and likely diverge from established conventions.

### Why output shape examples help
A concrete JSON response example removes all ambiguity about what the API should return. It forces you to think through field names, nesting, types, and edge cases before the agent writes code. Agents produce much better results when they can pattern-match against a concrete example rather than interpret prose descriptions.

### Why done criteria need to be testable
Vague done criteria ("it should work") lead to incomplete implementations. Every done criterion should be verifiable with a specific action: a SQL query, an API call, a script execution. Include the exact query or curl command when possible. This lets both the agent and the reviewer confirm completion objectively.

### Tips for Tiber-specific tasks

- **Reference MODULE.md files**: For any module the agent will interact with, point them to its `MODULE.md`. The module index is in `ARCHITECTURE.md` § 3. If the module doesn't have a MODULE.md yet, note that and ask the agent to create one as part of the deliverables.

- **Specify ID formats**: Tiber uses multiple player ID formats. Always specify which one the agent should use:
  - GSIS ID: `00-XXXXXXX` (used in `bronze_nflfastr_plays`, nflfastR data)
  - Canonical ID: internal Tiber identifier (used in `player_identity_map`)
  - Sleeper ID: numeric string (used in Sleeper platform sync)
  - When crossing ID boundaries, explicitly state which table/service to use for resolution (e.g., "Cross-reference with `player_identity_map` to resolve display name and position").

- **Call out data labeling discipline**: Tiber is strict about not overstating data provenance. If the data source doesn't provide true snap counts, do not let the agent label anything as "snaps" or "snap share." Use precise terms like "usage plays" or "plays" and require the agent to include notes/disclaimers in the output. This matters for user trust and for downstream consumers (FORGE, Tiber Voice) that may surface these labels to end users.

- **Schema conventions**: All Drizzle models live in `shared/schema.ts`. Use `createInsertSchema` from `drizzle-zod` for validation. Export both insert type (`z.infer<typeof insertSchema>`) and select type (`typeof table.$inferSelect`). Array columns use `.array()` as a method, not a wrapper.

- **Route conventions**: Prefer modular route files in `server/routes/` mounted in `server/routes.ts` over adding to the monolith. The monolith (`server/routes.ts`) is 10,644 lines — search it before adding endpoints to avoid duplication.

- **Module conventions**: New feature modules go under `server/modules/[name]/` with a `MODULE.md` manifest. Follow the structure in `server/modules/forge/MODULE.md` for format guidance (Overview, Architecture, File Index, Data Flow, API Endpoints, Database Tables, Cross-Module Dependencies, Common Tasks).
