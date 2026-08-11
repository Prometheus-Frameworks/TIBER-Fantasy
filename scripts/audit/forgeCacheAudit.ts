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
 *   npx tsx scripts/audit/forgeCacheAudit.ts --check              # verify artifacts + report
 *   npx tsx scripts/audit/forgeCacheAudit.ts --offline            # regenerate the manifest only
 *   npx tsx scripts/audit/forgeCacheAudit.ts --observe-to <path>  # NEW guarded observation, new path
 *
 * There is deliberately no default mode. The 2026-08-09 cohort at
 * `docs/audits/assets/310-live-cohort-observed.json` is a **frozen, closed
 * observation** — byte-pinned by `--check` — and no invocation of this script
 * writes to it. `--offline` regenerates only the derived manifest from the
 * frozen bytes; `--observe-to` makes a new, separately dated observation
 * through the lineage guard at a new path, without touching the manifest.
 *
 * The manifest records the frozen cohort's committed path and complete-file
 * SHA-256, quotes its (superseded) historical wording verbatim, and carries the
 * audit's current claims — including the pre-lineage-guard evidence status that
 * bounds what the frozen rows can support.
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
import {
  CURRENT_SOURCE_DESCRIPTION,
  FROZEN_COHORT,
  OBSERVATION_EVIDENCE_STATUS,
  SUPERSEDED_TERMINAL_FINDING,
  TERMINAL_FINDING,
  reportComparisonProblems,
  rowIdentityFromCohortRow,
  rowIdentityFromResponseItem,
  unsupportedLineageClaims,
} from './forgeCacheAuditClaims';

// This file runs as ESM under tsx, so __dirname is unavailable.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');

const DEFAULT_BASE_URL = 'https://tiber-fantasy-production.up.railway.app';
const COHORT_RELATIVE_PATH = 'docs/audits/assets/310-live-cohort-observed.json';
const MANIFEST_RELATIVE_PATH = 'docs/audits/assets/310-cache-audit-manifest.json';
const REPORT_RELATIVE_PATH = 'docs/audits/2026-08-09-railway-forge-cache-audit.md';
const POSITIONS = ['QB', 'RB', 'WR', 'TE'] as const;
const GSIS_SHAPE = /^00-\d{7}$/;

/**
 * A cohort row as the audit reasons about it.
 *
 * The two identifiers are kept apart deliberately. Fantasy #313 made
 * `item.playerId` the **canonical public key and nothing else** — nullable when
 * identity does not resolve — and moved the producer's own key to
 * `item.identity.sourceId`. The static FORGE artifact is keyed on GSIS, so the
 * producer key is the only thing it can be joined on; recording `playerId` here
 * would put canonical keys (and empty strings for the unresolved rows) on the
 * join key's side and silently reduce the intersection.
 */
interface LiveRow {
  position: string;
  /** The producer's own identifier — the GSIS key, and the join key. */
  sourceId: string;
  sourceType: 'canonical' | 'gsis' | 'unknown';
  /**
   * The canonical public key, null when identity did not resolve, and
   * `undefined` when the observation predates the identity envelope entirely.
   */
  canonicalId?: string | null;
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

