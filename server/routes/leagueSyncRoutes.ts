import express from "express";
import { deriveSleeperScoringFormat, sleeperClient } from "../integrations/sleeperClient";
import { storage } from "../storage";

type LeagueSyncDeps = {
  storage: typeof storage;
  sleeperClient: typeof sleeperClient;
  deriveSleeperScoringFormat: typeof deriveSleeperScoringFormat;
};

const defaultDeps: LeagueSyncDeps = {
  storage,
  sleeperClient,
  deriveSleeperScoringFormat,
};

export function createLeagueSyncRouter(deps: LeagueSyncDeps = defaultDeps) {
  const router = express.Router();

  router.post('/api/league-sync/sleeper', async (req, res) => {
    try {
      const { user_id = 'default_user', sleeper_league_id } = req.body;

      if (!sleeper_league_id) {
        return res.status(400).json({ success: false, error: 'sleeper_league_id is required' });
      }

      const [league, users, rosters] = await Promise.all([
        deps.sleeperClient.getLeague(sleeper_league_id),
        deps.sleeperClient.getLeagueUsers(sleeper_league_id),
        deps.sleeperClient.getLeagueRosters(sleeper_league_id),
      ]);

      const scoringFormat = deps.deriveSleeperScoringFormat(league.scoring_settings);
      const season = Number(league.season) || null;
      const rosterByOwner = new Map(rosters.map((roster) => [roster.owner_id, roster]));

      const teams = users.map((user) => {
        const roster = rosterByOwner.get(user.user_id);
        const displayName = user.metadata?.team_name || user.team_name || user.display_name || 'Team';

        return {
          externalUserId: user.user_id,
          externalRosterId: roster ? String(roster.roster_id) : null,
          displayName,
          isCommissioner: Boolean((user as any).is_owner || user.metadata?.is_commissioner),
          avatar: user.avatar ?? null,
        };
      });

      const result = await deps.storage.upsertLeagueWithTeams({
        userId: user_id as string,
        leagueName: league.name || `Sleeper League ${league.league_id}`,
        platform: 'sleeper',
        externalLeagueId: sleeper_league_id as string,
        season,
        scoringFormat,
        settings: {
          scoring_settings: league.scoring_settings ?? {},
          status: league.status,
          total_rosters: league.total_rosters,
        },
        teams,
      });

      res.json({
        success: true,
        league: result.league,
        teams: result.teams,
      });
    } catch (error) {
      console.error('❌ [Sleeper League Sync] Failed:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message || 'Failed to sync Sleeper league',
      });
    }
  });

  router.get('/api/league-sync/leagues', async (req, res) => {
    try {
      const { user_id = 'default_user' } = req.query;
      const leagues = await deps.storage.getLeaguesWithTeams(user_id as string);
      const normalizedLeagues = leagues.map((league) => ({ ...league, teams: league.teams ?? [] }));

      res.json({ success: true, leagues: normalizedLeagues });
    } catch (error) {
      console.error('❌ [League Sync] Failed to list leagues:', error);
      res.status(500).json({ success: false, error: (error as Error).message || 'Failed to fetch leagues' });
    }
  });

  router.get('/api/league-context', async (req, res) => {
    try {
      const { user_id = 'default_user' } = req.query;
      const context = await deps.storage.getUserLeagueContext(user_id as string);

      res.json({ success: true, ...context });
    } catch (error) {
      console.error('❌ [League Context] Failed to fetch context:', error);
      res.status(500).json({ success: false, error: (error as Error).message || 'Failed to fetch league context' });
    }
  });

  router.post('/api/league-context', async (req, res) => {
    try {
      const { user_id = 'default_user', league_id, team_id } = req.body;

      if (!league_id || !team_id) {
        return res.status(400).json({ success: false, error: 'league_id and team_id are required' });
      }

      const preference = await deps.storage.setUserLeagueContext({
        userId: user_id,
        leagueId: league_id,
        teamId: team_id,
      });

      const context = await deps.storage.getUserLeagueContext(user_id);

      res.json({ success: true, preference, ...context });
    } catch (error) {
      console.error('❌ [League Context] Failed to update context:', error);
      res.status(500).json({ success: false, error: (error as Error).message || 'Failed to update league context' });
    }
  });

  return router;
}

export const leagueSyncRouter = createLeagueSyncRouter();
