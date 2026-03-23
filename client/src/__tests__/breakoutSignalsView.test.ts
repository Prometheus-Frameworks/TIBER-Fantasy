import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BreakoutSignalsView } from '@/components/data-lab/BreakoutSignalsView';
import {
  BREAKOUT_SIGNAL_COLUMNS,
  buildBestRecipeBadge,
  buildBreakoutDetailSections,
  DEFAULT_BREAKOUT_FILTERS,
  DEFAULT_BREAKOUT_SORT,
  filterBreakoutSignalRows,
  getBreakoutSignalsErrorMessage,
  getBreakoutSignalsStateHints,
  sortBreakoutSignalRows,
} from '@/lib/breakoutSignals';

const rows = [
  {
    candidateRank: 1,
    finalSignalScore: 92.4,
    playerName: 'Malik Nabers',
    playerId: '00-0042051',
    team: 'NYG',
    season: 2025,
    bestRecipeName: 'Second-Year Surge',
    breakoutLabelDefault: 'Priority breakout',
    breakoutContext: 'Elite rookie route command with more downfield volume expected',
    components: {
      usage: 96,
      efficiency: 91,
      development: 89,
      stability: 82,
      cohort: 85,
      role: 88,
      penalty: -3,
    },
    rawFields: {
      player_name: 'Malik Nabers',
      player_id: '00-0042051',
      candidate_rank: '1',
      final_signal_score: '92.4',
      breakout_context: 'Elite rookie route command with more downfield volume expected',
      role_family: 'X receiver',
      cohort_bucket: 'Year-2 alpha',
      generated_at: '2026-03-23T00:00:00.000Z',
      model_version: 'svm-2026.03.1',
    },
  },
  {
    candidateRank: 2,
    finalSignalScore: 90.1,
    playerName: 'Rome Odunze',
    playerId: '00-0042400',
    team: 'CHI',
    season: 2025,
    bestRecipeName: 'Second-Year Surge',
    breakoutLabelDefault: 'Monitor',
    breakoutContext: 'Expanded route tree with stronger red-zone access',
    components: {
      usage: 85,
      efficiency: 88,
      development: 86,
      stability: 80,
      cohort: 82,
      role: 79,
      penalty: -1,
    },
    rawFields: {
      player_name: 'Rome Odunze',
      candidate_rank: '2',
      final_signal_score: '90.1',
      breakout_context: 'Expanded route tree with stronger red-zone access',
      generated_at: '2026-03-23T00:00:00.000Z',
    },
  },
  {
    candidateRank: 12,
    finalSignalScore: 79.2,
    playerName: 'Jalen McMillan',
    playerId: '00-0043310',
    team: 'TB',
    season: 2025,
    bestRecipeName: 'Role Expansion',
    breakoutLabelDefault: null,
    breakoutContext: 'Depth-chart opening created more viable path to snaps',
    components: {
      usage: 70,
      efficiency: 74,
      development: 72,
      stability: 69,
      cohort: 77,
      role: 83,
      penalty: -5,
    },
    rawFields: {
      player_name: 'Jalen McMillan',
      candidate_rank: '12',
      final_signal_score: '79.2',
      role_projection: 'Movement into two-WR sets',
      generated_at: '2026-03-23T00:00:00.000Z',
    },
  },
];

const summary = {
  bestRecipeName: 'Second-Year Surge',
  season: 2025,
  validationScore: 0.78,
  winRate: 0.64,
  hitRate: 0.58,
  candidateCount: 12,
  summary: 'Targets ascending second-year WRs with strong usage and efficiency baselines.',
  generatedAt: '2026-03-23T00:00:00.000Z',
  modelVersion: 'svm-2026.03.1',
};

