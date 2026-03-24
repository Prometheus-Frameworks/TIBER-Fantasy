import express from 'express';
import { AddressInfo } from 'net';
import { createDataLabCommandCenterRouter } from '../dataLabCommandCenterRoutes';

function buildService(overrides: Partial<any> = {}) {
  return {
    getCommandCenter: jest.fn().mockResolvedValue({
      season: 2025,
      availableSeasons: [2025, 2024],
      state: 'partial',
      framing: { title: 'Data Lab Command Center', description: 'Fixture', posture: 'Fixture posture' },
      moduleStatuses: [
        { moduleId: 'breakout-signals', title: 'WR Breakout Lab', href: '/tiber-data-lab/breakout-signals', state: 'ready', detail: 'Ready' },
      ],
      priorities: [],
      warnings: [],
      sections: {
        breakoutCandidates: { state: 'ready', title: 'Top breakout candidates', description: 'Fixture', moduleTitle: 'WR Breakout Lab', linkHref: '/tiber-data-lab/breakout-signals', message: 'Ready', items: [] },
        roleOpportunity: { state: 'unavailable', title: 'Notable role / opportunity movers', description: 'Fixture', moduleTitle: 'Role & Opportunity Lab', linkHref: '/tiber-data-lab/role-opportunity', message: 'Unavailable', items: [] },
        ageCurves: { state: 'empty', title: 'Age-curve overperformers / underperformers', description: 'Fixture', moduleTitle: 'Age Curve / ARC Lab', linkHref: '/tiber-data-lab/age-curves', message: 'Empty', items: [] },
        pointScenarios: { state: 'ready', title: 'Biggest point-scenario movers', description: 'Fixture', moduleTitle: 'Point Scenario Lab', linkHref: '/tiber-data-lab/point-scenarios', message: 'Ready', items: [] },
        teamEnvironments: { state: 'ready', title: 'Team environments worth investigating', description: 'Fixture', moduleTitle: 'Team Research Workspace', linkHref: '/tiber-data-lab/team-research', message: 'Ready', items: [] },
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
    return { status: response.status, body: await response.json() };
  } finally {
    server.close();
  }
}

describe('data lab command center routes', () => {
  it('returns the read-only command center payload', async () => {
    const service = buildService();
    const app = express();
    app.use('/api/data-lab', createDataLabCommandCenterRouter(service as any));

    const res = await call(app, '/api/data-lab/command-center?season=2025');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.state).toBe('partial');
    expect(service.getCommandCenter).toHaveBeenCalledWith({ season: 2025 });
  });

  it('does not force a season when no season query param is provided', async () => {
    const service = buildService();
    const app = express();
    app.use('/api/data-lab', createDataLabCommandCenterRouter(service as any));

    const res = await call(app, '/api/data-lab/command-center');

    expect(res.status).toBe(200);
    expect(service.getCommandCenter).toHaveBeenCalledWith({ season: undefined });
  });

  it('returns a validation error for malformed query params', async () => {
    const service = buildService();
    const app = express();
    app.use('/api/data-lab', createDataLabCommandCenterRouter(service as any));

    const res = await call(app, '/api/data-lab/command-center?season=bad');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('season');
  });
});
