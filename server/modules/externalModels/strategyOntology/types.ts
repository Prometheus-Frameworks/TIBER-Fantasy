export type StrategyOntologyArtifactState =
  | 'available'
  | 'missing'
  | 'malformed'
  | 'unsupported'
  | 'disabled';

export type StrategyOntologySafetyRule =
  | 'cannot_override_identity'
  | 'cannot_override_team_assignment'
  | 'cannot_override_forge_evidence'
  | 'cannot_count_generated_baselines_as_evidence'
  | 'cannot_create_projections'
  | 'cannot_assign_player_labels_itself'
  | 'cannot_consume_operator_notes_as_evidence'
  | 'cannot_replace_human_decision';

export const REQUIRED_STRATEGY_ONTOLOGY_SAFETY_RULES: readonly StrategyOntologySafetyRule[] = [
  'cannot_override_identity',
  'cannot_override_team_assignment',
  'cannot_override_forge_evidence',
  'cannot_count_generated_baselines_as_evidence',
  'cannot_create_projections',
  'cannot_assign_player_labels_itself',
  'cannot_consume_operator_notes_as_evidence',
  'cannot_replace_human_decision',
] as const;

export interface StrategyOntologyDiagnostics {
  state: StrategyOntologyArtifactState;
  available: boolean;
  reason: string | null;
  code: StrategyOntologyIntegrationErrorCode | null;
  sourcePath: string;
  artifactId: 'DYNASTY_STRATEGY_ONTOLOGY_V1';
  artifactType: 'DYNASTY_STRATEGY_ONTOLOGY_V1' | null;
  contractVersion: string | null;
  rowCount: number | null;
  concepts: number;
  playerAssetArchetypes: number;
  rosterStateDefinitions: number;
  timelineRules: number;
  explanationTemplates: number;
  futureContractInputs: string[];
  safetyRules: string[];
  archetypeAssignmentEnabled: false;
  templateSelectionEnabled: false;
}

export interface StrategyOntologyLookup {
  artifact: StrategyOntologyDiagnostics;
  raw: Record<string, unknown> | null;
}

export type StrategyOntologyIntegrationErrorCode =
  | 'not_found'
  | 'invalid_payload'
  | 'unsupported'
  | 'config_error'
  | 'upstream_unavailable';

export class StrategyOntologyIntegrationError extends Error {
  readonly code: StrategyOntologyIntegrationErrorCode;
  readonly status: number;
  readonly state: StrategyOntologyArtifactState;
  readonly cause?: unknown;

  constructor(
    code: StrategyOntologyIntegrationErrorCode,
    message: string,
    status: number,
    state: StrategyOntologyArtifactState,
    cause?: unknown,
  ) {
    super(message);
    this.name = 'StrategyOntologyIntegrationError';
    this.code = code;
    this.status = status;
    this.state = state;
    this.cause = cause;
  }
}
