import express from 'express';
import { AddressInfo } from 'net';
import { createLeagueDashboardRouter } from '../leagueDashboardRoutes';
import { computeLeagueDashboard } from '../../services/leagueDashboardService';

jest.mock('../../services/leagueDashboardService', () => ({
  computeLeagueDashboard: jest.fn(),
}));

describe('league dashboard routes', () => {
  function buildApp() {
    const app = express();
    app.use(createLeagueDashboardRouter());
    return app;
  }

  async function call(app: express.Express, path: string) {
    const server = app.listen(0);
    const { port } = server.address() as AddressInfo;

    const response = await fetch(`http://127.0.0.1:${port}${path}`);
    const json = await response.json();
    server.close();
    return { status: response.status, body: json };
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (computeLeagueDashboard as jest.Mock).mockResolvedValue({
      success: true,
      meta: { league_id: 'l1', week: null, season: 2024, computed_at: new Date().toISOString(), cached: false },
      teams: [
        {
          team_id: 't1',
          display_name: 'Team One',
          totals: { QB: 10, RB: 20, WR: 30, TE: 5 },
          overall_total: 65,
          starters_used: [],
          roster: [],
        },
      ],
    });
  });

  it('returns dashboard payload', async () => {
    const app = buildApp();
    const res = await call(app, '/api/league-dashboard?user_id=default_user&league_id=l1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.teams[0].overall_total).toBe(65);
  });

  it('forces refresh when query flag passed', async () => {
    const app = buildApp();
    await call(app, '/api/league-dashboard?user_id=default_user&league_id=l1&refresh=1');

    expect(computeLeagueDashboard).toHaveBeenCalledWith(
      expect.objectContaining({ refresh: true, leagueId: 'l1', userId: 'default_user' })
    );
  });
});
