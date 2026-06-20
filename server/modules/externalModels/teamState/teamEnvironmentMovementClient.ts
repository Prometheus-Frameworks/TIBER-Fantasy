import { promises as fs, existsSync } from 'fs';
import path from 'path';

export const TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME_V0 = 'team_environment_movement_v0' as const;
export const TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME_V1 = 'team_environment_movement_v1' as const;

export type TeamEnvironmentMovementArtifactName =
  | typeof TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME_V0
  | typeof TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME_V1;

/**
 * Accepted artifact literals, in preference order. v1 is the team-state-only successor that drops
 * the legacy fantasy-point fields (fantasyPointsForQB/RB/WR/TE); v0 is retained for the transition
 * period because the v1 artifact is not yet the committed representative fixture in TIBER-Teamstate.
 * TIBER-Fantasy never read the fantasy-point fields, so consuming either literal is functionally
 * identical for this read-only inspection boundary. See TIBER-Teamstate issue #34.
 */
export const TEAM_ENVIRONMENT_MOVEMENT_ACCEPTED_ARTIFACT_NAMES = [
  TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME_V1,
  TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME_V0,
] as const;

/** Preferred/canonical artifact literal used when no artifact has been parsed (e.g. unavailable/error states). */
export const TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME = TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME_V1;

const TEAMSTATE_OUTPUT_DIR = path.join(process.cwd(), '..', 'TIBER-Teamstate', 'output');
const DEFAULT_TEAM_ENVIRONMENT_MOVEMENT_PATH_V1 = path.join(TEAMSTATE_OUTPUT_DIR, 'team_environment_movement_v1.json');
const DEFAULT_TEAM_ENVIRONMENT_MOVEMENT_PATH_V0 = path.join(TEAMSTATE_OUTPUT_DIR, 'team_environment_movement_v0.json');

/**
 * Resolve the default movement artifact path. Prefer the team-state-only v1 artifact once it is
 * present on disk, otherwise fall back to v0 so the consumer keeps working before TIBER-Teamstate
 * commits the v1 representative fixture. An explicit TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_PATH env
 * override always wins. This is intentionally a path-resolution choice only: a missing artifact
 * still fails closed via the unavailable state, never fabricating movement context.
 */
function resolveDefaultTeamEnvironmentMovementPath(): string {
  if (existsSync(DEFAULT_TEAM_ENVIRONMENT_MOVEMENT_PATH_V1)) return DEFAULT_TEAM_ENVIRONMENT_MOVEMENT_PATH_V1;
  return DEFAULT_TEAM_ENVIRONMENT_MOVEMENT_PATH_V0;
}

export type TeamEnvironmentMovementErrorCode = 'not_found' | 'invalid_payload' | 'upstream_unavailable';

export class TeamEnvironmentMovementIntegrationError extends Error {
  readonly code: TeamEnvironmentMovementErrorCode;
  readonly status: number;
  readonly cause?: unknown;

  constructor(code: TeamEnvironmentMovementErrorCode, message: string, status: number, cause?: unknown) {
    super(message);
    this.name = 'TeamEnvironmentMovementIntegrationError';
    this.code = code;
    this.status = status;
    this.cause = cause;
  }
}

export interface TeamEnvironmentMovementMetadata {
  provenanceStatus: string | null;
  inputSources: unknown[];
  coverage?: unknown;
  [key: string]: unknown;
}

/**
 * Producer-owned governance block on team_environment_movement_v1 (TIBER-Teamstate
 * PR #41). Read-only passthrough — TIBER-Fantasy never authors or infers these.
 * A `/promoted/` path is explicitly only a weak hint; this explicit block is what
 * Fantasy's promotion gate consumes.
 */
export interface TeamEnvironmentMovementGovernance {
  governanceStatus: string | null;
  governanceSource: string | null;
  contractVersion: string | null;
  generatedAt: string | null;
  promotedAt: string | null;
  promotionNotes: string | null;
}

