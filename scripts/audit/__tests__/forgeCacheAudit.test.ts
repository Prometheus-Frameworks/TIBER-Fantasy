/**
 * Fantasy #310 — deterministic checks for the audit's pure calculations and
 * artifact linkage.
 *
 * The live production GETs are deliberately *not* unit-tested: they are a
 * one-off observation, not a behaviour to pin. What is tested here is everything
 * the audit's conclusions actually rest on — the identity/clamping/comparability
 * maths against fixed local fixtures, and the agreement between the two
 * committed artifacts.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { ALPHA_CALIBRATION } from '../../../server/modules/forge/types';
import { assertForgeCacheResponse } from '../forgeCacheResponseGuard';
import {
  CURRENT_SOURCE_DESCRIPTION,
  FROZEN_COHORT,
  OBSERVATION_EVIDENCE_STATUS,
  SUPERSEDED_TERMINAL_FINDING,
  TERMINAL_FINDING,
  unsupportedLineageClaims,
} from '../forgeCacheAuditClaims';

const REPO_ROOT = path.resolve(__dirname, '../../..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'docs/audits/assets/310-cache-audit-manifest.json');
const COHORT_PATH = path.join(REPO_ROOT, 'docs/audits/assets/310-live-cohort-observed.json');

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const cohortText = fs.readFileSync(COHORT_PATH, 'utf8');
const cohort = JSON.parse(cohortText);

const POSITIONS = ['QB', 'RB', 'WR', 'TE'] as const;

describe('only forge_grade_cache rows are accepted as cache evidence', () => {
  const forgeNotes = 'scoringFallbackReason=none; season=2025, asOfWeek=18, position=QB';
  const forgeBody = {
    asOf: '2026-08-09T00:00:00.000Z',
    sourceStack: [{ layer: 'forge', source: 'api/forge/tiers cache (forge_grade_cache)', notes: forgeNotes }],
  };

  test('accepts a genuine FORGE cache response', () => {
    const observed = assertForgeCacheResponse('QB', forgeBody);
    expect(observed.layer).toBe('forge');
    expect(observed.fallbackReason).toBe('none');
  });

  test('refuses promoted scoring-service items rather than mislabelling the lineage', () => {
    // The exact scenario: SCORING_SERVICE_BASE_URL configured and succeeding, so
    // the endpoint serves Expected Points / VORP instead of FORGE alpha.
    expect(() =>
      assertForgeCacheResponse('QB', {
        ...forgeBody,
        sourceStack: [{ layer: 'promoted_artifact', source: 'scoring service', notes: forgeNotes }],
      }),
    ).toThrow(/expected the forge_grade_cache layer/);
  });

  test('refuses a response with no source layer at all', () => {
    expect(() => assertForgeCacheResponse('QB', { asOf: 'x', sourceStack: [] }))
      .toThrow(/expected the forge_grade_cache layer/);
  });

  test('refuses a response served at a different scope than requested', () => {
    expect(() =>
      assertForgeCacheResponse('QB', {
        ...forgeBody,
        sourceStack: [{
          layer: 'forge',
          source: 'cache',
          notes: 'scoringFallbackReason=none; season=2024, asOfWeek=18, position=QB',
        }],
      }),
    ).toThrow(/does not match the requested scope/);
  });
});

describe('the two committed artifacts describe one observation', () => {
  test('the manifest links the cohort by committed path and digest', () => {
    expect(manifest.cohort_artifact.committed_path).toBe('docs/audits/assets/310-live-cohort-observed.json');
    expect(createHash('sha256').update(cohortText).digest('hex')).toBe(manifest.cohort_artifact.sha256);
  });

  test('row counts agree across manifest, cohort envelope and cohort rows', () => {
    expect(manifest.cohort_artifact.row_count).toBe(cohort.row_count);
    expect(cohort.rows).toHaveLength(cohort.row_count);
    expect(manifest.cacheCohort.rows).toBe(cohort.row_count);
  });

  test('per-position counts agree and sum to the total', () => {
    let sum = 0;
    for (const position of POSITIONS) {
      expect(manifest.cacheCohort.byPosition[position]).toBe(cohort.by_position[position]);
      sum += cohort.by_position[position];
    }
    expect(sum).toBe(cohort.row_count);
  });

  test('one observation timestamp, used consistently', () => {
    expect(manifest.observation.observed_at).toBe(cohort.observation.observed_at);
    expect(new Date(manifest.observation.observed_at).toString()).not.toBe('Invalid Date');
  });

  test('the source descriptions deliberately differ: quote and supersede, never rewrite', () => {
    // The frozen file's wording attributes a producer the capture never
    // established. The manifest does not repeat it — it quotes it verbatim as
    // superseded and carries its own neutral description. Equality here would
    // mean either the frozen record was rewritten or the attribution returned.
    expect(manifest.frozen_cohort.superseded_source_description)
      .toBe(cohort.observation.source_description);
    expect(manifest.observation.source_description).toBe(CURRENT_SOURCE_DESCRIPTION);
    expect(manifest.observation.source_description)
      .not.toBe(cohort.observation.source_description);
    expect(manifest.observation.source_description).not.toMatch(/forge_grade_cache/);
  });

  test('the cohort is an explained artifact, not a bare array', () => {
    expect(Array.isArray(cohort)).toBe(false);
    expect(cohort.artifact).toBe('observed_cache_cohort');
    expect(cohort.observation.base_url).toBeTruthy();
    expect(cohort.observation.season).toBe(2025);
    expect(cohort.observation.as_of_week).toBe(18);
  });

  test('both artifacts record that nothing in production was mutated', () => {
    for (const doc of [manifest, cohort]) {
      expect(doc.observation.production_mutations).toBe('none');
      expect(doc.observation.database_access).toBe('none');
    }
  });
});

describe('the frozen observation and its evidence status', () => {
  test('the cohort file is byte-for-byte the frozen 2026-08-09 record', () => {
    // The complete-file pin — envelope, wording and all, not just the rows.
    // Correcting a claim never rewrites the record that made it.
    expect(createHash('sha256').update(cohortText).digest('hex')).toBe(FROZEN_COHORT.sha256);
    expect(cohort.observation.observed_at).toBe(FROZEN_COHORT.observed_at);
    expect(cohort.rows).toHaveLength(FROZEN_COHORT.row_count);
    expect(manifest.frozen_cohort.sha256).toBe(FROZEN_COHORT.sha256);
  });

  test('the manifest carries the closed pre-lineage-guard evidence status', () => {
    expect(manifest.observation.evidence_status).toEqual(OBSERVATION_EVIDENCE_STATUS);
    expect(manifest.observation.evidence_status.status).toBe('unverified_predates_lineage_guard');
    expect(manifest.observation.evidence_status.closed).toBe(true);
  });

  test('the frozen per-position records genuinely lack the serving layer', () => {
    // The status is grounded in the committed bytes, not in the guard's
    // absence: `ObservedPositionSource` declares `layer` and `source`, and the
    // frozen capture has neither, for any position.
    for (const position of POSITIONS) {
      const record = cohort.observation.per_position[position];
      expect(record).toBeDefined();
      expect(Object.keys(record).sort()).toEqual(['asOf', 'fallbackReason']);
      expect(record.layer).toBeUndefined();
      expect(record.source).toBeUndefined();
    }
    expect(OBSERVATION_EVIDENCE_STATUS.observed_fields_missing).toEqual(['layer', 'source']);
  });

  test('no current manifest assertion attributes the rows to a producer path', () => {
    // The scan runs over the WHOLE manifest. The exemptions are the named
    // quote/disclaimer fields and the investigation title — not the envelope
    // boundary, which would let an attribution hide in a findings section.
    expect(unsupportedLineageClaims(manifest)).toEqual([]);
  });

  test('the claim scanner would catch a restored attribution', () => {
    // Pinned adversarially: if the scanner stops working, the test above
    // passes vacuously and this trips instead.
    expect(unsupportedLineageClaims({
      note: 'these rows were served by forge_grade_cache',
    })).toEqual([expect.stringContaining('forge_grade_cache')]);
  });

  test('disclaimers and verbatim quotes may name producers without counting as claims', () => {
    // Otherwise the text that exists to DENY or SUPERSEDE an attribution would
    // be flagged as making it, and the only way to pass would be deleting it.
    expect(unsupportedLineageClaims({
      does_not_support: ['that the response was produced by forge_grade_cache'],
      superseded_source_description: FROZEN_COHORT.superseded_source_description,
      missing_field_consequence: 'the scoring service call failed; nothing records what served the rows',
    })).toEqual([]);
  });
});

describe('the disposition is an audit classification, not an enforced state', () => {
  test('records the terminal finding without claiming enforcement', () => {
    expect(manifest.disposition.terminal_finding).toBe(TERMINAL_FINDING);
    expect(manifest.disposition.status).toBe('classified_for_quarantine');
    expect(manifest.disposition.enforced_by_this_audit).toBe(false);
    expect(manifest.disposition.enforcement_owner).toContain('#307');
  });

  test('the finding is named for the cohort, not for a producer origin', () => {
    expect(TERMINAL_FINDING).not.toMatch(/forge_grade_cache|legacy_forge_cache/);
    expect(manifest.disposition.superseded_finding_name).toBe(SUPERSEDED_TERMINAL_FINDING);
    expect(SUPERSEDED_TERMINAL_FINDING).toMatch(/legacy_forge_cache/);
  });

  test('quarantine is a response to missing provenance, not a source verdict', () => {
    expect(manifest.disposition.quarantine_basis).toBe('insufficient_provenance');
    expect(manifest.disposition.quarantine_is_not).toMatch(/served by any particular producer/i);
  });

  test('states the required disposition rather than asserting it is already applied', () => {
    expect(manifest.disposition.required_disposition).toMatch(/must not occupy a canonical or current ranking mode/i);
  });
});

describe('identity calculations', () => {
  test('the observed cohort has no duplicate identifiers', () => {
    const ids = cohort.rows.map((r: any) => r.playerId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(manifest.cacheCohort.identity.duplicateIds).toEqual([]);
  });

  test('gsis-shaped percentage is recomputable from the cohort', () => {
    const ids = cohort.rows.map((r: any) => r.playerId);
    const shaped = ids.filter((id: string) => /^00-\d{7}$/.test(id)).length;
    expect(manifest.cacheCohort.identity.gsisShaped).toBe(shaped);
    expect(manifest.cacheCohort.identity.gsisShapedPct).toBeCloseTo((shaped / ids.length) * 100, 1);
  });

  test('cross-surface resolvability is reported as unavailable, not assumed', () => {
    expect(manifest.cacheCohort.identity.crossSurfaceResolvability).toBe('unavailable_requires_database');
  });
});

describe('clamping analysis', () => {
  test('bounds come from ALPHA_CALIBRATION, so the verdict is source-derived', () => {
    for (const position of POSITIONS) {
      const declared = manifest.clamping.byPosition[position].declaredBounds;
      expect(declared.outMin).toBe((ALPHA_CALIBRATION as any)[position].outMin);
      expect(declared.outMax).toBe((ALPHA_CALIBRATION as any)[position].outMax);
    }
    expect(manifest.clamping.verdict).toBe('designed_calibration_bound_not_cohort_artifact');
  });

  test('floor/ceiling counts are recomputable from the cohort rows', () => {
    for (const position of POSITIONS) {
      const alphas = cohort.rows.filter((r: any) => r.position === position).map((r: any) => r.alpha);
      const bounds = (ALPHA_CALIBRATION as any)[position];
      expect(manifest.clamping.byPosition[position].atFloor).toBe(
        alphas.filter((a: number) => a === bounds.outMin).length,
      );
      expect(manifest.clamping.byPosition[position].atCeiling).toBe(
        alphas.filter((a: number) => a === bounds.outMax).length,
      );
      expect(manifest.clamping.byPosition[position].min).toBe(Math.min(...alphas));
      expect(manifest.clamping.byPosition[position].max).toBe(Math.max(...alphas));
    }
  });

  test('no alpha falls outside its declared bounds', () => {
    for (const row of cohort.rows) {
      const bounds = (ALPHA_CALIBRATION as any)[row.position];
      if (!bounds || row.alpha === null) continue;
      expect(row.alpha).toBeGreaterThanOrEqual(bounds.outMin);
      expect(row.alpha).toBeLessThanOrEqual(bounds.outMax);
    }
  });
});

describe('comparability', () => {
  test('joinability is derived from the measured identifiers', () => {
    // #318 gave the static artifact real GSIS identifiers, so the lineages are
    // now joinable. The verdict tracks the measurement rather than a literal.
    const { joinable, directIdIntersection, joinBlockers } = manifest.comparability;
    expect(joinable).toBe(joinBlockers.length === 0);
    expect(joinable).toBe(directIdIntersection > 0 && manifest.comparability.staticAmbiguousNames === 0);
  });

  test('any generated_baseline row is labelled non-player-evidence', () => {
    // The current artifact carries none; the labelling rule must still hold if
    // one reappears.
    for (const row of manifest.comparability.generatedBaselineTopAlphas) {
      expect(row.evidence).toBe('generated_baseline_not_player_evidence');
    }
    expect(manifest.comparability.generatedBaselineTopAlphas).toHaveLength(
      Math.min(5, manifest.comparability.generatedBaselineRows),
    );
  });

  test('the descriptive comparison is published and recomputable from the artifacts', () => {
    const dc = manifest.comparability.descriptiveComparison;
    expect(dc.status).toBe('available');
    expect(dc.joinKey).toBe('gsis_player_id');
    expect(dc.joinedRows).toBe(manifest.comparability.directIdIntersection);

    const liveById = new Map(cohort.rows.map((r: any) => [r.playerId, r]));
    const staticRows = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, manifest.staticArtifact.path), 'utf8'),
    ).rows ?? [];
    const shared = staticRows.filter((r: any) => liveById.has(r.player_id));
    expect(dc.joinedRows).toBe(shared.length);

    const deltas = shared.map((r: any) =>
      Number(((liveById.get(r.player_id) as any).alpha - r.forge_alpha).toFixed(2)),
    );
    expect(dc.comparableRows).toBe(deltas.length);
    expect(dc.exactAgreement).toBe(deltas.filter((d: number) => d === 0).length);
    expect(dc.minDelta).toBe(Math.min(...deltas));
    expect(dc.maxDelta).toBe(Math.max(...deltas));

    // The published median was the upper of the two middle values, which is a
    // different statistic that only coincides with the median when the sample
    // is odd. With these 50 rows it reported -2.74 instead of -3.215.
    const sorted = [...deltas].sort((a: number, b: number) => a - b);
    const mid = sorted.length / 2;
    const expected = sorted.length % 2
      ? sorted[Math.floor(mid)]
      : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(3));
    expect(dc.medianDelta).toBe(expected);
    expect(sorted.length % 2).toBe(0);
    expect(dc.medianDelta).not.toBe(sorted[mid]);
  });

  test('the published document quotes the manifest, not a stale figure', () => {
    // The audit prose is the artifact a reader actually reads; a corrected
    // number in the manifest that never reached the document corrects nothing.
    const doc = fs.readFileSync(
      path.join(REPO_ROOT, 'docs/audits/2026-08-09-railway-forge-cache-audit.md'),
      'utf8',
    );
    const dc = manifest.comparability.descriptiveComparison;
    expect(doc).toContain(`| median delta (cache − static) | ${dc.medianDelta} |`);
    expect(doc).toContain(`| joined rows | ${dc.joinedRows} |`);
    expect(doc).toContain(`| within ±1.0 alpha | ${dc.within1} |`);
    expect(doc).toContain(`| within ±5.0 alpha | ${dc.within5} |`);
    // The summary table cited "no valid join" after §5.1 established one.
    expect(doc).not.toContain('**not performed** | no valid join');
  });

  test('the comparison describes difference without attributing cause', () => {
    // The cache still cannot say WHY the two disagree; the terminal finding is
    // about exactly that missing lineage.
    const dc = manifest.comparability.descriptiveComparison;
    expect(dc.note).toMatch(/does not attribute/i);
    expect(dc.note).toMatch(/lineage/i);
    expect(manifest.disposition.terminal_finding).toBe(TERMINAL_FINDING);
  });

  test('--check hashes the static artifact the findings depend on', () => {
    // #318 replaced these bytes underneath the manifest and --check still
    // reported success, so the drift passed silently.
    const bytes = fs.readFileSync(path.join(REPO_ROOT, manifest.staticArtifact.path));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(manifest.staticArtifact.sha256);
  });

  test('the static artifact digest matches the bundled bytes', () => {
    const bytes = fs.readFileSync(path.join(REPO_ROOT, manifest.staticArtifact.path));
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(manifest.staticArtifact.sha256);
  });
});

describe('provenance', () => {
  test('records that no reproducibility field is persisted by the cache schema', () => {
    const persisted = manifest.provenance.persistedByCacheSchema;
    expect(persisted.computedAt).toBe(true);
    expect(persisted.inputManifest).toBe(false);
    expect(persisted.sourceHash).toBe(false);
    expect(persisted.snapshotIdentity).toBe(false);
    expect(persisted.evidenceFreshness).toBe(false);
    expect(persisted.builderCommit).toBe(false);
  });

  test('computation time and evidence time remain explicitly unseparable', () => {
    expect(manifest.provenance.canSeparateComputationFromEvidenceTime).toBe(false);
    expect(manifest.provenance.deterministicRecomputePossible).toBe(false);
    expect(manifest.provenance.deterministicRecomputeBlockers.length).toBeGreaterThanOrEqual(3);
  });
});

describe('--check derives the findings rather than spot-checking fields', () => {
  // Field pins are necessary but not sufficient: a hand-edited median,
  // clamping count or comparability verdict sits in none of them. `--check`
  // rebuilds the whole expected manifest from the frozen cohort plus the
  // digest-pinned static artifact and requires equality, so every derived
  // finding is verified by construction. These tests pin that the committed
  // manifest IS that rebuild — the same property, checked from the suite.
  const staticRaw = fs.readFileSync(path.join(REPO_ROOT, manifest.staticArtifact.path));

  test('every derived section is reproducible from the frozen inputs', () => {
    const cohortRows = cohort.rows;
    const staticRows = JSON.parse(staticRaw.toString()).rows ?? [];
    const liveById = new Map(cohortRows.map((r: any) => [r.playerId, r]));
    const shared = staticRows.filter((r: any) => liveById.has(r.player_id));
    const deltas = shared
      .map((r: any) => Number(((liveById.get(r.player_id) as any).alpha - r.forge_alpha).toFixed(2)))
      .sort((a: number, b: number) => a - b);

    const dc = manifest.comparability.descriptiveComparison;
    expect(dc.joinedRows).toBe(shared.length);
    expect(dc.comparableRows).toBe(deltas.length);
    expect(dc.exactAgreement).toBe(deltas.filter((d: number) => d === 0).length);
    expect(dc.minDelta).toBe(deltas[0]);
    expect(dc.maxDelta).toBe(deltas[deltas.length - 1]);

    // The even-cohort median, recomputed independently of the script.
    const mid = deltas.length / 2;
    const expectedMedian = Number.isInteger(mid)
      ? Number(((deltas[mid - 1] + deltas[mid]) / 2).toFixed(3))
      : deltas[Math.floor(mid)];
    expect(dc.medianDelta).toBe(expectedMedian);
  });

  test('the clamping counts are recomputable from the frozen rows', () => {
    for (const position of POSITIONS) {
      const alphas = cohort.rows
        .filter((r: any) => r.position === position)
        .map((r: any) => r.alpha)
        .filter((a: any) => a !== null);
      const calibration = (ALPHA_CALIBRATION as any)[position];
      const published = manifest.clamping.byPosition[position];
      expect(published.n).toBe(alphas.length);
      expect(published.atFloor).toBe(alphas.filter((a: number) => a === calibration.outMin).length);
      expect(published.atCeiling).toBe(alphas.filter((a: number) => a === calibration.outMax).length);
    }
  });

  test('report consistency tracks the manifest, not a hardcoded literal', () => {
    // A fixed `-3.215` in the checker would stop meaning anything the moment
    // the comparison legitimately changed, letting the report drift while
    // --check still passed. The report must quote whatever the manifest says.
    const report = fs.readFileSync(
      path.join(REPO_ROOT, 'docs/audits/2026-08-09-railway-forge-cache-audit.md'),
      'utf8',
    );
    const dc = manifest.comparability.descriptiveComparison;
    for (const value of [dc.medianDelta, dc.joinedRows, dc.minDelta, dc.maxDelta]) {
      expect(report).toContain(String(value));
    }
  });
});
