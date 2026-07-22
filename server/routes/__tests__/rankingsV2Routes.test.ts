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
jest.mock('../../modules/externalModels/scoring/scoringRequestMappers', () => ({
  toLeagueContextInput: jest.fn((input) => ({ season: input.season, week: input.week, scoringFormat: 'ppr', teams: 12 })),
  buildRankingsScoringInputs: jest.fn(),
  hasMeaningfulScoringInputs: jest.fn(),
}));

import { createRankingsV2Router } from '../rankingsV2Routes';
import { scoringService } from '../../modules/externalModels/scoring/scoringService';
import { getGradesFromCache } from '../../modules/forge/forgeGradeCache';
import { buildRankingsScoringInputs, hasMeaningfulScoringInputs } from '../../modules/externalModels/scoring/scoringRequestMappers';

const mockedScoringService = scoringService as jest.Mocked<typeof scoringService>;
const mockedCache = getGradesFromCache as jest.MockedFunction<typeof getGradesFromCache>;
const mockedBuildRankingsScoringInputs = buildRankingsScoringInputs as jest.MockedFunction<typeof buildRankingsScoringInputs>;
const mockedHasMeaningfulScoringInputs = hasMeaningfulScoringInputs as jest.MockedFunction<typeof hasMeaningfulScoringInputs>;

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
    mockedBuildRankingsScoringInputs.mockResolvedValue([
      ...Array.from({ length: 12 }).map((_, idx) => ({
        player_id: `00-0036${idx}`,
        player_name: `Player ${idx}`,
        position: 'WR',
        team: 'MIN',
        games_sampled: 5,
        routes_pg: 39,
        targets_pg: 10,
        fantasy_points_ppr_pg: 19.5,
      })),
    ]);
    mockedHasMeaningfulScoringInputs.mockReturnValue(true);
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
    expect(mockedScoringService.getWeeklyRankings).toHaveBeenCalledWith(
      expect.objectContaining({
        players: expect.arrayContaining([
          expect.objectContaining({
            games_sampled: 5,
            routes_pg: 39,
            targets_pg: 10,
          }),
        ]),
      }),
    );
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
    // The FORGE-cache fallback must be traceable back to *why* it engaged, so a real
    // scoring-service failure is never indistinguishable from a genuinely empty ranking.
    const forgeLayer = res.body.sourceStack.find((item: any) => item.layer === 'forge');
    expect(forgeLayer.notes).toContain('scoringFallbackReason=upstream_unavailable');
  });

  it('logs and falls back to FORGE cache when the scoring service returns a schema-invalid payload', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      mockedScoringService.getWeeklyRankings.mockResolvedValue({
        ok: true,
        data: {
          // Not a valid ISO datetime -> fails rankingsV2ResponseSchema's asOf validation.
          // This is malformed upstream data, not a genuine empty result, and must not be
          // silently absorbed without a trace.
          asOf: 'not-a-real-timestamp',
          items: [
            {
              rank: 1,
              playerId: '00-0036322',
              playerName: 'Justin Jefferson',
              team: 'MIN',
              position: 'WR',
              expectedPoints: 20.1,
              vorp: 3.4,
            },
          ],
        },
      } as any);
      mockedCache.mockResolvedValue({
        players: [
          { playerId: '00-0036322', playerName: 'Justin Jefferson', position: 'WR', nflTeam: 'MIN', tier: 'T1', alpha: 90, rawAlpha: 88 },
        ],
        computedAt: new Date('2026-04-12T00:00:00.000Z'),
        asOfWeek: 5,
      } as any);

      const res = await call('/api/rankings/v2/weekly?season=2025&position=WR&asOfWeek=5');

      expect(res.status).toBe(200);
      expect(res.body.items[0].playerName).toBe('Justin Jefferson');
      const forgeLayer = res.body.sourceStack.find((item: any) => item.layer === 'forge');
      expect(forgeLayer.notes).toContain('scoringFallbackReason=invalid_scoring_payload');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('scoring payload failed contract validation'));
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('does not prefer scoring rankings when mapped inputs are not meaningful', async () => {
    mockedBuildRankingsScoringInputs.mockResolvedValue([
      { player_id: '00-1', player_name: 'Thin Input WR', position: 'WR', team: 'FA', games_sampled: 1 } as any,
    ]);
    mockedHasMeaningfulScoringInputs.mockReturnValue(false);
    mockedCache.mockResolvedValue({
      players: [{ playerId: '00-1', playerName: 'Thin Input WR', position: 'WR', nflTeam: 'FA', tier: 'T5', alpha: 12, rawAlpha: 10 }],
      computedAt: new Date('2026-04-12T00:00:00.000Z'),
      asOfWeek: 5,
    } as any);

    const res = await call('/api/rankings/v2/weekly?season=2025&position=WR&asOfWeek=5');

    expect(res.status).toBe(200);
    expect(res.body.items[0].playerName).toBe('Thin Input WR');
    expect(mockedScoringService.getWeeklyRankings).not.toHaveBeenCalled();
    const forgeLayer = res.body.sourceStack.find((item: any) => item.layer === 'forge');
    expect(forgeLayer.notes).toContain('scoringFallbackReason=insufficient_coverage');
  });
});