export interface TeamEnvironmentMovementCoverage {
  teams: string[];
  seasons: number[];
  weeks: number[];
  latestWeek: number | null;
  isFullLeague: boolean | null;
  [key: string]: unknown;
}

export interface TeamEnvironmentMovementEntry {
  team: string;
  teamId: string | null;
  teamAbbr: string;
  season: number | null;
  weeksCovered: number[];
  earlyWindow: Record<string, unknown> | null;
  lateWindow: Record<string, unknown> | null;
  deltas: Record<string, unknown> | null;
  offenseDirection: string | null;
  pressureDirection: string | null;
  passEnvironmentDirection: string | null;
  paceDirection: string | null;
  volatilityDirection: string | null;
  verdict: string | null;
  warnings: string[];
  raw: Record<string, unknown>;
}

export interface TeamEnvironmentMovementArtifact {
  artifact: TeamEnvironmentMovementArtifactName;
  generatedAt: string | null;
  metadata: TeamEnvironmentMovementMetadata;
  coverage: TeamEnvironmentMovementCoverage;
  movements: TeamEnvironmentMovementEntry[];
  /** Producer-owned governance block when present (v1); null when absent/malformed. */
  governance: TeamEnvironmentMovementGovernance | null;
}

/** @deprecated Use {@link TeamEnvironmentMovementArtifact}. Retained for back-compat; v0/v1 normalize to the same shape. */
export type TeamEnvironmentMovementArtifactV0 = TeamEnvironmentMovementArtifact;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === 'number' && Number.isFinite(item));
}

