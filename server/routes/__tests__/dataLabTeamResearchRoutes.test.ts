import express from 'express';
import { AddressInfo } from 'net';
import { createDataLabTeamResearchRouter } from '../dataLabTeamResearchRoutes';

function buildService(overrides: Partial<any> = {}) {
  return {
    getTeamResearchWorkspace: jest.fn().mockResolvedValue({
      season: 2025,
      availableSeasons: [2025, 2024],
      state: 'partial',
      requestedTeam: 'MIN',
      selectedTeam: {
        team: 'MIN',
        teamName: 'Minnesota Vikings',
        conference: 'NFC',
        division: 'North',
        matchStrategy: 'team_code',
      },
      searchIndex: [],
      framing: {
        title: 'Team Research Workspace',
        description: 'Fixture',
        provenanceNote: 'Fixture provenance',
      },
      warnings: [],
      header: {
        team: 'MIN',
        teamName: 'Minnesota Vikings',
        conference: 'NFC',
        division: 'North',
      },
      keyPlayers: [],
      sections: {
        offensiveContext: { state: 'ready', title: 'Offensive context summary', description: 'Fixture', linkHref: '/tiber-data-lab/role-opportunity?team=MIN&season=2025', summary: { promotedPlayerCount: 3 }, message: 'Ready', readOnly: true, provenanceNote: 'Fixture', error: null },
        roleOpportunity: { state: 'ready', title: 'Role & Opportunity summary by key players', description: 'Fixture', linkHref: '/tiber-data-lab/role-opportunity?team=MIN&season=2025', summary: { playerCount: 3 }, message: 'Ready', readOnly: true, provenanceNote: 'Fixture', error: null },
        breakoutSignals: { state: 'not_available', title: 'Breakout-relevant roster signals', description: 'Fixture', linkHref: '/tiber-data-lab/breakout-signals?team=MIN&season=2025', summary: null, message: 'Not available', readOnly: true, provenanceNote: 'Fixture', error: null },
        pointScenarios: { state: 'ready', title: 'Scenario context summary', description: 'Fixture', linkHref: '/tiber-data-lab/point-scenarios?team=MIN&season=2025', summary: { playerCount: 2 }, message: 'Ready', readOnly: true, provenanceNote: 'Fixture', error: null },
        ageCurves: { state: 'ready', title: 'ARC / development snapshot', description: 'Fixture', linkHref: '/tiber-data-lab/age-curves?team=MIN&season=2025', summary: { playerCount: 2 }, message: 'Ready', readOnly: true, provenanceNote: 'Fixture', error: null },
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

describe('data lab team research routes', () => {
  it('returns the read-only team research workspace payload', async () => {
    const service = buildService();
    const app = express();
    app.use('/api/data-lab', createDataLabTeamResearchRouter(service as any));

    const res = await call(app, '/api/data-lab/team-research?season=2025&team=MIN');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.state).toBe('partial');
    expect(res.body.data.selectedTeam.team).toBe('MIN');
    expect(service.getTeamResearchWorkspace).toHaveBeenCalledWith({ season: 2025, team: 'MIN' });
  });

  it('returns a validation error for malformed query params', async () => {
    const service = buildService();
    const app = express();
    app.use('/api/data-lab', createDataLabTeamResearchRouter(service as any));

    const res = await call(app, '/api/data-lab/team-research?season=bad');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toContain('season');
  });
});
