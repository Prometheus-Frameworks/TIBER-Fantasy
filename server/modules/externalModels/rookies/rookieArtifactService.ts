import { mapRookieArtifactToFantasySurface } from './rookieArtifactAdapter';
import { RookieArtifactClient } from './rookieArtifactClient';
import { RookieIntegrationError, RookieSortField, TiberRookieBoard, TiberRookieRow } from './types';

export interface RookieBoardQuery {
  season: number;
  position?: string;
  sortBy?: RookieSortField;
}

const VALID_SORT_FIELDS = new Set<RookieSortField>([
  'tiber_ras_v1',
  'tiber_ras_v2',
  'player_name',
  'proj_round',
  'production_score',
  'dominator_rating',
  'rookie_alpha',
  'athleticism_score',
]);

const VALID_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE']);

function numericForSort(value: number | null, fallback = -Infinity): number {
  return value == null ? fallback : value;
}

function rowSortValue(row: TiberRookieRow, sortBy: RookieSortField): number | string {
  switch (sortBy) {
    case 'player_name':
      return row.player_name;
    case 'proj_round':
      return numericForSort(row.proj_round, Number.MAX_SAFE_INTEGER) * -1;
    case 'tiber_ras_v1':
      return numericForSort(row.tiber_ras_v1);
    case 'tiber_ras_v2':
      return numericForSort(row.tiber_ras_v2);
    case 'production_score':
      return numericForSort(row.production_score);
    case 'dominator_rating':
      return numericForSort(row.dominator_rating);
    case 'athleticism_score':
      return numericForSort(row.athleticism_score);
    case 'rookie_alpha':
    default:
      return numericForSort(row.rookie_alpha);
  }
}

function sortRows(rows: TiberRookieRow[], sortBy: RookieSortField): TiberRookieRow[] {
  return [...rows].sort((a, b) => {
    const aValue = rowSortValue(a, sortBy);
    const bValue = rowSortValue(b, sortBy);

    if (typeof aValue === 'string' || typeof bValue === 'string') {
      return String(aValue).localeCompare(String(bValue));
    }

    if (bValue !== aValue) return bValue - aValue;
    return a.player_name.localeCompare(b.player_name);
  });
}

function seedTierFromAlpha(alpha: number | null): string | null {
  if (alpha == null) return null;
  if (alpha >= 80) return 'T1';
  if (alpha >= 65) return 'T2';
  if (alpha >= 50) return 'T3';
  if (alpha >= 35) return 'T4';
  return 'T5';
}

export class RookieArtifactService {
  constructor(private readonly client: RookieArtifactClient = new RookieArtifactClient()) {
    const config = this.client.getConfig();
    console.info(
      `[RookieArtifactIntegration] ${config.enabled && config.configured ? 'enabled' : 'disabled'} ` +
        `(artifactPath=${config.artifactPath})`,
    );
  }

  getStatus() {
    const config = this.client.getConfig();
    return {
      ...config,
      readiness: config.enabled && config.configured ? 'ready' : 'not_ready',
    };
  }

  async getRookieBoard(query: RookieBoardQuery): Promise<TiberRookieBoard> {
    const sortBy = query.sortBy && VALID_SORT_FIELDS.has(query.sortBy) ? query.sortBy : 'rookie_alpha';
    const position = (query.position ?? '').toUpperCase();
    const normalizedPosition = VALID_POSITIONS.has(position) ? position : null;

    try {
      const { payload, sourcePath } = await this.client.loadPromotedRookieArtifact();
      const mapped = mapRookieArtifactToFantasySurface(payload, sourcePath);

      if (mapped.season !== query.season) {
        throw new RookieIntegrationError(
          'invalid_payload',
          `Promoted rookie artifact season (${mapped.season}) does not match requested season (${query.season}).`,
          409,
        );
      }

      const withTier = mapped.players.map((player) => ({
        ...player,
        rookie_tier: player.rookie_tier ?? seedTierFromAlpha(player.rookie_alpha),
      }));

      const filtered = normalizedPosition ? withTier.filter((row) => row.position === normalizedPosition) : withTier;
      const sorted = sortRows(filtered, sortBy).map((row, index) => ({ ...row, rank: index + 1 }));

      return {
        ...mapped,
        count: sorted.length,
        players: sorted,
      };
    } catch (error) {
      if (error instanceof RookieIntegrationError) throw error;
      throw new RookieIntegrationError('upstream_unavailable', 'Rookie board integration failed unexpectedly.', 503, error);
    }
  }
}

export const rookieArtifactService = new RookieArtifactService();
