/**
 * Architecture Lab seed graph (TIBER-Fantasy #434).
 *
 * Hand-curated on 2026-11-11 by reading the nine repositories at the commits
 * pinned below. Nothing here is discovered automatically and nothing refreshes
 * itself: when a pinned repository moves, this file is stale until someone
 * re-reads the evidence and bumps the pin.
 *
 * Rules this file follows (enforced by validateGraph in graphLogic.ts):
 * - every non-unknown edge carries at least one evidence item and a checkedAt date;
 * - file evidence resolves to a blob URL at the owning node's pinned commit;
 * - `test_verified` requires a `replay` record of what was re-run;
 * - `runtime_verified` is not used: no running system was observed for this fixture.
 */
import type { ArchitectureGraph, Evidence, GraphEdge, GraphNode, RepoId } from './types';

const CHECKED_AT = '2026-11-11';

const file = (
  repo: RepoId,
  path: string,
  label: string,
  side: 'producer' | 'consumer' | 'doctrine',
  line?: number,
): Evidence => ({ kind: 'file', repo, path, label, side, ...(line ? { line } : {}) });

const record = (url: string, label: string): Evidence => ({ kind: 'record', url, label, side: 'doctrine' });

const FEEDBACK_DOCTRINE = file(
  'data',
  'docs/repo-boundaries-and-feedback-loops.md',
  'Feedback-loop doctrine: "Good loop" layer order',
  'doctrine',
  92,
);

