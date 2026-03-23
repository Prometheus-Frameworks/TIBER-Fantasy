import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PointScenariosView } from '@/components/data-lab/PointScenariosView';
import {
  DEFAULT_POINT_SCENARIO_SORT,
  POINT_SCENARIO_COLUMNS,
  buildPointScenarioDetailSections,
  buildPointScenarioRowKey,
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
    expect(html).toContain('/tiber-data-lab/breakout-signals?playerId=00-0036322&amp;playerName=Justin+Jefferson');
    expect(html).toContain('/tiber-data-lab/role-opportunity?playerId=00-0036322&amp;playerName=Justin+Jefferson');
    expect(html).toContain('/tiber-data-lab/age-curves?playerId=00-0036322&amp;playerName=Justin+Jefferson');
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
