import { promises as fs } from 'fs';
import path from 'path';
import {
  TEAM_STATE_ARTIFACT_NAME,
  TeamStateArtifactQuery,
  TeamStateArtifactResult,
  TeamStateClientConfig,
  TeamStateIntegrationError,
} from './types';

const DEFAULT_EXPORTS_DIR = path.join(process.cwd(), 'data', 'team-state');

const WEEK_FILE_PATTERNS = [
  (season: number, week: number) => `${TEAM_STATE_ARTIFACT_NAME}_${season}_through_week_${week}.json`,
  (season: number, week: number) => `${TEAM_STATE_ARTIFACT_NAME}_${season}_week_${week}.json`,
  (season: number, week: number) => `${TEAM_STATE_ARTIFACT_NAME}_${season}_w${week}.json`,
];

const SEASON_FILE_PATTERNS = [
  (season: number) => `${TEAM_STATE_ARTIFACT_NAME}_${season}.json`,
  (season: number) => `${TEAM_STATE_ARTIFACT_NAME}_${season}_full.json`,
];

const REQUIRED_TOP_LEVEL_KEYS = ['generatedAt', 'artifact', 'source', 'definitions', 'teams'] as const;
const REQUIRED_SOURCE_KEYS = ['provider', 'season', 'throughWeek', 'seasonType', 'gamesIncluded', 'notes'] as const;
const REQUIRED_TEAM_KEYS = ['team', 'sample', 'features', 'stability'] as const;
const REQUIRED_SAMPLE_KEYS = ['games', 'plays', 'neutralPlays', 'earlyDownPlays', 'redZonePlays', 'drives'] as const;
const REQUIRED_FEATURE_KEYS = [
  'neutralPassRate',
  'earlyDownPassRate',
  'earlyDownSuccessRate',
  'redZonePassRate',
  'redZoneTdEfficiency',
  'explosivePlayRate',
  'driveSustainRate',
  'paceSecondsPerPlay',
] as const;
const REQUIRED_STABILITY_KEYS = ['sampleFlag', 'confidenceBand', 'notes'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

function hasKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => key in record);
}

function isValidTeamStateArtifact(payload: unknown): payload is Record<string, unknown> {
  if (!isRecord(payload)) {
    return false;
  }

  if (!hasKeys(payload, REQUIRED_TOP_LEVEL_KEYS)) {
    return false;
  }

  if (payload.artifact !== TEAM_STATE_ARTIFACT_NAME) {
    return false;
  }

  const source = payload.source;
  if (!isRecord(source) || !hasKeys(source, REQUIRED_SOURCE_KEYS)) {
    return false;
  }

  const teams = payload.teams;
  if (!Array.isArray(teams)) {
    return false;
  }

  return teams.every((row) => {
    if (!isRecord(row) || !hasKeys(row, REQUIRED_TEAM_KEYS)) {
      return false;
    }

    if (!isRecord(row.sample) || !hasKeys(row.sample, REQUIRED_SAMPLE_KEYS)) {
      return false;
    }

    if (!isRecord(row.features) || !hasKeys(row.features, REQUIRED_FEATURE_KEYS)) {
      return false;
    }

    if (!isRecord(row.stability) || !hasKeys(row.stability, REQUIRED_STABILITY_KEYS)) {
      return false;
    }

    return true;
  });
}

export class TeamStateClient {
  private readonly exportsDir: string;
  private readonly enabled: boolean;

  constructor(config: TeamStateClientConfig = {}) {
    this.exportsDir = config.exportsDir ?? process.env.TEAM_STATE_EXPORTS_DIR ?? DEFAULT_EXPORTS_DIR;
    this.enabled = config.enabled ?? process.env.TEAM_STATE_EXPORTS_ENABLED !== '0';
  }

  getConfig() {
    return {
      enabled: this.enabled,
      configured: Boolean(this.exportsDir),
      exportsDir: this.exportsDir,
    };
  }

  async readTeamStateArtifact(query: TeamStateArtifactQuery): Promise<TeamStateArtifactResult> {
    if (!this.enabled) {
      throw new TeamStateIntegrationError('config_error', 'Team State artifact integration is disabled by configuration.', 503);
    }

    const filePath = await this.resolveArtifactPath(query);

    try {
      const raw = await fs.readFile(filePath, 'utf8');
      const parsed = JSON.parse(raw) as unknown;

      if (!isValidTeamStateArtifact(parsed)) {
        throw new TeamStateIntegrationError(
          'invalid_payload',
          'Team State artifact is valid JSON but does not match the required tiber_team_state_v0_1 contract shape.',
          502,
        );
      }

      return {
        season: query.season,
        throughWeek: this.resolveThroughWeekFromPath(filePath),
        data: parsed,
      };
    } catch (error) {
      if (error instanceof TeamStateIntegrationError) {
        throw error;
      }

      if (error instanceof SyntaxError) {
        throw new TeamStateIntegrationError('invalid_payload', 'Team State artifact JSON is invalid.', 502, error);
      }

      throw new TeamStateIntegrationError('upstream_unavailable', 'Unable to read Team State artifact.', 503, error);
    }
  }

  private async resolveArtifactPath(query: TeamStateArtifactQuery): Promise<string> {
    const candidates: string[] = [];

    if (query.throughWeek != null) {
      for (const build of WEEK_FILE_PATTERNS) {
        candidates.push(path.join(this.exportsDir, build(query.season, query.throughWeek)));
      }
    }

    for (const build of SEASON_FILE_PATTERNS) {
      candidates.push(path.join(this.exportsDir, build(query.season)));
    }

    const exact = await this.findFirstExisting(candidates);
    if (exact) {
      return exact;
    }

    if (query.throughWeek == null) {
      const latestWeekPath = await this.findLatestSeasonWeekFile(query.season);
      if (latestWeekPath) {
        return latestWeekPath;
      }
    }

    throw new TeamStateIntegrationError(
      'not_found',
      query.throughWeek == null
        ? `No ${TEAM_STATE_ARTIFACT_NAME} artifact found for season ${query.season}.`
        : `No ${TEAM_STATE_ARTIFACT_NAME} artifact found for season ${query.season} through week ${query.throughWeek}.`,
      404,
    );
  }

  private async findFirstExisting(candidates: string[]): Promise<string | null> {
    for (const candidate of candidates) {
      try {
        await fs.access(candidate);
        return candidate;
      } catch {
        // continue
      }
    }

    return null;
  }

  private async findLatestSeasonWeekFile(season: number): Promise<string | null> {
    let entries: string[] = [];

    try {
      entries = await fs.readdir(this.exportsDir);
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') {
        return null;
      }

      throw new TeamStateIntegrationError('upstream_unavailable', 'Unable to inspect Team State export directory.', 503, error);
    }

    const weekRegex = new RegExp(`^${TEAM_STATE_ARTIFACT_NAME}_${season}_(?:through_week_|week_|w)(\\d+)\\.json$`);

    let best: { week: number; filename: string } | null = null;

    for (const filename of entries) {
      const match = filename.match(weekRegex);
      if (!match) continue;

      const week = Number(match[1]);
      if (!Number.isInteger(week)) continue;

      if (!best || week > best.week) {
        best = { week, filename };
      }
    }

    return best ? path.join(this.exportsDir, best.filename) : null;
  }

  private resolveThroughWeekFromPath(filePath: string): number | null {
    const filename = path.basename(filePath);
    const match = filename.match(/(?:through_week_|week_|w)(\d+)\.json$/);
    return match ? Number(match[1]) : null;
  }
}
