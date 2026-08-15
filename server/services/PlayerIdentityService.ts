/**
 * Central Player Identity Map System
 * 
 * Core service for resolving player identities across multiple platforms
 * (Sleeper, ESPN, Yahoo, RotowWire, FantasyPros, etc.)
 * 
 * Provides canonical player ID resolution with confidence scoring
 * and fuzzy matching for ambiguous cases.
 */

import { db } from '../infra/db';
import { playerIdentityMap, type PlayerIdentityMap } from '@shared/schema';
import { eq, and, sql, or, ilike, desc, inArray, isNull } from 'drizzle-orm';
import { cacheKey, getCache, setCache } from '../../src/data/cache';
import { looksLikeTiberPlayerId, mintTiberPlayerId } from './identity/tiberPlayerId';

export interface ExternalIdMapping {
  externalId: string;
  platform: string;
  confidence: number;
}

export interface PlayerIdentityResult {
  canonicalId: string;
  /**
   * Canonical TIBER entity identity (`tbr_p_<ULID>`, Fantasy #327). Null only
   * until the backfill has minted this row (or forever, for merged rows —
   * their identity lives on the surviving row). Everything in `externalIds`
   * is a typed provider alias, never the entity itself.
   */
  tiberPlayerId: string | null;
  fullName: string;
  position: string;
  nflTeam?: string;
  confidence: number;
  externalIds: Record<string, string>;
  isActive: boolean;
  lastVerified: Date;
}

/**
 * Typed result for canonical-id resolution. Mirrors the GSIS resolution
 * union: ambiguity and lookup outages are explicit, never guessed through.
 */
export type TiberPlayerIdResolution =
  | { status: 'resolved'; player: PlayerIdentityResult }
  | { status: 'not_found' }
  | { status: 'ambiguous'; matches: number }
  /** The merged_into chain is broken (missing survivor or cycle); refusing to answer from corrupt registry state. */
  | { status: 'merge_broken' }
  | { status: 'unavailable' };

export interface NameSearchResult {
  canonicalId: string;
  fullName: string;
  position: string;
  nflTeam?: string;
  confidence: number;
  matchReason: string;
}

export interface IdentityMappingInput {
  canonicalId: string;
  externalId: string;
  platform: 'sleeper' | 'espn' | 'yahoo' | 'rotowire' | 'fantasypros' | 'mysportsfeeds' | 'nfl_data_py';
  confidence: number;
  overwrite?: boolean;
}

export type SupportedPlatform =
  | 'gsis'
  | 'sleeper'
  | 'espn'
  | 'yahoo'
  | 'rotowire'
  | 'fantasypros'
  | 'fantasy_data'
  | 'mysportsfeeds'
  | 'nfl_data_py';

/**
 * Source-ID columns consulted when resolving an unknown identifier.
 *
 * `gsis` is listed first because GSIS is the NFL's primary player identifier and
 * the namespace the FORGE grade cache actually emits; it was previously absent
 * entirely, so the reported `/player/00-0036963` Amon-Ra St. Brown deep link
 * returned "Player Not Found" (Fantasy #308). `fantasy_data` was likewise absent
 * despite `fantasy_data_id` existing in the schema with a unique index.
 *
 * Every entry here is an **exact** column match. No fuzzy or name-based
 * resolution is performed by these lookups.
 */
export const PLATFORM_COLUMNS: Record<SupportedPlatform, keyof PlayerIdentityMap> = {
  gsis: 'gsisId',
  sleeper: 'sleeperId',
  espn: 'espnId',
  yahoo: 'yahooId',
  rotowire: 'rotowireId',
  fantasypros: 'fantasyprosId',
  fantasy_data: 'fantasyDataId',
  mysportsfeeds: 'mysportsfeedsId',
  nfl_data_py: 'nflDataPyId'
};

/**
 * Columns an authenticated admin write may set. **`gsis` is deliberately absent.**
 *
 * Every other column here carries a unique index, so the database itself refuses
 * a second owner. `gsis_id` does not — applying that index is the operator step
 * this PR documents and deliberately does not perform.
 *
 * Until it exists, allowing GSIS through the write paths would let
 * `addIdentityMapping({ overwrite: true })` assign an identifier to a new owner
 * without clearing the previous one, and `createPlayerIdentity()` insert a second
 * row carrying the same identifier. Either produces exactly the duplicate state
 * the duplicate-aware resolvers must fail closed on — so an admin write would
 * silently disable ranking and player links for that player. Read resolution
 * stays on `PLATFORM_COLUMNS`; only writes are restricted.
 */
