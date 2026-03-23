import express from 'express';
import { AddressInfo } from 'net';
import { createDataLabPlayerResearchRouter } from '../dataLabPlayerResearchRoutes';

function buildService(overrides: Partial<any> = {}) {
  return {
    getPlayerResearchWorkspace: jest.fn().mockResolvedValue({
      season: 2025,
      availableSeasons: [2025, 2024],
      state: 'partial',
      requestedPlayerId: '00-0036322',
      requestedPlayerName: 'Justin Jefferson',
      selectedPlayer: {
        playerId: '00-0036322',
        playerName: 'Justin Jefferson',
        team: 'MIN',
        position: 'WR',
        matchStrategy: 'player_id',
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
            ageCurves: false,
            pointScenarios: true,
          },
        },
      ],
      framing: {
        title: 'Player Research Workspace',
        description: 'Fixture',
        provenanceNote: 'Fixture provenance',
      },
      warnings: [],
      sections: {
        breakoutSignals: {
          state: 'ready',
          title: 'Breakout Signals summary',
          description: 'Fixture',
          linkHref: '/tiber-data-lab/breakout-signals?playerId=00-0036322&season=2025',
          summary: { candidateRank: 4 },
          message: 'Ready',
          readOnly: true,
          provenanceNote: 'Fixture',
          error: null,
        },
        roleOpportunity: {
          state: 'ready',
          title: 'Role & Opportunity summary',
          description: 'Fixture',
          linkHref: '/tiber-data-lab/role-opportunity?playerId=00-0036322&season=2025',
          summary: { primaryRole: 'alpha_x' },
          message: 'Ready',
          readOnly: true,
          provenanceNote: 'Fixture',
          error: null,
        },
        ageCurves: {
          state: 'not_available',
          title: 'Age Curve / ARC summary',
          description: 'Fixture',
          linkHref: '/tiber-data-lab/age-curves?playerId=00-0036322&season=2025',
          summary: null,
          message: 'Not available',
          readOnly: true,
          provenanceNote: 'Fixture',
          error: null,
        },
        pointScenarios: {
          state: 'ready',
          title: 'Point Scenario summary',
          description: 'Fixture',
          linkHref: '/tiber-data-lab/point-scenarios?playerId=00-0036322&season=2025',
          summary: { scenarioCount: 2 },
          message: 'Ready',
          readOnly: true,
          provenanceNote: 'Fixture',
          error: null,
        },
      },
    }),
    ...overrides,
  };
}

async function call(app: express.Express, path: string) {
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;

  try {
    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    return {
      status: response.status,
      body: await response.json(),
    };
  } finally {
    server.close();
  }
}

describe('data lab player research routes', () => {
  it('returns the read-only player research workspace payload', async () => {
    const service = buildService();
    const app = express();
    app.use('/api/data-lab', createDataLabPlayerResearchRouter(service as any));

    const res = await call(app, '/api/data-lab/player-research?season=2025&playerId=00-0036322&playerName=Justin%20Jefferson');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.state).toBe('partial');
    expect(res.body.data.sections.ageCurves.state).toBe('not_available');
    expect(service.getPlayerResearchWorkspace).toHaveBeenCalledWith({
      season: 2025,
      playerId: '00-0036322',
      playerName: 'Justin Jefferson',
    });
  });

  it('returns a validation error for malformed query params', async () => {
    const service = buildService();
    const app = express();
    app.use('/api/data-lab', createDataLabPlayerResearchRouter(service as any));

    const res = await call(app, '/api/data-lab/player-research?season=bad');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('season');
  });
});
