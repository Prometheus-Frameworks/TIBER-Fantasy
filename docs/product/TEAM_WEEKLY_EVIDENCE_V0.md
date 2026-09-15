# Team weekly evidence entry — #391

Joe authorized starting the bounded Team integration on September 15, 2026.
Source design and remaining acceptance criteria: https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/391

## Prepared first slice

An expandable roster entry lazily requests the explicit league season and selected REG week from #386's inactive weekly endpoint. Week 1 is an explicitly labeled starting selection, never inferred current-week status. The view distinguishes loading, transport/contract error and unavailable. Retry, abort, timeout and scope checks prevent stale responses from replacing the selected week. Unsupported populated/preview payloads fail closed.

The user can select a current QB/RB/WR/TE and copy a separately versioned investigation request. It carries the selected week, dated current league and roster snapshot, exact Sleeper player identity and explicit weekly unavailability. It neither asserts a GSIS join nor report-week ownership. It sends no message and leaves existing comparison/agent packets unchanged. Clipboard failure remains visible and old completion messages are invalidated on scope changes/unmount.

## Dependency and next handoff

Prepared on Fantasy #386 head `c62dbb084b4df5a625c785a74671fc15032e41a5`; Data #273 remains the upstream candidate. This follow-on does not repair, merge or modify those branches.

The production contract currently has no admitted populated state. Weekly candidate rows use GSIS identities, whereas current roster rows use Sleeper identities. Full My players / All players, bucket filters, scoring decomposition and observed-evidence investigation cards remain pending reviewed admission, runtime response contract and exact identity mapping. Never name-match or expose the offline preview to work around these dependencies.

Preserve target counts/share denominators, all-team carry share naming, existing descriptive thresholds/holding categories, separate QBs and standardized full-PPR versus league scoring. No routes, first reads, air yards, proprietary data or role proxies. Future correction revisions must disclose bucket changes; movement needs comparable weeks and visible gaps. Cadence is not scheduled.

## Validation and release boundary

- 43 tests across new weekly UI, existing Team UI and public routes pass.
- Full client/server build passes with existing bundle-size/duplicate-member warnings.
- Built public-profile HTTP smoke: 200, no-store, explicit REG scope, unavailable, empty players, consumer_admitted false.
- Typecheck reports 507 diagnostics, none in touched UI/test files. The older saved baseline has 506; the extra TS2802 is in unchanged #386 weeklyBoxscore.ts (iteration over Map), not this UI diff. Repository typecheck is not clean.
- Browser visual acceptance remains pending: Playwright package is available but Chromium executable is absent. No phone acceptance is claimed.
- No source admission, activation, DB/provider work, merge or deployment.
- Railway preview-base and production bind main. Read-only service config does not expose the project PR-environment enable/disable setting. No new weekly PR environment was listed, but absence alone does not prove future suppression. Hold PR creation until suppression is verified or an isolated preview is explicitly authorized. Do not change infrastructure to resolve this automatically.

Before a later main-target PR: reconcile/rebase against final #386, rerun affected validation, obtain independent review and portrait-phone acceptance. Branch preparation is not merge authority.
