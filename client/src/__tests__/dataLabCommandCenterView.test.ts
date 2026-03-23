import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DataLabCommandCenterView } from '@/components/data-lab/DataLabCommandCenterView';
import {
  buildDataLabCommandCenterHref,
  getCommandCenterStateLabel,
  readDataLabCommandCenterQuery,
} from '@/lib/dataLabCommandCenter';

const data = {
  season: 2025,
  availableSeasons: [2025, 2024],
  state: 'partial' as const,
  framing: {
    title: 'Data Lab Command Center',
    description: 'Fixture description for the front door.',
    posture: 'Fixture posture. No unified score.',
  },
  moduleStatuses: [
    { moduleId: 'breakout-signals' as const, title: 'WR Breakout Lab', href: '/tiber-data-lab/breakout-signals', state: 'ready' as const, detail: 'Ready' },
    { moduleId: 'role-opportunity' as const, title: 'Role & Opportunity Lab', href: '/tiber-data-lab/role-opportunity', state: 'unavailable' as const, detail: 'Unavailable' },
    { moduleId: 'age-curves' as const, title: 'Age Curve / ARC Lab', href: '/tiber-data-lab/age-curves', state: 'empty' as const, detail: 'Empty' },
    { moduleId: 'point-scenarios' as const, title: 'Point Scenario Lab', href: '/tiber-data-lab/point-scenarios', state: 'ready' as const, detail: 'Ready' },
  ],
  priorities: [
    {
      id: 'priority-breakout',
      title: 'Start with Malik Nabers',
      reason: 'Fixture breakout reason.',
      moduleTitle: 'WR Breakout Lab',
      moduleHref: '/tiber-data-lab/breakout-signals?season=2025&playerId=00-0042051&playerName=Malik+Nabers',
      primaryAction: { label: 'Open in Player Research', href: '/tiber-data-lab/player-research?season=2025&playerId=00-0042051&playerName=Malik+Nabers' },
      secondaryAction: { label: 'Open breakout card', href: '/tiber-data-lab/breakout-signals?season=2025&playerId=00-0042051&playerName=Malik+Nabers' },
    },
    {
      id: 'priority-team',
      title: 'Review Minnesota Vikings',
      reason: 'Fixture team reason.',
      moduleTitle: 'Team Research Workspace',
      moduleHref: '/tiber-data-lab/team-research?season=2025&team=MIN',
      primaryAction: { label: 'Open in Team Research', href: '/tiber-data-lab/team-research?season=2025&team=MIN' },
      secondaryAction: { label: 'Jump to team workspace', href: '/tiber-data-lab/team-research?season=2025&team=MIN' },
    },
  ],
  warnings: ['Role & Opportunity Lab unavailable: Fixture outage'],
  sections: {
    breakoutCandidates: {
      state: 'ready' as const,
      title: 'Top breakout candidates',
      description: 'Fixture breakout section',
      moduleTitle: 'WR Breakout Lab',
      linkHref: '/tiber-data-lab/breakout-signals?season=2025',
      message: 'Breakout message',
      items: [
        {
          playerId: '00-0042051',
          playerName: 'Malik Nabers',
          team: 'NYG',
          candidateRank: 1,
          finalSignalScore: 95.2,
          breakoutLabel: 'Priority breakout',
          breakoutContext: 'Fixture breakout context',
          links: {
            moduleHref: '/tiber-data-lab/breakout-signals?season=2025&playerId=00-0042051&playerName=Malik+Nabers',
            playerResearchHref: '/tiber-data-lab/player-research?season=2025&playerId=00-0042051&playerName=Malik+Nabers',
          },
        },
      ],
    },
    roleOpportunity: {
      state: 'unavailable' as const,
      title: 'Notable role / opportunity movers',
      description: 'Fixture role section',
      moduleTitle: 'Role & Opportunity Lab',
      linkHref: '/tiber-data-lab/role-opportunity?season=2025',
      message: 'Role unavailable',
      items: [],
    },
    ageCurves: {
      state: 'empty' as const,
      title: 'Age-curve overperformers / underperformers',
      description: 'Fixture age section',
      moduleTitle: 'Age Curve / ARC Lab',
      linkHref: '/tiber-data-lab/age-curves?season=2025',
      message: 'No ARC rows',
      items: [],
    },
    pointScenarios: {
      state: 'ready' as const,
      title: 'Biggest point-scenario movers',
      description: 'Fixture scenario section',
      moduleTitle: 'Point Scenario Lab',
      linkHref: '/tiber-data-lab/point-scenarios?season=2025',
      message: 'Scenario message',
      items: [
        {
          playerId: '00-0036322',
          playerName: 'Justin Jefferson',
          team: 'MIN',
          position: 'WR',
          scenarioName: 'Target spike if WR2 sits',
          delta: 3.2,
          baselineProjection: 18.5,
          adjustedProjection: 21.7,
          confidenceLabel: 'actionable',
          eventType: 'injury',
          links: {
            moduleHref: '/tiber-data-lab/point-scenarios?season=2025&playerId=00-0036322&playerName=Justin+Jefferson',
            playerResearchHref: '/tiber-data-lab/player-research?season=2025&playerId=00-0036322&playerName=Justin+Jefferson',
          },
        },
      ],
    },
    teamEnvironments: {
      state: 'ready' as const,
      title: 'Team environments worth investigating',
      description: 'Fixture team section',
      moduleTitle: 'Team Research Workspace',
      linkHref: '/tiber-data-lab/team-research?season=2025',
      message: 'Team message',
      items: [
        {
          team: 'MIN',
          teamName: 'Minnesota Vikings',
          breakoutCandidateCount: 1,
          rolePlayerCount: 2,
          ageSignalCount: 1,
          scenarioPlayerCount: 1,
          avgTargetShare: 0.31,
          avgRouteParticipation: 0.95,
          maxScenarioDelta: 3.2,
          topPlayers: ['Justin Jefferson'],
          links: {
            moduleHref: '/tiber-data-lab/team-research?season=2025&team=MIN',
            teamResearchHref: '/tiber-data-lab/team-research?season=2025&team=MIN',
          },
        },
      ],
    },
  },
};

