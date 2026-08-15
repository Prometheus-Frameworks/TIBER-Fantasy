/**
 * Fantasy #329 — the PlayersDimProcessor direct registry write must mint the
 * canonical tiber_player_id at birth, like every other insert path. A new
 * surviving row born without one would silently reopen the backfill
 * population after the one-time backfill has completed.
 */

const INSERTS: Record<string, unknown>[] = [];

jest.mock('../../infra/db', () => ({
  db: {
    insert: () => ({
      values: (value: Record<string, unknown>) => {
        INSERTS.push(value);
        return Promise.resolve();
      },
    }),
  },
}));

import { PlayersDimProcessor } from '../PlayersDimProcessor';
import { TIBER_PLAYER_ID_PATTERN } from '../../services/identity/tiberPlayerId';

describe('PlayersDimProcessor.upsertPlayer', () => {
  beforeEach(() => {
    INSERTS.length = 0;
  });

  test('a newly created identity row is born with a canonical tiber_player_id', async () => {
    // No existing identity resolves, so the processor takes the create path.
    const identityService = {
      getCanonicalId: jest.fn().mockResolvedValue(null),
      getByCanonicalId: jest.fn().mockResolvedValue(null),
    };
    const processor = new PlayersDimProcessor(identityService as any);

    const result = await (processor as any).upsertPlayer({
      canonicalId: null,
      fullName: 'Test Player',
      firstName: 'Test',
      lastName: 'Player',
      position: 'WR',
      nflTeam: 'WAS',
      externalIds: { nfl_data_py: '00-0099999' },
      confidence: 0.95,
      metadata: { source: 'nfl_data_py', lastUpdated: new Date(), isActive: true },
    });

    expect(result.created).toBe(true);
    expect(INSERTS).toHaveLength(1);
    expect(String(INSERTS[0].tiberPlayerId)).toMatch(TIBER_PLAYER_ID_PATTERN);
  });
});
