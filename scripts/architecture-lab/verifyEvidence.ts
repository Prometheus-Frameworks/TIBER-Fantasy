/**
 * Re-check the Architecture Lab fixture against local clones (TIBER-Fantasy #434).
 *
 *   npx tsx scripts/architecture-lab/verifyEvidence.ts <dir-with-sibling-clones>
 *
 * <dir> holds one clone per seed repository, named as on GitHub (TIBER-Data,
 * Role-and-opportunity-model, …). TIBER-Fantasy itself is read from this
 * checkout. Everything is read with `git show <pinned-commit>:<path>`, so the
 * result does not depend on what a clone currently has checked out, only on
 * the pinned commit being present.
 *
 * It checks three things:
 *   1. every file evidence path exists at its node's pinned commit, and any
 *      line anchor is within the file;
 *   2. the specific lines the fixture's findings lean on still say what the
 *      fixture claims;
 *   3. the three byte-parity replays behind the `test_verified` edges.
 *
 * Read-only: it runs `git cat-file` / `git show` and nothing else. It is a
 * manual tool, not part of CI, and it proves nothing about runtime behaviour.
 */
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import path from 'path';
import { ARCHITECTURE_GRAPH } from '../../client/src/pages/architectureLab/graphFixture';
import type { RepoId } from '../../client/src/pages/architectureLab/types';

const clonesDir = process.argv[2];
if (!clonesDir) {
  console.error('usage: npx tsx scripts/architecture-lab/verifyEvidence.ts <dir-with-sibling-clones>');
  process.exit(2);
}

const nodes = new Map(ARCHITECTURE_GRAPH.nodes.map((n) => [n.id, n]));
const repoDir = (id: RepoId) =>
  id === 'fantasy' ? process.cwd() : path.join(clonesDir, nodes.get(id)!.ownerRepo.split('/')[1]);

const git = (id: RepoId, args: string[]): Buffer =>
  execFileSync('git', ['-C', repoDir(id), ...args], { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 });

const show = (id: RepoId, file: string): Buffer => git(id, ['show', `${nodes.get(id)!.sourceCommit}:${file}`]);
const sha256 = (buffer: Buffer) => createHash('sha256').update(buffer).digest('hex');

let failures = 0;
let checks = 0;
const report = (ok: boolean, label: string, detail = '') => {
  checks += 1;
  if (!ok) failures += 1;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? ` — ${detail}` : ''}`);
};

// 1. Paths and line anchors.
const seen = new Set<string>();
for (const item of [...ARCHITECTURE_GRAPH.nodes, ...ARCHITECTURE_GRAPH.edges]) {
  for (const evidence of item.evidence) {
    if (evidence.kind !== 'file') continue;
    const key = `${evidence.repo}:${evidence.path}:${evidence.line ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const type = git(evidence.repo, ['cat-file', '-t', `${nodes.get(evidence.repo)!.sourceCommit}:${evidence.path}`]).toString().trim();
      if (evidence.line && type === 'blob') {
        const lines = show(evidence.repo, evidence.path).toString('utf8').split('\n').length;
        report(evidence.line <= lines, `path ${key}`, evidence.line <= lines ? '' : `file has only ${lines} lines`);
      } else {
        report(!evidence.line, `path ${key}`, evidence.line ? 'line anchor on a directory' : type);
      }
    } catch {
      report(false, `path ${key}`, 'not found at pinned commit (or commit not present in clone)');
    }
  }
}

