export type TiberIdentityCrosswalkArtifactState =
  | 'available'
  | 'missing'
  | 'malformed'
  | 'duplicate_ids'
  | 'unsupported'
  | 'disabled';

export interface TiberIdentityCrosswalkProviderMapping {
  provider: string;
  providerId: string;
  providerCanonicalId: string;
  tiberPlayerId: string;
  playerName: string | null;
  position: string | null;
  raw: Record<string, unknown>;
}

export interface TiberIdentityCrosswalkLookup {
  artifact: {
    state: TiberIdentityCrosswalkArtifactState;
    available: boolean;
    reason: string | null;
    code: string | null;
    sourcePath: string;
    artifactId: 'TIBER_IDENTITY_CROSSWALK_V1';
    contractVersion: string | null;
    generatedAt: string | null;
    rowCount: number;
    providerMappingCount: number;
    providerCount: number;
  };
  rows: TiberIdentityCrosswalkProviderMapping[];
  tiberPlayerIdsByProviderKey: Map<string, string>;
}

export type TiberIdentityCrosswalkIntegrationErrorCode =
  | 'not_found'
  | 'invalid_payload'
  | 'duplicate_ids'
  | 'unsupported'
  | 'config_error'
  | 'upstream_unavailable';

export class TiberIdentityCrosswalkIntegrationError extends Error {
  readonly code: TiberIdentityCrosswalkIntegrationErrorCode;
  readonly status: number;
  readonly state: TiberIdentityCrosswalkArtifactState;
  readonly cause?: unknown;

  constructor(
    code: TiberIdentityCrosswalkIntegrationErrorCode,
    message: string,
    status: number,
    state: TiberIdentityCrosswalkArtifactState,
    cause?: unknown,
  ) {
    super(message);
    this.name = 'TiberIdentityCrosswalkIntegrationError';
    this.code = code;
    this.status = status;
    this.state = state;
    this.cause = cause;
  }
}
