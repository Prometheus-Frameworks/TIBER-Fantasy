/**
 * Test double for the identity registry slice the pilot consumes (#332).
 *
 * Models the registry's *contract* rather than its storage: every documented
 * outcome of `getByTiberPlayerId` (resolved, not_found, ambiguous,
 * merge_broken, unavailable) is expressible, because the point of these tests
 * is that each of them fails closed.
 */

import type {
  NameSearchResult,
  PlayerIdentityResult,
  TiberPlayerIdResolution,
} from '../../../services/PlayerIdentityService';
import type { IdentityGateway } from '../entityResolver';

/** A canonical id in the real `tbr_p_<26 Crockford base32>` wire format. */
export const WARREN_TIBER_ID = 'tbr_p_01J8ZQ3M7K4N6P8R9SATVWXYZ0';
export const WARREN_CANONICAL_ID = 'tiber-player-warren-0001';

export function warrenIdentity(
  overrides: Partial<PlayerIdentityResult> = {},
): PlayerIdentityResult {
  return {
    canonicalId: WARREN_CANONICAL_ID,
    tiberPlayerId: WARREN_TIBER_ID,
    fullName: 'Jaylen Warren',
    position: 'RB',
    nflTeam: 'PIT',
    confidence: 1,
    externalIds: {},
    isActive: true,
    lastVerified: new Date('2026-08-01T00:00:00.000Z'),
    ...overrides,
  };
}

export class FakeIdentityGateway implements IdentityGateway {
  byTiberId = new Map<string, TiberPlayerIdResolution>();
  byCanonicalId = new Map<string, PlayerIdentityResult | null>();
  nameSearches = new Map<string, NameSearchResult[]>();

  static withWarren(): FakeIdentityGateway {
    const gateway = new FakeIdentityGateway();
    const player = warrenIdentity();
    gateway.byTiberId.set(WARREN_TIBER_ID, { status: 'resolved', player });
    gateway.byCanonicalId.set(WARREN_CANONICAL_ID, player);
    gateway.nameSearches.set('jaylen warren', [
      {
        canonicalId: WARREN_CANONICAL_ID,
        fullName: 'Jaylen Warren',
        position: 'RB',
        nflTeam: 'PIT',
        confidence: 1,
        matchReason: 'exact_full_name',
      },
    ]);
    return gateway;
  }

  async getByTiberPlayerId(tiberPlayerId: string): Promise<TiberPlayerIdResolution> {
    return this.byTiberId.get(tiberPlayerId.trim()) ?? { status: 'not_found' };
  }

  async searchByName(name: string): Promise<NameSearchResult[]> {
    return this.nameSearches.get(name.trim().toLowerCase()) ?? [];
  }

  async getByCanonicalId(canonicalId: string): Promise<PlayerIdentityResult | null> {
    return this.byCanonicalId.get(canonicalId) ?? null;
  }
}
