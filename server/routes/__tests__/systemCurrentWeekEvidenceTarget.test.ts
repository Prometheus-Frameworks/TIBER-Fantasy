import express from 'express';
import request from 'supertest';
import { systemCurrentWeekHandler } from '../systemCurrentWeekRoute';

const app = express();
app.get('/api/system/current-week', systemCurrentWeekHandler);

describe('/api/system/current-week evidence target observability', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2031-10-01T12:00:00.000Z'));
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('post-calendar additive envelopes do not leak the synthetic newest-plus-one season', async () => {
    const response = await request(app).get('/api/system/current-week');

    expect(response.status).toBe(200);
    expect(response.body.configStatus).toBe('stale_calendar_config');
    // Rolling compatibility: these legacy numeric/display fields keep their
    // deployed shape. Phase-aware consumers use the nullable target/envelopes.
    expect(response.body.season).toBe(2027);
    expect(response.body.seasonPhaseLabel).toBe('2027 · Offseason');
    expect(response.body.targetSeason).toBeNull();
    expect(response.body.upcomingWeek).toBeNull();
    expect(response.body.evidenceIngestionTarget).toEqual(expect.objectContaining({
      available: false,
      code: 'calendar_unavailable',
      configuredSeason: 2026,
      phaseSeason: null,
    }));
    expect(response.body.seasonConfigAgreement).toMatchObject({
      agrees: false,
      presentationSeason: 2027,
      resolvedPresentationSeason: null,
    });
    expect(JSON.stringify({
      evidenceIngestionTarget: response.body.evidenceIngestionTarget,
      resolvedPresentationSeason:
        response.body.seasonConfigAgreement.resolvedPresentationSeason,
    })).not.toContain('2027');
  });
});