export const WRITABLE_PLATFORM_COLUMNS: Partial<Record<SupportedPlatform, keyof PlayerIdentityMap>> = {
  sleeper: 'sleeperId',
  espn: 'espnId',
  yahoo: 'yahooId',
  rotowire: 'rotowireId',
  fantasypros: 'fantasyprosId',
  fantasy_data: 'fantasyDataId',
  mysportsfeeds: 'mysportsfeedsId',
  nfl_data_py: 'nflDataPyId'
};

/** Shape of a GSIS identifier: `00-` followed by seven digits. */
export const GSIS_ID_PATTERN = /^00-\d{7}$/;

export function looksLikeGsisId(value: string): boolean {
  return GSIS_ID_PATTERN.test(value.trim());
}

export type GsisCanonicalIdResolution =
  | { status: 'resolved'; canonicalId: string }
  | { status: 'not_found' }
  | { status: 'ambiguous'; matches: number }
  | { status: 'unavailable' };

export interface GsisBatchResolution {
  resolved: Map<string, string>;
  ambiguous: Set<string>;
  /** Distinguishes a successful empty result from a failed crosswalk query. */
  lookupStatus: 'available' | 'unavailable';
}

/**
 * Core Player Identity Service
 * Manages cross-platform player identity resolution and mapping
 */
export class PlayerIdentityService {
  private static instance: PlayerIdentityService;
  private cachePrefix = 'player_identity';
  private defaultCacheTtl = 5 * 60 * 1000; // 5 minutes

  public static getInstance(): PlayerIdentityService {
    if (!PlayerIdentityService.instance) {
      PlayerIdentityService.instance = new PlayerIdentityService();
    }
    return PlayerIdentityService.instance;
  }

  /**
   * Get canonical player ID from any external platform ID
   * Core method for identity resolution
   */
  async getCanonicalId(externalId: string, platform: SupportedPlatform): Promise<string | null> {
    // Until `gsis_id` is protected by a database uniqueness constraint, a
    // positive GSIS result must be re-checked on every read. Otherwise a
    // unique lookup cached at T0 can keep resolving after a duplicate row is
    // introduced at T1. The duplicate-aware query is deliberately uncached.
    if (platform === 'gsis') {
      const result = await this.getCanonicalIdByGsisId(externalId);
      return result.status === 'resolved' ? result.canonicalId : null;
    }

    const cacheKeyStr = cacheKey([this.cachePrefix, 'canonical', platform, externalId]);
    const cached = getCache<string>(cacheKeyStr);
    if (cached) return cached;

    const columnName = PLATFORM_COLUMNS[platform];
    if (!columnName) {
      console.warn(`[PlayerIdentityService] Unsupported platform: ${platform}`);
      return null;
    }

    try {
      const result = await db
        .select({ canonicalId: playerIdentityMap.canonicalId })
        .from(playerIdentityMap)
        .where(eq(playerIdentityMap[columnName], externalId))
        .limit(1);

      const canonicalId = result[0]?.canonicalId || null;
      
      if (canonicalId) {
        setCache(cacheKeyStr, canonicalId, this.defaultCacheTtl);
      }

      return canonicalId;
    } catch (error) {
      console.error(`[PlayerIdentityService] Error getting canonical ID for ${platform}:${externalId}:`, error);
      return null;
    }
  }

