/**
 * Entity resolution for the context-bound entity model pilot (Fantasy #332).
 *
 * Every context-bound model is bound to the canonical opaque identity minted
 * by the Fantasy #327 registry. This module is the only place the pilot
 * touches identity, and it exists to enforce one rule:
 *
 *   **A name is a locator, never an identity.**
 *
 * A human-supplied name is used to *look up* the registry; what gets stored is
 * always the canonical `tiber_player_id` the registry returned. If the lookup
 * is not unambiguous — several candidates, no candidate, an un-minted row, a
 * broken merge chain, or a registry outage — resolution fails closed and no
 * write is attempted. The pilot never mints identity, never guesses between
 * candidates, and never falls back to name equality.
 */

import type {
  NameSearchResult,
  PlayerIdentityResult,
  TiberPlayerIdResolution,
} from '../../services/PlayerIdentityService';
import { looksLikeTiberPlayerId } from '../../services/identity/tiberPlayerId';
import type { EntitySubject } from './domain';

/**
 * The slice of the identity registry this pilot consumes.
 *
 * Declared as a port and injected rather than imported as the live singleton:
 * `PlayerIdentityService` reaches the database at module load, and neither the
 * domain nor the application layer should acquire a database dependency just
 * by being imported. The real service is wired in at the composition root
 * (`composition.ts`), which satisfies this interface structurally.
 */
export interface IdentityGateway {
  getByTiberPlayerId(tiberPlayerId: string): Promise<TiberPlayerIdResolution>;
  searchByName(name: string, position?: string): Promise<NameSearchResult[]>;
  getByCanonicalId(canonicalId: string): Promise<PlayerIdentityResult | null>;
}

/**
 * How the operator/agent referred to the entity.
 *
 * `tiber_player_id` is the exact path. `player_name` is the convenience path a
 * fresh session actually starts from ("Jaylen Warren"), and it is deliberately
 * strict.
 */
export type EntityLocator =
  | { kind: 'tiber_player_id'; tiberPlayerId: string }
  | { kind: 'player_name'; name: string; position?: string };

/**
 * Resolution outcome. Every non-`resolved` status is a refusal — callers must
 * not treat any of them as permission to proceed with a partial identity.
 */
export type EntityResolution =
  | { status: 'resolved'; subject: EntitySubject }
  /** No registry row matched this locator confidently. */
  | { status: 'not_found'; detail: string }
  /** More than one candidate matched; refusing to guess between them. */
  | { status: 'ambiguous'; detail: string; matches: number }
  /** The registry row exists but its `merged_into` chain is corrupt. */
  | { status: 'merge_broken'; detail: string }
  /** The row exists but carries no canonical id yet; minting is not ours. */
  | { status: 'identity_incomplete'; detail: string }
  /** The identity registry could not answer. Never an "empty namespace". */
  | { status: 'unavailable'; detail: string };

/** Same normalisation the identity registry uses for its own name scoring. */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Minimum confidence a name candidate needs before it is even considered.
 *
 * This is a floor, not the decision: a candidate must additionally match the
 * requested name exactly after normalisation, and be the only such candidate.
 */
const NAME_CONFIDENCE_FLOOR = 0.8;

export class ContextEntityResolver {
  constructor(private readonly identity: IdentityGateway) {}

  async resolve(locator: EntityLocator): Promise<EntityResolution> {
    switch (locator.kind) {
      case 'tiber_player_id':
        return this.resolveByTiberPlayerId(locator.tiberPlayerId);
      case 'player_name':
        return this.resolveByName(locator.name, locator.position);
      default: {
        const exhaustive: never = locator;
        return { status: 'not_found', detail: `unsupported locator: ${JSON.stringify(exhaustive)}` };
      }
    }
  }

  private async resolveByTiberPlayerId(rawId: string): Promise<EntityResolution> {
    const id = rawId.trim();
    if (!looksLikeTiberPlayerId(id)) {
      return { status: 'not_found', detail: 'not a canonical tiber_player_id' };
    }

    const resolution = await this.identity.getByTiberPlayerId(id);
    switch (resolution.status) {
      case 'resolved': {
        // The registry follows `merged_into` to the surviving row, so the
        // canonical id we bind to can legitimately differ from the one asked
        // for. The survivor's id is the entity; the requested id was a
        // historical redirect. Binding to the redirect instead would tie the
        // operator's context to a row that is no longer the entity.
        const canonicalId = resolution.player.tiberPlayerId;
        if (!canonicalId) {
          return {
            status: 'identity_incomplete',
            detail: 'registry row carries no canonical tiber_player_id',
          };
        }
        return { status: 'resolved', subject: toSubject(canonicalId, resolution.player) };
      }
      case 'not_found':
        return { status: 'not_found', detail: 'no registry row for this canonical id' };
      case 'ambiguous':
        return {
          status: 'ambiguous',
          detail: 'more than one registry row carries this canonical id',
          matches: resolution.matches,
        };
      case 'merge_broken':
        return { status: 'merge_broken', detail: 'registry merge chain is broken or cyclic' };
      case 'unavailable':
        return { status: 'unavailable', detail: 'identity registry lookup failed' };
      default: {
        const exhaustive: never = resolution;
        return { status: 'unavailable', detail: `unhandled identity status: ${String(exhaustive)}` };
      }
    }
  }

  private async resolveByName(rawName: string, position?: string): Promise<EntityResolution> {
    const query = normalizeName(rawName);
    if (!query) return { status: 'not_found', detail: 'empty name locator' };

    const candidates = await this.identity.searchByName(rawName, position);

    // Exact normalised-name match only. Substring and fuzzy candidates come
    // back from the registry search by design; accepting one of them here
    // would be name-similarity standing in for identity.
    const exact = candidates.filter(
      (candidate) =>
        candidate.confidence >= NAME_CONFIDENCE_FLOOR && normalizeName(candidate.fullName) === query,
    );
    const distinct = exact
      .map((candidate) => candidate.canonicalId)
      .filter((canonicalId, index, all) => all.indexOf(canonicalId) === index);

    if (distinct.length === 0) {
      // The registry's name search reports a query failure as an empty list,
      // so this branch cannot distinguish "nobody by that name" from "the
      // lookup broke". Both are refusals and neither permits a write; the
      // detail says so rather than asserting the namespace is empty.
      return {
        status: 'not_found',
        detail: 'no unambiguous registry match for this name (or the name lookup was unavailable)',
      };
    }
    if (distinct.length > 1) {
      return {
        status: 'ambiguous',
        detail: `${distinct.length} registry rows match this name exactly`,
        matches: distinct.length,
      };
    }

    // Re-read the matched row for its canonical identity. A null here means
    // the read failed (the row existed a moment ago), not that it is missing.
    const player = await this.identity.getByCanonicalId(distinct[0]);
    if (!player) {
      return { status: 'unavailable', detail: 'identity registry read failed after name match' };
    }
    if (!player.tiberPlayerId) {
      return {
        status: 'identity_incomplete',
        detail: 'matched registry row carries no canonical tiber_player_id',
      };
    }
    return { status: 'resolved', subject: toSubject(player.tiberPlayerId, player) };
  }
}

function toSubject(
  canonicalId: string,
  player: { fullName: string; position: string; nflTeam?: string },
): EntitySubject {
  return {
    subjectType: 'tiber_player',
    subjectId: canonicalId,
    displayName: player.fullName,
    position: player.position || undefined,
    team: player.nflTeam || undefined,
  };
}
