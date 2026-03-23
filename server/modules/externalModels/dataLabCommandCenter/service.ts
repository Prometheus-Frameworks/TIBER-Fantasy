import { AgeCurveIntegrationError, TiberAgeCurveLab } from '../ageCurves/types';
import { AgeCurvesService, ageCurvesService } from '../ageCurves/ageCurvesService';
import { PointScenarioIntegrationError, TiberPointScenarioLab } from '../pointScenarios/types';
import { PointScenariosService, pointScenariosService } from '../pointScenarios/pointScenariosService';
import { RoleOpportunityIntegrationError, TiberRoleOpportunityLab } from '../roleOpportunity/types';
import { RoleOpportunityService, roleOpportunityService } from '../roleOpportunity/roleOpportunityService';
import { SignalValidationIntegrationError, TiberWrBreakoutLab } from '../signalValidation/types';
import { SignalValidationService, signalValidationService } from '../signalValidation/signalValidationService';
import { getTeamDisplayName } from '../teamResearch/nflTeams';
import {
  CommandCenterBreakoutItem,
  CommandCenterModuleStatus,
  CommandCenterPriorityItem,
  CommandCenterQuery,
  CommandCenterSection,
  CommandCenterTeamEnvironmentItem,
  DataLabCommandCenterWorkspace,
} from './types';

interface DataLabCommandCenterServiceDeps {
  signalValidation?: Pick<SignalValidationService, 'getWrBreakoutLab'>;
  roleOpportunity?: Pick<RoleOpportunityService, 'getRoleOpportunityLab'>;
  ageCurves?: Pick<AgeCurvesService, 'getAgeCurveLab'>;
  pointScenarios?: Pick<PointScenariosService, 'getPointScenarioLab'>;
}

type BreakoutResult = { ok: true; data: TiberWrBreakoutLab } | { ok: false; error: SignalValidationIntegrationError };
type RoleResult = { ok: true; data: TiberRoleOpportunityLab } | { ok: false; error: RoleOpportunityIntegrationError };
type AgeResult = { ok: true; data: TiberAgeCurveLab } | { ok: false; error: AgeCurveIntegrationError };
type ScenarioResult = { ok: true; data: TiberPointScenarioLab } | { ok: false; error: PointScenarioIntegrationError };

function sortSeasons(values: number[]): number[] {
  return [...new Set(values.filter((value) => Number.isFinite(value)))].sort((left, right) => right - left);
}

function normalizeToken(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function average(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (filtered.length === 0) {
    return null;
  }

  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function buildPlayerResearchHref(player: { playerId?: string | null; playerName?: string | null }, season?: number | null): string {
  const params = new URLSearchParams();
  if (season != null) {
    params.set('season', String(season));
  }
  if (player.playerId) {
    params.set('playerId', player.playerId);
  }
  if (player.playerName) {
    params.set('playerName', player.playerName);
  }
  const query = params.toString();
  return query ? `/tiber-data-lab/player-research?${query}` : '/tiber-data-lab/player-research';
}

function buildTeamResearchHref(team: string | null | undefined, season?: number | null): string {
  const params = new URLSearchParams();
  if (season != null) {
    params.set('season', String(season));
  }
  if (team) {
    params.set('team', team);
  }
  const query = params.toString();
  return query ? `/tiber-data-lab/team-research?${query}` : '/tiber-data-lab/team-research';
}

function buildModuleHref(path: string, params: Record<string, string | number | null | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') {
      query.set(key, String(value));
    }
  });
  const serialized = query.toString();
  return serialized ? `${path}?${serialized}` : path;
}

function createSection<TItem>(title: string, description: string, moduleTitle: string, linkHref: string): CommandCenterSection<TItem> {
  return {
    state: 'empty',
    title,
    description,
    moduleTitle,
    linkHref,
    message: 'No promoted signals are currently available for this section.',
    items: [],
  };
}

