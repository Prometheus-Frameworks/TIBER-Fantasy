import express from 'express';
import { AddressInfo } from 'net';
import { createDataLabBreakoutSignalsRouter } from '../dataLabBreakoutSignalsRoutes';
import { SignalValidationIntegrationError } from '../../modules/externalModels/signalValidation/types';

function buildService(overrides: Partial<any> = {}) {
  return {
    getStatus: jest.fn().mockReturnValue({
      readiness: 'ready',
      configured: true,
      enabled: true,
      exportsDir: '/tmp/signal-validation',
    }),
    getWrBreakoutLab: jest.fn().mockResolvedValue({
      season: 2025,
      availableSeasons: [2025, 2024],
      rows: [
        {
          candidateRank: 1,
          finalSignalScore: 92.4,
          playerName: 'Malik Nabers',
          playerId: '00-0042051',
          team: 'NYG',
          season: 2025,
          bestRecipeName: 'Second-Year Surge',
          breakoutLabelDefault: 'Priority breakout',
          breakoutContext: 'Elite rookie route command with more downfield volume expected',
          components: {
            usage: 96,
            efficiency: 91,
            development: 89,
            stability: 82,
            cohort: 85,
            role: 88,
            penalty: -3,
          },
          rawFields: {
            candidate_rank: '1',
            player_name: 'Malik Nabers',
          },
        },
      ],
      bestRecipeSummary: {
        bestRecipeName: 'Second-Year Surge',
        season: 2025,
        validationScore: 0.78,
        winRate: 0.64,
        hitRate: 0.58,
        candidateCount: 12,
        summary: 'Targets ascending second-year WRs.',
        generatedAt: '2026-03-23T00:00:00.000Z',
        modelVersion: 'svm-2026.03.1',
      },
      source: {
        provider: 'signal-validation-model',
        exportDirectory: '/tmp/signal-validation',
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

describe('data lab breakout signals routes', () => {
  it('returns a ready payload with fixture-backed data', async () => {
    const service = buildService();
    const app = express();
    app.use('/api/data-lab', createDataLabBreakoutSignalsRouter(service as any));

    const res = await call(app, '/api/data-lab/breakout-signals?season=2025');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.state).toBe('ready');
    expect(res.body.data.rows[0].playerName).toBe('Malik Nabers');
    expect(res.body.data.bestRecipeSummary.bestRecipeName).toBe('Second-Year Surge');
  });

  it('returns an empty state when the export is valid but has no rows', async () => {
    const service = buildService({
      getWrBreakoutLab: jest.fn().mockResolvedValue({
        season: 2025,
        availableSeasons: [2025],
        rows: [],
        bestRecipeSummary: {
          bestRecipeName: 'Second-Year Surge',
          season: 2025,
          validationScore: 0.78,
          winRate: 0.64,
          hitRate: 0.58,
          candidateCount: 0,
          summary: 'No candidates cleared the export filter.',
          generatedAt: '2026-03-23T00:00:00.000Z',
          modelVersion: 'svm-2026.03.1',
        },
        source: {
          provider: 'signal-validation-model',
          exportDirectory: '/tmp/signal-validation',
        },
      }),
    });
    const app = express();
    app.use('/api/data-lab', createDataLabBreakoutSignalsRouter(service as any));

    const res = await call(app, '/api/data-lab/breakout-signals?season=2025');

    expect(res.status).toBe(200);
    expect(res.body.data.state).toBe('empty');
    expect(res.body.data.rows).toEqual([]);
  });

  it('surfaces no-export-found failures with a stable code', async () => {
    const service = buildService({
      getWrBreakoutLab: jest.fn().mockRejectedValue(
        new SignalValidationIntegrationError(
          'not_found',
          'No Signal Validation WR player signal card exports were found.',
          404,
        ),
      ),
    });
    const app = express();
    app.use('/api/data-lab', createDataLabBreakoutSignalsRouter(service as any));

    const res = await call(app, '/api/data-lab/breakout-signals');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('not_found');
    expect(res.body.operator).toEqual(
      expect.objectContaining({
        state: 'no_data',
      }),
    );
  });

  it('surfaces config issues as operator-visible misconfiguration details', async () => {
    const service = buildService({
      getStatus: jest.fn().mockReturnValue({
        readiness: 'not_ready',
        configured: false,
        enabled: true,
        exportsDir: '/tmp/missing-signal-validation',
      }),
      getWrBreakoutLab: jest.fn().mockRejectedValue(
        new SignalValidationIntegrationError('config_error', 'Signal Validation exports are disabled by configuration.', 503),
      ),
    });
    const app = express();
    app.use('/api/data-lab', createDataLabBreakoutSignalsRouter(service as any));

    const res = await call(app, '/api/data-lab/breakout-signals');

    expect(res.status).toBe(503);
    expect(res.body.operator).toEqual(
      expect.objectContaining({
        state: 'misconfigured',
        configuredSource: '/tmp/missing-signal-validation',
      }),
    );
  });
});
