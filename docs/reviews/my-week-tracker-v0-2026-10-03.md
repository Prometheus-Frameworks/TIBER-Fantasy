# My Week tracker v0 — review candidate, October 3, 2026

Joe authorized starting the proposed My Week integration in this chat on October 3: matchup cards, score margins, attention flags and expandable lineups, designed for phone use. This candidate is unmerged and not deployed. No production release, authentication activation, schedules, fantasy transactions, model changes or evidence admission is included.

## Reconciled source heads

- main: `4204ddfc` (full SHA available in branch ancestry).
- #375 foundation is inherited through #387/#388 at `1597b2d00ef93408eb7f65208092ae2886cd5ea5`.
- #387 selected-league weekly results: `354cfe2b7264ff49167daa3cd50229aba1e273d7`.
- #388 ownership/designations: `2a89dba405a646776bfde9e18ab3d105c5aa7a6a`.
- #377 Chapter and weekly matchup: `63395bf2a0d0e1817618fc0b2114d2982c3f2815`.

The new branch integrates the existing code and preserves main's #386 weekly evidence gate, #396/#405 waiver tools and #408 historical catalog. No existing branch was updated. Both append-only agent histories are retained. Team's main copy path keeps selected waiver evidence when attaching Chapter context. The inherited team-auth foundation remains configuration-gated; the intended preview runtime is public-draft-review.

## Resulting workflow

Open Team → My Week. Enter a public Sleeper account and season, choose leagues (Select shown leagues respects the name/format filter), choose a week, then Refresh results. Score cards show reported points, commissioner overrides, observed margin, existing provisional head-to-head status and separate source clocks. Each league uses its own scoring; no cross-format point sum is introduced.

Open lineups and attention check fetches the existing strict matchup endpoint for that exact roster, opponent, season and week. Both weekly starting lineups are stacked for portrait use. Empty slots and exact Out/IR/PUP/Doubtful/Questionable directory designations are displayed for the selected roster. These are current directory labels, including when viewing an earlier week. No missing designation establishes health. Attention is checked per opened card; unopened cards say not loaded. This is not a full-league attention scan or alert system.

Refresh results, scope changes and roster choices invalidate scoped lineup components. Closing an expansion aborts its read; failed refresh removes prior lineups/attention. Late and mismatched roster/opponent/week responses are rejected. Requests use the existing pacing/429 budget. No polling or browser persistence is added.

The Players tab preserves #388's current ownership view independently of the selected week. Open Team keeps the Manager selection session. Reload clears it.

Empty starter placeholders `""` and `"0"` are accepted only in the weekly starter array and become explicit empty slots; strict primary player membership remains unchanged. This matches the already repaired exposure adapter.

## Validation

- 278 tests / 22 suites passed across combined Manager, exposure, switcher, Chapter, matchup, WR, compiler, routes, auth isolation and public containment.
- After final opponent-scope tightening: 13 focused My Week/Manager tests passed, including the additional opponent mismatch regression.
- Full `sh build.sh` passed, including the final candidate. Existing bundle-size warning remains.
- TypeScript baseline: main has 507 diagnostics; the candidate after Select shown compatibility repair retains 507 with no additional file/code diagnostics. Repository-wide typecheck is not clean.
- Actual built public runtime HTTP: /team and /draft-review 200; runtime profile public-draft-review; invalid Manager and matchup week 400/no-store; private session and legacy players API 404.
- git diff --check passed.
- Browser executable was absent; attempted Playwright Chromium download returned invalid/truncated archives and failed. No rendered 390/430px, VoiceOver or actual iPhone acceptance claim.
- No independent exact-head review claim.

## Publication boundary and next acceptance

Production service configuration was read-only checked: it tracks main. The new branch is not attached to a service. Available Railway connector calls do not expose the project setting for automatic PR previews. Recent earlier records report suppression, but this run did not independently verify that setting. Do not open a PR that might create an uncontrolled runtime until suppression or a bounded public preview configuration is verified. Do not change Railway settings as part of this candidate.

Next: independently review the pinned candidate, verify publication isolation, then open a draft PR and perform portrait-phone review in an authorized public preview. Check selection/filtering, large league lists, zero/missing scores, expansion/close/refresh, week/account changes, ambiguous membership, Team return and retained waiver/data tools. Auth activation and main/production remain separate decisions.

Deferred: live/final game state, schedules, players remaining, win probabilities, leverage rankings, full-card attention scan, durable decisions and notifications.
