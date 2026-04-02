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

      return {
        season: query.season,
        throughWeek: this.resolveThroughWeekFromPath(filePath),
        data: parsed,
      };
    } catch (error) {
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
