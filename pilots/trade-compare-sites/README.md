# TIBER Trade Compare v0 — Sites pilot

Standalone, owner-private **save-only** pilot for [Fantasy #416](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/416). No deployment or merge is granted by this source. Ops #88 D3 remains open.

## Experience

Choose two or three of seven hand-picked players; switch between Compare players and Explore as trade. Open the reusable evidence card, inspect historical metrics with their denominators and receipts, add a page-local operator thesis, and copy a bounded research packet. Package sides and operator judgment never change the shared player state. No roster, automatic action, trade score or verdict exists.

The intake name hints were checked against exact IDs in the public Sleeper directory on October 12, 2026. They are dated display labels, not canonical identity or current-team evidence. No bulk directory is shipped or downloaded by this Site.

## Eligible data boundary

Only `GET https://tiber-fantasy-production.up.railway.app/api/draft-review/evidence?player_ids=<one-to-three-exact-numeric-ids>` is read. It is a public, non-user-scoped historical route, mounted before session/database-backed routers. Its existing server-owned bundle pin and historical admission remain the source boundary.

The Site's `GET /api/compare?ids=…` is a fixed HTTPS relay, **not a Railway endpoint**. It rejects unknown/repeated query keys, duplicate IDs, more than three IDs and nonnumeric IDs before fetching. It forwards only an Accept header: no Site session, auth header, user_id, caller URL, cookie or provider key. Redirects fail closed. Reads use an eight-second deadline and 192 KiB streamed-response cap; results and errors use private/no-store caching. The browser retains same-origin Site session access for the relay; those credentials never travel to Railway.

History is explicitly **2025 weeks 1–18**, using recorded and nonnull-week denominators. Recorded weeks are not certified games played. Mean weekly shares are not season shares, and their underlying operands are unavailable in this aggregate. Missing values stay unavailable; supported zero remains zero. Source acquisition/update/cutoff clocks remain unavailable and are never replaced by retrieval time. Missing/invalid/unadmitted/foreign responses fail closed without fixture substitution.

Weekly ROP, same-window Teamstate, actual fantasy points, opportunity xFP, forward projections, schedule, current injury/availability, roster fit, forced cuts and partner willingness are unavailable/unknown. The Shipley section is explicitly an illustrative hypothetical, with unmodeled redistribution. It contains no numeric football claims.

## Reuse and ownership

- [#294 / PR #411](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/411): reuse the identity/scope, observed-versus-derived, role/team, health/receipts and missing-witness presentation. #411 remains unmerged; its admin-only Watson route and bounded private qualification are not activated or broadened here. No Watson observations are copied.
- [#383](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/383): retain strict selectors, lineage, scope and unavailable weekly/model sections. Do not relabel a historical aggregate as ROP or TTS.
- [#404](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/404): adapt the admitted historical response contract, exact selections, denominator display, fail-closed parsing and late-read/copy invalidation.
- [#355](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/355): preserve structural fit versus willingness. Give/receive is operator context; roster/counterparty inference remains unavailable.

`lib/player-state.ts` is a **UI-local** projection over an existing historical read model, not a new promoted producer contract. `components/player-state-card.tsx` is a pure reusable React card that receives this model without trade-specific state. A later Team consumer can supply the same model; producer/identity semantics remain unchanged. No Team route is registered.

## Runtime

The supplied Sites Vinext/Cloudflare starter supplies the runtime and its maintained `sites()` build integration. The app is React with ordinary browser state and a framework route returning Web Request/Response objects. Express remains on Railway; no Express server, Node listener, pg client, raw TCP or database connection is moved into the Site. D1/R2 bindings are null. No connectors, schedules, Sign in with ChatGPT flow or runtime secrets are configured. Keys, if ever separately required, belong in Site settings.

Starter tooling and lockfile remain separate from TIBER-Fantasy's root package/build. The starter dependency set includes unused UI/database packages; none are imported by the pilot. The production bundler tree-shakes unused dependencies. The Site code does not import FORGE, `forge_grade_cache` or team auth.

## Checks

From this standalone folder, after the Sites dependency helper installs the provided lockfile:

```sh
node node_modules/typescript/bin/tsc --noEmit --pretty false
node tests/run.mjs
node /root/.codex/plugins/cache/openai-curated-remote/sites/1.0.0/scripts/build-site.mjs
```

The native runner uses the starter's Wrangler-owned esbuild and Node test runner, with synthetic conformance fixtures and React static rendering. It installs no browser. Full TIBER-Fantasy server tests are not needed: the existing server/client, root dependencies, contracts and frozen modules are unchanged.

Browser/390px device/assistive-technology acceptance and actual **hosted** Sites dispatch/HTTPS acceptance remain pending. Local framework build, direct HTTPS source/relay checks and a saved archive do not establish hosted behavior. No preview server was launched because the managed environment has no supported control-browser skill.

For owner review, confirm the saved version and keep it private. A later explicitly authorized private deployment can test runtime dispatch, cold and failed reads, narrow-screen table scrolling, drawer focus/Escape/return, clipboard errors and same-origin owner access. A public deploy and D3 closure require their own operator decision.
