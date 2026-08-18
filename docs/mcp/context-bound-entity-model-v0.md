# Context-bound entity models over MCP — v0 operator note

**Status:** operator-local pilot (Fantasy #332). Not a platform, not a product
surface, not multi-user. Read this before connecting a client.

## What this is, in plain language

You tell an agent why a player matters to you — the actual reasoning, in your
own words. Today that reasoning lives in a conversation and dies with it. This
pilot gives it somewhere durable to live: the agent resolves who you mean to a
canonical TIBER identity, and stores your context against that identity, inside
a workspace you name. A completely different session, days later, with no
memory of the first conversation, can ask TIBER what you said and get it back.

That is the whole scope. It does not decide anything, rank anything, start or
sit anyone, or take any action in a league.

## Who is who

MCP has three roles, and it is worth being precise about which is which,
because the security story follows from it.

| Role | In this pilot |
|---|---|
| **Host** | Claude Code — the application you are actually talking to. |
| **Client** | The MCP client inside Claude Code. One client per server. |
| **Server** | `server/mcp/contextEntityStdioServer.ts`, a Node process that Claude Code launches on your machine. |

The server is not a service you connect *to*. It is a child process the host
starts, talks to over its stdin/stdout, and shuts down when you are done. It
listens on no port. Nothing outside your machine can reach it.

## Tool discovery

When the client connects, it asks the server what it can do, and the server
answers with these four tools and their input schemas. There is no registry and
nothing to configure per tool — connecting is discovering.

| Tool | Access | What it does |
|---|---|---|
| `tiber_resolve_entity` | **read** | Resolves a name or canonical id to the opaque canonical TIBER entity identity. |
| `tiber_get_entity_model` | **read** | Returns the context you saved for one entity in one workspace, plus its observation lineage. |
| `tiber_save_entity_model` | **write** | Persists an operator-confirmed interpretation. |
| `tiber_append_entity_observation` | **write** | Adds one observation to an entity's append-only lineage. |

Each tool is annotated with its read/write nature (`readOnlyHint`), so a host
that distinguishes them in its UI gets the right answer.

## Reads vs writes

**Reads** answer questions. They never change stored state, and they refuse
rather than guess: an ambiguous name, a missing registry row, a broken identity
merge chain, or a database outage all come back as an explicit refusal with a
reason. A read never reports "nothing saved" when the truth is "could not
check".

**Writes** are bounded and attributed:

- every write names the `workspaceId` it belongs to and the `operatorId`
  responsible for it — there is no ambient operator;
- persistence additionally requires a confirmation, and TIBER asks *you* for it
  rather than taking an agent's word (see below);
- saving is idempotent by content. Re-saving the same interpretation resolves
  to the model already stored instead of creating a second version. A genuinely
  changed interpretation becomes a new version, and the earlier one is left
  exactly as written;
- appending never modifies a stored model. Observations are separate rows;
- nothing writes to shared, promoted, or published state. Models are marked
  `operator_local` / `operator_private` in the database itself.

**The tools being available is not authority to write.** An agent that can see
`tiber_save_entity_model` still has to have your confirmation to use it.

### How confirmation actually works

This is worth being precise about, because it is easy to build a version that
only looks like protection.

If the server simply accepted a field saying "the operator confirmed", the
agent making the request would also be the witness to its own approval — the
gate would check the agent's own claim. So the server does not do that.

When your client supports MCP **elicitation**, TIBER asks the client to put the
question to you directly: it shows what it wants to save, and your answer comes
back from the client. The agent is not on that path and cannot produce the
answer by asserting it. If you decline, the write is refused — an agent's
attestation cannot override you.

When your client does **not** support elicitation, there is no channel to you,
and TIBER falls back to the agent's attestation. It then records the
confirmation as `agent_attested`, and says so everywhere it is shown:

```
Confirmation: agent-attested — TIBER could not ask the operator directly
and has not verified a human approval.
```

That is the honest reading: a claim on the record, not an enforced
authorisation. Every stored confirmation carries which of the two it was, so a
later reader can tell how much weight it deserves.

One limit worth stating: on local stdio the client is your own process, so this
boundary constrains the *agent*, not a hostile client. A client that lied about
supporting elicitation could take the attested path. Closing that would require
authenticating the client itself, which is part of the deferred remote/multi-user
work below.

One consequence worth stating plainly: confirming an interpretation authorises
*storing* it. It is not a request to print the model into the chat. Save
returns a one-line human completion ("Saved Jaylen Warren to H4MMER."), and
retrieval returns readable prose rather than a serialised object — the raw
payload comes back only if a caller explicitly asks for it.

## Connecting from Claude Code

The server needs `DATABASE_URL` for the TIBER-Fantasy application database —
the same one the rest of the repo uses. It reads canonical identity from that
database and writes the two pilot tables there.

Add the server to Claude Code from the repository root:

```bash
claude mcp add tiber-context-entity \
  --env DATABASE_URL="$DATABASE_URL" \
  -- npx tsx server/mcp/contextEntityStdioServer.ts
```

Or equivalently, in `.mcp.json` / your MCP client config:

```json
{
  "mcpServers": {
    "tiber-context-entity": {
      "command": "npx",
      "args": ["tsx", "server/mcp/contextEntityStdioServer.ts"],
      "env": { "DATABASE_URL": "postgresql://..." }
    }
  }
}
```

`npm run mcp:context-entity` starts the same server directly, which is useful
for checking it boots before wiring a client to it.

Two notes:

- run it with the working directory set to the repository root — the command
  path is relative to it;
- **never commit a real `DATABASE_URL`.** Per `SECURITY_POLICY.md`, connection
  strings do not belong in the repo, in chat, or in handoff files. Point the
  config at an environment variable you already have set.

### Checking the connection

`scripts/contextEntityGoldenTrace.mjs` drives the whole lifecycle against the
real server with the official MCP client — two sessions in two separate
processes, so anything that survives between them survived in the database:

```bash
DATABASE_URL=postgresql://... node scripts/contextEntityGoldenTrace.mjs \
  --workspace H4MMER --operator "operator:you" --name "Jaylen Warren"
```

The named player must already exist in the identity registry with a minted
canonical `tiber_player_id`. The script never creates identity, and it writes
only the one model and one observation it exists to demonstrate.

The script's client declares elicitation and answers the confirmation prompt
automatically, standing in for you — including a third session where it
declines, to show the write being refused despite the agent attesting approval.

## What is deliberately not built yet

This is a single-operator pilot on local stdio, and the deferrals below are
choices, not oversights. Building a convincing-looking version of any of them
now would be worse than their absence, because it would look like protection
that is not there.

- **No authentication of the caller.** Stdio inherits your trust: anyone who
  can start this process on your machine is already you. There is no login, no
  token, and no OAuth, because there is no remote surface to protect. This is
  also what bounds the confirmation guarantee above: TIBER can keep an *agent*
  from self-approving, but it cannot verify the client relaying your answer.
- **No multi-user isolation.** `workspaceId` is a label you choose, not an
  authenticated tenant. It scopes reads and writes — a model saved in one
  workspace is not visible in another, and an append naming the wrong workspace
  is refused — but it is not a security boundary against another user, because
  there is no other user.
- **No transport security.** There is no network transport.
- **No rate limiting or audit forwarding.**
- **No sharing, forking, or promotion** of an operator's models to anyone else.

All of these become real requirements the moment this stops being local and
single-operator. That is a separate decision with its own review — not
something to grow into quietly.

## About the SDK version

This pilot uses `@modelcontextprotocol/sdk` 1.30.0 — the **v1** line.

MCP's v2 TypeScript packages (`@modelcontextprotocol/core`, `/server`,
`/client`, all 2.0.0) are the current stable line for the 2026-07-28 protocol
revision. This pilot deliberately stays on v1, for a concrete reason rather
than inertia: v2 requires `zod ^4.2.0`, while this repository is on zod 3.25
with `drizzle-zod` bound to zod 3 and `shared/schema.ts` building its insert
schemas at import time. Adopting v2 therefore means a repo-wide zod major
upgrade, which is far outside a persistence pilot's remit.

