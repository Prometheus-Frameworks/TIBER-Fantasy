# TIBER Now — Project Status

**Last repository check: September 21, 2026 (UTC).**  
**Scope:** public upstream source and GitHub work records. Deployment, live accounts and current data freshness were not tested in this check.

**Publication:** once this page exists on `main`, the [default-branch copy](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/blob/main/docs/TIBER_NOW.md) is the canonical published page. Until the initial publication is merged, no published copy exists at that URL. Copies on review branches are proposed revisions. [PR #401](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/401) records the initial publication review and merge state. Publish the canonical page before merging companion cross-repository README links. Publication does not change the dated evidence scope or establish live capability.

TIBER builds open football research and decision-support tools: data contracts, interpretable models, and ways for people and their agents to inspect the evidence. This page is the shared starting point across the repositories.

[Proposed coordination direction — Ops #84](https://github.com/Prometheus-Frameworks/TIBER-Ops/issues/84): alongside software, TIBER can help people frame football questions, define bounded experiments, and make the missing evidence and acceptance criteria clear. It need not own every dataset or implement every idea. This complements Team and the domain producers; it is documentation direction, not a newly delivered runtime capability or adopted authority model.

## Start here

- **Explore the product or run it yourself:** [TIBER-Fantasy setup and surfaces](../README.md). Team is the public Sleeper roster/comparison and agent-handoff entry point.
- **Build with football data:** [TIBER-Data contracts and artifact index](https://github.com/Prometheus-Frameworks/TIBER-Data#readme). Verify the exact artifact, supported season/week and provenance before consuming it.
- **Try a model or research tool:** use the repository map below. “Packaged for testing” means committed code and documented local entry points, not a certified deployment or validated predictive advantage.
- **Understand project direction:** [TIBER Product Boundary v1](https://github.com/Prometheus-Frameworks/TIBER-Ops/blob/main/docs/architecture/tiber-product-boundary-v1.md) and [operating map](https://github.com/Prometheus-Frameworks/TIBER-Ops/blob/main/docs/operating-map.md).

TIBER prepares the decision; the human manager makes it. Observed football data, model inference, research proposals and agent reasoning should remain distinguishable.

## What the status labels mean

| Label | Meaning |
| --- | --- |
| Available to use | An identified source, document or artifact can be used within its stated scope and prerequisites. It does not imply a hosted service was checked. |
| Packaged for testing | Committed implementation and documented local entry points exist; validation, coverage and runtime limits still apply. |
| In progress | A concrete implementation or review candidate exists, but the stated delivery milestone is unfinished. |
| Conceptual / proposed | A design or requested direction exists; it is not a shipped capability. |
| Blocked / parked | A prerequisite or separate decision is needed before that use can proceed. |

“Design complete,” “code merged,” “tested package,” and “live feature” are separate milestones. A closed issue or enthusiastic comment does not establish all four.

## Current work and next checkpoints

All records below were checked on **September 21, 2026**. These are workstreams to understand, not new implementation authority or promised delivery dates. Comment-based receipts are attributed reports, not independent reproduction of their work.

| Workstream | Current status | Evidence and next checkpoint |
| --- | --- | --- |
| Weekly box-score producer and Team adapter | **Code merged; runtime blocked** | [Data PR #273](https://github.com/Prometheus-Frameworks/TIBER-Data/pull/273) and [Fantasy PR #386](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/386) merged September 16. Offline preparation exists; the weekly endpoint deliberately remains unavailable. Separate source admission and consumer activation are still needed. |
| Team waiver context and pair comparison | **Code merged; live release not verified** | [Fantasy PR #396](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/396) merged September 20 as [`a10b6c0`](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/commit/a10b6c0236bdc56b633b441f2d17140fe99e7955); stacked [PR #405](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/405) followed as [`71ca2a0`](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/commit/71ca2a09482ed29c3ae878a050fc6f030d1bbd6c) after exact-head review found no major issues. These merges establish default-branch source for observed waiver settings, shortlist handoff and two-candidate historical comparison; they do not establish production deployment, current data, transaction authority or a live forecast. [Issue #404](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/404) remains open and its public receipt still describes phone acceptance as pending. |
| Team MCP connector | **In progress — source-disabled local transport; review changes required** | [Issue #383](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/383) defines a read-only Team MCP goal. Draft [PR #406](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/406) contains three local stdio tools at `bc5552c66d9c5968c2e5d2d2d9b6ebac2c333157`, with live readers deliberately disabled. Its PR body reports 47 contract tests, five protocol tests and targeted strict TypeScript checking; those are attributed candidate results, not a named-client or live-source acceptance. The [current-head review](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/406#pullrequestreview-5266233030) found two P2 defects: a [custom-prototype plain-object bypass](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/406#discussion_r4061823622) and [unbounded shared-reference expansion before the response-size check](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/406#discussion_r4061823626). Repair and fresh review are required. No production reader, source admission, hosted connector or deployment is established. |
| 2026 in-season Forecast | **In progress — local work reported; upstream/live delivery unverified** | [Forecast #187](https://github.com/Prometheus-Frameworks/TIBER-Forecast/issues/187) defines the Year 1 baseline. Its [recovery checkpoint](https://github.com/Prometheus-Frameworks/TIBER-Forecast/issues/187#issuecomment-5697061673) and [routing board](https://github.com/Prometheus-Frameworks/TIBER-Ops/issues/82) distinguish local specification/implementation work from the remote main branch. Current local patch, arithmetic/evaluation receipts and live candidate were not inspected here. Recover exact artifacts before claiming completion or repeating work; historical backtests and merged intake do not establish a live 2026 forecast. |
| Weekly Pulse | **Conceptual / proposed** | [Fantasy #381](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/381): a post-slate observation shortlist. Next checkpoint is source readiness and a bounded selection policy. |
| Team Charts | **Conceptual / proposed** | [Fantasy #399](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/399): single-week scatter plots with presets and supported custom axes. Current-week source admission remains a prerequisite to populated charts. |
| Team iOS | **Conceptual / proposed readiness track** | [Fantasy #400](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/400): choose a release baseline and resolve account/device/distribution gates. No TestFlight or App Store availability is certified here. |
| Other Team interaction candidates | **In progress — review changes required** | [PR #377](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/377) remains open, draft, unmerged and not currently mergeable at `63395bf2a0d0e1817618fc0b2114d2982c3f2815`; its exact-head review found one [P1 hidden-board handoff/race defect](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/377#discussion_r4054651151) and two [RESERVE-slot](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/377#discussion_r4054651155) [P2 findings](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/377#discussion_r4054651157). [PR #388](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/388) remains open, draft and unmerged at `3e9f7b29c3a2f93d417e6c05ad7774cc5b3c2121`; review found a [P2 empty-starter parsing defect](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/388#discussion_r4054648466). PR-body preview/test reports remain attributed evidence; neither branch is a default-branch or production feature, and portrait-phone acceptance remains outstanding. |
| Contributor provenance policy | **In progress — documentation candidate with review findings** | [Fantasy PR #403](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/403) is open, non-draft and unmerged at `ce50eb8446690cbf4a84f6de90a6a5311d27e222`. Its review found two P2 documentation gaps: [copied/forwarded prompts are not fully covered](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/403#discussion_r4054382499) and the [handoff lacks stable source/revision identifiers](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/403#discussion_r4054382502). It is not yet default-branch policy or mechanical enforcement. |
| Contributor ideas and expert-signal contracts | **Design revisions requested; code candidate still in review** | Recorded design reviews for [asset thesis #397](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/397#issuecomment-5735746262), [shared uncertainty #389](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/389#issuecomment-5735739770), [league formats #364](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/364#issuecomment-5735739629), and [transaction comparisons #402](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/402#issuecomment-5735728706) all return `revision_required`, with live-retrieval/fork-verification limits. These are design findings, not rejection or certification of uninspected fork code. Expert-signal [PR #395](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/pull/395) is an open draft with a review request but no returned review in the retrieved discussion/review endpoints. No upstream adoption is established. |
| Transaction-comparison incorporation | **Parked** | The [September 18 disposition on #355](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/issues/355#issuecomment-5735597009) retains the narrow external idea without amending the existing accepted design. Price units, comparability, independence, clocks and source/privacy rules remain unresolved. Review findings do not assign implementation or repair to either party. |
| Late-veteran WR research | **Prospective follow-up plan; not a new validated signal** | [Signal-Validation-Model #16 follow-up](https://github.com/Prometheus-Frameworks/Signal-Validation-Model/issues/16#issuecomment-5735513430) records a dated Week 2 opportunity watch and post-week assessment plan. The August study, cutoff and inconclusive research disposition remain unchanged. Underlying football observations were not refreshed by this documentation check; one subsequent game cannot validate the historical screen. |

### Recent verified changes

- **September 21 check:** Fantasy #396 and #405 merged to `main`, establishing default-branch waiver-context and pair-comparison source without establishing deployment or live data. Draft #406 adds a source-disabled local Team MCP candidate; its latest exact-head review requires two P2 repairs.
- **September 21 check — repository map otherwise stable:** all 14 default branches remain `main`; every README read succeeded; the other 13 recorded default-branch pins and readiness categories are unchanged. All 13 companion README-link PRs remain open drafts.
- **September 20 check:** corrected the #396 authorization-versus-verification wording flagged on #401; recorded the #404 partial phone interaction, the reviewed but then-unmerged #405 comparison candidate, and actionable review findings on #377, #388 and #403. The September 21 merge receipts supersede the earlier candidate state for #396 and #405.
- **September 19 check:** clarified waiver review/build versus missing preview/phone acceptance, recorded returned contributor design reviews and the parked transaction proposal, and linked the separate prospective WR follow-up. These are record/readiness changes, not new releases.
- **September 19 check — no material capability change:** the 14 upstream README summaries retain their prior readiness categories. Weekly Pulse, Charts and iOS remain proposals; the current weekly consumer module still documents an unavailable endpoint. Local-only work and hosted state remain outside this check.
- **September 16 merge milestone, rechecked September 21:** Data #273 and Fantasy #386 merged. This is implementation preparation, not current-week data activation.

## Repository map

Each entry links to its checked upstream README and local usage instructions. The September 18 snapshot was rechecked on **September 21, 2026** against all 14 default branches (all `main`), their READMEs, open PRs and recently updated issue records. Their commands and applications were not rerun. Exact repository pins are recorded below; issue/comment state is separately mutable.

| Repository | Status / usable scope | What to expect |
| --- | --- | --- |
| [TIBER-Fantasy](https://github.com/Prometheus-Frameworks/TIBER-Fantasy#readme) | Available to use — source/setup | Web UI/API, public Sleeper Team context, player comparison and agent handoff. Data and deployment prerequisites apply; hosted availability was not tested. |
| [TIBER-Data](https://github.com/Prometheus-Frameworks/TIBER-Data#readme) | Available to use — contracts/tools | Canonical contracts, identity and artifact documentation. Check each artifact’s provenance and coverage; a promoted directory alone proves neither. |
| [TIBER-Rookies](https://github.com/Prometheus-Frameworks/TIBER-Rookies#readme) | Packaged for testing | Rookie Alpha producer, export validation and standalone static lab. Downstream handoff remains explicit; experimental ML is separate. |
| [TIBER-Forecast](https://github.com/Prometheus-Frameworks/TIBER-Forecast#readme) | Packaged for testing | Scoring kernel and historical seasonal backtest. The 2026 in-season program is separate; this snapshot does not certify a live forecast. |
| [TIBER-FORGE](https://github.com/Prometheus-Frameworks/TIBER-FORGE#readme) | Packaged for testing | Deterministic grading and artifact inspection. Early, constrained; no live ingestion or production-complete claim. |
| [Role-and-opportunity-model](https://github.com/Prometheus-Frameworks/Role-and-opportunity-model#readme) | Packaged for testing | WR/TE role API and canonical role-opportunity envelope. Output depends on supplied governed inputs; proxies remain labeled. |
| [TIBER-Teamstate](https://github.com/Prometheus-Frameworks/TIBER-Teamstate#readme) | Packaged for testing | Team-environment pipeline and downstream snapshot contracts. Seed/sample artifacts do not establish current-week coverage. |
| [Age-curve-intelligence-model](https://github.com/Prometheus-Frameworks/Age-curve-intelligence-model#readme) | Packaged for testing | Age Context v1 upload/run/results app and exports. Context only; modifiers are provisional, not standalone valuations. |
| [ARC](https://github.com/Prometheus-Frameworks/ARC#readme) | Packaged for testing | Historical cohort and baseline CLI with validated handoff format. Requires historical input; research scope. |
| [Signal-Validation-Model](https://github.com/Prometheus-Frameworks/Signal-Validation-Model#readme) | Packaged for testing | Historical WR ingestion, labels, comparisons and case studies. No production forecasting or predictive-power claim. |
| [TIBER-Strategy](https://github.com/Prometheus-Frameworks/TIBER-Strategy#readme) | Available to use — vocabulary artifact | Versioned dynasty ontology. Fantasy consumption is read-only diagnostics; player classification/advice remain inactive. |
| [TIBER-Research](https://github.com/Prometheus-Frameworks/TIBER-Research#readme) | Packaged for testing | Offline custody validators and Research Gateway intake/read scaffold. Agent-entry is draft; validation does not activate research or promote findings. |
| [TIBER-Harness](https://github.com/Prometheus-Frameworks/TIBER-Harness#readme) | Packaged for testing | Offline MockProvider evaluation and opt-in local Ollama path. No production integration or real artifact promotion. |
| [TIBER-Ops](https://github.com/Prometheus-Frameworks/TIBER-Ops#readme) | Available to use — documentation | Operating map, architecture direction, lane coordination and review runbooks. Documentation does not activate parked work. |

<details>
<summary>September 21, 2026 source pins</summary>

All source reads succeeded. These pins identify inspected code/documentation, not deployments or mutable issue revisions.

| Repository | Inspected default-branch commit / README |
| --- | --- |
| TIBER-Data | [`6732954b17687d07226e7d5491291e2c2053217b`](https://github.com/Prometheus-Frameworks/TIBER-Data/blob/6732954b17687d07226e7d5491291e2c2053217b/README.md) |
| TIBER-Fantasy | [`71ca2a09482ed29c3ae878a050fc6f030d1bbd6c`](https://github.com/Prometheus-Frameworks/TIBER-Fantasy/blob/71ca2a09482ed29c3ae878a050fc6f030d1bbd6c/README.md) |
| TIBER-Rookies | [`a6f8555e79f3fc562a6c5f533acee583eeb12a3a`](https://github.com/Prometheus-Frameworks/TIBER-Rookies/blob/a6f8555e79f3fc562a6c5f533acee583eeb12a3a/README.md) |
| TIBER-Forecast | [`e295e3de745b676df571348cb8541fb5e35e3a02`](https://github.com/Prometheus-Frameworks/TIBER-Forecast/blob/e295e3de745b676df571348cb8541fb5e35e3a02/README.md) |
| TIBER-FORGE | [`31ef98393b6c86576442d79cd8996cac530b2fad`](https://github.com/Prometheus-Frameworks/TIBER-FORGE/blob/31ef98393b6c86576442d79cd8996cac530b2fad/README.md) |
| Role-and-opportunity-model | [`6435d8d3c2c4e53dc45ab57a05a2716e2b47598d`](https://github.com/Prometheus-Frameworks/Role-and-opportunity-model/blob/6435d8d3c2c4e53dc45ab57a05a2716e2b47598d/README.md) |
| TIBER-Teamstate | [`61485d1309484bad300378ef5d9aaa67365d3d62`](https://github.com/Prometheus-Frameworks/TIBER-Teamstate/blob/61485d1309484bad300378ef5d9aaa67365d3d62/README.md) |
| Age-curve-intelligence-model | [`998b28644be7d36efb235ce1df62113dd8f0350c`](https://github.com/Prometheus-Frameworks/Age-curve-intelligence-model/blob/998b28644be7d36efb235ce1df62113dd8f0350c/README.md) |
| ARC | [`b36fda874e699886a6184cb0340717a94724d6d7`](https://github.com/Prometheus-Frameworks/ARC/blob/b36fda874e699886a6184cb0340717a94724d6d7/README.md) |
| Signal-Validation-Model | [`0ba3d4bc3d9696aca8059052a9ff948046f0e2e1`](https://github.com/Prometheus-Frameworks/Signal-Validation-Model/blob/0ba3d4bc3d9696aca8059052a9ff948046f0e2e1/README.md) |
| TIBER-Strategy | [`03c840765af7f64a797a4bc8b0cba6bb8dce0d6f`](https://github.com/Prometheus-Frameworks/TIBER-Strategy/blob/03c840765af7f64a797a4bc8b0cba6bb8dce0d6f/README.md) |
| TIBER-Research | [`0952e3325fb610f9cdb22c5242397d223c7a6c26`](https://github.com/Prometheus-Frameworks/TIBER-Research/blob/0952e3325fb610f9cdb22c5242397d223c7a6c26/README.md) |
| TIBER-Harness | [`9280f5ace3a339221e5171ea9693225f9bec940d`](https://github.com/Prometheus-Frameworks/TIBER-Harness/blob/9280f5ace3a339221e5171ea9693225f9bec940d/README.md) |
| TIBER-Ops | [`14a9ea573200d64c5c8a335ef57f5da1a64e6dd7`](https://github.com/Prometheus-Frameworks/TIBER-Ops/blob/14a9ea573200d64c5c8a335ef57f5da1a64e6dd7/README.md) |

</details>

## Joining in

People and agent-assisted contributors are welcome. Start with the relevant repository’s README and operating instructions, then open a focused issue explaining what you want to build, what evidence it needs, and whether the work is a proposal, local experiment, fork implementation or upstream PR.

Link the exact code/artifact and validation results when reporting progress. A working fork can be useful without being an official upstream capability. Fork reports and issue comments do not establish upstream acceptance, release readiness or maintainer authorization.

For a small contribution, documentation corrections, reproducible bug reports and clearly scoped PRs are good entry points. For larger integrations, discuss the contract and owner first. Preserve missing-data states and leave final fantasy decisions with the user.

### Build from a research question

The [proposed experiment handoff in Ops #84](https://github.com/Prometheus-Frameworks/TIBER-Ops/issues/84) describes a useful starting point: state the question, owning repository, available tools/evidence, exact missing inputs, one bounded contribution, expected output and acceptance or falsification checks. Reproductions, counterevidence and methodology corrections are useful contributions too. [Research #3](https://github.com/Prometheus-Frameworks/TIBER-Research/issues/3) is an experiment-definition example, not evidence of a completed run or a current football conclusion.

Missing proprietary evidence stays missing. Access does not establish permission to redistribute inputs or publish derived results; preserve licensing, attribution, private/shared boundaries and verification limits. A handoff is not source admission or permission to execute, merge or deploy.

**Make TIBER useful to you.** The [selective-adoption proposal](https://github.com/Prometheus-Frameworks/TIBER-Ops/issues/84#issuecomment-5737830315) recognizes personal workflows, independent forks and bounded experiments as valid outcomes without requiring upstream adoption. Useful external work, reviewed work, selected upstream adoption and maintained/released functionality are distinct. Review alone creates no implementation or maintenance commitment. This remains proposed contributor guidance pending maintainer disposition.

## Keeping this page current

A daily evidence check is scheduled to prepare documentation updates for review. Publication still requires maintainer merge; this is not an unattended publishing system.

1. Check upstream default branches, relevant PR states and maintainer decisions. Distinguish issue-body plans from later implementation and acceptance evidence.
2. Update only supported claims. Link each changed milestone to its source; record exact validation scope and deployment evidence separately.
3. Refresh a row’s verification date only after checking it. If a source is inaccessible, retain its prior date and mark verification unavailable. A new date must never imply new progress.
4. Record “checked; no material change” when that is the result. Keep a short recent-changes section; Git history preserves older snapshots.
5. Keep this single canonical page in Fantasy. Other README files link here instead of maintaining competing status copies.

This is a navigation and status summary. Domain contracts stay with their owning repositories, and operational decisions remain with the maintainer.
