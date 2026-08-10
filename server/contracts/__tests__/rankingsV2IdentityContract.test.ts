import {
  RANKINGS_V2_CONTRACT_VERSION,
  rankingsV2ItemSchema,
  rankingsV2ResponseSchema,
} from '../rankingsV2';

const resolvedIdentity = {
  status: 'resolved' as const,
  canonicalId: 'tiber-amon-ra-st-brown',
  sourceId: '00-0036963',
  sourceType: 'gsis' as const,
  reason: null,
  linkable: true as const,
};

function item(overrides: Record<string, unknown> = {}) {
  return {
    rank: 1,
    playerId: 'tiber-amon-ra-st-brown',
    playerName: 'Amon-Ra St. Brown',
    position: 'WR',
    team: 'DET',
    tier: 'T1',
    score: 95,
    value: 77.2,
    explanation: {
      placementSummary: null,
      pillars: [],
      riskSignals: [],
      pillarNotes: [],
      contextAdjustments: [],
      fragilityNotes: [],
      sustainabilityNotes: [],
    },
    trust: {},
    identity: resolvedIdentity,
    ...overrides,
  };
}

describe('Rankings v2 canonical identity contract', () => {
  test('uses an explicit breaking revision for nullable canonical-only playerId', () => {
    expect(RANKINGS_V2_CONTRACT_VERSION).toBe('v2-canonical-identity-2026-08-09');
  });

  test('accepts a coherent resolved identity', () => {
    expect(rankingsV2ItemSchema.safeParse(item()).success).toBe(true);
  });

  test.each([
    ['mismatched playerId', item({ playerId: 'different-player' })],
    ['null playerId on a linkable row', item({ playerId: null })],
    [
      'non-null playerId on an unresolved row',
      item({
        playerId: 'raw-source-id',
        identity: {
          status: 'unresolved',
          canonicalId: null,
          sourceId: '00-0099999',
          sourceType: 'gsis',
          reason: 'gsis_not_in_identity_map',
          linkable: false,
        },
      }),
    ],
    [
      'unresolved status claiming linkable true',
      item({
        playerId: null,
        identity: {
          status: 'unresolved',
          canonicalId: null,
          sourceId: '00-0099999',
          sourceType: 'gsis',
          reason: 'gsis_not_in_identity_map',
          linkable: true,
        },
      }),
    ],
    [
      'resolved status without a canonical id',
      item({
        playerId: null,
        identity: { ...resolvedIdentity, canonicalId: null },
      }),
    ],
    [
      'resolved status carrying an unresolved reason',
      item({
        identity: { ...resolvedIdentity, reason: 'gsis_ambiguous_duplicate_crosswalk_rows' },
      }),
    ],
    [
      'canonical status whose sourceId differs from its canonicalId',
      item({
        playerId: 'canonical-player',
        identity: {
          status: 'canonical',
          canonicalId: 'canonical-player',
          sourceId: 'different-source',
          sourceType: 'canonical',
          reason: null,
          linkable: true,
        },
      }),
    ],
  ])('rejects %s', (_label, payload) => {
    expect(rankingsV2ItemSchema.safeParse(payload).success).toBe(false);
  });

  test('accepts an unresolved row only as null/non-linkable', () => {
    const parsed = rankingsV2ItemSchema.safeParse(item({
      playerId: null,
      identity: {
        status: 'unresolved',
        canonicalId: null,
        sourceId: '00-0099999',
        sourceType: 'gsis',
        reason: 'gsis_not_in_identity_map',
        linkable: false,
      },
    }));
    expect(parsed.success).toBe(true);
  });

  test('rejects duplicate ranks so composite UI row keys cannot collide', () => {
    const parsed = rankingsV2ResponseSchema.safeParse({
      contractVersion: RANKINGS_V2_CONTRACT_VERSION,
      mode: 'weekly',
      lens: 'lineup_decision',
      horizon: 'week',
      asOf: '2026-08-09T00:00:00.000Z',
      sourceStack: [],
      items: [item({ rank: 1 }), item({ rank: 1, playerName: 'Different Player' })],
      trust: {},
      identityCoverage: {
        total: 2,
        canonical: 0,
        resolved: 2,
        unresolved: 0,
        ambiguous: 0,
        coverageRatio: 1,
        byReason: {},
      },
    });

    expect(parsed.success).toBe(false);
  });
});