v1 remains maintained (1.30.0 published 2026-07-27) and supports
`zod ^3.25 || ^4.0`, so it fits this repo as-is. Migrating to v2 is a sensible
separate piece of work once zod 4 is on the table for the repository as a whole.

## Where the boundaries are drawn

- **Identity** is the canonical opaque `tiber_player_id` from Fantasy #327. A
  name is only ever a way to look one up; what is stored is the canonical id
  the registry returned. No second identity namespace is minted here, and no
  cross-repo identity consumption is introduced (Fantasy #328 still governs
  that).
- **The structured payload** is stored verbatim under whichever contract the
  producing agent *declares* (for example `agent-thesis-proposal/v0`, owned by
  TIBER-Research). This repository does not define, validate, vendor, or modify
  that contract; it records the declared contract id and a digest of the bytes,
  so the payload stays identifiable and any future divergence is visible rather
  than silent.

  Because nothing here checks the payload against the contract it claims, the
  claim is stored and rendered as exactly that — a declaration with an explicit
  validation state of `not_performed`:

  ```
  Declared structured-map contract: agent-thesis-proposal/v0 (declared by the
  producing agent; validation not_performed — this service did not check the
  payload against it)
  ```

  Declaring a contract your payload does not satisfy is therefore visible as a
  false declaration rather than laundered into an apparent guarantee.
- **MCP is transport.** The application operations in
  `server/modules/contextEntityModel/` work without it, and are tested without
  it. Removing the MCP adapter would not change what the pilot can do — only
  how it is reached.
