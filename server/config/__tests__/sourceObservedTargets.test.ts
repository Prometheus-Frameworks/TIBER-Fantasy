jest.mock('../../infra/db', () => ({ db: {} }));

import {
  InvalidSourceObservedTargetError,
  SourceObservedTargetUnavailableError,
  resolveSourceObservedDefaultTarget,
  resolveSourceObservedTarget,
} from '../season';
import {
  buildOwnershipEventValues,
  syncLeague,
} from '../../services/sleeperSyncV2/syncService';

describe('source-observed season/week targeting', () => {
  test('preseason roster movement is attributed to the configured phase target', () => {
    expect(resolveSourceObservedDefaultTarget(
      new Date('2026-08-12T12:00:00.000Z'),
      2026,
    )).toEqual({
      available: true,
      target: { season: 2026, week: 1 },
    });
  });

  test('January wall-clock rollover stays on the in-flight 2026 week, not the forward week', () => {
    expect(resolveSourceObservedDefaultTarget(
      new Date('2027-01-05T12:00:00.000Z'),
      2026,
    )).toEqual({
      available: true,
      target: { season: 2026, week: 17 },
    });
  });

  test('stale calendar and configured-season mismatch fail closed without synthetic years', () => {
    const stale = resolveSourceObservedDefaultTarget(
      new Date('2031-10-01T12:00:00.000Z'),
      2031,
    );
    expect(stale).toMatchObject({
      available: false,
      code: 'calendar_unavailable',
      phaseSeason: null,
    });
    expect(JSON.stringify(stale)).not.toContain('2027');

    expect(resolveSourceObservedDefaultTarget(
      new Date('2026-08-12T12:00:00.000Z'),
      2025,
    )).toMatchObject({
      available: false,
      code: 'season_mismatch',
      phaseSeason: 2026,
    });

    expect(() => resolveSourceObservedTarget({
      now: new Date('2031-10-01T12:00:00.000Z'),
      configuredSeason: 2031,
    })).toThrow(SourceObservedTargetUnavailableError);
  });

  test('a fully explicit archive pair is honored even when live phase state is unavailable', () => {
    expect(resolveSourceObservedTarget({
      season: 2025,
      week: 18,
      now: new Date('2031-10-01T12:00:00.000Z'),
    })).toEqual({ season: 2025, week: 18 });
  });

  test.each([
    { season: 2026 },
    { week: 1 },
  ])('partial explicit pair is rejected atomically: %p', (input) => {
    expect(() => resolveSourceObservedTarget({
      ...input,
      now: new Date('2026-08-12T12:00:00.000Z'),
    })).toThrow(InvalidSourceObservedTargetError);
  });

  test('ownership write rows consume the target as a pair', () => {
    const [row] = buildOwnershipEventValues(
      'league-1',
      [{
        playerKey: 'gsis-1',
        fromTeamId: null,
        toTeamId: '7',
        eventType: 'ADD',
      }],
      4,
      { season: 2026, week: 17 },
    );

    expect(row).toMatchObject({
      league_id: 'league-1',
      player_key: 'gsis-1',
      season: 2026,
      week: 17,
      source: 'sleeper',
    });
  });

  test('the active sync boundary rejects stale implicit targeting before touching the database', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2031-10-01T12:00:00.000Z'));
    try {
      await expect(syncLeague('league-1')).rejects.toBeInstanceOf(
        SourceObservedTargetUnavailableError,
      );
    } finally {
      jest.useRealTimers();
    }
  });
});
