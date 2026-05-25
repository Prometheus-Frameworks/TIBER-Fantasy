import { promises as fs } from 'fs';
import path from 'path';
import {
  CanonicalPlayerOwnershipAliasArtifact,
  CanonicalPlayerOwnershipAliasRow,
  CanonicalPlayerOwnershipArtifact,
  CanonicalPlayerOwnershipEvent,
  PlayerOwnershipClientConfig,
  PlayerOwnershipIntegrationError,
} from './types';
import {
  normalizePlayerOwnershipToken,
  parsePlayerOwnershipAliasesArtifact,
  parsePlayerOwnershipArtifact,
  parsePlayerOwnershipEvent,
} from './playerOwnershipAdapter';

const DEFAULT_LATEST_ARTIFACT_PATH = path.join(
  process.cwd(),
  '..',
  'TIBER-Data',
  'exports',
  'promoted',
  'player_ownership',
  'player_ownership_latest.json',
);
const DEFAULT_EVENTS_DIR = path.join(
  process.cwd(),
  '..',
  'TIBER-Data',
  'exports',
  'promoted',
  'player_ownership',
  'events',
);
const DEFAULT_ALIASES_ARTIFACT_PATH = path.join(
  process.cwd(),
  '..',
  'TIBER-Data',
  'exports',
  'promoted',
  'player_ownership',
  'player_ownership_aliases.json',
);
const EVENT_FILE_PATTERN = /^player_ownership_events_\d{4}\.jsonl$/;

export interface PlayerOwnershipEventLookup {
  playerId?: string | null;
  playerName?: string | null;
  limit?: number;
}

export interface PlayerOwnershipEventLookupResult {
  events: CanonicalPlayerOwnershipEvent[];
  warnings: string[];
}

export class PlayerOwnershipClient {
  private readonly latestArtifactPath: string;
  private readonly eventsDir: string | null;
  private readonly aliasesArtifactPath: string;
  private readonly enabled: boolean;

  constructor(config: PlayerOwnershipClientConfig = {}) {
    this.latestArtifactPath =
      config.latestArtifactPath ??
      process.env.PLAYER_OWNERSHIP_LATEST_ARTIFACT_PATH ??
      DEFAULT_LATEST_ARTIFACT_PATH;
    this.eventsDir =
      config.eventsDir === undefined
        ? process.env.PLAYER_OWNERSHIP_EVENTS_DIR ?? DEFAULT_EVENTS_DIR
        : config.eventsDir;
    this.aliasesArtifactPath =
      config.aliasesArtifactPath ??
      process.env.PLAYER_OWNERSHIP_ALIASES_ARTIFACT_PATH ??
      DEFAULT_ALIASES_ARTIFACT_PATH;
    this.enabled = config.enabled ?? process.env.PLAYER_OWNERSHIP_ENABLED !== '0';
  }

  getConfig() {
    return {
      enabled: this.enabled,
      configured: Boolean(this.latestArtifactPath),
      latestArtifactPath: this.latestArtifactPath,
      aliasesArtifactPath: this.aliasesArtifactPath,
      eventsDir: this.eventsDir,
    };
  }

