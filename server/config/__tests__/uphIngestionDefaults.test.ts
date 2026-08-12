jest.mock('../../infra/db', () => ({ db: {} }));

import { uphCoordinator } from '../../services/UPHCoordinator';
import { UPHScheduler } from '../../services/UPHScheduler';
import { resolveSeasonQualityEvidenceWeek } from '../../processors/facts/SeasonFactsProcessor';
import { EvidenceIngestionTargetUnavailableError } from '../season';

const SUCCESS_RESULT = {
  jobId: 'stub',
  status: 'SUCCESS',
  totalTasks: 0,
  successfulTasks: 0,
  failedTasks: 0,
  skippedTasks: 0,
  duration: 0,
  stats: {
    recordsProcessed: 0,
    payloadsIngested: 0,
    transformationsApplied: 0,
    qualityChecksRun: 0,
    qualityChecksPassed: 0,
    qualityChecksFailed: 0,
    averageProcessingTime: 0,
    dataVolumeBytes: 0,
    memoryUsagePeak: 0,
  },
} as const;

describe('UPH evidence defaults', () => {
  const coordinator = uphCoordinator as unknown as Record<string, any>;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('January incremental creation carries one 2026 Week 17 tuple through every DAG filter', async () => {
    jest.setSystemTime(new Date('2027-01-05T12:00:00.000Z'));

    const createJob = jest.spyOn(coordinator, 'createJob').mockResolvedValue(undefined);
    const executeDAG = jest.spyOn(coordinator, 'executeDAG').mockResolvedValue(SUCCESS_RESULT);
    jest.spyOn(coordinator, 'updateJobStatus').mockResolvedValue(undefined);

    await uphCoordinator.runIncrementalProcessing(new Date('2027-01-05T06:00:00.000Z'));

    expect(createJob).toHaveBeenCalledWith(
      expect.any(String),
      'INCREMENTAL',
      expect.objectContaining({ season: 2026, week: 17 }),
      {},
    );
    const scope = executeDAG.mock.calls[0][1];
    expect(scope).toMatchObject({ type: 'INCREMENTAL', season: 2026, week: 17 });

    await expect(coordinator.prepareBronzePayloads(scope, {})).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ season: 2026, week: 17 }),
      ]),
    );
    expect(coordinator.prepareGoldFilters(scope, {})).toMatchObject({
      season: 2026,
      weeks: [17],
      evidenceThroughWeek: 17,
    });
  });

  test('preseason implicit incremental processing fails before any job mutation', async () => {
    jest.setSystemTime(new Date('2026-08-12T12:00:00.000Z'));
    const createJob = jest.spyOn(coordinator, 'createJob').mockResolvedValue(undefined);
    const executeDAG = jest.spyOn(coordinator, 'executeDAG').mockResolvedValue(SUCCESS_RESULT);

    await expect(
      uphCoordinator.runIncrementalProcessing(new Date('2026-08-12T06:00:00.000Z')),
    ).rejects.toBeInstanceOf(EvidenceIngestionTargetUnavailableError);
    expect(createJob).not.toHaveBeenCalled();
    expect(executeDAG).not.toHaveBeenCalled();
  });

  test('the enabled incremental scheduler resolves the same tuple and also fails closed in preseason', () => {
    const scheduler = Object.create(UPHScheduler.prototype) as Record<string, any>;

    jest.setSystemTime(new Date('2027-01-05T12:00:00.000Z'));
    expect(scheduler.determineProcessingScope('INCREMENTAL')).toMatchObject({
      since: new Date('2027-01-05T06:00:00.000Z'),
      season: 2026,
      week: 17,
    });

    jest.setSystemTime(new Date('2026-08-12T12:00:00.000Z'));
    expect(() => scheduler.determineProcessingScope('INCREMENTAL'))
      .toThrow(EvidenceIngestionTargetUnavailableError);
  });

  test('explicit archive backfills carry their named season and no missing scope can reach Bronze/Gold', async () => {
    jest.setSystemTime(new Date('2026-08-12T12:00:00.000Z'));
    jest.spyOn(coordinator, 'createJob').mockResolvedValue(undefined);
    const executeDAG = jest.spyOn(coordinator, 'executeDAG').mockResolvedValue(SUCCESS_RESULT);
    jest.spyOn(coordinator, 'updateJobStatus').mockResolvedValue(undefined);

    await uphCoordinator.runBackfillProcessing(
      {
        start: new Date('2024-09-01T00:00:00.000Z'),
        end: new Date('2025-01-10T00:00:00.000Z'),
      },
      2024,
    );
    expect(executeDAG.mock.calls[0][1]).toMatchObject({ type: 'BACKFILL', season: 2024 });

    await expect(coordinator.prepareBronzePayloads({ type: 'INCREMENTAL' }, {}))
      .rejects.toThrow(/explicit, validated season/);
    expect(() => coordinator.prepareGoldFilters({ type: 'INCREMENTAL' }, {}))
      .toThrow(/explicit, validated season/);
  });
});

describe('SeasonFacts evidence-week quality basis', () => {
  const weeklyFacts = [{ week: 1 }, { week: 8 }, { week: 16 }];

  test('uses the 2026 configured calendar at the January wall-year rollover', () => {
    expect(resolveSeasonQualityEvidenceWeek({
      season: 2026,
      weeklyFacts,
      now: new Date('2027-01-05T12:00:00.000Z'),
    })).toBe(17);
  });

  test('an atomic job target wins while an unknown explicit archive uses observed extent', () => {
    expect(resolveSeasonQualityEvidenceWeek({
      season: 2026,
      weeklyFacts,
      evidenceThroughWeek: 12,
      now: new Date('2027-01-05T12:00:00.000Z'),
    })).toBe(12);
    expect(resolveSeasonQualityEvidenceWeek({
      season: 2024,
      weeklyFacts,
      now: new Date('2027-01-05T12:00:00.000Z'),
    })).toBe(16);
  });
});
