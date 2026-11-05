import {
  ExpertMockDraftSnapshotV0Schema,
  ExpertSignalEventV0Schema,
} from '../contracts';
import {
  SYNTHETIC_CORRECTION_EVENT,
  SYNTHETIC_MISSING_CONTEXT_EVENT,
  SYNTHETIC_NFL_MOCK,
  SYNTHETIC_REDRAFT_MOCK,
  SYNTHETIC_ROLE_INTERPRETATION_EVENT,
  SYNTHETIC_WEEKLY_RANKING_EVENT,
} from '../__fixtures__/expertSignals';

describe('ESE-0 strict expert signal contracts', () => {
  it('parses a valid weekly expert ranking event', () => {
    expect(ExpertSignalEventV0Schema.safeParse(SYNTHETIC_WEEKLY_RANKING_EVENT).success).toBe(true);
  });

  it('parses a valid role interpretation and append-only correction event', () => {
    expect(ExpertSignalEventV0Schema.safeParse(SYNTHETIC_ROLE_INTERPRETATION_EVENT).success).toBe(true);
    expect(ExpertSignalEventV0Schema.safeParse(SYNTHETIC_CORRECTION_EVENT).success).toBe(true);
  });

  it('fails closed on schema, type, timestamp, source-policy, and unknown-field violations', () => {
    expect(ExpertSignalEventV0Schema.safeParse({ ...SYNTHETIC_WEEKLY_RANKING_EVENT, schemaVersion: 'v999' }).success).toBe(false);
    expect(ExpertSignalEventV0Schema.safeParse({ ...SYNTHETIC_WEEKLY_RANKING_EVENT, signalType: 'HOT_TAKE' }).success).toBe(false);
    expect(ExpertSignalEventV0Schema.safeParse({ ...SYNTHETIC_WEEKLY_RANKING_EVENT, knownAt: undefined }).success).toBe(false);
    expect(ExpertSignalEventV0Schema.safeParse({ ...SYNTHETIC_WEEKLY_RANKING_EVENT, knownAt: 'yesterday' }).success).toBe(false);
    expect(ExpertSignalEventV0Schema.safeParse({ ...SYNTHETIC_WEEKLY_RANKING_EVENT, knownAt: '2026-13-40T25:61:61Z' }).success).toBe(false);
    expect(ExpertSignalEventV0Schema.safeParse({ ...SYNTHETIC_WEEKLY_RANKING_EVENT, sourcePolicyRef: '' }).success).toBe(false);
    expect(ExpertSignalEventV0Schema.safeParse({ ...SYNTHETIC_WEEKLY_RANKING_EVENT, probability: 0.72 }).success).toBe(false);
  });

  it('keeps knownAt at or after publication and retrieval clocks', () => {
    expect(ExpertSignalEventV0Schema.safeParse({
      ...SYNTHETIC_WEEKLY_RANKING_EVENT,
      knownAt: '2026-09-15T12:59:59Z',
    }).success).toBe(false);
    expect(ExpertSignalEventV0Schema.safeParse({
      ...SYNTHETIC_WEEKLY_RANKING_EVENT,
      knownAt: '2026-09-15T13:04:59Z',
    }).success).toBe(false);
  });

  it('rejects self-referential correction and supersession lineage', () => {
    expect(ExpertSignalEventV0Schema.safeParse({
      ...SYNTHETIC_WEEKLY_RANKING_EVENT,
      correctionOf: SYNTHETIC_WEEKLY_RANKING_EVENT.signalId,
    }).success).toBe(false);
    expect(ExpertSignalEventV0Schema.safeParse({
      ...SYNTHETIC_WEEKLY_RANKING_EVENT,
      supersedes: SYNTHETIC_WEEKLY_RANKING_EVENT.signalId,
    }).success).toBe(false);
  });

  it('preserves missing format/scoring context as explicit nulls', () => {
    const parsed = ExpertSignalEventV0Schema.parse(SYNTHETIC_MISSING_CONTEXT_EVENT);
    expect(parsed.format).toEqual({ leagueType: null, scoring: null, qbMode: null, rosterShape: null });
  });

  it('preserves ancestry without inventing independence weights', () => {
    const a = ExpertSignalEventV0Schema.parse(SYNTHETIC_WEEKLY_RANKING_EVENT);
    const b = ExpertSignalEventV0Schema.parse(SYNTHETIC_ROLE_INTERPRETATION_EVENT);
    expect(a.signalId).not.toBe(b.signalId);
    expect(a.independenceCluster).toBe(b.independenceCluster);
    expect(ExpertSignalEventV0Schema.safeParse({ ...SYNTHETIC_WEEKLY_RANKING_EVENT, independenceWeight: 0.5 }).success).toBe(false);
  });
});