describe('BreakoutSignalsView', () => {
  it('renders fixture-backed rows plus the best-recipe badge content', () => {
    const html = renderToStaticMarkup(
      React.createElement(BreakoutSignalsView, {
        season: '2025',
        availableSeasons: [2025, 2024],
        rows,
        bestRecipeSummary: summary,
        isLoading: false,
        errorMessage: null,
        errorCode: null,
        onSeasonChange: jest.fn(),
      }),
    );

    expect(html).toContain('WR Breakout Lab');
    expect(html).toContain('Malik Nabers');
    expect(html).toContain('Second-Year Surge');
    expect(html).toContain('Validation 78%');
    expect(html).toContain('Priority breakout');
    expect(html).toContain('This recipe comes from retrospective Signal-Validation-Model validation.');
    expect(html).toContain('Top 10');
    expect(html).toContain('High role signal');
  });

  it('keeps the breakout table column contract stable', () => {
    expect(BREAKOUT_SIGNAL_COLUMNS.map((column) => column.label)).toEqual([
      'Rank',
      'Player',
      'Signal Score',
      'Best Recipe',
      'Usage',
      'Efficiency',
      'Development',
      'Stability',
      'Cohort',
      'Role',
      'Penalty',
      'Breakout Context',
    ]);
    expect(buildBestRecipeBadge(summary)).toEqual([
      'Second-Year Surge',
      'Validation 78%',
      'Win 64%',
      'Hit 58%',
    ]);
  });

  it('supports stable client-side sorting for numeric and text columns', () => {
    expect(sortBreakoutSignalRows(rows, DEFAULT_BREAKOUT_SORT).map((row) => row.playerName)).toEqual([
      'Malik Nabers',
      'Rome Odunze',
      'Jalen McMillan',
    ]);

    expect(sortBreakoutSignalRows(rows, { key: 'role', direction: 'desc' }).map((row) => row.playerName)).toEqual([
      'Malik Nabers',
      'Jalen McMillan',
      'Rome Odunze',
    ]);

    expect(sortBreakoutSignalRows(rows, { key: 'playerName', direction: 'asc' }).map((row) => row.playerName)).toEqual([
      'Jalen McMillan',
      'Malik Nabers',
      'Rome Odunze',
    ]);
  });

  it('supports search and quick-filter behavior without mutating source rows', () => {
    expect(filterBreakoutSignalRows(rows, { searchQuery: 'rome' }).map((row) => row.playerName)).toEqual(['Rome Odunze']);

    expect(filterBreakoutSignalRows(rows, {
      filters: { ...DEFAULT_BREAKOUT_FILTERS, breakoutOnly: true, highCohortOnly: true },
    }).map((row) => row.playerName)).toEqual(['Malik Nabers', 'Rome Odunze']);

    expect(filterBreakoutSignalRows(rows, {
      filters: { ...DEFAULT_BREAKOUT_FILTERS, topN: 10, highRoleOnly: true },
    }).map((row) => row.playerName)).toEqual(['Malik Nabers']);

    expect(rows.map((row) => row.playerName)).toEqual(['Malik Nabers', 'Rome Odunze', 'Jalen McMillan']);
  });

  it('groups detail fields into scan-friendly sections', () => {
    const sections = buildBreakoutDetailSections(rows[0]);

    expect(sections.map((section) => section.title)).toEqual([
      'Ranking summary',
      'Signal components',
      'Breakout context',
      'Cohort / role context',
      'Raw export metadata',
    ]);
    expect(sections.find((section) => section.id === 'cohort-role-context')?.fields.map((field) => field.label)).toEqual([
      'Role Family',
      'Cohort Bucket',
    ]);
    expect(sections.find((section) => section.id === 'raw-export-metadata')?.fields.map((field) => field.label)).toEqual([
      'Player name',
      'Player ID',
      'Candidate rank',
      'Final signal score',
      'Generated at',
      'Model version',
    ]);
  });

  it('renders improved empty and malformed export states with operator hints', () => {
    const malformedHtml = renderToStaticMarkup(
      React.createElement(BreakoutSignalsView, {
        season: '2025',
        availableSeasons: [2025],
        rows: [],
        bestRecipeSummary: null,
        isLoading: false,
        errorMessage: getBreakoutSignalsErrorMessage({
          success: false,
          error: 'Malformed export',
          code: 'invalid_payload',
        }),
        errorCode: 'invalid_payload',
        onSeasonChange: jest.fn(),
      }),
    );

    expect(malformedHtml).toContain('WR Breakout Lab unavailable');
    expect(malformedHtml).toContain('Operator hints');
    expect(malformedHtml).toContain('Inspect the promoted CSV/JSON export for missing required fields or malformed values.');

    const emptyHtml = renderToStaticMarkup(
      React.createElement(BreakoutSignalsView, {
        season: '2025',
        availableSeasons: [2025],
        rows: [],
        bestRecipeSummary: summary,
        isLoading: false,
        errorMessage: null,
        errorCode: null,
        onSeasonChange: jest.fn(),
      }),
    );

    expect(emptyHtml).toContain('WR Breakout Lab ready, but empty');
    expect(emptyHtml).toContain('preserving the read-only upstream result');
    expect(getBreakoutSignalsStateHints({ success: false, error: 'No export', code: 'not_found' })[0]).toContain('Confirm the promoted season export exists');
  });
});