    for (const [index, item] of (body.items ?? []).entries()) {
      rows.push({
        position,
        ...rowIdentityFromResponseItem(item, `${position} item ${index}`),
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

/** Read a committed cohort file into rows, resolving each row's identity. */
function readCohortRows(cohort: any): LiveRow[] {
  return (cohort.rows ?? []).map((row: any, index: number) => ({
    ...row,
    ...rowIdentityFromCohortRow(row, `cohort row ${index}`),
  })) as LiveRow[];
}

/** Identity shape and duplication within the cache cohort. */
function auditIdentity(rows: LiveRow[]) {
  // Measured on the PRODUCER key. The canonical key is a different namespace
  // and is reported separately below rather than being averaged in with it.
  const ids = rows.map((row) => row.sourceId);
  const distinct = new Set(ids);
  const gsisShaped = ids.filter((id) => GSIS_SHAPE.test(id));
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);

  // "Not recorded" is not "none resolved": the frozen observation predates the
  // identity envelope, so it says so rather than publishing a 0% coverage that
  // was never measured.
  const canonicalRecorded = rows.some((row) => row.canonicalId !== undefined);
  const canonicalCoverage = canonicalRecorded
    ? {
        recorded: true as const,
        resolved: rows.filter((row) => typeof row.canonicalId === 'string' && row.canonicalId !== '').length,
        unresolved: rows.filter((row) => row.canonicalId === null).length,
      }
    : {
        recorded: false as const,
        reason: 'observation predates the per-item identity envelope; canonical state was not observed',
      };

  return {
    identifierField: 'source_id',
    identifierNote:
      'The producer’s own key, as recorded by the observation. Since Fantasy #313 a ranking ' +
      'item’s playerId is the canonical public key and is null when unresolved, so it is not ' +
      'this measurement and is not the join key.',
    canonicalCoverage,
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
  // Joined on the producer key. The static artifact is GSIS-keyed, so a
  // canonical key on this side would match nothing and be reported as a genuine
  // zero intersection.
  const liveIds = new Set(rows.map((r) => r.sourceId));
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
    // When the lineages ARE joinable, publish the comparison rather than
    // leaving the section empty. This is descriptive only: it reports where the
    // two artifacts agree and differ on shared identifiers. It deliberately
    // does NOT attribute those differences to a cause — the cache still lacks
    // the lineage that would make causal attribution possible, which is what
    // the terminal finding is about.
    descriptiveComparison: joinBlockers.length === 0
      ? describeJoinedRows(rows, staticRows)
      : { status: 'unavailable_lineages_not_joinable' },
  };
}

/**
 * Descriptive comparison across shared identifiers.
 *
 * Reports agreement and spread on the rows both artifacts describe. No causal
 * claim is made or implied: a difference here says the two artifacts disagree,
 * not why, and the cache cannot answer why.
 */
function describeJoinedRows(rows: LiveRow[], staticRows: any[]) {
  const liveById = new Map(rows.map((row) => [row.sourceId, row]));
  const joined = staticRows
    .filter((row) => liveById.has(row.player_id))
    .map((row) => {
      const live = liveById.get(row.player_id)!;
      const staticAlpha = typeof row.forge_alpha === 'number' ? row.forge_alpha : null;
      const cacheAlpha = typeof live.alpha === 'number' ? live.alpha : null;
      return {
        // Named for what it is. Both sides of this join are producer GSIS keys;
        // a bare `playerId` here would read as the canonical public key, which
        // is the confusion this manifest exists to keep straight.
        gsisPlayerId: row.player_id,
        playerName: live.playerName || row.player_name,
        position: live.position,
        staticAlpha,
        cacheAlpha,
        delta: staticAlpha !== null && cacheAlpha !== null
          ? Number((cacheAlpha - staticAlpha).toFixed(2))
          : null,
      };
    });

  const deltas = joined.map((r) => r.delta).filter((d): d is number => d !== null);
  const sorted = [...deltas].sort((a, b) => a - b);
  const absolute = deltas.map(Math.abs);

  return {
    status: 'available',
    note:
      'Descriptive only. Reports where the two artifacts agree and differ on shared ' +
      'identifiers; it does not attribute any difference to a cause, because the cache ' +
      'does not persist the lineage that would support attribution.',
    joinKey: 'gsis_player_id',
    joinedRows: joined.length,
    comparableRows: deltas.length,
    exactAgreement: deltas.filter((d) => d === 0).length,
    within1: absolute.filter((d) => d <= 1).length,
    within5: absolute.filter((d) => d <= 5).length,
    // An even-length sample has no single middle element. Taking
    // `sorted[n/2]` returns the upper of the two, which is a different
    // statistic that happens to coincide only when n is odd — with the 50
    // joined rows here it published -2.74 instead of -3.215.
    medianDelta: median(sorted),
    minDelta: sorted.length ? sorted[0] : null,
    maxDelta: sorted.length ? sorted[sorted.length - 1] : null,
    largestAbsoluteDeltas: [...joined]
      .filter((r) => r.delta !== null)
      .sort((a, b) => Math.abs(b.delta!) - Math.abs(a.delta!))
      .slice(0, 10),
  };
}

/**
 * The median of an ascending numeric sample.
 *
 * Even-length samples average the two middle values; there is no single middle
 * element to pick, and picking one silently reports a different statistic.
 */
function median(sorted: readonly number[]): number | null {
  if (!sorted.length) return null;
  const mid = sorted.length / 2;
  return sorted.length % 2
    ? sorted[Math.floor(mid)]
    : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(3));
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

/**
 * Build the manifest — the audit's CURRENT-claims document.
 *
 * The frozen cohort file is an input here, never an output. Its bytes are the
 * dated 2026-08-09 observation, wording and all, and correcting a claim never
 * rewrites the record that made it: the manifest quotes the superseded wording,
 * states the supersession, and carries the neutral current claims alongside.
 */
function buildManifest(cohortText: string, staticRaw: Buffer, staticArtifact: any) {
  const cohort = JSON.parse(cohortText);
  const rows = readCohortRows(cohort);
  const cohortSha256 = sha256(cohortText);

  const manifest = {
    // Same investigation as the frozen cohort. This is the audit's subject
    // question — "what is the lineage of the Railway forge_grade_cache?" —
    // not an attribution of the observed rows; the claim scanner exempts it
    // on exactly that ground.
    audit: 'railway_forge_grade_cache_lineage',
    issue: 'Prometheus-Frameworks/TIBER-Fantasy#310',
    artifact: 'cache_audit_manifest',
    observation: {
      observed_at: cohort.observation.observed_at,
      // The manifest's OWN description of the request: what was asked, and the
      // explicit statement that the responder was not recorded. The frozen
      // file's differing wording is quoted and superseded in `frozen_cohort`.
      source_description: CURRENT_SOURCE_DESCRIPTION,
      base_url: cohort.observation.base_url,
      season: AUDIT_SEASON,
      as_of_week: AUDIT_WEEK,
      positions: [...POSITIONS],
      per_position: cohort.observation.per_position,
      production_mutations: 'none',
      database_access: 'none',
      evidence_status: OBSERVATION_EVIDENCE_STATUS,
    },
    // The frozen historical record: complete-file pin plus the exact wording
    // being superseded, kept verbatim so the correction has a paper trail.
    frozen_cohort: {
      committed_path: FROZEN_COHORT.committed_path,
      sha256: FROZEN_COHORT.sha256,
      observed_at: FROZEN_COHORT.observed_at,
      row_count: FROZEN_COHORT.row_count,
      superseded_source_description: FROZEN_COHORT.superseded_source_description,
      supersession_note:
        'The frozen file’s source_description asserts "(which serves Railway ' +
        'forge_grade_cache)". That attribution was an inference, not an observation: ' +
        'the capture predates the lineage guard and records no serving layer. The ' +
        'file is preserved byte-for-byte as the dated record; this manifest’s own ' +
        'source_description and evidence_status carry the supportable claim.',
    },
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
      //
      // Named for the OBSERVED COHORT, not for a producer. The superseded name
      // asserted proven legacy-cache origin in its own wording — the exact
      // attribution the capture cannot support. Quarantine is the policy
      // response to insufficient provenance, not a verdict about which
      // producer answered.
      terminal_finding: TERMINAL_FINDING,
      superseded_finding_name: SUPERSEDED_TERMINAL_FINDING,
      status: 'classified_for_quarantine',
      quarantine_basis: 'insufficient_provenance',
      quarantine_is_not: 'a finding that the cohort was served by any particular producer path',
      enforced_by_this_audit: false,
      enforcement_owner: 'Prometheus-Frameworks/TIBER-Fantasy#307 Phase B',
      required_disposition:
        'Must not occupy a canonical or current ranking mode; may remain reachable as clearly labelled 2025 legacy diagnostic/review data.',
    },
  };

  return { manifestJson: canonicalJson(manifest), manifest };
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
  const manifestText = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(manifestText);
  const cohort = JSON.parse(cohortText);

  // --- derived-findings equivalence ---------------------------------------
  // The pins below check individual fields. That is necessary but not
  // sufficient: a hand-edited median, clamping count or comparability verdict
  // sits in none of them and would pass. So rebuild the WHOLE expected
  // manifest from the frozen inputs — the pinned cohort bytes plus the
  // digest-pinned static artifact — and require the committed one to equal it.
  // Every derived finding is then verified by construction, and the pins
  // remain as targeted diagnostics that name the specific violation.
  const staticPathForRebuild = path.join(
    repoRoot,
    typeof manifest.staticArtifact?.path === 'string'
      ? manifest.staticArtifact.path
      : 'server/artifacts/external/forge/forge_player_static_v1.json',
  );
  if (!fs.existsSync(staticPathForRebuild)) {
    problems.push(`static artifact is missing at ${path.relative(repoRoot, staticPathForRebuild)}`);
  } else {
    try {
      const staticRaw = fs.readFileSync(staticPathForRebuild);
      const rebuilt = buildManifest(cohortText, staticRaw, JSON.parse(staticRaw.toString()));
      if (rebuilt.manifestJson !== manifestText) {
        problems.push(
          'committed manifest does not match the manifest rebuilt from the frozen cohort and the ' +
          'static artifact — a derived finding has been edited, or the inputs changed without ' +
          'regenerating (run --offline)',
        );
        // Name the diverging top-level sections so the failure is actionable
        // rather than a wall of JSON.
        for (const key of Object.keys(rebuilt.manifest)) {
          if (canonicalJson((rebuilt.manifest as any)[key]) !== canonicalJson(manifest[key])) {
            problems.push(`  diverging section: ${key}`);
          }
        }
        for (const key of Object.keys(manifest)) {
          if (!(key in rebuilt.manifest)) problems.push(`  unexpected section: ${key}`);
        }
      }
    } catch (error) {
      problems.push(`could not rebuild the manifest for comparison: ${(error as Error).message}`);
    }
  }

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

  // --- the frozen observation ---------------------------------------------
  // The complete-file pin. The cohort is the dated 2026-08-09 record and is
  // never rewritten — not to fix wording, not to attach a status, not to
  // re-observe. Any byte moving here is a policy violation, not drift.
  const actualCohortSha = sha256(cohortText);
  if (actualCohortSha !== FROZEN_COHORT.sha256) {
    problems.push(
      `the frozen cohort file has been modified (pinned ${FROZEN_COHORT.sha256.slice(0, 8)}…, ` +
      `actual ${actualCohortSha.slice(0, 8)}…) — this observation is closed; a new guarded ` +
      'observation must be a new dated artifact at a new path',
    );
  }
  if (cohort.observation?.observed_at !== FROZEN_COHORT.observed_at) {
    problems.push('the frozen cohort observed_at does not match the pinned capture instant');
  }
  if (manifest.frozen_cohort?.sha256 !== FROZEN_COHORT.sha256) {
    problems.push('manifest does not pin the frozen cohort digest');
  }
  // The superseded wording must be quoted VERBATIM from the frozen file: a
  // paraphrase would let the supersession drift from what was actually said.
  if (manifest.frozen_cohort?.superseded_source_description !== cohort.observation?.source_description) {
    problems.push('manifest superseded_source_description is not a verbatim quote of the frozen cohort wording');
  }

  // --- current claims ------------------------------------------------------
  const status = manifest.observation?.evidence_status;
  if (!status) {
    problems.push('manifest carries no observation evidence_status; the cohort predates the lineage guard and must say so');
  } else if (status.status !== OBSERVATION_EVIDENCE_STATUS.status) {
    problems.push(
      `manifest declares evidence_status "${status.status}"; this observation is closed as ` +
      `"${OBSERVATION_EVIDENCE_STATUS.status}" and may not be reclassified without a new, guarded observation`,
    );
  } else if (canonicalJson(status) !== canonicalJson(OBSERVATION_EVIDENCE_STATUS)) {
    problems.push('manifest evidence_status has been edited away from the canonical closed status');
  }

  if (manifest.observation?.source_description !== CURRENT_SOURCE_DESCRIPTION) {
    problems.push('manifest source_description is not the neutral current description');
  }

  // No current assertion may attribute the frozen bytes to a producer path.
  // Runs over the WHOLE manifest, not just the observation envelope; the
  // exemptions (investigation title, verbatim quotes, disclaimers) are an
  // explicit named list in forgeCacheAuditClaims.ts.
  for (const claim of unsupportedLineageClaims(manifest)) {
    problems.push(`manifest: ${claim}`);
  }

  if (manifest.disposition?.terminal_finding !== TERMINAL_FINDING) {
    problems.push(
      `manifest terminal_finding is "${manifest.disposition?.terminal_finding}"; expected "${TERMINAL_FINDING}" — ` +
      'the finding may not be renamed back to a form that asserts a proven producer origin',
    );
  }

  // --- report consistency --------------------------------------------------
  // The report is prose about an audit OF forge_grade_cache, so a blanket term
  // scan would drown in legitimate mentions. What is enforced instead: the
  // neutral finding is present; the superseded name appears only in
  // supersession context; and the report quotes the frozen digest and the
  // corrected median rather than stale values.
  const reportPath = path.join(repoRoot, REPORT_RELATIVE_PATH);
  if (!fs.existsSync(reportPath)) {
    problems.push(`audit report is missing at ${REPORT_RELATIVE_PATH}`);
  } else {
    const report = fs.readFileSync(reportPath, 'utf8');
    if (!report.includes(TERMINAL_FINDING)) {
      problems.push('report does not state the neutral terminal finding');
    }
    for (const [index, line] of report.split('\n').entries()) {
      if (line.includes(SUPERSEDED_TERMINAL_FINDING) && !/supersed|renamed|previous|historical/i.test(line)) {
        problems.push(
          `report line ${index + 1} uses the superseded finding name outside a supersession context`,
        );
      }
    }
    if (!report.includes(FROZEN_COHORT.sha256.slice(0, 8))) {
      problems.push('report does not quote the frozen cohort digest');
    }
    // Report consistency is checked against the CURRENT manifest's descriptive
    // comparison, not a fixed literal. A hardcoded `-3.215` would silently stop
    // meaning anything the moment the comparison legitimately changed — the
    // report could then drift from the manifest while --check still passed.
    //
    // It is also checked ROW BY ROW rather than as a substring sweep of the
    // whole document. `report.includes('0')` matches any zero anywhere — a
    // date, a GSIS id, an alpha in the disagreement table — so the summary
    // cells could be rewritten and --check would still say "report consistent".
    for (const problem of reportComparisonProblems(report, manifest.comparability?.descriptiveComparison)) {
      problems.push(problem);
    }
    if (!report.includes(OBSERVATION_EVIDENCE_STATUS.status)) {
      problems.push('report does not state the observation evidence status');
    }
  }

  // The static FORGE artifact is a DEPENDENCY of the published comparability
  // findings, not just a path reference. Without hashing it here, --check
  // reported success while #318 replaced those bytes underneath the manifest
  // and silently invalidated every conclusion derived from them.
  const staticRelPath = manifest.staticArtifact?.path;
  if (typeof staticRelPath !== 'string') {
    problems.push('manifest does not record the static artifact path');
  } else {
    const staticAbsPath = path.join(repoRoot, staticRelPath);
    if (!fs.existsSync(staticAbsPath)) {
      problems.push(`static artifact is missing at ${staticRelPath}`);
    } else {
      const actual = createHash('sha256').update(fs.readFileSync(staticAbsPath)).digest('hex');
      if (actual !== manifest.staticArtifact?.sha256) {
        problems.push(
          `static artifact bytes at ${staticRelPath} no longer match the digest the findings were derived from ` +
          `(recorded ${String(manifest.staticArtifact?.sha256).slice(0, 8)}…, actual ${actual.slice(0, 8)}…) — ` +
          'regenerate the static-dependent findings',
        );
      }
    }
  }

  return { ok: problems.length === 0, problems };
}

async function main() {
  const check = process.argv.includes('--check');
  const offline = process.argv.includes('--offline');
  const observeTo = arg('observe-to', '');

  if (check) {
    const result = verifyCommitted(REPO_ROOT);
    if (result.ok) {
      console.log(
        'committed audit artifacts agree: counts, positions, timestamps and digest all match; ' +
        `frozen cohort intact (${FROZEN_COHORT.sha256.slice(0, 8)}…, ${FROZEN_COHORT.row_count} rows, ` +
        `${FROZEN_COHORT.observed_at}); evidence status "${OBSERVATION_EVIDENCE_STATUS.status}"; ` +
        `no unsupported lineage claim; terminal finding "${TERMINAL_FINDING}"; report consistent.`,
      );
      process.exit(0);
    }
    console.error('committed audit artifacts DISAGREE:');
    for (const problem of result.problems) console.error(`  - ${problem}`);
    process.exit(1);
    return;
  }

  if (offline) {
    // Regenerates DERIVED findings only. The frozen cohort is an input and is
    // never written; only the manifest moves.
    const cohortText = fs.readFileSync(path.join(REPO_ROOT, COHORT_RELATIVE_PATH), 'utf8');
    const actualSha = sha256(cohortText);
    if (actualSha !== FROZEN_COHORT.sha256) {
      console.error(
        `refusing to regenerate: the cohort at ${COHORT_RELATIVE_PATH} does not match the frozen ` +
        `digest (pinned ${FROZEN_COHORT.sha256.slice(0, 8)}…, actual ${actualSha.slice(0, 8)}…). ` +
        'Restore the frozen file first; the observation is closed and may not be edited.',
      );
      process.exit(1);
    }

    const staticPath = path.join(REPO_ROOT, 'server/artifacts/external/forge/forge_player_static_v1.json');
    const staticRaw = fs.readFileSync(staticPath);
    const staticArtifact = JSON.parse(staticRaw.toString());

    const { manifestJson, manifest } = buildManifest(cohortText, staticRaw, staticArtifact);
    fs.writeFileSync(path.join(REPO_ROOT, MANIFEST_RELATIVE_PATH), manifestJson);

    console.log(`offline: reused the frozen cohort (${FROZEN_COHORT.row_count} rows observed ${FROZEN_COHORT.observed_at}).`);
    console.log(`Wrote ${MANIFEST_RELATIVE_PATH} (the frozen cohort was not touched)`);
    console.log(`terminal_finding=${manifest.disposition.terminal_finding} (classified, not enforced)`);
    return;
  }

  if (observeTo) {
    // A NEW observation is a new dated artifact. It must go to a new path,
    // passes every response through the lineage guard (so the serving layer is
    // recorded this time), and does not touch the frozen cohort or the
    // manifest — superseding the closed observation is an operator decision,
    // not a side effect of running a script.
    if (path.normalize(observeTo) === path.normalize(COHORT_RELATIVE_PATH)) {
      console.error(`refusing: ${COHORT_RELATIVE_PATH} is the frozen 2026-08-09 observation and may not be overwritten.`);
      process.exit(1);
    }
    const target = path.join(REPO_ROOT, observeTo);
    if (fs.existsSync(target)) {
      console.error(`refusing: ${observeTo} already exists; a new observation needs a new dated path.`);
      process.exit(1);
    }
    const baseUrl = arg('base-url', DEFAULT_BASE_URL);
    const { rows, perPosition } = await fetchLiveCohort(baseUrl);
    const observedAt = new Date().toISOString();
    const cohort = {
      audit: 'railway_forge_grade_cache_lineage',
      issue: 'Prometheus-Frameworks/TIBER-Fantasy#310',
      artifact: 'observed_cache_cohort',
      observation: {
        observed_at: observedAt,
        source_description: CURRENT_SOURCE_DESCRIPTION.replace(
          'The responding producer path was not recorded at capture time.',
          'Captured through the lineage guard; per_position records the serving layer.',
        ),
        base_url: baseUrl,
        season: AUDIT_SEASON,
        as_of_week: AUDIT_WEEK,
        positions: [...POSITIONS],
        per_position: perPosition,
        production_mutations: 'none',
        database_access: 'none',
      },
      row_count: rows.length,
      by_position: Object.fromEntries(POSITIONS.map((p) => [p, rows.filter((r) => r.position === p).length])),
      rows,
    };
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, canonicalJson(cohort));
    console.log(`Wrote NEW observation to ${observeTo} (${rows.length} rows). The frozen cohort and manifest are unchanged.`);
    return;
  }

  console.error(
    'No mode given. The 2026-08-09 observation is closed and cannot be re-captured by default.\n' +
    '  --check                verify the committed artifacts and report\n' +
    '  --offline              regenerate the manifest from the frozen cohort (cohort untouched)\n' +
    '  --observe-to <path>    make a NEW guarded observation at a new dated path',
  );
  process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
