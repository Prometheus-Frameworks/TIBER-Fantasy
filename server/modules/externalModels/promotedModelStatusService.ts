import { access } from 'fs/promises';
import { constants as fsConstants } from 'fs';
import { DataLabCommandCenterService, dataLabCommandCenterService } from './dataLabCommandCenter/service';
import { ageCurvesService, AgeCurvesService } from './ageCurves/ageCurvesService';
import { roleOpportunityService, RoleOpportunityService } from './roleOpportunity/roleOpportunityService';
import { signalValidationService, SignalValidationService } from './signalValidation/signalValidationService';
import { pointScenariosService, PointScenariosService } from './pointScenarios/pointScenariosService';
import { AgeCurveIntegrationError } from './ageCurves/types';
import { RoleOpportunityIntegrationError } from './roleOpportunity/types';
import { SignalValidationIntegrationError } from './signalValidation/types';
import { PointScenarioIntegrationError } from './pointScenarios/types';

export type PromotedOperationalState =
  | 'ready'
  | 'available_other_seasons'
  | 'missing_export_artifact'
  | 'upstream_unavailable'
  | 'disabled_by_env_config'
  | 'empty_dataset';

export interface PromotedModelStatusRow {
  moduleId: 'command-center' | 'player-research' | 'team-research' | 'breakout-signals' | 'role-opportunity' | 'age-curves' | 'point-scenarios';
  title: string;
  route: string;
  status: PromotedOperationalState;
  detail: string;
  availableSeasons: number[];
  readOnly: true;
  checks: string[];
}

interface PromotedModelStatusServiceDeps {
  signalValidation?: Pick<SignalValidationService, 'getStatus' | 'getWrBreakoutLab'>;
  roleOpportunity?: Pick<RoleOpportunityService, 'getStatus' | 'getRoleOpportunityLab'>;
  ageCurves?: Pick<AgeCurvesService, 'getStatus' | 'getAgeCurveLab'>;
  pointScenarios?: Pick<PointScenariosService, 'getStatus' | 'getPointScenarioLab'>;
  commandCenter?: Pick<DataLabCommandCenterService, 'getCommandCenter'>;
}

