import { promises as fs } from 'fs';
import path from 'path';

export const TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME = 'team_environment_movement_v0' as const;

const DEFAULT_TEAM_ENVIRONMENT_MOVEMENT_PATH = path.join(
  process.cwd(),
  '..',
  'TIBER-Teamstate',
  'output',
  'team_environment_movement_v0.json',
);

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
  [key: string]: unknown;
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
  season: number | null;
  earlyWindow: Record<string, unknown> | null;
  lateWindow: Record<string, unknown> | null;
  deltas: Record<string, unknown> | null;
  offenseDirection: string | null;
  pressureDirection: string | null;
  passEnvironmentDirection: string | null;
  verdict: string | null;
  warnings: string[];
  raw: Record<string, unknown>;
}

export interface TeamEnvironmentMovementArtifactV0 {
  artifact: typeof TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME;
  generatedAt: string | null;
  metadata: TeamEnvironmentMovementMetadata;
  coverage: TeamEnvironmentMovementCoverage;
  movements: TeamEnvironmentMovementEntry[];
}

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
  const candidate = value.team ?? value.teamAbbr ?? value.teamAbbreviation;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim().toUpperCase() : null;
}

function normalizeMovementEntry(value: unknown): TeamEnvironmentMovementEntry | null {
  if (!isRecord(value)) return null;

  const team = normalizeTeam(value);
  if (!team) return null;

  return {
    team,
    season: typeof value.season === 'number' && Number.isFinite(value.season) ? value.season : null,
    earlyWindow: asRecordOrNull(value.earlyWindow ?? value.early ?? value.baselineWindow),
    lateWindow: asRecordOrNull(value.lateWindow ?? value.late ?? value.currentWindow),
    deltas: asRecordOrNull(value.deltas ?? value.delta),
    offenseDirection: typeof value.offenseDirection === 'string' ? value.offenseDirection : null,
    pressureDirection: typeof value.pressureDirection === 'string' ? value.pressureDirection : null,
    passEnvironmentDirection: typeof value.passEnvironmentDirection === 'string' ? value.passEnvironmentDirection : null,
    verdict: typeof value.verdict === 'string' ? value.verdict : null,
    warnings: asStringArray(value.warnings),
    raw: value,
  };
}

function getMovementArray(value: Record<string, unknown>): unknown[] | null {
  const candidate = value.movements ?? value.teamMovements ?? value.teams;
  return Array.isArray(candidate) ? candidate : null;
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

export function parseTeamEnvironmentMovementArtifact(raw: unknown): TeamEnvironmentMovementArtifactV0 {
  if (!isRecord(raw)) {
    throw new TeamEnvironmentMovementIntegrationError('invalid_payload', 'Team Environment Movement artifact must be a JSON object.', 502);
  }

  if (raw.artifact !== TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME) {
    throw new TeamEnvironmentMovementIntegrationError(
      'invalid_payload',
      'Team Environment Movement artifact literal mismatch; expected team_environment_movement_v0.',
      502,
    );
  }

  const movementArray = getMovementArray(raw);
  if (!movementArray) {
    throw new TeamEnvironmentMovementIntegrationError('invalid_payload', 'Team Environment Movement artifact must include a movements array.', 502);
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
    artifact: TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_NAME,
    generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : null,
    metadata: normalizeMetadata(raw.metadata),
    coverage: normalizeCoverage(raw.coverage),
    movements: movements as TeamEnvironmentMovementEntry[],
  };
}

export class TeamEnvironmentMovementClient {
  constructor(
    private readonly artifactPath = process.env.TEAM_ENVIRONMENT_MOVEMENT_ARTIFACT_PATH ?? DEFAULT_TEAM_ENVIRONMENT_MOVEMENT_PATH,
  ) {}

  getConfig() {
    return { artifactPath: this.artifactPath };
  }

  async readArtifact(): Promise<TeamEnvironmentMovementArtifactV0 | null> {
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