function getModuleStatus(title: string, href: string, result: BreakoutResult | RoleResult | AgeResult | ScenarioResult, rowCount?: number): CommandCenterModuleStatus {
  if (!result.ok) {
    return {
      moduleId: href.split('/').pop() as CommandCenterModuleStatus['moduleId'],
      title,
      href,
      state: 'unavailable',
      detail: result.error.message,
    };
  }

  if ((rowCount ?? 0) === 0) {
    return {
      moduleId: href.split('/').pop() as CommandCenterModuleStatus['moduleId'],
      title,
      href,
      state: 'empty',
      detail: `${title} is connected, but there are no promoted rows for this season.`,
    };
  }

  return {
    moduleId: href.split('/').pop() as CommandCenterModuleStatus['moduleId'],
    title,
    href,
    state: 'ready',
    detail: `${title} is ready with promoted read-only outputs for this season.`,
  };
}

export class DataLabCommandCenterService {
  constructor(
    private readonly deps: DataLabCommandCenterServiceDeps = {
      signalValidation: signalValidationService,
      roleOpportunity: roleOpportunityService,
      ageCurves: ageCurvesService,
      pointScenarios: pointScenariosService,
    },
  ) {}

  private async getBreakout(season?: number): Promise<BreakoutResult> {
    try {
      return { ok: true, data: await this.deps.signalValidation!.getWrBreakoutLab(season, { includeRawCanonical: false }) };
    } catch (error) {
      if (error instanceof SignalValidationIntegrationError) {
        return { ok: false, error };
      }
      return { ok: false, error: new SignalValidationIntegrationError('upstream_unavailable', 'WR Breakout Lab integration failed unexpectedly.', 503, error) };
    }
  }

  private async getRoleOpportunity(season?: number): Promise<RoleResult> {
    try {
      return { ok: true, data: await this.deps.roleOpportunity!.getRoleOpportunityLab({ season }, { includeRawCanonical: false }) };
    } catch (error) {
      if (error instanceof RoleOpportunityIntegrationError) {
        return { ok: false, error };
      }
      return { ok: false, error: new RoleOpportunityIntegrationError('upstream_unavailable', 'Role & Opportunity Lab integration failed unexpectedly.', 503, error) };
    }
  }

  private async getAgeCurves(season?: number): Promise<AgeResult> {
    try {
      return { ok: true, data: await this.deps.ageCurves!.getAgeCurveLab({ season }, { includeRawCanonical: false }) };
    } catch (error) {
      if (error instanceof AgeCurveIntegrationError) {
        return { ok: false, error };
      }
      return { ok: false, error: new AgeCurveIntegrationError('upstream_unavailable', 'Age Curve Lab integration failed unexpectedly.', 503, error) };
    }
  }

  private async getPointScenarios(season?: number): Promise<ScenarioResult> {
    try {
      return { ok: true, data: await this.deps.pointScenarios!.getPointScenarioLab({ season }, { includeRawCanonical: false }) };
    } catch (error) {
      if (error instanceof PointScenarioIntegrationError) {
        return { ok: false, error };
      }
      return { ok: false, error: new PointScenarioIntegrationError('upstream_unavailable', 'Point Scenario Lab integration failed unexpectedly.', 503, error) };
    }
  }