export const NODES: GraphNode[] = [
  {
    id: 'data',
    label: 'TIBER-Data',
    ownerRepo: 'Prometheus-Frameworks/TIBER-Data',
    layer: 'contracts',
    role: 'Contract and architecture authority. Governed source data, canonical identity, provenance and promoted handoff artifacts.',
    lifecycle: 'active',
    sourceCommit: '7a13fda31356ec0fcb11e100157a3ff95156ecb4',
    sourceCommitDate: '2026-11-09T11:33:40-05:00',
    owns: [
      'Canonical contracts (src/contracts/v1)',
      'Identity crosswalk and player ownership exports',
      'team_week_raw_v0, NFL draft results, weekly PPR outcomes',
      'Architecture governance documents',
    ],
    evidence: [
      file('data', 'docs/governance/architecture/tiber-architecture-document-v1.0.md', 'TIBER Architecture Document v1.0', 'doctrine'),
      file('data', 'docs/repo-boundaries-and-feedback-loops.md', 'Repo boundaries and feedback loops', 'doctrine'),
      file('data', 'src/contracts/v1/index.ts', 'Contract index', 'producer'),
    ],
  },
  {
    id: 'teamstate',
    label: 'TIBER-Teamstate',
    ownerRepo: 'Prometheus-Frameworks/TIBER-Teamstate',
    layer: 'reality',
    role: 'Team-environment interpretation and governed historical reports.',
    lifecycle: 'active',
    sourceCommit: 'f22d80953b2bff217deb5077b39d0cfd400f1ca4',
    sourceCommitDate: '2026-10-06T06:53:02-04:00',
    owns: ['Team state pipeline', 'team_environment_movement_v1', 'team_environment_forecast_features_v1 shape bridge'],
    evidence: [file('teamstate', 'README.md', 'README', 'doctrine')],
  },
  {
    id: 'rop',
    label: 'Role & Opportunity',
    ownerRepo: 'Prometheus-Frameworks/Role-and-opportunity-model',
    layer: 'reality',
    role: 'Player-level interpretation of usage, deployment and opportunity (WR/TE role API).',
    lifecycle: 'active',
    sourceCommit: 'b93783d7e8f07777d672acdb2a8cec15c28af5a0',
    sourceCommitDate: '2026-10-06T06:52:12-04:00',
    owns: ['Role-opportunity API', 'WeeklyRoleStateV1 contract and builder', 'Role-opportunity lab export'],
    evidence: [file('rop', 'README.md', 'README', 'doctrine')],
  },
  {
    id: 'rookies',
    label: 'TIBER-Rookies',
    ownerRepo: 'Prometheus-Frameworks/TIBER-Rookies',
    layer: 'reality',
    role: 'Rookie evidence, models, boards and promoted rookie artifacts.',
    lifecycle: 'active',
    sourceCommit: '19a4fc6062035ab9edda53422685d172e4cab3c8',
    sourceCommitDate: '2026-10-25T10:15:52-04:00',
    owns: ['Rookie Alpha producer and exports', 'rookie_transition_profile', 'Export validation'],
    evidence: [file('rookies', 'README.md', 'README', 'doctrine')],
  },
  {
    id: 'forecast',
    label: 'TIBER-Forecast',
    ownerRepo: 'Prometheus-Frameworks/TIBER-Forecast',
    layer: 'projection',
    role: 'Forecasting and scoring utilities. Outputs are model inference, not observed truth. Formerly Point-Prediction-Model (PPM); the architecture document still uses the old name.',
    lifecycle: 'active',
    sourceCommit: 'd1589866ac585a463da7ac9c46f295f413816bd8',
    sourceCommitDate: '2026-10-06T06:51:23-04:00',
    owns: ['Scoring service routes (/api/tiber/*)', 'fantasy_forecast.weekly_player v1 contract', 'Seasonal PPR backtest'],
    evidence: [
      file('forecast', 'README.md', 'README', 'doctrine'),
      file('data', 'docs/governance/architecture/tiber-architecture-document-v1.0.md', 'Architecture document lists it as Point-Prediction-Model', 'doctrine'),
    ],
  },
  {
    id: 'forge',
    label: 'TIBER-FORGE',
    ownerRepo: 'Prometheus-Frameworks/TIBER-FORGE',
    layer: 'adjudication',
    role: 'Archived standalone grading and ranking code. The doctrine describes an adjudication layer here; the repository is archived.',
    lifecycle: 'archived',
    sourceCommit: 'b2fe7c88fab900345b0bc5b72c9ec78e9a2bcb44',
    sourceCommitDate: '2026-10-06T06:52:27-04:00',
    owns: ['Deterministic grading over ForgeWeeklyPlayerInput', 'forge_player_static_v1 export'],
    evidence: [
      file('forge', 'TRUTH_SOURCES.md', 'Truth sources and failure boundaries', 'doctrine'),
      file('fantasy', 'README.md', 'TIBER-Fantasy README: "Archived standalone grading and ranking code"', 'doctrine'),
    ],
    notes:
      'Retention of the embedded engine in TIBER-Fantasy and the future of this repository are open operator decisions (TIBER-Ops #88). This node makes no ruling on them.',
  },
  {
    id: 'fantasy',
    label: 'TIBER-Fantasy',
    ownerRepo: 'Prometheus-Frameworks/TIBER-Fantasy',
    layer: 'product',
    role: 'Downstream product, API and UI shell. Consumes promoted read-only outputs through adapters under server/modules/externalModels/.',
    lifecycle: 'active',
    sourceCommit: 'ee937153fb49bef0be59703ef0cc9711b84d4ede',
    sourceCommitDate: '2026-10-30T18:29:53-04:00',
    owns: ['User-facing surfaces and APIs', 'External model adapter layer', 'Legacy embedded model modules (transitional)'],
    evidence: [
      file('fantasy', 'server/modules/externalModels/MODULE.md', 'External model adapter layer', 'consumer'),
      file('fantasy', 'AGENTS.md', 'AGENTS.md §1 repo purpose', 'doctrine'),
    ],
  },
  {
    id: 'research',
    label: 'TIBER-Research',
    ownerRepo: 'Prometheus-Frameworks/TIBER-Research',
    layer: 'offflow',
    role: 'Research notebook: football investigations, research records and supporting protocols.',
    lifecycle: 'active',
    sourceCommit: '9bc0736cb7f1d255424bb84f09d177754b90c718',
    sourceCommitDate: '2026-11-04T19:49:48-05:00',
    owns: ['Research records and studies', 'Offline custody validators', 'Research Gateway scaffold'],
    evidence: [file('research', 'README.md', 'README', 'doctrine')],
    notes:
      'No evidence-backed declared data edge to or from this repository was found in this pass. Its src/ and scripts/ contain no reference to the other seed repositories; one test fixture names TIBER-Data as an owner string, which is not an integration.',
  },
  {
    id: 'ops',
    label: 'TIBER-Ops',
    ownerRepo: 'Prometheus-Frameworks/TIBER-Ops',
    layer: 'offflow',
    role: 'Cross-repository coordination, operating state and operator governance. Carries no football data.',
    lifecycle: 'active',
    sourceCommit: '32afebf04982da182904fc0628666bcb4226aab5',
    sourceCommitDate: '2026-10-06T06:52:24-04:00',
    owns: ['Lane index and operator gate', 'Merge checklist and runbooks', 'Current-state registry v0 (descriptive, pilot-scoped)'],
    evidence: [
      file('ops', 'docs/lane-index.md', 'Lane index', 'doctrine'),
      file('ops', 'registry/tiber-current-state.v0.json', 'Current-state registry v0', 'doctrine'),
    ],
  },
];

