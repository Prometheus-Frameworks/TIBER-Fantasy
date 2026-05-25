import { PlayerOwnershipClient } from './playerOwnershipClient';
import {
  CanonicalPlayerOwnershipAliasRow,
  CanonicalPlayerOwnershipRow,
  PlayerOwnershipIntegrationError,
  PlayerOwnershipLookupQuery,
  PlayerOwnershipMatchType,
  TiberPlayerOwnershipInsight,
} from './types';
import { normalizePlayerOwnershipToken } from './playerOwnershipAdapter';

function emptyInsight(overrides: Partial<TiberPlayerOwnershipInsight> = {}): TiberPlayerOwnershipInsight {
  return {
    available: false,
    matched: false,
    matchType: 'none',
    playerId: null,
    playerName: null,
    position: null,
    footballLevel: null,
    currentTeamId: null,
    currentTeamAbbr: null,
    currentTeamName: null,
    ownershipStatus: null,
    validFrom: null,
    validTo: null,
    lastVerifiedAt: null,
    confidence: null,
    sourceRefs: [],
    recentEvents: [],
    warnings: [],
    aliasApplied: false,
    alias: null,
    ...overrides,
  };
}

interface MatchResult {
  row: CanonicalPlayerOwnershipRow | null;
  matchType: PlayerOwnershipMatchType;
  warnings: string[];
}

function describeCandidates(rows: CanonicalPlayerOwnershipRow[]): string {
  return rows
    .slice(0, 5)
    .map((row) => [row.player_name, row.player_id].filter(Boolean).join(' / '))
    .join(', ');
}

function resolveMatch(rows: CanonicalPlayerOwnershipRow[], query: PlayerOwnershipLookupQuery): MatchResult {
  const warnings: string[] = [];
  const playerId = query.playerId?.trim() || null;
  const queryName = query.query?.trim() || null;
  const queryNameKey = normalizePlayerOwnershipToken(queryName);

  const chooseUnique = (candidates: CanonicalPlayerOwnershipRow[], matchType: PlayerOwnershipMatchType): MatchResult | null => {
    if (candidates.length === 1) {
      return { row: candidates[0], matchType, warnings };
    }

    if (candidates.length > 1) {
      return {
        row: null,
        matchType: 'none',
        warnings: [
          ...warnings,
          `Ambiguous player ownership match: ${candidates.length} candidates matched (${describeCandidates(candidates)}).`,
        ],
      };
    }

    return null;
  };

  if (playerId) {
    const idResult = chooseUnique(rows.filter((row) => row.player_id === playerId), 'player_id');
    if (idResult) {
      return idResult;
    }

    if (!queryName) {
      return {
        row: null,
        matchType: 'none',
        warnings: [`No player ownership match found for playerId ${playerId}.`],
      };
    }

    warnings.push(`No player ownership match found for playerId ${playerId}; falling back to player name lookup.`);
  }

  if (queryName) {
    const exact = chooseUnique(
      rows.filter((row) => row.player_name?.toLowerCase() === queryName.toLowerCase()),
      'exact_name',
    );
    if (exact) {
      return exact;
    }

    const normalized = chooseUnique(
      rows.filter((row) => normalizePlayerOwnershipToken(row.player_name) === queryNameKey),
      'normalized_name',
    );
    if (normalized) {
      return normalized;
    }

    if (queryNameKey.length >= 3) {
      const fuzzy = chooseUnique(
        rows.filter((row) => {
          const rowKey = normalizePlayerOwnershipToken(row.player_name);
          return rowKey.length >= 3 && (rowKey.includes(queryNameKey) || queryNameKey.includes(rowKey));
        }),
        'fuzzy',
      );
      if (fuzzy) {
        return fuzzy;
      }
    }

    return {
      row: null,
      matchType: 'none',
      warnings: [`No player ownership match found for query "${queryName}".`],
    };
  }

  return {
    row: null,
    matchType: 'none',
    warnings: [],
  };
}

export class PlayerOwnershipService {
  private readonly startupConfigLogged: boolean;

