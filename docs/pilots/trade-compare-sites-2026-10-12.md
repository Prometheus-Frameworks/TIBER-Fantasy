# Trade Compare v0 — Sites pilot receipt

October 12, 2026 · [Fantasy #416](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/416) · save-only, unmerged, owner-private. [Ops #88 D3](https://github.com/Prometheus-Frameworks/TIBER-Ops/issues/88) remains open.

## Reviewable result

`pilots/trade-compare-sites/` contains the standalone phone-first comparison, consumer-neutral player card, strict historical adapter, fixed HTTPS relay and focused tests. Select two or three hand-picked players, inspect evidence, optionally arrange give/receive, and copy a research packet with a separate operator thesis. No player score or trade verdict.

Site: **TIBER · Trade Compare**, saved version **1**.

- Project: `appgprj_6acd5dfd92108191a256cab7c8a1db66`.
- Version: `appgprj_6acd5dfd92108191a256cab7c8a1db66~appgver_8c77c7a0bce88191b63ba6e69cb96e24`.
- Pushed Site source: `6dd2a8941e9ea6265e731ff183c6ec78d1f67198`.
- Saved archive: SHA-256 `a28eb888435550c2cec441564a821a53cc4a0d60c0f6b02ae03327d2c0b24b7b`; 1,402,880 bytes, 59 runtime files.
- Access read-back: custom audience, one allowed user with owner role, zero groups, zero editors. No live/preview URL or deployment ID. No invitations or public publication.

## What worked and what changed

| Area | Result |
| --- | --- |
| Evidence semantics retained | #404 historical source contract: exact identities, 2025 W1–18, source values, nonnull/recorded-week denominators, confidence, provenance, null clocks, limitations and explicit missingness. |
| Card reuse | #294/#411 identity/scope, role/team separation, health and source-receipt structure become a pure card over a UI-local projection. Unmerged private Watson observations and its admin route are not copied or activated. |
| Runtime/framework adaptation | New standalone React/Vinext app and Web Request/Response relay build for Cloudflare Workers using Sites' maintained integration. Existing TIBER Team React/Vite/Express entry points are untouched. |
| Express compatibility | Express stays on Railway; only its existing public historical GET is called over HTTPS. No pg/raw TCP, listener, new Railway route, schema or database work. |
| Source read | Existing `/api/draft-review/evidence` returned HTTP 200 for two and three exact IDs. Local two-player relay also returned available with 50,149 serialized response characters. |
| Hosted Sites runtime | **Not run.** The pushed source and runtime archive are saved; hosted dispatch/egress/auth/clipboard behavior remains unverified because no deployment was requested. |

## Loading limits and surprises

Railway returns no `Access-Control-Allow-Origin` even for a supplied Site Origin. A fixed same-origin Sites relay avoids changing Railway CORS. It allows one to three exact numeric IDs, rejects unknown/repeated keys and caller-supplied URLs/user IDs, forwards no cookies/auth, fails on redirects, caps responses at 192 KiB and times out at eight seconds. No automatic retries or fixtures replace a failed read.

The full public Sleeper directory response was 14,661,550 bytes. The Site therefore uses seven dated name hints checked against exact public IDs, with no runtime bulk-directory call and no name-based identity join. Historical canonical identity is resolved from the existing Railway response. Current team/availability remain unavailable.

The source returned 49,839 bytes for a pair and 51,248 bytes for three players. Two later direct Node relay smoke attempts timed out to unavailable; a separate three-player HTTP read succeeded and passed the same parser. This is a visible transport limitation, not established hosted Sites behavior. `/api/draft-review/data` returned 404 in the inspected deployment, so the pilot does not depend on it.

Weekly ROP/TTS, points, xFP, forward projection, schedule, roster capacity and partner willingness remain unavailable/unknown. The Shipley example is an illustrative hypothetical with unmodeled redistribution.

## Validation and D3 implication

**33/33** focused Node/React-render tests, strict standalone TypeScript, and the Sites Workers build passed. Tests cover zero/missing, identity/admission/scope/coverage, side/thesis invariance, source failures and response caps, request allowlisting, late-result invalidation and escaped untrusted text. Framework build reports `/` as statically unclassified; this is a Vinext classification notice, not a hosted acceptance result.

No supported control-browser skill is present in the managed environment. Browser/portrait-phone/assistive-technology acceptance is pending; no substitute preview server or browser was installed.

D3 remains unresolved. Smallest next step: review this saved version and exact PR head, then separately authorize an owner-private runtime/phone pass if useful. The pilot supplies no reason to move Express, Postgres, team login, frozen FORGE or `forge_grade_cache` from Railway.
