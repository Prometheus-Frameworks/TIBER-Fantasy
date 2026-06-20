import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PointScenariosView } from '@/components/data-lab/PointScenariosView';
import {
  DEFAULT_POINT_SCENARIO_SORT,
  POINT_SCENARIO_COLUMNS,
  buildPointScenarioDetailSections,
  buildPointScenarioReadinessDiagnostic,
  buildPointScenarioRowKey,
  type PointScenarioDatasetMetadataInput,
  filterPointScenarioRows,
  formatConfidence,
  formatDelta,
  formatProjection,
  getPointScenarioLabErrorMessage,
  getPointScenarioStateHints,
  sortPointScenarioRows,
} from '@/lib/pointScenarios';

const rows = [
  {
    scenarioId: 'injury-bump',
    scenarioName: 'Target spike if WR2 sits',
    playerId: '00-0036322',
    playerName: 'Justin Jefferson',
    team: 'MIN',
    position: 'WR',
    season: 2025,
    week: 17,
    baselineProjection: 18.4,
    adjustedProjection: 21.1,
    delta: 2.7,
    confidence: { band: 'mid', label: 'actionable' },
    scenarioType: 'usage_shock',
    eventType: 'injury',
    notes: ['Promoted export'],
    explanation: 'Target share climbs if the secondary perimeter role vacates.',
    provenance: {
      provider: 'point-prediction-model',
      sourceName: 'scenario-export',
      sourceType: 'artifact',
      modelVersion: 'ppm-v1',
      generatedAt: '2026-03-23T00:00:00.000Z',
      sourceMetadata: { run_id: 'run-17' },
    },
    rawFields: {
      scenario_name: 'Target spike if WR2 sits',
      event_type: 'injury',
    },
  },
  {
    scenarioId: 'weather-downside',
    scenarioName: 'Weather downside in heavy wind',
    playerId: '00-0037834',
    playerName: 'Brock Bowers',
    team: 'LV',
    position: 'TE',
    season: 2025,
    week: 17,
    baselineProjection: 14.8,
    adjustedProjection: 11.9,
    delta: -2.9,
    confidence: { band: 'high', label: 'fragile' },
    scenarioType: 'environmental',
    eventType: 'weather',
    notes: ['Wind suppresses downfield volume'],
    explanation: 'Lower aDOT path and pass volume likely compresses.',
    provenance: {
      provider: 'point-prediction-model',
      sourceName: 'scenario-export',
      sourceType: 'artifact',
      modelVersion: 'ppm-v1',
      generatedAt: '2026-03-23T00:00:00.000Z',
      sourceMetadata: { venue: 'outdoor' },
    },
    rawFields: {
      scenario_name: 'Weather downside in heavy wind',
      event_type: 'weather',
    },
  },
  {
    scenarioId: 'usage-neutral',
    scenarioName: 'Neutral workload hold',
    playerId: '00-0039939',
    playerName: 'Kyren Williams',
    team: 'LAR',
    position: 'RB',
    season: 2025,
    week: null,
    baselineProjection: 16.1,
    adjustedProjection: 16.1,
    delta: 0,
    confidence: { band: null, label: 'baseline' },
    scenarioType: 'baseline',
    eventType: 'neutral',
    notes: ['No material shift'],
    explanation: 'This scenario preserves the default volume assumption.',
    provenance: {
      provider: 'point-prediction-model',
      sourceName: 'scenario-export',
      sourceType: 'artifact',
      modelVersion: 'ppm-v1',
      generatedAt: '2026-03-23T00:00:00.000Z',
      sourceMetadata: {},
    },
    rawFields: {
      scenario_name: 'Neutral workload hold',
      event_type: 'neutral',
    },
  },
];

