import express from 'express';
import { AddressInfo } from 'net';
import { createDataLabPromotedStatusRouter } from '../dataLabPromotedStatusRoutes';

function buildService(overrides: Partial<any> = {}) {
  return {
    getStatusReport: jest.fn().mockResolvedValue({
      season: 2025,
      statuses: [
        {
          moduleId: 'command-center',
          title: 'Data Lab Command Center',
          route: '/tiber-data-lab/command-center',
          status: 'ready',
          detail: 'Fixture',
          readOnly: true,
          checks: ['Fixture check'],
        },
      ],
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

describe('data lab promoted status routes', () => {
  it('returns promoted module operational statuses', async () => {
    const service = buildService();
    const app = express();
    app.use('/api/data-lab', createDataLabPromotedStatusRouter(service as any));

    const res = await call(app, '/api/data-lab/promoted-status?season=2025');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.statuses[0].moduleId).toBe('command-center');
    expect(service.getStatusReport).toHaveBeenCalledWith({ season: 2025 });
  });

  it('returns validation errors for malformed query params', async () => {
    const service = buildService();
    const app = express();
    app.use('/api/data-lab', createDataLabPromotedStatusRouter(service as any));

    const res = await call(app, '/api/data-lab/promoted-status?season=bad');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('season');
  });
});