const NOT_RUNTIME_ARTIFACT =
  'A reader and a committed artifact exist. Whether any deployment has the artifact mounted, enabled and fresh was not observed.';
const NOT_RUNTIME_HTTP =
  'Client and route code exist. No base URL, deployment or live request was observed, so reachability and current responses are unknown.';

export const EDGES: GraphEdge[] = [
  // ── TIBER-Data → TIBER-Fantasy ───────────────────────────────────────────
  {
    id: 'data-fantasy-identity-crosswalk',
    from: 'data',
    to: 'fantasy',
    kind: 'data_flow',
    interfaceKind: 'bundled artifact',
    contract: 'tiber_identity_crosswalk_v1 / v2',
    verification: 'test_verified',
    checkedAt: CHECKED_AT,
    flags: ['stale_copy'],
    evidence: [
      file('data', 'exports/promoted/identity_crosswalk/tiber_identity_crosswalk_v2.json', 'Promoted v2 export (94 records)', 'producer'),
      file('data', 'exports/promoted/identity_crosswalk/tiber_identity_crosswalk_v1.json', 'Promoted v1 export', 'producer'),
      file('fantasy', 'server/artifacts/external/identity/tiber_identity_crosswalk_v2.json', 'Bundled v2 copy (68 records)', 'consumer'),
      file('fantasy', 'server/modules/externalModels/identity/tiberIdentityCrosswalkClient.ts', 'Crosswalk client', 'consumer'),
    ],
    replay: {
      method: 'SHA-256 and record-set comparison of the bundled copies against the producer exports at both pinned commits.',
      result:
        'v1 is byte-identical (5ce5cd3f…). v2 differs: the bundled copy (generated 2026-08-09, 68 records) is a strict subset of the producer export (generated 2026-09-13, 94 records); 26 producer records are absent downstream, none are downstream-only.',
      performedAt: CHECKED_AT,
    },
    proves: 'The bundled crosswalk bytes originate from TIBER-Data, and the v2 copy in TIBER-Fantasy trails the producer by 26 records.',
    doesNotProve:
      'Which file a deployment actually loads (an env override can point elsewhere), or that the 26 missing records matter to any surface.',
  },
  {
    id: 'data-fantasy-player-ownership',
    from: 'data',
    to: 'fantasy',
    kind: 'data_flow',
    interfaceKind: 'artifact file',
    contract: 'player_ownership_v0 (latest-state artifact)',
    verification: 'source_inspected',
    checkedAt: CHECKED_AT,
    flags: [],
    evidence: [
      file('data', 'exports/promoted/player_ownership/player_ownership_latest.json', 'Promoted latest-state export', 'producer'),
      file('data', 'scripts/ingest_player_ownership.py', 'Ownership ingest script', 'producer'),
      file('fantasy', 'server/modules/externalModels/playerOwnership/playerOwnershipClient.ts', 'Ownership client', 'consumer', 18),
    ],
    proves: 'TIBER-Fantasy has a reader for the artifact TIBER-Data exports under the same name.',
    doesNotProve: NOT_RUNTIME_ARTIFACT,
  },
  {
    id: 'data-fantasy-team-state',
    from: 'data',
    to: 'fantasy',
    kind: 'data_flow',
    interfaceKind: 'artifact file',
    contract: 'tiber_team_state_v0_1',
    verification: 'source_inspected',
    checkedAt: CHECKED_AT,
    flags: [],
    evidence: [
      file('data', 'src/team_state/contract.py', 'Artifact name check', 'producer', 38),
      file('fantasy', 'server/modules/externalModels/teamState/types.ts', 'TEAM_STATE_ARTIFACT_NAME', 'consumer', 1),
      file('fantasy', 'server/modules/externalModels/teamState/teamStateClient.ts', 'Team state client', 'consumer'),
    ],
    proves: 'Both sides name the same artifact, and the consumer validates its required keys.',
    doesNotProve: `${NOT_RUNTIME_ARTIFACT} The consumer's default directory (data/team-state) holds no committed artifact.`,
  },

  // ── TIBER-Data → reality-layer producers ─────────────────────────────────
  {
    id: 'data-teamstate-team-week-raw',
    from: 'data',
    to: 'teamstate',
    kind: 'data_flow',
    interfaceKind: 'artifact file',
    contract: 'team_week_raw_v0',
    verification: 'source_inspected',
    checkedAt: CHECKED_AT,
    flags: [],
    evidence: [
      file('data', 'src/contracts/v1/teamWeekRawV0.ts', 'Contract definition', 'producer'),
      file('teamstate', 'src/adapters/teamWeekRawV0GovernedAdapter.ts', 'Governed-source adapter', 'consumer', 2),
    ],
    proves: 'Teamstate has an adapter written against the contract TIBER-Data defines, accepting governance only from explicit upstream markers.',
    doesNotProve: 'That a governed real-input run has happened. TIBER_NOW (2026-10-10) records real-input execution as unestablished.',
  },
  {
    id: 'data-rop-compatibility-api',
    from: 'data',
    to: 'rop',
    kind: 'data_flow',
    interfaceKind: 'http',
    contract: 'GET /api/compatibility/player-role-profiles · team-opportunity-context',
    verification: 'source_inspected',
    checkedAt: CHECKED_AT,
    flags: [],
    evidence: [
      file('data', 'src/api.py', 'Compatibility route', 'producer', 185),
      file('rop', 'src/upstream/tiberDataClient.ts', 'Upstream client paths', 'consumer', 40),
      file('rop', 'src/config/service.ts', 'TIBER_DATA_BASE_URL (defaults to localhost)', 'consumer', 23),
    ],
    proves: 'The route the client calls exists in the producer source under the same path.',
    doesNotProve: `${NOT_RUNTIME_HTTP} The client's default base URL is localhost.`,
  },
  {
    id: 'data-rookies-draft-results',
    from: 'data',
    to: 'rookies',
    kind: 'data_flow',
    interfaceKind: 'artifact file',
    contract: 'nfl_draft_results_{year}.json',
    verification: 'source_inspected',
    checkedAt: CHECKED_AT,
    flags: [],
    evidence: [
      file('data', 'src/contracts/v1/nflDraftResults.ts', 'Contract definition', 'producer'),
      file('rookies', 'scripts/ingest_draft_results_from_tiber_data.py', 'Ingestion seam', 'consumer'),
      file('rookies', 'tests/test_ingest_draft_results_from_tiber_data.py', 'Ingest tests (not run here)', 'consumer'),
    ],
    proves: 'A manual ingestion script maps TIBER-Data draft facts into the Rookies schema and rejects fixture-only rows.',
    doesNotProve: 'When, or whether, the script was last run against a real upstream file. It is operator-invoked with an explicit --upstream path.',
  },
  {
    id: 'data-forecast-weekly-ppr-outcomes',
    from: 'data',
    to: 'forecast',
    kind: 'data_flow',
    interfaceKind: 'artifact file',
    contract: 'player_weekly_ppr_outcomes_v1',
    verification: 'source_inspected',
    checkedAt: CHECKED_AT,
    flags: ['fixture_only'],
    evidence: [
      file('data', 'src/export/playerWeeklyPprOutcomesArtifact.ts', 'Artifact exporter', 'producer'),
      file('forecast', 'src/datasets/seasonal/loadSeasonalPprDataset.ts', 'Weekly-outcome loader', 'consumer', 6),
      file('forecast', 'src/datasets/seasonal/tiberDataSeasonalPprDataset.ts', 'Default dataset is a bundled scaffold', 'consumer', 9),
    ],
    proves: 'Forecast has a loader for the artifact TIBER-Data exports.',
    doesNotProve:
      'Governed consumption. The default dataset is built from a bundled scaffold and is labelled `fixture`, never `governed`, in the source itself.',
  },
  {
    id: 'data-forge-weekly-player-input',
    from: 'data',
    to: 'forge',
    kind: 'data_flow',
    interfaceKind: 'artifact file',
    contract: 'ForgeWeeklyPlayerInput',
    verification: 'source_inspected',
    checkedAt: CHECKED_AT,
    flags: ['archived_producer', 'fixture_only'],
    evidence: [
      file('data', 'src/contracts/v1/forgeWeeklyPlayerInput.ts', 'Contract definition', 'producer'),
      file('forge', 'TRUTH_SOURCES.md', 'Names the contract as highest authority', 'consumer'),
      file('forge', 'src/config/env.ts', 'Default path: sibling TIBER-Data sample artifact', 'consumer', 31),
    ],
    proves: 'FORGE reads a TIBER-Data contract; its default inputs are sample and offline-fixture artifacts in a sibling checkout.',
    doesNotProve: 'Any live ingestion. The consumer repository is archived.',
  },

  // ── Reality layer → Forecast ─────────────────────────────────────────────
  {
    id: 'teamstate-forecast-team-week-values',
    from: 'teamstate',
    to: 'forecast',
    kind: 'data_flow',
    interfaceKind: 'rehearsal binding',
    contract: 'Teamstate team-week values → run2 governed value binding',
    verification: 'source_inspected',
    checkedAt: CHECKED_AT,
    flags: ['fixture_only'],
    evidence: [
      file('teamstate', 'src/pipeline/teamEnvironmentForecastFeaturesV1.ts', 'Forecast-features shape bridge', 'producer'),
      file('forecast', 'src/rehearsal/runRun2GovernedTeamstateValueBinding.ts', 'Value binding and join keys', 'consumer', 25),
      file('forecast', 'tests/run2GovernedTeamstateValueBinding.test.ts', 'Binding tests (not run here)', 'consumer'),
      file('forecast', 'src/experiments/forwardBaseEval/forwardBaseFreezeRecord.ts', "Excluded feature families include 'teamstate'", 'consumer', 109),
    ],
    proves: 'Forecast contains rehearsal code that binds Teamstate team-week aggregates to player-season rows, with explicit join keys.',
    doesNotProve:
      "That Teamstate values feed any published forecast. The code lives under src/rehearsal and is exercised by fixtures, and the forward base freeze record lists 'teamstate' among its excluded feature families.",
  },
  {
    id: 'rookies-forecast-transition-profile',
    from: 'rookies',
    to: 'forecast',
    kind: 'data_flow',
    interfaceKind: 'mirrored artifact',
    contract: 'rookie_transition_profile_v0.2.0 (inert mirror)',
    verification: 'source_inspected',
    checkedAt: CHECKED_AT,
    flags: ['inert'],
    evidence: [
      file('rookies', 'exports/promoted/rookie-transition-profile', 'Promoted export directory', 'producer'),
      file('forecast', 'src/rehearsal/rookieTransitionProfileMirror.ts', 'Inert mirror module', 'consumer', 12),
    ],
    proves: 'Forecast mirrors the promoted Rookies profile byte-for-byte behind source-lock checks.',
    doesNotProve:
      "Any model use. The mirror declares itself inert: every field family is audit_only, with no feature extraction, experiment or production binding. The forward base freeze record also excludes 'rookie_transition_features'.",
  },
  {
    id: 'rop-forecast-doctrine',
    from: 'rop',
    to: 'forecast',
    kind: 'data_flow',
    interfaceKind: 'none found',
    contract: 'Role & Opportunity signals as forecast inputs',
    verification: 'documented_intent',
    checkedAt: CHECKED_AT,
    flags: ['contradicted_by_source'],
    evidence: [
      FEEDBACK_DOCTRINE,
      file('forecast', 'src/experiments/forwardRun1/forwardRun1AdmissionBinding.ts', 'Admission note: no role-and-opportunity family admitted', 'consumer', 1126),
      file('forecast', 'src/experiments/forwardBaseEval/forwardBaseFreezeRecord.ts', "Excluded feature families include 'role_and_opportunity'", 'consumer', 110),
    ],
    proves: 'The doctrine places Role & Opportunity upstream of point prediction.',
    doesNotProve:
      'An implemented interface. Role & Opportunity is mentioned in two files under Forecast src/, and both exclude it: an admission note and a list of excluded feature families.',
  },

  // ── Forecast ⇄ Fantasy ───────────────────────────────────────────────────
  {
    id: 'forecast-fantasy-weekly-player-card',
    from: 'forecast',
    to: 'fantasy',
    kind: 'data_flow',
    interfaceKind: 'http + vendored contract',
    contract: 'fantasy_forecast.weekly_player v1 — card response',
    verification: 'test_verified',
    checkedAt: CHECKED_AT,
    flags: [],
    evidence: [
      file('forecast', 'data/contracts/fantasyForecastWeeklyPlayerV1/manifest.v1.json', 'Frozen contract manifest', 'producer'),
      file('forecast', 'src/api/routes/tiberScoring.ts', 'POST /api/tiber/weekly/player-card', 'producer', 45),
      file('fantasy', 'server/modules/externalModels/scoring/contracts/fantasyForecastWeeklyPlayerV1/VENDOR_PROVENANCE.json', 'Vendor provenance', 'consumer'),
      file('fantasy', 'server/modules/externalModels/scoring/scoringServiceClient.ts', 'Scoring service client', 'consumer', 180),
    ],
    replay: {
      method: 'SHA-256 comparison of the vendored manifest and both schemas against data/contracts/fantasyForecastWeeklyPlayerV1 at the pinned Forecast commit.',
      result: 'All three files are byte-identical (manifest d0196df8…, request schema c8f6ea3b…, response schema 91b29afa…).',
      performedAt: CHECKED_AT,
    },
    proves: 'TIBER-Fantasy validates against the exact contract bytes Forecast publishes, and the route it calls exists in Forecast source.',
    doesNotProve: `${NOT_RUNTIME_HTTP} Byte parity of a contract says nothing about whether a scoring service is up or what it returns.`,
  },
  {
    id: 'fantasy-forecast-weekly-player-request',
    from: 'fantasy',
    to: 'forecast',
    kind: 'data_flow',
    interfaceKind: 'http + vendored contract',
    contract: 'fantasy_forecast.weekly_player v1 — request (league context + routes_pg, targets_pg, carries_pg)',
    verification: 'source_inspected',
    checkedAt: CHECKED_AT,
    flags: ['downstream_supplies_inputs'],
    evidence: [
      file('fantasy', 'server/modules/externalModels/scoring/fantasyForecastWeeklyPlayerV1Adapter.ts', 'Contract-legal opportunity fields', 'consumer', 50),
      file('fantasy', 'server/modules/externalModels/scoring/scoringRequestMappers.ts', 'Opportunity fields averaged from the TIBER-Fantasy database', 'consumer', 51),
      file('forecast', 'data/contracts/fantasyForecastWeeklyPlayerV1/fantasy_forecast_weekly_player_request.v1.schema.json', 'Frozen request schema', 'producer'),
    ],
    proves:
      'The request TIBER-Fantasy builds carries per-player opportunity averages computed from its own weekly_stats table, alongside league context.',
    doesNotProve:
      'A recursion. The fields are observed-stat aggregates, not model outputs, as far as the mapper shows. Where weekly_stats is sourced from was not traced.',
    notes:
      'With the response edge this forms a two-repository cycle in the graph, because the product repository supplies football inputs to the projection layer. See cycle review candidates.',
  },

  // ── Other producers → Fantasy ────────────────────────────────────────────
  {
    id: 'teamstate-fantasy-environment-movement',
    from: 'teamstate',
    to: 'fantasy',
    kind: 'data_flow',
    interfaceKind: 'artifact file',
    contract: 'team_environment_movement_v1 (v0 fallback)',
    verification: 'source_inspected',
    checkedAt: CHECKED_AT,
    flags: [],
    evidence: [
      file('teamstate', 'src/contracts/teamEnvironmentMovementV1.ts', 'Producer-owned contract', 'producer'),
      file('teamstate', 'src/pipeline/teamEnvironmentMovementV1.ts', 'Artifact builder', 'producer'),
      file('fantasy', 'server/modules/externalModels/teamState/teamEnvironmentMovementClient.ts', 'Default path: sibling TIBER-Teamstate/output', 'consumer', 26),
    ],
    proves: 'The consumer reads the artifact name the producer builds, for Data Lab inspection only.',
    doesNotProve: `${NOT_RUNTIME_ARTIFACT} The default path assumes a sibling checkout on the same disk.`,
  },
  {
    id: 'rop-fantasy-role-opportunity-api',
    from: 'rop',
    to: 'fantasy',
    kind: 'data_flow',
    interfaceKind: 'http (or exported artifact)',
    contract: 'POST /api/role-opportunity · GET /api/role-opportunity/lab',
    verification: 'source_inspected',
    checkedAt: CHECKED_AT,
    flags: [],
    evidence: [
      file('rop', 'src/app.ts', 'Route handlers', 'producer', 86),
      file('fantasy', 'server/modules/externalModels/roleOpportunity/roleOpportunityClient.ts', 'Client endpoint paths', 'consumer', 10),
    ],
    proves: 'Client paths match routes in the producer source.',
    doesNotProve: NOT_RUNTIME_HTTP,
  },
  {
    id: 'rookies-fantasy-rookie-alpha',
    from: 'rookies',
    to: 'fantasy',
    kind: 'data_flow',
    interfaceKind: 'artifact file',
    contract: '{season}_rookie_alpha_predraft_v0.json',
    verification: 'source_inspected',
    checkedAt: CHECKED_AT,
    flags: [],
    evidence: [
      file('rookies', 'exports/promoted/rookie-alpha/2026_rookie_alpha_predraft_v0.json', 'Promoted 2026 export', 'producer'),
      file('fantasy', 'server/modules/externalModels/rookies/rookieArtifactClient.ts', 'Default path: sibling TIBER-Rookies/exports', 'consumer', 5),
    ],
    proves: 'The file the consumer looks for exists in the producer repository for 2022–2026.',
    doesNotProve: `${NOT_RUNTIME_ARTIFACT} The artifact is not bundled in TIBER-Fantasy; the default path assumes a sibling checkout.`,
  },

  // ── FORGE ────────────────────────────────────────────────────────────────
  {
    id: 'forecast-forge-doctrine',
    from: 'forecast',
    to: 'forge',
    kind: 'data_flow',
    interfaceKind: 'none found',
    contract: 'Point prediction → FORGE adjudication',
    verification: 'documented_intent',
    checkedAt: CHECKED_AT,
    flags: ['contradicted_by_source', 'archived_producer'],
    evidence: [
      FEEDBACK_DOCTRINE,
      file('forecast', 'src/contracts/weeklyForecastPublication.ts', "forge_role: 'explanatory_context_only'", 'producer', 550),
      file('forge', 'src/services/playerStaticArtifactService.ts', 'Warning: no ROP or Point Prediction claims', 'consumer', 267),
    ],
    proves: 'The doctrine draws FORGE adjudicating forecast output.',
    doesNotProve:
      'Any code path. The only mention of Forecast, Teamstate, Role & Opportunity or Rookies in FORGE src/ is a warning string saying the static artifact makes no ROP or Point Prediction claims. FORGE is archived, and Forecast types FORGE as explanatory context only.',
  },
  {
    id: 'forge-fantasy-player-static',
    from: 'forge',
    to: 'fantasy',
    kind: 'data_flow',
    interfaceKind: 'bundled artifact',
    contract: 'forge_player_static_v1',
    verification: 'test_verified',
    checkedAt: CHECKED_AT,
    flags: ['archived_producer'],
    evidence: [
      file('forge', 'exports/promoted/forge_player_static/forge_player_static_v1.json', 'Promoted export', 'producer'),
      file('fantasy', 'server/artifacts/external/forge/forge_player_static_v1.json', 'Bundled copy', 'consumer'),
      file('fantasy', 'server/modules/externalModels/forge/forgePlayerStaticClient.ts', 'Static artifact client with digest check', 'consumer'),
    ],
    replay: {
      method: 'SHA-256 comparison of the bundled copy against the producer export at both pinned commits.',
      result: 'Byte-identical (de0e2c19…). Artifact generated_at is 2026-04-27; 50 rows.',
      performedAt: CHECKED_AT,
    },
    proves: 'The bundled artifact is exactly what the archived FORGE repository last promoted.',
    doesNotProve: 'Which surfaces read it at runtime, or that an April artifact is appropriate for any current use.',
  },
  {
    id: 'forge-fantasy-evaluations-http',
    from: 'forge',
    to: 'fantasy',
    kind: 'data_flow',
    interfaceKind: 'http',
    contract: 'External FORGE evaluation (migration compare path)',
    verification: 'source_inspected',
    checkedAt: CHECKED_AT,
    flags: ['interface_mismatch', 'archived_producer'],
    evidence: [
      file('fantasy', 'server/modules/externalModels/forge/forgeClient.ts', "Client default: POST /v1/forge/evaluations", 'consumer', 8),
      file('forge', 'src/app.ts', 'Producer route: POST /api/forge/evaluate', 'producer', 268),
    ],
    proves:
      "The consumer's default endpoint path does not appear anywhere in FORGE src/ at the pinned commit; the producer serves /api/forge/evaluate instead.",
    doesNotProve:
      'That the integration is broken in a deployment: FORGE_SERVICE_ENDPOINT_PATH can override the default. No deployment was observed either way.',
  },

  // ── Off-flow ─────────────────────────────────────────────────────────────
  {
    id: 'ops-fantasy-operator-gate',
    from: 'ops',
    to: 'fantasy',
    kind: 'governance',
    interfaceKind: 'governance',
    contract: 'Operator gate (Ops #66), merge checklist, lane index',
    verification: 'documented_intent',
    checkedAt: CHECKED_AT,
    flags: [],
    evidence: [
      file('fantasy', 'CLAUDE.md', 'Authority & Task Pickup cites TIBER-Ops #66', 'consumer', 48),
      file('ops', 'docs/lane-index.md', 'Lane index', 'doctrine'),
      record('https://github.com/Prometheus-Frameworks/TIBER-Ops/issues/66', 'TIBER-Ops #66 operator gate'),
    ],
    proves: 'TIBER-Fantasy instructions defer consequential transitions to the Ops operator gate.',
    doesNotProve: 'Enforcement. This is written process, not a technical control, and it carries no football data.',
  },
  {
    id: 'fantasy-research-league-context-candidate',
    from: 'fantasy',
    to: 'research',
    kind: 'candidate',
    interfaceKind: 'unknown',
    contract: 'League context reaching research studies through the private MCP connector',
    verification: 'unknown',
    flags: [],
    evidence: [file('fantasy', 'README.md', 'README: the TIBER MCP connector is currently private', 'doctrine', 39)],
    proves: 'Nothing. The README only says a connector exists and is private.',
    doesNotProve:
      'Everything about this link. No public source in either repository shows research records consuming TIBER-Fantasy output. It is drawn as an example of an unverified candidate.',
  },
];

export const ARCHITECTURE_GRAPH: ArchitectureGraph = {
  fixtureVersion: 'architecture-lab-seed-v0.1',
  checkedAt: CHECKED_AT,
  checkedBy: 'Claude (manual read of pinned sources for TIBER-Fantasy #434)',
  nodes: NODES,
  edges: EDGES,
};
