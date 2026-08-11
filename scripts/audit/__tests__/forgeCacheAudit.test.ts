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
  formatClampPct,
  readMarkdownSections,
  readMarkdownTable,
  readMarkdownTables,
  reportClampingProblems,
  reportComparisonProblems,
  rowIdentityFromCohortRow,
  rowIdentityFromResponseItem,
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
    expect(reportComparisonProblems(report, manifest.comparability.descriptiveComparison)).toEqual([]);
  });
});

describe('report consistency is checked per row, not as a substring sweep', () => {
  const REPORT_PATH = path.join(REPO_ROOT, 'docs/audits/2026-08-09-railway-forge-cache-audit.md');
  const report = fs.readFileSync(REPORT_PATH, 'utf8');
  const dc = manifest.comparability.descriptiveComparison;

  /** Rewrite one `| label | value |` cell of the comparison table. */
  const editCell = (label: string, replacement: string) => {
    const pattern = new RegExp(`^(\\|\\s*\\*{0,2}${label}[^|]*\\|\\s*)([^|]*?)(\\s*\\|)$`, 'm');
    expect(report).toMatch(pattern);
    return report.replace(pattern, `$1${replacement}$3`);
  };

  test('the table under the descriptive-comparison heading is located and parsed', () => {
    const table = readMarkdownTable(report, /^#{2,4}.*descriptive comparison/i);
    expect(table).not.toBeNull();
    expect(table!.get('joined rows')).toBe(String(dc.joinedRows));
    expect(table!.get('exact agreement')).toBe(String(dc.exactAgreement));
  });

  test.each([
    ['joined rows', '51', /joined rows/],
    ['exact agreement', '7', /exact agreement/],
    ['within ±1', '9', /within ±1/],
    ['within ±5', '44', /within ±5/],
    ['median delta', '-3.9', /median delta/],
    ['range', '-99.99 … +88.88', /range/],
  ])('a rewritten "%s" cell is caught', (label, replacement, expected) => {
    const problems = reportComparisonProblems(editCell(label, replacement), dc);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join('\n')).toMatch(expected);
  });

  test('a reversed range is caught, though both endpoints are still present', () => {
    // The defect: checking that each endpoint appears *somewhere* in the cell is
    // membership, not order. `+22.30 … -26.01` states the maximum as the
    // minimum — a range running backwards — and satisfies membership exactly.
    const reversed = editCell('range', `${dc.maxDelta} … ${dc.minDelta}`);
    const cell = readMarkdownTable(reversed, /^#{2,4}.*descriptive comparison/i)!.get('range')!;
    for (const end of [dc.minDelta, dc.maxDelta]) {
      expect(cell).toContain(String(end)); // both endpoints still present
    }
    const problems = reportComparisonProblems(reversed, dc);
    expect(problems.join('\n')).toMatch(/range row states .* in that order/s);
  });

  test('a range row with an extra or missing endpoint is caught', () => {
    for (const replacement of [`${dc.minDelta}`, `${dc.minDelta} … ${dc.maxDelta} … 0`]) {
      expect(reportComparisonProblems(editCell('range', replacement), dc)).not.toEqual([]);
    }
  });

  test('the old global-substring rule would have missed these edits', () => {
    // This is the finding, reproduced. The previous check asked only whether
    // `String(value)` appeared ANYWHERE in the document — and the document is
    // full of numbers: dates, GSIS ids, per-player alphas, section numbers. So
    // a reviewer could rewrite the summary cells and --check still printed
    // "report consistent". Each of these mutations satisfies the old rule.
    const oldRuleSatisfied = (text: string) =>
      [dc.medianDelta, dc.joinedRows, dc.exactAgreement, dc.minDelta, dc.maxDelta]
        .every((value) => text.includes(String(value)));

    const tampered = [
      editCell('joined rows', '51'),
      editCell('exact agreement', '7'),
      editCell('within ±5', '44'),
    ];
    for (const text of tampered) {
      expect(oldRuleSatisfied(text)).toBe(true);          // old rule: "consistent"
      expect(reportComparisonProblems(text, dc)).not.toEqual([]); // new rule: caught
    }
  });

  test('a heading that disagrees with its own table is caught', () => {
    const drifted = report.replace(
      /^(#{2,4}.*descriptive comparison across the )\d+( shared players)$/im,
      `$1${Number(dc.joinedRows) + 1}$2`,
    );
    expect(drifted).not.toBe(report);
    expect(reportComparisonProblems(drifted, dc).join('\n')).toMatch(/heading states/);
  });

  test('a deleted comparison table is a problem, not a silent pass', () => {
    // Deleting the section is the cheapest way to satisfy any "does it contain
    // X" rule, so absence must fail rather than vacuously pass.
    const withoutTable = report.split('\n').filter((line) => !line.trim().startsWith('|')).join('\n');
    expect(reportComparisonProblems(withoutTable, dc)).not.toEqual([]);
  });

  test('an unavailable comparison imposes no report requirement', () => {
    // Nothing to be consistent with, so this must not manufacture a failure.
    expect(reportComparisonProblems(report, { status: 'unavailable_lineages_not_joinable' })).toEqual([]);
  });
});

describe('the clamping table is verified row by row, not left unchecked', () => {
  const REPORT_PATH = path.join(REPO_ROOT, 'docs/audits/2026-08-09-railway-forge-cache-audit.md');
  const report = fs.readFileSync(REPORT_PATH, 'utf8');
  const clamping = manifest.clamping;

  /** Rewrite one cell of a row in the observed-clamping table. */
  const editClampCell = (rowLabel: string, column: number, replacement: string, source = report) => {
    const lines = source.split('\n');
    const index = lines.findIndex((line) =>
      /^\|/.test(line.trim()) &&
      line.split('|').slice(1, -1).map((c) => c.replace(/\*\*/g, '').trim().toLowerCase())[0] === rowLabel &&
      /\(\d/.test(line),
    );
    expect(index).toBeGreaterThan(-1);
    const cells = lines[index].split('|');
    cells[column + 1] = ` ${replacement} `;
    lines[index] = cells.join('|');
    return lines.join('\n');
  };

  test('the committed report is consistent with the manifest clamping', () => {
    expect(reportClampingProblems(report, clamping)).toEqual([]);
  });

  test('the check is not passing vacuously — it found and parsed the table', () => {
    // A checker that silently fails to locate its table reports zero problems
    // forever. Pin that the table is real and has the columns being compared.
    const table = readMarkdownTables(report, /^#{2,4}.*25\.0\s*\/\s*95\.0 bounds/i)
      .find((t) => t.header.some((h) => /at floor/i.test(h)));
    expect(table).toBeDefined();
    expect(table!.rows.map((r) => r[0].toLowerCase()).sort())
      .toEqual(['qb', 'rb', 'te', 'total', 'wr']);
    // Both §4.3 tables are seen; the declared-bounds one must not be mistaken
    // for the observed one.
    expect(readMarkdownTables(report, /^#{2,4}.*25\.0\s*\/\s*95\.0 bounds/i).length).toBe(2);
  });

  test('the reviewer\'s exact tamper is caught', () => {
    // Verbatim from the finding: WR floor 59 (40.4%) -> 1 (0.7%). This inverts
    // the audit's headline finding, and previously passed.
    const tampered = editClampCell('wr', 4, '**1 (0.7%)**');
    expect(tampered).not.toBe(report);
    const problems = reportClampingProblems(tampered, clamping);
    expect(problems.join('\n')).toMatch(/WR at-floor/);
    expect(problems.join('\n')).toMatch(/manifest measured 59/);
  });

  test('the total row is caught independently of the position rows', () => {
    const tampered = editClampCell('total', 4, '**7 (2.0%)**');
    const problems = reportClampingProblems(tampered, clamping);
    expect(problems.join('\n')).toMatch(/total at-floor/);
    // And the position rows are untouched, so only the total is reported.
    expect(problems.filter((p) => /WR|QB|RB|TE/.test(p))).toEqual([]);
  });

  test('a correct count with a wrong percentage is still caught', () => {
    // The percentage is the number a reader actually acts on, so it is checked
    // against the report's own formatting rule rather than merely being present.
    const tampered = editClampCell('wr', 4, '**59 (4.0%)**');
    expect(reportClampingProblems(tampered, clamping).join('\n'))
      .toMatch(/percentage as "4\.0%".*formats to 40\.4%/);
  });

  test('n, min, max and the ceiling column are each checked', () => {
    for (const [column, replacement, expected] of [
      [1, '999', /WR n/],
      [2, '99.9', /WR min/],
      [3, '99.9', /WR max/],
      [5, '99', /WR at-ceiling/],
    ] as const) {
      expect(reportClampingProblems(editClampCell('wr', column, replacement), clamping).join('\n'))
        .toMatch(expected);
    }
  });

  test('a missing row is caught', () => {
    const withoutTe = report.split('\n')
      .filter((line) => !(/^\|\s*TE\s*\|/.test(line.trim()) && /\(\d/.test(line)))
      .join('\n');
    expect(reportClampingProblems(withoutTe, clamping).join('\n')).toMatch(/no "TE" row/);
  });

  test('a duplicated row is caught', () => {
    const lines = report.split('\n');
    const index = lines.findIndex((line) => /^\|\s*WR\s*\|/.test(line.trim()) && /\(\d/.test(line));
    lines.splice(index + 1, 0, lines[index]);
    expect(reportClampingProblems(lines.join('\n'), clamping).join('\n')).toMatch(/repeats the "WR" row/);
  });

  test('an unexpected row is caught', () => {
    const lines = report.split('\n');
    const index = lines.findIndex((line) => /^\|\s*WR\s*\|/.test(line.trim()) && /\(\d/.test(line));
    lines.splice(index + 1, 0, '| K | 12 | 25.0 | 95.0 | 3 (25.0%) | 0 |');
    expect(reportClampingProblems(lines.join('\n'), clamping).join('\n')).toMatch(/unexpected "k" row/);
  });

  test('the total row\'s min and max must stay blank', () => {
    // They are blank on purpose: a cohort-wide minimum and maximum would be a
    // NEW aggregate claim the audit derives nothing to support. Leaving the
    // cells unchecked let arbitrary numbers be inserted and read as
    // measurements.
    for (const [column, label] of [[2, 'min'], [3, 'max']] as const) {
      const tampered = editClampCell('total', column, column === 2 ? '999' : '888');
      const problems = reportClampingProblems(tampered, clamping);
      expect(problems.join('\n')).toMatch(new RegExp(`total row states a ${label}`));
      expect(problems.join('\n')).toMatch(/must stay blank/);
    }

    // Both at once — 999 and 888, the shape the finding described.
    const both = editClampCell('total', 3, '888', editClampCell('total', 2, '999'));
    expect(reportClampingProblems(both, clamping).length).toBeGreaterThanOrEqual(2);

    // And the committed report genuinely leaves them blank, so the check above
    // is not passing because it never looks.
    const table = readMarkdownTables(report, /^#{2,4}.*25\.0\s*\/\s*95\.0 bounds/i)
      .find((t) => t.header.some((h) => /at floor/i.test(h)))!;
    const totalRow = table.rows.find((r) => r[0].toLowerCase() === 'total')!;
    expect(totalRow[2]).toBe('');
    expect(totalRow[3]).toBe('');
  });

  test('exactly one observed-clamping table may state these findings', () => {
    // `.find()` took the first match and ignored the rest, so a second,
    // conflicting table could sit in the same section stating different
    // figures — the first satisfying the check while a reader scrolls to the
    // second. Which of two disagreeing tables is authoritative is not a
    // question this checker should answer by position.
    const lines = report.split('\n');
    const headingIndex = lines.findIndex((l) => /^#{2,4}.*25\.0\s*\/\s*95\.0 bounds/i.test(l));
    expect(headingIndex).toBeGreaterThan(-1);

    // The committed observed-clamping table, taken verbatim from the report so
    // the duplicate below is genuinely identical rather than a lookalike.
    const firstTableLine = lines.findIndex((line, i) => i > headingIndex && /at floor/i.test(line));
    expect(firstTableLine).toBeGreaterThan(-1);
    let lastTableLine = firstTableLine;
    while (lines[lastTableLine + 1]?.trim().startsWith('|')) lastTableLine += 1;
    const committedTable = lines.slice(firstTableLine, lastTableLine + 1);
    // Sanity: the extracted block is the real one, header plus five rows.
    expect(committedTable.length).toBe(7);

    const insertAfter = (block: string[]) =>
      [...lines.slice(0, lastTableLine + 1), '', ...block, ...lines.slice(lastTableLine + 1)].join('\n');

    // A conflicting second table: correct first, wrong second.
    const conflicting = insertAfter([
      '| position | n | min | max | at floor 25.0 | at ceiling 95.0 |',
      '|---|---:|---:|---:|---:|---:|',
      '| QB | 38 | 33.8 | 86.5 | 0 (0.0%) | 0 |',
      '| RB | 95 | 25.0 | 95.0 | 1 (1.1%) | 5 |',
      '| WR | 146 | 25.0 | 95.0 | 1 (0.7%) | 1 |',
      '| TE | 78 | 25.0 | 95.0 | 1 (1.3%) | 1 |',
      '| **total** | **357** | | | **3 (0.8%)** | **7** |',
    ]);
    expect(reportClampingProblems(conflicting, clamping).join('\n'))
      .toMatch(/2 observed-clamping tables; exactly one/);
    // Specifically NOT passing because the first table happened to be correct.
    expect(reportClampingProblems(conflicting, clamping)).not.toEqual([]);

    // An identical duplicate is also a failure — the ambiguity is the defect,
    // not the disagreement.
    const duplicated = insertAfter(committedTable);
    expect(reportClampingProblems(duplicated, clamping).join('\n'))
      .toMatch(/2 observed-clamping tables; exactly one/);
  });

  test('a duplicated §4.3 section is rejected, whatever its tables say', () => {
    // The section-level version of the duplicate-table bug: the reader began
    // at the FIRST matching heading, so a second §4.3 section — heading and
    // all — sat entirely outside the scanned range. The one-table rule inside
    // the first section was satisfied while a reader scrolled to the
    // contradictory duplicate.
    const HEADING = /^#{2,4}.*25\.0\s*\/\s*95\.0 bounds/i;
    const lines = report.split('\n');
    const headingIndex = lines.findIndex((l) => HEADING.test(l));
    expect(headingIndex).toBeGreaterThan(-1);
    const headingLevel = /^(#{1,6})\s/.exec(lines[headingIndex].trim())![1].length;
    let sectionEnd = lines.length;
    for (let i = headingIndex + 1; i < lines.length; i += 1) {
      const next = /^(#{1,6})\s/.exec(lines[i].trim());
      if (next && next[1].length <= headingLevel) { sectionEnd = i; break; }
    }
    const committedSection = lines.slice(headingIndex, sectionEnd);
    const appendSection = (section: string[]) =>
      [...lines.slice(0, sectionEnd), '', ...section, '', ...lines.slice(sectionEnd)].join('\n');

    // Case 1: a correct first section followed by a CONFLICTING duplicate.
    // Under the old reader this passed on the strength of the first.
    const conflicting = appendSection([
      '### 4.3 The 25.0 / 95.0 bounds are **designed**, not a cohort artifact',
      '',
      '| position | n | min | max | at floor 25.0 | at ceiling 95.0 |',
      '|---|---:|---:|---:|---:|---:|',
      '| QB | 38 | 33.8 | 86.5 | 0 (0.0%) | 0 |',
      '| RB | 95 | 25.0 | 95.0 | 1 (1.1%) | 5 |',
      '| WR | 146 | 25.0 | 95.0 | 1 (0.7%) | 1 |',
      '| TE | 78 | 25.0 | 95.0 | 1 (1.3%) | 1 |',
      '| **total** | **357** | | | **3 (0.8%)** | **7** |',
    ]);
    expect(reportClampingProblems(conflicting, clamping).join('\n'))
      .toMatch(/2 sections whose heading matches.*exactly one/);

    // Case 2: the committed section duplicated verbatim — the ambiguity is the
    // defect, not the disagreement.
    const identical = appendSection(committedSection);
    expect(reportClampingProblems(identical, clamping).join('\n'))
      .toMatch(/2 sections whose heading matches.*exactly one/);

    // Case 3: a duplicated heading whose copy contains NO table at all still
    // fails. Uniqueness is a property of the heading, not of which copy
    // happens to carry the expected table.
    const bareHeading = appendSection([
      '### 4.3 The 25.0 / 95.0 bounds are **designed**, not a cohort artifact',
      '',
      'Superseded copy retained for reference.',
    ]);
    expect(reportClampingProblems(bareHeading, clamping).join('\n'))
      .toMatch(/2 sections whose heading matches.*exactly one/);

    // And the section scanner itself sees every copy, not just the first.
    expect(readMarkdownSections(conflicting, HEADING)).toHaveLength(2);
    expect(readMarkdownSections(bareHeading, HEADING)).toHaveLength(2);
    expect(readMarkdownSections(report, HEADING)).toHaveLength(1);
  });

  test('a deleted clamping table fails rather than passing vacuously', () => {
    const withoutTable = report.split('\n').filter((line) => !line.trim().startsWith('|')).join('\n');
    expect(reportClampingProblems(withoutTable, clamping)).not.toEqual([]);
  });

  test('the total row is derived from the positions, not trusted from the manifest', () => {
    // The manifest publishes no total, so the checker sums the positions. Pin
    // that the sums are what the report states.
    const n = POSITIONS.reduce((sum, p) => sum + Number(clamping.byPosition[p].n), 0);
    const floor = POSITIONS.reduce((sum, p) => sum + Number(clamping.byPosition[p].atFloor), 0);
    expect(n).toBe(cohort.row_count);
    expect(report).toMatch(new RegExp(`\\*\\*total\\*\\*\\s*\\|\\s*\\*\\*${n}\\*\\*`));
    expect(formatClampPct(floor, n)).toBe('32.5');
  });
});

describe('the observation records the producer key, not the canonical one', () => {
  // Fantasy #313 is current-main law: `item.playerId` is the canonical public
  // key and is null when identity does not resolve; the producer's GSIS key
  // moved to `item.identity.sourceId`. The static FORGE artifact is GSIS-keyed,
  // so recording `playerId` puts the wrong namespace on the join key.
  const resolvedItem = {
    playerId: 'canonical-josh-allen',
    playerName: 'Josh Allen',
    identity: {
      status: 'resolved',
      canonicalId: 'canonical-josh-allen',
      sourceId: '00-0034857',
      sourceType: 'gsis',
      reason: null,
      linkable: true,
    },
  };
  const unresolvedItem = {
    playerId: null,
    playerName: 'Unmapped Player',
    identity: {
      status: 'unresolved',
      canonicalId: null,
      sourceId: '00-0099999',
      sourceType: 'gsis',
      reason: 'no_identity_map_row',
      linkable: false,
    },
  };

  test('a resolved row records the GSIS producer key and keeps canonical separate', () => {
    expect(rowIdentityFromResponseItem(resolvedItem, 'QB item 0')).toEqual({
      sourceId: '00-0034857',
      sourceType: 'gsis',
      canonicalId: 'canonical-josh-allen',
    });
  });

  test('an unresolved row still records its producer key', () => {
    // The defect, reproduced: the previous mapping was
    // `String(item.playerId ?? '')`, which turns every unresolved row into the
    // empty string. Those rows then collide with each other as one "identifier"
    // and match nothing in the static artifact — the join silently describes
    // fewer players than the cohort contains.
    expect(String((unresolvedItem as any).playerId ?? '')).toBe('');
    const identity = rowIdentityFromResponseItem(unresolvedItem, 'QB item 1');
    expect(identity.sourceId).toBe('00-0099999');
    expect(identity.canonicalId).toBeNull();
  });

  test('the recorded key is the one the static artifact can be joined on', () => {
    const staticRows: any[] = JSON.parse(
      fs.readFileSync(path.join(REPO_ROOT, manifest.staticArtifact.path), 'utf8'),
    ).rows ?? [];
    const staticIds = new Set(staticRows.map((r) => r.player_id));
    const items = [resolvedItem, unresolvedItem].map((item, i) => ({
      item,
      identity: rowIdentityFromResponseItem(item, `QB item ${i}`),
    }));
    // A real GSIS key from the static artifact, recorded through the mapper,
    // joins; the canonical key it sits beside does not.
    const anyStaticId = staticRows[0].player_id;
    const joined = rowIdentityFromResponseItem(
      { playerId: 'canonical-x', identity: { ...resolvedItem.identity, sourceId: anyStaticId } },
      'QB item 0',
    );
    expect(staticIds.has(joined.sourceId)).toBe(true);
    expect(staticIds.has(joined.canonicalId as string)).toBe(false);
    expect(items.every((r) => r.identity.sourceId !== '')).toBe(true);
  });

  test('a response with no identity envelope is refused, not guessed at', () => {
    // Without the envelope the audit cannot tell which namespace `playerId` is
    // in. Falling back to it is the whole defect, so this fails loudly.
    expect(() => rowIdentityFromResponseItem({ playerId: '00-0034857' }, 'QB item 0'))
      .toThrow(/identity\.sourceId/);
    expect(() => rowIdentityFromResponseItem({ playerId: null, identity: { sourceId: '' } }, 'QB item 0'))
      .toThrow(/identity\.sourceId/);
  });

  test('the frozen pre-#313 cohort is read as producer keys, with canonical NOT recorded', () => {
    // The frozen file predates both the identity envelope and #313: at capture
    // time `playerId` still carried the producer key, so reading it as such is
    // correct FOR THAT FILE. What was never observed is the canonical state,
    // and that is reported as not-recorded rather than as "none resolved".
    const identity = rowIdentityFromCohortRow(cohort.rows[0], 'cohort row 0');
    expect(identity.sourceId).toBe(cohort.rows[0].playerId);
    expect(identity.sourceType).toBe('gsis');
    expect(identity.canonicalId).toBeUndefined();

    expect(manifest.cacheCohort.identity.canonicalCoverage).toEqual({
      recorded: false,
      reason: 'observation predates the per-item identity envelope; canonical state was not observed',
    });
  });

  test('a cohort written after this change is read from its own sourceId', () => {
    expect(rowIdentityFromCohortRow(
      { sourceId: '00-0034857', sourceType: 'gsis', canonicalId: null, playerId: null },
      'cohort row 0',
    )).toEqual({ sourceId: '00-0034857', sourceType: 'gsis', canonicalId: null });
  });

  test('a row carrying neither identifier is refused', () => {
    expect(() => rowIdentityFromCohortRow({ position: 'QB' }, 'cohort row 0')).toThrow(/neither sourceId/);
  });

  test('the manifest names which identifier its identity findings measure', () => {
    expect(manifest.cacheCohort.identity.identifierField).toBe('source_id');
    expect(manifest.comparability.descriptiveComparison.joinKey).toBe('gsis_player_id');
    // And the joined rows are labelled for the namespace they are actually in.
    for (const row of manifest.comparability.descriptiveComparison.largestDisagreements ?? []) {
      expect(row.gsisPlayerId).toMatch(/^00-\d{7}$/);
      expect(row.playerId).toBeUndefined();
    }
  });
});
