import express from 'express';
import request from 'supertest';
import { resolveNflfastrSeasonToDateWeekBound } from '../../ingest/nflfastrSeasonBounds';
import {
  handleWeeklySync,
  type WeeklySyncDependencies,
} from '../weeklySyncRoute';

function createHarness() {
  const fetchSeasonToDate = jest.fn().mockResolvedValue([]);
  const fetchWeeklyFromNflfastR = jest.fn().mockResolvedValue([]);
  const upsertWeeklyStats = jest.fn().mockResolvedValue({ inserted: 0, updated: 0 });
  const dependencies: WeeklySyncDependencies = {
    loadNflfastR: jest.fn().mockResolvedValue({
      fetchSeasonToDate,
      fetchWeeklyFromNflfastR,
      resolveSeasonToDateWeekBound: resolveNflfastrSeasonToDateWeekBound,
    }),
    upsertWeeklyStats,
  };
  const app = express();
  app.use(express.json());
  app.post('/api/weekly/sync', (req, res) => handleWeeklySync(req, res, dependencies));

  return {
    app,
    fetchSeasonToDate,
    fetchWeeklyFromNflfastR,
    upsertWeeklyStats,
  };
}

describe('POST /api/weekly/sync target boundary', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-12T12:00:00.000Z'));
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('season-only 2024 sync uses the supported completed archive through Week 18', async () => {
    const harness = createHarness();

    const response = await request(harness.app)
      .post('/api/weekly/sync')
      .send({ season: 2024 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, season: 2024, week: 'all' });
    expect(harness.fetchSeasonToDate).toHaveBeenCalledWith(2024, 18);
    expect(harness.fetchWeeklyFromNflfastR).not.toHaveBeenCalled();
    expect(harness.upsertWeeklyStats).toHaveBeenCalledTimes(1);
  });

  test('unknown season-only targets fail before fetching or mutation', async () => {
    const harness = createHarness();

    const response = await request(harness.app)
      .post('/api/weekly/sync')
      .send({ season: 2027 });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('no completed NFLfastR archive bound');
    expect(harness.fetchSeasonToDate).not.toHaveBeenCalled();
    expect(harness.fetchWeeklyFromNflfastR).not.toHaveBeenCalled();
    expect(harness.upsertWeeklyStats).not.toHaveBeenCalled();
  });

  test('an explicit live season in preseason resolves to zero elapsed weeks, not Week 1', async () => {
    const harness = createHarness();

    const response = await request(harness.app)
      .post('/api/weekly/sync')
      .send({ season: 2026 });

    expect(response.status).toBe(200);
    expect(harness.fetchSeasonToDate).toHaveBeenCalledWith(2026, 0);
    expect(harness.fetchWeeklyFromNflfastR).not.toHaveBeenCalled();
  });

  test('an omitted preseason target fails closed before fetching or mutation', async () => {
    const harness = createHarness();

    const response = await request(harness.app)
      .post('/api/weekly/sync')
      .send({});

    expect(response.status).toBe(503);
    expect(harness.fetchSeasonToDate).not.toHaveBeenCalled();
    expect(harness.fetchWeeklyFromNflfastR).not.toHaveBeenCalled();
    expect(harness.upsertWeeklyStats).not.toHaveBeenCalled();
  });

  test('an omitted stale-calendar target fails closed before fetching or mutation', async () => {
    jest.setSystemTime(new Date('2028-03-01T12:00:00.000Z'));
    const harness = createHarness();

    const response = await request(harness.app)
      .post('/api/weekly/sync')
      .send({});

    expect(response.status).toBe(503);
    expect(harness.fetchSeasonToDate).not.toHaveBeenCalled();
    expect(harness.fetchWeeklyFromNflfastR).not.toHaveBeenCalled();
    expect(harness.upsertWeeklyStats).not.toHaveBeenCalled();
  });

  test('the no-argument January default remains one atomic 2026 Week 17 tuple', async () => {
    jest.setSystemTime(new Date('2027-01-05T12:00:00.000Z'));
    const harness = createHarness();

    const response = await request(harness.app)
      .post('/api/weekly/sync')
      .send({});

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, season: 2026, week: 'all' });
    expect(harness.fetchSeasonToDate).toHaveBeenCalledWith(2026, 17);
  });

  test('a fully explicit archive pair remains exact', async () => {
    const harness = createHarness();

    const response = await request(harness.app)
      .post('/api/weekly/sync')
      .send({ season: 2024, week: 7 });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ success: true, season: 2024, week: 7 });
    expect(harness.fetchWeeklyFromNflfastR).toHaveBeenCalledWith(2024, 7);
    expect(harness.fetchSeasonToDate).not.toHaveBeenCalled();
  });

  test('a nonmatching week-only request cannot borrow the live season', async () => {
    jest.setSystemTime(new Date('2027-01-05T12:00:00.000Z'));
    const harness = createHarness();

    const response = await request(harness.app)
      .post('/api/weekly/sync')
      .send({ week: 5 });

    expect(response.status).toBe(400);
    expect(harness.fetchWeeklyFromNflfastR).not.toHaveBeenCalled();
    expect(harness.fetchSeasonToDate).not.toHaveBeenCalled();
    expect(harness.upsertWeeklyStats).not.toHaveBeenCalled();
  });
});