describe('ESE-0 strict expert mock-draft contracts', () => {
  it('parses a valid fantasy redraft mock', () => {
    expect(ExpertMockDraftSnapshotV0Schema.safeParse(SYNTHETIC_REDRAFT_MOCK).success).toBe(true);
  });

  it('keeps NFL mocks explicitly typed as NFL mocks', () => {
    const parsed = ExpertMockDraftSnapshotV0Schema.parse(SYNTHETIC_NFL_MOCK);
    expect(parsed.mockType).toBe('nfl');
    expect(parsed.leagueFormat.scoring).toBeNull();
  });

  it('rejects duplicate overall picks, duplicate round/slot coordinates, and duplicate players', () => {
    const duplicateOverall = {
      ...SYNTHETIC_REDRAFT_MOCK,
      picks: [
        SYNTHETIC_REDRAFT_MOCK.picks[0],
        { ...SYNTHETIC_REDRAFT_MOCK.picks[1], overallPick: 1 },
      ],
    };
    expect(ExpertMockDraftSnapshotV0Schema.safeParse(duplicateOverall).success).toBe(false);

    const duplicateCoordinate = {
      ...SYNTHETIC_REDRAFT_MOCK,
      picks: [
        SYNTHETIC_REDRAFT_MOCK.picks[0],
        { ...SYNTHETIC_REDRAFT_MOCK.picks[1], overallPick: 2, round: 1, slot: 1 },
      ],
    };
    expect(ExpertMockDraftSnapshotV0Schema.safeParse(duplicateCoordinate).success).toBe(false);

    const duplicatePlayer = {
      ...SYNTHETIC_REDRAFT_MOCK,
      picks: [
        SYNTHETIC_REDRAFT_MOCK.picks[0],
        { ...SYNTHETIC_REDRAFT_MOCK.picks[1], playerId: SYNTHETIC_REDRAFT_MOCK.picks[0].playerId },
      ],
    };
    expect(ExpertMockDraftSnapshotV0Schema.safeParse(duplicatePlayer).success).toBe(false);
  });

  it('rejects zero/negative coordinates', () => {
    expect(ExpertMockDraftSnapshotV0Schema.safeParse({
      ...SYNTHETIC_REDRAFT_MOCK,
      picks: [{ ...SYNTHETIC_REDRAFT_MOCK.picks[0], overallPick: 0 }],
    }).success).toBe(false);
    expect(ExpertMockDraftSnapshotV0Schema.safeParse({
      ...SYNTHETIC_REDRAFT_MOCK,
      picks: [{ ...SYNTHETIC_REDRAFT_MOCK.picks[0], round: -1 }],
    }).success).toBe(false);
  });

  it('cannot relabel expert mock position as ADP', () => {
    expect(ExpertMockDraftSnapshotV0Schema.safeParse({
      ...SYNTHETIC_REDRAFT_MOCK,
      adp: 12.4,
    }).success).toBe(false);
    expect(ExpertMockDraftSnapshotV0Schema.safeParse({
      ...SYNTHETIC_REDRAFT_MOCK,
      picks: [{ ...SYNTHETIC_REDRAFT_MOCK.picks[0], adp: 1.0 }],
    }).success).toBe(false);
  });
});