  /**
   * Get complete player identity by any external ID
   * Returns full player object with all known platform IDs
   */
  async getByAnyId(id: string): Promise<PlayerIdentityResult | null> {
    const normalizedId = id.trim();
    const isGsisShaped = looksLikeGsisId(normalizedId);
    const cacheKeyStr = cacheKey([this.cachePrefix, 'by_any_id', normalizedId]);

    // A GSIS-shaped identifier is a source identifier first. Resolve it
    // through the duplicate-aware GSIS column before considering an exact
    // canonical-id fallback. This prevents a canonical_id whose text happens
    // to equal a duplicated GSIS from bypassing the fail-closed collision
    // policy. Positive GSIS-shaped lookups are not cached while uniqueness is
    // not database-enforced (see getCanonicalId above).
    if (!isGsisShaped) {
      const cached = getCache<PlayerIdentityResult>(cacheKeyStr);
      if (cached) return cached;
    }

    try {
      let player: PlayerIdentityResult | null = null;

      // Canonical TIBER identity resolves first: it is the entity key, is
      // format-disjoint from every provider namespace, and is unique-indexed.
      if (looksLikeTiberPlayerId(normalizedId)) {
        const resolution = await this.getByTiberPlayerId(normalizedId);
        if (resolution.status === 'resolved') {
          setCache(cacheKeyStr, resolution.player, this.defaultCacheTtl);
          return resolution.player;
        }
        // A tiber-shaped identifier is never anything else; do not fall
        // through to provider columns on not_found/ambiguous/unavailable.
        return null;
      }

      if (isGsisShaped) {
        const resolution = await this.getCanonicalIdByGsisId(normalizedId);
        if (resolution.status === 'ambiguous') {
          console.warn(`[PlayerIdentityService] Ambiguous GSIS ${normalizedId} (${resolution.matches} matches); refusing to guess.`);
          return null;
        }
        if (resolution.status === 'unavailable') {
          // A query failure is not evidence that the GSIS namespace is empty.
          // Never fall through to a same-text canonical_id on an outage.
          console.warn(`[PlayerIdentityService] GSIS lookup unavailable for ${normalizedId}; refusing namespace fallback.`);
          return null;
        }
        if (resolution.status === 'resolved') {
          return this.getByCanonicalId(resolution.canonicalId);
        }
        // A GSIS-shaped canonical key is still supported when no gsis_id row
        // claims that value. The fallback is safe only after the source-column
        // query has proved `not_found`.
      }

      // Try canonical ID after the GSIS collision check.
      player = await this.getByCanonicalId(normalizedId);
      if (player) {
        if (!isGsisShaped) setCache(cacheKeyStr, player, this.defaultCacheTtl);
        return player;
      }

      // Try each platform ID column.
      //
      // `gsis_id` is duplicate-prone (no unique index), so it is resolved
      // through the shared duplicate-aware path rather than `.limit(1)`. An
      // ambiguous GSIS returns null — never an arbitrary first row. The other
      // columns each carry a unique index, so their existing single-row
      // behaviour is preserved unchanged.
      for (const [platform, columnName] of Object.entries(PLATFORM_COLUMNS)) {
        if (platform === 'gsis') {
          // GSIS-shaped values were handled before the canonical lookup. A
          // non-GSIS-shaped value cannot be an exact governed GSIS id.
          continue;
        }

        const result = await db
          .select()
          .from(playerIdentityMap)
          .where(eq(playerIdentityMap[columnName], normalizedId))
          .limit(1);

        if (result[0]) {
          player = this.mapToPlayerIdentityResult(result[0]);
          setCache(cacheKeyStr, player, this.defaultCacheTtl);
          return player;
        }
      }

      return null;
    } catch (error) {
      console.error(`[PlayerIdentityService] Error getting player by any ID ${normalizedId}:`, error);
      return null;
    }
  }

  /**
   * Exact GSIS → canonical lookup.
   *
   * Deliberately narrow: an exact `gsis_id` column match, no fuzzy fallback. If
   * more than one row carries the same GSIS the lookup is **ambiguous and fails
   * closed** rather than picking one arbitrarily — there is no unique index on
   * `gsis_id` today (see `censusGsisIdentity`), so a duplicate is possible and
   * silently choosing a winner would fabricate an identity decision.
   */
  async getCanonicalIdByGsisId(gsisId: string): Promise<GsisCanonicalIdResolution> {
    const id = gsisId.trim();
    if (!id) return { status: 'not_found' };

    try {
      const rows = await db
        .select({ canonicalId: playerIdentityMap.canonicalId })
        .from(playerIdentityMap)
        .where(eq(playerIdentityMap.gsisId, id))
        .limit(2);

      if (rows.length === 0) return { status: 'not_found' };
      if (rows.length > 1) return { status: 'ambiguous', matches: rows.length };
      return { status: 'resolved', canonicalId: rows[0].canonicalId };
    } catch (error) {
      console.error(`[PlayerIdentityService] GSIS lookup failed for ${id}:`, error);
      return { status: 'unavailable' };
    }
  }

