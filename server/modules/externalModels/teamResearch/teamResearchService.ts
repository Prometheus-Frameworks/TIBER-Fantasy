import { AgeCurveIntegrationError, TiberAgeCurveLab } from '../ageCurves/types';
import { AgeCurvesService, ageCurvesService } from '../ageCurves/ageCurvesService';
import { PointScenarioIntegrationError, TiberPointScenarioLab } from '../pointScenarios/types';
import { PointScenariosService, pointScenariosService } from '../pointScenarios/pointScenariosService';
import { RoleOpportunityIntegrationError, TiberRoleOpportunityLab } from '../roleOpportunity/types';
import { RoleOpportunityService, roleOpportunityService } from '../roleOpportunity/roleOpportunityService';
import { SignalValidationIntegrationError, TiberWrBreakoutLab } from '../signalValidation/types';
import { SignalValidationService, signalValidationService } from '../signalValidation/signalValidationService';
import { getTeamDisplayName, getTeamReference } from './nflTeams';
import {
  TeamResearchAgeCurveSummary,
  TeamResearchBreakoutSummary,
  TeamResearchPlayerSummary,
  TeamResearchQuery,
  TeamResearchResolvedTeam,
  TeamResearchRoleOpportunitySummary,
  TeamResearchSearchEntry,
  TeamResearchSection,
  TeamResearchScenarioSummary,
  TeamResearchWorkspace,
  TeamOffensiveContextSummary,
} from './types';

