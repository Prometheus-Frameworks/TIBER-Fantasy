/**
 * Fantasy #332 — identity resolution for context-bound entity models.
 *
 * The rule under test is that a name is a locator and never an identity, and
 * that every non-unique or non-answerable registry state is a refusal. If any
 * of these started resolving, an operator's context could be bound to the
 * wrong entity — which is worse than not saving it at all.
 */

import { ContextEntityResolver } from '../entityResolver';
import {
  FakeIdentityGateway,
  WARREN_CANONICAL_ID,
  WARREN_TIBER_ID,
  warrenIdentity,
} from './fakeIdentityGateway';

describe('ContextEntityResolver', () => {
  it('resolves an exact canonical id to the canonical subject', async () => {
    const resolver = new ContextEntityResolver(FakeIdentityGateway.withWarren());

    const result = await resolver.resolve({
      kind: 'tiber_player_id',
      tiberPlayerId: WARREN_TIBER_ID,
    });

    expect(result).toEqual({
      status: 'resolved',
      subject: {
        subjectType: 'tiber_player',
        subjectId: WARREN_TIBER_ID,
        displayName: 'Jaylen Warren',
        position: 'RB',
        team: 'PIT',
      },
    });
  });

  it('resolves a name through the registry and binds the canonical id, not the name', async () => {
    const resolver = new ContextEntityResolver(FakeIdentityGateway.withWarren());

    const result = await resolver.resolve({ kind: 'player_name', name: 'Jaylen Warren' });

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') throw new Error('unreachable');
    expect(result.subject.subjectId).toBe(WARREN_TIBER_ID);
    expect(result.subject.subjectId).not.toContain('Warren');
  });

  it('refuses a canonical id that does not match the opaque wire format', async () => {
    const resolver = new ContextEntityResolver(FakeIdentityGateway.withWarren());

    const result = await resolver.resolve({ kind: 'tiber_player_id', tiberPlayerId: '00-0036963' });

    expect(result.status).toBe('not_found');
  });

  it('refuses when more than one registry row carries the canonical id', async () => {
    const gateway = FakeIdentityGateway.withWarren();
    gateway.byTiberId.set(WARREN_TIBER_ID, { status: 'ambiguous', matches: 2 });
    const resolver = new ContextEntityResolver(gateway);

    const result = await resolver.resolve({
      kind: 'tiber_player_id',
      tiberPlayerId: WARREN_TIBER_ID,
    });

    expect(result).toMatchObject({ status: 'ambiguous', matches: 2 });
  });

  it('refuses a registry outage instead of reporting an empty namespace', async () => {
    const gateway = FakeIdentityGateway.withWarren();
    gateway.byTiberId.set(WARREN_TIBER_ID, { status: 'unavailable' });
    const resolver = new ContextEntityResolver(gateway);

    const result = await resolver.resolve({
      kind: 'tiber_player_id',
      tiberPlayerId: WARREN_TIBER_ID,
    });

    expect(result.status).toBe('unavailable');
  });

  it('refuses a broken merge chain', async () => {
    const gateway = FakeIdentityGateway.withWarren();
    gateway.byTiberId.set(WARREN_TIBER_ID, { status: 'merge_broken' });
    const resolver = new ContextEntityResolver(gateway);

    const result = await resolver.resolve({
      kind: 'tiber_player_id',
      tiberPlayerId: WARREN_TIBER_ID,
    });

    expect(result.status).toBe('merge_broken');
  });

  it('refuses a registry row that carries no canonical id rather than minting one', async () => {
    const gateway = FakeIdentityGateway.withWarren();
    gateway.byTiberId.set(WARREN_TIBER_ID, {
      status: 'resolved',
      player: warrenIdentity({ tiberPlayerId: null }),
    });
    const resolver = new ContextEntityResolver(gateway);

    const result = await resolver.resolve({
      kind: 'tiber_player_id',
      tiberPlayerId: WARREN_TIBER_ID,
    });

    expect(result.status).toBe('identity_incomplete');
  });

  it('binds to the surviving identity when the registry follows a merge redirect', async () => {
    const survivorId = 'tbr_p_01J8ZQ3M7K4N6P8R9SATVWXYZ1';
    const gateway = FakeIdentityGateway.withWarren();
    gateway.byTiberId.set(WARREN_TIBER_ID, {
      status: 'resolved',
      player: warrenIdentity({ tiberPlayerId: survivorId }),
    });
    const resolver = new ContextEntityResolver(gateway);

    const result = await resolver.resolve({
      kind: 'tiber_player_id',
      tiberPlayerId: WARREN_TIBER_ID,
    });

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') throw new Error('unreachable');
    expect(result.subject.subjectId).toBe(survivorId);
  });

  it('follows a merge redirect when a name lands on a merged loser row', async () => {
    // The registry's name search does not filter merged rows, and a merged
    // loser keeps its minted id as a historical redirect. Binding context to
    // that id would split the entity's history, because every later lookup
    // resolves to the survivor instead.
    const loserId = 'tbr_p_01J8ZQ3M7K4N6P8R9SATVWXYZ2';
    const survivorId = 'tbr_p_01J8ZQ3M7K4N6P8R9SATVWXYZ3';
    const gateway = FakeIdentityGateway.withWarren();
    gateway.byCanonicalId.set(WARREN_CANONICAL_ID, warrenIdentity({ tiberPlayerId: loserId }));
    gateway.byTiberId.set(loserId, {
      status: 'resolved',
      player: warrenIdentity({ tiberPlayerId: survivorId }),
    });
    const resolver = new ContextEntityResolver(gateway);

    const result = await resolver.resolve({ kind: 'player_name', name: 'Jaylen Warren' });

    expect(result.status).toBe('resolved');
    if (result.status !== 'resolved') throw new Error('unreachable');
    expect(result.subject.subjectId).toBe(survivorId);
  });

  it('refuses a name match whose registry row has a broken merge chain', async () => {
    const loserId = 'tbr_p_01J8ZQ3M7K4N6P8R9SATVWXYZ4';
    const gateway = FakeIdentityGateway.withWarren();
    gateway.byCanonicalId.set(WARREN_CANONICAL_ID, warrenIdentity({ tiberPlayerId: loserId }));
    gateway.byTiberId.set(loserId, { status: 'merge_broken' });
    const resolver = new ContextEntityResolver(gateway);

    const result = await resolver.resolve({ kind: 'player_name', name: 'Jaylen Warren' });

    expect(result.status).toBe('merge_broken');
  });

  it('refuses two exact name matches instead of choosing the higher-scoring one', async () => {
    const gateway = FakeIdentityGateway.withWarren();
    gateway.nameSearches.set('jaylen warren', [
      {
        canonicalId: WARREN_CANONICAL_ID,
        fullName: 'Jaylen Warren',
        position: 'RB',
        nflTeam: 'PIT',
        confidence: 1,
        matchReason: 'exact_full_name',
      },
      {
        canonicalId: 'tiber-player-warren-0002',
        fullName: 'Jaylen Warren',
        position: 'RB',
        nflTeam: 'FA',
        confidence: 0.95,
        matchReason: 'exact_full_name',
      },
    ]);
    const resolver = new ContextEntityResolver(gateway);

    const result = await resolver.resolve({ kind: 'player_name', name: 'Jaylen Warren' });

    expect(result).toMatchObject({ status: 'ambiguous', matches: 2 });
  });

  it('refuses a near-miss name match rather than accepting name similarity as identity', async () => {
    const gateway = FakeIdentityGateway.withWarren();
    gateway.nameSearches.set('jay warren', [
      {
        canonicalId: WARREN_CANONICAL_ID,
        fullName: 'Jaylen Warren',
        position: 'RB',
        nflTeam: 'PIT',
        confidence: 0.9,
        matchReason: 'partial_name',
      },
    ]);
    const resolver = new ContextEntityResolver(gateway);

    const result = await resolver.resolve({ kind: 'player_name', name: 'Jay Warren' });

    expect(result.status).toBe('not_found');
  });

  it('refuses a low-confidence exact-name candidate', async () => {
    const gateway = FakeIdentityGateway.withWarren();
    gateway.nameSearches.set('jaylen warren', [
      {
        canonicalId: WARREN_CANONICAL_ID,
        fullName: 'Jaylen Warren',
        position: 'RB',
        nflTeam: 'PIT',
        confidence: 0.5,
        matchReason: 'weak',
      },
    ]);
    const resolver = new ContextEntityResolver(gateway);

    const result = await resolver.resolve({ kind: 'player_name', name: 'Jaylen Warren' });

    expect(result.status).toBe('not_found');
  });

  it('reports a failed read after a name match as unavailable, not as a miss', async () => {
    const gateway = FakeIdentityGateway.withWarren();
    gateway.byCanonicalId.set(WARREN_CANONICAL_ID, null);
    const resolver = new ContextEntityResolver(gateway);

    const result = await resolver.resolve({ kind: 'player_name', name: 'Jaylen Warren' });

    expect(result.status).toBe('unavailable');
  });

  it('refuses an empty name locator', async () => {
    const resolver = new ContextEntityResolver(FakeIdentityGateway.withWarren());

    const result = await resolver.resolve({ kind: 'player_name', name: '   ' });

    expect(result.status).toBe('not_found');
  });
});
