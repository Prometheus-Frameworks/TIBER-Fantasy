jest.mock('../../infra/db', () => ({
  db: {},
}));

import { CURRENT_SEASON } from '../../config/season';
import { ADPSyncService } from '../../adpSyncService';
import { SLEEPER_API_SOURCES } from '../projections/sleeperProjectionsService';

describe('season-aware ingestion URLs', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('uses CURRENT_SEASON for each Sleeper projection URL', () => {
    expect(SLEEPER_API_SOURCES.BASE_PROJECTIONS).toContain(`/nfl/${CURRENT_SEASON}?`);
    expect(SLEEPER_API_SOURCES.WEEKLY_PROJECTIONS).toContain(`/nfl/${CURRENT_SEASON}/`);
    expect(SLEEPER_API_SOURCES.WORKING_PROJECTIONS).toContain(`/nfl/${CURRENT_SEASON}/`);

    expect(SLEEPER_API_SOURCES.BASE_PROJECTIONS).not.toContain('/nfl/2024');
    expect(SLEEPER_API_SOURCES.WEEKLY_PROJECTIONS).not.toContain('/nfl/2024');
    expect(SLEEPER_API_SOURCES.WORKING_PROJECTIONS).not.toContain('/nfl/2024');
  });

  test('uses CURRENT_SEASON for the ESPN ADP request without changing its parsing', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ players: [] }),
    } as Response);
    const service = new ADPSyncService({
      source: 'espn',
      syncInterval: 6,
      rateLimit: 100,
      enabled: false,
    });

    await (service as unknown as { fetchESPNADP(): Promise<unknown> }).fetchESPNADP();

    expect(fetchSpy).toHaveBeenCalledWith(
      `https://fantasy.espn.com/apis/v3/games/ffl/seasons/${CURRENT_SEASON}/segments/0/leagues/0?view=kona_player_info`,
    );
  });
});