// 2. Lines the findings lean on.
const lineChecks: { repo: RepoId; file: string; line: number; includes: string }[] = [
  { repo: 'fantasy', file: 'server/modules/externalModels/forge/forgeClient.ts', line: 8, includes: '/v1/forge/evaluations' },
  { repo: 'forge', file: 'src/app.ts', line: 268, includes: '/api/forge/evaluate' },
  { repo: 'data', file: 'src/api.py', line: 185, includes: '/api/compatibility/player-role-profiles' },
  { repo: 'rop', file: 'src/upstream/tiberDataClient.ts', line: 40, includes: '/api/compatibility/player-role-profiles' },
  { repo: 'rop', file: 'src/config/service.ts', line: 23, includes: 'localhost' },
  { repo: 'rop', file: 'src/app.ts', line: 86, includes: '/api/role-opportunity' },
  { repo: 'fantasy', file: 'server/modules/externalModels/roleOpportunity/roleOpportunityClient.ts', line: 10, includes: '/api/role-opportunity' },
  { repo: 'forecast', file: 'src/api/routes/tiberScoring.ts', line: 45, includes: '/api/tiber/weekly/player-card' },
  { repo: 'fantasy', file: 'server/modules/externalModels/scoring/scoringServiceClient.ts', line: 180, includes: '/api/tiber/weekly/player-card' },
  { repo: 'fantasy', file: 'server/modules/externalModels/scoring/fantasyForecastWeeklyPlayerV1Adapter.ts', line: 50, includes: "'routes_pg', 'targets_pg', 'carries_pg'" },
  { repo: 'forecast', file: 'src/experiments/forwardRun1/forwardRun1AdmissionBinding.ts', line: 1126, includes: 'role-and-opportunity' },
  { repo: 'forecast', file: 'src/contracts/weeklyForecastPublication.ts', line: 550, includes: 'explanatory_context_only' },
  { repo: 'forecast', file: 'src/experiments/forwardBaseEval/forwardBaseFreezeRecord.ts', line: 110, includes: 'role_and_opportunity' },
  { repo: 'forecast', file: 'src/experiments/forwardBaseEval/forwardBaseFreezeRecord.ts', line: 109, includes: 'teamstate' },
  { repo: 'forge', file: 'src/services/playerStaticArtifactService.ts', line: 267, includes: 'Point Prediction' },
  { repo: 'fantasy', file: 'server/modules/externalModels/scoring/scoringRequestMappers.ts', line: 51, includes: 'buildScoringPlayerInputFromData' },
  { repo: 'fantasy', file: 'server/modules/externalModels/playerOwnership/playerOwnershipClient.ts', line: 18, includes: 'DEFAULT_LATEST_ARTIFACT_PATH' },
  { repo: 'forecast', file: 'src/rehearsal/runRun2GovernedTeamstateValueBinding.ts', line: 25, includes: 'RUN2_BINDING_JOIN_KEYS' },
  { repo: 'forecast', file: 'src/rehearsal/rookieTransitionProfileMirror.ts', line: 12, includes: 'INERT' },
  { repo: 'forecast', file: 'src/datasets/seasonal/loadSeasonalPprDataset.ts', line: 6, includes: 'player_weekly_ppr_outcomes_v1' },
  { repo: 'teamstate', file: 'src/adapters/teamWeekRawV0GovernedAdapter.ts', line: 2, includes: 'team_week_raw_v0' },
  { repo: 'forecast', file: 'src/datasets/seasonal/tiberDataSeasonalPprDataset.ts', line: 9, includes: 'scaffold-only' },
  { repo: 'forge', file: 'src/config/env.ts', line: 31, includes: '../TIBER-Data/' },
  { repo: 'data', file: 'src/team_state/contract.py', line: 38, includes: 'tiber_team_state_v0_1' },
  { repo: 'fantasy', file: 'server/modules/externalModels/teamState/types.ts', line: 1, includes: 'tiber_team_state_v0_1' },
  { repo: 'fantasy', file: 'server/modules/externalModels/teamState/teamEnvironmentMovementClient.ts', line: 26, includes: 'TIBER-Teamstate' },
  { repo: 'fantasy', file: 'server/modules/externalModels/rookies/rookieArtifactClient.ts', line: 5, includes: 'TIBER-Rookies' },
  { repo: 'data', file: 'docs/repo-boundaries-and-feedback-loops.md', line: 92, includes: 'Point Prediction' },
  { repo: 'fantasy', file: 'README.md', line: 39, includes: 'MCP connector is currently private' },
  { repo: 'fantasy', file: 'CLAUDE.md', line: 48, includes: 'TIBER-Ops #66' },
];
for (const check of lineChecks) {
  try {
    const text = show(check.repo, check.file).toString('utf8').split('\n')[check.line - 1] ?? '';
    report(text.includes(check.includes), `line ${check.repo}:${check.file}:${check.line}`, text.includes(check.includes) ? '' : `expected to contain "${check.includes}"`);
  } catch {
    report(false, `line ${check.repo}:${check.file}:${check.line}`, 'unreadable');
  }
}

