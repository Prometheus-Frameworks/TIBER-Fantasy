import express from 'express';
import request from 'supertest';

const mockTriggerDatasetCommitted = jest.fn();
const mockSeasonCurrent = jest.fn();
const mockRecordJobExecution = jest.fn();
const mockDeleteWhere = jest.fn();
const mockSelectWhere = jest.fn();

jest.mock('drizzle-orm', () => ({
  ...jest.requireActual('drizzle-orm'),
  eq: (column: { name?: string }, value: unknown) => ({
    __kind: 'eq' as const,
    column: column?.name ?? '',
    value,
  }),
  and: (...clauses: unknown[]) => ({ __kind: 'and' as const, clauses }),
  gte: (column: { name?: string }, value: unknown) => ({
    __kind: 'gte' as const,
    column: column?.name ?? '',
    value,
  }),
  count: () => ({ __kind: 'count' as const }),
}));

jest.mock('../../infra/db', () => ({
  db: {
    delete: jest.fn(() => ({ where: mockDeleteWhere })),
    select: jest.fn(() => ({
      from: jest.fn(() => ({ where: mockSelectWhere })),
    })),
    insert: jest.fn(),
  },
}));
jest.mock('../../services/BrandSignalsIntegration', () => ({
  BrandSignalsIntegration: {
    getInstance: () => ({ triggerDatasetCommitted: mockTriggerDatasetCommitted }),
  },
}));
jest.mock('../../services/SeasonService', () => ({
  SeasonService: class {
    current = mockSeasonCurrent;
  },
}));
jest.mock('../../services/MonitoringService', () => ({
  MonitoringService: {
    getInstance: () => ({
      recordJobExecution: mockRecordJobExecution,
      getHealthStatus: jest.fn(),
    }),
  },
}));
jest.mock('../../services/BrandBus', () => ({
  brandBus: { emit: jest.fn() },
}));

import { AdminService } from '../../services/AdminService';
import {
  handleAdminBrandReplay,
  handleAdminBrandStream,
} from '../adminBrandRoutes';

type Predicate = {
  __kind: 'and';
  clauses: Array<{ __kind: string; column?: string; value?: unknown }>;
};

function expectExactTarget(predicate: unknown, season: number, week: number): void {
  const clauses = (predicate as Predicate).clauses;
  expect(clauses).toEqual(expect.arrayContaining([
    expect.objectContaining({ __kind: 'eq', column: 'season', value: season }),
    expect.objectContaining({ __kind: 'eq', column: 'week', value: week }),
  ]));
}

