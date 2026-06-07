export type ForgePlayerStaticScoreSource =
  | 'player_specific'
  | 'generated_baseline'
  | 'fallback_default'
  | 'unknown';

export type ForgePlayerStaticArtifactState =
  | 'available'
  | 'missing'
  | 'malformed'
  | 'duplicate_ids'
  | 'unsupported'
  | 'disabled';

export interface ForgePlayerStaticRow {
  playerId: string;
  playerName: string | null;
  position: string | null;
  team: string | null;
  alpha: number | null;
  tier: number | string | null;
  confidence: number | null;
  scoreSource: ForgePlayerStaticScoreSource;
  isPlayerSpecificEvidence: boolean;
  isGeneratedBaselineVisibility: boolean;
  provenance: Record<string, unknown>;
  raw: Record<string, unknown>;
}

export interface ForgePlayerStaticLookup {
  artifact: {
    state: ForgePlayerStaticArtifactState;
    available: boolean;
    reason: string | null;
    code: string | null;
    sourcePath: string;
    artifactId: 'FORGE_PLAYER_STATIC_V1';
    contractVersion: string | null;
    generatedAt: string | null;
    rowCount: number;
    playerSpecificCount: number;
    generatedBaselineCount: number;
    nonEvidenceCount: number;
  };
  rowsByPlayerId: Map<string, ForgePlayerStaticRow>;
}

export type ForgePlayerStaticIntegrationErrorCode =
  | 'not_found'
  | 'invalid_payload'
  | 'duplicate_ids'
  | 'unsupported'
  | 'config_error'
  | 'upstream_unavailable';

export class ForgePlayerStaticIntegrationError extends Error {
  readonly code: ForgePlayerStaticIntegrationErrorCode;
  readonly status: number;
  readonly state: ForgePlayerStaticArtifactState;
  readonly cause?: unknown;

  constructor(
    code: ForgePlayerStaticIntegrationErrorCode,
    message: string,
    status: number,
    state: ForgePlayerStaticArtifactState,
    cause?: unknown,
  ) {
    super(message);
    this.name = 'ForgePlayerStaticIntegrationError';
    this.code = code;
    this.status = status;
    this.state = state;
    this.cause = cause;
  }
}
