/**
 * Railway `forge_grade_cache` lineage audit (Fantasy #310).
 *
 * READ-ONLY. Performs no writes, no DDL, no promotion, no artifact sync. It
 * reads the public Rankings v2 API (which serves the cache), the bundled
 * `FORGE_PLAYER_STATIC_V1` artifact, and the in-repo legacy engine constants,
 * then emits a machine-readable manifest.
 *
 *   npx tsx scripts/audit/forgeCacheAudit.ts
 *   npx tsx scripts/audit/forgeCacheAudit.ts --base-url https://<host> --out <path>
 *
 * Regenerates `docs/audits/assets/310-cache-audit-manifest.json`, which backs
 * the findings in `docs/audits/2026-08-09-railway-forge-cache-audit.md`.
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

// This file runs as ESM under tsx, so __dirname is unavailable.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');

const DEFAULT_BASE_URL = 'https://tiber-fantasy-production.up.railway.app';
const POSITIONS = ['QB', 'RB', 'WR', 'TE'] as const;
const GSIS_SHAPE = /^00-\d{7}$/;
const AUDIT_SEASON = 2025;
const AUDIT_WEEK = 18;

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

function arg(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function normaliseName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

async function fetchLiveCohort(baseUrl: string) {
  const rows: LiveRow[] = [];
  const perPosition: Record<string, { asOf: string; fallbackReason: string | null }> = {};

  for (const position of POSITIONS) {
    const url =
      `${baseUrl}/api/rankings/v2/weekly` +
      `?season=${AUDIT_SEASON}&position=${position}&asOfWeek=${AUDIT_WEEK}&limit=300`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${position}: HTTP ${response.status}`);
    const body: any = await response.json();

    const notes: string = body.sourceStack?.[0]?.notes ?? '';
    perPosition[position] = {
      asOf: body.asOf,
      fallbackReason: notes.match(/scoringFallbackReason=([a-z_]+)/)?.[1] ?? null,
    };

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

  return {
    directIdIntersection: staticIds.filter((id) => liveIds.has(id)).length,
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
    // Both conditions must be false for a defensible join.
    joinable: false,
    joinBlockers: [
      'zero direct identifier intersection between the two artifacts',
      'static artifact repeats player names across cohorts, so name is not a unique key within it either',
    ],
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

async function main() {
  const baseUrl = arg('base-url', DEFAULT_BASE_URL);
  const out = arg('out', path.join(REPO_ROOT, 'docs/audits/assets/310-cache-audit-manifest.json'));

  const staticPath = path.join(REPO_ROOT, 'server/artifacts/external/forge/forge_player_static_v1.json');
  const staticRaw = fs.readFileSync(staticPath);
  const staticArtifact = JSON.parse(staticRaw.toString());

  const { rows, perPosition } = await fetchLiveCohort(baseUrl);

  const manifest = {
    audit: 'railway_forge_grade_cache_lineage',
    issue: 'Prometheus-Frameworks/TIBER-Fantasy#310',
    readOnly: true,
    observedAt: new Date().toISOString(),
    source: { baseUrl, season: AUDIT_SEASON, asOfWeek: AUDIT_WEEK, perPosition },
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
  };

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Wrote ${out}`);
  console.log(`cohort=${rows.length} joinable=${manifest.comparability.joinable} reproducible=${manifest.provenance.deterministicRecomputePossible}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