describe('admin brand evidence target boundary', () => {
  let service: AdminService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2027-01-05T12:00:00.000Z'));
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.clearAllMocks();

    mockSeasonCurrent.mockResolvedValue({
      season: 2025,
      week: 18,
      seasonType: 'post',
      source: 'db',
    });
    mockTriggerDatasetCommitted.mockResolvedValue(undefined);
    mockRecordJobExecution.mockResolvedValue(undefined);
    mockDeleteWhere.mockResolvedValue({ rowCount: 2 });
    mockSelectWhere.mockResolvedValue([{ count: 3 }]);
    service = new AdminService();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function complete<T>(operation: Promise<T>): Promise<T> {
    await jest.runAllTimersAsync();
    return operation;
  }

  function createApp() {
    const app = express();
    app.use(express.json());
    app.post('/api/admin/brand/replay', (req, res) =>
      handleAdminBrandReplay(req, res, service));
    app.post('/api/admin/brand/stream', (req, res) =>
      handleAdminBrandStream(req, res, service));
    return app;
  }

  test('stream ignores a stale DB observation and writes/queries/receipts as 2026 Week 17', async () => {
    const response = await complete(service.streamBrandSignals({
      brands: ['redraft'],
      targetDatasets: ['gold_player_week'],
    }));

    expect(mockSeasonCurrent).not.toHaveBeenCalled();
    expect(mockTriggerDatasetCommitted).toHaveBeenCalledWith(
      'gold_player_week',
      2026,
      17,
      1000,
      'admin_stream',
      expect.stringMatching(/^admin-stream-gold_player_week-/),
    );
    expectExactTarget(mockSelectWhere.mock.calls[0][0], 2026, 17);
    expect(response).toMatchObject({
      success: true,
      season: 2026,
      week: 17,
      results: { eventsTriggered: 1, totalSignalsGenerated: 3 },
    });
    expect(mockRecordJobExecution).toHaveBeenCalledWith(
      'admin_brand_streaming',
      'success',
      expect.any(Number),
      expect.objectContaining({ season: 2026, week: 17 }),
    );
  });

  test('matching season-only replay resolves before an exact force delete', async () => {
    const response = await complete(service.replayBrandSignals({
      brand: 'redraft',
      season: 2026,
      forceRecompute: true,
    }));

    expect(mockSeasonCurrent).not.toHaveBeenCalled();
    expectExactTarget(mockDeleteWhere.mock.calls[0][0], 2026, 17);
    expectExactTarget(mockSelectWhere.mock.calls[0][0], 2026, 17);
    expect(mockTriggerDatasetCommitted).toHaveBeenCalledWith(
      'gold_player_week',
      2026,
      17,
      1000,
      'admin_replay',
      expect.stringMatching(/^admin-replay-redraft-/),
    );
    expect(response).toMatchObject({
      success: true,
      season: 2026,
      week: 17,
      results: { signalsCleared: 2, newSignalsGenerated: 3 },
    });
  });

  test('a fully explicit archive pair remains valid after the configured calendar', async () => {
    jest.setSystemTime(new Date('2028-03-01T12:00:00.000Z'));

    const response = await complete(service.replayBrandSignals({
      brand: 'dynasty',
      season: 2025,
      week: 18,
      forceRecompute: true,
    }));

    expectExactTarget(mockDeleteWhere.mock.calls[0][0], 2025, 18);
    expect(mockTriggerDatasetCommitted).toHaveBeenCalledWith(
      'gold_player_week',
      2025,
      18,
      1000,
      'admin_replay',
      expect.any(String),
    );
    expect(response).toMatchObject({ success: true, season: 2025, week: 18 });
  });

  test('the mounted replay boundary returns 400 for an archive half-pair before mutation', async () => {
    const response = await request(createApp())
      .post('/api/admin/brand/replay')
      .send({ brand: 'redraft', season: 2025, forceRecompute: true });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('provide both season and week');
    expect(mockDeleteWhere).not.toHaveBeenCalled();
    expect(mockSelectWhere).not.toHaveBeenCalled();
    expect(mockTriggerDatasetCommitted).not.toHaveBeenCalled();
    expect(mockRecordJobExecution).toHaveBeenCalledWith(
      'admin_brand_replay',
      'error',
      expect.any(Number),
      expect.objectContaining({
        request: expect.objectContaining({ season: 2025 }),
      }),
    );
    expect(mockRecordJobExecution.mock.calls[0][3]).not.toHaveProperty('week');
  });

  test.each([
    '2026-08-12T12:00:00.000Z',
    '2028-03-01T12:00:00.000Z',
  ])('the mounted stream boundary fails closed before evidence mutation at %s', async (now) => {
    jest.setSystemTime(new Date(now));

    const response = await request(createApp())
      .post('/api/admin/brand/stream')
      .send({ brands: ['redraft'], targetDatasets: ['gold_player_week'] });

    expect(response.status).toBe(503);
    expect(mockDeleteWhere).not.toHaveBeenCalled();
    expect(mockSelectWhere).not.toHaveBeenCalled();
    expect(mockTriggerDatasetCommitted).not.toHaveBeenCalled();
    expect(mockRecordJobExecution).toHaveBeenCalledWith(
      'admin_brand_streaming',
      'error',
      expect.any(Number),
      expect.objectContaining({ request: expect.any(Object) }),
    );
    expect(mockRecordJobExecution.mock.calls[0][3]).not.toHaveProperty('season');
    expect(mockRecordJobExecution.mock.calls[0][3]).not.toHaveProperty('week');
  });

  test.each([
    '2026-08-12T12:00:00.000Z',
    '2028-03-01T12:00:00.000Z',
  ])('a season-only replay also fails closed before force deletion at %s', async (now) => {
    jest.setSystemTime(new Date(now));

    const response = await request(createApp())
      .post('/api/admin/brand/replay')
      .send({ brand: 'redraft', season: 2026, forceRecompute: true });

    expect(response.status).toBe(503);
    expect(mockDeleteWhere).not.toHaveBeenCalled();
    expect(mockSelectWhere).not.toHaveBeenCalled();
    expect(mockTriggerDatasetCommitted).not.toHaveBeenCalled();
  });
});
