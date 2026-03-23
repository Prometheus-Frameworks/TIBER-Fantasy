import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TeamResearchWorkspaceView } from '@/components/data-lab/TeamResearchWorkspaceView';
import {
  buildTeamResearchHref,
  filterTeamResearchSearchIndex,
  findTeamSearchEntry,
  getTeamResearchStateLabel,
  readTeamResearchQuery,
} from '@/lib/teamResearch';

const data = {
  season: 2025,
  availableSeasons: [2025, 2024],
  state: 'partial' as const,
  requestedTeam: 'MIN',
  selectedTeam: {
    team: 'MIN',
    teamName: 'Minnesota Vikings',
    conference: 'NFC',
    division: 'North',
    matchStrategy: 'team_code' as const,
  },
  searchIndex: [
    {
      team: 'MIN',
      teamName: 'Minnesota Vikings',
      conference: 'NFC',
      division: 'North',
      playerCount: 3,
      modules: {
        breakoutSignals: true,
        roleOpportunity: true,
        ageCurves: true,
        pointScenarios: true,
      },
    },
    {
      team: 'SEA',
      teamName: 'Seattle Seahawks',
      conference: 'NFC',
      division: 'West',
      playerCount: 2,
      modules: {
        breakoutSignals: false,
        roleOpportunity: true,
        ageCurves: false,
        pointScenarios: true,
      },
    },
  ],
  framing: {
    title: 'Team Research Workspace',
    description: 'Fixture team framing copy.',
    provenanceNote: 'TIBER-Fantasy is not recomputing model logic locally.',
  },
  warnings: ['Breakout Signals unavailable: fixture. Team Research remains read only for Minnesota Vikings.'],
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
      trajectoryLabel: 'Prime hold',
      ageCurveScore: 90.2,
      ppgDelta: 1.3,
      scenarioDelta: 2.9,
      scenarioCount: 2,
    },
  ],
  sections: {
    offensiveContext: {
      state: 'ready' as const,
      title: 'Offensive context summary',
      description: 'Fixture context copy.',
      linkHref: '/tiber-data-lab/role-opportunity?season=2025&team=MIN',
      summary: {
        team: 'MIN',
        teamName: 'Minnesota Vikings',
        promotedPlayerCount: 1,
        positionsCovered: ['WR'],
        breakoutCandidateCount: 1,
        rolePlayerCount: 1,
        ageCurvePlayerCount: 1,
        scenarioPlayerCount: 1,
        avgTargetShare: 0.31,
        avgRouteParticipation: 0.95,
        avgSnapShare: 0.92,
        avgUsageRate: 0.28,
        topPlayers: ['Justin Jefferson'],
        notes: ['1 promoted role/opportunity players found for Minnesota Vikings.'],
      },
      message: 'Promoted team context assembled from the available read-only model surfaces.',
      readOnly: true as const,
      provenanceNote: 'Read-only synthesis.',
      error: null,
    },
    roleOpportunity: {
      state: 'ready' as const,
      title: 'Role & Opportunity summary by key players',
      description: 'Fixture role copy.',
      linkHref: '/tiber-data-lab/role-opportunity?season=2025&team=MIN',
      summary: {
        playerCount: 1,
        avgTargetShare: 0.31,
        avgRouteParticipation: 0.95,
        avgSnapShare: 0.92,
        avgUsageRate: 0.28,
        keyPlayers: [],
        source: { provider: 'role-and-opportunity-model', location: 'https://example.test/role', mode: 'api' as const },
      },
      message: 'Promoted role and opportunity rows found for this team.',
      readOnly: true as const,
      provenanceNote: 'Read-only role summary.',
      error: null,
    },
    breakoutSignals: {
      state: 'not_available' as const,
      title: 'Breakout-relevant roster signals',
      description: 'Fixture breakout copy.',
      linkHref: '/tiber-data-lab/breakout-signals?season=2025&team=MIN',
      summary: null,
      message: 'No promoted breakout outputs are available for this team in the selected season.',
      readOnly: true as const,
      provenanceNote: 'Read-only breakout summary.',
      error: null,
    },
    pointScenarios: {
      state: 'ready' as const,
      title: 'Scenario context summary',
      description: 'Fixture scenario copy.',
      linkHref: '/tiber-data-lab/point-scenarios?season=2025&team=MIN',
      summary: {
        playerCount: 1,
        totalScenarioCount: 2,
        maxDelta: 2.9,
        players: [],
        source: { provider: 'point-prediction-model', location: '/exports/scenarios', mode: 'artifact' as const },
      },
      message: 'Promoted scenario outputs found for this roster.',
      readOnly: true as const,
      provenanceNote: 'Read-only scenario summary.',
      error: null,
    },
    ageCurves: {
      state: 'ready' as const,
      title: 'ARC / development snapshot',
      description: 'Fixture ARC copy.',
      linkHref: '/tiber-data-lab/age-curves?season=2025&team=MIN',
      summary: {
        playerCount: 1,
        players: [],
        source: { provider: 'arc-model', location: '/exports/arc', mode: 'artifact' as const },
      },
      message: 'Promoted ARC outputs found for this roster.',
      readOnly: true as const,
      provenanceNote: 'Read-only ARC summary.',
      error: null,
    },
  },
};

