import express from 'express';
import { AddressInfo } from 'net';
import { createDataLabAgeCurvesRouter } from '../dataLabAgeCurvesRoutes';
import { AgeCurveIntegrationError } from '../../modules/externalModels/ageCurves/types';

function buildService(overrides: Partial<any> = {}) {
  return {
    getStatus: jest.fn().mockReturnValue({
      readiness: 'ready',
      configured: true,
      enabled: true,
      baseUrl: 'http://arc-model.test',
      labEndpointPath: '/api/age-curves/lab',
      exportsPath: '/exports/age_curve_lab.json',
    }),
    getAgeCurveLab: jest.fn().mockResolvedValue({
      season: 2025,
      availableSeasons: [2025, 2024],
      rows: [
        {
          playerId: '00-0036322',
          playerName: 'Justin Jefferson',
          team: 'MIN',
          position: 'WR',
          season: 2025,
          age: 26.4,
          careerYear: 6,
          peerBucket: 'WR-year6-age26',
          expectedPpg: 17.8,
          actualPpg: 19.6,
          ppgDelta: 1.8,
          trajectoryLabel: 'ahead_of_curve',
          ageCurveScore: 91.2,
          provenance: {
            provider: 'arc-model',
            sourceName: 'arc-export',
            sourceType: 'artifact',
            modelVersion: 'arc-v1',
            generatedAt: '2026-03-23T00:00:00.000Z',
            notes: ['promoted export'],
          },
          rawFields: { player_name: 'Justin Jefferson' },
        },
      ],
      source: {
        provider: 'arc-model',
        location: '/exports/age_curve_lab.json',
        mode: 'artifact',
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

describe('data lab age curves routes', () => {
  it('returns a ready payload with normalized age-curve rows', async () => {
    const service = buildService();
    const app = express();
    app.use('/api/data-lab', createDataLabAgeCurvesRouter(service as any));

    const res = await call(app, '/api/data-lab/age-curves?season=2025');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.state).toBe('ready');
    expect(res.body.data.rows[0]).toEqual(
      expect.objectContaining({
        playerName: 'Justin Jefferson',
        trajectoryLabel: 'ahead_of_curve',
      }),
    );
    expect(service.getAgeCurveLab).toHaveBeenCalledWith({ season: 2025 }, { includeRawCanonical: false });
  });

  it('returns an empty state when the upstream payload is valid but empty', async () => {
    const service = buildService({
      getAgeCurveLab: jest.fn().mockResolvedValue({
        season: 2025,
        availableSeasons: [2025],
        rows: [],
        source: {
          provider: 'arc-model',
          location: '/exports/age_curve_lab.json',
          mode: 'artifact',
        },
      }),
    });
    const app = express();
    app.use('/api/data-lab', createDataLabAgeCurvesRouter(service as any));

    const res = await call(app, '/api/data-lab/age-curves?season=2025');

    expect(res.status).toBe(200);
    expect(res.body.data.state).toBe('empty');
    expect(res.body.data.rows).toEqual([]);
  });

  it('surfaces malformed upstream payload failures with a stable code', async () => {
    const service = buildService({
      getAgeCurveLab: jest.fn().mockRejectedValue(new AgeCurveIntegrationError('invalid_payload', 'malformed payload', 502)),
    });
    const app = express();
    app.use('/api/data-lab', createDataLabAgeCurvesRouter(service as any));

    const res = await call(app, '/api/data-lab/age-curves?season=2025');

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('invalid_payload');
    expect(res.body.operator).toEqual(
      expect.objectContaining({
        state: 'contract_error',
      }),
    );
  });
});