  async getCommandCenter(query: CommandCenterQuery = {}): Promise<DataLabCommandCenterWorkspace> {
    const [breakoutResult, roleResult, ageResult, scenarioResult] = await Promise.all([
      this.getBreakout(query.season),
      this.getRoleOpportunity(query.season),
      this.getAgeCurves(query.season),
      this.getPointScenarios(query.season),
    ]);

    const availableSeasons = sortSeasons([
      ...(breakoutResult.ok ? breakoutResult.data.availableSeasons : []),
      ...(roleResult.ok ? roleResult.data.availableSeasons : []),
      ...(ageResult.ok ? ageResult.data.availableSeasons : []),
      ...(scenarioResult.ok ? scenarioResult.data.availableSeasons : []),
      ...(query.season != null ? [query.season] : []),
    ]);

    const season =
      query.season ??
      (breakoutResult.ok ? breakoutResult.data.season : null) ??
      (roleResult.ok ? roleResult.data.season : null) ??
      (ageResult.ok ? ageResult.data.season : null) ??
      (scenarioResult.ok ? scenarioResult.data.season : null) ??
      availableSeasons[0] ??
      null;

    const workspace: DataLabCommandCenterWorkspace = {
      season,
      availableSeasons,
      state: 'empty',
      framing: {
        title: 'Data Lab Command Center',
        description:
          'The front door for promoted research surfaces in TIBER Data Lab. Start here when you want to triage what deserves attention before opening any one lab or workspace in depth.',
        posture:
          'Everything here is read only, inspectable, and derived from promoted model outputs. TIBER-Fantasy is synthesizing summaries and link paths here, not creating a unified score or recomputing model logic.',
      },
      moduleStatuses: [],
      priorities: [],
      warnings: [],
      sections: {
        breakoutCandidates: createSection('Top breakout candidates', 'Highest-priority promoted breakout cards to inspect first.', 'WR Breakout Lab', buildModuleHref('/tiber-data-lab/breakout-signals', { season })),
        roleOpportunity: createSection('Notable role / opportunity movers', 'Current usage and deployment leaders worth validating before you trust the rest of the player thesis.', 'Role & Opportunity Lab', buildModuleHref('/tiber-data-lab/role-opportunity', { season })),
        ageCurves: createSection('Age-curve overperformers / underperformers', 'Promoted ARC signals that can support or challenge the current player story.', 'Age Curve / ARC Lab', buildModuleHref('/tiber-data-lab/age-curves', { season })),
        pointScenarios: createSection('Biggest point-scenario movers', 'Largest promoted scenario swings to inspect before making a final call elsewhere.', 'Point Scenario Lab', buildModuleHref('/tiber-data-lab/point-scenarios', { season })),
        teamEnvironments: createSection('Team environments worth investigating', 'Offensive environments with meaningful promoted activity across the current research lane.', 'Team Research Workspace', buildModuleHref('/tiber-data-lab/team-research', { season })),
      },
    };

    workspace.moduleStatuses = [
      getModuleStatus('WR Breakout Lab', '/tiber-data-lab/breakout-signals', breakoutResult, breakoutResult.ok ? breakoutResult.data.rows.length : 0),
      getModuleStatus('Role & Opportunity Lab', '/tiber-data-lab/role-opportunity', roleResult, roleResult.ok ? roleResult.data.rows.length : 0),
      getModuleStatus('Age Curve / ARC Lab', '/tiber-data-lab/age-curves', ageResult, ageResult.ok ? ageResult.data.rows.length : 0),
      getModuleStatus('Point Scenario Lab', '/tiber-data-lab/point-scenarios', scenarioResult, scenarioResult.ok ? scenarioResult.data.rows.length : 0),
    ];

    if (!breakoutResult.ok) workspace.warnings.push(`WR Breakout Lab unavailable: ${breakoutResult.error.message}`);
    if (!roleResult.ok) workspace.warnings.push(`Role & Opportunity Lab unavailable: ${roleResult.error.message}`);
    if (!ageResult.ok) workspace.warnings.push(`Age Curve / ARC Lab unavailable: ${ageResult.error.message}`);
    if (!scenarioResult.ok) workspace.warnings.push(`Point Scenario Lab unavailable: ${scenarioResult.error.message}`);

    const hasAnySuccess = breakoutResult.ok || roleResult.ok || ageResult.ok || scenarioResult.ok;
    if (!hasAnySuccess) {
      workspace.state = 'error';
      Object.values(workspace.sections).forEach((section) => {
        section.state = 'unavailable';
        section.message = 'All promoted upstream modules are currently unavailable.';
      });
      return workspace;
    }

    if (breakoutResult.ok && breakoutResult.data.rows.length > 0) {
      const items: CommandCenterBreakoutItem[] = [...breakoutResult.data.rows]
        .sort((left, right) => {
          const rankDelta = (left.candidateRank ?? Number.MAX_SAFE_INTEGER) - (right.candidateRank ?? Number.MAX_SAFE_INTEGER);
          if (rankDelta !== 0) return rankDelta;
          return (right.finalSignalScore ?? Number.NEGATIVE_INFINITY) - (left.finalSignalScore ?? Number.NEGATIVE_INFINITY);
        })
        .slice(0, 5)
        .map((row) => ({
          playerId: row.playerId,
          playerName: row.playerName,
          team: row.team,
          candidateRank: row.candidateRank,
          finalSignalScore: row.finalSignalScore,
          breakoutLabel: row.breakoutLabelDefault,
          breakoutContext: row.breakoutContext,
          links: {
            moduleHref: buildModuleHref('/tiber-data-lab/breakout-signals', { season, playerId: row.playerId, playerName: row.playerName }),
            playerResearchHref: buildPlayerResearchHref(row, season),
          },
        }));
      workspace.sections.breakoutCandidates.state = 'ready';
      workspace.sections.breakoutCandidates.items = items;
      workspace.sections.breakoutCandidates.message = 'Use these promoted breakout cards as your first screen for upside-driven player triage.';
    } else {
      workspace.sections.breakoutCandidates.state = breakoutResult.ok ? 'empty' : 'unavailable';
      workspace.sections.breakoutCandidates.message = breakoutResult.ok
        ? 'WR Breakout Lab is ready, but there are no promoted breakout cards for this season.'
        : breakoutResult.error.message;
    }

    if (roleResult.ok && roleResult.data.rows.length > 0) {
      const items = [...roleResult.data.rows]
        .sort((left, right) => {
          return (
            (right.usage.targetShare ?? Number.NEGATIVE_INFINITY) - (left.usage.targetShare ?? Number.NEGATIVE_INFINITY) ||
            (right.usage.usageRate ?? Number.NEGATIVE_INFINITY) - (left.usage.usageRate ?? Number.NEGATIVE_INFINITY) ||
            (right.usage.routeParticipation ?? Number.NEGATIVE_INFINITY) - (left.usage.routeParticipation ?? Number.NEGATIVE_INFINITY) ||
            left.playerName.localeCompare(right.playerName)
          );
        })
        .slice(0, 5)
        .map((row) => ({
          playerId: row.playerId,
          playerName: row.playerName,
          team: row.team,
          position: row.position,
          primaryRole: row.primaryRole,
          targetShare: row.usage.targetShare,
          routeParticipation: row.usage.routeParticipation,
          snapShare: row.usage.snapShare,
          usageRate: row.usage.usageRate,
          confidenceTier: row.confidence.tier,
          insights: row.insights.slice(0, 3),
          links: {
            moduleHref: buildModuleHref('/tiber-data-lab/role-opportunity', { season, playerId: row.playerId, playerName: row.playerName }),
            playerResearchHref: buildPlayerResearchHref(row, season),
          },
        }));
      workspace.sections.roleOpportunity.state = 'ready';
      workspace.sections.roleOpportunity.items = items;
      workspace.sections.roleOpportunity.message = 'These promoted deployment leaders are the cleanest entry points when you want to validate current role strength.';
    } else {
      workspace.sections.roleOpportunity.state = roleResult.ok ? 'empty' : 'unavailable';
      workspace.sections.roleOpportunity.message = roleResult.ok
        ? 'Role & Opportunity Lab is ready, but there are no promoted role rows for this season.'
        : roleResult.error.message;
    }

    if (ageResult.ok && ageResult.data.rows.length > 0) {
      const positives = ageResult.data.rows
        .filter((row) => (row.ppgDelta ?? 0) > 0)
        .sort((left, right) => (right.ppgDelta ?? Number.NEGATIVE_INFINITY) - (left.ppgDelta ?? Number.NEGATIVE_INFINITY))
        .slice(0, 3)
        .map((row) => ({
          playerId: row.playerId,
          playerName: row.playerName,
          team: row.team,
          position: row.position,
          trajectoryLabel: row.trajectoryLabel,
          peerBucket: row.peerBucket,
          expectedPpg: row.expectedPpg,
          actualPpg: row.actualPpg,
          ppgDelta: row.ppgDelta,
          signalDirection: 'overperformer' as const,
          links: {
            moduleHref: buildModuleHref('/tiber-data-lab/age-curves', { season, playerId: row.playerId, playerName: row.playerName }),
            playerResearchHref: buildPlayerResearchHref(row, season),
          },
        }));
      const negatives = ageResult.data.rows
        .filter((row) => (row.ppgDelta ?? 0) < 0)
        .sort((left, right) => (left.ppgDelta ?? Number.POSITIVE_INFINITY) - (right.ppgDelta ?? Number.POSITIVE_INFINITY))
        .slice(0, 3)
        .map((row) => ({
          playerId: row.playerId,
          playerName: row.playerName,
          team: row.team,
          position: row.position,
          trajectoryLabel: row.trajectoryLabel,
          peerBucket: row.peerBucket,
          expectedPpg: row.expectedPpg,
          actualPpg: row.actualPpg,
          ppgDelta: row.ppgDelta,
          signalDirection: 'underperformer' as const,
          links: {
            moduleHref: buildModuleHref('/tiber-data-lab/age-curves', { season, playerId: row.playerId, playerName: row.playerName }),
            playerResearchHref: buildPlayerResearchHref(row, season),
          },
        }));
      const items = [...positives, ...negatives];
      if (items.length > 0) {
        workspace.sections.ageCurves.state = 'ready';
        workspace.sections.ageCurves.items = items;
        workspace.sections.ageCurves.message = 'ARC helps you pressure-test whether current production is early, sustainable, or vulnerable.';
      } else {
        workspace.sections.ageCurves.state = 'empty';
        workspace.sections.ageCurves.message = 'Age Curve / ARC Lab is ready, but there are no directional over/underperformer deltas in the promoted rows.';
      }
    } else {
      workspace.sections.ageCurves.state = ageResult.ok ? 'empty' : 'unavailable';
      workspace.sections.ageCurves.message = ageResult.ok
        ? 'Age Curve / ARC Lab is ready, but there are no promoted ARC rows for this season.'
        : ageResult.error.message;
    }

    if (scenarioResult.ok && scenarioResult.data.rows.length > 0) {
      const items = [...scenarioResult.data.rows]
        .sort((left, right) => Math.abs(right.delta ?? 0) - Math.abs(left.delta ?? 0))
        .slice(0, 5)
        .map((row) => ({
          playerId: row.playerId,
          playerName: row.playerName,
          team: row.team,
          position: row.position,
          scenarioName: row.scenarioName,
          delta: row.delta,
          baselineProjection: row.baselineProjection,
          adjustedProjection: row.adjustedProjection,
          confidenceLabel: row.confidence.label,
          eventType: row.eventType,
          links: {
            moduleHref: buildModuleHref('/tiber-data-lab/point-scenarios', { season, playerId: row.playerId, playerName: row.playerName }),
            playerResearchHref: buildPlayerResearchHref(row, season),
          },
        }));
      workspace.sections.pointScenarios.state = 'ready';
      workspace.sections.pointScenarios.items = items;
      workspace.sections.pointScenarios.message = 'These are the biggest promoted scenario swings on the board right now.';
    } else {
      workspace.sections.pointScenarios.state = scenarioResult.ok ? 'empty' : 'unavailable';
      workspace.sections.pointScenarios.message = scenarioResult.ok
        ? 'Point Scenario Lab is ready, but there are no promoted scenario rows for this season.'
        : scenarioResult.error.message;
    }

    const teamMap = new Map<string, {
      team: string;
      breakoutCandidateCount: number;
      rolePlayerKeys: Set<string>;
      ageSignalKeys: Set<string>;
      scenarioPlayerKeys: Set<string>;
      targetShares: Array<number | null | undefined>;
      routeParticipation: Array<number | null | undefined>;
      maxScenarioDelta: number | null;
      playerNames: Set<string>;
    }>();

    const ensureTeam = (teamValue: string | null | undefined) => {
      const team = teamValue?.trim().toUpperCase();
      if (!team) return null;
      const existing = teamMap.get(team);
      if (existing) return existing;
      const next = {
        team,
        breakoutCandidateCount: 0,
        rolePlayerKeys: new Set<string>(),
        ageSignalKeys: new Set<string>(),
        scenarioPlayerKeys: new Set<string>(),
        targetShares: [],
        routeParticipation: [],
        maxScenarioDelta: null as number | null,
        playerNames: new Set<string>(),
      };
      teamMap.set(team, next);
      return next;
    };

    if (breakoutResult.ok) {
      breakoutResult.data.rows.forEach((row) => {
        const team = ensureTeam(row.team);
        if (!team) return;
        team.breakoutCandidateCount += 1;
        team.playerNames.add(row.playerName);
      });
    }
    if (roleResult.ok) {
      roleResult.data.rows.forEach((row) => {
        const team = ensureTeam(row.team);
        if (!team) return;
        team.rolePlayerKeys.add(row.playerId || normalizeToken(row.playerName));
        team.targetShares.push(row.usage.targetShare);
        team.routeParticipation.push(row.usage.routeParticipation);
        team.playerNames.add(row.playerName);
      });
    }
    if (ageResult.ok) {
      ageResult.data.rows.forEach((row) => {
        const team = ensureTeam(row.team);
        if (!team) return;
        if (Math.abs(row.ppgDelta ?? 0) >= 0.5) {
          team.ageSignalKeys.add(row.playerId || normalizeToken(row.playerName));
        }
        team.playerNames.add(row.playerName);
      });
    }
    if (scenarioResult.ok) {
      scenarioResult.data.rows.forEach((row) => {
        const team = ensureTeam(row.team);
        if (!team) return;
        team.scenarioPlayerKeys.add(row.playerId || normalizeToken(row.playerName));
        if (row.delta != null && (team.maxScenarioDelta == null || Math.abs(row.delta) > Math.abs(team.maxScenarioDelta))) {
          team.maxScenarioDelta = row.delta;
        }
        team.playerNames.add(row.playerName);
      });
    }

    const teamItems: CommandCenterTeamEnvironmentItem[] = [...teamMap.values()]
      .map((team) => ({
        team: team.team,
        teamName: getTeamDisplayName(team.team) ?? team.team,
        breakoutCandidateCount: team.breakoutCandidateCount,
        rolePlayerCount: team.rolePlayerKeys.size,
        ageSignalCount: team.ageSignalKeys.size,
        scenarioPlayerCount: team.scenarioPlayerKeys.size,
        avgTargetShare: average(team.targetShares),
        avgRouteParticipation: average(team.routeParticipation),
        maxScenarioDelta: team.maxScenarioDelta,
        topPlayers: [...team.playerNames].slice(0, 4),
        links: {
          moduleHref: buildModuleHref('/tiber-data-lab/team-research', { season, team: team.team }),
          teamResearchHref: buildTeamResearchHref(team.team, season),
        },
      }))
      .sort((left, right) => {
        return (
          right.breakoutCandidateCount - left.breakoutCandidateCount ||
          right.rolePlayerCount - left.rolePlayerCount ||
          Math.abs(right.maxScenarioDelta ?? 0) - Math.abs(left.maxScenarioDelta ?? 0) ||
          (right.avgTargetShare ?? Number.NEGATIVE_INFINITY) - (left.avgTargetShare ?? Number.NEGATIVE_INFINITY) ||
          left.team.localeCompare(right.team)
        );
      })
      .slice(0, 5);

    if (teamItems.length > 0) {
      workspace.sections.teamEnvironments.state = 'ready';
      workspace.sections.teamEnvironments.items = teamItems;
      workspace.sections.teamEnvironments.message = 'Use Team Research when you want to move from signal spotting into one offensive environment quickly.';
    } else {
      workspace.sections.teamEnvironments.state = 'empty';
      workspace.sections.teamEnvironments.message = 'No promoted team environments can be summarized yet because the current promoted rows do not include team-linked coverage.';
    }

    const priorities: CommandCenterPriorityItem[] = [];
    const topBreakout = workspace.sections.breakoutCandidates.items[0];
    if (topBreakout) {
      priorities.push({
        id: 'priority-breakout',
        title: `Start with ${topBreakout.playerName}`,
        reason: `${topBreakout.breakoutLabel ?? 'Breakout signal'}${topBreakout.finalSignalScore != null ? ` at ${topBreakout.finalSignalScore.toFixed(1)}` : ''} is one of the clearest promoted upside cases on the board.`,
        moduleTitle: 'WR Breakout Lab',
        moduleHref: topBreakout.links.moduleHref,
        primaryAction: { label: 'Open in Player Research', href: topBreakout.links.playerResearchHref },
        secondaryAction: { label: 'Open breakout card', href: topBreakout.links.moduleHref },
      });
    }
    const topRole = workspace.sections.roleOpportunity.items[0];
    if (topRole) {
      priorities.push({
        id: 'priority-role',
        title: `Check ${topRole.playerName}'s role next`,
        reason: `${topRole.primaryRole} usage with ${Math.round((topRole.targetShare ?? 0) * 100)}% target share makes this one of the strongest current deployment signals.`,
        moduleTitle: 'Role & Opportunity Lab',
        moduleHref: topRole.links.moduleHref,
        primaryAction: { label: 'Open in Player Research', href: topRole.links.playerResearchHref },
        secondaryAction: { label: 'Open role view', href: topRole.links.moduleHref },
      });
    }
    const topTeam = teamItems[0];
    if (topTeam) {
      priorities.push({
        id: 'priority-team',
        title: `Review ${topTeam.teamName}`,
        reason: `This environment has promoted coverage across breakout, role, ARC, or scenarios and is worth a full team-level pass right now.`,
        moduleTitle: 'Team Research Workspace',
        moduleHref: topTeam.links.teamResearchHref,
        primaryAction: { label: 'Open in Team Research', href: topTeam.links.teamResearchHref },
        secondaryAction: { label: 'Jump to team workspace', href: topTeam.links.moduleHref },
      });
    }
    const topScenario = workspace.sections.pointScenarios.items[0];
    if (topScenario) {
      priorities.push({
        id: 'priority-scenario',
        title: `Stress-test ${topScenario.playerName}`,
        reason: `${topScenario.scenarioName} moves the promoted point outlook by ${topScenario.delta != null ? topScenario.delta.toFixed(1) : '—'} points, making it one of the biggest scenario swings available.`,
        moduleTitle: 'Point Scenario Lab',
        moduleHref: topScenario.links.moduleHref,
        primaryAction: { label: 'Open in Player Research', href: topScenario.links.playerResearchHref },
        secondaryAction: { label: 'Open scenario view', href: topScenario.links.moduleHref },
      });
    }
    const topAge = workspace.sections.ageCurves.items[0];
    if (topAge) {
      priorities.push({
        id: 'priority-age',
        title: `${topAge.playerName} has an ARC flag`,
        reason: `${topAge.signalDirection === 'overperformer' ? 'Overperforming' : 'Underperforming'} age-curve expectations by ${topAge.ppgDelta != null ? topAge.ppgDelta.toFixed(1) : '—'} PPG is a useful developmental check before you go deeper.`,
        moduleTitle: 'Age Curve / ARC Lab',
        moduleHref: topAge.links.moduleHref,
        primaryAction: { label: 'Open in Player Research', href: topAge.links.playerResearchHref },
        secondaryAction: { label: 'Open ARC view', href: topAge.links.moduleHref },
      });
    }

    workspace.priorities = priorities.slice(0, 5);

    const sectionStates = Object.values(workspace.sections).map((section) => section.state);
    const readyCount = sectionStates.filter((state) => state === 'ready').length;
    const unavailableCount = sectionStates.filter((state) => state === 'unavailable').length;

    if (readyCount === 0 && unavailableCount > 0) {
      workspace.state = 'error';
    } else if (readyCount === 0) {
      workspace.state = 'empty';
    } else if (unavailableCount > 0 || sectionStates.some((state) => state === 'empty')) {
      workspace.state = 'partial';
    } else {
      workspace.state = 'ready';
    }

    return workspace;
  }
}

export const dataLabCommandCenterService = new DataLabCommandCenterService();
