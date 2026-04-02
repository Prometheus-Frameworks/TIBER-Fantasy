import { TeamStateClient } from './teamStateClient';
import { TEAM_STATE_ARTIFACT_NAME, TeamStateArtifactResult, TeamStateIntegrationError } from './types';

export class TeamStateService {
  constructor(private readonly client: TeamStateClient = new TeamStateClient()) {}

  getStatus() {
    const config = this.client.getConfig();
    return {
      ...config,
      readiness: config.enabled && config.configured ? 'ready' : 'not_ready',
    };
  }

  async getTeamState(season: number, throughWeek?: number): Promise<TeamStateArtifactResult> {
    try {
      return await this.client.readTeamStateArtifact({ season, throughWeek });
    } catch (error) {
      if (error instanceof TeamStateIntegrationError) {
        throw error;
      }

      throw new TeamStateIntegrationError('upstream_unavailable', `${TEAM_STATE_ARTIFACT_NAME} integration failed unexpectedly.`, 503, error);
    }
  }
}

export const teamStateService = new TeamStateService();
