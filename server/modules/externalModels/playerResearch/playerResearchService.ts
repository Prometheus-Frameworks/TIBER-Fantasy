import { AgeCurveIntegrationError, TiberAgeCurveLab } from '../ageCurves/types';
import { AgeCurvesService, ageCurvesService } from '../ageCurves/ageCurvesService';
import { PointScenarioIntegrationError, TiberPointScenarioLab } from '../pointScenarios/types';
import { PointScenariosService, pointScenariosService } from '../pointScenarios/pointScenariosService';
import { RoleOpportunityIntegrationError, TiberRoleOpportunityLab } from '../roleOpportunity/types';
import { RoleOpportunityService, roleOpportunityService } from '../roleOpportunity/roleOpportunityService';
import { SignalValidationIntegrationError, TiberWrBreakoutLab } from '../signalValidation/types';
import { SignalValidationService, signalValidationService } from '../signalValidation/signalValidationService';
import {
  AgeCurveResearchSummary,
  BreakoutSignalsResearchSummary,
  PlayerResearchQuery,
  PlayerResearchResolvedPlayer,
  PlayerResearchSearchEntry,
  PlayerResearchSection,
  PlayerResearchWorkspace,
  PointScenarioResearchSummary,
  RoleOpportunityResearchSummary,
} from './types';

