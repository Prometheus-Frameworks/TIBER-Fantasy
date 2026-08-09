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

  test('one observation timestamp and source description, used consistently', () => {
    expect(manifest.observation.observed_at).toBe(cohort.observation.observed_at);
    expect(manifest.observation.source_description).toBe(cohort.observation.source_description);
    expect(new Date(manifest.observation.observed_at).toString()).not.toBe('Invalid Date');
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

describe('the disposition is an audit classification, not an enforced state', () => {
  test('records the terminal finding without claiming enforcement', () => {
    expect(manifest.disposition.terminal_finding).toBe('legacy_forge_cache_quarantined_insufficient_provenance');
    expect(manifest.disposition.status).toBe('classified_for_quarantine');
    expect(manifest.disposition.enforced_by_this_audit).toBe(false);
    expect(manifest.disposition.enforcement_owner).toContain('#307');
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
  test('the two lineages remain unjoinable, with both blockers recorded', () => {
    expect(manifest.comparability.joinable).toBe(false);
    expect(manifest.comparability.directIdIntersection).toBe(0);
    expect(manifest.comparability.joinBlockers).toHaveLength(2);
  });

  test('generated_baseline rows are labelled non-player-evidence', () => {
    expect(manifest.comparability.generatedBaselineRows).toBeGreaterThan(0);
    for (const row of manifest.comparability.generatedBaselineTopAlphas) {
      expect(row.evidence).toBe('generated_baseline_not_player_evidence');
    }
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
