import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlayerResearchSummaryBlock } from '@/components/data-lab/PlayerResearchSummaryBlock';
import type { PlayerResearchResponse } from '@/lib/playerResearch';

function buildData(overrides: Partial<PlayerResearchResponse['data']> = {}): PlayerResearchResponse['data'] {
  return {
    season: 2025,
    availableSeasons: [2025],
    state: 'ready',
    requestedPlayerId: '00-0036322',
    requestedPlayerName: 'Justin Jefferson',
    selectedPlayer: {
      playerId: '00-0036322',
      playerName: 'Justin Jefferson',
      team: 'MIN',
      position: 'WR',
      matchStrategy: 'player_id',
    },
    searchIndex: [],
    framing: {
      title: 'Player Research Workspace',
      description: 'Inspect promoted read-only outputs for one player in one place.',
      provenanceNote: 'TIBER-Fantasy orchestrates promoted outputs without local recomputation.',
    },
    warnings: [],
    sections: {
      breakoutSignals: {
        state: 'ready',
        title: 'Breakout Signals',
        description: '',
        linkHref: '/tiber-data-lab/breakout-signals',
        summary: {
          candidateRank: 3,
          finalSignalScore: 91.4,
          bestRecipeName: 'Vertical alpha',
          breakoutLabel: 'Tier 1 breakout',
          breakoutContext: 'Elite route + target growth across promoted signal exports.',
          componentSummary: [],
          source: { provider: 'signal-validation-model', exportDirectory: 'exports/2025' },
        },
        message: null,
        readOnly: true,
        provenanceNote: '',
        error: null,
      },
      roleOpportunity: {
        state: 'ready',
        title: 'Role & Opportunity',
        description: '',
        linkHref: '/tiber-data-lab/role-opportunity',
        summary: {
          primaryRole: 'Movement X / featured target',
          routeParticipation: 0.92,
          targetShare: 0.31,
          airYardShare: 0.38,
          snapShare: 0.88,
          usageRate: 0.34,
          confidenceScore: 0.86,
          confidenceTier: 'High',
          insights: ['Target earning remains strong versus current usage baseline.'],
          source: { sourceName: 'Role model', sourceType: 'artifact', modelVersion: 'v1', generatedAt: '2026-03-23' },
        },
        message: null,
        readOnly: true,
        provenanceNote: '',
        error: null,
      },
      ageCurves: {
        state: 'ready',
        title: 'Age Curves',
        description: '',
        linkHref: '/tiber-data-lab/age-curves',
        summary: {
          age: 26,
          careerYear: 5,
          expectedPpg: 17.2,
          actualPpg: 18.8,
          ppgDelta: 1.6,
          trajectoryLabel: 'Ascending prime',
          peerBucket: 'Elite WR',
          ageCurveScore: 87,
          provenance: { provider: 'arc', sourceName: 'ARC', sourceType: 'artifact', modelVersion: 'v2', generatedAt: '2026-03-23', notes: [] },
        },
        message: null,
        readOnly: true,
        provenanceNote: '',
        error: null,
      },
      pointScenarios: {
        state: 'ready',
        title: 'Point Scenarios',
        description: '',
        linkHref: '/tiber-data-lab/point-scenarios',
        summary: {
          baselineProjection: 18.1,
          adjustedProjection: 19.4,
          delta: 1.3,
          confidenceBand: '80th percentile',
          confidenceLabel: 'Aggressive ceiling',
          scenarioCount: 2,
          topScenarioNames: ['Shootout path'],
          notes: ['Positive scenario pressure from volume + scoring environment.'],
          source: { provider: 'ppm', sourceName: 'PPM', sourceType: 'artifact', modelVersion: 'v1', generatedAt: '2026-03-23', sourceMetadata: {} },
        },
        message: null,
        readOnly: true,
        provenanceNote: '',
        error: null,
      },
    },
    ...overrides,
  };
}

describe('PlayerResearchSummaryBlock', () => {
  it('renders a compact inline summary with promoted research rows when full data is available', () => {
    const html = renderToStaticMarkup(
      React.createElement(PlayerResearchSummaryBlock, {
        season: '2025',
        playerId: '00-0036322',
        playerName: 'Justin Jefferson',
        data: buildData(),
      }),
    );

    expect(html).toContain('Research Summary');
    expect(html).toContain('Rank #3');
    expect(html).toContain('Vertical alpha');
    expect(html).toContain('Movement X / featured target');
    expect(html).toContain('Ascending prime');
    expect(html).toContain('Shootout path');
  });

  it('renders partial data cleanly without requiring every promoted section', () => {
    const html = renderToStaticMarkup(
      React.createElement(PlayerResearchSummaryBlock, {
        season: '2025',
        playerId: '00-0036322',
        playerName: 'Justin Jefferson',
        data: buildData({
          state: 'partial',
          sections: {
            ...buildData().sections,
            breakoutSignals: { ...buildData().sections.breakoutSignals, summary: null, state: 'not_available' },
            pointScenarios: { ...buildData().sections.pointScenarios, summary: null, state: 'not_available' },
          },
        }),
      }),
    );

    expect(html).toContain('Partial promoted coverage');
    expect(html).toContain('Movement X / featured target');
    expect(html).toContain('Ascending prime');
    expect(html).not.toContain('Vertical alpha');
    expect(html).not.toContain('Shootout path');
  });

  it('keeps the CTA link stable for the full Player Research workspace', () => {
    const html = renderToStaticMarkup(
      React.createElement(PlayerResearchSummaryBlock, {
        season: '2025',
        playerId: '00-0036322',
        playerName: 'Justin Jefferson',
        data: buildData(),
      }),
    );

    expect(html).toContain('/tiber-data-lab/player-research?season=2025&amp;playerId=00-0036322&amp;playerName=Justin+Jefferson');
    expect(html).toContain('Open Player Research');
  });

  it('distinguishes empty research from system-unavailable states', () => {
    const emptyHtml = renderToStaticMarkup(
      React.createElement(PlayerResearchSummaryBlock, {
        season: '2025',
        playerId: '00-0036322',
        playerName: 'Justin Jefferson',
        data: buildData({
          state: 'empty',
          selectedPlayer: {
            playerId: '00-0036322',
            playerName: 'Justin Jefferson',
            team: 'MIN',
            position: 'WR',
            matchStrategy: 'player_id',
          },
          sections: {
            breakoutSignals: { ...buildData().sections.breakoutSignals, summary: null, state: 'not_available' },
            roleOpportunity: { ...buildData().sections.roleOpportunity, summary: null, state: 'not_available' },
            ageCurves: { ...buildData().sections.ageCurves, summary: null, state: 'not_available' },
            pointScenarios: { ...buildData().sections.pointScenarios, summary: null, state: 'not_available' },
          },
        }),
      }),
    );
    const unavailableHtml = renderToStaticMarkup(
      React.createElement(PlayerResearchSummaryBlock, {
        season: '2025',
        playerId: '00-0036322',
        playerName: 'Justin Jefferson',
        data: buildData({ state: 'error' }),
        errorMessage: 'Promoted adapters timed out',
      }),
    );

    expect(emptyHtml).toContain('Research available in Data Lab');
    expect(emptyHtml).not.toContain('Research system unavailable');
    expect(unavailableHtml).toContain('Research system unavailable');
    expect(unavailableHtml).toContain('Promoted adapters timed out');
  });
});
