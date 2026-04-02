export const TEAM_STATE_ARTIFACT_NAME = 'tiber_team_state_v0_1' as const;

export type TeamStateErrorCode = 'config_error' | 'not_found' | 'invalid_payload' | 'upstream_unavailable';

export class TeamStateIntegrationError extends Error {
  readonly code: TeamStateErrorCode;
  readonly status: number;
  readonly cause?: unknown;

  constructor(code: TeamStateErrorCode, message: string, status: number, cause?: unknown) {
    super(message);
    this.name = 'TeamStateIntegrationError';
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

export interface TeamStateClientConfig {
  exportsDir?: string;
  enabled?: boolean;
}

export interface TeamStateArtifactQuery {
  season: number;
  throughWeek?: number;
}

export interface TeamStateArtifactResult {
  season: number;
  throughWeek: number | null;
  data: unknown;
}
