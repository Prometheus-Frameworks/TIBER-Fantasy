# Team access and freshness decision packet — October 1, 2026

## Authority and ownership

Joe authorized this bounded task live on October 1 at 14:15 EDT. See Ops #88's pre-execution authority record. This is task-specific authority, with no scheduled/recurring grant: inspect deployments read-only; implement/review freshness on an isolated branch; prepare remote MCP; publish branch/progress/draft PR where publication cannot cause deployment. No merge, deployment/migration, authentication/consumer activation, source acquisition/admission, producer/provider run, spending or schedule.

Base: `4204ddfc0fb0dd38da708e9aea3c4d01b77997ab` (Fantasy main). Branch: `codex/team-access-freshness-20261001`. Dot keeps Research #25 and the current review assignment; Claude keeps Rookies #299/#300 implementation. No changes to their branches, assignments or consumers. Ops #88 remains the deployment record; its separate FORGE retention lane is untouched. Ops #92's prior lane stop is not a new activation grant. Current Ops #66 governance and the repository/module instructions govern this bounded task.

## Read-only deployment reconciliation

Railway control-plane reads on October 1, 2026, corroborated by public HTTP reads:

| Entry | Exact deployed commit | Successful deployment ID | Deployment created (UTC) | Boundary |
| --- | --- | --- | --- | --- |
| [PR408 Team](https://tiber-fantasy-pr408-preview-base.up.railway.app/team) | `482736f33a34267ae6dc4e038c04872e8162abee` | `77f87712-ec3b-4c7c-8373-26c4f64a9047` | 2026-09-23T19:55:33.280Z | Dedicated public Draft Review profile, no attached volume; direct variable names NODE_ENV/TIBER_RUNTIME_PROFILE only |
| [Production Team](https://tiber-fantasy-production.up.railway.app/team) | `5ad78c4e89f3ce4bfcbcc4af5912b8aca1063644` | `1b87d18e-f9d2-4d5c-93aa-916a04c21752` | 2026-09-16T02:00:44.199Z | Full Fantasy runtime with database/provider/admin configuration and /data volume |

Both `/team` returned HTTP 200 at 18:47:22Z and 18:47:37Z respectively. Both existing weekly endpoints returned no-store HTTP 200 with `status: unavailable`, `consumer_admitted: false` for 2026 REG Week 3 at 18:47:34Z/18:47:46Z. `/api/runtime-profile` is the correct diagnostic path; an attempted `/api/runtime/profile` was 404 and supplies no profile evidence. Earlier direct profile reads and the repeated correct-path read support the profile distinction. Control-plane deployment-created times are not build timestamps, football updates, or cryptographic proof of delivered browser assets. No credentials or variable values were read.

Recommend the **PR408 address as the single interim bookmark**. It has the newer Team workspace and narrower runtime. This is an operator recommendation, not a renamed deployment or permanent production designation. It remains a pinned preview and can be removed; the production address is an older fallback, not an equivalent feature surface. No new freshness code from this branch is deployed to either address.

The PR408 head includes public Sleeper roster selection, selected historical evidence studies, TE exploration, waiver shortlisting/pair comparison, the admitted historical Data table and up-to-four-player comparison, and copy-to-agent context. These features are established by the exact deployed source; HTTP checks verify route availability and evidence boundaries, not every interactive feature on an iPhone. Roster selection does not authenticate ownership or submit lineup/trade/waiver actions. Historical evidence is the existing admitted 2025 REG Weeks 1–18 cohort, with per-player coverage/missingness and attribution preserved. Source acquisition/update timestamps remain unknown. This is not current 2026 rankings, projections, Watson W1→W2 consumer activation, W3 evidence or Forecast. No X scraping or route-data substitutes were introduced.

### iPhone entry instructions

1. Open Safari and go directly to `https://tiber-fantasy-pr408-preview-base.up.railway.app/team`.
2. Open the page menu, then **Share** (or the Share button), then **Add to Home Screen**. If absent, use **Edit Actions** to add it.
3. Name it **TIBER Team**. If Safari offers **Open as Web App**, enable it, then tap **Add**.
4. Open that icon for Team. Use the existing public Sleeper entry flow and select the intended roster. Save discussion/study context with the existing copy action before refresh; page-local studies are not durable account state.

Actual portrait-iPhone interaction, clipboard behavior and home-screen launch remain operator acceptance checks. The icon does not make evidence fresh. The branch's freshness panel will appear only after a separately authorized release.

## Minimal freshness change

A collapsed panel near the Team header reads one no-store GET, `/api/draft-review/freshness`. The endpoint discloses only an allowlisted 40-character Railway-reported commit SHA, otherwise Unknown, and the integrity-checked existing historical window. No DB, provider calls, new dataset, identity admission, environment dump or release configuration. Metadata fetch failures, malformed replies, timeout and retry clear prior metadata; late responses cannot restore it.

Code clocks: server revision is platform-reported and cannot certify cached browser code. Build/deployment dates remain Unknown because this runtime has no verified timestamp artifact. The deployment-created dates above are verified control-plane records, deliberately not injected as source/build clocks.

Evidence clocks: 2025 historical coverage is shown only when the admitted local artifact is valid; last successful evidence refresh/source update remains Unknown. No refresh receipt exists, so request time, artifact mtime, commit date and roster compilation are not substitutes. Weekly evidence stays Unavailable, matching the existing unadmitted weekly lane. Roster snapshot compilation remains separate and clears with current roster state. This metadata protocol deliberately supports only current unknown clocks; a later verified timestamp needs its own reviewed contract change.

## Validation and publication gate

- Nine focused suites / 82 tests pass, including freshness response allowlisting, missing metadata, public boundary/no-store, malformed response, timeout/late response, retry invalidation, roster-clock reset, Team, historical Data, waiver and evidence regressions.
- `sh build.sh` passes on the final implementation, with existing chunk-size and applyAdjusters warnings.
- Full typecheck: base and candidate each have 507 diagnostics; no added per-file/error-code counts, none in freshness files. Four textual diagnostic lines differ due to inferred property order/checkout path. Repository-wide typecheck is not clean.
- Independent review must cite the exact committed head; the final issue handoff carries that SHA and review outcome. No phone acceptance claim.

Publication gate: `server/modules/draftReview/MODULE.md` explicitly says a draft PR must not be opened until automatic deployment suppression is verified. September 19/29 records describe suppression, but today's service config APIs do not expose the current project PR-environment switch; the Railway UI inspection did not complete. GitHub workflows inspected do not deploy this isolated branch, and the branch is not a connected service source. A branch may be published; **PR creation stays held** until fresh suppression proof is available. Draft status alone is insufficient. No setting was changed to overcome this gate.

## Deployment decision

Ready for operator review: the isolated freshness branch, exact-head review, this access bookmark and the separate MCP packet. Not ready for release: current PR-preview suppression proof, merge/deploy authority, final release build/date provenance and phone acceptance. Suggested later action is a bounded Team preview release after those checks, preserving the canonical bookmark or explicitly notifying Joe of its replacement. No action in that later release is performed here.

Sources: Ops [#88](https://github.com/Prometheus-Frameworks/TIBER-Ops/issues/88), [#92](https://github.com/Prometheus-Frameworks/TIBER-Ops/issues/92), [#66](https://github.com/Prometheus-Frameworks/TIBER-Ops/issues/66); Railway read-only status/config/deployment/domain APIs; exact deployed Git commits; [Apple home-screen instructions](https://support.apple.com/en-gb/guide/iphone/iph42ab2f3a7/ios); [Railway reference variables](https://docs.railway.com/variables/reference).