  /**
   * Exact canonical TIBER identity lookup (Fantasy #327).
   *
   * `tiber_player_id` carries a partial unique index, but the read still uses
   * `.limit(2)` and fails closed on more than one match — defense in depth
   * matching the GSIS discipline, and honest during any window where the
   * index has not yet been applied. Outages are `unavailable`, never an
   * empty-namespace conclusion.
   */
  async getByTiberPlayerId(tiberPlayerId: string): Promise<TiberPlayerIdResolution> {
    const id = tiberPlayerId.trim();
    if (!looksLikeTiberPlayerId(id)) return { status: 'not_found' };

    try {
      const rows = await db
        .select()
        .from(playerIdentityMap)
        .where(eq(playerIdentityMap.tiberPlayerId, id))
        .limit(2);

      if (rows.length === 0) return { status: 'not_found' };
      if (rows.length > 1) {
        console.warn(`[PlayerIdentityService] Ambiguous tiber_player_id ${id} (${rows.length} matches); refusing to guess.`);
        return { status: 'ambiguous', matches: rows.length };
      }

      // A row can be merged AFTER its id was minted (resolve-duplicate /
      // identityConsolidation set merged_into without touching
      // tiber_player_id — deliberately: destroying the loser's id would break
      // every external reference already holding it, and would not survive
      // the existing merge rollback). The minted id on a merged row is a
      // stable historical redirect: resolution follows merged_into to the
      // surviving row, whose own tiberPlayerId is the entity's identity. A
      // broken or cyclic chain is corrupt registry state and fails closed.
      let row: PlayerIdentityMap = rows[0] as PlayerIdentityMap;
      const visited = new Set<string>([row.canonicalId]);
      while (row.mergedInto) {
        const survivorId: string = row.mergedInto;
        if (visited.has(survivorId)) {
          console.warn(`[PlayerIdentityService] merged_into cycle at ${survivorId} while resolving tiber_player_id ${id}; refusing to guess.`);
          return { status: 'merge_broken' };
        }
        visited.add(survivorId);
        const survivors = await db
          .select()
          .from(playerIdentityMap)
          .where(eq(playerIdentityMap.canonicalId, survivorId))
          .limit(1);
        if (survivors.length === 0) {
          console.warn(`[PlayerIdentityService] merged_into survivor ${survivorId} missing while resolving tiber_player_id ${id}; refusing to guess.`);
          return { status: 'merge_broken' };
        }
        row = survivors[0] as PlayerIdentityMap;
      }
      return { status: 'resolved', player: this.mapToPlayerIdentityResult(row) };
    } catch (error) {
      console.error(`[PlayerIdentityService] tiber_player_id lookup failed for ${id}:`, error);
      return { status: 'unavailable' };
    }
  }

  /**
   * Mint canonical TIBER identities for pre-#327 registry rows.
   *
   * Idempotent: only rows with no tiber_player_id are touched. Merged rows
   * (merged_into set) are intentionally skipped — their entity identity lives
   * on the surviving row, and giving them their own id would mint two
   * identities for one entity. Each row is updated individually with its own
   * freshly minted id; a failure stops the batch and reports progress rather
   * than continuing past an inconsistent state.
   */
  async backfillTiberPlayerIds(): Promise<{
    minted: number;
    skippedMerged: number;
    status: 'complete' | 'failed';
  }> {
    let minted = 0;
    try {
      const pending = await db
        .select({
          canonicalId: playerIdentityMap.canonicalId,
          mergedInto: playerIdentityMap.mergedInto,
        })
        .from(playerIdentityMap)
        .where(isNull(playerIdentityMap.tiberPlayerId));

      const eligible = pending.filter((row) => !row.mergedInto);
      const skippedMerged = pending.length - eligible.length;

      for (const row of eligible) {
        await db
          .update(playerIdentityMap)
          .set({ tiberPlayerId: mintTiberPlayerId(), updatedAt: new Date() })
          .where(
            and(
              eq(playerIdentityMap.canonicalId, row.canonicalId),
              isNull(playerIdentityMap.tiberPlayerId),
            ),
          );
        minted++;
      }

      console.log(`[PlayerIdentityService] tiber_player_id backfill: ${minted} minted, ${skippedMerged} merged rows skipped.`);
      return { minted, skippedMerged, status: 'complete' };
    } catch (error) {
      console.error(`[PlayerIdentityService] tiber_player_id backfill failed after ${minted} mints:`, error);
      return { minted, skippedMerged: 0, status: 'failed' };
    }
  }

