# Weekly Evidence — offline adapter v0 (#383)

Three read-only tools expose capability discovery, reference listing and one
immutable Watson/GB 2026 REG W1→W2 presentation projection. The service reuses
the exact reviewed #411 decoder and returns its entire model without football
recalculation. This branch is stacked on #411 head
`67398ca651bb96d08798bc10f8134f5ec6c1ff6a`; it neither merges nor edits that work.

`catalog.ts` owns the reference-only allowlist. `weeklyEvidenceService.ts` owns
bounded local reads and decoder invocation. `toolDefinitions.ts` owns strict
inputs, sanitized outcomes and dual JSON/structured transport results.
`server/mcp/weeklyEvidenceServer.ts` owns SDK lifecycle only. No HTTP route,
application bootstrap, database, provider, scheduler or write operation is used.

The server-owned model locator is derived from this module URL. The child cwd
is set before module import because the inherited #411 reader also defines an
unused cwd-relative path at import time. No operator/tool-selectable evidence
path or source override exists. No package script or dependency is changed.

Read inputs are limited to 2,048 serialized UTF-8 bytes; stdio buffering to
8,192 bytes; source bytes to 40,001 read bytes (the decoder rejects over 40,000);
the complete result, counting both representations, to 65,536 bytes. Reads have
a five-second deadline and one active slot per service. A timed-out unfinished
read keeps the slot until it settles. These controls are offline pilot bounds,
not remote transport/auth hardening.

Expected missing IDs return domain `unavailable` with `isError:false`.
Invalid inputs, unknown tools, integrity/read failures, busy and oversized
results return stable status with `isError:true`. Errors do not include raw
arguments, filesystem paths, stack traces or provider bodies. Call clocks are
adapter clocks; all model clocks and unknowns remain unchanged. Listing does
not read bytes and explicitly marks their current integrity unchecked.

The only enabled purpose is the operator-authorized offline adapter inspection.
Every result preserves `remote_consumer_enabled:false`; original projection
eligibility is unchanged. W3, Forecast and Sleeper association remain unavailable
in this fixed catalog. Their unavailability is not a global absence claim.

See `docs/mcp/weekly-evidence-offline-v0.md` for setup and acceptance, and
`docs/mcp/weekly-evidence-personal-beta-proposal.md` for the separate remote gate.