describe('TeamResearchWorkspaceView', () => {
  it('renders team-centric promoted sections with player-research link-outs', () => {
    const html = renderToStaticMarkup(
      React.createElement(TeamResearchWorkspaceView, {
        season: '2025',
        availableSeasons: [2025, 2024],
        data,
        isLoading: false,
        errorMessage: null,
        onSeasonChange: jest.fn(),
      }),
    );

    expect(html).toContain('Team Research Workspace');
    expect(html).toContain('whole picture for one offensive environment');
    expect(html).toContain('Minnesota Vikings');
    expect(html).toContain('Offensive context summary');
    expect(html).toContain('Key players on this team');
    expect(html).toContain('Justin Jefferson');
    expect(html).toContain('/tiber-data-lab/player-research?season=2025&amp;playerId=00-0036322&amp;playerName=Justin+Jefferson');
    expect(html).toContain('No promoted breakout outputs are available for this team in the selected season.');
  });

  it('renders loading, empty, and error states without breaking the workspace shell', () => {
    const loadingHtml = renderToStaticMarkup(
      React.createElement(TeamResearchWorkspaceView, {
        season: '2025',
        availableSeasons: [2025],
        data: null,
        isLoading: true,
        errorMessage: null,
        onSeasonChange: jest.fn(),
      }),
    );
    expect(loadingHtml).toContain('Loading Team Research Workspace');

    const emptyHtml = renderToStaticMarkup(
      React.createElement(TeamResearchWorkspaceView, {
        season: '2025',
        availableSeasons: [2025],
        data: { ...data, state: 'empty', selectedTeam: null, requestedTeam: 'UNK' },
        isLoading: false,
        errorMessage: null,
        onSeasonChange: jest.fn(),
      }),
    );
    expect(emptyHtml).toContain('No promoted team match was found');

    const errorHtml = renderToStaticMarkup(
      React.createElement(TeamResearchWorkspaceView, {
        season: '2025',
        availableSeasons: [2025],
        data: null,
        isLoading: false,
        errorMessage: 'Workspace unavailable',
        onSeasonChange: jest.fn(),
      }),
    );
    expect(errorHtml).toContain('Team Research Workspace unavailable');
  });

  it('keeps query-param and team-search helpers stable', () => {
    expect(buildTeamResearchHref({ season: '2025', team: 'MIN' })).toBe('/tiber-data-lab/team-research?season=2025&team=MIN');
    expect(readTeamResearchQuery('?season=2024&team=SEA', '2025')).toEqual({ season: '2024', team: 'SEA' });
    expect(filterTeamResearchSearchIndex(data.searchIndex, 'seattle').map((entry) => entry.team)).toEqual(['SEA']);
    expect(findTeamSearchEntry(data.searchIndex, 'Minnesota Vikings')?.team).toBe('MIN');
    expect(getTeamResearchStateLabel('partial')).toBe('Partial promoted coverage');
  });
});