  /**
   * Batch exact GSIS → canonical resolution for a cohort.
   *
   * One query for the whole set rather than N round trips, so the ranking
   * boundary can resolve a full board without a per-row cost. Duplicate GSIS
   * values are reported as ambiguous and are *not* resolved.
   */
  async resolveCanonicalIdsByGsis(gsisIds: string[]): Promise<GsisBatchResolution> {
    const unique = Array.from(new Set(gsisIds.map((id) => id.trim()).filter(Boolean)));
    const resolved = new Map<string, string>();
    const ambiguous = new Set<string>();
    if (unique.length === 0) return { resolved, ambiguous, lookupStatus: 'available' };

    try {
      const rows = await db
        .select({ canonicalId: playerIdentityMap.canonicalId, gsisId: playerIdentityMap.gsisId })
        .from(playerIdentityMap)
        .where(inArray(playerIdentityMap.gsisId, unique));

      const seen = new Map<string, string[]>();
      for (const row of rows) {
        if (!row.gsisId) continue;
        const list = seen.get(row.gsisId) ?? [];
        list.push(row.canonicalId);
        seen.set(row.gsisId, list);
      }

      // Array.from rather than direct Map iteration: this repo's tsconfig target
      // predates downlevelIteration.
      for (const [gsisId, canonicalIds] of Array.from(seen.entries())) {
        if (canonicalIds.length === 1) {
          resolved.set(gsisId, canonicalIds[0]);
        } else {
          ambiguous.add(gsisId);
        }
      }
    } catch (error) {
      console.error('[PlayerIdentityService] Batch GSIS resolution failed:', error);
      return { resolved, ambiguous, lookupStatus: 'unavailable' };
    }

    return { resolved, ambiguous, lookupStatus: 'available' };
  }

  /**
   * Read-only census of `player_identity_map.gsis_id`.
   *
   * Fantasy #308 requires this **before** any uniqueness migration: there is no
   * unique index on `gsis_id` today, so a `CREATE UNIQUE INDEX` could fail on
   * live data. This performs no writes and no DDL — it only counts.
   */
  async censusGsisIdentity(): Promise<{
    totalRows: number;
    nonNullGsis: number;
    nullGsis: number;
    distinctGsis: number;
    duplicateGsisValues: number;
    duplicateRowCount: number;
    malformedGsis: number;
    blankOrPaddedGsis: number;
    uniqueIndexSafe: boolean;
    samples: { duplicates: Array<{ gsisId: string; canonicalIds: string[] }>; malformed: string[] };
  }> {
    const rows = await db
      .select({ canonicalId: playerIdentityMap.canonicalId, gsisId: playerIdentityMap.gsisId })
      .from(playerIdentityMap);

    // Group by the RAW stored value, because that is exactly what
    // `CREATE UNIQUE INDEX ... WHERE gsis_id IS NOT NULL` sees.
    //
    // Trimming first made the verdict disagree with the index it recommends:
    // two rows holding '' or whitespace were both counted as null and skipped,
    // so `uniqueIndexSafe` reported true while index creation would fail on the
    // duplicate non-null empty strings. A whitespace-padded but otherwise valid
    // id was likewise reported healthy even though exact runtime lookups
    // (`eq(gsisId, id)`) cannot resolve it.
    const byGsis = new Map<string, string[]>();
    const malformed: string[] = [];
    let nullGsis = 0;
    let blankOrPaddedGsis = 0;

    for (const row of rows) {
      const raw = row.gsisId;
      if (raw === null || raw === undefined) {
        nullGsis += 1;
        continue;
      }
      const trimmed = raw.trim();
      // Non-null but blank, or valid-only-after-trimming: present to the index,
      // unresolvable at runtime. Both block the index rather than passing quietly.
      if (trimmed.length === 0 || trimmed !== raw) {
        blankOrPaddedGsis += 1;
        malformed.push(raw);
      } else if (!looksLikeGsisId(raw)) {
        malformed.push(raw);
      }
      const list = byGsis.get(raw) ?? [];
      list.push(row.canonicalId);
      byGsis.set(raw, list);
    }

    const duplicates = Array.from(byGsis.entries()).filter(([, ids]) => ids.length > 1);
    const duplicateRowCount = duplicates.reduce((sum, [, ids]) => sum + ids.length, 0);

    return {
      totalRows: rows.length,
      nonNullGsis: rows.length - nullGsis,
      nullGsis,
      distinctGsis: byGsis.size,
      duplicateGsisValues: duplicates.length,
      duplicateRowCount,
      malformedGsis: malformed.length,
      blankOrPaddedGsis,
      // A partial unique index (`WHERE gsis_id IS NOT NULL`) tolerates real
      // NULLs, but blank and whitespace-padded values are non-null: they enter
      // the index and are unresolvable at runtime, so they block it too.
      uniqueIndexSafe: duplicates.length === 0 && blankOrPaddedGsis === 0,
      samples: {
        duplicates: duplicates.slice(0, 10).map(([gsisId, canonicalIds]) => ({ gsisId, canonicalIds })),
        malformed: Array.from(new Set(malformed)).slice(0, 10),
      },
    };
  }