async function fileExists(candidate: string | undefined): Promise<boolean> {
  if (!candidate) {
    return false;
  }

  try {
    await access(candidate, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function mergeStatus(details: PromotedModelStatusRow[]): PromotedOperationalState {
  const statuses = new Set(details.map((detail) => detail.status));

  if (statuses.has('upstream_unavailable')) return 'upstream_unavailable';
  if (statuses.has('disabled_by_env_config')) return 'disabled_by_env_config';
  if (statuses.has('missing_export_artifact')) return 'missing_export_artifact';
  if (statuses.has('available_other_seasons')) return 'available_other_seasons';
  if (statuses.has('ready')) return 'ready';
  return 'empty_dataset';
}

export class PromotedModelStatusService {
  constructor(
    private readonly deps: PromotedModelStatusServiceDeps = {
      signalValidation: signalValidationService,
      roleOpportunity: roleOpportunityService,
      ageCurves: ageCurvesService,
      pointScenarios: pointScenariosService,
      commandCenter: dataLabCommandCenterService,
    },
  ) {}

  private async inspectBreakout(season?: number): Promise<PromotedModelStatusRow> {
    const status = this.deps.signalValidation!.getStatus();
    const checks = [
      `SIGNAL_VALIDATION_EXPORTS_ENABLED=${status.enabled ? '1' : '0'}`,
      `SIGNAL_VALIDATION_EXPORTS_DIR=${status.exportsDir}`,
      'expectedFiles=wr_player_signal_cards_{season}.csv,wr_best_recipe_summary.json',
    ];

    if (!status.enabled) {
      return {
        moduleId: 'breakout-signals',
        title: 'WR Breakout Lab',
        route: '/tiber-data-lab/breakout-signals',
        status: 'disabled_by_env_config',
        detail: 'Signal Validation exports are disabled by env/config.',
        availableSeasons: [],
        readOnly: true,
        checks,
      };
    }

    const exportsDirExists = await fileExists(status.exportsDir);
    checks.push(`exportsDirExists=${exportsDirExists ? 'yes' : 'no'}`);

    try {
      const data = await this.deps.signalValidation!.getWrBreakoutLab(season, { includeRawCanonical: false });
      const availableSeasons = data.availableSeasons ?? [];
      const hasDifferentSeasonData = season != null && !availableSeasons.includes(season) && availableSeasons.length > 0;
      return {
        moduleId: 'breakout-signals',
        title: 'WR Breakout Lab',
        route: '/tiber-data-lab/breakout-signals',
        status: data.rows.length > 0 ? 'ready' : hasDifferentSeasonData ? 'available_other_seasons' : 'empty_dataset',
        detail: data.rows.length > 0
          ? `Promoted breakout exports loaded with ${data.rows.length} rows.`
          : hasDifferentSeasonData
            ? `No promoted breakout rows for ${season}; healthy exports exist for ${availableSeasons.join(', ')}.`
          : 'Exports loaded but contain zero promoted breakout rows for this season.',
        availableSeasons,
        readOnly: true,
        checks,
      };
    } catch (error) {
      if (error instanceof SignalValidationIntegrationError) {
        if (error.code === 'config_error') {
          return {
            moduleId: 'breakout-signals',
            title: 'WR Breakout Lab',
            route: '/tiber-data-lab/breakout-signals',
            status: 'disabled_by_env_config',
            detail: error.message,
            availableSeasons: [],
            readOnly: true,
            checks,
          };
        }

        if (error.code === 'not_found') {
          return {
            moduleId: 'breakout-signals',
            title: 'WR Breakout Lab',
            route: '/tiber-data-lab/breakout-signals',
            status: 'missing_export_artifact',
            detail: error.message,
            availableSeasons: [],
            readOnly: true,
            checks,
          };
        }
      }

      return {
        moduleId: 'breakout-signals',
        title: 'WR Breakout Lab',
        route: '/tiber-data-lab/breakout-signals',
        status: 'upstream_unavailable',
        detail: error instanceof Error ? error.message : 'Breakout integration unavailable.',
        availableSeasons: [],
        readOnly: true,
        checks,
      };
    }
  }

  private async inspectRoleOpportunity(season?: number): Promise<PromotedModelStatusRow> {
    const status = this.deps.roleOpportunity!.getStatus();
    const checks = [
      `ROLE_OPPORTUNITY_MODEL_ENABLED=${status.enabled ? '1' : '0'}`,
      `ROLE_OPPORTUNITY_MODEL_BASE_URL=${status.baseUrl ?? '(none)'}`,
      `ROLE_OPPORTUNITY_EXPORTS_PATH=${status.exportsPath}`,
      'expectedArtifact=role_opportunity_lab.json',
    ];

    if (!status.enabled) {
      return {
        moduleId: 'role-opportunity',
        title: 'Role & Opportunity Lab',
        route: '/tiber-data-lab/role-opportunity',
        status: 'disabled_by_env_config',
        detail: 'Role & Opportunity integration is disabled by env/config.',
        availableSeasons: [],
        readOnly: true,
        checks,
      };
    }

    if (!status.baseUrl) {
      const artifactExists = await fileExists(status.exportsPath);
      checks.push(`artifactExists=${artifactExists ? 'yes' : 'no'}`);
    }

    try {
      const data = await this.deps.roleOpportunity!.getRoleOpportunityLab({ season }, { includeRawCanonical: false });
      const availableSeasons = data.availableSeasons ?? [];
      const hasDifferentSeasonData = season != null && !availableSeasons.includes(season) && availableSeasons.length > 0;
      return {
        moduleId: 'role-opportunity',
        title: 'Role & Opportunity Lab',
        route: '/tiber-data-lab/role-opportunity',
        status: data.rows.length > 0 ? 'ready' : hasDifferentSeasonData ? 'available_other_seasons' : 'empty_dataset',
        detail: data.rows.length > 0
          ? `Promoted role/opportunity dataset loaded with ${data.rows.length} rows.`
          : hasDifferentSeasonData
            ? `No promoted role/opportunity rows for ${season}; healthy rows exist for ${availableSeasons.join(', ')}.`
          : 'Role & Opportunity source responded but returned zero promoted rows for this season.',
        availableSeasons,
        readOnly: true,
        checks,
      };
    } catch (error) {
      if (error instanceof RoleOpportunityIntegrationError) {
        if (error.code === 'config_error') {
          return {
            moduleId: 'role-opportunity',
            title: 'Role & Opportunity Lab',
            route: '/tiber-data-lab/role-opportunity',
            status: 'disabled_by_env_config',
            detail: error.message,
            availableSeasons: [],
            readOnly: true,
            checks,
          };
        }

        if (error.code === 'not_found') {
          return {
            moduleId: 'role-opportunity',
            title: 'Role & Opportunity Lab',
            route: '/tiber-data-lab/role-opportunity',
            status: status.baseUrl ? 'empty_dataset' : 'missing_export_artifact',
            detail: error.message,
            availableSeasons: [],
            readOnly: true,
            checks,
          };
        }
      }

      return {
        moduleId: 'role-opportunity',
        title: 'Role & Opportunity Lab',
        route: '/tiber-data-lab/role-opportunity',
        status: 'upstream_unavailable',
        detail: error instanceof Error ? error.message : 'Role & Opportunity integration unavailable.',
        availableSeasons: [],
        readOnly: true,
        checks,
      };
    }
  }

  private async inspectAgeCurves(season?: number): Promise<PromotedModelStatusRow> {
    const status = this.deps.ageCurves!.getStatus();
    const checks = [
      `AGE_CURVE_MODEL_ENABLED=${status.enabled ? '1' : '0'}`,
      `AGE_CURVE_MODEL_BASE_URL=${status.baseUrl ?? '(none)'}`,
      `AGE_CURVE_PROMOTED_HANDOFF_PATH=${status.exportsPath}`,
      `AGE_CURVE_EXPORTS_PATH=${process.env.AGE_CURVE_EXPORTS_PATH ?? '(unset)'}`,
      'expectedArtifact=arc_promoted_handoff.json (legacy fallback: age_curve_lab.json)',
    ];

    if (!status.enabled) {
      return {
        moduleId: 'age-curves',
        title: 'Age Curve / ARC Lab',
        route: '/tiber-data-lab/age-curves',
        status: 'disabled_by_env_config',
        detail: 'Age Curve integration is disabled by env/config.',
        availableSeasons: [],
        readOnly: true,
        checks,
      };
    }

    if (!status.baseUrl) {
      const artifactExists = await fileExists(status.exportsPath);
      checks.push(`artifactExists=${artifactExists ? 'yes' : 'no'}`);
    }

    try {
      const data = await this.deps.ageCurves!.getAgeCurveLab({ season }, { includeRawCanonical: false });
      const availableSeasons = data.availableSeasons ?? [];
      const hasDifferentSeasonData = season != null && !availableSeasons.includes(season) && availableSeasons.length > 0;
      return {
        moduleId: 'age-curves',
        title: 'Age Curve / ARC Lab',
        route: '/tiber-data-lab/age-curves',
        status: data.rows.length > 0 ? 'ready' : hasDifferentSeasonData ? 'available_other_seasons' : 'empty_dataset',
        detail: data.rows.length > 0
          ? `Promoted ARC dataset loaded with ${data.rows.length} rows.`
          : hasDifferentSeasonData
            ? `No promoted ARC rows for ${season}; healthy rows exist for ${availableSeasons.join(', ')}.`
          : 'Age Curve source responded but returned zero promoted rows for this season.',
        availableSeasons,
        readOnly: true,
        checks,
      };
    } catch (error) {
      if (error instanceof AgeCurveIntegrationError) {
        if (error.code === 'config_error') {
          return {
            moduleId: 'age-curves',
            title: 'Age Curve / ARC Lab',
            route: '/tiber-data-lab/age-curves',
            status: 'disabled_by_env_config',
            detail: error.message,
            availableSeasons: [],
            readOnly: true,
            checks,
          };
        }

        if (error.code === 'not_found') {
          return {
            moduleId: 'age-curves',
            title: 'Age Curve / ARC Lab',
            route: '/tiber-data-lab/age-curves',
            status: status.baseUrl ? 'empty_dataset' : 'missing_export_artifact',
            detail: error.message,
            availableSeasons: [],
            readOnly: true,
            checks,
          };
        }
      }

      return {
        moduleId: 'age-curves',
        title: 'Age Curve / ARC Lab',
        route: '/tiber-data-lab/age-curves',
        status: 'upstream_unavailable',
        detail: error instanceof Error ? error.message : 'Age Curve integration unavailable.',
        availableSeasons: [],
        readOnly: true,
        checks,
      };
    }
  }

  private async inspectPointScenarios(season?: number): Promise<PromotedModelStatusRow> {
    const status = this.deps.pointScenarios!.getStatus();
    const checks = [
      `POINT_SCENARIO_MODEL_ENABLED=${status.enabled ? '1' : '0'}`,
      `baseUrl=${status.baseUrl ?? '(none)'}`,
      `exportsPath=${status.exportsPath}`,
    ];

    if (!status.enabled) {
      return {
        moduleId: 'point-scenarios',
        title: 'Point Scenario Lab',
        route: '/tiber-data-lab/point-scenarios',
        status: 'disabled_by_env_config',
        detail: 'Point Scenario integration is disabled by env/config.',
        availableSeasons: [],
        readOnly: true,
        checks,
      };
    }

    if (!status.baseUrl) {
      const artifactExists = await fileExists(status.exportsPath);
      checks.push(`artifactExists=${artifactExists ? 'yes' : 'no'}`);
    }

    try {
      const data = await this.deps.pointScenarios!.getPointScenarioLab({ season }, { includeRawCanonical: false });
      const availableSeasons = data.availableSeasons ?? [];
      const hasDifferentSeasonData = season != null && !availableSeasons.includes(season) && availableSeasons.length > 0;
      return {
        moduleId: 'point-scenarios',
        title: 'Point Scenario Lab',
        route: '/tiber-data-lab/point-scenarios',
        status: data.rows.length > 0 ? 'ready' : hasDifferentSeasonData ? 'available_other_seasons' : 'empty_dataset',
        detail: data.rows.length > 0
          ? `Promoted scenario dataset loaded with ${data.rows.length} rows.`
          : hasDifferentSeasonData
            ? `No promoted scenario rows for ${season}; healthy rows exist for ${availableSeasons.join(', ')}.`
          : 'Point Scenario source responded but returned zero promoted rows for this season.',
        availableSeasons,
        readOnly: true,
        checks,
      };
    } catch (error) {
      if (error instanceof PointScenarioIntegrationError) {
        if (error.code === 'config_error') {
          return {
            moduleId: 'point-scenarios',
            title: 'Point Scenario Lab',
            route: '/tiber-data-lab/point-scenarios',
            status: 'disabled_by_env_config',
            detail: error.message,
            availableSeasons: [],
            readOnly: true,
            checks,
          };
        }

        if (error.code === 'not_found') {
          return {
            moduleId: 'point-scenarios',
            title: 'Point Scenario Lab',
            route: '/tiber-data-lab/point-scenarios',
            status: status.baseUrl ? 'empty_dataset' : 'missing_export_artifact',
            detail: error.message,
            availableSeasons: [],
            readOnly: true,
            checks,
          };
        }
      }

      return {
        moduleId: 'point-scenarios',
        title: 'Point Scenario Lab',
        route: '/tiber-data-lab/point-scenarios',
        status: 'upstream_unavailable',
        detail: error instanceof Error ? error.message : 'Point Scenario integration unavailable.',
        availableSeasons: [],
        readOnly: true,
        checks,
      };
    }
  }

  async getStatusReport(options: { season?: number } = {}) {
    const breakout = await this.inspectBreakout(options.season);
    const role = await this.inspectRoleOpportunity(options.season);
    const age = await this.inspectAgeCurves(options.season);
    const point = await this.inspectPointScenarios(options.season);

    const coreStatuses = [breakout, role, age, point];
    const aggregateState = mergeStatus(coreStatuses);

    let commandCenterState: PromotedOperationalState = aggregateState;
    let commandCenterDetail = 'Command Center inherits promoted module readiness from the underlying adapters.';

    try {
      const workspace = await this.deps.commandCenter!.getCommandCenter({ season: options.season });
      if (workspace.state === 'ready' || workspace.state === 'partial') {
        commandCenterState = 'ready';
        commandCenterDetail = 'Command Center is operational and can synthesize promoted module outputs.';
      } else if (workspace.state === 'empty') {
        commandCenterState = 'empty_dataset';
        commandCenterDetail = 'Command Center is reachable but no promoted summaries are currently available.';
      } else {
        commandCenterState = 'upstream_unavailable';
        commandCenterDetail = 'Command Center is reachable, but upstream promoted modules are currently unavailable.';
      }
    } catch (error) {
      commandCenterState = 'upstream_unavailable';
      commandCenterDetail = error instanceof Error ? error.message : 'Command Center health check failed.';
    }

    const workspaceChecks = ['Derived from breakout/role/age/point promoted adapters.'];
    const knownAvailableSeasons = Array.from(new Set(coreStatuses.flatMap((status) => status.availableSeasons))).sort((a, b) => b - a);
    const playerResearchState = aggregateState === 'ready' ? 'ready' : aggregateState;
    const teamResearchState = aggregateState === 'ready' ? 'ready' : aggregateState;

    return {
      season: options.season ?? null,
      statuses: [
        {
          moduleId: 'command-center' as const,
          title: 'Data Lab Command Center',
          route: '/tiber-data-lab/command-center',
          status: commandCenterState,
          detail: commandCenterDetail,
          availableSeasons: knownAvailableSeasons,
          readOnly: true as const,
          checks: workspaceChecks,
        },
        {
          moduleId: 'player-research' as const,
          title: 'Player Research Workspace',
          route: '/tiber-data-lab/player-research',
          status: playerResearchState,
          detail: 'Player Research depends on promoted breakout/role/ARC/scenario adapters and remains read-only.',
          availableSeasons: knownAvailableSeasons,
          readOnly: true as const,
          checks: workspaceChecks,
        },
        {
          moduleId: 'team-research' as const,
          title: 'Team Research Workspace',
          route: '/tiber-data-lab/team-research',
          status: teamResearchState,
          detail: 'Team Research depends on promoted breakout/role/ARC/scenario adapters and remains read-only.',
          availableSeasons: knownAvailableSeasons,
          readOnly: true as const,
          checks: workspaceChecks,
        },
        ...coreStatuses,
      ],
    };
  }
}

export const promotedModelStatusService = new PromotedModelStatusService();