// Absence claims.
const grepCount = (id: RepoId, pattern: string, pathspec: string): number => {
  try {
    return git(id, ['grep', '-I', '-i', '-l', '-E', pattern, nodes.get(id)!.sourceCommit, '--', pathspec]).toString().trim().split('\n').filter(Boolean).length;
  } catch {
    return 0; // git grep exits 1 when nothing matches
  }
};
report(grepCount('forge', '/v1/forge/evaluations', 'src') === 0, 'absence: FORGE src/ has no /v1/forge/evaluations route');
report(
  grepCount('forge', 'forecast|point.prediction|teamstate|team_state|role.and.opportunity|role_opportunity|rookie', 'src') === 1,
  'absence: FORGE src/ mentions Forecast / Teamstate / Role & Opportunity / Rookies in exactly one file (the disclaimer)',
);
report(
  grepCount('forecast', 'role.and.opportunity|role_opportunity|roleOpportunity|WeeklyRoleState', 'src') === 2,
  'absence: Forecast src/ mentions Role & Opportunity in exactly two files (both exclusions)',
);
report(
  grepCount('research', 'tiber-fantasy|tiber-forecast|tiber-teamstate|role-and-opportunity|tiber-rookies|tiber-forge|tiber-data', 'src') === 0 &&
    grepCount('research', 'tiber-fantasy|tiber-forecast|tiber-teamstate|role-and-opportunity|tiber-rookies|tiber-forge|tiber-data', 'scripts') === 0,
  'absence: Research src/ and scripts/ reference no other seed repository',
);

// 3. Byte-parity replays.
const same = (a: [RepoId, string], b: [RepoId, string]) => sha256(show(...a)) === sha256(show(...b));
try {
  report(
    same(['data', 'exports/promoted/identity_crosswalk/tiber_identity_crosswalk_v1.json'], ['fantasy', 'server/artifacts/external/identity/tiber_identity_crosswalk_v1.json']),
    'replay: identity crosswalk v1 is byte-identical',
  );
  const upstream = JSON.parse(show('data', 'exports/promoted/identity_crosswalk/tiber_identity_crosswalk_v2.json').toString('utf8'));
  const bundled = JSON.parse(show('fantasy', 'server/artifacts/external/identity/tiber_identity_crosswalk_v2.json').toString('utf8'));
  const canonical = (rows: Record<string, unknown>[]) => new Set(rows.map((r) => JSON.stringify(Object.keys(r).sort().map((k) => [k, r[k]]))));
  const up = canonical(upstream.records);
  const down = canonical(bundled.records);
  const downOnly = Array.from(down).filter((r) => !up.has(r)).length;
  report(
    upstream.record_count === 94 && bundled.record_count === 68 && downOnly === 0 && up.size - down.size === 26,
    'replay: identity crosswalk v2 bundled copy is a strict 68-of-94 subset',
    `upstream ${up.size}, bundled ${down.size}, bundled-only ${downOnly}`,
  );
  report(
    same(['forge', 'exports/promoted/forge_player_static/forge_player_static_v1.json'], ['fantasy', 'server/artifacts/external/forge/forge_player_static_v1.json']),
    'replay: forge_player_static_v1 is byte-identical',
  );
  const vendored = 'server/modules/externalModels/scoring/contracts/fantasyForecastWeeklyPlayerV1';
  for (const name of ['manifest.v1.json', 'fantasy_forecast_weekly_player_request.v1.schema.json', 'fantasy_forecast_weekly_player_card_response.v1.schema.json']) {
    report(same(['forecast', `data/contracts/fantasyForecastWeeklyPlayerV1/${name}`], ['fantasy', `${vendored}/${name}`]), `replay: forecast contract ${name} is byte-identical`);
  }
} catch (error) {
  report(false, 'replay', (error as Error).message.split('\n')[0]);
}

console.log(`\n${checks - failures}/${checks} checks passed.`);
process.exit(failures === 0 ? 0 : 1);
