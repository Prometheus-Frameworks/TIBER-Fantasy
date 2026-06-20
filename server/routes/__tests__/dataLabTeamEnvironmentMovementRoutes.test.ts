import express from 'express';
import { AddressInfo } from 'net';
import { createDataLabTeamEnvironmentMovementRouter } from '../dataLabTeamEnvironmentMovementRoutes';

function buildResult(overrides: Partial<any> = {}) {
  return {
    artifact: 'team_environment_movement_v0',
    artifactAvailable: true,
    state: 'ready',
    generatedAt: '2026-05-30T00:00:00.000Z',
    governance: {
      governanceStatus: 'governed',
      governanceSource: 'explicit_marker',
      contractVersion: 'team_environment_movement_v1',
      generatedAt: '2026-05-30T00:00:00.000Z',
      promotedAt: '2026-05-31T00:00:00.000Z',
      promotionNotes: null,
    },
    provenanceStatus: 'fixture_scaffold',
    inputSources: ['fixture.json'],
    coverage: { teams: ['TB'], seasons: [2025], weeks: [1, 2], latestWeek: 2, isFullLeague: false },
    teams: [{ team: 'TB', season: 2025, earlyWindow: {}, lateWindow: {}, deltas: {}, offenseDirection: 'declining', pressureDirection: 'worsening', passEnvironmentDirection: 'more_pass_heavy', verdict: 'offensive_environment_declining_pressure_worsening', warnings: [], raw: {} }],
    selectedTeam: null,
    warnings: ['fixture/synthetic Teamstate movement artifact; do not treat as governed production truth'],
    errors: [],
    source: { provider: 'tiber-teamstate', mode: 'artifact', artifactPath: '/tmp/team_environment_movement_v0.json', readOnly: true },
    ...overrides,
  };
}

function buildService(overrides: Partial<any> = {}) {
  return {
    getMovement: jest.fn().mockResolvedValue(buildResult()),
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

describe('data lab team environment movement routes', () => {
  it('returns the read-only movement inspection payload', async () => {
    const service = buildService();
    const app = express();
    app.use('/api/data-lab', createDataLabTeamEnvironmentMovementRouter(service as any));

    const res = await call(app, '/api/data-lab/team-environment-movement');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({
      ok: true,
      artifact: 'team_environment_movement_v0',
      artifactAvailable: true,
      provenanceStatus: 'fixture_scaffold',
    }));
    expect(res.body.coverage.latestWeek).toBe(2);
    expect(service.getMovement).toHaveBeenCalledWith();
  });

  it('returns selected team movement by abbreviation', async () => {
    const service = buildService({
      getMovement: jest.fn().mockResolvedValue(buildResult({
        teams: [],
        selectedTeam: { team: 'TB', offenseDirection: 'declining', pressureDirection: 'worsening', passEnvironmentDirection: 'more_pass_heavy', verdict: 'offensive_environment_declining_pressure_worsening', warnings: [], raw: {} },
      })),
    });
    const app = express();
    app.use('/api/data-lab', createDataLabTeamEnvironmentMovementRouter(service as any));

    const res = await call(app, '/api/data-lab/team-environment-movement/TB');

    expect(res.status).toBe(200);
    expect(res.body.selectedTeam).toEqual(expect.objectContaining({ team: 'TB', pressureDirection: 'worsening' }));
    expect(service.getMovement).toHaveBeenCalledWith('TB');
  });

  it('forwards the already-read generatedAt timestamp for honest freshness', async () => {
    const service = buildService();
    const app = express();
    app.use('/api/data-lab', createDataLabTeamEnvironmentMovementRouter(service as any));

    const res = await call(app, '/api/data-lab/team-environment-movement');

    expect(res.status).toBe(200);
    expect(res.body.generatedAt).toBe('2026-05-30T00:00:00.000Z');
  });

  it('forwards the producer governance block (PR #41) for the explicit promotion gate', async () => {
    const service = buildService();
    const app = express();
    app.use('/api/data-lab', createDataLabTeamEnvironmentMovementRouter(service as any));

    const res = await call(app, '/api/data-lab/team-environment-movement');

    expect(res.status).toBe(200);
    expect(res.body.governance).toEqual(expect.objectContaining({
      governanceStatus: 'governed',
      governanceSource: 'explicit_marker',
      contractVersion: 'team_environment_movement_v1',
      generatedAt: '2026-05-30T00:00:00.000Z',
    }));
  });

  it('forwards a null governance block when the artifact has none', async () => {
    const service = buildService({
      getMovement: jest.fn().mockResolvedValue(buildResult({ governance: null })),
    });
    const app = express();
    app.use('/api/data-lab', createDataLabTeamEnvironmentMovementRouter(service as any));

    const res = await call(app, '/api/data-lab/team-environment-movement');

    expect(res.status).toBe(200);
    expect(res.body.governance).toBeNull();
  });

  it('forwards a null generatedAt when the artifact has none (fail-closed freshness input)', async () => {
    const service = buildService({
      getMovement: jest.fn().mockResolvedValue(buildResult({ generatedAt: null })),
    });
    const app = express();
    app.use('/api/data-lab', createDataLabTeamEnvironmentMovementRouter(service as any));

    const res = await call(app, '/api/data-lab/team-environment-movement');

    expect(res.status).toBe(200);
    expect(res.body.generatedAt).toBeNull();
  });

  it('surfaces missing artifacts as explicit unavailable state', async () => {
    const service = buildService({
      getMovement: jest.fn().mockResolvedValue(buildResult({
        artifactAvailable: false,
        state: 'unavailable',
        provenanceStatus: null,
        coverage: null,
        teams: [],
        warnings: ['Team Environment Movement artifact is not available; no movement context was fabricated.'],
        errors: [{ code: 'TEAM_ENVIRONMENT_MOVEMENT_NOT_FOUND', message: 'Configured Team Environment Movement artifact was not found.' }],
      })),
    });
    const app = express();
    app.use('/api/data-lab', createDataLabTeamEnvironmentMovementRouter(service as any));

    const res = await call(app, '/api/data-lab/team-environment-movement');

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(false);
    expect(res.body.artifactAvailable).toBe(false);
    expect(res.body.errors[0].code).toBe('TEAM_ENVIRONMENT_MOVEMENT_NOT_FOUND');
  });
});