describe('DataLabCommandCenterView', () => {
  it('renders stable section ordering, mixed section states, and quick links into research workspaces', () => {
    const html = renderToStaticMarkup(
      React.createElement(DataLabCommandCenterView, {
        season: '2025',
        availableSeasons: [2025, 2024],
        data,
        isLoading: false,
        errorMessage: null,
        onSeasonChange: jest.fn(),
      }),
    );

    expect(html).toContain('Data Lab Command Center');
    expect(html).toContain('Command Center priorities');
    expect(html).toContain('Top breakout candidates');
    expect(html).toContain('Notable role / opportunity movers');
    expect(html).toContain('Age-curve overperformers / underperformers');
    expect(html).toContain('Biggest point-scenario movers');
    expect(html).toContain('Team environments worth investigating');
    expect(html).toContain('/tiber-data-lab/player-research?season=2025&amp;playerId=00-0042051&amp;playerName=Malik+Nabers');
    expect(html).toContain('/tiber-data-lab/team-research?season=2025&amp;team=MIN');
    expect(html).toContain('Role unavailable');
    expect(html).toContain('No ARC rows');
  });

  it('renders loading and error states without losing the shell', () => {
    const loadingHtml = renderToStaticMarkup(
      React.createElement(DataLabCommandCenterView, {
        season: '2025',
        availableSeasons: [2025],
        data: null,
        isLoading: true,
        errorMessage: null,
        onSeasonChange: jest.fn(),
      }),
    );
    expect(loadingHtml).toContain('Loading Data Lab Command Center');

    const errorHtml = renderToStaticMarkup(
      React.createElement(DataLabCommandCenterView, {
        season: '2025',
        availableSeasons: [2025],
        data: null,
        isLoading: false,
        errorMessage: 'Command center unavailable',
        onSeasonChange: jest.fn(),
      }),
    );
    expect(errorHtml).toContain('Data Lab Command Center unavailable');
  });

  it('keeps query helpers stable', () => {
    expect(buildDataLabCommandCenterHref({ season: '2025' })).toBe('/tiber-data-lab/command-center?season=2025');
    expect(readDataLabCommandCenterQuery('?season=2024', '2025')).toEqual({ season: '2024' });
    expect(getCommandCenterStateLabel('partial')).toBe('Partial promoted coverage');
  });
});
