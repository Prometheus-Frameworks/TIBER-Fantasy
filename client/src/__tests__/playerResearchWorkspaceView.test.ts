import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlayerResearchWorkspaceView } from '@/components/data-lab/PlayerResearchWorkspaceView';
import {
  buildPlayerResearchHref,
  filterPlayerResearchSearchIndex,
  findSearchEntryByQuery,
  getPlayerResearchStateLabel,
  readPlayerResearchQuery,
} from '@/lib/playerResearch';

const data = {
  season: 2025,
  availableSeasons: [2025, 2024],
  state: 'partial' as const,
  requestedPlayerId: '00-0036322',
  requestedPlayerName: 'Justin Jefferson',
  selectedPlayer: {
    playerId: '00-0036322',
    playerName: 'Justin Jefferson',
    team: 'MIN',
    position: 'WR',
    matchStrategy: 'player_id' as const,
  },
  searchIndex: [
    {
      playerId: '00-0036322',
      playerName: 'Justin Jefferson',
      team: 'MIN',
      position: 'WR',
      modules: {
        breakoutSignals: true,
        roleOpportunity: true,
        ageCurves: true,
        pointScenarios: true,
      },
    },
    {
      playerId: '00-0042051',
      playerName: 'Malik Nabers',
      team: 'NYG',
      position: 'WR',
      modules: {
        breakoutSignals: true,
        roleOpportunity: false,
        ageCurves: true,
        pointScenarios: false,
      },
    },
  ],
  framing: {
    title: 'Player Research Workspace',
    description: 'Fixture framing copy.',
    provenanceNote: 'TIBER-Fantasy is not recomputing model logic locally.',
  },
  warnings: ['Age Curve / ARC unavailable for this player.'],
  sections: {
    breakoutSignals: {
      state: 'ready' as const,
      title: 'Breakout Signals summary',
      description: 'Fixture breakout copy.',
      linkHref: '/tiber-data-lab/breakout-signals?playerId=00-0036322&playerName=Justin+Jefferson&season=2025',
      summary: {
        candidateRank: 4,
        finalSignalScore: 92.1,
        bestRecipeName: 'Elite rookie command',
        breakoutLabel: 'Priority breakout',
        breakoutContext: 'Elite route command with more scoring runway left.',
        componentSummary: [
          { label: 'Usage', value: 96 },
          { label: 'Efficiency', value: 92 },
        ],
        source: {
          provider: 'signal-validation-model' as const,
          exportDirectory: '/exports/signal-validation',
        },
      },
      message: 'Promoted breakout output found for this player.',
      readOnly: true as const,
      provenanceNote: 'Read-only summary of promoted Signal-Validation-Model output.',
      error: null,
    },
    roleOpportunity: {
      state: 'ready' as const,
      title: 'Role & Opportunity summary',
      description: 'Fixture role copy.',
      linkHref: '/tiber-data-lab/role-opportunity?playerId=00-0036322&playerName=Justin+Jefferson&season=2025',
      summary: {
        primaryRole: 'alpha_x',
        routeParticipation: 0.96,
        targetShare: 0.31,
        airYardShare: 0.42,
        snapShare: 0.93,
        usageRate: 0.28,
        confidenceScore: 0.91,
        confidenceTier: 'featured',
        insights: ['Target leader'],
        source: {
          sourceName: 'tiber-data',
          sourceType: 'compatibility-view',
          modelVersion: 'role-opportunity-v1',
          generatedAt: '2026-03-23T00:00:00.000Z',
        },
      },
      message: 'Promoted role and opportunity output found for this player.',
      readOnly: true as const,
      provenanceNote: 'Read-only summary of promoted role/deployment output.',
      error: null,
    },
    ageCurves: {
      state: 'not_available' as const,
      title: 'Age Curve / ARC summary',
      description: 'Fixture ARC copy.',
      linkHref: '/tiber-data-lab/age-curves?playerId=00-0036322&playerName=Justin+Jefferson&season=2025',
      summary: null,
      message: 'No promoted ARC output is available for this player in the selected season.',
      readOnly: true as const,
      provenanceNote: 'Read-only summary of promoted ARC output.',
      error: null,
    },
    pointScenarios: {
      state: 'ready' as const,
      title: 'Point Scenario summary',
      description: 'Fixture scenario copy.',
      linkHref: '/tiber-data-lab/point-scenarios?playerId=00-0036322&playerName=Justin+Jefferson&season=2025',
      summary: {
        baselineProjection: 18.4,
        adjustedProjection: 21.1,
        delta: 2.7,
        confidenceBand: 'mid',
        confidenceLabel: 'actionable',
        scenarioCount: 2,
        topScenarioNames: ['Target spike if WR2 sits', 'Goal-line funnel'],
        notes: ['Promoted export'],
        source: {
          provider: 'point-prediction-model',
          sourceName: 'scenario-export',
          sourceType: 'artifact',
          modelVersion: 'ppm-v1',
          generatedAt: '2026-03-23T00:00:00.000Z',
          sourceMetadata: {},
        },
      },
      message: 'Promoted scenario output found for this player.',
      readOnly: true as const,
      provenanceNote: 'Read-only summary of promoted Point-prediction-Model output.',
      error: null,
    },
  },
};

