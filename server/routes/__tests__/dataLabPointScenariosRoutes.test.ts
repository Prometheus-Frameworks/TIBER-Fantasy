import express from 'express';
import { AddressInfo } from 'net';
import { createDataLabPointScenariosRouter } from '../dataLabPointScenariosRoutes';
import { PointScenarioIntegrationError } from '../../modules/externalModels/pointScenarios/types';

function buildService(overrides: Partial<any> = {}) {
  return {
    getPointScenarioLab: jest.fn().mockResolvedValue({
      season: 2025,
      availableSeasons: [2025, 2024],
      rows: [
        {
          scenarioId: 'injury-bump',
          scenarioName: 'Target spike if WR2 sits',
          playerId: '00-0036322',
          playerName: 'Justin Jefferson',
          team: 'MIN',
          position: 'WR',
          season: 2025,
          week: 17,
          baselineProjection: 18.4,
          adjustedProjection: 21.1,
          delta: 2.7,
          confidence: {
            band: 'mid',
            label: 'actionable',
          },
          scenarioType: 'usage_shock',
          eventType: 'injury',
          notes: ['Promoted export'],
          explanation: 'Target share climbs if the secondary perimeter role vacates.',
          provenance: {
            provider: 'point-prediction-model',
            sourceName: 'scenario-export',
            sourceType: 'artifact',
            modelVersion: 'ppm-v1',
            generatedAt: '2026-03-23T00:00:00.000Z',
            sourceMetadata: { run_id: 'run-17' },
          },
          rawFields: { scenario_name: 'Target spike if WR2 sits' },
        },
      ],
      source: {
        provider: 'point-prediction-model',
        location: '/exports/point_scenario_lab.json',
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

describe('data lab point scenarios routes', () => {
  it('returns a ready payload with normalized point-scenario rows', async () => {
    const service = buildService();
    const app = express();
    app.use('/api/data-lab', createDataLabPointScenariosRouter(service as any));

    const res = await call(app, '/api/data-lab/point-scenarios?season=2025');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.state).toBe('ready');
    expect(res.body.data.rows[0]).toEqual(
      expect.objectContaining({
        playerName: 'Justin Jefferson',
        scenarioName: 'Target spike if WR2 sits',
      }),
    );
    expect(service.getPointScenarioLab).toHaveBeenCalledWith({ season: 2025 }, { includeRawCanonical: false });
  });

  it('returns an empty state when the upstream payload is valid but empty', async () => {
    const service = buildService({
      getPointScenarioLab: jest.fn().mockResolvedValue({
        season: 2025,
        availableSeasons: [2025],
        rows: [],
        source: {
          provider: 'point-prediction-model',
          location: '/exports/point_scenario_lab.json',
          mode: 'artifact',
        },
      }),
    });
    const app = express();
    app.use('/api/data-lab', createDataLabPointScenariosRouter(service as any));

    const res = await call(app, '/api/data-lab/point-scenarios?season=2025');

    expect(res.status).toBe(200);
    expect(res.body.data.state).toBe('empty');
    expect(res.body.data.rows).toEqual([]);
  });

  it('surfaces malformed upstream payload failures with a stable code', async () => {
    const service = buildService({
      getPointScenarioLab: jest.fn().mockRejectedValue(new PointScenarioIntegrationError('invalid_payload', 'malformed payload', 502)),
    });
    const app = express();
    app.use('/api/data-lab', createDataLabPointScenariosRouter(service as any));

    const res = await call(app, '/api/data-lab/point-scenarios?season=2025');

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('invalid_payload');
  });
});
