import express from 'express';
import { storage } from '../storage';
import { computeLeagueDashboard } from '../services/leagueDashboardService';
import { classifyTeamDirection } from '../services/teamDirectionClassifier';
import { buildStrategyTemplateDiagnostics } from '@shared/strategyTemplateDiagnostics';
import { buildManagementStrategyContext } from '@shared/managementStrategyContext';
import { buildStrategyContextActivationDiagnostics } from '../modules/management/strategyContextActivationDiagnostics';

type ManagementDeps = {
  storage: typeof storage;
  computeLeagueDashboard: typeof computeLeagueDashboard;
  classifyTeamDirection: typeof classifyTeamDirection;
};

const defaultDeps: ManagementDeps = {
  storage,
  computeLeagueDashboard,
  classifyTeamDirection,
};

export function createManagementRouter(deps: ManagementDeps = defaultDeps) {
  const router = express.Router();

  router.get('/api/management/team-direction', async (req, res) => {
    try {
      const { user_id = 'default_user', league_id } = req.query;

      if (!league_id) {
        return res.status(400).json({ success: false, error: 'league_id is required' });
      }

      const context = await deps.storage.getUserLeagueContext(user_id as string);
      const activeTeam = context.activeTeam;

      if (!activeTeam) {
        return res.json({
          success: true,
          available: false,
          direction: null,
          reason: 'No active team set. Connect a team to unlock team direction.',
        });
      }

      let dashboardPayload;
      try {
        dashboardPayload = await deps.computeLeagueDashboard({
          userId: user_id as string,
          leagueId: league_id as string,
        });
      } catch (err) {
        return res.status(404).json({
          success: false,
          error: (err as Error).message || 'League not found or inaccessible',
        });
      }

      const teamData = dashboardPayload.teams.find((t) => t.team_id === activeTeam.id);

      if (!teamData) {
        return res.json({
          success: true,
          available: false,
          direction: null,
          reason: 'Active team not found in this league. Re-sync the league or select a different team.',
        });
      }

      const allPicks = await deps.storage.getLeagueFuturePicks(league_id as string);
      const externalRosterId =
        (activeTeam as any).external_roster_id ?? (activeTeam as any).externalRosterId ?? null;
      const teamPicks = externalRosterId
        ? allPicks.filter((p: any) => {
            const curr = p.current_roster_id ?? p.currentRosterId ?? null;
            return curr === externalRosterId;
          })
        : [];

      // Derive Superflex from league roster_positions if available
      const leagueSettings = dashboardPayload.leagueSettings ?? dashboardPayload.settings ?? null;
      const rosterPositions: string[] =
        (leagueSettings as any)?.roster_positions ??
        (leagueSettings as any)?.rosterPositions ??
        [];
      const superflex = rosterPositions.some(
        (p: string) => String(p).toUpperCase() === 'SUPER_FLEX'
      );

      const result = deps.classifyTeamDirection(teamData.roster ?? [], teamPicks, { superflex });
      const strategyTemplateDiagnostics = buildStrategyTemplateDiagnostics(
        dashboardPayload.diagnostics
          ? {
              artifact: dashboardPayload.diagnostics.strategyOntologyArtifact,
              templates: dashboardPayload.diagnostics.strategyOntologyTemplates ?? [],
            }
          : null,
        result,
      );
      const managementStrategyContext = buildManagementStrategyContext({
        teamDirection: result,
        rosterVisibility: dashboardPayload.diagnostics?.rosterVisibility,
        diagnostics: dashboardPayload.diagnostics,
        strategyTemplateDiagnostics,
      });
      // Slice 3: additive, read-only diagnostic visibility of Strategy Context
      // activation readiness. Does not activate templates or change any behavior.
      const strategyContextActivation = buildStrategyContextActivationDiagnostics(managementStrategyContext);

      res.json({
        success: true,
        available: true,
        teamId: activeTeam.id,
        teamName: (activeTeam as any).displayName ?? (activeTeam as any).display_name ?? 'Team',
        forgeDiagnostics: dashboardPayload.diagnostics
          ? {
              artifact: dashboardPayload.diagnostics.forgeArtifact,
              rosterMatching: dashboardPayload.diagnostics.forgeRosterMatching,
              rosterVisibility: dashboardPayload.diagnostics.rosterVisibility,
              strategyOntology: dashboardPayload.diagnostics.strategyOntologyArtifact,
              strategyTemplateDiagnostics,
              managementStrategyContext,
              strategyContextActivation,
            }
          : null,
        strategy_template_diagnostics: strategyTemplateDiagnostics,
        management_strategy_context: managementStrategyContext,
        strategy_context_activation: strategyContextActivation,
        ...result,
      });
    } catch (error) {
      console.error('[Management/team-direction] failed:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message || 'Failed to classify team direction',
      });
    }
  });

  return router;
}

export const managementRouter = createManagementRouter();