function asRecordOrNull(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function normalizeTeam(value: Record<string, unknown>): string | null {
  const candidate = value.teamAbbr ?? value.team ?? value.teamAbbreviation;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim().toUpperCase() : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * Normalize the producer-owned governance block. Read-only passthrough; missing
 * or malformed input yields null so the consumer fails closed (no governance is
 * ever fabricated). promotionNotes accepts a string or string[] (joined).
 */
function normalizeGovernance(value: unknown): TeamEnvironmentMovementGovernance | null {
  if (!isRecord(value)) return null;
  const promotionNotes = Array.isArray(value.promotionNotes)
    ? value.promotionNotes.filter((note): note is string => typeof note === 'string').join(' ') || null
    : stringOrNull(value.promotionNotes);
  return {
    governanceStatus: stringOrNull(value.governanceStatus),
    governanceSource: stringOrNull(value.governanceSource),
    contractVersion: stringOrNull(value.contractVersion),
    generatedAt: stringOrNull(value.generatedAt),
    promotedAt: stringOrNull(value.promotedAt),
    promotionNotes,
  };
}

function normalizeMovementEntry(value: unknown): TeamEnvironmentMovementEntry | null {
  if (!isRecord(value)) return null;

  const team = normalizeTeam(value);
  if (!team) return null;

  const movement = asRecordOrNull(value.movement) ?? value;

  return {
    team,
    teamId: stringOrNull(value.teamId),
    teamAbbr: team,
    season: typeof value.season === 'number' && Number.isFinite(value.season) ? value.season : null,
    weeksCovered: asNumberArray(value.weeksCovered),
    earlyWindow: asRecordOrNull(value.earlyWindow ?? value.early ?? value.baselineWindow),
    lateWindow: asRecordOrNull(value.lateWindow ?? value.late ?? value.currentWindow),
    deltas: asRecordOrNull(value.deltas ?? value.delta),
    offenseDirection: stringOrNull(movement.offenseDirection),
    pressureDirection: stringOrNull(movement.pressureDirection),
    passEnvironmentDirection: stringOrNull(movement.passEnvironmentDirection),
    paceDirection: stringOrNull(movement.paceDirection),
    volatilityDirection: stringOrNull(movement.volatilityDirection),
    verdict: stringOrNull(movement.verdict),
    warnings: asStringArray(value.warnings),
    raw: value,
  };
}

function getMovementArray(value: Record<string, unknown>): unknown[] | null {
  return Array.isArray(value.teams) ? value.teams : null;
}

function normalizeMetadata(value: unknown): TeamEnvironmentMovementMetadata {
  const metadata = isRecord(value) ? value : {};
  return {
    ...metadata,
    provenanceStatus: typeof metadata.provenanceStatus === 'string' ? metadata.provenanceStatus : null,
    inputSources: Array.isArray(metadata.inputSources) ? metadata.inputSources : [],
  };
}

function normalizeCoverage(value: unknown): TeamEnvironmentMovementCoverage {
  const coverage = isRecord(value) ? value : {};
  return {
    ...coverage,
    teams: asStringArray(coverage.teams).map((team) => team.toUpperCase()),
    seasons: asNumberArray(coverage.seasons),
    weeks: asNumberArray(coverage.weeks),
    latestWeek: typeof coverage.latestWeek === 'number' && Number.isFinite(coverage.latestWeek) ? coverage.latestWeek : null,
    isFullLeague: typeof coverage.isFullLeague === 'boolean' ? coverage.isFullLeague : null,
  };
}

function parseArtifactName(value: unknown): TeamEnvironmentMovementArtifactName | null {
  return TEAM_ENVIRONMENT_MOVEMENT_ACCEPTED_ARTIFACT_NAMES.find((name) => name === value) ?? null;
}

export function parseTeamEnvironmentMovementArtifact(raw: unknown): TeamEnvironmentMovementArtifact {
  if (!isRecord(raw)) {
    throw new TeamEnvironmentMovementIntegrationError('invalid_payload', 'Team Environment Movement artifact must be a JSON object.', 502);
  }

  const artifactName = parseArtifactName(raw.artifact);
  if (!artifactName) {
    throw new TeamEnvironmentMovementIntegrationError(
      'invalid_payload',
      'Team Environment Movement artifact literal mismatch; expected team_environment_movement_v1 or team_environment_movement_v0.',
      502,
    );
  }

  const movementArray = getMovementArray(raw);
  if (!movementArray) {
    throw new TeamEnvironmentMovementIntegrationError('invalid_payload', 'Team Environment Movement artifact must include a teams array.', 502);
  }

  const movements = movementArray.map(normalizeMovementEntry);
  if (movements.some((entry) => entry === null)) {
    throw new TeamEnvironmentMovementIntegrationError(
      'invalid_payload',
      'Team Environment Movement entries must include a team abbreviation.',
      502,
    );
  }

  return {
    artifact: artifactName,
    generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : null,
    metadata: normalizeMetadata(raw.metadata),
    coverage: normalizeCoverage(isRecord(raw.metadata) ? raw.metadata.coverage : null),
    movements: movements as TeamEnvironmentMovementEntry[],
    governance: normalizeGovernance(raw.governance),
  };
}

export class TeamEnvironmentMovementClient {
  constructor(
    private readonly artifactPath = process.env.TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_PATH ?? resolveDefaultTeamEnvironmentMovementPath(),
  ) {}

  getConfig() {
    return { artifactPath: this.artifactPath };
  }

  async readArtifact(): Promise<TeamEnvironmentMovementArtifact | null> {
    try {
      const raw = await fs.readFile(this.artifactPath, 'utf8');
      return parseTeamEnvironmentMovementArtifact(JSON.parse(raw) as unknown);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError?.code === 'ENOENT') return null;
      if (error instanceof TeamEnvironmentMovementIntegrationError) throw error;
      if (error instanceof SyntaxError) {
        throw new TeamEnvironmentMovementIntegrationError('invalid_payload', 'Team Environment Movement artifact is not valid JSON.', 502, error);
      }
      throw new TeamEnvironmentMovementIntegrationError('upstream_unavailable', 'Unable to read Team Environment Movement artifact.', 503, error);
    }
  }
}
