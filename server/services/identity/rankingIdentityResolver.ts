/**
 * Ranking → canonical identity boundary (Fantasy #308).
 *
 * Rankings routes declare their producer `player_id` fields as GSIS provenance.
 * Before this boundary existed, a GSIS value such as `00-0036963` could be
 * emitted straight out of the public Rankings v2 API as `playerId`, and the UI
 * built `/player/${playerId}` from it even when no canonical page resolved.
 *
 * This module is the single place where a source identifier becomes (or fails to
 * become) a canonical public key. Rules:
 *
 * - Exact matches only. No fuzzy joins, no name matching, no synthetic namespace.
 * - Provenance is preserved: the original source ID and its type travel with the
 *   row rather than being overwritten.
 * - Unresolved rows stay **visible and non-linked** with a typed reason. The
 *   board is never blanked because the crosswalk is sparse.
 */

import { db } from '../../infra/db';
import { playerIdentityMap } from '@shared/schema';
import { inArray } from 'drizzle-orm';
import { PlayerIdentityService, looksLikeGsisId } from '../PlayerIdentityService';

export type RankingIdentitySourceType = 'canonical' | 'gsis' | 'unknown';

export type RankingIdentityStatus =
  /** The source ID already is the canonical public key. */
  | 'canonical'
  /** Resolved through the identity crosswalk. */
  | 'resolved'
  /** Deliberately not resolved — see `reason`. */
  | 'unresolved';

export interface RankingIdentity {
  status: RankingIdentityStatus;
  /** Canonical public key, or null when unresolved. Null means "do not link". */
  canonicalId: string | null;
  /** The identifier the producer actually emitted. Always retained. */
  sourceId: string;
  sourceType: RankingIdentitySourceType;
  /** Typed machine-readable reason, present only when unresolved. */
  reason: string | null;
}

export interface RankingIdentityCoverage {
  total: number;
  canonical: number;
  resolved: number;
  unresolved: number;
  ambiguous: number;
  /** Fraction of rows carrying a usable canonical key, 0–1. */
  coverageRatio: number;
  byReason: Record<string, number>;
}

export interface RankingIdentityResolution {
  identities: Map<string, RankingIdentity>;
  coverage: RankingIdentityCoverage;
}

/**
 * Declared namespace of the producer field being resolved.
 *
 * Rankings currently ingest `player_id` from GSIS-governed producer lanes, so
 * callers must pass `gsis`. `auto` exists only for generic compatibility and
 * still gives a GSIS-shaped value collision precedence over a same-text
 * canonical_id. Namespace is provenance, not a guess derived from whichever
 * database row happens to match first.
 */
export type RankingIdentityInputNamespace = 'gsis' | 'canonical' | 'auto';

export const UNRESOLVED_REASONS = {
  /** Looks like a GSIS ID but no crosswalk row carries it. */
  GSIS_NOT_IN_CROSSWALK: 'gsis_not_in_identity_map',
  /** More than one crosswalk row carries this GSIS; refusing to pick one. */
  GSIS_AMBIGUOUS: 'gsis_ambiguous_duplicate_crosswalk_rows',
  /** The crosswalk query failed; absence must not be inferred from an outage. */
  GSIS_LOOKUP_UNAVAILABLE: 'gsis_identity_lookup_unavailable',
  /** Not a canonical key and not a recognised source-ID shape. */
  UNRECOGNISED_NAMESPACE: 'unrecognised_identifier_namespace',
  /** A declared canonical key is absent from the identity map. */
  CANONICAL_NOT_IN_CROSSWALK: 'canonical_not_in_identity_map',
  /** Producer emitted an empty identifier. */
  EMPTY: 'empty_identifier',
} as const;

function emptyCoverage(): RankingIdentityCoverage {
  return { total: 0, canonical: 0, resolved: 0, unresolved: 0, ambiguous: 0, coverageRatio: 1, byReason: {} };
}

/**
 * Resolve a cohort of producer-emitted identifiers to canonical public keys.
 *
 * At most two batched queries regardless of cohort size. GSIS resolution runs
 * first; a GSIS-shaped value can never bypass collision detection merely
 * because an identical string also exists in `canonical_id`.
 */
