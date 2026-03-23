import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DataLabDiscoveryWidget } from '@/components/data-lab/DataLabDiscoveryWidget';

const commandCenterData = {
  season: 2025,
  availableSeasons: [2025],
  state: 'partial' as const,
  framing: {
    title: 'Data Lab Command Center',
    description: 'Fixture command-center copy.',
    posture: 'Read-only orchestration.',
  },
  moduleStatuses: [],
  priorities: [
    {
      id: 'priority-1',
      title: 'Top breakout candidates this season',
      reason: 'Two promoted breakout profiles stand out as fast follow-up research targets.',
      moduleTitle: 'WR Breakout Lab',
      moduleHref: '/tiber-data-lab/breakout-signals?season=2025',
      primaryAction: {
        label: 'Open Player Research',
        href: '/tiber-data-lab/player-research?season=2025&playerId=00-0036322&playerName=Justin+Jefferson',
      },
      secondaryAction: {
        label: 'Open module',
        href: '/tiber-data-lab/breakout-signals?season=2025',
      },
    },
  ],
  warnings: ['Age Curve / ARC unavailable for one section.'],
  sections: {
    breakoutCandidates: {
      state: 'ready' as const,
      title: 'Breakout candidates',
      description: 'Fixture breakout candidates.',
      moduleTitle: 'WR Breakout Lab',
      linkHref: '/tiber-data-lab/breakout-signals?season=2025',
      message: 'Breakout items available.',
      items: [
        {
          playerId: '00-0036322',
          playerName: 'Justin Jefferson',
          team: 'MIN',
          candidateRank: 1,
          finalSignalScore: 91.4,
          breakoutLabel: 'Priority breakout',
          breakoutContext: 'Fixture context.',
          links: {
            moduleHref: '/tiber-data-lab/breakout-signals?season=2025',
            playerResearchHref: '/tiber-data-lab/player-research?season=2025&playerId=00-0036322&playerName=Justin+Jefferson',
          },
        },
      ],
    },
    roleOpportunity: {
      state: 'empty' as const,
      title: 'Role & Opportunity',
      description: 'Fixture role section.',
      moduleTitle: 'Role & Opportunity Lab',
      linkHref: '/tiber-data-lab/role-opportunity?season=2025',
      message: 'No item.',
      items: [],
    },
    ageCurves: {
      state: 'empty' as const,
      title: 'Age Curves',
      description: 'Fixture age section.',
      moduleTitle: 'Age Curve / ARC Lab',
      linkHref: '/tiber-data-lab/age-curves?season=2025',
      message: 'No item.',
      items: [],
    },
    pointScenarios: {
      state: 'empty' as const,
      title: 'Point Scenarios',
      description: 'Fixture scenario section.',
      moduleTitle: 'Point Scenario Lab',
      linkHref: '/tiber-data-lab/point-scenarios?season=2025',
      message: 'No item.',
      items: [],
    },
    teamEnvironments: {
      state: 'ready' as const,
      title: 'Team environments',
      description: 'Fixture team section.',
      moduleTitle: 'Team Research Workspace',
      linkHref: '/tiber-data-lab/team-research?season=2025',
      message: 'Team items available.',
      items: [
        {
          team: 'MIN',
          teamName: 'Minnesota Vikings',
          breakoutCandidateCount: 2,
          rolePlayerCount: 3,
          ageSignalCount: 1,
          scenarioPlayerCount: 2,
          avgTargetShare: 0.23,
          avgRouteParticipation: 0.78,
          maxScenarioDelta: 2.8,
          topPlayers: ['Justin Jefferson', 'Jordan Addison'],
          links: {
            moduleHref: '/tiber-data-lab/team-research?season=2025&team=MIN',
            teamResearchHref: '/tiber-data-lab/team-research?season=2025&team=MIN',
          },
        },
      ],
    },
  },
};

describe('DataLabDiscoveryWidget', () => {
  it('renders a concise read-only command-center discovery card', () => {
    const html = renderToStaticMarkup(
      React.createElement(DataLabDiscoveryWidget, {
        season: '2025',
        data: commandCenterData,
        fallbackSummary: {
          playersTracked: 24,
          avgPpg: 15.2,
          t1Count: 4,
          topScorerName: 'Justin Jefferson',
          topScorerPpg: 21.4,
        },
      }),
    );

    expect(html).toContain('Research worth opening from the normal flow');
    expect(html).toContain('Top breakout candidates this season');
    expect(html).toContain('Minnesota Vikings');
    expect(html).toContain('Open Command Center');
    expect(html).toContain('/tiber-data-lab/command-center?season=2025');
  });

  it('falls back to compact command-center CTA copy without breaking the widget shell', () => {
    const html = renderToStaticMarkup(
      React.createElement(DataLabDiscoveryWidget, {
        season: '2025',
        data: null,
        isLoading: false,
        fallbackSummary: {
          playersTracked: 18,
          avgPpg: 14.1,
          t1Count: 3,
          topScorerName: 'Amon-Ra St. Brown',
          topScorerPpg: 19.8,
        },
      }),
    );

    expect(html).toContain('Amon-Ra St. Brown');
    expect(html).toContain('Open the Command Center');
    expect(html).toContain('Players');
  });
});
