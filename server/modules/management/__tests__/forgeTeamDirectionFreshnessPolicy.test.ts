import {
  buildTeamDirectionForgeFreshnessReceipt,
  isAcceptedTeamDirectionForgeFreshnessReceipt,
  TEAM_DIRECTION_FORGE_FRESHNESS_MAX_AGE_DAYS,
  TEAM_DIRECTION_FORGE_FRESHNESS_POLICY_ID,
  TEAM_DIRECTION_FORGE_FRESHNESS_RECEIPT_VERSION,
} from '../forgeTeamDirectionFreshnessPolicy';

const NOW = new Date('2026-08-02T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;

function availableArtifact(overrides: Record<string, unknown> = {}) {
  return {
    state: 'available' as const,
    available: true,
    code: null,
    sourcePath: 'server/artifacts/external/forge/forge_player_static_v1.json',
    contractVersion: 'forge_player_static_v1',
    generatedAt: new Date(NOW.getTime() - DAY_MS).toISOString(),
    generatedAtSource: 'root_generated_at' as const,
    promotedAt: null,
    freshness: { status: 'fresh', ageDays: 1, timestamp: null, maxAgeDays: 45 },
    ...overrides,
  };
}

const roster = [
  {
    rosterKey: 'player-1',
    canonicalId: 'tiber:player:1',
    name: 'Explicit Player',
    pos: 'WR',
    alpha: 72.5,
    forgeScoreSource: 'player_specific',
    forgeScoreProvenance: { source: 'player_specific', artifactId: 'FORGE_PLAYER_STATIC_V1' },
  },
  {
    rosterKey: 'player-2',
    canonicalId: 'tiber:player:2',
    name: 'Missing Provenance Player',
    pos: 'RB',
    alpha: 61,
    forgeScoreSource: null,
  },
];

describe(TEAM_DIRECTION_FORGE_FRESHNESS_POLICY_ID, () => {
  it('accepts through exactly 45 elapsed UTC days and preserves explicit raw evidence', () => {
    const generatedAt = new Date(NOW.getTime() - TEAM_DIRECTION_FORGE_FRESHNESS_MAX_AGE_DAYS * DAY_MS).toISOString();
    const receipt = buildTeamDirectionForgeFreshnessReceipt({
      artifact: availableArtifact({ generatedAt }),
      rosterPlayers: roster,
      now: NOW,
    });

    expect(receipt).toMatchObject({
      receiptVersion: TEAM_DIRECTION_FORGE_FRESHNESS_RECEIPT_VERSION,
      policyId: TEAM_DIRECTION_FORGE_FRESHNESS_POLICY_ID,
      decision: 'accepted',
      status: 'fresh',
      reasonCode: 'accepted_fresh',
      clocks: {
        clockSource: 'root.generated_at',
        generatedAtSource: 'root_generated_at',
        generatedAt,
        promotedAtCanRefreshClock: false,
        ageDays: 45,
        maximumAgeDays: 45,
        boundary: 'elapsed_utc_time',
      },
      evidence: {
        rosterTotal: 2,
        observedForgeRows: 2,
        observedPlayerSpecificRows: 1,
        eligiblePlayerSpecificRows: 1,
        rejectedPlayerSpecificRows: 0,
      },
    });
    expect(receipt.evidence.rows).toEqual(expect.arrayContaining([
      expect.objectContaining({
        playerName: 'Explicit Player',
        alpha: 72.5,
        scoreSource: 'player_specific',
        provenance: expect.objectContaining({ artifactId: 'FORGE_PLAYER_STATIC_V1' }),
      }),
    ]));
    expect(receipt.gaps).toContain('forge_rows_without_explicit_player_specific_provenance');
  });

  it('rejects one millisecond beyond 45 elapsed days as warning', () => {
    const receipt = buildTeamDirectionForgeFreshnessReceipt({
      artifact: availableArtifact({ generatedAt: new Date(NOW.getTime() - 45 * DAY_MS - 1).toISOString() }),
      rosterPlayers: roster,
      now: NOW,
    });

    expect(receipt).toMatchObject({
      decision: 'rejected',
      status: 'warning',
      reasonCode: 'root_generated_at_warning',
      evidence: {
        observedPlayerSpecificRows: 1,
        eligiblePlayerSpecificRows: 0,
        rejectedPlayerSpecificRows: 1,
      },
    });
  });

  it('rejects timestamps older than 90 elapsed days as stale', () => {
    const receipt = buildTeamDirectionForgeFreshnessReceipt({
      artifact: availableArtifact({ generatedAt: new Date(NOW.getTime() - 91 * DAY_MS).toISOString() }),
      rosterPlayers: roster,
      now: NOW,
    });

    expect(receipt).toMatchObject({
      decision: 'rejected',
      status: 'stale',
      reasonCode: 'root_generated_at_stale',
    });
  });

  it('keeps the exact 90-day boundary in warning and turns stale one millisecond later', () => {
    const exactNinety = buildTeamDirectionForgeFreshnessReceipt({
      artifact: availableArtifact({ generatedAt: new Date(NOW.getTime() - 90 * DAY_MS).toISOString() }),
      rosterPlayers: roster,
      now: NOW,
    });
    const afterNinety = buildTeamDirectionForgeFreshnessReceipt({
      artifact: availableArtifact({ generatedAt: new Date(NOW.getTime() - 90 * DAY_MS - 1).toISOString() }),
      rosterPlayers: roster,
      now: NOW,
    });

    expect(exactNinety).toMatchObject({ decision: 'rejected', status: 'warning', reasonCode: 'root_generated_at_warning' });
    expect(afterNinety).toMatchObject({ decision: 'rejected', status: 'stale', reasonCode: 'root_generated_at_stale' });
  });

  it('accepts a root generated_at equal to the request evaluation clock', () => {
    const receipt = buildTeamDirectionForgeFreshnessReceipt({
      artifact: availableArtifact({ generatedAt: NOW.toISOString() }),
      rosterPlayers: roster,
      now: NOW,
    });

    expect(receipt).toMatchObject({ decision: 'accepted', status: 'fresh', clocks: { ageSeconds: 0, ageDays: 0 } });
  });

  it.each([
    ['missing', null, 'missing', 'root_generated_at_missing'],
    ['malformed', 'not-a-timestamp', 'malformed', 'root_generated_at_malformed'],
    ['timezone missing', '2026-08-01T12:00:00', 'malformed', 'root_generated_at_malformed'],
    ['invalid calendar day', '2026-04-31T00:00:00.000Z', 'malformed', 'root_generated_at_malformed'],
    ['invalid hour', '2026-08-01T24:00:00.000Z', 'malformed', 'root_generated_at_malformed'],
    ['future', '2026-08-02T12:00:00.001Z', 'future', 'root_generated_at_future'],
  ])('rejects a %s root generated_at', (_label, generatedAt, status, reasonCode) => {
    const receipt = buildTeamDirectionForgeFreshnessReceipt({
      artifact: availableArtifact({ generatedAt }),
      rosterPlayers: roster,
      now: NOW,
    });

    expect(receipt).toMatchObject({ decision: 'rejected', status, reasonCode });
    expect(receipt.evidence.eligiblePlayerSpecificRows).toBe(0);
  });

  it('never lets promoted_at substitute for a missing root generated_at', () => {
    const promotedAt = new Date(NOW.getTime() - DAY_MS).toISOString();
    const receipt = buildTeamDirectionForgeFreshnessReceipt({
      artifact: availableArtifact({ generatedAt: null, promotedAt }),
      rosterPlayers: roster,
      now: NOW,
    });

    expect(receipt).toMatchObject({
      decision: 'rejected',
      status: 'missing',
      reasonCode: 'root_generated_at_missing',
      clocks: { generatedAt: null, promotedAt, promotedAtCanRefreshClock: false },
    });
    expect(receipt.conflicts).toContain('promoted_at_present_but_ineligible_to_refresh_clock');
  });

  it('rejects a cached generatedAt value whose root provenance marker is absent', () => {
    const receipt = buildTeamDirectionForgeFreshnessReceipt({
      artifact: availableArtifact({ generatedAtSource: null }),
      rosterPlayers: roster,
      now: NOW,
    });

    expect(receipt).toMatchObject({
      decision: 'rejected',
      status: 'unknown',
      reasonCode: 'root_generated_at_source_unknown',
      clocks: { generatedAtSource: null },
    });
    expect(isAcceptedTeamDirectionForgeFreshnessReceipt(receipt)).toBe(false);
  });

  it('does not accept a receipt whose accepted decision lacks the root clock marker', () => {
    const accepted = buildTeamDirectionForgeFreshnessReceipt({
      artifact: availableArtifact(),
      rosterPlayers: roster,
      now: NOW,
    });
    const withoutRootMarker = {
      ...accepted,
      clocks: { ...accepted.clocks, generatedAtSource: null },
    };

    expect(isAcceptedTeamDirectionForgeFreshnessReceipt(withoutRootMarker)).toBe(false);
  });

  it.each([
    ['artifact unavailable', (receipt: ReturnType<typeof buildTeamDirectionForgeFreshnessReceipt>) => ({
      ...receipt,
      artifact: { ...receipt.artifact, available: false, state: 'missing' },
    })],
    ['generated_at future relative to evaluated_at', (receipt: ReturnType<typeof buildTeamDirectionForgeFreshnessReceipt>) => ({
      ...receipt,
      clocks: { ...receipt.clocks, generatedAt: '2026-08-03T12:00:00.000Z' },
    })],
  ])('rejects a semantically inconsistent accepted receipt with %s', (_label, mutate) => {
    const accepted = buildTeamDirectionForgeFreshnessReceipt({
      artifact: availableArtifact(),
      rosterPlayers: roster,
      now: NOW,
    });

    expect(isAcceptedTeamDirectionForgeFreshnessReceipt(mutate(accepted))).toBe(false);
  });

  it.each([
    ['missing', 'missing'],
    ['malformed', 'malformed'],
    ['disabled', 'unknown'],
  ])('rejects an unavailable %s artifact', (state, status) => {
    const receipt = buildTeamDirectionForgeFreshnessReceipt({
      artifact: availableArtifact({ state, available: false }),
      rosterPlayers: roster,
      now: NOW,
    });

    expect(receipt).toMatchObject({
      decision: 'rejected',
      status,
      reasonCode: 'artifact_unavailable',
      evidence: { eligiblePlayerSpecificRows: 0 },
    });
  });
});
