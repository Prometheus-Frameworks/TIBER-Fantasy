import {
  TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME,
  TeamEnvironmentMovementArtifactV0,
  TeamEnvironmentMovementClient,
  TeamEnvironmentMovementEntry,
  TeamEnvironmentMovementIntegrationError,
} from './teamEnvironmentMovementClient';

export type TeamEnvironmentMovementState = 'ready' | 'unavailable' | 'error';

export interface TeamEnvironmentMovementResponse {
  artifact: typeof TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME;
  artifactAvailable: boolean;
  state: TeamEnvironmentMovementState;
  generatedAt: string | null;
  provenanceStatus: string | null;
  inputSources: unknown[];
  coverage: TeamEnvironmentMovementArtifactV0['coverage'] | null;
  teams: TeamEnvironmentMovementEntry[];
  selectedTeam: TeamEnvironmentMovementEntry | null;
  warnings: string[];
  errors: Array<{ code: string; message: string }>;
  source: {
    provider: 'tiber-teamstate';
    mode: 'artifact';
    artifactPath: string;
    readOnly: true;
  };
}

function conservativeWarnings(artifact: TeamEnvironmentMovementArtifactV0 | null, selectedTeam: TeamEnvironmentMovementEntry | null): string[] {
  const warnings = new Set<string>();

  if (artifact?.metadata.provenanceStatus === 'fixture_scaffold') {
    warnings.add('fixture/synthetic Teamstate movement artifact; do not treat as governed production truth');
  }

  for (const warning of selectedTeam?.warnings ?? []) warnings.add(warning);

  return Array.from(warnings);
}

export class TeamEnvironmentMovementService {
  constructor(private readonly client = new TeamEnvironmentMovementClient()) {}

  async getMovement(teamAbbr?: string): Promise<TeamEnvironmentMovementResponse> {
    const config = this.client.getConfig();

    try {
      const artifact = await this.client.readArtifact();
      if (!artifact) {
        return {
          artifact: TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME,
          artifactAvailable: false,
          state: 'unavailable',
          generatedAt: null,
          provenanceStatus: null,
          inputSources: [],
          coverage: null,
          teams: [],
          selectedTeam: null,
          warnings: ['Team Environment Movement artifact is not available; no movement context was fabricated.'],
          errors: [{ code: 'TEAM_ENVIRONMENT_MOVEMENT_NOT_FOUND', message: 'Configured Team Environment Movement artifact was not found.' }],
          source: { provider: 'tiber-teamstate', mode: 'artifact', artifactPath: config.artifactPath, readOnly: true },
        };
      }

      const selectedTeam = teamAbbr
        ? artifact.movements.find((entry) => entry.team.toUpperCase() === teamAbbr.trim().toUpperCase()) ?? null
        : null;

      const warnings = conservativeWarnings(artifact, selectedTeam);
      if (teamAbbr && !selectedTeam) {
        warnings.push(`No Team Environment Movement entry found for ${teamAbbr.trim().toUpperCase()}.`);
      }

      return {
        artifact: TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME,
        artifactAvailable: true,
        state: 'ready',
        generatedAt: artifact.generatedAt,
        provenanceStatus: artifact.metadata.provenanceStatus,
        inputSources: artifact.metadata.inputSources,
        coverage: artifact.coverage,
        teams: teamAbbr ? [] : artifact.movements,
        selectedTeam,
        warnings,
        errors: [],
        source: { provider: 'tiber-teamstate', mode: 'artifact', artifactPath: config.artifactPath, readOnly: true },
      };
    } catch (error) {
      if (error instanceof TeamEnvironmentMovementIntegrationError) {
        return {
          artifact: TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME,
          artifactAvailable: false,
          state: 'error',
          generatedAt: null,
          provenanceStatus: null,
          inputSources: [],
          coverage: null,
          teams: [],
          selectedTeam: null,
          warnings: ['Team Environment Movement artifact could not be trusted; no movement context was fabricated.'],
          errors: [{ code: error.code, message: error.message }],
          source: { provider: 'tiber-teamstate', mode: 'artifact', artifactPath: config.artifactPath, readOnly: true },
        };
      }

      return {
        artifact: TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME,
        artifactAvailable: false,
        state: 'error',
        generatedAt: null,
        provenanceStatus: null,
        inputSources: [],
        coverage: null,
        teams: [],
        selectedTeam: null,
        warnings: ['Unexpected Team Environment Movement consumer failure; no movement context was fabricated.'],
        errors: [{ code: 'TEAM_ENVIRONMENT_MOVEMENT_UNAVAILABLE', message: 'Unexpected Team Environment Movement consumer failure.' }],
        source: { provider: 'tiber-teamstate', mode: 'artifact', artifactPath: config.artifactPath, readOnly: true },
      };
    }
  }
}

export const teamEnvironmentMovementService = new TeamEnvironmentMovementService();