  /**
   * Get player identity by canonical ID
   */
  async getByCanonicalId(canonicalId: string): Promise<PlayerIdentityResult | null> {
    const cacheKeyStr = cacheKey([this.cachePrefix, 'canonical_lookup', canonicalId]);
    const cached = getCache<PlayerIdentityResult>(cacheKeyStr);
    if (cached) return cached;

    try {
      const result = await db
        .select()
        .from(playerIdentityMap)
        .where(eq(playerIdentityMap.canonicalId, canonicalId))
        .limit(1);

      if (!result[0]) return null;

      const player = this.mapToPlayerIdentityResult(result[0]);
      setCache(cacheKeyStr, player, this.defaultCacheTtl);
      return player;
    } catch (error) {
      console.error(`[PlayerIdentityService] Error getting player by canonical ID ${canonicalId}:`, error);
      return null;
    }
  }

  /**
   * Search for players by name with fuzzy matching
   * Returns potential matches with confidence scores
   */
  async searchByName(name: string, position?: string): Promise<NameSearchResult[]> {
    const normalizedName = this.normalizeName(name);
    const cacheKeyStr = cacheKey([this.cachePrefix, 'name_search', normalizedName, position]);
    const cached = getCache<NameSearchResult[]>(cacheKeyStr);
    if (cached) return cached;

    try {
      // Build where condition based on position filter
      const nameSearchCondition = or(
        ilike(playerIdentityMap.fullName, `%${name}%`),
        ilike(playerIdentityMap.firstName, `%${name}%`),
        ilike(playerIdentityMap.lastName, `%${name}%`)
      );

      const whereCondition = position 
        ? and(
            eq(playerIdentityMap.position, position.toUpperCase()),
            nameSearchCondition
          )
        : nameSearchCondition;

      const results = await db
        .select()
        .from(playerIdentityMap)
        .where(whereCondition)
        .limit(20);

      // Score and sort results
      const scoredResults = results.map(player => {
        const score = this.calculateNameMatchScore(normalizedName, player);
        return {
          canonicalId: player.canonicalId,
          fullName: player.fullName,
          position: player.position,
          nflTeam: player.nflTeam || undefined,
          confidence: score.confidence,
          matchReason: score.reason
        };
      });

      // Sort by confidence and active status
      scoredResults.sort((a, b) => b.confidence - a.confidence);
      
      const topResults = scoredResults.slice(0, 10);
      setCache(cacheKeyStr, topResults, this.defaultCacheTtl);
      return topResults;
    } catch (error) {
      console.error(`[PlayerIdentityService] Error searching by name ${name}:`, error);
      return [];
    }
  }

  /**
   * Add or update identity mapping for a player
   */
  async addIdentityMapping(mapping: IdentityMappingInput): Promise<boolean> {
    try {
      // Writes use the restricted map: GSIS has no unique index yet, so it must
      // not be settable through an admin path (see WRITABLE_PLATFORM_COLUMNS).
      const columnName = WRITABLE_PLATFORM_COLUMNS[mapping.platform];
      if (!columnName) {
        console.warn(
          `[PlayerIdentityService] Platform not writable: ${mapping.platform}. ` +
          `GSIS is read-only until a unique index enforces single ownership.`,
        );
        return false;
      }

      // Check if canonical player exists
      const existingPlayer = await db
        .select()
        .from(playerIdentityMap)
        .where(eq(playerIdentityMap.canonicalId, mapping.canonicalId))
        .limit(1);

      if (!existingPlayer[0]) {
        console.warn(`[PlayerIdentityService] Canonical player ${mapping.canonicalId} not found`);
        return false;
      }

      // Check if external ID is already mapped to different player
      const existingMapping = await db
        .select()
        .from(playerIdentityMap)
        .where(eq(playerIdentityMap[columnName], mapping.externalId))
        .limit(1);

      if (existingMapping[0] && existingMapping[0].canonicalId !== mapping.canonicalId) {
        if (!mapping.overwrite) {
          console.warn(`[PlayerIdentityService] External ID ${mapping.externalId} already mapped to ${existingMapping[0].canonicalId}`);
          return false;
        }
      }

      // Update the mapping
      await db
        .update(playerIdentityMap)
        .set({
          [columnName]: mapping.externalId,
          confidence: mapping.confidence,
          lastVerified: new Date(),
          updatedAt: new Date()
        })
        .where(eq(playerIdentityMap.canonicalId, mapping.canonicalId));

      // Clear related cache entries
      this.clearPlayerCache(mapping.canonicalId);
      
      console.log(`[PlayerIdentityService] Updated ${mapping.platform} ID mapping for ${mapping.canonicalId}`);
      return true;
    } catch (error) {
      console.error(`[PlayerIdentityService] Error adding identity mapping:`, error);
      return false;
    }
  }

