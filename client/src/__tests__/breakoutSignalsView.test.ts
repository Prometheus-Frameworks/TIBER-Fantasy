import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BreakoutSignalsView } from '@/components/data-lab/BreakoutSignalsView';
import {
  BREAKOUT_SIGNAL_COLUMNS,
  buildBestRecipeBadge,
  getBreakoutSignalsErrorMessage,
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
      candidate_rank: '1',
      final_signal_score: '92.4',
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
        onSeasonChange: jest.fn(),
      }),
    );

    expect(html).toContain('WR Breakout Lab');
    expect(html).toContain('Malik Nabers');
    expect(html).toContain('Second-Year Surge');
    expect(html).toContain('Validation 78%');
    expect(html).toContain('Priority breakout');
  });

  it('renders the guarded empty/error state copy when no export is available', () => {
    const html = renderToStaticMarkup(
      React.createElement(BreakoutSignalsView, {
        season: '2025',
        availableSeasons: [2025],
        rows: [],
        bestRecipeSummary: null,
        isLoading: false,
        errorMessage: getBreakoutSignalsErrorMessage({
          success: false,
          error: 'No Signal Validation export found.',
          code: 'not_found',
        }),
        onSeasonChange: jest.fn(),
      }),
    );

    expect(html).toContain('WR Breakout Lab unavailable');
    expect(html).toContain('No Signal-Validation-Model export was found for this season yet.');
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
});
