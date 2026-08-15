/**
 * Fantasy #327 (PR A) — canonical TIBER player-id mint and format.
 *
 * The canonical wire format is opaque `tbr_p_<ULID>`: no name, team, season,
 * provider, or other mutable/domain-specific information may be encoded, and
 * the pattern must be disjoint from every provider namespace in the registry.
 */

import {
  TIBER_PLAYER_ID_PATTERN,
  looksLikeTiberPlayerId,
  mintTiberPlayerId,
} from '../identity/tiberPlayerId';

describe('mintTiberPlayerId', () => {
  test('mints tbr_p_ + 26 Crockford-base32 characters', () => {
    const id = mintTiberPlayerId();
    expect(id).toMatch(TIBER_PLAYER_ID_PATTERN);
    expect(id).toHaveLength('tbr_p_'.length + 26);
  });

  test('never repeats across a large batch', () => {
    const ids = new Set(Array.from({ length: 5000 }, () => mintTiberPlayerId()));
    expect(ids.size).toBe(5000);
  });

  test('is time-ordered across distinct timestamps', () => {
    // Deterministic timestamps via the test-only parameter; the randomness
    // tail cannot reorder ids whose time prefixes differ.
    const earlier = mintTiberPlayerId(1_000_000_000_000);
    const later = mintTiberPlayerId(1_000_000_000_001);
    expect(earlier < later).toBe(true);
  });

  test('rejects timestamps outside the 48-bit ULID range', () => {
    expect(() => mintTiberPlayerId(-1)).toThrow(RangeError);
    expect(() => mintTiberPlayerId(2 ** 48)).toThrow(RangeError);
    expect(() => mintTiberPlayerId(1.5)).toThrow(RangeError);
  });
});

describe('looksLikeTiberPlayerId — namespace disjointness', () => {
  test('accepts a minted id', () => {
    expect(looksLikeTiberPlayerId(mintTiberPlayerId())).toBe(true);
  });

  test.each([
    ['bare GSIS', '00-0035659'],
    ['sleeper-namespaced canonical_id', 'sleeper:9500'],
    ['gsis-namespaced key', 'gsis:00-0035659'],
    ['crosswalk slug', 'tiber-data-player-2025-justin-herbert'],
    ['legacy free-text canonical', 'tiber-amon-ra-st-brown'],
    ['lowercase ulid body', 'tbr_p_01hzxw9k3m5q7r2t4v6x8a0c1e'],
    ['excluded Crockford letters', 'tbr_p_ILOUILOUILOUILOUILOUILOUIL'],
    ['wrong prefix', 'tbr_t_0123456789ABCDEFGHJKMNPQRS'],
    ['truncated body', 'tbr_p_0123456789ABCDEFGHJKMNPQR'],
    ['empty string', ''],
  ])('rejects %s', (_label, value) => {
    expect(looksLikeTiberPlayerId(value)).toBe(false);
  });

  test('rejects null and undefined without throwing', () => {
    expect(looksLikeTiberPlayerId(null)).toBe(false);
    expect(looksLikeTiberPlayerId(undefined)).toBe(false);
  });
});
