import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AgeCurvesView } from '@/components/data-lab/AgeCurvesView';
import {
  AGE_CURVE_COLUMNS,
  DEFAULT_AGE_CURVE_SORT,
  buildAgeCurveDetailSections,
  filterAgeCurveRows,
  formatAge,
  formatDelta,
  formatPpg,
  getAgeCurveLabErrorMessage,
  getAgeCurveStateHints,
  sortAgeCurveRows,
} from '@/lib/ageCurves';

const rows = [
  {
    playerId: '00-0036322',
    playerName: 'Justin Jefferson',
    team: 'MIN',
    position: 'WR',
    season: 2025,
    age: 26.4,
    careerYear: 6,
    peerBucket: 'WR-year6-age26',
    expectedPpg: 17.8,
    actualPpg: 19.6,
    ppgDelta: 1.8,
    trajectoryLabel: 'ahead_of_curve',
    ageCurveScore: 91.2,
    provenance: {
      provider: 'arc-model',
      sourceName: 'arc-export',
      sourceType: 'artifact',
      modelVersion: 'arc-v1',
      generatedAt: '2026-03-23T00:00:00.000Z',
      notes: ['promoted export'],
    },
    rawFields: {
      player_name: 'Justin Jefferson',
      age_curve_score: 91.2,
      expected_ppg: 17.8,
      actual_ppg: 19.6,
    },
  },
  {
    playerId: '00-0042400',
    playerName: 'Rome Odunze',
    team: 'CHI',
    position: 'WR',
    season: 2025,
    age: 23.1,
    careerYear: 2,
    peerBucket: 'WR-year2-age23',
    expectedPpg: 12.1,
    actualPpg: 11.2,
    ppgDelta: -0.9,
    trajectoryLabel: 'on_curve',
    ageCurveScore: 78.4,
    provenance: {
      provider: 'arc-model',
      sourceName: 'arc-export',
      sourceType: 'artifact',
      modelVersion: 'arc-v1',
      generatedAt: '2026-03-23T00:00:00.000Z',
      notes: [],
    },
    rawFields: {
      player_name: 'Rome Odunze',
      peer_bucket: 'WR-year2-age23',
      expected_ppg: 12.1,
      actual_ppg: 11.2,
    },
  },
  {
    playerId: '00-0037834',
    playerName: 'Brock Bowers',
    team: 'LV',
    position: 'TE',
    season: 2025,
    age: 22.6,
    careerYear: 2,
    peerBucket: 'TE-year2-age22',
    expectedPpg: 13.4,
    actualPpg: 15.0,
    ppgDelta: 1.6,
    trajectoryLabel: 'accelerating',
    ageCurveScore: 88.5,
    provenance: {
      provider: 'arc-model',
      sourceName: 'arc-export',
      sourceType: 'artifact',
      modelVersion: 'arc-v1',
      generatedAt: '2026-03-23T00:00:00.000Z',
      notes: ['elite early-career usage'],
    },
    rawFields: {
      player_name: 'Brock Bowers',
      expected_ppg: 13.4,
      actual_ppg: 15.0,
    },
  },
];

describe('AgeCurvesView', () => {
  it('renders fixture-backed rows with read-only developmental framing', () => {
    const html = renderToStaticMarkup(
      React.createElement(AgeCurvesView, {
        season: '2025',
        availableSeasons: [2025, 2024],
        rows,
        isLoading: false,
        error: null,
        sourceProvider: 'arc-model',
        sourceMode: 'artifact',
        onSeasonChange: jest.fn(),
      }),
    );

    expect(html).toContain('Age Curve / ARC Lab');
    expect(html).toContain('Justin Jefferson');
    expect(html).toContain('Brock Bowers');
    expect(html).toContain('Promoted module');
    expect(html).toContain('Use alongside');
    expect(html).toContain('Showing');
  });

  it('keeps the table column contract and value formatters stable', () => {
    expect(AGE_CURVE_COLUMNS.map((column) => column.label)).toEqual([
      'Player',
      'Team',
      'Age',
      'Career Yr',
      'Expected',
      'Actual',
      'Delta',
      'Trajectory',
    ]);
    expect(formatPpg(17.83)).toBe('17.8');
    expect(formatDelta(1.8)).toBe('+1.8');
    expect(formatAge(26.4)).toBe('26.4');
  });

  it('supports search/filter behavior and stable sorting', () => {
    expect(filterAgeCurveRows(rows, { searchQuery: 'rome' }).map((row) => row.playerName)).toEqual(['Rome Odunze']);
    expect(filterAgeCurveRows(rows, { team: 'MIN', position: 'WR' }).map((row) => row.playerName)).toEqual(['Justin Jefferson']);

    expect(sortAgeCurveRows(rows, DEFAULT_AGE_CURVE_SORT).map((row) => row.playerName)).toEqual([
      'Justin Jefferson',
      'Brock Bowers',
      'Rome Odunze',
    ]);

    expect(sortAgeCurveRows(rows, { key: 'playerName', direction: 'asc' }).map((row) => row.playerName)).toEqual([
      'Brock Bowers',
      'Justin Jefferson',
      'Rome Odunze',
    ]);
  });

  it('renders the detail drawer with expected-vs-actual context and raw payload sections', () => {
    const html = renderToStaticMarkup(
      React.createElement(AgeCurvesView, {
        season: '2025',
        availableSeasons: [2025],
        rows,
        isLoading: false,
        error: null,
        sourceProvider: 'arc-model',
        sourceMode: 'artifact',
        defaultExpandedPlayerKey: '00-0036322',
        onSeasonChange: jest.fn(),
      }),
    );

    expect(html).toContain('Developmental context');
    expect(html).toContain('Expected vs actual scoring');
    expect(html).toContain('Full promoted payload');

    const sections = buildAgeCurveDetailSections(rows[0]);
    expect(sections.map((section) => section.title)).toEqual([
      'Developmental context',
      'Expected vs actual',
      'Provenance',
      'Full promoted payload',
    ]);
    expect(sections[1].fields.map((field) => field.label)).toContain('PPG delta');
  });


  it('renders related-module links with carried player context', () => {
    const html = renderToStaticMarkup(
      React.createElement(AgeCurvesView, {
        season: '2025',
        availableSeasons: [2025],
        rows,
        isLoading: false,
        error: null,
        sourceProvider: 'arc-model',
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
    expect(html).toContain('Provenance');
  });

  it('renders malformed and empty states with operator hints', () => {
    const malformedHtml = renderToStaticMarkup(
      React.createElement(AgeCurvesView, {
        season: '2025',
        availableSeasons: [2025],
        rows: [],
        isLoading: false,
        error: {
          success: false,
          error: getAgeCurveLabErrorMessage({
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

    expect(malformedHtml).toContain('Age Curve Lab unavailable');
    expect(malformedHtml).toContain('Operator hints');
    expect(getAgeCurveStateHints({ success: false, error: 'missing', code: 'not_found' })[0]).toContain('promoted ARC export');

    const emptyHtml = renderToStaticMarkup(
      React.createElement(AgeCurvesView, {
        season: '2025',
        availableSeasons: [2025],
        rows: [],
        isLoading: false,
        error: null,
        sourceProvider: 'arc-model',
        sourceMode: 'artifact',
        onSeasonChange: jest.fn(),
      }),
    );

    expect(emptyHtml).toContain('Age Curve Lab ready, but empty');
    expect(emptyHtml).toContain('valid empty result set');
  });
});
