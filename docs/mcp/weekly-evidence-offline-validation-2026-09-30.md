# #383 offline validation — September 30, 2026

Branch `codex/383-weekly-evidence-offline` is stacked on unmerged #411 at
`67398ca651bb96d08798bc10f8134f5ec6c1ff6a`. Review the incremental diff against
that exact base. Decoder, model, manifests, routes and existing MCP server are
unchanged. No integration or admission decision is implied.

Model: 12,298 bytes; SHA-256
`06f7c33f9ca4ea7e3ce5b8a2b88891d3bb63e8a899294f66f8fff955fc658c2e`.
The complete presentation projection preserves provenance and unavailable
states; it is not a complete producer export. No W3/Forecast substitution or
inferred Sleeper association is performed.

## Executed checks

Node 24.19.0; existing SDK 1.30.0, Zod 3 and tsx dependencies reused from the
retained checkout. No installation, package/script change or provider/producer
execution. Commands for native tests and targeted compilation are in the setup
document.

| Check | Result |
|---|---|
| Native offline integrity/protocol tests | 13/13 pass |
| `npm test -- --coverage=false server/modules/draftReview/__tests__/playerStateCardEvidence.test.ts client/src/__tests__/PlayerStateCard.test.ts` | 16/16 pass, two suites |
| Targeted strict TypeScript compilation | Pass |
| `npm run build` | Pass; inherited duplicate `applyAdjusters` warning |
| `npm run typecheck` on head and exact #411 baseline | Both fail with 507 diagnostics; normalized error lines identical |
| Standalone adapter esbuild with external packages and metafile | Pass; five local modules, no DB/provider/application bootstrap |
| Base-relative decoder/model/package diff | Empty |

Typecheck comparison normalized absolute checkout paths only, comparing all
`error TS` lines in order. Unrelated npm notices were excluded. This is zero
added diagnostics, not a clean full-project typecheck.

Tests cover hash tamper, read failure, unknown IDs, strict selectors, input,
source and full dual-result ceilings, overlap, timeout slot retention/recovery,
real SDK initialize/list/call, actual stdio startup from a foreign cwd and
oversized incomplete framing. Complete model equality and identical structured
and text results are checked. Child environment exclusion is checked against
the explicit launcher factory; it is not a malicious-host sandbox.

The adapter metafile contains catalog, service, tool definitions, MCP entry and
the inherited decoder only. Its temporary bundle is an import-graph check,
not release packaging: artifact placement requires a later authorized build.

## Remaining gates

Self-review completed; independent exact-head review and actual ChatGPT/iOS
acceptance remain pending. No hosted/auth implementation exists. The separate
personal-beta proposal describes dedicated HTTPS Streamable HTTP, managed
OAuth, Joe-only authorization and later explicit source/use admission.

No merge, deployment, consumer activation, provider call or producer run is
authorized here. Publish the isolated review branch only; no PR is opened in
this slice, avoiding PR preview effects. Current main's four GitHub workflows
were read at `4204ddfc0fb0dd38da708e9aea3c4d01b77997ab`: only main pushes run
Core Build; remaining triggers are PR/path, scheduled or manual. No workflow
is manually triggered by this task. #411 remains a separate dependency decision.
