import express from "express";
import { deriveSleeperScoringFormat, sleeperClient } from "../integrations/sleeperClient";
import { storage } from "../storage";
import { createPlaybookForgeLogger } from "../utils/playbookForgeLogger";

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

  function normalizeExternalId(value?: string | null) {
    if (!value) return null;
    return String(value);
  }

  function findSuggestedTeam(teams: any[], externalUserId?: string | null) {
    if (!externalUserId) return null;
    return teams.find((team) => normalizeExternalId(team.externalUserId ?? team.external_user_id) === externalUserId) || null;
  }

  async function maybeAutoSetContext(options: {
    userId: string;
    leagueId: string;
    teams: any[];
  }) {
    const profile = await deps.storage.getUserPlatformProfile(options.userId, 'sleeper');
    if (!profile) return { suggestedTeamId: null, activeTeam: null };

    const externalUserId = (profile as any).externalUserId ?? (profile as any).external_user_id;
    const match = findSuggestedTeam(options.teams, externalUserId);
    if (match) {
      await deps.storage.setUserLeagueContext({ userId: options.userId, leagueId: options.leagueId, teamId: match.id });
      return { suggestedTeamId: match.id, activeTeam: match };
    }

    return { suggestedTeamId: null, activeTeam: null };
  }

  async function syncSleeperLeague(req: any, res: any) {
    try {
      const logger = createPlaybookForgeLogger({
        requestId: (req.headers['x-request-id'] as string) || undefined,
        enabled: process.env.DEBUG_PLAYBOOK_FORGE === '1',
        scope: 'LeagueSync',
      });
      const { user_id = 'default_user', league_id_external, sleeper_league_id } = req.body;
      const externalLeagueId = league_id_external || sleeper_league_id;

      if (!externalLeagueId) {
        return res.status(400).json({ success: false, error: 'league_id_external is required' });
      }

      const [league, users, rosters] = await Promise.all([
        deps.sleeperClient.getLeague(externalLeagueId),
        deps.sleeperClient.getLeagueUsers(externalLeagueId),
        deps.sleeperClient.getLeagueRosters(externalLeagueId),
      ]);

      const scoringFormat = deps.deriveSleeperScoringFormat(league.scoring_settings);
      const season = Number(league.season) || null;
      const rosterByOwner = new Map(rosters.map((roster) => [String(roster.owner_id), roster]));

      const rosterPlayerIds = Array.from(new Set(rosters.flatMap((r) => (r.players ?? []).map((pid) => String(pid)))));

      logger.log('league-sync-fetched', {
        requestId: logger.requestId,
        external_league_id: String(externalLeagueId),
        user_count: users.length,
        roster_count: rosters.length,
        unique_player_ids: rosterPlayerIds.length,
        sample_player_ids: rosterPlayerIds.slice(0, 10),
      });

      const teams = users.map((user) => {
        const roster = rosterByOwner.get(String(user.user_id));
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
        externalLeagueId: String(externalLeagueId),
        season,
        scoringFormat,
        settings: {
          scoring_settings: league.scoring_settings ?? {},
          status: league.status,
          total_rosters: league.total_rosters,
          roster_positions: (league as any).roster_positions ?? [],
        },
        teams,
      });

      const auto = await maybeAutoSetContext({ userId: user_id, leagueId: result.league.id, teams: result.teams });

      logger.log('league-sync-upserted', {
        requestId: logger.requestId,
        league_id: result.league.id,
        platform: 'sleeper',
        teams: result.teams.length,
        season,
      });

      res.setHeader('x-playbook-request-id', logger.requestId);
      res.json({
        success: true,
        league: result.league,
        teams: result.teams,
        activeTeam: auto.activeTeam,
        suggestedTeamId: auto.suggestedTeamId,
        requestId: logger.requestId,
      });
    } catch (error) {
      console.error('❌ [Sleeper League Sync] Failed:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message || 'Failed to sync Sleeper league',
      });
    }
  }

  router.post('/api/league-sync/sleeper', syncSleeperLeague);
  router.post('/api/league-sync/sync', syncSleeperLeague);

  router.get('/api/league-sync/leagues', async (req, res) => {
    try {
      const { user_id = 'default_user' } = req.query;
      const leagues = await deps.storage.getLeaguesWithTeams(user_id as string);
      const profile = await deps.storage.getUserPlatformProfile(user_id as string, 'sleeper');
      const externalUserId = profile ? (profile as any).externalUserId ?? (profile as any).external_user_id : null;
      const normalizedLeagues = leagues.map((league) => {
        const teams = league.teams ?? [];
        const match = externalUserId ? findSuggestedTeam(teams, externalUserId) : null;
        return {
          ...league,
          teams,
          suggestedTeamId: match?.id ?? null,
          suggested_team_id: match?.id ?? null,
        };
      });

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
      const profile = await deps.storage.getUserPlatformProfile(user_id as string, 'sleeper');
      const externalUserId = profile ? (profile as any).externalUserId ?? (profile as any).external_user_id : null;

      let suggestedTeamId: string | null = null;
      let activeTeam = context.activeTeam;

      if (externalUserId && context.activeLeague?.teams?.length) {
        const match = findSuggestedTeam(context.activeLeague.teams, externalUserId);
        suggestedTeamId = match?.id ?? null;
        if (match && !activeTeam) {
          await deps.storage.setUserLeagueContext({ userId: user_id as string, leagueId: context.activeLeague.id, teamId: match.id });
          activeTeam = match;
        }
      }

      res.json({ success: true, ...context, activeTeam, suggestedTeamId, suggested_team_id: suggestedTeamId });
    } catch (error) {
      console.error('❌ [League Context] Failed to fetch context:', error);
      res.status(500).json({ success: false, error: (error as Error).message || 'Failed to fetch league context' });
    }
  });

  router.post('/api/league-context', async (req, res) => {
    try {
      const { user_id = 'default_user', league_id, team_id } = req.body;

      if (!league_id) {
        return res.status(400).json({ success: false, error: 'league_id is required' });
      }

      let targetTeamId = team_id as string | undefined;

      if (!targetTeamId) {
        const league = await deps.storage.getLeagueWithTeams(league_id);
        if (league) {
          const profile = await deps.storage.getUserPlatformProfile(user_id as string, 'sleeper');
          const externalUserId = profile ? (profile as any).externalUserId ?? (profile as any).external_user_id : null;
          if (externalUserId) {
            const match = findSuggestedTeam(league.teams ?? [], externalUserId);
            if (match) targetTeamId = match.id;
          }
        }
      }

      if (!targetTeamId) {
        return res.status(400).json({ success: false, error: 'team_id is required for this league' });
      }

      const preference = await deps.storage.setUserLeagueContext({
        userId: user_id,
        leagueId: league_id,
        teamId: targetTeamId,
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
