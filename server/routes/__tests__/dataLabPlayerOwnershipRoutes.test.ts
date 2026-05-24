import express from 'express';
import { AddressInfo } from 'net';
import { createDataLabPlayerOwnershipRouter } from '../dataLabPlayerOwnershipRoutes';

function buildService(overrides: Partial<any> = {}) {
  return {
    getPlayerOwnershipInsight: jest.fn().mockResolvedValue({
      available: true,
      matched: true,
      matchType: 'player_id',
      playerId: 'wr-tee-higgins',
      playerName: 'Tee Higgins',
      position: 'WR',
      footballLevel: 'NFL',
      currentTeamId: 'nfl-cin',
      currentTeamAbbr: 'CIN',
      currentTeamName: 'Cincinnati Bengals',
      ownershipStatus: 'active_roster',
      validFrom: '2025-03-01T00:00:00.000Z',
      validTo: null,
      lastVerifiedAt: '2026-05-23T13:00:00.000Z',
      confidence: 'provisional',
      sourceRefs: [],
      recentEvents: [],
      warnings: [],
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

describe('data lab player ownership routes', () => {
  it('returns a read-only ownership lookup by player ID', async () => {
    const service = buildService();
    const app = express();
    app.use('/api/data-lab', createDataLabPlayerOwnershipRouter(service as any));

    const res = await call(app, '/api/data-lab/player-ownership?playerId=wr-tee-higgins&eventLimit=3');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(
      expect.objectContaining({
        available: true,
        matched: true,
        playerId: 'wr-tee-higgins',
      }),
    );
    expect(res.body.meta).toEqual(
      expect.objectContaining({
        module: 'player-ownership',
        adapter: 'player-ownership-artifact-v0',
        readOnly: true,
      }),
    );
    expect(service.getPlayerOwnershipInsight).toHaveBeenCalledWith({
      playerId: 'wr-tee-higgins',
      query: undefined,
      includeEvents: undefined,
      eventLimit: 3,
    });
  });

  it('validates that playerId or query is provided', async () => {
    const service = buildService();
    const app = express();
    app.use('/api/data-lab', createDataLabPlayerOwnershipRouter(service as any));

    const res = await call(app, '/api/data-lab/player-ownership');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('Provide either playerId or query');
    expect(service.getPlayerOwnershipInsight).not.toHaveBeenCalled();
  });
});
