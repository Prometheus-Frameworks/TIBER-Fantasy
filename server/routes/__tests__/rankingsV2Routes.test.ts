jest.mock('../../infra/db', () => ({ db: {} }));

jest.mock('../../modules/forge/forgeGradeCache', () => ({
  CACHE_VERSION: 'v1',
  getGradesFromCache: jest.fn(),
}));

import express from 'express';
import request from 'supertest';
import { rankingsV2ResponseSchema, RANKINGS_V2_CONTRACT_VERSION } from '../../contracts/rankingsV2';
import { createRankingsV2Router } from '../rankingsV2Routes';
import { getGradesFromCache } from '../../modules/forge/forgeGradeCache';

const mockedGetGradesFromCache = getGradesFromCache as jest.MockedFunction<typeof getGradesFromCache>;

describe('GET /api/rankings/v2/weekly', () => {
  it('returns a valid rankings v2 payload with canonical mode metadata', async () => {
    mockedGetGradesFromCache.mockResolvedValueOnce({
      season: 2025,
      asOfWeek: 17,
      position: 'WR',
      version: 'v1',
      computedAt: new Date('2026-01-01T12:00:00.000Z'),
      players: [
        {
          playerId: '00-abc',
          playerName: 'Test WR',
          position: 'WR',
          nflTeam: 'MIN',
          alpha: 91.4,
          rawAlpha: 89.8,
          tier: 'T1',
          confidence: 86,
          gamesPlayed: 16,
          volumeScore: 88,
          efficiencyScore: 85,
          teamContextScore: 79,
          stabilityScore: 82,
          trajectory: 'rising',
          footballLensIssues: ['Route tree volatility'],
        },
      ],
    } as any);

    const app = express();
    app.use('/api/rankings/v2', createRankingsV2Router());

    const res = await request(app).get('/api/rankings/v2/weekly?season=2025&position=WR&asOfWeek=17');
    expect(res.status).toBe(200);

    const parsed = rankingsV2ResponseSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);

    expect(res.body.contractVersion).toBe(RANKINGS_V2_CONTRACT_VERSION);
    expect(res.body.mode).toBe('weekly');
    expect(res.body.lens).toBe('lineup_decision');
    expect(res.body.horizon).toBe('week');
    expect(res.body.sourceStack[0].layer).toBe('forge');

    const firstItem = res.body.items[0];
    expect(firstItem).toMatchObject({
      rank: 1,
      playerId: '00-abc',
      playerName: 'Test WR',
      position: 'WR',
      team: 'MIN',
      tier: 'T1',
      score: 91.4,
      value: 89.8,
    });
    expect(firstItem.explanation.pillarNotes.length).toBeGreaterThan(0);
    expect(firstItem.explanation.pillars).toEqual([
      { id: 'volume', value: 88, impact: 'neutral' },
      { id: 'efficiency', value: 85, impact: 'neutral' },
      { id: 'teamContext', value: 79, impact: 'neutral' },
      { id: 'stability', value: 82, impact: 'neutral' },
    ]);
    expect(firstItem.explanation.riskSignals).toEqual([{ type: 'football_lens_issue', message: 'Route tree volatility' }]);
    expect(firstItem.trust.confidence).toBe(86);
    expect(firstItem.uiMeta).toMatchObject({
      subscores: {
        volume: 88,
        efficiency: 85,
        teamContext: 79,
        stability: 82,
      },
      confidence: 86,
      gamesPlayed: 16,
      trajectory: 'rising',
      footballLensIssues: ['Route tree volatility'],
    });
  });

  it('preserves cache-empty operator guidance in trust/source metadata', async () => {
    mockedGetGradesFromCache.mockResolvedValueOnce({
      season: 2025,
      asOfWeek: 17,
      position: 'WR',
      version: 'v1',
      computedAt: null,
      players: [],
    } as any);

    const app = express();
    app.use('/api/rankings/v2', createRankingsV2Router());

    const res = await request(app).get('/api/rankings/v2/weekly?season=2025&position=WR&asOfWeek=17');
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.trust.stabilityNote).toBe('forge_cache_empty_uncomputed');
    expect(res.body.trust.sampleNote).toContain('/api/forge/compute-grades');
    expect(String(res.body.sourceStack[0].notes)).toContain('forge_cache_empty_uncomputed');
  });

  it('degrades safely when optional explanation inputs are missing', async () => {
    mockedGetGradesFromCache.mockResolvedValueOnce({
      season: 2025,
      asOfWeek: 17,
      position: 'WR',
      version: 'v1',
      computedAt: new Date('2026-01-02T00:00:00.000Z'),
      players: [
        {
          playerId: '00-def',
          playerName: 'Sparse WR',
          position: 'WR',
          nflTeam: 'FA',
          alpha: 72.1,
          rawAlpha: 70.2,
          tier: 'T4',
          confidence: null,
          gamesPlayed: null,
          volumeScore: null,
          efficiencyScore: undefined,
          teamContextScore: 'not-a-number',
          stabilityScore: 47,
          footballLensIssues: [null, 42, ''],
        },
      ],
    } as any);

    const app = express();
    app.use('/api/rankings/v2', createRankingsV2Router());

    const res = await request(app).get('/api/rankings/v2/weekly?season=2025&position=WR&asOfWeek=17');
    expect(res.status).toBe(200);

    const parsed = rankingsV2ResponseSchema.safeParse(res.body);
    expect(parsed.success).toBe(true);

    const firstItem = res.body.items[0];
    expect(firstItem.explanation.pillars).toEqual([
      { id: 'volume', value: null, impact: 'neutral' },
      { id: 'efficiency', value: null, impact: 'neutral' },
      { id: 'teamContext', value: null, impact: 'neutral' },
      { id: 'stability', value: 47, impact: 'neutral' },
    ]);
    expect(firstItem.explanation.riskSignals).toEqual([]);
    expect(firstItem.uiMeta.subscores).toEqual({
      volume: null,
      efficiency: null,
      teamContext: null,
      stability: 47,
    });
  });
});