function normalizePlayerToken(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function buildPlayerResearchHref(player: { playerId?: string | null; playerName?: string | null }, season?: number | null): string {
  const params = new URLSearchParams();

  if (player.playerId) {
    params.set('playerId', player.playerId);
  }

  if (player.playerName) {
    params.set('playerName', player.playerName);
  }

  if (season != null) {
    params.set('season', String(season));
  }

  const query = params.toString();
  return query ? `/tiber-data-lab/player-research?${query}` : '/tiber-data-lab/player-research';
}

function buildModuleHref(
  path: string,
  player: { playerId?: string | null; playerName?: string | null },
  season?: number | null,
): string {
  const params = new URLSearchParams();

  if (player.playerId) {
    params.set('playerId', player.playerId);
  }

  if (player.playerName) {
    params.set('playerName', player.playerName);
  }

  if (season != null) {
    params.set('season', String(season));
  }

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function createBaseSection<TSummary>(
  title: string,
  description: string,
  linkHref: string,
  provenanceNote: string,
): PlayerResearchSection<TSummary> {
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

type BreakoutResult = { ok: true; data: TiberWrBreakoutLab } | { ok: false; error: SignalValidationIntegrationError };
type RoleResult = { ok: true; data: TiberRoleOpportunityLab } | { ok: false; error: RoleOpportunityIntegrationError };
type AgeResult = { ok: true; data: TiberAgeCurveLab } | { ok: false; error: AgeCurveIntegrationError };
type ScenarioResult = { ok: true; data: TiberPointScenarioLab } | { ok: false; error: PointScenarioIntegrationError };

interface PlayerResearchServiceDeps {
  signalValidation?: Pick<SignalValidationService, 'getWrBreakoutLab'>;
  roleOpportunity?: Pick<RoleOpportunityService, 'getRoleOpportunityLab'>;
  ageCurves?: Pick<AgeCurvesService, 'getAgeCurveLab'>;
  pointScenarios?: Pick<PointScenariosService, 'getPointScenarioLab'>;
}

export class PlayerResearchService {
  constructor(
    private readonly deps: PlayerResearchServiceDeps = {
      signalValidation: signalValidationService,
      roleOpportunity: roleOpportunityService,
      ageCurves: ageCurvesService,
      pointScenarios: pointScenariosService,
    },
  ) {}

  private async getBreakout(season?: number): Promise<BreakoutResult> {
    try {
      const data = await this.deps.signalValidation!.getWrBreakoutLab(season, { includeRawCanonical: false });
      return { ok: true, data };
    } catch (error) {
      if (error instanceof SignalValidationIntegrationError) {
        return { ok: false, error };
      }

      return { ok: false, error: new SignalValidationIntegrationError('upstream_unavailable', 'WR Breakout Lab integration failed unexpectedly.', 503, error) };
    }
  }

  private async getRoleOpportunity(season?: number): Promise<RoleResult> {
    try {
      const data = await this.deps.roleOpportunity!.getRoleOpportunityLab({ season }, { includeRawCanonical: false });
      return { ok: true, data };
    } catch (error) {
      if (error instanceof RoleOpportunityIntegrationError) {
        return { ok: false, error };
      }

      return { ok: false, error: new RoleOpportunityIntegrationError('upstream_unavailable', 'Role Opportunity Lab integration failed unexpectedly.', 503, error) };
    }
  }

  private async getAgeCurves(season?: number): Promise<AgeResult> {
    try {
      const data = await this.deps.ageCurves!.getAgeCurveLab({ season }, { includeRawCanonical: false });
      return { ok: true, data };
    } catch (error) {
      if (error instanceof AgeCurveIntegrationError) {
        return { ok: false, error };
      }

      return { ok: false, error: new AgeCurveIntegrationError('upstream_unavailable', 'Age Curve Lab integration failed unexpectedly.', 503, error) };
    }
  }

  private async getPointScenarios(season?: number): Promise<ScenarioResult> {
    try {
      const data = await this.deps.pointScenarios!.getPointScenarioLab({ season }, { includeRawCanonical: false });
      return { ok: true, data };
    } catch (error) {
      if (error instanceof PointScenarioIntegrationError) {
        return { ok: false, error };
      }

      return { ok: false, error: new PointScenarioIntegrationError('upstream_unavailable', 'Point Scenario Lab integration failed unexpectedly.', 503, error) };
    }
  }

  async getPlayerResearchWorkspace(query: PlayerResearchQuery = {}): Promise<PlayerResearchWorkspace> {
    const requestedPlayerId = query.playerId?.trim() || null;
    const requestedPlayerName = query.playerName?.trim() || null;

    const breakoutLink = buildModuleHref('/tiber-data-lab/breakout-signals', query, query.season ?? null);
    const roleLink = buildModuleHref('/tiber-data-lab/role-opportunity', query, query.season ?? null);
    const ageLink = buildModuleHref('/tiber-data-lab/age-curves', query, query.season ?? null);
    const scenarioLink = buildModuleHref('/tiber-data-lab/point-scenarios', query, query.season ?? null);

    const workspace: PlayerResearchWorkspace = {
      season: query.season ?? null,
      availableSeasons: [],
      state: 'idle',
      requestedPlayerId,
      requestedPlayerName,
      selectedPlayer: null,
      searchIndex: [],
      framing: {
        title: 'Player Research Workspace',
        description:
          'This player-centric research workspace aggregates promoted read-only outputs from Breakout Signals, Role & Opportunity, Age Curve / ARC, and Point Scenarios so you can inspect one player in one place.',
        provenanceNote:
          'TIBER-Fantasy is orchestrating and normalizing promoted model outputs here. It is not recomputing breakout, role, ARC, or point-scenario logic locally.',
      },
      warnings: [],
      sections: {
        breakoutSignals: createBaseSection<BreakoutSignalsResearchSummary>(
          'Breakout Signals summary',
          'Promoted breakout candidate context and top-level signal card fields.',
          breakoutLink,
          'Read-only summary of promoted Signal-Validation-Model output.',
        ),
        roleOpportunity: createBaseSection<RoleOpportunityResearchSummary>(
          'Role & Opportunity summary',
          'Promoted deployment and usage context for the selected player.',
          roleLink,
          'Read-only summary of promoted role/deployment output.',
        ),
        ageCurves: createBaseSection<AgeCurveResearchSummary>(
          'Age Curve / ARC summary',
          'Promoted developmental timing and expected-vs-actual context.',
          ageLink,
          'Read-only summary of promoted ARC output.',
        ),
        pointScenarios: createBaseSection<PointScenarioResearchSummary>(
          'Point Scenario summary',
          'Promoted baseline vs adjusted scenario outcomes for the selected player.',
          scenarioLink,
          'Read-only summary of promoted Point-prediction-Model output.',
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

    const searchEntries = new Map<string, PlayerResearchSearchEntry>();

    const upsertEntry = (entry: { playerId?: string | null; playerName: string; team?: string | null; position?: string | null }, moduleKey: keyof PlayerResearchSearchEntry['modules']) => {
      const key = entry.playerId?.trim() || `name:${normalizePlayerToken(entry.playerName)}`;
      if (!key || !entry.playerName.trim()) {
        return;
      }

      const existing = searchEntries.get(key);
      if (existing) {
        existing.modules[moduleKey] = true;
        existing.team = existing.team ?? entry.team ?? null;
        existing.position = existing.position ?? entry.position ?? null;
        if (!existing.playerId && entry.playerId) {
          existing.playerId = entry.playerId;
        }
        return;
      }

      searchEntries.set(key, {
        playerId: entry.playerId ?? null,
        playerName: entry.playerName,
        team: entry.team ?? null,
        position: entry.position ?? null,
        modules: {
          breakoutSignals: moduleKey === 'breakoutSignals',
          roleOpportunity: moduleKey === 'roleOpportunity',
          ageCurves: moduleKey === 'ageCurves',
          pointScenarios: moduleKey === 'pointScenarios',
        },
      });
    };

    if (breakoutResult.ok) {
      breakoutResult.data.rows.forEach((row) => upsertEntry({ playerId: row.playerId, playerName: row.playerName, team: row.team, position: 'WR' }, 'breakoutSignals'));
    } else {
      workspace.warnings.push(`Breakout Signals unavailable: ${breakoutResult.error.message}`);
    }

    if (roleResult.ok) {
      roleResult.data.rows.forEach((row) => upsertEntry(row, 'roleOpportunity'));
    } else {
      workspace.warnings.push(`Role & Opportunity unavailable: ${roleResult.error.message}`);
    }

    if (ageResult.ok) {
      ageResult.data.rows.forEach((row) => upsertEntry(row, 'ageCurves'));
    } else {
      workspace.warnings.push(`Age Curve / ARC unavailable: ${ageResult.error.message}`);
    }

    if (scenarioResult.ok) {
      scenarioResult.data.rows.forEach((row) => upsertEntry(row, 'pointScenarios'));
    } else {
      workspace.warnings.push(`Point Scenarios unavailable: ${scenarioResult.error.message}`);
    }

    workspace.searchIndex = [...searchEntries.values()].sort((left, right) => left.playerName.localeCompare(right.playerName));

    const resolveSelectedPlayer = (): PlayerResearchResolvedPlayer | null => {
      if (!requestedPlayerId && !requestedPlayerName) {
        return null;
      }

      if (requestedPlayerId) {
        const idMatch = workspace.searchIndex.find((entry) => entry.playerId === requestedPlayerId);
        if (idMatch) {
          return {
            playerId: idMatch.playerId,
            playerName: idMatch.playerName,
            team: idMatch.team,
            position: idMatch.position,
            matchStrategy: 'player_id',
          };
        }
      }

      if (requestedPlayerName) {
        const lowered = requestedPlayerName.toLowerCase();
        const exactMatch = workspace.searchIndex.find((entry) => entry.playerName.toLowerCase() === lowered);
        if (exactMatch) {
          return {
            playerId: exactMatch.playerId,
            playerName: exactMatch.playerName,
            team: exactMatch.team,
            position: exactMatch.position,
            matchStrategy: 'exact_name',
          };
        }

        const normalized = normalizePlayerToken(requestedPlayerName);
        const normalizedMatch = workspace.searchIndex.find((entry) => normalizePlayerToken(entry.playerName) === normalized);
        if (normalizedMatch) {
          return {
            playerId: normalizedMatch.playerId,
            playerName: normalizedMatch.playerName,
            team: normalizedMatch.team,
            position: normalizedMatch.position,
            matchStrategy: 'normalized_name',
          };
        }
      }

      return null;
    };

    workspace.selectedPlayer = resolveSelectedPlayer();

    const selectedPlayerLinkContext = workspace.selectedPlayer ?? query;
    workspace.sections.breakoutSignals.linkHref = buildModuleHref('/tiber-data-lab/breakout-signals', selectedPlayerLinkContext, workspace.season);
    workspace.sections.roleOpportunity.linkHref = buildModuleHref('/tiber-data-lab/role-opportunity', selectedPlayerLinkContext, workspace.season);
    workspace.sections.ageCurves.linkHref = buildModuleHref('/tiber-data-lab/age-curves', selectedPlayerLinkContext, workspace.season);
    workspace.sections.pointScenarios.linkHref = buildModuleHref('/tiber-data-lab/point-scenarios', selectedPlayerLinkContext, workspace.season);

    const hasAnySuccessfulDataset = breakoutResult.ok || roleResult.ok || ageResult.ok || scenarioResult.ok;
    const hasAnyDatasetError = !breakoutResult.ok || !roleResult.ok || !ageResult.ok || !scenarioResult.ok;

    if (!hasAnySuccessfulDataset) {
      workspace.state = 'error';
      workspace.sections.breakoutSignals.state = 'error';
      workspace.sections.breakoutSignals.message = breakoutResult.ok ? null : breakoutResult.error.message;
      workspace.sections.breakoutSignals.error = breakoutResult.ok ? null : { code: breakoutResult.error.code, message: breakoutResult.error.message };
      workspace.sections.roleOpportunity.state = 'error';
      workspace.sections.roleOpportunity.message = roleResult.ok ? null : roleResult.error.message;
      workspace.sections.roleOpportunity.error = roleResult.ok ? null : { code: roleResult.error.code, message: roleResult.error.message };
      workspace.sections.ageCurves.state = 'error';
      workspace.sections.ageCurves.message = ageResult.ok ? null : ageResult.error.message;
      workspace.sections.ageCurves.error = ageResult.ok ? null : { code: ageResult.error.code, message: ageResult.error.message };
      workspace.sections.pointScenarios.state = 'error';
      workspace.sections.pointScenarios.message = scenarioResult.ok ? null : scenarioResult.error.message;
      workspace.sections.pointScenarios.error = scenarioResult.ok ? null : { code: scenarioResult.error.code, message: scenarioResult.error.message };
      return workspace;
    }

    if (!workspace.selectedPlayer) {
      workspace.state = requestedPlayerId || requestedPlayerName ? 'empty' : 'idle';

      if (workspace.state === 'empty') {
        workspace.warnings.push('No promoted player match was found for the requested player query in the selected season.');
      }

      return workspace;
    }

    const selectedPlayerId = workspace.selectedPlayer.playerId;
    const selectedPlayerName = workspace.selectedPlayer.playerName;
    const selectedPlayerNameKey = normalizePlayerToken(selectedPlayerName);

    const playerMatch = <TRow extends { playerId?: string | null; playerName: string }>(row: TRow) => {
      if (selectedPlayerId && row.playerId) {
        return row.playerId === selectedPlayerId;
      }

      return normalizePlayerToken(row.playerName) === selectedPlayerNameKey;
    };

    if (breakoutResult.ok) {
      const row = breakoutResult.data.rows.find(playerMatch);
      if (row) {
        workspace.sections.breakoutSignals.state = 'ready';
        workspace.sections.breakoutSignals.summary = {
          candidateRank: row.candidateRank,
          finalSignalScore: row.finalSignalScore,
          bestRecipeName: row.bestRecipeName,
          breakoutLabel: row.breakoutLabelDefault,
          breakoutContext: row.breakoutContext,
          componentSummary: [
            { label: 'Usage', value: row.components.usage },
            { label: 'Efficiency', value: row.components.efficiency },
            { label: 'Development', value: row.components.development },
            { label: 'Stability', value: row.components.stability },
            { label: 'Cohort', value: row.components.cohort },
            { label: 'Role', value: row.components.role },
            { label: 'Penalty', value: row.components.penalty },
          ],
          source: breakoutResult.data.source,
          rawRow: row,
        };
        workspace.sections.breakoutSignals.message = 'Promoted breakout output found for this player.';
      } else {
        workspace.sections.breakoutSignals.state = 'not_available';
        workspace.sections.breakoutSignals.message = 'No promoted breakout output is available for this player in the selected season.';
      }
    } else {
      workspace.sections.breakoutSignals.state = 'error';
      workspace.sections.breakoutSignals.message = breakoutResult.error.message;
      workspace.sections.breakoutSignals.error = { code: breakoutResult.error.code, message: breakoutResult.error.message };
    }

    if (roleResult.ok) {
      const row = roleResult.data.rows.find(playerMatch);
      if (row) {
        workspace.sections.roleOpportunity.state = 'ready';
        workspace.sections.roleOpportunity.summary = {
          primaryRole: row.primaryRole,
          routeParticipation: row.usage.routeParticipation,
          targetShare: row.usage.targetShare,
          airYardShare: row.usage.airYardShare,
          snapShare: row.usage.snapShare,
          usageRate: row.usage.usageRate,
          confidenceScore: row.confidence.score,
          confidenceTier: row.confidence.tier,
          insights: row.insights,
          source: row.source,
          rawRow: row,
        };
        workspace.sections.roleOpportunity.message = 'Promoted role and opportunity output found for this player.';
      } else {
        workspace.sections.roleOpportunity.state = 'not_available';
        workspace.sections.roleOpportunity.message = 'No promoted role and opportunity output is available for this player in the selected season.';
      }
    } else {
      workspace.sections.roleOpportunity.state = 'error';
      workspace.sections.roleOpportunity.message = roleResult.error.message;
      workspace.sections.roleOpportunity.error = { code: roleResult.error.code, message: roleResult.error.message };
    }

    if (ageResult.ok) {
      const row = ageResult.data.rows.find(playerMatch);
      if (row) {
        workspace.sections.ageCurves.state = 'ready';
        workspace.sections.ageCurves.summary = {
          age: row.age,
          careerYear: row.careerYear,
          expectedPpg: row.expectedPpg,
          actualPpg: row.actualPpg,
          ppgDelta: row.ppgDelta,
          trajectoryLabel: row.trajectoryLabel,
          peerBucket: row.peerBucket,
          ageCurveScore: row.ageCurveScore,
          provenance: row.provenance,
          rawRow: row,
        };
        workspace.sections.ageCurves.message = 'Promoted ARC output found for this player.';
      } else {
        workspace.sections.ageCurves.state = 'not_available';
        workspace.sections.ageCurves.message = 'No promoted ARC output is available for this player in the selected season.';
      }
    } else {
      workspace.sections.ageCurves.state = 'error';
      workspace.sections.ageCurves.message = ageResult.error.message;
      workspace.sections.ageCurves.error = { code: ageResult.error.code, message: ageResult.error.message };
    }

    if (scenarioResult.ok) {
      const rows = scenarioResult.data.rows.filter(playerMatch);
      if (rows.length > 0) {
        const bestRow = [...rows].sort((left, right) => (right.delta ?? Number.NEGATIVE_INFINITY) - (left.delta ?? Number.NEGATIVE_INFINITY))[0];
        const notes = [...new Set(rows.flatMap((row) => row.notes))];
        workspace.sections.pointScenarios.state = 'ready';
        workspace.sections.pointScenarios.summary = {
          baselineProjection: bestRow.baselineProjection,
          adjustedProjection: bestRow.adjustedProjection,
          delta: bestRow.delta,
          confidenceBand: bestRow.confidence.band,
          confidenceLabel: bestRow.confidence.label,
          scenarioCount: rows.length,
          topScenarioNames: rows.slice(0, 3).map((row) => row.scenarioName),
          notes,
          source: bestRow.provenance,
          rawRows: rows,
        };
        workspace.sections.pointScenarios.message = 'Promoted scenario output found for this player.';
      } else {
        workspace.sections.pointScenarios.state = 'not_available';
        workspace.sections.pointScenarios.message = 'No promoted point-scenario output is available for this player in the selected season.';
      }
    } else {
      workspace.sections.pointScenarios.state = 'error';
      workspace.sections.pointScenarios.message = scenarioResult.error.message;
      workspace.sections.pointScenarios.error = { code: scenarioResult.error.code, message: scenarioResult.error.message };
    }

    const sectionStates = Object.values(workspace.sections).map((section) => section.state);
    const readyCount = sectionStates.filter((state) => state === 'ready').length;
    const errorCount = sectionStates.filter((state) => state === 'error').length;

    if (readyCount === 0 && errorCount > 0) {
      workspace.state = 'error';
    } else if (readyCount === 0) {
      workspace.state = 'empty';
    } else if (hasAnyDatasetError || sectionStates.some((state) => state === 'not_available')) {
      workspace.state = 'partial';
    } else {
      workspace.state = 'ready';
    }

    if (workspace.selectedPlayer) {
      workspace.warnings = workspace.warnings.map((warning) => `${warning} See ${buildPlayerResearchHref(workspace.selectedPlayer, workspace.season)} for this player-centric workspace.`);
    }

    return workspace;
  }
}

export const playerResearchService = new PlayerResearchService();
