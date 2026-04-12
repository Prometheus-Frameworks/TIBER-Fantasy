import express from 'express';
import { AddressInfo } from 'net';

jest.mock('../../modules/externalModels/scoring/scoringService', () => ({
  scoringService: {
    getWeeklyRankings: jest.fn(),
  },
}));

jest.mock('../../modules/forge/forgeGradeCache', () => ({
  CACHE_VERSION: 'test-version',
  getGradesFromCache: jest.fn(),
}));

import { createRankingsV2Router } from '../rankingsV2Routes';
import { scoringService } from '../../modules/externalModels/scoring/scoringService';
import { getGradesFromCache } from '../../modules/forge/forgeGradeCache';

const mockedScoringService = scoringService as jest.Mocked<typeof scoringService>;
const mockedCache = getGradesFromCache as jest.MockedFunction<typeof getGradesFromCache>;

async function call(path: string) {
  const app = express();
  app.use('/api/rankings/v2', createRankingsV2Router());
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`);
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

describe('rankingsV2Routes scoring integration', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockedCache.mockResolvedValue({ players: [], computedAt: new Date('2026-04-12T00:00:00.000Z'), asOfWeek: 5 } as any);
  });

  it('uses scoring weekly rankings when available', async () => {
    mockedScoringService.getWeeklyRankings.mockResolvedValue({
      ok: true,
      data: {
        asOf: '2026-04-12T00:00:00.000Z',
        items: [
          {
            rank: 1,
            playerId: '00-0036322',
            playerName: 'Justin Jefferson',
            team: 'MIN',
            position: 'WR',
            expectedPoints: 20.1,
            vorp: 3.4,
            floor: 12.8,
            ceiling: 30.1,
            confidenceBand: 'high',
            weeklyOutlook: 'Strong WR1 outlook.',
          },
        ],
      },
    } as any);

    const res = await call('/api/rankings/v2/weekly?season=2025&position=WR&asOfWeek=5');

    expect(res.status).toBe(200);
    expect(res.body.items[0].score).toBe(20.1);
    expect(res.body.items[0].value).toBe(3.4);
    expect(res.body.items[0].explanation.placementSummary).toContain('WR1');
    expect(mockedCache).toHaveBeenCalled();
  });

  it('falls back to FORGE cache when scoring service is unavailable', async () => {
    mockedScoringService.getWeeklyRankings.mockResolvedValue({ ok: false, code: 'upstream_unavailable', message: 'down' } as any);
    mockedCache.mockResolvedValue({
      players: [
        {
          playerId: '00-0036322',
          playerName: 'Justin Jefferson',
          position: 'WR',
          nflTeam: 'MIN',
          tier: 'T1',
          alpha: 90,
          rawAlpha: 88,
        },
      ],
      computedAt: new Date('2026-04-12T00:00:00.000Z'),
      asOfWeek: 5,
    } as any);

    const res = await call('/api/rankings/v2/weekly?season=2025&position=WR&asOfWeek=5');

    expect(res.status).toBe(200);
    expect(res.body.items[0].playerName).toBe('Justin Jefferson');
    expect(mockedCache).toHaveBeenCalled();
  });
});