  /**
   * Create a new player identity in the map
   */
  async createPlayerIdentity(playerData: {
    canonicalId: string;
    fullName: string;
    firstName?: string;
    lastName?: string;
    position: string;
    nflTeam?: string;
    externalIds?: Record<string, string>;
    isActive?: boolean;
    confidence?: number;
  }): Promise<boolean> {
    try {
      // Check if canonical ID already exists
      const existing = await this.getByCanonicalId(playerData.canonicalId);
      if (existing) {
        console.warn(`[PlayerIdentityService] Player with canonical ID ${playerData.canonicalId} already exists`);
        return false;
      }

      const insertData: any = {
        canonicalId: playerData.canonicalId,
        // Every new registry row is born with its canonical TIBER identity;
        // only pre-#327 rows await the backfill (Fantasy #327).
        tiberPlayerId: mintTiberPlayerId(),
        fullName: playerData.fullName,
        firstName: playerData.firstName,
        lastName: playerData.lastName,
        position: playerData.position.toUpperCase(),
        nflTeam: playerData.nflTeam,
        isActive: playerData.isActive ?? true,
        confidence: playerData.confidence ?? 1.0,
        lastVerified: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Add external IDs if provided
      if (playerData.externalIds) {
        for (const [platform, externalId] of Object.entries(playerData.externalIds)) {
          const columnName = WRITABLE_PLATFORM_COLUMNS[platform as SupportedPlatform];
          if (columnName) {
            insertData[columnName] = externalId;
          } else {
            console.warn(
              `[PlayerIdentityService] Ignoring non-writable platform id on create: ${platform}.`,
            );
          }
        }
      }

      await db.insert(playerIdentityMap).values(insertData);
      
      console.log(`[PlayerIdentityService] Created new player identity: ${playerData.canonicalId}`);
      return true;
    } catch (error) {
      console.error(`[PlayerIdentityService] Error creating player identity:`, error);
      return false;
    }
  }

  /**
   * Get all platform IDs for a canonical player
   */
  async getAllExternalIds(canonicalId: string): Promise<Record<string, string>> {
    const player = await this.getByCanonicalId(canonicalId);
    if (!player) return {};

    return player.externalIds;
  }

  /**
   * Bulk import players from external source (e.g., Sleeper API)
   */
  async bulkImportPlayers(players: Array<{
    externalId: string;
    platform: SupportedPlatform;
    fullName: string;
    firstName?: string;
    lastName?: string;
    position: string;
    nflTeam?: string;
    isActive?: boolean;
  }>): Promise<{ imported: number; skipped: number; errors: number }> {
    const stats = { imported: 0, skipped: 0, errors: 0 };
    
    for (const player of players) {
      try {
        // Generate canonical ID (platform:external_id format for now)
        const canonicalId = `${player.platform}:${player.externalId}`;
        
        // Check if already exists
        const existing = await this.getByCanonicalId(canonicalId);
        if (existing) {
          stats.skipped++;
          continue;
        }

        const success = await this.createPlayerIdentity({
          canonicalId,
          fullName: player.fullName,
          firstName: player.firstName,
          lastName: player.lastName,
          position: player.position,
          nflTeam: player.nflTeam,
          isActive: player.isActive,
          externalIds: { [player.platform]: player.externalId }
        });

        if (success) {
          stats.imported++;
        } else {
          stats.errors++;
        }
      } catch (error) {
        console.error(`[PlayerIdentityService] Error importing player ${player.externalId}:`, error);
        stats.errors++;
      }
    }

    console.log(`[PlayerIdentityService] Bulk import completed: ${stats.imported} imported, ${stats.skipped} skipped, ${stats.errors} errors`);
    return stats;
  }

  /**
   * Health check and stats
   */
  async getSystemStats(): Promise<{
    totalPlayers: number;
    activePlayers: number;
    platformCoverage: Record<string, number>;
    lastUpdated: Date | null;
  }> {
    try {
      const [total, active, platformStats] = await Promise.all([
        db.select({ count: sql<number>`count(*)` }).from(playerIdentityMap),
        db.select({ count: sql<number>`count(*)` }).from(playerIdentityMap).where(eq(playerIdentityMap.isActive, true)),
        this.getPlatformCoverage()
      ]);

      return {
        totalPlayers: total[0]?.count || 0,
        activePlayers: active[0]?.count || 0,
        platformCoverage: platformStats,
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error(`[PlayerIdentityService] Error getting system stats:`, error);
      return {
        totalPlayers: 0,
        activePlayers: 0,
        platformCoverage: {},
        lastUpdated: null
      };
    }
  }

  // Private helper methods

  private mapToPlayerIdentityResult(player: PlayerIdentityMap): PlayerIdentityResult {
    const externalIds: Record<string, string> = {};
    
    // Collect all external IDs. Keys match PLATFORM_COLUMNS, so a consumer that
    // can resolve by a platform can also read that platform's id back — gsis and
    // fantasy_data were previously resolvable but never surfaced (Fantasy #308).
    if (player.gsisId) externalIds.gsis = player.gsisId;
    if (player.sleeperId) externalIds.sleeper = player.sleeperId;
    if (player.espnId) externalIds.espn = player.espnId;
    if (player.yahooId) externalIds.yahoo = player.yahooId;
    if (player.rotowireId) externalIds.rotowire = player.rotowireId;
    if (player.fantasyprosId) externalIds.fantasypros = player.fantasyprosId;
    if (player.fantasyDataId) externalIds.fantasy_data = player.fantasyDataId;
    if (player.mysportsfeedsId) externalIds.mysportsfeeds = player.mysportsfeedsId;
    if (player.nflDataPyId) externalIds.nfl_data_py = player.nflDataPyId;

    return {
      canonicalId: player.canonicalId,
      tiberPlayerId: player.tiberPlayerId ?? null,
      fullName: player.fullName,
      position: player.position,
      nflTeam: player.nflTeam || undefined,
      confidence: player.confidence || 1.0,
      externalIds,
      isActive: player.isActive || false,
      lastVerified: player.lastVerified || new Date()
    };
  }

  private normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private calculateNameMatchScore(searchName: string, player: PlayerIdentityMap): { confidence: number; reason: string } {
    const names = [
      player.fullName?.toLowerCase() || '',
      `${player.firstName} ${player.lastName}`.toLowerCase().trim(),
      player.firstName?.toLowerCase() || '',
      player.lastName?.toLowerCase() || ''
    ].filter(Boolean);

    let bestScore = 0;
    let bestReason = 'no match';

    for (const name of names) {
      if (name === searchName) {
        return { confidence: 1.0, reason: 'exact match' };
      }
      
      if (name.includes(searchName)) {
        const score = searchName.length / name.length;
        if (score > bestScore) {
          bestScore = score;
          bestReason = 'partial match';
        }
      }
      
      if (searchName.includes(name) && name.length >= 3) {
        const score = name.length / searchName.length;
        if (score > bestScore) {
          bestScore = score;
          bestReason = 'contained match';
        }
      }
    }

    // Boost active players
    if (player.isActive) {
      bestScore *= 1.2;
    }

    return { confidence: Math.min(bestScore, 1.0), reason: bestReason };
  }

  private async getPlatformCoverage(): Promise<Record<string, number>> {
    const coverage: Record<string, number> = {};

    for (const [platform, columnName] of Object.entries(PLATFORM_COLUMNS)) {
      try {
        const result = await db
          .select({ count: sql<number>`count(*)` })
          .from(playerIdentityMap)
          .where(sql`${playerIdentityMap[columnName]} IS NOT NULL`);
        
        coverage[platform] = result[0]?.count || 0;
      } catch (error) {
        console.error(`[PlayerIdentityService] Error getting coverage for ${platform}:`, error);
        coverage[platform] = 0;
      }
    }

    return coverage;
  }

  private clearPlayerCache(canonicalId: string): void {
    // This is a simple implementation - in production you might want more sophisticated cache invalidation
    console.log(`[PlayerIdentityService] Cache cleared for player ${canonicalId}`);
  }
}

// Export singleton instance
export const playerIdentityService = PlayerIdentityService.getInstance();
