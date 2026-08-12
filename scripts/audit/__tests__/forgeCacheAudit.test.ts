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
  CLAMPING_SECTION_HEADING,
  COMPARISON_SECTION_HEADING,
  CURRENT_SOURCE_DESCRIPTION,
  FROZEN_COHORT,
  IDENTITY_SECTION_HEADING,
  OBSERVATION_EVIDENCE_STATUS,
  SUPERSEDED_TERMINAL_FINDING,
  TERMINAL_FINDING,
  computeJoinBlockers,
  formatClampPct,
  governedMarkdownSyntaxProblems,
  parseAtxHeading,
  readMarkdownSections,
  readMarkdownTable,
  readMarkdownTables,
  reportClampingProblems,
  reportComparisonProblems,
  reportIdentityProblems,
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
    // The join is performed exclusively on the measured ID intersection —
    // NOT on `staticAmbiguousNames` (a diagnostic, not a blocker; see
    // `computeJoinBlockers` below). The committed artifact happens to have
    // zero ambiguous names today, so this only pins the ID-based half of the
    // rule; the "does not depend on names" half is regressed directly below.
    expect(joinable).toBe(directIdIntersection > 0);
  });

  describe('computeJoinBlockers — a join performed exclusively on player_id', () => {
    test('a nonzero ID intersection is joinable regardless of static-artifact name ambiguity', () => {
      // The exact P2 scenario: distinct GSIS IDs that happen to share a
      // display name. `computeJoinBlockers` does not even accept a
      // name-ambiguity input, so there is nothing for duplicate names to
      // block — the fix is enforced by the function's own signature, not
      // merely by omitting an `if`.
      expect(computeJoinBlockers({ directIdIntersection: 50 })).toEqual([]);
      expect(computeJoinBlockers({ directIdIntersection: 1 })).toEqual([]);
    });

    test('zero identifier intersection still blocks the join', () => {
      const blockers = computeJoinBlockers({ directIdIntersection: 0 });
      expect(blockers).not.toEqual([]);
      expect(blockers.join(' ')).toMatch(/zero direct identifier intersection/);
    });
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

describe('the report identity summary is governed by cacheCohort.identity', () => {
  const REPORT_PATH = path.join(REPO_ROOT, 'docs/audits/2026-08-09-railway-forge-cache-audit.md');
  const report = fs.readFileSync(REPORT_PATH, 'utf8');
  const identity = manifest.cacheCohort.identity;

  const replaceIdentityValue = (label: string, replacement: string, source = report) => {
    const pattern = new RegExp(`^(\\|\\s*${label}[^|]*\\|\\s*)([^|]*?)(\\s*\\|)$`, 'mi');
    expect(source).toMatch(pattern);
    return source.replace(pattern, `$1${replacement}$3`);
  };

  test('the committed §3 table agrees with every manifest identity field it states', () => {
    expect(reportIdentityProblems(report, identity)).toEqual([]);
    expect(readMarkdownSections(report, IDENTITY_SECTION_HEADING)).toHaveLength(1);
  });

  test.each([
    ['rows', '999', /identity rows/],
    ['distinct identifiers', '356 (zero duplicates)', /distinct identifiers/],
    ['GSIS-shaped', '356 (99.7%)', /GSIS-shaped/],
    ['other namespaces', '1', /other namespaces/],
    ['canonical coverage', '100%', /canonical coverage/],
    ['cross-surface resolvability', 'available', /cross-surface resolvability/],
  ])('a drifted "%s" identity row fails', (label, replacement, expected) => {
    expect(reportIdentityProblems(replaceIdentityValue(label, replacement), identity).join('\n')).toMatch(expected);
  });

  test('duplicateIds.length is checked independently of totalRows minus distinctIds', () => {
    const duplicateIdentity = { ...identity, duplicateIds: ['00-0000001'] };
    const problems = reportIdentityProblems(report, duplicateIdentity).join('\n');
    expect(problems).toMatch(/manifest lists 1 duplicate IDs/);
    expect(identity.totalRows - identity.distinctIds).toBe(0);
  });

  test('missing, duplicate and unexpected identity rows all fail', () => {
    const row = '| rows | 357 |';
    expect(report).toContain(row);
    expect(reportIdentityProblems(report.replace(`${row}\n`, ''), identity).join('\n')).toMatch(/no "rows" row/);
    expect(reportIdentityProblems(report.replace(row, `${row}\n${row}`), identity).join('\n')).toMatch(/repeats the "rows" row/);
    expect(reportIdentityProblems(report.replace(row, `${row}\n| invented | 1 |`), identity).join('\n')).toMatch(/unexpected "invented" row/);
  });

  test('§3 requires exactly one numbered section and exactly one identity table', () => {
    const duplicateSection = `${report}\n\n## 3 Retitled identity\n\n| measure | value |\n|---|---:|\n| rows | 1 |\n`;
    expect(reportIdentityProblems(duplicateSection, identity).join('\n')).toMatch(/2 sections whose heading matches §3/);

    const extraTable = report.replace(
      '| cross-surface resolvability | **unavailable — requires database** |',
      '| cross-surface resolvability | **unavailable — requires database** |\n\n| measure | value |\n|---|---:|\n| rows | 1 |',
    );
    expect(reportIdentityProblems(extraTable, identity).join('\n')).toMatch(/2 identity-summary tables/);
  });

  test('§3 accepts explicit reordered headers but rejects duplicate, unknown, and mixed blank headers', () => {
    const lines = report.split('\n');
    const sectionIndex = lines.findIndex((line) => /^## 3\./.test(line));
    const headerIndex = lines.findIndex((line, index) => index > sectionIndex && line === '| measure | value |');
    expect(headerIndex).toBeGreaterThan(-1);
    lines[headerIndex] = '| value | measure |';
    lines[headerIndex + 1] = '|---:|---|';
    for (let i = headerIndex + 2; lines[i]?.startsWith('|'); i += 1) {
      const cells = lines[i].split('|').slice(1, -1).map((cell) => cell.trim());
      lines[i] = `| ${cells[1]} | ${cells[0]} |`;
    }
    const explicit = lines.join('\n');
    expect(reportIdentityProblems(explicit, identity)).toEqual([]);

    for (const header of [
      '| measure | value | value |\n|---|---:|---:|',
      '| measure | measure | value |\n|---|---|---:|',
      '| measure | value | note |\n|---|---:|---|',
      '| measure | |\n|---|---:|',
    ]) {
      const tamperedLines = report.split('\n');
      const identitySection = tamperedLines.findIndex((line) => /^## 3\./.test(line));
      const identityHeader = tamperedLines.findIndex((line, index) => index > identitySection && line === '| measure | value |');
      tamperedLines.splice(identityHeader, 2, ...header.split('\n'));
      const tampered = tamperedLines.join('\n');
      expect(reportIdentityProblems(tampered, identity)).not.toEqual([]);
    }
  });
});

describe('governed Markdown parsing cannot hide duplicate sections or tables', () => {
  const REPORT_PATH = path.join(REPO_ROOT, 'docs/audits/2026-08-09-railway-forge-cache-audit.md');
  const report = fs.readFileSync(REPORT_PATH, 'utf8');
  const clamping = manifest.clamping;
  const dc = manifest.comparability.descriptiveComparison;

  test.each([
    ['4.3 Setext duplicate', '---'],
    ['4.3 Setext H1 duplicate', '==='],
  ])('a governed Setext %s is a real duplicate section', (title, underline) => {
    const tampered = `${report}\n\n${title}\n${underline}\n\nRetained for reference.\n`;
    expect(reportClampingProblems(tampered, clamping).join('\n')).toMatch(/2 sections whose heading matches §4\.3/);
  });

  test('a multiline Setext paragraph is tokenized as one visible governed heading', () => {
    const tampered = `${report}\n\n4.3 Multiline duplicate\nwith a retitled continuation\n---\n`;
    expect(reportClampingProblems(tampered, clamping).join('\n')).toMatch(/2 sections whose heading matches §4\.3/);

    const withProsePipe = `${report}\n\n4.3 Hidden | still paragraph text\nwith a continuation\n---\n`;
    expect(reportClampingProblems(withProsePipe, clamping).join('\n')).toMatch(/2 sections whose heading matches §4\.3/);
  });

  test('Setext duplicates remain visible after another Setext block or a pipe table', () => {
    for (const prefix of [
      'Other heading\n---',
      '| a | b |\n|---|---|\n| x | y |',
    ]) {
      const tampered = `${report}\n\n${prefix}\n4.3 Hidden duplicate\n---\n`;
      expect(reportClampingProblems(tampered, clamping)).not.toEqual([]);
    }
  });

  test('Setext syntax cannot hide a duplicate §5.2 either', () => {
    const tampered = `${report}\n\n5.2 Retitled comparison\n---\n\nRetained for reference.\n`;
    expect(reportComparisonProblems(tampered, dc).join('\n')).toMatch(/2 sections whose heading matches §5\.2/);
  });

  test.each(['===', '---'])('a sole Setext §5.2 heading (%s) reads only its required shared-player count', (underline) => {
    const lines = report.split('\n');
    const start = lines.findIndex((line) => /^### 5\.2 /.test(line));
    const end = lines.findIndex((line, index) => index > start && /^### 5\.2b /.test(line));
    const document = [
      '5.2 Descriptive comparison across the 50 shared players',
      underline,
      ...lines.slice(start + 1, end),
    ].join('\n');
    expect(reportComparisonProblems(document, dc)).toEqual([]);
  });

  test('a Setext heading is also a shared boundary, so its table is not attributed to the prior section', () => {
    const doc = [
      '4.3 Governed', '---', '',
      '| position | n | min | max | at floor 25 | at ceiling 95 |',
      '|---|---:|---:|---:|---:|---:|',
      '| QB | 1 | 1 | 1 | 0 | 0 |', '',
      '4.4 Next section', '---', '',
      '| position | n | min | max | at floor 25 | at ceiling 95 |',
      '|---|---:|---:|---:|---:|---:|',
      '| WR | 1 | 1 | 1 | 0 | 0 |',
    ].join('\n');
    const section = readMarkdownSections(doc, CLAMPING_SECTION_HEADING)[0];
    expect(section.tables).toHaveLength(1);
    expect(section.tables[0].rows[0][0]).toBe('QB');
  });

  test.each([
    ['**4.3** duplicate'],
    ['`4.3` duplicate'],
    ['[4.3](https://example.invalid) duplicate'],
    ['4\\.3 duplicate'],
    ['4&#46;3 duplicate'],
    ['4&period;3 duplicate'],
    ['<strong>4.3</strong> duplicate'],
  ])('visually equivalent heading "%s" cannot bypass §4.3 uniqueness', (content) => {
    const tampered = `${report}\n\n### ${content}\n\nRetained for reference.\n`;
    expect(reportClampingProblems(tampered, clamping)).not.toEqual([]);
  });

  test('a second comparison table without outer pipes is still found', () => {
    const tampered = report.replace(
      '| range | -26.01 … +22.30 |',
      '| range | -26.01 … +22.30 |\n\nmeasure | value\n---|---:\njoined rows | 999',
    );
    expect(reportComparisonProblems(tampered, dc).join('\n')).toMatch(/2 descriptive-comparison tables/);
  });

  test.each([
    ['measure | value |', '---|---:|', 'joined rows | 50 |'],
    ['| measure | value', '|---|---:', '| joined rows | 50'],
    ['measure | value', '---|---:', 'joined rows | 50'],
  ])('leading/trailing outer pipes are independently optional', (header, delimiter, row) => {
    const doc = ['### 5.2 Comparison', '', header, delimiter, row].join('\n');
    const sections = readMarkdownSections(doc, COMPARISON_SECTION_HEADING);
    expect(sections[0].tables[0].header).toEqual(['measure', 'value']);
    expect(sections[0].tables[0].rows[0]).toEqual(['joined rows', '50']);
  });

  test('escaped pipes stay inside cells and malformed arity cannot become a valid governed table', () => {
    const escaped = ['### 5.2 Comparison', '', 'measure | value', '---|---:', 'joined \\| rows | 50'].join('\n');
    expect(readMarkdownSections(escaped, COMPARISON_SECTION_HEADING)[0].tables[0].rows[0])
      .toEqual(['joined | rows', '50']);

    const malformed = report.replace(
      '| measure | value |\n|---|---:|',
      '| measure | value |\n|---|---:|---:|',
    );
    expect(reportComparisonProblems(malformed, dc)).not.toEqual([]);
  });

  test('odd escaped pipes stay literal while even backslashes expose a delimiter', () => {
    const odd = ['### 5.2 Comparison', '', 'measure | value', '---|---:', 'joined \\\| rows | 50'].join('\n');
    const even = ['### 5.2 Comparison', '', 'measure | value | note', '---|---:|---', 'joined \\\\| rows | 50'].join('\n');
    expect(readMarkdownSections(odd, COMPARISON_SECTION_HEADING)[0].tables[0].rows[0])
      .toEqual(['joined | rows', '50']);
    expect(readMarkdownSections(even, COMPARISON_SECTION_HEADING)[0].tables[0].rows[0])
      .toEqual(['joined \\', 'rows', '50']);
  });

  test('an escaped physical trailing pipe remains final-cell content, not an outer delimiter', () => {
    const doc = [
      '### 5.2 Comparison',
      '',
      'measure | value\\|',
      '--- | ---',
      'joined rows | 50\\|',
    ].join('\n');
    const table = readMarkdownSections(doc, COMPARISON_SECTION_HEADING)[0].tables[0];
    expect(table.header).toEqual(['measure', 'value|']);
    expect(table.rows[0]).toEqual(['joined rows', '50|']);
  });

  test('CRLF fence openers and closers retain the same visibility boundary', () => {
    const doc = ['```\r', '### 4.3 Fenced\r', '```\r', '### 4.3 Real\r'].join('\n');
    const sections = readMarkdownSections(doc, CLAMPING_SECTION_HEADING);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toContain('Real');
  });

  test('fenced and four-space-indented Setext/table lookalikes remain inert', () => {
    for (const block of [
      ['```', '4.3 fenced', '---', '```'],
      ['    4.3 code', '    ---'],
    ]) {
      const tampered = `${report}\n\n${block.join('\n')}\n`;
      expect(reportClampingProblems(tampered, clamping)).toEqual([]);
    }
  });

  test('raw HTML headings and tables fail closed, except inside fenced or indented code', () => {
    for (const html of [
      '<h3>4.3 hidden duplicate</h3>',
      '<table><tr><td>joined rows</td><td>999</td></tr></table>',
    ]) {
      const tampered = `${report}\n\n${html}\n`;
      expect(governedMarkdownSyntaxProblems(tampered)).not.toEqual([]);
      expect(reportClampingProblems(tampered, clamping)).not.toEqual([]);
      expect(reportComparisonProblems(tampered, dc)).not.toEqual([]);

      for (const inert of [`\`\`\`\n${html}\n\`\`\``, `    ${html}`]) {
        const codeExample = `${report}\n\n${inert}\n`;
        expect(governedMarkdownSyntaxProblems(codeExample)).toEqual([]);
      }
    }
  });

  test('only equal maximal backtick runs make raw HTML inert inline code', () => {
    for (const exposed of [
      '`<h3>4.3 hidden</h3>```',
      '``<h3>4.3 hidden</h3>```',
      '`<table><tr><td>999</td></tr></table>```',
    ]) {
      expect(governedMarkdownSyntaxProblems(exposed)).not.toEqual([]);
    }
    for (const inert of [
      '`<h3>4.3 code</h3>`',
      '``<h3>4.3 code</h3>``',
      '```<table><tr><td>999</td></tr></table>```',
    ]) {
      expect(governedMarkdownSyntaxProblems(inert)).toEqual([]);
    }
  });

  test('HTML comments and structural list/blockquote containers fail closed; ordinary blockquotes remain prose', () => {
    expect(governedMarkdownSyntaxProblems(`${report}\n<!-- ### 4.3 hidden -->`)).not.toEqual([]);
    for (const line of ['> ### 4.3 hidden', '- 5.2 hidden']) {
      expect(governedMarkdownSyntaxProblems(`${report}\n${line}`)).not.toEqual([]);
    }
    expect(governedMarkdownSyntaxProblems(`${report}\n> measure | value\n> ---|---:`)).not.toEqual([]);
    expect(governedMarkdownSyntaxProblems(`${report}\n> Ordinary explanatory prose.`)).toEqual([]);
  });

  test.each([
    '~~4.3~~ duplicate',
    '[4.3][governed] duplicate',
    '![4.3](https://example.invalid/section.png) duplicate',
    '<span>4.3</span> duplicate',
  ])(
    'unsupported visible heading alias "%s" fails closed',
    (content) => {
      expect(reportClampingProblems(`${report}\n\n### ${content}\n`, clamping)).not.toEqual([]);
    },
  );

  test('shortcut references and multiline raw HTML cannot hide a governed section', () => {
    const shortcut = `${report}\n\n### [4.3]\n\n[4.3]: https://example.invalid\n`;
    expect(reportClampingProblems(shortcut, clamping)).not.toEqual([]);
    const multilineHtml = `${report}\n\n<h3\nclass=x>\n4.3 hidden\n</h3>\n`;
    expect(governedMarkdownSyntaxProblems(multilineHtml)).not.toEqual([]);
  });

  test('container prose containing a pipe remains ordinary prose, but a real nested table fails', () => {
    for (const prose of ['> Ordinary A | B comparison.', '- Choose A | B in prose.']) {
      expect(governedMarkdownSyntaxProblems(`${report}\n${prose}`)).toEqual([]);
    }
    const nestedTable = `${report}\n> measure | value\n> --- | ---\n> joined rows | 999`;
    expect(governedMarkdownSyntaxProblems(nestedTable)).not.toEqual([]);
  });

  test('table escapes are CommonMark-bounded and delimiter cells are raw-validated', () => {
    const letterEscape = ['### 5.2 Comparison', '', 'mea\\sure | value', '---|---:', 'joined rows | 50'].join('\n');
    expect(readMarkdownSections(letterEscape, COMPARISON_SECTION_HEADING)[0].tables[0].header[0]).toBe('mea\\sure');
    const decoratedDelimiter = ['### 5.2 Comparison', '', 'measure | value', '**---**|---:', 'joined rows | 50'].join('\n');
    expect(readMarkdownSections(decoratedDelimiter, COMPARISON_SECTION_HEADING)[0].tables).toHaveLength(0);
  });

  test('inline marker deletion cannot invent governed section numbers or numeric cells', () => {
    expect(reportClampingProblems(`${report}\n\n### 4*.*3 hidden\n`, clamping)).not.toEqual([]);
    expect(reportComparisonProblems(`${report}\n\n### 5*.*2 hidden\n`, dc)).not.toEqual([]);
    expect(reportIdentityProblems(`${report}\n\n## 3**. hidden\n`, manifest.cacheCohort.identity)).not.toEqual([]);
    expect(reportIdentityProblems(report.replace('| rows | 357 |', '| rows | 3**57 |'), manifest.cacheCohort.identity))
      .not.toEqual([]);
    expect(reportClampingProblems(
      report.replace('| QB | 38 | 33.8 | 86.5 | 0 (0.0%) | 0 |', '| QB | 3**8 | 33.8 | 86.5 | 0 (0.0%) | 0 |'),
      clamping,
    )).not.toEqual([]);
    // The bounded forms used by the committed report remain presentation, not syntax errors.
    expect(reportIdentityProblems(report, manifest.cacheCohort.identity)).toEqual([]);
    expect(reportClampingProblems(report, clamping)).toEqual([]);
    expect(reportComparisonProblems(report, dc)).toEqual([]);
  });

  test('escaped delimiter dashes cannot manufacture a table in §3, §4.3, or §5.2', () => {
    const identityEscaped = report.replace(
      '| measure | value |\n|---|---|',
      '| measure | value |\n|\\---|---|',
    );
    expect(reportIdentityProblems(identityEscaped, manifest.cacheCohort.identity)).not.toEqual([]);
    const clampingEscaped = report.replace(
      '| position | p10 | p90 | outMin | outMax |\n|---|---:|---:|---:|---:|',
      '| position | p10 | p90 | outMin | outMax |\n|\\---|---:|---:|---:|---:|',
    );
    expect(reportClampingProblems(clampingEscaped, clamping)).not.toEqual([]);
    const comparisonEscaped = report.replace(
      '| measure | value |\n|---|---:|',
      '| measure | value |\n|\\---|---:|',
    );
    expect(reportComparisonProblems(comparisonEscaped, dc)).not.toEqual([]);
  });

  test('two-space list continuations cannot contain governed sections or tables', () => {
    for (const nested of [
      '- nested\n  ## 3. Hidden identity\n  | measure | value |\n  |---|---|\n  | rows | 999 |',
      '- nested\n  ### 4.3 Hidden clamping\n  | position | n |\n  |---|---|\n  | QB | 999 |',
      '- nested\n  ### 5.2 Descriptive comparison across the 50 shared players\n  | measure | value |\n  |---|---|\n  | joined rows | 999 |',
      '- nested\n  | measure | value |\n  |---|---|\n  | rows | 999 |',
    ]) {
      expect(governedMarkdownSyntaxProblems(`${report}\n\n${nested}`)).not.toEqual([]);
    }
    expect(governedMarkdownSyntaxProblems('- nested\n\n### 4.3 Top-level after a blank')).toEqual([]);
  });

  test('container membership survives blank+indented and immediate lazy table continuations', () => {
    const governedTables = [
      '| measure | value |\n|---|---|\n| rows | 999 |',
      '| position | n |\n|---|---|\n| QB | 999 |',
      '| measure | value |\n|---|---|\n| joined rows | 999 |',
    ];
    for (const table of governedTables) {
      const indented = table.split('\n').map((line) => `  ${line}`).join('\n');
      expect(governedMarkdownSyntaxProblems(`- nested evidence\n\n${indented}`)).not.toEqual([]);
      expect(governedMarkdownSyntaxProblems(`- nested evidence\n${table}`)).not.toEqual([]);
      expect(governedMarkdownSyntaxProblems(`> nested evidence\n${table}`)).not.toEqual([]);
      // A blank followed by unindented structure is outside the container.
      expect(governedMarkdownSyntaxProblems(`- nested evidence\n\n${table}`)).toEqual([]);
    }

    const identityNested = `${report}\n\n- nested evidence\n\n  ## 3. Hidden\n  | measure | value |\n  |---|---|\n  | rows | 999 |`;
    const clampingNested = `${report}\n\n- nested evidence\n### 4.3 Hidden\n| position | n |\n|---|---|\n| QB | 999 |`;
    const comparisonNested = `${report}\n\n> nested evidence\n### 5.2 Descriptive comparison across the 50 shared players\n| measure | value |\n|---|---|\n| joined rows | 999 |`;
    expect(reportIdentityProblems(identityNested, manifest.cacheCohort.identity)).not.toEqual([]);
    expect(reportClampingProblems(clampingNested, clamping)).not.toEqual([]);
    expect(reportComparisonProblems(comparisonNested, dc)).not.toEqual([]);
  });

  test('container continuation indentation follows list markers and blockquote blank boundaries', () => {
    const table = '| measure | value |\n|---|---|\n| rows | 999 |';
    const indent = (spaces: number) => table.split('\n').map((line) => `${' '.repeat(spaces)}${line}`).join('\n');

    expect(governedMarkdownSyntaxProblems(`> quote\n\n${indent(2)}`)).toEqual([]);
    expect(governedMarkdownSyntaxProblems(`- list\n\n${indent(1)}`)).toEqual([]);
    for (const spaces of [2, 4, 5]) {
      expect(governedMarkdownSyntaxProblems(`- list\n\n${indent(spaces)}`)).not.toEqual([]);
    }
    expect(governedMarkdownSyntaxProblems(`- list\n\n${indent(6)}`)).toEqual([]);

    // Ordered markers require their full marker+space content indent.
    expect(governedMarkdownSyntaxProblems(`10. list\n\n${indent(3)}`)).toEqual([]);
    expect(governedMarkdownSyntaxProblems(`10. list\n\n${indent(4)}`)).not.toEqual([]);

    expect(governedMarkdownSyntaxProblems(`- list\n${table}`)).not.toEqual([]);
    expect(governedMarkdownSyntaxProblems(`> quote\n${table}`)).not.toEqual([]);
    expect(governedMarkdownSyntaxProblems(`- list\n\n${table}`)).toEqual([]);
  });

  test('list content indent includes leading spaces before bullet and ordered markers', () => {
    const table = '| measure | value |\n|---|---|\n| rows | 999 |';
    const indent = (spaces: number) => table.split('\n').map((line) => `${' '.repeat(spaces)}${line}`).join('\n');

    for (const spaces of [2, 3]) {
      expect(governedMarkdownSyntaxProblems(`  - list\n\n${indent(spaces)}`)).toEqual([]);
    }
    for (const spaces of [4, 5, 6, 7]) {
      expect(governedMarkdownSyntaxProblems(`  - list\n\n${indent(spaces)}`)).not.toEqual([]);
    }
    expect(governedMarkdownSyntaxProblems(`  - list\n\n${indent(8)}`)).toEqual([]);

    for (const spaces of [5, 6, 7, 8]) {
      expect(governedMarkdownSyntaxProblems(`   - list\n\n${indent(spaces)}`)).not.toEqual([]);
    }
    expect(governedMarkdownSyntaxProblems(`   - list\n\n${indent(9)}`)).toEqual([]);

    expect(governedMarkdownSyntaxProblems(`  10. list\n\n${indent(5)}`)).toEqual([]);
    expect(governedMarkdownSyntaxProblems(`  10. list\n\n${indent(8)}`)).not.toEqual([]);
    expect(governedMarkdownSyntaxProblems(`  10. list\n\n${indent(10)}`)).toEqual([]);

    // CommonMark permits only 1–4 padding spaces and 1–9 ordered-marker digits.
    expect(governedMarkdownSyntaxProblems(`-     list\n\n${indent(6)}`)).not.toEqual([]);
    expect(governedMarkdownSyntaxProblems(`123456789. list\n\n${indent(11)}`)).not.toEqual([]);
    expect(governedMarkdownSyntaxProblems(`1234567890. paragraph\n\n${table}`)).toEqual([]);

    // Tabs after list markers are conservatively refused instead of guessing
    // their visual content column.
    expect(governedMarkdownSyntaxProblems(`-\tlist\n\n${indent(6)}`)).not.toEqual([]);
    expect(governedMarkdownSyntaxProblems(`1.\tlist\n\n${indent(7)}`)).not.toEqual([]);
  });

  test('nested blockquote/list stacks cannot hide governed headings', () => {
    for (const nested of [
      '> - list\n    ### 4.3 hidden',
      '> 1. list\n      ### 5.2 hidden',
      '- outer\n    - inner\n      ### 4.3 hidden',
      '- outer\n    - inner\n\n        ### 4.3 hidden',
      '- outer\n  > quote\n    ### 4.3 hidden',
    ]) {
      expect(governedMarkdownSyntaxProblems(nested)).not.toEqual([]);
    }

    // A blank followed by unindented structure closes the nested container;
    // the same heading is then genuinely top-level rather than hidden content.
    expect(governedMarkdownSyntaxProblems('- outer\n    - inner\n\n### 4.3 top-level')).toEqual([]);
    expect(governedMarkdownSyntaxProblems('> - list\n\n### 5.2 top-level')).toEqual([]);
  });

  test('nested blockquote/list stacks cannot hide governed tables', () => {
    const table = '| measure | value |\n|---|---|\n| rows | 999 |';
    const indent = (spaces: number) => table.split('\n').map((line) => `${' '.repeat(spaces)}${line}`).join('\n');

    for (const spaces of [4, 5]) {
      expect(governedMarkdownSyntaxProblems(`> - list\n${indent(spaces)}`)).not.toEqual([]);
    }
    for (const spaces of [6, 7, 8, 9]) {
      expect(governedMarkdownSyntaxProblems(`- outer\n    - inner\n${indent(spaces)}`)).not.toEqual([]);
    }
    expect(governedMarkdownSyntaxProblems(`- outer\n  > quote\n${indent(4)}`)).not.toEqual([]);

    // Four padding spaces after a list marker end that item before an
    // unindented GFM table; one to three spaces retain the lazy table.
    for (const marker of ['-    list', '1.    list']) {
      expect(governedMarkdownSyntaxProblems(`${marker}\n${table}`)).toEqual([]);
    }
    for (const marker of ['- list', '1. list']) {
      expect(governedMarkdownSyntaxProblems(`${marker}\n${table}`)).not.toEqual([]);
    }

    expect(governedMarkdownSyntaxProblems(`- outer\n    - inner\n\n${table}`)).toEqual([]);
  });

  test('tab-indented list continuations fail closed instead of hiding governed structure', () => {
    for (const nestedHeading of [
      '- list\n\t## 3. hidden identity',
      '- list\n\t### 4.3 hidden clamping',
      '1. list\n\t### 5.2 hidden comparison',
      '- list\n \t### 4.3 space-tab hidden',
      '- list\n\n\t4.3 hidden Setext\n\t---',
      '1. list\n\n\t5.2 hidden Setext\n\t---',
      '- outer\n    - inner\n\t### 4.3 nested-list tab hidden',
      '- outer\n    - inner\n\t\t### 5.2 deep tab hidden',
      '- \t### 4.3 marker-tab hidden',
      '-  \t### 4.3 marker-space-tab hidden',
      '1. \t### 5.2 ordered marker-tab hidden',
    ]) {
      expect(governedMarkdownSyntaxProblems(nestedHeading).join('\n')).toMatch(/tab indentation.*list container/i);
    }

    for (const nestedTable of [
      '- list\n\t| measure | value |\n\t|---|---|\n\t| rows | 999 |',
      '- list\n\t| position | n |\n\t|---|---|\n\t| QB | 999 |',
      '1. list\n\t| measure | value |\n\t|---|---|\n\t| joined rows | 999 |',
      '- \t| measure | value |\n  \t|---|---|\n  \t| rows | 999 |',
    ]) {
      expect(governedMarkdownSyntaxProblems(nestedTable).join('\n')).toMatch(/tab indentation.*list container/i);
    }

    // Without an active list, a leading tab is ordinary indented code and
    // cannot become a governed heading/table in the rendered document.
    expect(governedMarkdownSyntaxProblems('\t### 4.3 top-level code')).toEqual([]);
    expect(governedMarkdownSyntaxProblems('\t| measure | value |\n\t|---|---|\n\t| rows | 999 |')).toEqual([]);
    expect(governedMarkdownSyntaxProblems('- list\n\nclosed at top level\n\n\t### 5.2 top-level code')).toEqual([]);
  });

  test('tab-indented blockquote content fails closed instead of hiding governed structure', () => {
    for (const nestedHeading of [
      '> \t## 3. hidden identity',
      '> quote\n> \t### 4.3 hidden clamping',
      '> quote\n> \t### 5.2 hidden comparison',
      '> quote\n> \t4.3 hidden Setext\n> \t---',
      '>  \t### 4.3 two-space-tab hidden',
      '> > \t### 5.2 nested-quote-tab hidden',
    ]) {
      expect(governedMarkdownSyntaxProblems(nestedHeading).join('\n')).toMatch(/tab indentation.*blockquote container/i);
    }

    for (const nestedTable of [
      '> \t| measure | value |\n> \t|---|---|\n> \t| rows | 999 |',
      '> quote\n> \t| position | n |\n> \t|---|---|\n> \t| QB | 999 |',
      '> quote\n> \t| measure | value |\n> \t|---|---|\n> \t| joined rows | 999 |',
    ]) {
      expect(governedMarkdownSyntaxProblems(nestedTable).join('\n')).toMatch(/tab indentation.*blockquote container/i);
    }

    // A tab without a blockquote/list prefix remains ordinary top-level code.
    expect(governedMarkdownSyntaxProblems('\t### 4.3 top-level code')).toEqual([]);
    expect(governedMarkdownSyntaxProblems('\t| position | n |\n\t|---|---|\n\t| QB | 999 |')).toEqual([]);
  });

  test('marker-only list items retain their exact continuation indent', () => {
    for (const nestedHeading of [
      '-\n  ## 3. hidden identity',
      '1.\n   ### 4.3 hidden clamping',
      '10.\n    ### 5.2 hidden comparison',
      '-\n  4.3 hidden Setext\n  ---',
    ]) {
      expect(governedMarkdownSyntaxProblems(nestedHeading)).not.toEqual([]);
    }

    for (const [marker, spaces] of [['-', 2], ['1.', 3], ['10.', 4]] as const) {
      const indent = ' '.repeat(spaces);
      const nestedTable = `${marker}\n${indent}| measure | value |\n${indent}|---|---|\n${indent}| rows | 999 |`;
      expect(governedMarkdownSyntaxProblems(nestedTable)).not.toEqual([]);
    }

    // A blank closes a marker-only item, unlike a nonempty item's indented
    // continuation, so a following unindented heading is genuinely top-level.
    expect(governedMarkdownSyntaxProblems('-\n\n### 4.3 top-level after empty item')).toEqual([]);
  });

  test('overlong list-marker padding fails closed without weakening valid padding', () => {
    for (const ambiguous of [
      '-     code\n    ### 4.3 hidden',
      '1.     code\n    ### 5.2 hidden',
      '-     code\n    | measure | value |\n    |---|---|\n    | rows | 999 |',
    ]) {
      expect(governedMarkdownSyntaxProblems(ambiguous).join('\n')).toMatch(/overlong padding/i);
    }

    for (const padding of [1, 2, 3, 4]) {
      const spaces = ' '.repeat(padding);
      const continuation = ' '.repeat(1 + padding);
      expect(governedMarkdownSyntaxProblems(`-${spaces}list\n${continuation}### 4.3 hidden`)).not.toEqual([]);
    }
  });

  test('thematic breaks do not create list-container state for the following table', () => {
    const table = '| measure | value |\n|---|---|\n| rows | 999 |';
    for (const thematicBreak of ['- - -', '* * *', '_ _ _']) {
      expect(governedMarkdownSyntaxProblems(`${thematicBreak}\n${table}`)).toEqual([]);
    }
  });

  test('escaped emphasis/code stays literal and cannot become numeric evidence on a second pass', () => {
    for (const replacement of [
      '\\*\\*357\\*\\*',
      '\\`357\\`',
      '&#42;&#42;357&#42;&#42;',
      '3&#38;#53;7',
      '&#042;&#042;357&#042;&#042;',
      '&#x02a;&#x02a;357&#x02a;&#x02a;',
      '3&#038;#53;7',
      '3&#x026;#x35;7',
      '3&#38;&#35;53;7',
      '3&#x26;&#x23;x35;7',
      '&#92;*&#92;*357&#92;*&#92;*',
      '&#91;357&#93;(https://x)',
      '[357]&#40;https://x&#41;',
    ]) {
      const identityEscaped = report.replace('| rows | 357 |', `| rows | ${replacement} |`);
      expect(reportIdentityProblems(identityEscaped, manifest.cacheCohort.identity)).not.toEqual([]);
    }

    for (const replacement of ['\\*\\*38\\*\\*', '\\`38\\`']) {
      const clampingEscaped = report.replace(
        '| QB | 38 | 33.8 | 86.5 | 0 (0.0%) | 0 |',
        `| QB | ${replacement} | 33.8 | 86.5 | 0 (0.0%) | 0 |`,
      );
      expect(reportClampingProblems(clampingEscaped, clamping)).not.toEqual([]);
    }

    for (const replacement of ['\\*\\*50\\*\\*', '\\`50\\`']) {
      expect(reportComparisonProblems(report.replace('| joined rows | 50 |', `| joined rows | ${replacement} |`), dc))
        .not.toEqual([]);
    }
    // The real presentation used by the committed tables remains valid.
    expect(reportIdentityProblems(report, manifest.cacheCohort.identity)).toEqual([]);
    expect(reportClampingProblems(report, clamping)).toEqual([]);
    expect(reportComparisonProblems(report, dc)).toEqual([]);
  });

  test('processing instructions, CDATA, and declarations fail closed outside code only', () => {
    for (const html of ['<?audit hidden?>', '<![CDATA[### 4.3 hidden]]>', '<!DOCTYPE html>']) {
      expect(governedMarkdownSyntaxProblems(`${report}\n${html}`)).not.toEqual([]);
      expect(governedMarkdownSyntaxProblems(`${report}\n\`\`\`\n${html}\n\`\`\``)).toEqual([]);
      expect(governedMarkdownSyntaxProblems(`${report}\n    ${html}`)).toEqual([]);
    }
  });
});

describe('governed table schemas are exact and order-independent', () => {
  const REPORT_PATH = path.join(REPO_ROOT, 'docs/audits/2026-08-09-railway-forge-cache-audit.md');
  const report = fs.readFileSync(REPORT_PATH, 'utf8');
  const clamping = manifest.clamping;
  const dc = manifest.comparability.descriptiveComparison;

  const mutateTable = (
    source: string,
    headerLine: string,
    transform: (rows: string[][]) => string[][],
    afterHeading?: RegExp,
  ) => {
    const lines = source.split('\n');
    const lowerBound = afterHeading ? lines.findIndex((line) => afterHeading.test(line)) : -1;
    const start = lines.findIndex((line, index) => index > lowerBound && line === headerLine);
    expect(start).toBeGreaterThan(-1);
    let end = start;
    while (lines[end]?.trim().startsWith('|')) end += 1;
    const parse = (line: string) => line.trim().split('|').slice(1, -1).map((cell) => cell.trim());
    const render = (cells: string[]) => `| ${cells.join(' | ')} |`;
    lines.splice(start, end - start, ...transform(lines.slice(start, end).map(parse)).map(render));
    return lines.join('\n');
  };

  test.each(['position', 'n', 'min', 'max', 'at floor 25.0', 'at ceiling 95.0'])('duplicate clamping column "%s" fails', (column) => {
    const header = '| position | n | min | max | at floor 25.0 | at ceiling 95.0 |';
    const tampered = mutateTable(report, header, (rows) => {
      const index = rows[0].indexOf(column);
      return rows.map((row) => [...row, row[index]]);
    });
    expect(reportClampingProblems(tampered, clamping).join('\n')).toMatch(/repeats the/);
  });

  test('unknown clamping columns fail, while all six governed columns may be reordered', () => {
    const header = '| position | n | min | max | at floor 25.0 | at ceiling 95.0 |';
    const order = [5, 0, 4, 1, 3, 2];
    const reordered = mutateTable(report, header, (rows) => rows.map((row) => order.map((index) => row[index])));
    expect(reportClampingProblems(reordered, clamping)).toEqual([]);

    const unknown = mutateTable(report, header, (rows) => rows.map((row, index) => [
      ...row,
      index === 0 ? 'note' : index === 1 ? '---' : 'x',
    ]));
    expect(reportClampingProblems(unknown, clamping).join('\n')).toMatch(/unknown "note" column/);
  });

  test.each(['measure', 'value'])('§5.2 rejects a duplicate "%s" column', (column) => {
    const header = '| measure | value |';
    const duplicated = mutateTable(report, header, (rows) => {
      const index = rows[0].indexOf(column);
      return rows.map((row) => [...row, row[index]]);
    }, /^### 5\.2 /);
    expect(reportComparisonProblems(duplicated, dc).join('\n')).toMatch(new RegExp(`repeats the "${column}" column`));
  });

  test('§5.2 rejects unknown columns but supports value/measure order', () => {
    const header = '| measure | value |';
    const unknown = mutateTable(report, header, (rows) => rows.map((row, index) => [
      ...row,
      index === 0 ? 'note' : index === 1 ? '---' : 'x',
    ]), /^### 5\.2 /);
    expect(reportComparisonProblems(unknown, dc).join('\n')).toMatch(/unknown "note" column/);

    const reordered = mutateTable(report, header, (rows) => rows.map((row) => [row[1], row[0]]), /^### 5\.2 /);
    expect(reportComparisonProblems(reordered, dc)).toEqual([]);
  });

  test('§5.2 rejects an unexpected summary row and a heading with no shared-player count', () => {
    const unexpected = report.replace('| joined rows | 50 |', '| joined rows | 50 |\n| invented measure | 1 |');
    expect(reportComparisonProblems(unexpected, dc).join('\n')).toMatch(/unexpected "invented measure" row/);

    const noCount = report.replace(
      '### 5.2 Descriptive comparison across the 50 shared players',
      '### 5.2 Descriptive comparison across the shared players',
    );
    expect(reportComparisonProblems(noCount, dc).join('\n')).toMatch(/does not state the shared-player count/);
  });

  test('arbitrary extra tables fail the total-table invariant in §3, §4.3, and §5.2', () => {
    const arbitrary = '\n\n| arbitrary | claim |\n|---|---|\n| x | y |';
    const afterIdentity = report.replace(
      '| cross-surface resolvability | **unavailable — requires database** |',
      `| cross-surface resolvability | **unavailable — requires database** |${arbitrary}`,
    );
    expect(reportIdentityProblems(afterIdentity, manifest.cacheCohort.identity).join('\n')).toMatch(/§3 section carries 2 tables/);

    const afterClamp = report.replace(
      '| **total** | **357** | | | **116 (32.5%)** | **7** |',
      `| **total** | **357** | | | **116 (32.5%)** | **7** |${arbitrary}`,
    );
    expect(reportClampingProblems(afterClamp, clamping).join('\n')).toMatch(/§4\.3 section carries 3 tables/);

    const afterComparison = report.replace(
      '| Brock Bowers | `00-0039338` | TE | 72.43 | 90 | +17.57 |',
      `| Brock Bowers | \`00-0039338\` | TE | 72.43 | 90 | +17.57 |${arbitrary}`,
    );
    expect(reportComparisonProblems(afterComparison, dc).join('\n')).toMatch(/§5\.2 section carries 3 tables/);
  });

  test('declared bounds are checked by exact schema, exact rows, and manifest values', () => {
    const header = '| position | p10 | p90 | outMin | outMax |';
    const wrongValue = report.replace('| WR | 31 | 76 | 25 | 95 |', '| WR | 999 | 76 | 25 | 95 |');
    expect(reportClampingProblems(wrongValue, clamping).join('\n')).toMatch(/WR declared p10/);

    const duplicateColumn = mutateTable(report, header, (rows) => rows.map((row) => [...row, row[1]]));
    expect(reportClampingProblems(duplicateColumn, clamping).join('\n')).toMatch(/repeats the "p10" column/);

    const missingRow = report.replace('| QB | 35 | 73 | 25 | 95 |\n', '');
    expect(reportClampingProblems(missingRow, clamping).join('\n')).toMatch(/no "QB" row/);

    const unexpectedRow = report.replace(
      '| QB | 35 | 73 | 25 | 95 |',
      '| QB | 35 | 73 | 25 | 95 |\n| K | 1 | 2 | 25 | 95 |',
    );
    expect(reportClampingProblems(unexpectedRow, clamping).join('\n')).toMatch(/unexpected "k" row/);

    const order = [4, 0, 2, 1, 3];
    const reordered = mutateTable(report, header, (rows) => rows.map((row) => order.map((index) => row[index])));
    expect(reportClampingProblems(reordered, clamping)).toEqual([]);
  });

  test('observed-clamping floor and ceiling header bounds are manifest-pinned with one decimal', () => {
    for (const [from, to, expected] of [
      ['at floor 25.0', 'at floor 25', /must render as "at floor 25\.0"/],
      ['at ceiling 95.0', 'at ceiling 94.0', /must render as "at ceiling 95\.0"/],
    ] as const) {
      expect(reportClampingProblems(report.replace(from, to), clamping).join('\n')).toMatch(expected);
    }
  });

  test('observed clamping rejects blank rows and invented ceiling percentages', () => {
    const blank = report.replace(
      '| **total** | **357** | | | **116 (32.5%)** | **7** |',
      '| **total** | **357** | | | **116 (32.5%)** | **7** |\n| | 999 | 1 | 2 | 3 (4.0%) | 5 |',
    );
    expect(reportClampingProblems(blank, clamping).join('\n')).toMatch(/unexpected "\(blank\)" row/);
    const ceilingPct = report.replace(
      '| QB | 38 | 33.8 | 86.5 | 0 (0.0%) | 0 |',
      '| QB | 38 | 33.8 | 86.5 | 0 (0.0%) | 0 (99.9%) |',
    );
    expect(reportClampingProblems(ceilingPct, clamping).join('\n')).toMatch(/at-ceiling percentage/);
  });

  test('governed numeric cells reject prose that merely embeds the expected number', () => {
    expect(reportClampingProblems(report.replace('| QB | 35 | 73 | 25 | 95 |', '| QB | not 35 | 73 | 25 | 95 |'), clamping)).not.toEqual([]);
    expect(reportComparisonProblems(report.replace('| joined rows | 50 |', '| joined rows | not 50 |'), dc)).not.toEqual([]);
    expect(reportComparisonProblems(
      report.replace('| Mark Andrews | `00-0034753` | TE | 70.01 | 44 | -26.01 |', '| Mark Andrews | `00-0034753` | TE | not 70.01 | 44 | -26.01 |'),
      dc,
    )).not.toEqual([]);
  });

  test('comparison row aliases are exact, not numeric prefixes', () => {
    expect(reportComparisonProblems(report.replace('within ±1.0 alpha', 'within ±10.0 alpha'), dc).join('\n'))
      .toMatch(/no "within ±1\.0 alpha" row/);
    expect(reportComparisonProblems(report.replace('within ±1.0 alpha', 'within ±1 std dev'), dc).join('\n'))
      .toMatch(/unexpected "within ±1 std dev" row/);
  });

  test('qualitative identity and comparison templates reject embedded or contradictory clauses', () => {
    const notCount = report.replace(
      '### 5.2 Descriptive comparison across the 50 shared players',
      '### 5.2 Descriptive comparison across the not 50 shared players',
    );
    expect(reportComparisonProblems(notCount, dc)).not.toEqual([]);

    for (const tampered of [
      report.replace('**357** (zero duplicates)', '**357** (zero duplicates, but 1 duplicate ID)'),
      report.replace(
        '**not recorded** — the capture predates the per-item identity envelope',
        '**not recorded** — the capture predates the per-item identity envelope, but it was recorded at 100%',
      ),
      report.replace('**unavailable — requires database**', '**unavailable — requires database, but actually available**'),
      report.replace('GSIS-shaped (`00-` + 7 digits)', 'GSIS-shaped impostors'),
    ]) {
      expect(reportIdentityProblems(tampered, manifest.cacheCohort.identity)).not.toEqual([]);
    }
  });

  test('distinct and duplicate identifier counts are parsed independently', () => {
    const identity = {
      ...manifest.cacheCohort.identity,
      totalRows: 360,
      distinctIds: 357,
      duplicateIds: ['00-0000001'],
      gsisShaped: 360,
      gsisShapedPct: 100,
    };
    const source = report
      .replace('| rows | 357 |', '| rows | 360 |')
      .replace('| distinct identifiers | **357** (zero duplicates) |', '| distinct identifiers | **357** (1 duplicate ID, 3 excess rows) |')
      .replace('| GSIS-shaped (`00-` + 7 digits) | **357 (100.0%)** |', '| GSIS-shaped (`00-` + 7 digits) | **360 (100.0%)** |')
      .replace('| other namespaces | 0 |', '| other namespaces | 0 |');
    expect(reportIdentityProblems(source, identity)).toEqual([]);
  });

  test('largest-disagreement rows are manifest-pinned in order with an exact reorderable schema', () => {
    const header = '| player | GSIS | pos | static alpha | cache alpha | delta |';
    const wrong = report.replace(
      '| Mark Andrews | `00-0034753` | TE | 70.01 | 44 | -26.01 |',
      '| Mark Andrews | `00-0034753` | TE | 70.01 | 44 | -99 |',
    );
    expect(reportComparisonProblems(wrong, dc).join('\n')).toMatch(/row 1 states delta/);

    const lines = report.split('\n');
    const mark = lines.findIndex((line) => line.startsWith('| Mark Andrews |'));
    const zay = lines.findIndex((line) => line.startsWith('| Zay Flowers |'));
    [lines[mark], lines[zay]] = [lines[zay], lines[mark]];
    expect(reportComparisonProblems(lines.join('\n'), dc).join('\n')).toMatch(/row 1 states player/);

    const missing = report.replace('| Brock Bowers | `00-0039338` | TE | 72.43 | 90 | +17.57 |\n', '');
    expect(reportComparisonProblems(missing, dc).join('\n')).toMatch(/carries 4 rows/);

    const duplicateColumn = mutateTable(report, header, (rows) => rows.map((row) => [...row, row[5]]), /^### 5\.2 /);
    expect(reportComparisonProblems(duplicateColumn, dc).join('\n')).toMatch(/repeats the "delta" column/);

    const order = [1, 0, 5, 2, 4, 3];
    const reordered = mutateTable(report, header, (rows) => rows.map((row) => order.map((index) => row[index])), /^### 5\.2 /);
    expect(reportComparisonProblems(reordered, dc)).toEqual([]);
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
  const exactAgreementNarrative =
    '**The two artifacts agree exactly on none of the 50 shared players.**';

  const insertImmediatelyAfterExactNarrative = (block: string) => {
    const marker = `${exactAgreementNarrative}\n\n`;
    expect(report).toContain(marker);
    return report.replace(marker, `${exactAgreementNarrative}\n${block}\n\n`);
  };

  const insertAfterExactNarrativeBoundary = (block: string) => {
    const marker = `${exactAgreementNarrative}\n\n`;
    expect(report).toContain(marker);
    return report.replace(marker, `${exactAgreementNarrative}\n\n${block}\n\n`);
  };

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

  test('the exact none-to-all prose mutation is rejected while both governed tables stay intact', () => {
    expect(report).toContain(exactAgreementNarrative);
    const tampered = report.replace(
      exactAgreementNarrative,
      '**The two artifacts agree exactly on all of the 50 shared players.**',
    );
    expect(tampered).not.toBe(report);
    expect(readMarkdownSections(tampered, COMPARISON_SECTION_HEADING)[0].tables).toHaveLength(2);
    expect(reportComparisonProblems(tampered, dc).join('\n'))
      .toMatch(/exact-agreement narrative.*manifest requires/i);
  });

  test('invisible reference definitions before §5.2 do not shift narrative section membership', () => {
    const definitions = Array.from(
      { length: 100 },
      (_, index) => `[unused-${index}]: https://example.invalid/${index}`,
    ).join('\n');
    expect(reportComparisonProblems(`${definitions}\n\n${report}`, dc)).toEqual([]);
  });

  test.each(['before', 'after']) (
    'a reference definition %s §5.2 remains available to the governed paragraph',
    (placement) => {
      const presented = report.replace(
        exactAgreementNarrative,
        '**The two artifacts [agree][exact-claim] exactly on none of the 50 shared players.**',
      );
      const definition = '[exact-claim]: https://example.invalid/exact-claim';
      const withDefinition = placement === 'before'
        ? `${definition}\n\n${presented}`
        : `${presented}\n\n${definition}\n`;
      expect(reportComparisonProblems(withDefinition, dc)).toEqual([]);
    },
  );

  test.each([
    ['ATX heading', '# Follow-on heading'],
    ['bullet list', '- Follow-on item'],
    ['ordered list', '1. Follow-on item'],
    ['blockquote', '> Follow-on quotation'],
    ['thematic break', '***'],
  ])('a real GFM %s immediately after the exact sentence is a separate block', (_label, block) => {
    expect(reportComparisonProblems(insertImmediatelyAfterExactNarrative(block), dc)).toEqual([]);
  });

  test.each([
    ['ATX heading', '# These artifacts agree exactly on all of the 50 shared players.'],
    ['tight bullet', '- These artifacts agree exactly on all of the 50 shared players.'],
    ['tight ordered item', '1. These artifacts agree exactly on all of the 50 shared players.'],
    ['blockquote', '> These artifacts agree exactly on all of the 50 shared players.'],
    ['soft-wrapped blockquote', '> These artifacts agree\n> exactly on all of the 50 shared players.'],
    ['decreasing quote depth', '>> These artifacts agree\n> exactly on all of the 50 shared players.'],
    ['backslash hard break', 'These artifacts\\\nagree exactly on all of the 50 shared players.'],
    ['HTML named whitespace', 'These artifacts&ThinSpace;agree exactly on all of the 50 shared players.'],
    ['reference link', 'These artifacts [agree][claim] exactly on all of the 50 shared players.\n\n[claim]: https://example.invalid/'],
  ])('a rendered same-root contradiction in %s remains globally visible', (_label, block) => {
    expect(reportComparisonProblems(`${report}\n\n${block}\n`, dc).join('\n'))
      .toMatch(/2 visible narrative claims rooted at "artifacts agree exactly on"/i);
  });

  test('noninterrupting top-level ordered-2 text remains in the governed paragraph', () => {
    expect(reportComparisonProblems(
      insertImmediatelyAfterExactNarrative('2. This is still the same rendered paragraph.'),
      dc,
    ).join('\n')).toMatch(/exact-agreement narrative.*manifest requires/i);
  });

  test.each(['---', '==='])(
    'an immediate Setext underline (%s) promotes the claim to a heading and fails',
    (underline) => {
      expect(reportComparisonProblems(insertImmediatelyAfterExactNarrative(underline), dc).join('\n'))
        .toMatch(/rendered as a heading/i);
      expect(reportComparisonProblems(insertAfterExactNarrativeBoundary(underline), dc)).toEqual([]);
    },
  );

  test('no-blank indented continuation is prose, while blank-separated indented code is inert', () => {
    expect(reportComparisonProblems(
      insertImmediatelyAfterExactNarrative('    Harmless continuation text.'),
      dc,
    ).join('\n')).toMatch(/exact-agreement narrative.*manifest requires/i);
    expect(reportComparisonProblems(
      insertAfterExactNarrativeBoundary('    These artifacts agree exactly on all of the 50 shared players.'),
      dc,
    )).toEqual([]);
  });

  test.each([
    '```text\nThese artifacts agree exactly on all of the 50 shared players.\n```',
    '> ```text\n> These artifacts agree exactly on all of the 50 shared players.\n> ```',
    '- item\n  ```text\n  These artifacts agree exactly on all of the 50 shared players.\n  ```',
  ])('same-root examples in a rendered code block remain inert', (block) => {
    expect(reportComparisonProblems(`${report}\n\n${block}\n`, dc)).toEqual([]);
  });

  test.each([
    '> ```text\nThese artifacts agree exactly on all of the 50 shared players.\n> ```',
    '- item\n  ```text\nThese artifacts agree exactly on all of the 50 shared players.\n  ```',
  ])('prose after exiting a nested fence is reprocessed as visible', (block) => {
    expect(reportComparisonProblems(`${report}\n\n${block}\n`, dc).join('\n'))
      .toMatch(/2 visible narrative claims rooted at "artifacts agree exactly on"/i);
  });

  test('strikethrough and image alt text cannot satisfy the sole governed sentence', () => {
    for (const replacement of [
      '~~The two artifacts agree exactly on none of the 50 shared players.~~',
      '![The two artifacts agree exactly on none of the 50 shared players.](missing.png)',
    ]) {
      const tampered = report.replace(exactAgreementNarrative, replacement);
      expect(reportComparisonProblems(tampered, dc).join('\n'))
        .toMatch(/strikethrough text|image alt text/i);
    }
  });

  test('presentation inside image alt text cannot hide a duplicate visible claim', () => {
    for (const presentedAgree of [
      '**agree**',
      '[agree](https://example.invalid/claim)',
      '`agree`',
      '~~agree~~',
    ]) {
      const contradictory =
        `${report}\n\n![These artifacts ${presentedAgree} exactly on all of the 50 shared players.](missing.png)\n`;
      expect(reportComparisonProblems(contradictory, dc).join('\n'))
        .toMatch(/2 visible narrative claims rooted at "artifacts agree exactly on"/i);
    }
  });

  test('image alt attributes decode entities once after presentation is flattened', () => {
    for (const splitEntity of [
      '![These artifacts&nb`sp;`agree exactly on all of the 50 shared players.](missing.png)',
      '![These artifacts&nb[sp;](https://example.invalid/)agree exactly on all of the 50 shared players.](missing.png)',
    ]) {
      const contradictory = `${report}\n\n${splitEntity}\n`;
      expect(reportComparisonProblems(contradictory, dc).join('\n'))
        .toMatch(/2 visible narrative claims rooted at "artifacts agree exactly on"/i);
    }
  });

  test('semicolonless entity text followed by an alphanumeric stays literal in image alt attributes', () => {
    const literalAlt =
      `${report}\n\n![These artifacts&nbspagree exactly on all of the 50 shared players.](missing.png)\n`;
    expect(reportComparisonProblems(literalAlt, dc)).toEqual([]);
  });

  test('a hard-break token is removed when Marked flattens image alt text', () => {
    const flattenedAlt =
      `${report}\n\n![These artifacts  \nagree exactly on all of the 50 shared players.](missing.png)\n`;
    expect(reportComparisonProblems(flattenedAlt, dc)).toEqual([]);
  });

  test.each([
    '***agree***',
    '**_agree_**',
    '[*agree*](https://example.invalid/)',
    '~~**agree**~~',
    '**[agree](https://example.invalid/)**',
    '[**agree**](https://example.invalid/)',
    '*`agree`*',
  ]) (
    'nested image-alt presentation %s retains its inner literal markers',
    (presentedAgree) => {
      const literalMarkers =
        `${report}\n\n![These artifacts ${presentedAgree} exactly on all of the 50 shared players.](missing.png)\n`;
      expect(reportComparisonProblems(literalMarkers, dc)).toEqual([]);
    },
  );

  test('literal image-label quotes terminate Marked alt attributes, while entity quotes remain data', () => {
    for (const quoteSource of ['"', '\\"']) {
      const terminated =
        `${report}\n\n![${quoteSource} These artifacts agree exactly on all of the 50 shared players.](missing.png)\n`;
      expect(reportComparisonProblems(terminated, dc)).toEqual([]);
    }
    const entityQuote =
      `${report}\n\n![&quot; These artifacts agree exactly on all of the 50 shared players.](missing.png)\n`;
    expect(reportComparisonProblems(entityQuote, dc).join('\n'))
      .toMatch(/2 visible narrative claims rooted at "artifacts agree exactly on"/i);
  });

  test.each(['&nbspagree', '&#32agree']) (
    'semicolonless prose entity source %s remains literal rather than manufacturing whitespace',
    (entitySource) => {
      const literalProse =
        `${report}\n\nThese artifacts${entitySource} exactly on all of the 50 shared players.\n`;
      expect(reportComparisonProblems(literalProse, dc)).toEqual([]);
    },
  );

  test('inline token boundaries cannot manufacture a whitespace entity', () => {
    for (const replacement of [
      'The two artifacts&nb`sp;`agree exactly on none of the 50 shared players.',
      'The two artifacts&nb[sp;](https://example.invalid/)agree exactly on none of the 50 shared players.',
      'The two artifacts`&nbsp;`agree exactly on none of the 50 shared players.',
    ]) {
      const tampered = report.replace(exactAgreementNarrative, replacement);
      expect(reportComparisonProblems(tampered, dc)).not.toEqual([]);
    }
  });

  test('the exact prose template follows the manifest count rather than a pinned none/50 literal', () => {
    const oneAgreement = { ...dc, exactAgreement: 1 };
    const adjusted = editCell('exact agreement', '1').replace(
      exactAgreementNarrative,
      '**The two artifacts agree exactly on 1 of the 50 shared players.**',
    );
    expect(reportComparisonProblems(adjusted, oneAgreement)).toEqual([]);
  });

  test('a second visible same-root prose claim anywhere in the report is rejected while the required sentence remains', () => {
    expect(report).toContain(exactAgreementNarrative);
    const contradictory =
      `${report}\n\nThese artifacts agree exactly on all of the 50 shared players.\n`;
    expect(contradictory).not.toBe(report);
    expect(reportComparisonProblems(contradictory, dc).join('\n'))
      .toMatch(/2 visible narrative claims rooted at "artifacts agree exactly on"/i);
  });

  test('bounded inline presentation cannot hide a same-root contradiction', () => {
    for (const presentedRoot of [
      '`artifacts agree exactly on`',
      '**artifacts agree exactly on**',
      '[artifacts agree exactly on](https://example.invalid/claim)',
    ]) {
      const contradictory =
        `${report}\n\nThese ${presentedRoot} all of the 50 shared players.\n`;
      expect(reportComparisonProblems(contradictory, dc).join('\n'))
        .toMatch(/2 visible narrative claims rooted at "artifacts agree exactly on"/i);
    }
  });

  test('rendered whitespace inside a link label remains part of the visible claim', () => {
    const contradiction =
      `${report}\n\nThese artifacts[ agree ](https://example.invalid/)exactly on all of the 50 shared players.\n`;
    expect(reportComparisonProblems(contradiction, dc).join('\n'))
      .toMatch(/2 visible narrative claims rooted at "artifacts agree exactly on"/i);
  });

  test.each(['\u200E', '\u200F', '\u061C', '\u2066', '\u00AD', '\u034F']) (
    'reader-invisible Unicode format control U+%s cannot split a visible claim root',
    (formatControl) => {
      const contradiction =
        `${report}\n\nThese artifacts${formatControl} agree exactly on all of the 50 shared players.\n`;
      expect(reportComparisonProblems(contradiction, dc).join('\n'))
        .toMatch(/2 visible narrative claims rooted at "artifacts agree exactly on"/i);
    },
  );

  test('unsupported reference-link and strikethrough presentation fail closed around the same root', () => {
    for (const contradiction of [
      'These artifacts [agree][claim] exactly on all of the 50 shared players.\n\n[claim]: https://example.invalid/',
      'These artifacts ~~agree~~ exactly on all of the 50 shared players.',
    ]) {
      const tampered = `${report}\n\n${contradiction}\n`;
      expect(reportComparisonProblems(tampered, dc).join('\n'))
        .toMatch(/2 visible narrative claims rooted at "artifacts agree exactly on"/i);
    }
  });

  test('same-root examples in fenced or indented code remain inert under the bounded prose guard', () => {
    expect(report).toContain(exactAgreementNarrative);
    for (const inertExample of [
      '```text\nThese artifacts agree exactly on all of the 50 shared players.\n```',
      '    These artifacts agree exactly on all of the 50 shared players.',
    ]) {
      const withExample = report.replace(
        exactAgreementNarrative,
        `${exactAgreementNarrative}\n\n${inertExample}`,
      );
      expect(reportComparisonProblems(withExample, dc)).toEqual([]);
    }
  });

  test('fenced text resembling internal section markers is inert and cannot collide', () => {
    const withMarkerExamples = `${report}\n\n\`\`\`html\n` +
      '<!--tiber-audit-governed-section-start-->\n' +
      '<!--tiber-audit-governed-section-end-->\n' +
      '<!--tiber-audit-governed-section-start-0-->\n' +
      '<!--tiber-audit-governed-section-end-0-->\n' +
      '\`\`\`\n';
    expect(() => reportComparisonProblems(withMarkerExamples, dc)).not.toThrow();
    expect(reportComparisonProblems(withMarkerExamples, dc)).toEqual([]);
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

  describe('a repeated governed row is caught, not silently collapsed to whichever value was seen first', () => {
    /** Insert a line directly after the real "| joined rows | ... |" row. */
    const insertAfterJoinedRows = (line: string) => {
      const marker = '| joined rows | 50 |';
      expect(report).toContain(marker);
      return report.replace(marker, `${marker}\n${line}`);
    };

    test('an identical duplicate "joined rows" row still fails — the ambiguity is the defect, not the disagreement', () => {
      const duplicated = insertAfterJoinedRows('| joined rows | 50 |');
      const problems = reportComparisonProblems(duplicated, dc);
      expect(problems.join('\n')).toMatch(/repeats the "joined rows" row/);
      expect(problems.join('\n')).toMatch(/2 rows match/);
    });

    test('a conflicting duplicate "joined rows" row fails too', () => {
      const conflicting = insertAfterJoinedRows('| joined rows | 51 |');
      const problems = reportComparisonProblems(conflicting, dc);
      expect(problems.join('\n')).toMatch(/repeats the "joined rows" row/);
    });

    test('a textually different unsupported label is unexpected, not an alias', () => {
      const pattern = /^(\|\s*within ±1[^|]*\|\s*)([^|]*?)(\s*\|)$/m;
      expect(report).toMatch(pattern);
      const withExtraRow = report.replace(pattern, (full) => `${full}\n| within ±1 std dev | 9 |`);
      expect(withExtraRow).not.toBe(report);
      const problems = reportComparisonProblems(withExtraRow, dc);
      expect(problems.join('\n')).toMatch(/unexpected "within ±1 std dev" row/);
    });

    test('a repeated "range" row fails independently of the other governed measures', () => {
      const pattern = /^(\|\s*range\s*\|\s*)([^|]*?)(\s*\|)$/m;
      expect(report).toMatch(pattern);
      const duplicated = report.replace(pattern, (full) => `${full}\n${full}`);
      expect(duplicated).not.toBe(report);
      const problems = reportComparisonProblems(duplicated, dc);
      expect(problems.join('\n')).toMatch(/repeats the "range" row/);
      // Every other governed measure is untouched and still passes.
      expect(problems.filter((p) => !/range/.test(p))).toEqual([]);
    });

    test('the committed report itself carries no repeated governed row', () => {
      expect(reportComparisonProblems(report, dc)).toEqual([]);
    });
  });

  describe('§5.2 is identified by its number, keyed the same way as §4.3', () => {
    const lines = report.split('\n');
    const headingIndex = lines.findIndex((l) => COMPARISON_SECTION_HEADING.test(l));
    const headingLevel = /^(#{1,6})\s/.exec(lines[headingIndex].trim())![1].length;
    let sectionEnd = lines.length;
    for (let i = headingIndex + 1; i < lines.length; i += 1) {
      const next = /^(#{1,6})\s/.exec(lines[i].trim());
      if (next && next[1].length <= headingLevel) { sectionEnd = i; break; }
    }
    const appendAfterSection = (block: string[]) =>
      [...lines.slice(0, sectionEnd), '', ...block, '', ...lines.slice(sectionEnd)].join('\n');

    const conflictingTable = [
      '| measure | value |',
      '|---|---:|',
      '| joined rows | 51 |',
      '| exact agreement | 7 |',
    ];

    test('sanity: §5.2 is found and is distinct from the "5.2b" superseded section', () => {
      expect(headingIndex).toBeGreaterThan(-1);
      expect(lines[headingIndex]).toMatch(/^### 5\.2 /);
      expect(readMarkdownSections(report, COMPARISON_SECTION_HEADING)).toHaveLength(1);
    });

    test('a verbatim duplicate §5.2 heading with a conflicting table fails', () => {
      const duplicated = appendAfterSection([lines[headingIndex], '', ...conflictingTable]);
      expect(reportComparisonProblems(duplicated, dc).join('\n'))
        .toMatch(/2 sections whose heading matches §5\.2.*exactly one/);
    });

    test('a RETITLED duplicate §5.2 heading still fails — identity is the number, not the phrase', () => {
      const retitled = appendAfterSection([
        '### 5.2 A completely different title, same section number',
        '',
        ...conflictingTable,
      ]);
      expect(reportComparisonProblems(retitled, dc).join('\n'))
        .toMatch(/2 sections whose heading matches §5\.2.*exactly one/);
    });

    test('a bare-heading duplicate with NO table still fails — uniqueness is a property of the heading', () => {
      const bareHeading = appendAfterSection(['### 5.2 Retained for reference', '', 'No table here.']);
      expect(reportComparisonProblems(bareHeading, dc).join('\n'))
        .toMatch(/2 sections whose heading matches §5\.2.*exactly one/);
    });

    test('a second correctly-shaped table WITHIN the single §5.2 section also fails', () => {
      const withSecondTable = [
        ...lines.slice(0, sectionEnd),
        '',
        ...conflictingTable,
        ...lines.slice(sectionEnd),
      ].join('\n');
      expect(reportComparisonProblems(withSecondTable, dc).join('\n'))
        .toMatch(/2 descriptive-comparison tables; exactly one/);
    });

    test('5.20 and 5.2.1 lookalikes are refused, and so is the report\'s own superseded "5.2b"', () => {
      expect(COMPARISON_SECTION_HEADING.test('### 5.20 Something else entirely')).toBe(false);
      expect(COMPARISON_SECTION_HEADING.test('### 5.2.1 A subsection')).toBe(false);
      expect(COMPARISON_SECTION_HEADING.test('### 5.2b Original finding, superseded')).toBe(false);
      // None of these register as a second §5.2 match when appended.
      for (const heading of ['### 5.20 Something else entirely', '### 5.2.1 A subsection']) {
        const withLookalike = appendAfterSection([heading, '', ...conflictingTable]);
        expect(reportComparisonProblems(withLookalike, dc)).toEqual([]);
      }
    });
  });
});

describe('fenced code blocks: a closer must match the opener\'s character and length', () => {
  const HEADING = /^#{1,6}\s+9\.9(?!\w)(?!\.\d)/;
  const table = [
    '| position | n | min | max | at floor 25.0 | at ceiling 95.0 |',
    '|---|---:|---:|---:|---:|---:|',
    '| QB | 1 | 1 | 1 | 0 (0.0%) | 0 |',
  ];

  test('a shorter closer does not end the fence — the heading/table inside stays fenced content', () => {
    const doc = ['````', '### 9.9 Fenced', '', ...table, '```', 'still fenced', '````'].join('\n');
    expect(readMarkdownSections(doc, HEADING)).toHaveLength(0);
  });

  test('an equal-length closer ends the fence', () => {
    const doc = ['```', '### 9.9 Fenced', '```', '', '### 9.9 Real', '', ...table].join('\n');
    // The first "### 9.9 Fenced" never counts; the second, unfenced heading does.
    const sections = readMarkdownSections(doc, HEADING);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe('### 9.9 Real');
  });

  test('a longer closer ends the fence too', () => {
    const doc = ['```', '### 9.9 Fenced', '`````', '', '### 9.9 Real', '', ...table].join('\n');
    const sections = readMarkdownSections(doc, HEADING);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe('### 9.9 Real');
  });

  test('the opposite delimiter character does not close a fence', () => {
    const doc = ['```', '### 9.9 Fenced', '~~~', 'still fenced', '```', '', '### 9.9 Real', '', ...table].join('\n');
    const sections = readMarkdownSections(doc, HEADING);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe('### 9.9 Real');
  });

  test('a run with trailing suffix text is not a closer — only whitespace may follow it', () => {
    const doc = ['```', '### 9.9 Fenced', '``` js', 'still fenced', '```', '', '### 9.9 Real', '', ...table].join('\n');
    const sections = readMarkdownSections(doc, HEADING);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe('### 9.9 Real');
  });

  test('tilde fences follow the same rule', () => {
    const doc = ['~~~~', '### 9.9 Fenced', '~~~', 'still fenced', '~~~~', '', '### 9.9 Real', '', ...table].join('\n');
    const sections = readMarkdownSections(doc, HEADING);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe('### 9.9 Real');
  });

  test('an unfenced heading/table pair (no fence involved) is found normally', () => {
    const doc = ['### 9.9 Real', '', ...table].join('\n');
    const sections = readMarkdownSections(doc, HEADING);
    expect(sections).toHaveLength(1);
    expect(sections[0].tables[0]?.rows.length).toBe(1);
  });
});

describe('fence opener info strings: a backtick fence with a raw backtick in its info string is not a fence at all', () => {
  const clampingTable = [
    '| position | n | min | max | at floor 25.0 | at ceiling 95.0 |',
    '|---|---:|---:|---:|---:|---:|',
    '| QB | 1 | 1 | 1 | 0 (0.0%) | 0 |',
  ];
  const comparisonTable = ['| measure | value |', '|---|---:|', '| joined rows | 1 |'];

  test('an invalid backtick opener near §4.3 does not hide a duplicate heading — it stays ordinary text', () => {
    // CommonMark: a backtick fence's info string may not contain a raw
    // backtick. This line is therefore not an opener at all, so the
    // heading right after it is NOT fenced content — it is a real, visible
    // second §4.3 heading, and the exactly-one-section gate must catch it.
    const doc = [
      '### 4.3 Real section',
      '',
      ...clampingTable,
      '',
      '```bad`info',
      '### 4.3 Duplicate, meant to look fenced',
      '',
      ...clampingTable,
      '```',
    ].join('\n');
    expect(readMarkdownSections(doc, CLAMPING_SECTION_HEADING)).toHaveLength(2);
  });

  test('an invalid backtick opener near §5.2 does not hide a duplicate heading either', () => {
    const doc = [
      '### 5.2 Real section',
      '',
      ...comparisonTable,
      '',
      '```bad`info',
      '### 5.2 Duplicate, meant to look fenced',
      '',
      ...comparisonTable,
      '```',
    ].join('\n');
    expect(readMarkdownSections(doc, COMPARISON_SECTION_HEADING)).toHaveLength(2);
  });

  test('a valid backtick info string (no raw backtick) still opens a real fence', () => {
    const doc = [
      '```js',
      '### 4.3 Fenced, must not count',
      '',
      ...clampingTable,
      '```',
      '',
      '### 4.3 Real',
      '',
      ...clampingTable,
    ].join('\n');
    const sections = readMarkdownSections(doc, CLAMPING_SECTION_HEADING);
    expect(sections).toHaveLength(1);
    expect(sections[0].heading).toBe('### 4.3 Real');
  });

  test('a tilde fence info string MAY contain backticks or tildes and still opens a real fence', () => {
    for (const infoString of ['`code`', 'contains~tildes', '`multiple`~backticks`and~tildes']) {
      const doc = [
        `~~~${infoString}`,
        '### 4.3 Fenced, must not count',
        '',
        ...clampingTable,
        '~~~',
        '',
        '### 4.3 Real',
        '',
        ...clampingTable,
      ].join('\n');
      const sections = readMarkdownSections(doc, CLAMPING_SECTION_HEADING);
      expect(sections).toHaveLength(1);
      expect(sections[0].heading).toBe('### 4.3 Real');
    }
  });

  test('0-3 leading spaces before a fence opener with an info string are still tolerated', () => {
    for (const indent of ['', ' ', '  ', '   ']) {
      const doc = [
        `${indent}\`\`\`js`,
        '### 4.3 Fenced, must not count',
        '',
        ...clampingTable,
        '```',
        '',
        '### 4.3 Real',
        '',
        ...clampingTable,
      ].join('\n');
      const sections = readMarkdownSections(doc, CLAMPING_SECTION_HEADING);
      expect(sections).toHaveLength(1);
      expect(sections[0].heading).toBe('### 4.3 Real');
    }
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

  test('§4.3 is identified by its number, so a retitled duplicate is still a duplicate', () => {
    // The defect: section identity was the title phrase, so a duplicate could
    // be RETITLED and stop being recognised as §4.3 at all — defeating the
    // exactly-one rule by renaming rather than by position.
    const lines = report.split('\n');
    const headingIndex = lines.findIndex((l) => CLAMPING_SECTION_HEADING.test(l));
    expect(headingIndex).toBeGreaterThan(-1);
    const headingLevel = /^(#{1,6})\s/.exec(lines[headingIndex].trim())![1].length;
    let sectionEnd = lines.length;
    for (let i = headingIndex + 1; i < lines.length; i += 1) {
      const next = /^(#{1,6})\s/.exec(lines[i].trim());
      if (next && next[1].length <= headingLevel) { sectionEnd = i; break; }
    }
    const appendLines = (block: string[]) =>
      [...lines.slice(0, sectionEnd), '', ...block, '', ...lines.slice(sectionEnd)].join('\n');

    const conflictingTable = [
      '| position | n | min | max | at floor 25.0 | at ceiling 95.0 |',
      '|---|---:|---:|---:|---:|---:|',
      '| QB | 38 | 33.8 | 86.5 | 0 (0.0%) | 0 |',
      '| RB | 95 | 25.0 | 95.0 | 1 (1.1%) | 5 |',
      '| WR | 146 | 25.0 | 95.0 | 1 (0.7%) | 1 |',
      '| TE | 78 | 25.0 | 95.0 | 1 (1.3%) | 1 |',
      '| **total** | **357** | | | **3 (0.8%)** | **7** |',
    ];

    // Case 1: the reviewer's exact shape — a RETITLED duplicate §4.3 with
    // conflicting results. The title shares no phrase with the original.
    const retitled = appendLines([
      '### 4.3 Observed clamping under the designed bounds',
      '',
      ...conflictingTable,
    ]);
    expect(reportClampingProblems(retitled, clamping).join('\n'))
      .toMatch(/2 sections whose heading matches §4\.3.*exactly one/);

    // Case 2: an identical-title duplicate still fails under the new selector.
    const identicalTitle = appendLines([
      lines[headingIndex],
      '',
      ...conflictingTable,
    ]);
    expect(reportClampingProblems(identicalTitle, clamping).join('\n'))
      .toMatch(/2 sections whose heading matches §4\.3.*exactly one/);

    // Case 3: bare and differently punctuated §4.3 headings are §4.3 too —
    // with or without any table in the copy.
    for (const heading of ['### 4.3', '### 4.3.', '## 4.3 — superseded copy']) {
      expect(CLAMPING_SECTION_HEADING.test(heading)).toBe(true);
      const punctuated = appendLines([heading, '', 'Retained for reference.']);
      expect(reportClampingProblems(punctuated, clamping).join('\n'))
        .toMatch(/2 sections whose heading matches §4\.3.*exactly one/);
    }

    // Case 4: 4.30 is a DIFFERENT section, not §4.3. Its presence — even with
    // its own at-floor table — must not trip the section count, and its table
    // must not be admitted as a clamping candidate.
    expect(CLAMPING_SECTION_HEADING.test('### 4.30 Something else entirely')).toBe(false);
    expect(CLAMPING_SECTION_HEADING.test('### 4.3.1 A subsection')).toBe(false);
    const withFourThirty = appendLines([
      '### 4.30 Something else entirely',
      '',
      ...conflictingTable,
    ]);
    expect(reportClampingProblems(withFourThirty, clamping)).toEqual([]);

    // Case 5: ordinary prose mentioning "4.3" is not a heading and counts for
    // nothing — anchoring on the hash prefix is what keeps it out.
    expect(CLAMPING_SECTION_HEADING.test('as discussed in 4.3 above, the bounds are designed')).toBe(false);
    const withProse = appendLines(['As discussed in 4.3 above, the bounds are designed.']);
    expect(reportClampingProblems(withProse, clamping)).toEqual([]);
    expect(readMarkdownSections(withProse, CLAMPING_SECTION_HEADING)).toHaveLength(1);
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

  describe('the §4.3 heading is a bounded ATX classifier, not a raw regex/trim combination', () => {
    // Locate the committed §4.3 section once, the same way the retitling test
    // above does, so every case here inserts around the REAL section rather
    // than a hand-built stand-in.
    const lines = report.split('\n');
    const headingIndex = lines.findIndex((l) => CLAMPING_SECTION_HEADING.test(l));
    const headingLevel = /^(#{1,6})\s/.exec(lines[headingIndex].trim())![1].length;
    let sectionEnd = lines.length;
    for (let i = headingIndex + 1; i < lines.length; i += 1) {
      const next = /^(#{1,6})\s/.exec(lines[i].trim());
      if (next && next[1].length <= headingLevel) { sectionEnd = i; break; }
    }
    const appendAfterSection = (block: string[]) =>
      [...lines.slice(0, sectionEnd), '', ...block, '', ...lines.slice(sectionEnd)].join('\n');

    test('duplicate §4.3 headings with one, two, or three leading spaces fail', () => {
      for (const indent of [' ', '  ', '   ']) {
        const withIndentedDuplicate = appendAfterSection([
          `${indent}### 4.3 Duplicate via leading-space indent`,
          '',
          'Retained for reference.',
        ]);
        expect(reportClampingProblems(withIndentedDuplicate, clamping).join('\n'))
          .toMatch(/2 sections whose heading matches §4\.3.*exactly one/);
      }
    });

    test('four leading spaces and a leading tab do not count as headings', () => {
      for (const indent of ['    ', '\t']) {
        const withPseudoHeading = appendAfterSection([
          `${indent}### 4.3 Indented past the code boundary`,
          '',
          'Retained for reference.',
        ]);
        // Still exactly the one real section — the indented line never
        // registered as a second §4.3 heading at all.
        expect(reportClampingProblems(withPseudoHeading, clamping)).toEqual([]);
        expect(readMarkdownSections(withPseudoHeading, CLAMPING_SECTION_HEADING)).toHaveLength(1);
      }
    });

    test('a tab between the hashes and the number still counts', () => {
      expect(parseAtxHeading('###\t4.3 Tab after the hashes')).toEqual({
        level: 3,
        content: '4.3 Tab after the hashes',
      });
      const withTabHeading = appendAfterSection([
        '###\t4.3 Tab after the hashes',
        '',
        'Retained for reference.',
      ]);
      expect(reportClampingProblems(withTabHeading, clamping).join('\n'))
        .toMatch(/2 sections whose heading matches §4\.3.*exactly one/);
    });

    test('a four-space/tab-indented pseudo-heading does not terminate the live section', () => {
      // Insert the pseudo-heading INSIDE the real section, between its
      // heading and its clamping table. If it wrongly terminated the
      // section, the table below it would no longer be attributed to §4.3
      // and the check would report the table missing rather than passing.
      const withPseudoHeadingInside = [
        ...lines.slice(0, headingIndex + 1),
        '',
        '    #### 4.4 Not really a subsection',
        ...lines.slice(headingIndex + 1),
      ].join('\n');
      expect(reportClampingProblems(withPseudoHeadingInside, clamping)).toEqual([]);
    });

    test('backtick- and tilde-fenced §4.3 heading/table blocks cannot satisfy the checker', () => {
      const clampingTableBlock = [
        '| position | n | min | max | at floor 25.0 | at ceiling 95.0 |',
        '|---|---:|---:|---:|---:|---:|',
        '| QB | 38 | 33.8 | 86.5 | 0 (0.0%) | 0 |',
        '| RB | 95 | 25.0 | 95.0 | 1 (1.1%) | 5 |',
        '| WR | 146 | 25.0 | 95.0 | 1 (0.7%) | 1 |',
        '| TE | 78 | 25.0 | 95.0 | 1 (1.3%) | 1 |',
        '| **total** | **357** | | | **3 (0.8%)** | **7** |',
      ];

      for (const fence of ['```', '~~~']) {
        // A document whose ONLY §4.3 heading/table lives inside a fenced code
        // block: the classifier must see zero real sections, not one.
        const fencedOnly = [
          '# Report',
          '',
          fence,
          '### 4.3 Observed clamping under the designed bounds',
          '',
          ...clampingTableBlock,
          fence,
        ].join('\n');
        expect(readMarkdownSections(fencedOnly, CLAMPING_SECTION_HEADING)).toHaveLength(0);
        expect(reportClampingProblems(fencedOnly, clamping).join('\n'))
          .toMatch(/no §4\.3 section/);

        // The same fenced block placed ALONGSIDE the real, unfenced §4.3
        // section must not register as a second match.
        const withFencedDuplicate = appendAfterSection([
          fence,
          '### 4.3 Observed clamping under the designed bounds',
          '',
          ...clampingTableBlock,
          fence,
        ]);
        expect(reportClampingProblems(withFencedDuplicate, clamping)).toEqual([]);
        expect(readMarkdownSections(withFencedDuplicate, CLAMPING_SECTION_HEADING)).toHaveLength(1);
      }
    });

    test('a whitespace-delimited closing hash sequence is recognised: "### 4.3 Title ###" counts', () => {
      expect(parseAtxHeading('### 4.3 Title ###')).toEqual({ level: 3, content: '4.3 Title' });
      const withClosedHeading = appendAfterSection([
        '### 4.3 Title ###',
        '',
        'Retained for reference.',
      ]);
      expect(reportClampingProblems(withClosedHeading, clamping).join('\n'))
        .toMatch(/2 sections whose heading matches §4\.3.*exactly one/);
    });

    test('a missing separator after the hashes makes the line not a heading at all: "###4.3" does not count', () => {
      expect(parseAtxHeading('###4.3')).toBeNull();
      const withInvalidHeading = appendAfterSection(['###4.3 Glued to the marker', '', 'Retained for reference.']);
      expect(reportClampingProblems(withInvalidHeading, clamping)).toEqual([]);
      expect(readMarkdownSections(withInvalidHeading, CLAMPING_SECTION_HEADING)).toHaveLength(1);
    });

    test('a trailing hash run glued to real title text, with no preceding whitespace, is kept as literal content and still counts: "### 4.3 Contradictory copy###"', () => {
      // Distinct from the missing-separator case above: here the hashes are
      // glued to actual title text, not to the marker itself, so this is
      // still a well-formed heading — CommonMark keeps the trailing hashes as
      // literal content when they are not whitespace-delimited, and this
      // classifier does the same rather than discarding the line. Discarding
      // it would let a retitled duplicate that happens to end in "###" evade
      // detection entirely — the opposite of what the checker is for.
      expect(parseAtxHeading('### 4.3 Contradictory copy###')).toEqual({
        level: 3,
        content: '4.3 Contradictory copy###',
      });
      const withGluedTrailingHash = appendAfterSection([
        '### 4.3 Contradictory copy###',
        '',
        'Retained for reference.',
      ]);
      expect(reportClampingProblems(withGluedTrailingHash, clamping).join('\n'))
        .toMatch(/2 sections whose heading matches §4\.3.*exactly one/);
    });

    test('four-space/tab-indented tables cannot satisfy the observed-clamping requirement', () => {
      const indentedTableDoc = [
        '### 4.3 Observed clamping under the designed bounds',
        '',
        '    | position | n | min | max | at floor 25.0 | at ceiling 95.0 |',
        '    |---|---:|---:|---:|---:|---:|',
        '    | QB | 38 | 33.8 | 86.5 | 0 (0.0%) | 0 |',
        '    | RB | 95 | 25.0 | 95.0 | 1 (1.1%) | 5 |',
        '    | WR | 146 | 25.0 | 95.0 | 1 (0.7%) | 1 |',
        '    | TE | 78 | 25.0 | 95.0 | 1 (1.3%) | 1 |',
        '    | **total** | **357** | | | **3 (0.8%)** | **7** |',
      ].join('\n');
      const sections = readMarkdownSections(indentedTableDoc, CLAMPING_SECTION_HEADING);
      expect(sections).toHaveLength(1);
      expect(sections[0].tables).toEqual([]);
      expect(reportClampingProblems(indentedTableDoc, clamping).join('\n'))
        .toMatch(/no observed-clamping table/);
    });

    test('4.30, 4.3.1, prose, and the committed report retain their existing expected results', () => {
      expect(parseAtxHeading('### 4.30 Something else entirely')).toEqual({
        level: 3,
        content: '4.30 Something else entirely',
      });
      expect(parseAtxHeading('### 4.3.1 A subsection')).toEqual({
        level: 3,
        content: '4.3.1 A subsection',
      });
      expect(CLAMPING_SECTION_HEADING.test('### 4.30 Something else entirely')).toBe(false);
      expect(CLAMPING_SECTION_HEADING.test('### 4.3.1 A subsection')).toBe(false);
      expect(parseAtxHeading('as discussed in 4.3 above, the bounds are designed')).toBeNull();
      expect(reportClampingProblems(report, clamping)).toEqual([]);
    });
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