export async function resolveRankingIdentities(
  sourceIds: string[],
  namespace: RankingIdentityInputNamespace = 'auto',
): Promise<RankingIdentityResolution> {
  const identities = new Map<string, RankingIdentity>();
  const cleaned = sourceIds.map((id) => (id ?? '').trim());
  const distinct = Array.from(new Set(cleaned.filter(Boolean)));

  if (distinct.length === 0) {
    const coverage = emptyCoverage();
    for (const raw of cleaned) {
      if (raw) continue;
      identities.set(raw, {
        status: 'unresolved',
        canonicalId: null,
        sourceId: raw,
        sourceType: 'unknown',
        reason: UNRESOLVED_REASONS.EMPTY,
      });
    }
    coverage.total = cleaned.length;
    coverage.unresolved = cleaned.length;
    coverage.coverageRatio = cleaned.length === 0 ? 1 : 0;
    if (cleaned.length > 0) coverage.byReason[UNRESOLVED_REASONS.EMPTY] = cleaned.length;
    return { identities, coverage };
  }

  // Pass 1 — resolve the producer's GSIS namespace. In auto mode, the shape is
  // authoritative enough to require duplicate detection before any canonical
  // fallback; this closes canonical_id == duplicated gsis_id bypasses.
  const gsisCandidates = distinct.filter((id) => namespace !== 'canonical' && looksLikeGsisId(id));
  const { resolved, ambiguous, lookupStatus } = gsisCandidates.length
    ? await PlayerIdentityService.getInstance().resolveCanonicalIdsByGsis(gsisCandidates)
    : {
        resolved: new Map<string, string>(),
        ambiguous: new Set<string>(),
        lookupStatus: 'available' as const,
      };

  // Pass 2 — exact canonical lookup only when the producer declared canonical
  // provenance, or in auto mode for values that are not GSIS-shaped. A
  // declared GSIS field never silently changes namespace to make a link work.
  const canonicalCandidates =
    namespace === 'canonical'
      ? distinct
      : namespace === 'auto'
        ? distinct.filter((id) => !looksLikeGsisId(id))
        : [];
  let canonicalSet = new Set<string>();
  if (canonicalCandidates.length > 0) {
    try {
      const rows = await db
        .select({ canonicalId: playerIdentityMap.canonicalId })
        .from(playerIdentityMap)
        .where(inArray(playerIdentityMap.canonicalId, canonicalCandidates));
      canonicalSet = new Set(rows.map((row) => row.canonicalId));
    } catch (error) {
      console.error('[RankingIdentityResolver] canonical pre-check failed:', error);
    }
  }

  for (const sourceId of distinct) {
    const isGsisShaped = looksLikeGsisId(sourceId);
    const canonicalId = resolved.get(sourceId);
    if (canonicalId) {
      identities.set(sourceId, {
        status: 'resolved',
        canonicalId,
        sourceId,
        sourceType: 'gsis',
        reason: null,
      });
      continue;
    }

    if (ambiguous.has(sourceId)) {
      identities.set(sourceId, {
        status: 'unresolved',
        canonicalId: null,
        sourceId,
        sourceType: 'gsis',
        reason: UNRESOLVED_REASONS.GSIS_AMBIGUOUS,
      });
      continue;
    }

    if (isGsisShaped && lookupStatus === 'unavailable') {
      identities.set(sourceId, {
        status: 'unresolved',
        canonicalId: null,
        sourceId,
        sourceType: 'gsis',
        reason: UNRESOLVED_REASONS.GSIS_LOOKUP_UNAVAILABLE,
      });
      continue;
    }

    if (canonicalSet.has(sourceId)) {
      identities.set(sourceId, {
        status: 'canonical',
        canonicalId: sourceId,
        sourceId,
        sourceType: 'canonical',
        reason: null,
      });
      continue;
    }

    const declaredCanonical = namespace === 'canonical';

    identities.set(sourceId, {
      status: 'unresolved',
      canonicalId: null,
      sourceId,
      sourceType: isGsisShaped ? 'gsis' : declaredCanonical ? 'canonical' : 'unknown',
      reason: isGsisShaped
        ? UNRESOLVED_REASONS.GSIS_NOT_IN_CROSSWALK
        : declaredCanonical
          ? UNRESOLVED_REASONS.CANONICAL_NOT_IN_CROSSWALK
          : UNRESOLVED_REASONS.UNRECOGNISED_NAMESPACE,
    });
  }

  // Empty producer IDs are their own typed unresolved case.
  if (cleaned.some((id) => !id)) {
    identities.set('', {
      status: 'unresolved',
      canonicalId: null,
      sourceId: '',
      sourceType: 'unknown',
      reason: UNRESOLVED_REASONS.EMPTY,
    });
  }

  return { identities, coverage: measureCoverage(cleaned, identities, ambiguous) };
}

/**
 * Cohort-level identity coverage.
 *
 * Every response measures only the cohort it actually returns. This request-
 * local envelope is visibility evidence, not a database census or a claim
 * about production-wide crosswalk coverage. Unresolved rows remain rendered.
 */
export function measureCoverage(
  sourceIds: string[],
  identities: Map<string, RankingIdentity>,
  ambiguous: Set<string> = new Set(),
): RankingIdentityCoverage {
  const coverage = emptyCoverage();
  coverage.total = sourceIds.length;
  coverage.byReason = {};

  for (const rawId of sourceIds) {
    const identity = identities.get((rawId ?? '').trim());
    if (!identity) {
      coverage.unresolved += 1;
      coverage.byReason[UNRESOLVED_REASONS.UNRECOGNISED_NAMESPACE] =
        (coverage.byReason[UNRESOLVED_REASONS.UNRECOGNISED_NAMESPACE] ?? 0) + 1;
      continue;
    }
    if (identity.status === 'canonical') coverage.canonical += 1;
    else if (identity.status === 'resolved') coverage.resolved += 1;
    else {
      coverage.unresolved += 1;
      if (identity.reason) {
        coverage.byReason[identity.reason] = (coverage.byReason[identity.reason] ?? 0) + 1;
      }
    }
  }

  coverage.ambiguous = ambiguous.size;
  coverage.coverageRatio =
    coverage.total === 0 ? 1 : (coverage.canonical + coverage.resolved) / coverage.total;
  return coverage;
}
