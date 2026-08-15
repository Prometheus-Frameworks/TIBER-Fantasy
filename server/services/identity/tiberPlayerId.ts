/**
 * Canonical TIBER NFL-player identity: `tbr_p_<ULID>` (Fantasy #327, PR A).
 *
 * Operator decision (settled): TIBER owns its canonical entity identities.
 * Provider identifiers (GSIS, Sleeper, ESPN, ...) are typed aliases or
 * domain-specific join keys, never the entity itself. The canonical wire
 * format is deliberately opaque — no player name, team, season, provider,
 * or other mutable/domain-specific information may be encoded in it.
 *
 * The suffix is a standard 26-character Crockford-base32 ULID
 * (48-bit millisecond timestamp + 80 bits of crypto randomness), so IDs are
 * unique, stable, and roughly time-ordered without leaking domain facts.
 */

import { randomBytes } from 'crypto';

export const TIBER_PLAYER_ID_PREFIX = 'tbr_p_';

/**
 * Crockford base32: no I, L, O, U. ULIDs use the uppercase alphabet.
 */
const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * `tbr_p_` + 26 Crockford-base32 chars. Intentionally disjoint from every
 * provider shape in the registry: bare GSIS (`00-XXXXXXX`), namespaced
 * provider keys (`sleeper:123`), and slug-form crosswalk ids
 * (`tiber-data-player-2025-...`) all fail this pattern.
 */
export const TIBER_PLAYER_ID_PATTERN = /^tbr_p_[0-9ABCDEFGHJKMNPQRSTVWXYZ]{26}$/;

export function looksLikeTiberPlayerId(value: string | null | undefined): boolean {
  return typeof value === 'string' && TIBER_PLAYER_ID_PATTERN.test(value);
}

function encodeTime(timeMs: number): string {
  if (!Number.isInteger(timeMs) || timeMs < 0 || timeMs > 2 ** 48 - 1) {
    throw new RangeError(`tiberPlayerId: timestamp out of ULID range: ${timeMs}`);
  }
  let out = '';
  let remaining = timeMs;
  for (let i = 0; i < 10; i++) {
    out = CROCKFORD[remaining % 32] + out;
    remaining = Math.floor(remaining / 32);
  }
  return out;
}

function encodeRandom(): string {
  // 80 random bits -> 16 base32 chars. Draw 16 bytes and take 5 bits from
  // each so no byte's entropy is stretched across a character boundary.
  const bytes = randomBytes(16);
  let out = '';
  for (let i = 0; i < 16; i++) {
    out += CROCKFORD[bytes[i] & 0x1f];
  }
  return out;
}

/**
 * Mint a new canonical TIBER player id.
 *
 * `timeMs` is injectable for deterministic tests only; production callers
 * always mint against the real clock.
 */
export function mintTiberPlayerId(timeMs: number = Date.now()): string {
  return `${TIBER_PLAYER_ID_PREFIX}${encodeTime(timeMs)}${encodeRandom()}`;
}

/**
 * Stamp a new `player_identity_map` row with its canonical identity.
 *
 * Every registry insert path MUST route its row through this helper (or
 * `PlayerIdentityService.createPlayerIdentity`, which uses it): a surviving
 * row born without `tiber_player_id` would silently reopen the backfill
 * population and ship a null canonical identity to consumers. A
 * `tiberPlayerId` already present on the row is a bug, not an override.
 */
export function withMintedTiberPlayerId<T extends object>(
  row: T,
): T & { tiberPlayerId: string } {
  if ('tiberPlayerId' in row && (row as Record<string, unknown>).tiberPlayerId != null) {
    throw new Error(
      'tiberPlayerId: refusing to re-stamp a row that already carries a canonical id',
    );
  }
  return { ...row, tiberPlayerId: mintTiberPlayerId() };
}