function normalizeToken(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function buildModuleHref(path: string, season?: number | null, team?: string | null): string {
  const params = new URLSearchParams();

  if (season != null) {
    params.set('season', String(season));
  }

  if (team) {
    params.set('team', team);
  }

  const query = params.toString();
  return query ? `${path}?${query}` : path;
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

function createBaseSection<TSummary>(title: string, description: string, linkHref: string, provenanceNote: string): TeamResearchSection<TSummary> {
  return {
    state: 'idle',
    title,
    description,
    linkHref,
    summary: null,
    message: null,
    readOnly: true,
    provenanceNote,
    error: null,
  };
}

function sortSeasons(values: number[]): number[] {
  return [...new Set(values.filter((value) => Number.isFinite(value)))].sort((left, right) => right - left);
}

function average(values: Array<number | null | undefined>): number | null {
  const filtered = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (filtered.length === 0) {
    return null;
  }

  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

type BreakoutResult = { ok: true; data: TiberWrBreakoutLab } | { ok: false; error: SignalValidationIntegrationError };
type RoleResult = { ok: true; data: TiberRoleOpportunityLab } | { ok: false; error: RoleOpportunityIntegrationError };
type AgeResult = { ok: true; data: TiberAgeCurveLab } | { ok: false; error: AgeCurveIntegrationError };
type ScenarioResult = { ok: true; data: TiberPointScenarioLab } | { ok: false; error: PointScenarioIntegrationError };

interface TeamResearchServiceDeps {
  signalValidation?: Pick<SignalValidationService, 'getWrBreakoutLab'>;
  roleOpportunity?: Pick<RoleOpportunityService, 'getRoleOpportunityLab'>;
  ageCurves?: Pick<AgeCurvesService, 'getAgeCurveLab'>;
  pointScenarios?: Pick<PointScenariosService, 'getPointScenarioLab'>;
}

export class TeamResearchService {
  constructor(
    private readonly deps: TeamResearchServiceDeps = {
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

  async getTeamResearchWorkspace(query: TeamResearchQuery = {}): Promise<TeamResearchWorkspace> {
    const requestedTeam = query.team?.trim().toUpperCase() || null;
    const breakoutLink = buildModuleHref('/tiber-data-lab/breakout-signals', query.season ?? null, requestedTeam);
    const roleLink = buildModuleHref('/tiber-data-lab/role-opportunity', query.season ?? null, requestedTeam);
    const ageLink = buildModuleHref('/tiber-data-lab/age-curves', query.season ?? null, requestedTeam);
    const scenarioLink = buildModuleHref('/tiber-data-lab/point-scenarios', query.season ?? null, requestedTeam);

    const workspace: TeamResearchWorkspace = {
      season: query.season ?? null,
      availableSeasons: [],
      state: 'idle',
      requestedTeam,
      selectedTeam: null,
      searchIndex: [],
      framing: {
        title: 'Team Research Workspace',
        description:
          'This team-centric research workspace aggregates promoted read-only outputs from Breakout Signals, Role & Opportunity, Age Curve / ARC, and Point Scenarios so you can inspect one offensive environment in one place.',
        provenanceNote:
          'TIBER-Fantasy is orchestrating and normalizing promoted model outputs plus canonical team context here. It is not recomputing breakout, role, ARC, or point-scenario logic locally.',
      },
      warnings: [],
      header: {
        team: requestedTeam,
        teamName: getTeamDisplayName(requestedTeam),
        conference: getTeamReference(requestedTeam)?.conference ?? null,
        division: getTeamReference(requestedTeam)?.division ?? null,
      },
      keyPlayers: [],
      sections: {
        offensiveContext: createBaseSection<TeamOffensiveContextSummary>(
          'Offensive context summary',
          'High-level team context synthesized from whichever promoted read-only model surfaces are available for this team and season.',
          roleLink,
          'Read-only synthesis of promoted team context; TIBER-Fantasy is not authoring team scores here.',
        ),
        roleOpportunity: createBaseSection<TeamResearchRoleOpportunitySummary>(
          'Role & Opportunity summary by key players',
          'Promoted deployment and usage context for the most relevant skill-position players on this team.',
          roleLink,
          'Read-only summary of promoted role/deployment outputs for this roster.',
        ),
        breakoutSignals: createBaseSection<TeamResearchBreakoutSummary>(
          'Breakout-relevant roster signals',
          'Promoted breakout context for players on this roster when breakout exports are available.',
          breakoutLink,
          'Read-only summary of promoted Signal-Validation-Model outputs for this team.',
        ),
        pointScenarios: createBaseSection<TeamResearchScenarioSummary>(
          'Scenario context summary',
          'Promoted scenario coverage for notable players on this roster when point-scenario outputs are available.',
          scenarioLink,
          'Read-only summary of promoted Point-prediction-Model outputs for this team.',
        ),
        ageCurves: createBaseSection<TeamResearchAgeCurveSummary>(
          'ARC / development snapshot',
          'Promoted developmental timing context for notable players on this roster when ARC outputs are available.',
          ageLink,
          'Read-only summary of promoted ARC outputs for this team.',
        ),
      },
    };

    const [breakoutResult, roleResult, ageResult, scenarioResult] = await Promise.all([
      this.getBreakout(query.season),
      this.getRoleOpportunity(query.season),
      this.getAgeCurves(query.season),
      this.getPointScenarios(query.season),
    ]);

    workspace.availableSeasons = sortSeasons([
      ...(breakoutResult.ok ? breakoutResult.data.availableSeasons : []),
      ...(roleResult.ok ? roleResult.data.availableSeasons : []),
      ...(ageResult.ok ? ageResult.data.availableSeasons : []),
      ...(scenarioResult.ok ? scenarioResult.data.availableSeasons : []),
      ...(query.season != null ? [query.season] : []),
    ]);

    if (workspace.season == null) {
      workspace.season =
        (breakoutResult.ok ? breakoutResult.data.season : null) ??
        (roleResult.ok ? roleResult.data.season : null) ??
        (ageResult.ok ? ageResult.data.season : null) ??
        (scenarioResult.ok ? scenarioResult.data.season : null) ??
        workspace.availableSeasons[0] ??
        null;
    }

    const searchEntries = new Map<string, TeamResearchSearchEntry>();
    const teamPlayerCounts = new Map<string, Set<string>>();

    const upsertTeam = (team: string | null | undefined, moduleKey: keyof TeamResearchSearchEntry['modules'], playerName?: string | null, playerId?: string | null) => {
      const teamCode = team?.trim().toUpperCase();
      if (!teamCode) {
        return;
      }

      const teamRef = getTeamReference(teamCode);
      const entry = searchEntries.get(teamCode) ?? {
        team: teamCode,
        teamName: getTeamDisplayName(teamCode) ?? teamCode,
        conference: teamRef?.conference ?? null,
        division: teamRef?.division ?? null,
        playerCount: 0,
        modules: {
          breakoutSignals: false,
          roleOpportunity: false,
          ageCurves: false,
          pointScenarios: false,
        },
      };
      entry.modules[moduleKey] = true;
      searchEntries.set(teamCode, entry);

      const playerKey = playerId?.trim() || normalizeToken(playerName);
      if (playerKey) {
        const seenPlayers = teamPlayerCounts.get(teamCode) ?? new Set<string>();
        seenPlayers.add(playerKey);
        teamPlayerCounts.set(teamCode, seenPlayers);
        entry.playerCount = seenPlayers.size;
      }
    };

    if (breakoutResult.ok) {
      breakoutResult.data.rows.forEach((row) => upsertTeam(row.team, 'breakoutSignals', row.playerName, row.playerId));
    } else {
      workspace.warnings.push(`Breakout Signals unavailable: ${breakoutResult.error.message}`);
    }

    if (roleResult.ok) {
      roleResult.data.rows.forEach((row) => upsertTeam(row.team, 'roleOpportunity', row.playerName, row.playerId));
    } else {
      workspace.warnings.push(`Role & Opportunity unavailable: ${roleResult.error.message}`);
    }

    if (ageResult.ok) {
      ageResult.data.rows.forEach((row) => upsertTeam(row.team, 'ageCurves', row.playerName, row.playerId));
    } else {
      workspace.warnings.push(`Age Curve / ARC unavailable: ${ageResult.error.message}`);
    }

    if (scenarioResult.ok) {
      scenarioResult.data.rows.forEach((row) => upsertTeam(row.team, 'pointScenarios', row.playerName, row.playerId));
    } else {
      workspace.warnings.push(`Point Scenarios unavailable: ${scenarioResult.error.message}`);
    }

    workspace.searchIndex = [...searchEntries.values()].sort((left, right) => left.team.localeCompare(right.team));

    const hasAnySuccessfulDataset = breakoutResult.ok || roleResult.ok || ageResult.ok || scenarioResult.ok;
    if (!hasAnySuccessfulDataset) {
      workspace.state = 'error';
      for (const section of Object.values(workspace.sections)) {
        section.state = 'error';
      }
      if (!breakoutResult.ok) {
        workspace.sections.breakoutSignals.message = breakoutResult.error.message;
        workspace.sections.breakoutSignals.error = { code: breakoutResult.error.code, message: breakoutResult.error.message };
      }
      if (!roleResult.ok) {
        workspace.sections.offensiveContext.message = roleResult.error.message;
        workspace.sections.offensiveContext.error = { code: roleResult.error.code, message: roleResult.error.message };
        workspace.sections.roleOpportunity.message = roleResult.error.message;
        workspace.sections.roleOpportunity.error = { code: roleResult.error.code, message: roleResult.error.message };
      }
      if (!ageResult.ok) {
        workspace.sections.ageCurves.message = ageResult.error.message;
        workspace.sections.ageCurves.error = { code: ageResult.error.code, message: ageResult.error.message };
      }
      if (!scenarioResult.ok) {
        workspace.sections.pointScenarios.message = scenarioResult.error.message;
        workspace.sections.pointScenarios.error = { code: scenarioResult.error.code, message: scenarioResult.error.message };
      }
      return workspace;
    }

    const resolveSelectedTeam = (): TeamResearchResolvedTeam | null => {
      if (!requestedTeam) {
        return null;
      }

      const exactCode = workspace.searchIndex.find((entry) => entry.team === requestedTeam);
      if (exactCode) {
        return {
          team: exactCode.team,
          teamName: exactCode.teamName,
          conference: exactCode.conference,
          division: exactCode.division,
          matchStrategy: 'team_code',
        };
      }

      const lowered = requestedTeam.toLowerCase();
      const exactName = workspace.searchIndex.find((entry) => entry.teamName.toLowerCase() === lowered);
      if (exactName) {
        return {
          team: exactName.team,
          teamName: exactName.teamName,
          conference: exactName.conference,
          division: exactName.division,
          matchStrategy: 'team_name',
        };
      }

      const normalized = normalizeToken(requestedTeam);
      const normalizedName = workspace.searchIndex.find((entry) => normalizeToken(entry.teamName) === normalized);
      if (normalizedName) {
        return {
          team: normalizedName.team,
          teamName: normalizedName.teamName,
          conference: normalizedName.conference,
          division: normalizedName.division,
          matchStrategy: 'normalized_name',
        };
      }

      const reference = getTeamReference(requestedTeam);
      if (reference) {
        return {
          team: reference.code,
          teamName: `${reference.city} ${reference.nickname}`,
          conference: reference.conference,
          division: reference.division,
          matchStrategy: 'team_code',
        };
      }

      return null;
    };

    workspace.selectedTeam = resolveSelectedTeam();

    if (!workspace.selectedTeam) {
      workspace.state = requestedTeam ? 'empty' : 'idle';
      if (workspace.state === 'empty') {
        workspace.warnings.push('No promoted team match was found for the requested team query in the selected season.');
      }
      return workspace;
    }

    workspace.header = {
      team: workspace.selectedTeam.team,
      teamName: workspace.selectedTeam.teamName,
      conference: workspace.selectedTeam.conference,
      division: workspace.selectedTeam.division,
    };

    const teamCode = workspace.selectedTeam.team;

    const teamBreakoutRows = breakoutResult.ok ? breakoutResult.data.rows.filter((row) => row.team?.toUpperCase() === teamCode) : [];
    const teamRoleRows = roleResult.ok ? roleResult.data.rows.filter((row) => row.team?.toUpperCase() === teamCode) : [];
    const teamAgeRows = ageResult.ok ? ageResult.data.rows.filter((row) => row.team?.toUpperCase() === teamCode) : [];
    const teamScenarioRows = scenarioResult.ok ? scenarioResult.data.rows.filter((row) => row.team?.toUpperCase() === teamCode) : [];

    const playerMap = new Map<string, TeamResearchPlayerSummary>();
    const ensurePlayer = (input: { playerId?: string | null; playerName: string; position?: string | null }) => {
      const key = input.playerId?.trim() || normalizeToken(input.playerName);
      const existing = playerMap.get(key);
      if (existing) {
        existing.position = existing.position ?? input.position ?? null;
        return existing;
      }

      const next: TeamResearchPlayerSummary = {
        playerId: input.playerId ?? null,
        playerName: input.playerName,
        team: teamCode,
        position: input.position ?? null,
        playerResearchHref: buildPlayerResearchHref(input, workspace.season),
        modules: {
          breakoutSignals: false,
          roleOpportunity: false,
          ageCurves: false,
          pointScenarios: false,
        },
        primaryRole: null,
        targetShare: null,
        routeParticipation: null,
        snapShare: null,
        usageRate: null,
        breakoutSignalScore: null,
        breakoutLabel: null,
        breakoutRank: null,
        trajectoryLabel: null,
        ageCurveScore: null,
        ppgDelta: null,
        scenarioDelta: null,
        scenarioCount: 0,
      };
      playerMap.set(key, next);
      return next;
    };

    teamRoleRows.forEach((row) => {
      const player = ensurePlayer(row);
      player.modules.roleOpportunity = true;
      player.primaryRole = row.primaryRole;
      player.targetShare = row.usage.targetShare;
      player.routeParticipation = row.usage.routeParticipation;
      player.snapShare = row.usage.snapShare;
      player.usageRate = row.usage.usageRate;
      player.position = player.position ?? row.position;
    });

    teamBreakoutRows.forEach((row) => {
      const player = ensurePlayer({ playerId: row.playerId, playerName: row.playerName, position: 'WR' });
      player.modules.breakoutSignals = true;
      player.breakoutSignalScore = row.finalSignalScore;
      player.breakoutLabel = row.breakoutLabelDefault;
      player.breakoutRank = row.candidateRank;
      player.position = player.position ?? 'WR';
    });

    teamAgeRows.forEach((row) => {
      const player = ensurePlayer(row);
      player.modules.ageCurves = true;
      player.trajectoryLabel = row.trajectoryLabel;
      player.ageCurveScore = row.ageCurveScore;
      player.ppgDelta = row.ppgDelta;
      player.position = player.position ?? row.position;
    });

    const scenarioGroups = new Map<string, typeof teamScenarioRows>();
    teamScenarioRows.forEach((row) => {
      const key = row.playerId?.trim() || normalizeToken(row.playerName);
      const rows = scenarioGroups.get(key) ?? [];
      rows.push(row);
      scenarioGroups.set(key, rows);
    });
    scenarioGroups.forEach((rows) => {
      const best = [...rows].sort((left, right) => (right.delta ?? Number.NEGATIVE_INFINITY) - (left.delta ?? Number.NEGATIVE_INFINITY))[0];
      const player = ensurePlayer(best);
      player.modules.pointScenarios = true;
      player.scenarioDelta = best.delta;
      player.scenarioCount = rows.length;
      player.position = player.position ?? best.position;
    });

    const keyPlayers = [...playerMap.values()].sort((left, right) => {
      const moduleDelta = Object.values(right.modules).filter(Boolean).length - Object.values(left.modules).filter(Boolean).length;
      if (moduleDelta !== 0) {
        return moduleDelta;
      }
      return (
        (right.targetShare ?? Number.NEGATIVE_INFINITY) - (left.targetShare ?? Number.NEGATIVE_INFINITY) ||
        (right.breakoutSignalScore ?? Number.NEGATIVE_INFINITY) - (left.breakoutSignalScore ?? Number.NEGATIVE_INFINITY) ||
        (right.scenarioDelta ?? Number.NEGATIVE_INFINITY) - (left.scenarioDelta ?? Number.NEGATIVE_INFINITY) ||
        left.playerName.localeCompare(right.playerName)
      );
    });

    workspace.keyPlayers = keyPlayers;

    if (teamRoleRows.length > 0) {
      workspace.sections.offensiveContext.state = 'ready';
      workspace.sections.offensiveContext.summary = {
        team: teamCode,
        teamName: workspace.selectedTeam.teamName,
        promotedPlayerCount: keyPlayers.length,
        positionsCovered: [...new Set(keyPlayers.map((player) => player.position).filter((value): value is string => Boolean(value)))],
        breakoutCandidateCount: teamBreakoutRows.length,
        rolePlayerCount: teamRoleRows.length,
        ageCurvePlayerCount: teamAgeRows.length,
        scenarioPlayerCount: scenarioGroups.size,
        avgTargetShare: average(teamRoleRows.map((row) => row.usage.targetShare)),
        avgRouteParticipation: average(teamRoleRows.map((row) => row.usage.routeParticipation)),
        avgSnapShare: average(teamRoleRows.map((row) => row.usage.snapShare)),
        avgUsageRate: average(teamRoleRows.map((row) => row.usage.usageRate)),
        topPlayers: keyPlayers.slice(0, 4).map((player) => player.playerName),
        notes: [
          `${teamRoleRows.length} promoted role/opportunity players found for ${workspace.selectedTeam.teamName}.`,
          teamBreakoutRows.length > 0 ? `${teamBreakoutRows.length} breakout-signals row(s) are available for this roster.` : 'No breakout-signal rows are currently available for this roster.',
          scenarioGroups.size > 0 ? `${scenarioGroups.size} player(s) have promoted scenario coverage for this team.` : 'No promoted scenario coverage is currently available for this roster.',
        ],
      };
      workspace.sections.offensiveContext.message = 'Promoted team context assembled from the available read-only model surfaces.';
    } else if (roleResult.ok) {
      workspace.sections.offensiveContext.state = 'not_available';
      workspace.sections.offensiveContext.message = 'No promoted team-level offensive context is available because this roster has no matching Role & Opportunity rows in the selected season.';
    } else {
      workspace.sections.offensiveContext.state = 'error';
      workspace.sections.offensiveContext.message = roleResult.error.message;
      workspace.sections.offensiveContext.error = { code: roleResult.error.code, message: roleResult.error.message };
    }

    if (teamRoleRows.length > 0) {
      workspace.sections.roleOpportunity.state = 'ready';
      workspace.sections.roleOpportunity.summary = {
        playerCount: teamRoleRows.length,
        avgTargetShare: average(teamRoleRows.map((row) => row.usage.targetShare)),
        avgRouteParticipation: average(teamRoleRows.map((row) => row.usage.routeParticipation)),
        avgSnapShare: average(teamRoleRows.map((row) => row.usage.snapShare)),
        avgUsageRate: average(teamRoleRows.map((row) => row.usage.usageRate)),
        keyPlayers: keyPlayers.filter((player) => player.modules.roleOpportunity).slice(0, 8),
        source: roleResult.ok ? roleResult.data.source : { provider: null, location: null, mode: null },
      };
      workspace.sections.roleOpportunity.message = 'Promoted role and opportunity rows found for this team.';
    } else if (roleResult.ok) {
      workspace.sections.roleOpportunity.state = 'not_available';
      workspace.sections.roleOpportunity.message = 'No promoted role and opportunity rows are available for this team in the selected season.';
    } else {
      workspace.sections.roleOpportunity.state = 'error';
      workspace.sections.roleOpportunity.message = roleResult.error.message;
      workspace.sections.roleOpportunity.error = { code: roleResult.error.code, message: roleResult.error.message };
    }

    if (teamBreakoutRows.length > 0) {
      workspace.sections.breakoutSignals.state = 'ready';
      workspace.sections.breakoutSignals.summary = {
        candidateCount: teamBreakoutRows.length,
        topSignalScore: teamBreakoutRows[0]?.finalSignalScore ?? null,
        bestRecipeName: breakoutResult.ok ? breakoutResult.data.bestRecipeSummary.bestRecipeName : null,
        players: keyPlayers.filter((player) => player.modules.breakoutSignals).slice(0, 8),
        source: breakoutResult.ok ? breakoutResult.data.source : null,
        rawRows: teamBreakoutRows,
      };
      workspace.sections.breakoutSignals.message = 'Promoted breakout outputs found for this roster.';
    } else if (breakoutResult.ok) {
      workspace.sections.breakoutSignals.state = 'not_available';
      workspace.sections.breakoutSignals.message = 'No promoted breakout outputs are available for this team in the selected season.';
    } else {
      workspace.sections.breakoutSignals.state = 'error';
      workspace.sections.breakoutSignals.message = breakoutResult.error.message;
      workspace.sections.breakoutSignals.error = { code: breakoutResult.error.code, message: breakoutResult.error.message };
    }

    if (teamScenarioRows.length > 0) {
      const scenarioPlayers = keyPlayers.filter((player) => player.modules.pointScenarios).slice(0, 8);
      workspace.sections.pointScenarios.state = 'ready';
      workspace.sections.pointScenarios.summary = {
        playerCount: scenarioGroups.size,
        totalScenarioCount: teamScenarioRows.length,
        maxDelta: average(scenarioPlayers.map((player) => player.scenarioDelta)) ?? scenarioPlayers[0]?.scenarioDelta ?? null,
        players: scenarioPlayers,
        source: scenarioResult.ok ? scenarioResult.data.source : { provider: null, location: null, mode: null },
        rawRows: teamScenarioRows,
      };
      workspace.sections.pointScenarios.message = 'Promoted scenario outputs found for this roster.';
    } else if (scenarioResult.ok) {
      workspace.sections.pointScenarios.state = 'not_available';
      workspace.sections.pointScenarios.message = 'No promoted point-scenario outputs are available for this team in the selected season.';
    } else {
      workspace.sections.pointScenarios.state = 'error';
      workspace.sections.pointScenarios.message = scenarioResult.error.message;
      workspace.sections.pointScenarios.error = { code: scenarioResult.error.code, message: scenarioResult.error.message };
    }

    if (teamAgeRows.length > 0) {
      workspace.sections.ageCurves.state = 'ready';
      workspace.sections.ageCurves.summary = {
        playerCount: teamAgeRows.length,
        players: keyPlayers.filter((player) => player.modules.ageCurves).slice(0, 8),
        source: ageResult.ok ? ageResult.data.source : { provider: null, location: null, mode: null },
        rawRows: teamAgeRows,
      };
      workspace.sections.ageCurves.message = 'Promoted ARC outputs found for this roster.';
    } else if (ageResult.ok) {
      workspace.sections.ageCurves.state = 'not_available';
      workspace.sections.ageCurves.message = 'No promoted ARC outputs are available for this team in the selected season.';
    } else {
      workspace.sections.ageCurves.state = 'error';
      workspace.sections.ageCurves.message = ageResult.error.message;
      workspace.sections.ageCurves.error = { code: ageResult.error.code, message: ageResult.error.message };
    }

    const sectionStates = Object.values(workspace.sections).map((section) => section.state);
    const readyCount = sectionStates.filter((state) => state === 'ready').length;
    const errorCount = sectionStates.filter((state) => state === 'error').length;
    const hasDatasetError = !breakoutResult.ok || !roleResult.ok || !ageResult.ok || !scenarioResult.ok;

    if (readyCount === 0 && errorCount > 0) {
      workspace.state = 'error';
    } else if (readyCount === 0) {
      workspace.state = 'empty';
    } else if (hasDatasetError || sectionStates.some((state) => state === 'not_available')) {
      workspace.state = 'partial';
    } else {
      workspace.state = 'ready';
    }

    workspace.warnings = workspace.warnings.map((warning) => `${warning} Team Research remains read only for ${workspace.selectedTeam!.teamName}.`);

    return workspace;
  }
}

export const teamResearchService = new TeamResearchService();
