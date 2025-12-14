jest.mock('../../storage', () => ({ storage: {} }));
jest.mock('../../integrations/sleeperClient', () => ({
  sleeperClient: {},
  deriveSleeperScoringFormat: () => 'ppr',
}));

import express from "express";
import { AddressInfo } from "net";
import { createLeagueSyncRouter } from "../leagueSyncRoutes";

const mockStorage = {
  upsertLeagueWithTeams: jest.fn(),
  getLeaguesWithTeams: jest.fn(),
  getUserLeagueContext: jest.fn(),
  setUserLeagueContext: jest.fn(),
  getUserPlatformProfile: jest.fn(),
  getLeagueWithTeams: jest.fn(),
};

const mockSleeperClient = {
  getLeague: jest.fn(),
  getLeagueUsers: jest.fn(),
  getLeagueRosters: jest.fn(),
};

const mockScoringFormat = jest.fn();

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(
    createLeagueSyncRouter({
      storage: mockStorage as any,
      sleeperClient: mockSleeperClient as any,
      deriveSleeperScoringFormat: mockScoringFormat as any,
    })
  );
  return app;
}

async function call(app: express.Express, method: string, path: string, body?: any) {
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;

  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await response.json();
  server.close();
  return { status: response.status, body: json };
}

describe("league sync routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockStorage.getUserPlatformProfile.mockResolvedValue({ externalUserId: 'u1', platform: 'sleeper' });
    mockStorage.getLeagueWithTeams.mockResolvedValue(null);

    mockSleeperClient.getLeague.mockResolvedValue({
      league_id: "123",
      name: "Test League",
      season: "2024",
      scoring_settings: { rec: 1 },
      status: "pre_draft",
      total_rosters: 10,
    });

    mockSleeperClient.getLeagueUsers.mockResolvedValue([
      { user_id: "u1", display_name: "Owner 1", team_name: "Team One", metadata: {} },
    ]);

    mockSleeperClient.getLeagueRosters.mockResolvedValue([
      { roster_id: 1, owner_id: "u1" },
    ]);

    mockScoringFormat.mockReturnValue("ppr");

    mockStorage.upsertLeagueWithTeams.mockResolvedValue({
      league: { id: "l1", league_name: "Test League", scoring_format: "ppr", season: 2024 },
      teams: [
        {
          id: "t1",
          leagueId: "l1",
          display_name: "Team One",
          external_roster_id: "1",
        },
      ],
    });

    mockStorage.getLeaguesWithTeams.mockResolvedValue([
      {
        id: "l1",
        league_name: "Test League",
        scoring_format: "ppr",
        season: 2024,
        teams: [
          { id: "t1", leagueId: "l1", display_name: "Team One", external_roster_id: "1" },
        ],
      },
    ]);

    mockStorage.getUserLeagueContext.mockResolvedValue({
      preference: { user_id: "default_user", activeLeagueId: "l1", activeTeamId: "t1" },
      activeLeague: { id: "l1", league_name: "Test League", scoring_format: "ppr", season: 2024 },
      activeTeam: { id: "t1", leagueId: "l1", display_name: "Team One", external_roster_id: "1" },
    });

    mockStorage.setUserLeagueContext.mockResolvedValue({
      userId: "default_user",
      activeLeagueId: "l1",
      activeTeamId: "t1",
    });
  });

  it("syncs a Sleeper league and returns normalized teams", async () => {
    const app = buildApp();
    const res = await call(app, 'POST', "/api/league-sync/sync", { league_id_external: "123" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockSleeperClient.getLeague).toHaveBeenCalledWith("123");
    expect(mockStorage.upsertLeagueWithTeams).toHaveBeenCalledWith(
      expect.objectContaining({
        externalLeagueId: "123",
        scoringFormat: "ppr",
      })
    );
    expect(res.body.teams).toHaveLength(1);
    expect(res.body.teams[0].display_name || res.body.teams[0].displayName).toBe("Team One");
  });

  it("lists leagues with embedded teams", async () => {
    const app = buildApp();
    const res = await call(app, 'GET', "/api/league-sync/leagues?user_id=default_user");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.leagues[0].teams).toHaveLength(1);
  });

  it("returns current league context", async () => {
    const app = buildApp();
    const res = await call(app, 'GET', "/api/league-context?user_id=default_user");

    expect(res.status).toBe(200);
    expect(res.body.activeLeague.league_name).toBe("Test League");
    expect(res.body.activeTeam.id).toBe("t1");
  });

  it("updates league context", async () => {
    const app = buildApp();
    const res = await call(app, 'POST', "/api/league-context", { user_id: "default_user", league_id: "l1", team_id: "t1" });

    expect(res.status).toBe(200);
    expect(mockStorage.setUserLeagueContext).toHaveBeenCalledWith({ userId: "default_user", leagueId: "l1", teamId: "t1" });
    expect(res.body.preference.activeLeagueId || res.body.preference.active_league_id).toBe("l1");
  });
});
