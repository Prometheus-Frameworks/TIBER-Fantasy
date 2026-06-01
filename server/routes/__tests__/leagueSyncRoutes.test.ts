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
  getTradedPicks: jest.fn(),
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
    mockSleeperClient.getTradedPicks.mockResolvedValue([]);

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

  describe("GET /api/league-sync/picks", () => {
    beforeEach(() => {
      (mockStorage as any).getLeagueFuturePicks = jest.fn();
    });

    it("returns 400 when league_id is missing", async () => {
      const app = buildApp();
      const res = await call(app, 'GET', "/api/league-sync/picks?user_id=default_user");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/league_id/i);
    });

    it("returns 404 when league not found for user", async () => {
      mockStorage.getLeaguesWithTeams.mockResolvedValueOnce([]);
      const app = buildApp();
      const res = await call(app, 'GET', "/api/league-sync/picks?user_id=default_user&league_id=unknown");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("returns available=false and empty picks array when no picks exist", async () => {
      (mockStorage as any).getLeagueFuturePicks.mockResolvedValue([]);
      const app = buildApp();
      const res = await call(app, 'GET', "/api/league-sync/picks?user_id=default_user&league_id=l1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.available).toBe(false);
      expect(res.body.picks).toEqual([]);
      expect(res.body.leagueId).toBe("l1");
    });

    it("returns available=true and normalized picks when picks exist", async () => {
      (mockStorage as any).getLeagueFuturePicks.mockResolvedValue([
        { id: "p1", season: 2025, round: 1, original_roster_id: "r1", current_roster_id: "r2", source: "trade" },
        { id: "p2", season: 2025, round: 2, original_roster_id: "r3", current_roster_id: "r4", source: "original" },
      ]);
      const app = buildApp();
      const res = await call(app, 'GET', "/api/league-sync/picks?user_id=default_user&league_id=l1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.available).toBe(true);
      expect(res.body.picks).toHaveLength(2);
      expect(res.body.picks[0].season).toBe(2025);
      expect(res.body.picks[0].round).toBe(1);
      expect(res.body.picks[0].originalRosterId).toBe("r1");
      expect(res.body.picks[0].currentRosterId).toBe("r2");
      expect(res.body.picks[0].source).toBe("trade");
    });

    it("handles camelCase row properties from ORM", async () => {
      (mockStorage as any).getLeagueFuturePicks.mockResolvedValue([
        { id: "p3", season: 2026, round: 3, originalRosterId: "r5", currentRosterId: "r6", source: "original" },
      ]);
      const app = buildApp();
      const res = await call(app, 'GET', "/api/league-sync/picks?user_id=default_user&league_id=l1");

      expect(res.status).toBe(200);
      expect(res.body.picks[0].originalRosterId).toBe("r5");
      expect(res.body.picks[0].currentRosterId).toBe("r6");
    });

    it("filters picks to active team's external roster when team_id is provided", async () => {
      (mockStorage as any).getLeagueFuturePicks.mockResolvedValue([
        { id: "p10", season: 2025, round: 1, original_roster_id: "r1", current_roster_id: "1", source: "trade" },
        { id: "p11", season: 2025, round: 2, original_roster_id: "r2", current_roster_id: "2", source: "original" },
      ]);
      const app = buildApp();
      // Team "t1" has external_roster_id "1" (from the mock storage setup above)
      const res = await call(app, 'GET', "/api/league-sync/picks?user_id=default_user&league_id=l1&team_id=t1");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // Only picks where currentRosterId === team externalRosterId "1" should appear
      expect(res.body.picks.every((p: any) => p.currentRosterId === "1")).toBe(true);
      expect(res.body.teamRosterId).toBe("1");
    });

    it("returns all picks league-wide when no team_id is provided", async () => {
      (mockStorage as any).getLeagueFuturePicks.mockResolvedValue([
        { id: "p20", season: 2025, round: 1, original_roster_id: "r1", current_roster_id: "1", source: "trade" },
        { id: "p21", season: 2025, round: 2, original_roster_id: "r2", current_roster_id: "2", source: "original" },
      ]);
      const app = buildApp();
      const res = await call(app, 'GET', "/api/league-sync/picks?user_id=default_user&league_id=l1");

      expect(res.status).toBe(200);
      expect(res.body.picks).toHaveLength(2);
      expect(res.body.teamRosterId).toBeNull();
    });
  });
});
