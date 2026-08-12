import express from 'express';
import request from 'supertest';

const mockIngestWeeklyData = jest.fn().mockResolvedValue({
  playersProcessed: 10,
  positionCoverage: { QB: 1, RB: 2, WR: 5, TE: 2 },
});
const mockCoreHealthCheck = jest.fn().mockResolvedValue({ status: 'healthy', details: {} });
const mockProcessSpecificWeek = jest.fn().mockResolvedValue({
  totalRecords: 12,
  positionsProcessed: ['QB', 'RB', 'WR', 'TE'],
  formatsProcessed: ['redraft'],
  duration: 1,
  errors: [],
});
const mockProcessNightly = jest.fn().mockResolvedValue({
  week: 17,
  season: 2026,
  totalRecords: 12,
  positionsProcessed: ['QB', 'RB', 'WR', 'TE'],
  formatsProcessed: ['redraft'],
  duration: 1,
  errors: [],
});
const mockNightlyHealthCheck = jest.fn().mockResolvedValue({ status: 'healthy', details: {} });
const mockGetRawPayloads = jest.fn().mockResolvedValue([]);
const mockSleeperIngest = jest.fn().mockResolvedValue({ playerPayloadId: 41 });
const mockEcrIngest = jest.fn();
const mockComputeAll = jest.fn().mockResolvedValue(undefined);
const mockComputeOne = jest.fn().mockResolvedValue([]);