  constructor(private readonly client: PlayerOwnershipClient = new PlayerOwnershipClient()) {
    const config = this.client.getConfig();
    console.info(
      `[PlayerOwnershipIntegration] ${config.enabled && config.configured ? 'enabled' : 'disabled'} ` +
        `(configured=${config.configured}, latestArtifactPath=${config.latestArtifactPath}, eventsDir=${config.eventsDir ?? 'none'})`,
    );
    this.startupConfigLogged = true;
  }

  getStatus() {
    const config = this.client.getConfig();
    return {
      ...config,
      readiness: config.enabled && config.configured ? 'ready' : 'not_ready',
      startupConfigLogged: this.startupConfigLogged,
    };
  }

  async getPlayerOwnershipInsight(query: PlayerOwnershipLookupQuery = {}): Promise<TiberPlayerOwnershipInsight> {
    let artifactRows: CanonicalPlayerOwnershipRow[] = [];
    let aliasApplied = false;
    let alias: CanonicalPlayerOwnershipAliasRow | null = null;
    const aliasWarnings: string[] = [];
    const lookupQuery: PlayerOwnershipLookupQuery = { ...query };

    if (query.query?.trim()) {
      const aliasResult = await this.client.lookupAlias(query.query);
      aliasWarnings.push(...aliasResult.warnings);
      alias = aliasResult.alias;
      if (alias) {
        lookupQuery.query = alias.canonical_player_name;
        if (!lookupQuery.playerId) {
          lookupQuery.playerId = alias.player_id;
        }
        aliasApplied = true;
      }
    }

    try {
      const artifact = await this.client.readLatestArtifact();
      artifactRows = artifact.players;
    } catch (error) {
      if (error instanceof PlayerOwnershipIntegrationError) {
        return emptyInsight({
          available: false,
          warnings: [...aliasWarnings, `Player ownership artifact unavailable: ${error.message}`],
        });
      }

      return emptyInsight({
        available: false,
        warnings: [...aliasWarnings, 'Player ownership artifact unavailable due to an unexpected read failure.'],
      });
    }

    const match = resolveMatch(artifactRows, lookupQuery);

    if (!match.row) {
      return emptyInsight({
        available: true,
        matched: false,
        matchType: match.matchType,
        warnings: [...aliasWarnings, ...match.warnings],
        aliasApplied,
        alias: alias
          ? {
              inputAlias: query.query?.trim() ?? alias.alias,
              canonicalPlayerName: alias.canonical_player_name,
              playerId: alias.player_id,
              aliasType: alias.alias_type,
              source: alias.source,
            }
          : null,
      });
    }

    const eventResult = query.includeEvents === false
      ? { events: [], warnings: [] }
      : await this.client.readEventsForPlayer({
        playerId: match.row.player_id,
        playerName: match.row.player_name,
        limit: query.eventLimit,
      });

    return {
      available: true,
      matched: true,
      matchType: match.matchType,
      playerId: match.row.player_id,
      playerName: match.row.player_name,
      position: match.row.position,
      footballLevel: match.row.football_level,
      currentTeamId: match.row.current_team_id,
      currentTeamAbbr: match.row.current_team_abbr,
      currentTeamName: match.row.current_team_name,
      ownershipStatus: match.row.ownership_status,
      validFrom: match.row.valid_from,
      validTo: match.row.valid_to,
      lastVerifiedAt: match.row.last_verified_at,
      confidence: match.row.confidence,
      sourceRefs: match.row.source_refs.map((sourceRef) => ({ ...sourceRef })),
      recentEvents: eventResult.events.map((event) => ({ ...event })),
      warnings: [...match.warnings, ...eventResult.warnings],
      aliasApplied,
      alias: alias
        ? {
            inputAlias: query.query?.trim() ?? alias.alias,
            canonicalPlayerName: alias.canonical_player_name,
            playerId: alias.player_id,
            aliasType: alias.alias_type,
            source: alias.source,
          }
        : null,
    };
  }
}

export const playerOwnershipService = new PlayerOwnershipService();