  async readLatestArtifact(): Promise<CanonicalPlayerOwnershipArtifact> {
    if (!this.enabled) {
      throw new PlayerOwnershipIntegrationError(
        'config_error',
        'Player ownership integration is disabled by configuration.',
        503,
      );
    }

    try {
      const raw = await fs.readFile(this.latestArtifactPath, 'utf8');
      return parsePlayerOwnershipArtifact(JSON.parse(raw) as unknown);
    } catch (error) {
      if (error instanceof PlayerOwnershipIntegrationError) {
        throw error;
      }

      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError?.code === 'ENOENT') {
        throw new PlayerOwnershipIntegrationError(
          'not_found',
          `No player ownership latest artifact was found at PLAYER_OWNERSHIP_LATEST_ARTIFACT_PATH (${this.latestArtifactPath}).`,
          404,
          error,
        );
      }

      if (error instanceof SyntaxError) {
        throw new PlayerOwnershipIntegrationError(
          'invalid_payload',
          'Player ownership latest artifact is not valid JSON.',
          502,
          error,
        );
      }

      throw new PlayerOwnershipIntegrationError(
        'upstream_unavailable',
        'Unable to read the player ownership latest artifact.',
        503,
        error,
      );
    }
  }

  async readAliasesArtifact(): Promise<CanonicalPlayerOwnershipAliasArtifact> {
    const raw = await fs.readFile(this.aliasesArtifactPath, 'utf8');
    return parsePlayerOwnershipAliasesArtifact(JSON.parse(raw) as unknown);
  }

  async lookupAlias(query: string | null | undefined): Promise<{ alias: CanonicalPlayerOwnershipAliasRow | null; warnings: string[] }> {
    const warnings: string[] = [];
    const queryKey = normalizePlayerOwnershipToken(query);
    if (!this.enabled || !queryKey) {
      return { alias: null, warnings };
    }

    try {
      const aliasesArtifact = await this.readAliasesArtifact();
      const matches = aliasesArtifact.aliases.filter(
        (entry) => normalizePlayerOwnershipToken(entry.alias) === queryKey,
      );

      if (matches.length === 1) {
        return { alias: matches[0], warnings };
      }
      if (matches.length > 1) {
        warnings.push(`Ambiguous alias mapping for query "${query}".`);
      }
      return { alias: null, warnings };
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError?.code === 'ENOENT') {
        warnings.push(
          `Player ownership aliases unavailable: no alias artifact found at PLAYER_OWNERSHIP_ALIASES_ARTIFACT_PATH (${this.aliasesArtifactPath}).`,
        );
        return { alias: null, warnings };
      }

      if (error instanceof SyntaxError) {
        warnings.push('Player ownership aliases unavailable: alias artifact is not valid JSON.');
        return { alias: null, warnings };
      }

      if (error instanceof PlayerOwnershipIntegrationError) {
        warnings.push(`Player ownership aliases unavailable: ${error.message}`);
        return { alias: null, warnings };
      }

      warnings.push('Player ownership aliases unavailable due to unexpected read failure.');
      return { alias: null, warnings };
    }
  }

  async readEventsForPlayer(query: PlayerOwnershipEventLookup): Promise<PlayerOwnershipEventLookupResult> {
    const limit = Math.max(0, Math.min(query.limit ?? 5, 50));
    const warnings: string[] = [];
    const playerId = query.playerId?.trim() || null;
    const playerNameKey = normalizePlayerOwnershipToken(query.playerName);

    if (!this.enabled || limit === 0 || (!playerId && !playerNameKey)) {
      return { events: [], warnings };
    }

    if (!this.eventsDir) {
      warnings.push('Player ownership events directory is not configured; recent events were omitted.');
      return { events: [], warnings };
    }

    let filenames: string[] = [];
    try {
      filenames = (await fs.readdir(this.eventsDir)).filter((filename) => EVENT_FILE_PATTERN.test(filename));
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError?.code === 'ENOENT') {
        warnings.push('Player ownership events directory was not found; recent events were omitted.');
        return { events: [], warnings };
      }

      warnings.push('Unable to inspect player ownership events directory; recent events were omitted.');
      return { events: [], warnings };
    }

    const events: CanonicalPlayerOwnershipEvent[] = [];

    for (const filename of filenames.sort()) {
      const filePath = path.join(this.eventsDir, filename);
      let raw = '';

      try {
        raw = await fs.readFile(filePath, 'utf8');
      } catch {
        warnings.push(`Unable to read player ownership events file ${filename}; it was skipped.`);
        continue;
      }

      raw.split(/\r?\n/).forEach((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) {
          return;
        }

        try {
          const parsed = parsePlayerOwnershipEvent(JSON.parse(trimmed) as unknown);
          const eventPlayerNameKey = normalizePlayerOwnershipToken(parsed.player_name);
          const matchesPlayerId = playerId ? parsed.player_id === playerId : false;
          const matchesPlayerName = playerNameKey ? eventPlayerNameKey === playerNameKey : false;

          if (matchesPlayerId || matchesPlayerName) {
            events.push(parsed);
          }
        } catch {
          warnings.push(`Malformed player ownership event row skipped in ${filename}:${index + 1}.`);
        }
      });
    }

    events.sort((left, right) => Date.parse(right.detected_at) - Date.parse(left.detected_at));

    return {
      events: events.slice(0, limit),
      warnings,
    };
  }
}