describe('PlayerResearchWorkspaceView', () => {
  it('renders player-centric promoted sections with deeper lab link-outs', () => {
    const html = renderToStaticMarkup(
      React.createElement(PlayerResearchWorkspaceView, {
        season: '2025',
        availableSeasons: [2025, 2024],
        data,
        isLoading: false,
        errorMessage: null,
        onSeasonChange: jest.fn(),
      }),
    );

    expect(html).toContain('Player Research Workspace');
    expect(html).toContain('first true cross-model synthesis surface');
    expect(html).toContain('Justin Jefferson');
    expect(html).toContain('Breakout Signals summary');
    expect(html).toContain('Role &amp; Opportunity summary');
    expect(html).toContain('Age Curve / ARC summary');
    expect(html).toContain('Point Scenario summary');
    expect(html).toContain('/tiber-data-lab/breakout-signals?playerId=00-0036322&amp;playerName=Justin+Jefferson&amp;season=2025');
    expect(html).toContain('/tiber-data-lab/role-opportunity?playerId=00-0036322&amp;playerName=Justin+Jefferson&amp;season=2025');
    expect(html).toContain('/tiber-data-lab/point-scenarios?playerId=00-0036322&amp;playerName=Justin+Jefferson&amp;season=2025');
    expect(html).toContain('No promoted ARC output is available for this player in the selected season.');
  });

  it('renders loading, empty, and error states without breaking the workspace shell', () => {
    const loadingHtml = renderToStaticMarkup(
      React.createElement(PlayerResearchWorkspaceView, {
        season: '2025',
        availableSeasons: [2025],
        data: null,
        isLoading: true,
        errorMessage: null,
        onSeasonChange: jest.fn(),
      }),
    );
    expect(loadingHtml).toContain('Loading promoted player research workspace');

    const emptyHtml = renderToStaticMarkup(
      React.createElement(PlayerResearchWorkspaceView, {
        season: '2025',
        availableSeasons: [2025],
        data: { ...data, state: 'empty', selectedPlayer: null, requestedPlayerId: null, requestedPlayerName: 'Unknown Player' },
        isLoading: false,
        errorMessage: null,
        onSeasonChange: jest.fn(),
      }),
    );
    expect(emptyHtml).toContain('No promoted player match was found');

    const errorHtml = renderToStaticMarkup(
      React.createElement(PlayerResearchWorkspaceView, {
        season: '2025',
        availableSeasons: [2025],
        data: null,
        isLoading: false,
        errorMessage: 'Workspace unavailable',
        onSeasonChange: jest.fn(),
      }),
    );
    expect(errorHtml).toContain('Workspace unavailable');
  });

  it('keeps query-param and player-search helpers stable', () => {
    expect(buildPlayerResearchHref({ season: '2025', playerId: '00-0036322', playerName: 'Justin Jefferson' })).toBe(
      '/tiber-data-lab/player-research?season=2025&playerId=00-0036322&playerName=Justin+Jefferson',
    );
    expect(readPlayerResearchQuery('?season=2024&playerId=00-0036322&playerName=Justin+Jefferson', '2025')).toEqual({
      season: '2024',
      playerId: '00-0036322',
      playerName: 'Justin Jefferson',
    });
    expect(filterPlayerResearchSearchIndex(data.searchIndex, 'malik').map((entry) => entry.playerName)).toEqual(['Malik Nabers']);
    expect(findSearchEntryByQuery(data.searchIndex, { playerName: 'Justin Jefferson' })?.playerId).toBe('00-0036322');
    expect(getPlayerResearchStateLabel('partial')).toBe('Partial promoted coverage');
  });
});