describe('PointScenariosView', () => {
  it('renders fixture-backed rows with promoted scenario-analysis framing', () => {
    const html = renderToStaticMarkup(
      React.createElement(PointScenariosView, {
        season: '2025',
        availableSeasons: [2025, 2024],
        rows,
        isLoading: false,
        error: null,
        sourceProvider: 'point-prediction-model',
        sourceMode: 'artifact',
        onSeasonChange: jest.fn(),
      }),
    );

    expect(html).toContain('Point Scenario Lab');
    expect(html).toContain('Justin Jefferson');
    expect(html).toContain('Brock Bowers');
    expect(html).toContain('Promoted module');
    expect(html).toContain('Scenario-based point outcome context');
    expect(html).toContain('What this lab is for');
    expect(html).toContain('Important framing');
  });

  it('keeps the table column contract and value formatters stable', () => {
    expect(POINT_SCENARIO_COLUMNS.map((column) => column.label)).toEqual([
      'Player',
      'Scenario',
      'Baseline',
      'Adjusted',
      'Delta',
      'Confidence',
    ]);
    expect(formatProjection(18.4)).toBe('18.4');
    expect(formatDelta(2.7)).toBe('+2.7');
    expect(formatConfidence({ band: 'mid', label: 'actionable' })).toBe('mid · actionable');
  });

  it('supports search/filter behavior and stable sorting', () => {
    expect(filterPointScenarioRows(rows, { searchQuery: 'wind' }).map((row) => row.playerName)).toEqual(['Brock Bowers']);
    expect(filterPointScenarioRows(rows, { eventType: 'injury' }).map((row) => row.playerName)).toEqual(['Justin Jefferson']);

    expect(sortPointScenarioRows(rows, DEFAULT_POINT_SCENARIO_SORT).map((row) => row.playerName)).toEqual([
      'Justin Jefferson',
      'Kyren Williams',
      'Brock Bowers',
    ]);

    expect(sortPointScenarioRows(rows, { key: 'playerName', direction: 'asc' }).map((row) => row.playerName)).toEqual([
      'Brock Bowers',
      'Justin Jefferson',
      'Kyren Williams',
    ]);
  });

  it('renders the detail drawer content from promoted fields', () => {
    const html = renderToStaticMarkup(
      React.createElement(PointScenariosView, {
        season: '2025',
        availableSeasons: [2025],
        rows,
        isLoading: false,
        error: null,
        sourceProvider: 'point-prediction-model',
        sourceMode: 'artifact',
        defaultSelectedScenarioKey: buildPointScenarioRowKey(rows[0]),
        onSeasonChange: jest.fn(),
      }),
    );

    expect(html).toContain('Detail drawer');
    expect(html).toContain('Scenario context');
    expect(html).toContain('Projection shift');
    expect(html).toContain('Full promoted payload');

    const sections = buildPointScenarioDetailSections(rows[0]);
    expect(sections.map((section) => section.title)).toEqual([
      'Scenario context',
      'Player context',
      'Projection shift',
      'Explanation',
      'Provenance',
      'Full promoted payload',
    ]);
  });

  it('renders related-module links with carried player context', () => {
    const html = renderToStaticMarkup(
      React.createElement(PointScenariosView, {
        season: '2025',
        availableSeasons: [2025],
        rows,
        isLoading: false,
        error: null,
        sourceProvider: 'point-prediction-model',
        sourceMode: 'artifact',
        initialPlayerContext: {
          playerId: '00-0036322',
          playerName: 'Justin Jefferson',
        },
        onSeasonChange: jest.fn(),
      }),
    );

    expect(html).toContain('Carrying player context for');
    expect(html).toContain('/tiber-data-lab/breakout-signals?playerId=00-0036322&amp;playerName=Justin+Jefferson&amp;season=2025');
    expect(html).toContain('/tiber-data-lab/role-opportunity?playerId=00-0036322&amp;playerName=Justin+Jefferson&amp;season=2025');
    expect(html).toContain('/tiber-data-lab/age-curves?playerId=00-0036322&amp;playerName=Justin+Jefferson&amp;season=2025');
    expect(html).toContain('Provenance');
  });

  describe('point scenario readiness diagnostic (PR B)', () => {
    it('resolves Level 1 when the source is available but governance/freshness are insufficient for Level 2', () => {
      const diagnostic = buildPointScenarioReadinessDiagnostic({
        hasError: false,
        sourceMode: 'artifact',
        sourceProvider: 'point-prediction-model',
        rows,
      });
      expect(diagnostic).toMatchObject({
        level: 1,
        levelLabel: 'Read-only diagnostic',
        available: true,
        state: 'ready',
        sourceMode: 'artifact',
        rowCount: 3,
        level2Deferred: true,
      });
      // Row-level provenance.generated_at is surfaced honestly; no dataset freshness invented.
      expect(diagnostic.rowGeneratedAt).toBe('2026-03-23T00:00:00.000Z');
      expect(diagnostic.freshness).toBe('row-level');
      // With no producer metadata, the explicit promotion gate fails closed.
      expect(diagnostic.level2Deferred).toBe(true);
      expect(diagnostic.promotionReadiness.promotable).toBe(false);
      expect(diagnostic.level2Blockers).toEqual([
        'governance_marker_missing',
        'contract_literal_missing',
        'dataset_freshness_missing',
      ]);
      expect(diagnostic.details).toEqual(expect.arrayContaining(['Source mode: artifact.']));
      // Never claims supporting context / Level 2.
      expect(JSON.stringify(diagnostic)).not.toContain('Supporting context');
    });

    it('fails closed when the source is unavailable (error or unknown mode)', () => {
      const errored = buildPointScenarioReadinessDiagnostic({ hasError: true, sourceMode: null, sourceProvider: null, rows: [] });
      expect(errored).toMatchObject({ level: 0, levelLabel: 'Fail closed', available: false, state: 'unavailable' });
      expect(errored.failedReasons).toEqual(expect.arrayContaining(['source_error', 'source_mode_unknown']));

      const noMode = buildPointScenarioReadinessDiagnostic({ hasError: false, sourceMode: null, sourceProvider: 'point-prediction-model', rows });
      expect(noMode).toMatchObject({ level: 0, available: false, state: 'unavailable' });
    });

    it('reports row-level freshness as unavailable when no provenance.generated_at exists, without inventing dataset freshness', () => {
      const diagnostic = buildPointScenarioReadinessDiagnostic({
        hasError: false,
        sourceMode: 'api',
        sourceProvider: 'point-prediction-model',
        rows: [{ provenance: { generatedAt: null } }],
      });
      expect(diagnostic).toMatchObject({ level: 1, sourceMode: 'api', rowGeneratedAt: null, freshness: 'unavailable' });
      expect(diagnostic.details).toEqual(expect.arrayContaining(['Dataset freshness: unavailable.']));
    });

    it('marks a reachable but empty dataset at Level 1 with an explicit empty reason', () => {
      const diagnostic = buildPointScenarioReadinessDiagnostic({ hasError: false, sourceMode: 'artifact', sourceProvider: 'point-prediction-model', rows: [] });
      expect(diagnostic).toMatchObject({ level: 1, state: 'empty', rowCount: 0 });
      expect(diagnostic.failedReasons).toContain('empty_dataset');
    });

    describe('explicit promotion gate via PPM dataset metadata (#249 PR 3)', () => {
      function readiness(metadata: PointScenarioDatasetMetadataInput | null) {
        return buildPointScenarioReadinessDiagnostic({
          hasError: false,
          sourceMode: 'artifact',
          sourceProvider: 'point-prediction-model',
          rows,
          metadata,
        });
      }

      it('promotes to Level 2 with explicit governed marker + point_scenario_lab_v1 + fresh dataset generatedAt', () => {
        const diagnostic = readiness({
          governanceStatus: 'governed',
          governanceSource: 'explicit_marker',
          contractVersion: 'point_scenario_lab_v1',
          generatedAt: new Date().toISOString(),
        });
        expect(diagnostic.promotionReadiness.promotable).toBe(true);
        expect(diagnostic).toMatchObject({ level: 2, levelLabel: 'Supporting context', level2Deferred: false });
        expect(diagnostic.details).toEqual(expect.arrayContaining([
          'Dataset contract (point_scenario_lab_v1) match: yes.',
          'Promotion gate: satisfied (eligible for Level 2 supporting context).',
        ]));
        // Row-level provenance + source mode remain visible.
        expect(diagnostic.rowGeneratedAt).toBe('2026-03-23T00:00:00.000Z');
        expect(diagnostic.sourceMode).toBe('artifact');
      });

      it('keeps fixture governance below Level 2', () => {
        const diagnostic = readiness({
          governanceStatus: 'fixture',
          governanceSource: 'explicit_marker',
          contractVersion: 'point_scenario_lab_v1',
          generatedAt: new Date().toISOString(),
        });
        expect(diagnostic.level).toBe(1);
        expect(diagnostic.promotionReadiness.promotable).toBe(false);
        expect(diagnostic.level2Blockers).toContain('governance_not_governed');
      });

      it('keeps missing metadata below Level 2', () => {
        const diagnostic = readiness(null);
        expect(diagnostic.level).toBe(1);
        expect(diagnostic.level2Blockers).toContain('governance_marker_missing');
      });

      it('maps governanceSource path_inference to a weak path hint that does not promote', () => {
        const diagnostic = readiness({
          governanceStatus: 'governed',
          governanceSource: 'path_inference',
          contractVersion: 'point_scenario_lab_v1',
          generatedAt: new Date().toISOString(),
        });
        expect(diagnostic.promotionReadiness.governanceSource).toBe('path_hint');
        expect(diagnostic.level).toBe(1);
        expect(diagnostic.level2Blockers).toContain('governance_path_hint_only');
      });

      it('keeps a contract mismatch below Level 2', () => {
        const diagnostic = readiness({
          governanceStatus: 'governed',
          governanceSource: 'explicit_marker',
          contractVersion: 'point_scenario_lab_v0',
          generatedAt: new Date().toISOString(),
        });
        expect(diagnostic.level).toBe(1);
        expect(diagnostic.level2Blockers).toContain('contract_mismatch');
      });

      it('keeps missing/stale dataset freshness below Level 2 (row-level never promotes)', () => {
        const stale = readiness({
          governanceStatus: 'governed',
          governanceSource: 'explicit_marker',
          contractVersion: 'point_scenario_lab_v1',
          generatedAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
        });
        expect(stale.level).toBe(1);
        expect(stale.level2Blockers).toContain('dataset_freshness_not_fresh');

        // Explicit governed + contract, but NO dataset-level generatedAt — row-level
        // provenance must not satisfy freshness.
        const missing = readiness({
          governanceStatus: 'governed',
          governanceSource: 'explicit_marker',
          contractVersion: 'point_scenario_lab_v1',
        });
        expect(missing.level).toBe(1);
        expect(missing.promotionReadiness.promotable).toBe(false);
        expect(missing.level2Blockers).toContain('dataset_freshness_missing');
      });

      it('renders Level 2 supporting context in the view when promotable', () => {
        const html = renderToStaticMarkup(
          React.createElement(PointScenariosView, {
            season: '2025',
            availableSeasons: [2025],
            rows,
            isLoading: false,
            error: null,
            sourceProvider: 'point-prediction-model',
            sourceMode: 'artifact',
            datasetMetadata: {
              governanceStatus: 'governed',
              governanceSource: 'explicit_marker',
              contractVersion: 'point_scenario_lab_v1',
              generatedAt: new Date().toISOString(),
            },
            onSeasonChange: jest.fn(),
          }),
        );
        expect(html).toContain('Readiness diagnostic');
        expect(html).toContain('Level 2');
        expect(html).toContain('Supporting context');
      });
    });

    it('renders the readiness diagnostic in the view (preserving source mode) without promoting to Level 2', () => {
      const html = renderToStaticMarkup(
        React.createElement(PointScenariosView, {
          season: '2025',
          availableSeasons: [2025],
          rows,
          isLoading: false,
          error: null,
          sourceProvider: 'point-prediction-model',
          sourceMode: 'artifact',
          onSeasonChange: jest.fn(),
        }),
      );
      expect(html).toContain('Readiness diagnostic');
      expect(html).toContain('Level 1');
      expect(html).toContain('Source mode: artifact.');
      expect(html).not.toContain('Supporting context');
    });

    it('hides the readiness diagnostic while the source is still loading (no misleading fail-closed)', () => {
      const html = renderToStaticMarkup(
        React.createElement(PointScenariosView, {
          season: '2025',
          availableSeasons: [2025],
          rows: [],
          isLoading: true,
          error: null,
          sourceProvider: null,
          sourceMode: null,
          onSeasonChange: jest.fn(),
        }),
      );
      expect(html).toContain('Loading Point Scenario Lab');
      expect(html).not.toContain('Readiness diagnostic');
      expect(html).not.toContain('Fail closed');
    });
  });

  it('renders malformed and empty states with operator hints', () => {
    const malformedHtml = renderToStaticMarkup(
      React.createElement(PointScenariosView, {
        season: '2025',
        availableSeasons: [2025],
        rows: [],
        isLoading: false,
        error: {
          success: false,
          error: getPointScenarioLabErrorMessage({
            success: false,
            error: 'invalid',
            code: 'invalid_payload',
          }),
          code: 'invalid_payload',
        },
        sourceProvider: null,
        sourceMode: null,
        onSeasonChange: jest.fn(),
      }),
    );

    expect(malformedHtml).toContain('Point Scenario Lab unavailable');
    expect(malformedHtml).toContain('Operator hints');
    expect(getPointScenarioStateHints({ success: false, error: 'missing', code: 'not_found' })[0]).toContain('point-scenario export');

    const emptyHtml = renderToStaticMarkup(
      React.createElement(PointScenariosView, {
        season: '2025',
        availableSeasons: [2025],
        rows: [],
        isLoading: false,
        error: null,
        sourceProvider: 'point-prediction-model',
        sourceMode: 'artifact',
        onSeasonChange: jest.fn(),
      }),
    );

    expect(emptyHtml).toContain('Point Scenario Lab ready, but empty');
    expect(emptyHtml).toContain('valid empty result set');
  });
});
