import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TeamResearchSummaryBlock } from '@/components/data-lab/TeamResearchSummaryBlock';
import type { TeamResearchResponse } from '@/lib/teamResearch';

function buildData(overrides: Partial<TeamResearchResponse['data']> = {}): TeamResearchResponse['data'] {
  return {
    season: 2025,
    availableSeasons: [2025],
    state: 'ready',
    requestedTeam: 'MIN',
    selectedTeam: {
      team: 'MIN',
      teamName: 'Minnesota Vikings',
      conference: 'NFC',
      division: 'North',
      matchStrategy: 'team_code',
    },
    searchIndex: [],
    framing: {
      title: 'Team Research Workspace',
      description: 'Inspect promoted read-only outputs for one team in one place.',
      provenanceNote: 'TIBER-Fantasy orchestrates promoted outputs without local recomputation.',
    },
    warnings: [],
    header: {
      team: 'MIN',
      teamName: 'Minnesota Vikings',
      conference: 'NFC',
      division: 'North',
    },
    keyPlayers: [
      {
        playerId: '00-0036322',
        playerName: 'Justin Jefferson',
        team: 'MIN',
        position: 'WR',
        playerResearchHref: '/tiber-data-lab/player-research?season=2025&playerId=00-0036322&playerName=Justin+Jefferson',
        modules: { breakoutSignals: true, roleOpportunity: true, ageCurves: true, pointScenarios: true },
        primaryRole: 'alpha_x',
        targetShare: 0.31,
        routeParticipation: 0.95,
        snapShare: 0.92,
        usageRate: 0.28,
        breakoutSignalScore: 91.4,
        breakoutLabel: 'Priority breakout',
        breakoutRank: 3,
        trajectoryLabel: 'Ascending prime',
        ageCurveScore: 89.2,
        ppgDelta: 1.6,
        scenarioDelta: 2.9,
        scenarioCount: 2,
      },
      {
        playerId: '00-0030565',
        playerName: 'Jordan Addison',
        team: 'MIN',
        position: 'WR',
        playerResearchHref: '/tiber-data-lab/player-research?season=2025&playerId=00-0030565&playerName=Jordan+Addison',
        modules: { breakoutSignals: true, roleOpportunity: true, ageCurves: true, pointScenarios: true },
        primaryRole: 'flanker',
        targetShare: 0.22,
        routeParticipation: 0.88,
        snapShare: 0.84,
        usageRate: 0.21,
        breakoutSignalScore: 84.3,
        breakoutLabel: 'Growth watch',
        breakoutRank: 9,
        trajectoryLabel: 'Early ascent',
        ageCurveScore: 78.1,
        ppgDelta: 0.7,
        scenarioDelta: 1.4,
        scenarioCount: 1,
      },
    ],
    sections: {
      offensiveContext: {
        state: 'ready',
        title: 'Offensive context summary',
        description: '',
        linkHref: '/tiber-data-lab/team-research?season=2025&team=MIN',
        summary: {
          team: 'MIN',
          teamName: 'Minnesota Vikings',
          promotedPlayerCount: 2,
          positionsCovered: ['WR', 'TE'],
          breakoutCandidateCount: 2,
          rolePlayerCount: 2,
          ageCurvePlayerCount: 2,
          scenarioPlayerCount: 2,
          avgTargetShare: 0.27,
          avgRouteParticipation: 0.91,
          avgSnapShare: 0.88,
          avgUsageRate: 0.24,
          topPlayers: ['Justin Jefferson', 'Jordan Addison'],
          notes: ['Pass volume remains concentrated around Minnesota\'s top receiving duo.'],
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
        linkHref: '/tiber-data-lab/role-opportunity?season=2025&team=MIN',
        summary: {
          playerCount: 2,
          avgTargetShare: 0.27,
          avgRouteParticipation: 0.91,
          avgSnapShare: 0.88,
          avgUsageRate: 0.24,
          keyPlayers: [],
          source: { provider: 'role-and-opportunity-model', location: 'https://example.test/role', mode: 'api' },
        },
        message: null,
        readOnly: true,
        provenanceNote: '',
        error: null,
      },
      breakoutSignals: {
        state: 'ready',
        title: 'Breakout Signals',
        description: '',
        linkHref: '/tiber-data-lab/breakout-signals?season=2025&team=MIN',
        summary: {
          candidateCount: 2,
          topSignalScore: 91.4,
          bestRecipeName: 'Vertical alpha',
          players: [
            {
              ...({} as TeamResearchResponse['data']['keyPlayers'][number]),
              playerId: '00-0030565',
              playerName: 'Jordan Addison',
              team: 'MIN',
              position: 'WR',
              playerResearchHref: '/tiber-data-lab/player-research?season=2025&playerId=00-0030565&playerName=Jordan+Addison',
              modules: { breakoutSignals: true, roleOpportunity: true, ageCurves: true, pointScenarios: true },
              primaryRole: 'flanker',
              targetShare: 0.22,
              routeParticipation: 0.88,
              snapShare: 0.84,
              usageRate: 0.21,
              breakoutSignalScore: 84.3,
              breakoutLabel: 'Growth watch',
              breakoutRank: 9,
              trajectoryLabel: 'Early ascent',
              ageCurveScore: 78.1,
              ppgDelta: 0.7,
              scenarioDelta: 1.4,
              scenarioCount: 1,
            },
          ],
          source: { provider: 'signal-validation-model', exportDirectory: 'exports/2025' },
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
        linkHref: '/tiber-data-lab/point-scenarios?season=2025&team=MIN',
        summary: {
          playerCount: 2,
          totalScenarioCount: 3,
          maxDelta: 2.9,
          players: [
            {
              ...({} as TeamResearchResponse['data']['keyPlayers'][number]),
              playerId: '00-0036322',
              playerName: 'Justin Jefferson',
              team: 'MIN',
              position: 'WR',
              playerResearchHref: '/tiber-data-lab/player-research?season=2025&playerId=00-0036322&playerName=Justin+Jefferson',
              modules: { breakoutSignals: true, roleOpportunity: true, ageCurves: true, pointScenarios: true },
              primaryRole: 'alpha_x',
              targetShare: 0.31,
              routeParticipation: 0.95,
              snapShare: 0.92,
              usageRate: 0.28,
              breakoutSignalScore: 91.4,
              breakoutLabel: 'Priority breakout',
              breakoutRank: 3,
              trajectoryLabel: 'Ascending prime',
              ageCurveScore: 89.2,
              ppgDelta: 1.6,
              scenarioDelta: 2.9,
              scenarioCount: 2,
            },
          ],
          source: { provider: 'ppm', location: '/exports/ppm', mode: 'artifact' },
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
        linkHref: '/tiber-data-lab/age-curves?season=2025&team=MIN',
        summary: {
          playerCount: 2,
          players: [
            {
              ...({} as TeamResearchResponse['data']['keyPlayers'][number]),
              playerId: '00-0036322',
              playerName: 'Justin Jefferson',
              team: 'MIN',
              position: 'WR',
              playerResearchHref: '/tiber-data-lab/player-research?season=2025&playerId=00-0036322&playerName=Justin+Jefferson',
              modules: { breakoutSignals: true, roleOpportunity: true, ageCurves: true, pointScenarios: true },
              primaryRole: 'alpha_x',
              targetShare: 0.31,
              routeParticipation: 0.95,
              snapShare: 0.92,
              usageRate: 0.28,
              breakoutSignalScore: 91.4,
              breakoutLabel: 'Priority breakout',
              breakoutRank: 3,
              trajectoryLabel: 'Ascending prime',
              ageCurveScore: 89.2,
              ppgDelta: 1.6,
              scenarioDelta: 2.9,
              scenarioCount: 2,
            },
          ],
          source: { provider: 'arc-model', location: '/exports/arc', mode: 'artifact' },
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

describe('TeamResearchSummaryBlock', () => {
  it('renders a compact inline summary with promoted team rows when full data is available', () => {
    const html = renderToStaticMarkup(
      React.createElement(TeamResearchSummaryBlock, {
        season: '2025',
        team: 'MIN',
        data: buildData(),
      }),
    );

    expect(html).toContain('Team Research Summary');
    expect(html).toContain('Offensive environment');
    expect(html).toContain('2 promoted players');
    expect(html).toContain('Vertical alpha');
    expect(html).toContain('Max Δ +2.9');
    expect(html).toContain('Ascending prime');
  });

  it('renders partial data cleanly without requiring every promoted section', () => {
    const html = renderToStaticMarkup(
      React.createElement(TeamResearchSummaryBlock, {
        season: '2025',
        team: 'MIN',
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
    expect(html).toContain('Avg target 27%');
    expect(html).toContain('2 promoted ARC snapshots');
    expect(html).not.toContain('Vertical alpha');
    expect(html).not.toContain('Max Δ +2.9');
  });

  it('keeps the CTA link stable for the full Team Research workspace', () => {
    const html = renderToStaticMarkup(
      React.createElement(TeamResearchSummaryBlock, {
        season: '2025',
        team: 'MIN',
        data: buildData(),
      }),
    );

    expect(html).toContain('/tiber-data-lab/team-research?season=2025&amp;team=MIN');
    expect(html).toContain('Open Team Research');
  });

  it('distinguishes empty research from system-unavailable states', () => {
    const emptyHtml = renderToStaticMarkup(
      React.createElement(TeamResearchSummaryBlock, {
        season: '2025',
        team: 'MIN',
        data: buildData({
          state: 'empty',
          sections: {
            offensiveContext: { ...buildData().sections.offensiveContext, summary: null, state: 'not_available' },
            roleOpportunity: { ...buildData().sections.roleOpportunity, summary: null, state: 'not_available' },
            breakoutSignals: { ...buildData().sections.breakoutSignals, summary: null, state: 'not_available' },
            pointScenarios: { ...buildData().sections.pointScenarios, summary: null, state: 'not_available' },
            ageCurves: { ...buildData().sections.ageCurves, summary: null, state: 'not_available' },
          },
        }),
      }),
    );
    const unavailableHtml = renderToStaticMarkup(
      React.createElement(TeamResearchSummaryBlock, {
        season: '2025',
        team: 'MIN',
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
