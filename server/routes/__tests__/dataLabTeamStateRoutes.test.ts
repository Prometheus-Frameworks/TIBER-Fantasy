import express from 'express';
import { AddressInfo } from 'net';
import { createDataLabTeamStateRouter } from '../dataLabTeamStateRoutes';
import { TeamStateIntegrationError } from '../../modules/externalModels/teamState/types';

function buildService(overrides: Partial<any> = {}) {
  return {
    getTeamState: jest.fn().mockResolvedValue({
      season: 2025,
      throughWeek: 17,
      data: {
        generatedAt: '2026-04-02T00:00:00.000Z',
        artifact: 'tiber_team_state_v0_1',
        source: {
          provider: 'tiber-data',
          season: 2025,
          throughWeek: 17,
          seasonType: 'REG',
          gamesIncluded: 17,
          notes: ['promoted artifact'],
        },
        definitions: {
          sampleFlag: ['small', 'stable'],
        },
        teams: [
          {
            team: 'BUF',
            sample: {
              games: 17,
              plays: 1034,
              neutralPlays: 734,
              earlyDownPlays: 580,
              redZonePlays: 71,
              drives: 191,
            },
            features: {
              neutralPassRate: 0.58,
              earlyDownPassRate: 0.55,
              earlyDownSuccessRate: 0.48,
              redZonePassRate: 0.51,
              redZoneTdEfficiency: 0.67,
              explosivePlayRate: 0.11,
              driveSustainRate: 0.73,
              paceSecondsPerPlay: 28.4,
            },
            stability: {
              sampleFlag: 'stable',
              confidenceBand: 'high',
              notes: ['full sample'],
            },
          },
        ],
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

describe('data lab team state routes', () => {
  it('returns read-only team state artifact payload for a season', async () => {
    const service = buildService();
    const app = express();
    app.use('/api/data-lab', createDataLabTeamStateRouter(service as any));

    const res = await call(app, '/api/data-lab/team-state?season=2025');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        ok: true,
        artifact: 'tiber_team_state_v0_1',
        season: 2025,
        source: 'tiber-data',
      }),
    );
    expect(service.getTeamState).toHaveBeenCalledWith(2025, undefined);
  });

  it('returns stable not-found error when artifact is missing', async () => {
    const service = buildService({
      getTeamState: jest.fn().mockRejectedValue(new TeamStateIntegrationError('not_found', 'missing', 404)),
    });
    const app = express();
    app.use('/api/data-lab', createDataLabTeamStateRouter(service as any));

    const res = await call(app, '/api/data-lab/team-state?season=2025&throughWeek=17');

    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('TEAM_STATE_NOT_FOUND');
    expect(res.body.throughWeek).toBe(17);
  });

  it('returns stable invalid-payload error for parseable but contract-invalid artifacts', async () => {
    const service = buildService({
      getTeamState: jest
        .fn()
        .mockRejectedValue(new TeamStateIntegrationError('invalid_payload', 'contract mismatch', 502)),
    });
    const app = express();
    app.use('/api/data-lab', createDataLabTeamStateRouter(service as any));

    const res = await call(app, '/api/data-lab/team-state?season=2025');

    expect(res.status).toBe(502);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('TEAM_STATE_INVALID_PAYLOAD');
  });

  it('validates required season query param', async () => {
    const service = buildService();
    const app = express();
    app.use('/api/data-lab', createDataLabTeamStateRouter(service as any));

    const res = await call(app, '/api/data-lab/team-state');

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error.code).toBe('TEAM_STATE_INVALID_REQUEST');
  });
});
