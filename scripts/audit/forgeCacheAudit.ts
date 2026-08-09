/**
 * Railway `forge_grade_cache` lineage audit (Fantasy #310).
 *
 * **Read-only with respect to production**: no database connection, no DDL, no
 * promotion, no artifact sync, no Railway/Replit mutation. It issues public HTTP
 * GETs against the Rankings v2 API (which serves the cache) and reads
 * repository files.
 *
 * It *does* write local audit artifacts under `docs/audits/assets/` — that is
 * its deliverable. "Read-only" here means read-only against production and the
 * database, not that the script writes nothing.
 *
 *   npx tsx scripts/audit/forgeCacheAudit.ts            # regenerate both artifacts
 *   npx tsx scripts/audit/forgeCacheAudit.ts --check    # verify committed artifacts agree
 *   npx tsx scripts/audit/forgeCacheAudit.ts --base-url https://<host>
 *
 * Regenerates **both** committed outputs, which back the findings in
 * `docs/audits/2026-08-09-railway-forge-cache-audit.md`:
 *   - `docs/audits/assets/310-cache-audit-manifest.json`
 *   - `docs/audits/assets/310-live-cohort-observed.json`
 *
 * The two are linked: the manifest records the cohort artifact's committed path
 * and its canonical SHA-256, and both carry the same observation timestamp and
 * source description, so a reader can tell they describe one observation.
 *
 * Scope note: the cache's *source* tables (position role banks,
 * `datadive_snapshot_player_week`) are not in this repository and this script
 * does not connect to a database. What it can establish is exactly what the
 * audit claims — no more.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { ALPHA_CALIBRATION } from '../../server/modules/forge/types';
import {
  AUDIT_SEASON,
  AUDIT_WEEK,
  assertForgeCacheResponse,
  type ObservedPositionSource,
} from './forgeCacheResponseGuard';

// This file runs as ESM under tsx, so __dirname is unavailable.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');

const DEFAULT_BASE_URL = 'https://tiber-fantasy-production.up.railway.app';
const COHORT_RELATIVE_PATH = 'docs/audits/assets/310-live-cohort-observed.json';
const MANIFEST_RELATIVE_PATH = 'docs/audits/assets/310-cache-audit-manifest.json';
const POSITIONS = ['QB', 'RB', 'WR', 'TE'] as const;
const GSIS_SHAPE = /^00-\d{7}$/;

interface LiveRow {
  position: string;
  playerId: string;
  playerName: string;
  team: string | null;
  alpha: number | null;
  rawAlpha: number | null;
  tier: string | null;
  gamesPlayed: number | null;
}

/** Canonical JSON so the cohort digest is stable across runs. */
function canonicalJson(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function normaliseName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

async function fetchLiveCohort(baseUrl: string) {
  const rows: LiveRow[] = [];
  const perPosition: Record<string, ObservedPositionSource> = {};

  for (const position of POSITIONS) {
    const url =
      `${baseUrl}/api/rankings/v2/weekly` +
      `?season=${AUDIT_SEASON}&position=${position}&asOfWeek=${AUDIT_WEEK}&limit=300`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${position}: HTTP ${response.status}`);
    const body: any = await response.json();

    perPosition[position] = assertForgeCacheResponse(position, body);

    for (const item of body.items ?? []) {
      rows.push({
        position,
        playerId: String(item.playerId ?? ''),
        playerName: String(item.playerName ?? ''),
        team: item.team ?? null,
        alpha: item.score ?? null,
        rawAlpha: item.value ?? null,
        tier: item.tier ?? null,
        gamesPlayed: item.uiMeta?.gamesPlayed ?? null,
      });
    }
  }
  return { rows, perPosition };
}

/** Identity shape and duplication within the cache cohort. */
function auditIdentity(rows: LiveRow[]) {
  const ids = rows.map((row) => row.playerId);
  const distinct = new Set(ids);
  const gsisShaped = ids.filter((id) => GSIS_SHAPE.test(id));
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);

  return {
    totalRows: ids.length,
    distinctIds: distinct.size,
    duplicateIds: Array.from(counts.entries()).filter(([, n]) => n > 1).map(([id]) => id),
    gsisShaped: gsisShaped.length,
    gsisShapedPct: Number(((gsisShaped.length / ids.length) * 100).toFixed(1)),
    nonGsisSamples: ids.filter((id) => !GSIS_SHAPE.test(id)).slice(0, 10),
    // Cross-surface resolvability needs the crosswalk table and is therefore
    // NOT assertable here. Fantasy #308 owns that measurement.
    crossSurfaceResolvability: 'unavailable_requires_database',
  };
}

/**
 * Alpha bound analysis.
 *
 * Answers audit question 6 from source: the bounds are declared in
 * ALPHA_CALIBRATION, so clamping is *designed*, not a cohort artifact. What the
 * cohort adds is how much of it is pinned at those bounds — a row sitting exactly
 * on the floor carries no ordering information relative to its floor-mates.
 */
function auditClamping(rows: LiveRow[]) {
  const byPosition: Record<string, unknown> = {};
  for (const position of POSITIONS) {
    const alphas = rows.filter((r) => r.position === position).map((r) => r.alpha).filter((a): a is number => a !== null);
    const calibration = (ALPHA_CALIBRATION as any)[position];
    const atFloor = alphas.filter((a) => a === calibration?.outMin).length;
    const atCeiling = alphas.filter((a) => a === calibration?.outMax).length;
    byPosition[position] = {
      n: alphas.length,
      min: Math.min(...alphas),
      max: Math.max(...alphas),
      declaredBounds: calibration ? { outMin: calibration.outMin, outMax: calibration.outMax, p10: calibration.p10, p90: calibration.p90 } : null,
      atFloor,
      atFloorPct: Number(((atFloor / alphas.length) * 100).toFixed(1)),
      atCeiling,
    };
  }
  return {
    verdict: 'designed_calibration_bound_not_cohort_artifact',
    evidence: 'server/modules/forge/types.ts ALPHA_CALIBRATION; applied by calibrateAlpha() in server/modules/forge/forgeGrading.ts',
    byPosition,
  };
}

/** Whether the two lineages can be compared at all. */
function auditComparability(rows: LiveRow[], staticArtifact: any) {
  const staticRows: any[] = staticArtifact.rows ?? [];
  const liveIds = new Set(rows.map((r) => r.playerId));
  const staticIds = staticRows.map((r) => r.player_id);

  const nameCounts = new Map<string, number>();
  for (const row of staticRows) {
    const key = normaliseName(row.player_name);
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
  }
  const ambiguousNames = Array.from(nameCounts.entries()).filter(([, n]) => n > 1);

  const generatedBaselineRows = staticRows.filter((row) =>
    Object.values(row.components ?? {}).some((c: any) => c?.evidence_status === 'generated_baseline'),
  );

  const directIdIntersection = staticIds.filter((id) => liveIds.has(id)).length;

  // Derived, not asserted. Emitting a literal `joinable: false` alongside a
  // freshly measured intersection makes the manifest contradict itself the
  // moment the producer artifact gains real identifiers — and would keep
  // suppressing a comparison that had become defensible.
  const joinBlockers: string[] = [];
  if (directIdIntersection === 0) {
    joinBlockers.push('zero direct identifier intersection between the two artifacts');
  }
  if (ambiguousNames.length > 0) {
    joinBlockers.push(
      'static artifact repeats player names across cohorts, so name is not a unique key within it either',
    );
  }

  return {
    directIdIntersection,
    liveNamespace: 'gsis',
    staticNamespaces: {
      fixture: staticIds.filter((id: string) => id.endsWith('-fixture')).length,
      other: staticIds.filter((id: string) => !id.endsWith('-fixture')).length,
    },
    staticAmbiguousNames: ambiguousNames.length,
    staticRowsUnderAmbiguousNames: ambiguousNames.reduce((sum, [, n]) => sum + n, 0),
    generatedBaselineRows: generatedBaselineRows.length,
    generatedBaselineTopAlphas: generatedBaselineRows
      .sort((a, b) => b.forge_alpha - a.forge_alpha)
      .slice(0, 5)
      .map((r) => ({ name: r.player_name, alpha: r.forge_alpha, evidence: 'generated_baseline_not_player_evidence' })),
    // A join is defensible only when no measured blocker remains.
    joinable: joinBlockers.length === 0,
    joinBlockers,
  };
}

/** What the cache would need to persist to be reproducible, and what it does. */
function auditProvenance() {
  const schema = fs.readFileSync(path.join(REPO_ROOT, 'shared/schema.ts'), 'utf8');
  const cacheBlock = schema.slice(schema.indexOf('export const forgeGradeCache'), schema.indexOf('export type ForgeGradeCache'));
  const required = [
    'input manifest',
    'source table snapshot identity',
    'source content hash',
    'evidence-freshness attestation',
    'builder commit / engine version pin',
  ];
  const present = {
    computedAt: cacheBlock.includes('computed_at'),
    version: cacheBlock.includes('version'),
    inputManifest: /manifest/i.test(cacheBlock),
    sourceHash: /hash|digest|sha/i.test(cacheBlock),
    snapshotIdentity: /snapshot_id/i.test(cacheBlock),
    evidenceFreshness: /evidence|as_of_source|source_as_of/i.test(cacheBlock),
    builderCommit: /commit|engine_version/i.test(cacheBlock),
  };
  return {
    requiredForReproducibility: required,
    persistedByCacheSchema: present,
    // computed_at answers "when was this recomputed", never "what was it computed from".
    canSeparateComputationFromEvidenceTime: present.evidenceFreshness,
    deterministicRecomputePossible: false,
    deterministicRecomputeBlockers: [
      'no builder commit or engine version pinned in the cache',
      'source tables (position role banks, datadive_snapshot_player_week) are not in this repository',
      'no source snapshot identity or content hash persisted',
    ],
  };
}

/** Observation envelope shared by both artifacts, so neither is an unexplained blob. */
function observationEnvelope(baseUrl: string, observedAt: string, perPosition: Record<string, ObservedPositionSource>) {
  return {
    audit: 'railway_forge_grade_cache_lineage',
    issue: 'Prometheus-Frameworks/TIBER-Fantasy#310',
    observation: {
      observed_at: observedAt,
      source_description:
        'Public HTTP GET of /api/rankings/v2/weekly (which serves Railway forge_grade_cache) ' +
        `for QB/RB/WR/TE at season=${AUDIT_SEASON}, asOfWeek=${AUDIT_WEEK}, limit=300.`,
      base_url: baseUrl,
      season: AUDIT_SEASON,
      as_of_week: AUDIT_WEEK,
      positions: [...POSITIONS],
      per_position: perPosition,
      production_mutations: 'none',
      database_access: 'none',
    },
  };
}

function buildArtifacts(baseUrl: string, observedAt: string, rows: LiveRow[], perPosition: any, staticRaw: Buffer, staticArtifact: any) {
  const envelope = observationEnvelope(baseUrl, observedAt, perPosition);

  const cohort = {
    ...envelope,
    artifact: 'observed_cache_cohort',
    row_count: rows.length,
    by_position: Object.fromEntries(POSITIONS.map((p) => [p, rows.filter((r) => r.position === p).length])),
    rows,
  };
  const cohortJson = canonicalJson(cohort);
  const cohortSha256 = sha256(cohortJson);

  const manifest = {
    ...envelope,
    artifact: 'cache_audit_manifest',
    // Link to the companion artifact by committed path *and* content digest, so
    // the two cannot silently drift apart.
    cohort_artifact: {
      committed_path: COHORT_RELATIVE_PATH,
      sha256: cohortSha256,
      row_count: rows.length,
    },
    cacheCohort: {
      rows: rows.length,
      byPosition: Object.fromEntries(POSITIONS.map((p) => [p, rows.filter((r) => r.position === p).length])),
      identity: auditIdentity(rows),
    },
    clamping: auditClamping(rows),
    staticArtifact: {
      path: 'server/artifacts/external/forge/forge_player_static_v1.json',
      sha256: createHash('sha256').update(staticRaw).digest('hex'),
      generatedAt: staticArtifact.generated_at,
      modelVersion: staticArtifact.model_version,
      rowCount: staticArtifact.row_count,
    },
    comparability: auditComparability(rows, staticArtifact),
    provenance: auditProvenance(),
    disposition: {
      // An audit classification, not an enforced runtime state. Nothing in this
      // PR changes the production consumer; enforcement is Fantasy #307 Phase B.
      terminal_finding: 'legacy_forge_cache_quarantined_insufficient_provenance',
      status: 'classified_for_quarantine',
      enforced_by_this_audit: false,
      enforcement_owner: 'Prometheus-Frameworks/TIBER-Fantasy#307 Phase B',
      required_disposition:
        'Must not occupy a canonical or current ranking mode; may remain reachable as clearly labelled 2025 legacy diagnostic/review data.',
    },
  };

  return { cohortJson, cohortSha256, manifestJson: canonicalJson(manifest), manifest };
}

/** Checks the two committed artifacts agree with each other. */
function verifyCommitted(repoRoot: string): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  const manifestPath = path.join(repoRoot, MANIFEST_RELATIVE_PATH);
  const cohortPath = path.join(repoRoot, COHORT_RELATIVE_PATH);

  if (!fs.existsSync(manifestPath) || !fs.existsSync(cohortPath)) {
    return { ok: false, problems: ['one or both committed artifacts are missing'] };
  }

  const cohortText = fs.readFileSync(cohortPath, 'utf8');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const cohort = JSON.parse(cohortText);

  if (sha256(cohortText) !== manifest.cohort_artifact?.sha256) {
    problems.push('cohort digest recorded in the manifest does not match the committed cohort bytes');
  }
  if (manifest.cohort_artifact?.committed_path !== COHORT_RELATIVE_PATH) {
    problems.push('manifest does not point at the committed cohort path');
  }
  if (manifest.cohort_artifact?.row_count !== cohort.row_count || cohort.rows.length !== cohort.row_count) {
    problems.push('row counts disagree between manifest, cohort envelope and cohort rows');
  }
  if (manifest.cacheCohort?.rows !== cohort.row_count) {
    problems.push('manifest cacheCohort.rows disagrees with the cohort row count');
  }
  for (const position of POSITIONS) {
    if (manifest.cacheCohort?.byPosition?.[position] !== cohort.by_position?.[position]) {
      problems.push(`position count disagrees for ${position}`);
    }
  }
  if (manifest.observation?.observed_at !== cohort.observation?.observed_at) {
    problems.push('observation timestamps disagree between the two artifacts');
  }
  if (manifest.observation?.source_description !== cohort.observation?.source_description) {
    problems.push('source descriptions disagree between the two artifacts');
  }

  return { ok: problems.length === 0, problems };
}

async function main() {
  const baseUrl = arg('base-url', DEFAULT_BASE_URL);
  const check = process.argv.includes('--check');

  if (check) {
    const result = verifyCommitted(REPO_ROOT);
    if (result.ok) {
      console.log('committed audit artifacts agree: counts, positions, timestamps and digest all match.');
      process.exit(0);
    }
    console.error('committed audit artifacts DISAGREE:');
    for (const problem of result.problems) console.error(`  - ${problem}`);
    process.exit(1);
    return;
  }

  const staticPath = path.join(REPO_ROOT, 'server/artifacts/external/forge/forge_player_static_v1.json');
  const staticRaw = fs.readFileSync(staticPath);
  const staticArtifact = JSON.parse(staticRaw.toString());

  const { rows, perPosition } = await fetchLiveCohort(baseUrl);
  const observedAt = new Date().toISOString();

  const { cohortJson, cohortSha256, manifestJson } = buildArtifacts(
    baseUrl, observedAt, rows, perPosition, staticRaw, staticArtifact,
  );

  fs.mkdirSync(path.join(REPO_ROOT, 'docs/audits/assets'), { recursive: true });
  fs.writeFileSync(path.join(REPO_ROOT, COHORT_RELATIVE_PATH), cohortJson);
  fs.writeFileSync(path.join(REPO_ROOT, MANIFEST_RELATIVE_PATH), manifestJson);

  console.log(`Wrote ${MANIFEST_RELATIVE_PATH}`);
  console.log(`Wrote ${COHORT_RELATIVE_PATH}`);
  console.log(`cohort=${rows.length} cohort_sha256=${cohortSha256}`);
  console.log('terminal_finding=legacy_forge_cache_quarantined_insufficient_provenance (classified, not enforced)');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