jest.mock('../../middleware/adminAuth', () => ({
  requireAdminAuth: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
jest.mock('../../middleware/rateLimit', () => ({
  rateLimiters: {
    heavyOperation: (_req: unknown, _res: unknown, next: () => void) => next(),
    statusCheck: (_req: unknown, _res: unknown, next: () => void) => next(),
  },
}));
jest.mock('../../infra/db', () => ({ db: {} }));
jest.mock('../../etl/CoreWeekIngest', () => ({
  coreWeekIngestETL: {
    ingestWeeklyData: mockIngestWeeklyData,
    healthCheck: mockCoreHealthCheck,
  },
}));
jest.mock('../../etl/nightlyBuysSellsUpdate', () => ({
  nightlyBuysSellsETL: {
    processSpecificWeek: mockProcessSpecificWeek,
    processNightlyBuysSells: mockProcessNightly,
    healthCheck: mockNightlyHealthCheck,
  },
}));
jest.mock('../../services/PlayerIdentityService', () => ({
  playerIdentityService: { getSystemStats: jest.fn() },
}));
jest.mock('../../services/PlayerIdentityMigration', () => ({
  playerIdentityMigration: { getMigrationStatus: jest.fn() },
}));
jest.mock('../../services/BronzeLayerService', () => ({
  bronzeLayerService: {
    getRawPayloads: mockGetRawPayloads,
    getDataSourceStats: jest.fn().mockResolvedValue([]),
    updatePayloadStatus: jest.fn().mockResolvedValue(undefined),
    updateBatchPayloadStatus: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('../../services/SilverLayerService', () => ({
  silverLayerService: {
    processBronzeToSilver: jest.fn().mockResolvedValue({
      processed: 0,
      success: 0,
      errors: 0,
      skipped: 0,
      errorDetails: [],
      tableResults: {},
    }),
  },
}));
jest.mock('../../adapters/SleeperAdapter', () => ({
  sleeperAdapter: { ingestFullCycle: mockSleeperIngest },
}));
jest.mock('../../adapters/ECRAdapter', () => ({
  ecrAdapter: { ingestFullCycle: mockEcrIngest },
}));
jest.mock('../../compute', () => ({
  computeBuysSellsForAllPositions: mockComputeAll,
  computeBuysSellsForWeek: mockComputeOne,
  SCORE_CONFIG: {},
}));

import etlRoutes from '../../routes/etlRoutes';
import buysSellsRoutes from '../../routes/buysSellsRoutes';
import { nightlyProcessingRoutes } from '../../routes/nightlyProcessingRoutes';

const app = express();
app.use(express.json());
app.use('/api/etl', etlRoutes);
app.use('/api/buys-sells', buysSellsRoutes);
app.use('/api/nightly', nightlyProcessingRoutes);

describe('active ingestion routes use one governed season/week pair', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2027-01-05T12:00:00.000Z'));
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.clearAllMocks();
    mockGetRawPayloads.mockResolvedValue([]);
    mockSleeperIngest.mockResolvedValue({ playerPayloadId: 41 });
    mockIngestWeeklyData.mockResolvedValue({
      playersProcessed: 10,
      positionCoverage: { QB: 1, RB: 2, WR: 5, TE: 2 },
    });
    mockProcessSpecificWeek.mockResolvedValue({
      totalRecords: 12,
      positionsProcessed: ['QB', 'RB', 'WR', 'TE'],
      formatsProcessed: ['redraft'],
      duration: 1,
      errors: [],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('core/full defaults use 2026 Week 17 after the wall clock enters 2027', async () => {
    const response = await request(app).post('/api/etl/full-pipeline').send({});

    expect(response.status).toBe(200);
    expect(mockIngestWeeklyData).toHaveBeenCalledWith(17, 2026);
    expect(mockProcessSpecificWeek).toHaveBeenCalledWith(17, 2026);
    expect(response.body.data).toMatchObject({ week: 17, season: 2026 });
  });

  test('preseason defaults fail closed while a fully explicit archive pair is honored', async () => {
    jest.setSystemTime(new Date('2026-08-12T12:00:00.000Z'));

    const unavailable = await request(app).post('/api/etl/full-pipeline').send({});
    expect(unavailable.status).toBe(503);
    expect(mockIngestWeeklyData).not.toHaveBeenCalled();

    const explicit = await request(app)
      .post('/api/etl/full-pipeline')
      .send({ season: 2025, week: 18 });
    expect(explicit.status).toBe(200);
    expect(mockIngestWeeklyData).toHaveBeenCalledWith(18, 2025);
    expect(mockProcessSpecificWeek).toHaveBeenCalledWith(18, 2025);
  });

  test('a half-explicit archive season is rejected instead of borrowing the live week', async () => {
    const response = await request(app)
      .post('/api/etl/full-pipeline')
      .send({ season: 2025 });

    expect(response.status).toBe(400);
    expect(mockIngestWeeklyData).not.toHaveBeenCalled();
  });

  test('a half-explicit nondefault week is rejected instead of borrowing the live season', async () => {
    const response = await request(app)
      .post('/api/etl/full-pipeline')
      .send({ week: 5 });

    expect(response.status).toBe(400);
    expect(mockIngestWeeklyData).not.toHaveBeenCalled();
  });

  test('bronze ingestion and bronze-to-silver receive the same January football tuple', async () => {
    const ingest = await request(app).post('/api/etl/bronze-ingest').send({});
    expect(ingest.status).toBe(200);
    expect(mockSleeperIngest).toHaveBeenCalledWith(
      expect.objectContaining({ season: 2026, week: 17 }),
    );

    const process = await request(app).post('/api/etl/bronze-to-silver').send({});
    expect(process.status).toBe(200);
    expect(mockGetRawPayloads).toHaveBeenCalledWith(
      expect.objectContaining({ season: 2026, week: 17 }),
    );
  });

  test('the admin buys/sells compute default is no longer pinned to 2025', async () => {
    const response = await request(app).post('/api/buys-sells/compute').send({});

    expect(response.status).toBe(200);
    expect(mockComputeAll).toHaveBeenCalledWith(17, 2026);
    expect(response.body.meta).toMatchObject({ week: 17, season: 2026 });
  });

  test('nightly health reports the governed pair and becomes unavailable in preseason', async () => {
    const January = await request(app).get('/api/nightly/buys-sells/health');
    expect(January.status).toBe(200);
    expect(January.body.data).toMatchObject({ currentWeek: 17, season: 2026 });

    jest.setSystemTime(new Date('2026-08-12T12:00:00.000Z'));
    const preseason = await request(app).get('/api/nightly/buys-sells/health');
    expect(preseason.status).toBe(503);
  });
});
