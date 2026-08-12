const mockRunIncrementalProcessing = jest.fn();
const mockRunWeeklyProcessing = jest.fn();
const mockSeasonCurrent = jest.fn();

jest.mock('../../infra/db', () => ({ db: {} }));
jest.mock('../UPHCoordinator', () => ({
  UPHCoordinator: {
    getInstance: () => ({
      runIncrementalProcessing: mockRunIncrementalProcessing,
      runWeeklyProcessing: mockRunWeeklyProcessing,
    }),
  },
}));
jest.mock('../MonitoringService', () => ({
  MonitoringService: {
    getInstance: () => ({}),
  },
}));
jest.mock('../SeasonService', () => ({
  SeasonService: class {
    current = mockSeasonCurrent;
  },
}));
jest.mock('../BrandSignalsIntegration', () => ({
  brandSignalsIntegration: {
    triggerDatasetCommitted: jest.fn(),
  },
}));

import { intelligentScheduler } from '../IntelligentScheduler';
import { EvidenceIngestionTargetUnavailableError } from '../../config/season';

const systemLoad = {
  cpuPercent: 20,
  memoryPercent: 30,
  databaseConnections: 1,
  activeJobs: 0,
  errorRate: 0,
  averageProcessingTime: 1,
};

const slaMetrics = {
  targetProcessingTime: 1_000,
  actualProcessingTime: 100,
  targetErrorRate: 0.05,
  actualErrorRate: 0,
  targetFreshness: 60,
  actualFreshness: 1,
  slaCompliance: 1,
};

const successfulJob = {
  jobId: 'weekly-job',
  status: 'SUCCESS',
  totalTasks: 1,
  successfulTasks: 1,
  failedTasks: 0,
  skippedTasks: 0,
  duration: 1,
  stats: {
    recordsProcessed: 1,
    payloadsIngested: 1,
    transformationsApplied: 1,
    qualityChecksRun: 1,
    qualityChecksPassed: 1,
    qualityChecksFailed: 0,
    averageProcessingTime: 1,
    dataVolumeBytes: 1,
    memoryUsagePeak: 1,
  },
};

const JanuaryFreshness = [{
  dataset: 'gold_player_week',
  season: 2025,
  week: 18,
  lastCommit: new Date('2027-01-05T11:00:00.000Z'),
  lastProcessing: null,
  staleness: 'critical' as const,
  recommendedAction: 'urgent' as const,
}];

describe('IntelligentScheduler weekly evidence target', () => {
  const scheduler = intelligentScheduler as any;
  const recordScheduleTrigger = jest.fn();
  const updateScheduleState = jest.fn();
  const clearBackoff = jest.fn();
  const applyBackoff = jest.fn();
  const adjustScheduleFrequency = jest.fn();
  const triggerBrandRecompute = jest.fn();

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
    mockRunWeeklyProcessing.mockResolvedValue(successfulJob);
    mockRunIncrementalProcessing.mockResolvedValue(successfulJob);

    scheduler.isInBackoff = jest.fn().mockReturnValue(false);
    scheduler.getCurrentSystemLoad = jest.fn().mockResolvedValue(systemLoad);
    scheduler.calculateSLAMetrics = jest.fn().mockResolvedValue(slaMetrics);
    scheduler.checkDataFreshness = jest.fn().mockResolvedValue(JanuaryFreshness);
    scheduler.shouldTriggerProcessing = jest.fn().mockReturnValue({
      trigger: true,
      reason: 'test freshness trigger',
      action: 'triggered_processing',
    });
    scheduler.recordScheduleTrigger = recordScheduleTrigger.mockResolvedValue(undefined);
    scheduler.getScheduleState = jest.fn().mockResolvedValue(null);
    scheduler.updateScheduleState = updateScheduleState.mockResolvedValue(undefined);
    scheduler.clearBackoff = clearBackoff;
    scheduler.applyBackoff = applyBackoff.mockResolvedValue(undefined);
    scheduler.adjustScheduleFrequency = adjustScheduleFrequency.mockResolvedValue(undefined);
    scheduler.triggerBrandRecompute = triggerBrandRecompute.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function executeCycle(scheduleKey: 'weekly_processing' | 'incremental_processing'): Promise<void> {
    const config = scheduler.scheduleConfigs.get(scheduleKey);
    await scheduler.executeIntelligentScheduleCycle(scheduleKey, config);
  }

  test('a stale 2025 observation cannot steer the January 2027 weekly writer', async () => {
    await executeCycle('weekly_processing');

    expect(mockSeasonCurrent).not.toHaveBeenCalled();
    expect(mockRunWeeklyProcessing).toHaveBeenCalledWith(
      2026,
      17,
      expect.objectContaining({ sources: ['sleeper', 'nfl_data_py', 'fantasypros'] }),
    );
    expect(recordScheduleTrigger).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleKey: 'weekly_processing',
        success: true,
        season: 2026,
        week: 17,
      }),
    );
  });

  test('a normal regular-season cycle forwards the governed target', async () => {
    jest.setSystemTime(new Date('2026-10-10T12:00:00.000Z'));

    await executeCycle('weekly_processing');

    expect(mockRunWeeklyProcessing).toHaveBeenCalledWith(
      2026,
      5,
      expect.any(Object),
    );
  });

  test('a failed weekly job records the same governed target it attempted', async () => {
    mockRunWeeklyProcessing.mockRejectedValueOnce(new Error('weekly write failed'));

    await expect(executeCycle('weekly_processing')).rejects.toThrow('weekly write failed');

    expect(mockRunWeeklyProcessing).toHaveBeenCalledWith(2026, 17, expect.any(Object));
    expect(recordScheduleTrigger).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleKey: 'weekly_processing',
        success: false,
        season: 2026,
        week: 17,
        errorDetails: 'weekly write failed',
      }),
    );
  });

  test('incremental processing and its receipt share the one governed target', async () => {
    await executeCycle('incremental_processing');

    expect(mockSeasonCurrent).not.toHaveBeenCalled();
    expect(mockRunIncrementalProcessing).toHaveBeenCalledWith(
      new Date('2027-01-05T06:00:00.000Z'),
      expect.any(Object),
      { season: 2026, week: 17 },
    );
    expect(recordScheduleTrigger).toHaveBeenCalledWith(
      expect.objectContaining({
        scheduleKey: 'incremental_processing',
        season: 2026,
        week: 17,
      }),
    );
  });

  test.each([
    '2026-08-12T12:00:00.000Z',
    '2028-03-01T12:00:00.000Z',
  ])('an unavailable governed target fails before weekly writes at %s', async (now) => {
    jest.setSystemTime(new Date(now));

    await expect(executeCycle('weekly_processing')).rejects.toBeInstanceOf(
      EvidenceIngestionTargetUnavailableError,
    );
    expect(mockRunWeeklyProcessing).not.toHaveBeenCalled();
    expect(recordScheduleTrigger).not.toHaveBeenCalled();
    expect(updateScheduleState).not.toHaveBeenCalled();
    expect(applyBackoff).toHaveBeenCalledTimes(1);
  });

  test('brand recompute and its signal/receipt use the governed target', async () => {
    await scheduler.triggerIntelligentProcessing(
      'brand_recompute',
      'triggered_processing',
      {
        freshnessStates: JanuaryFreshness,
        systemLoad,
        slaMetrics,
        reason: 'read-side observation regression',
      },
    );

    expect(mockSeasonCurrent).not.toHaveBeenCalled();
    expect(triggerBrandRecompute).toHaveBeenCalledWith([
      expect.objectContaining({ season: 2026, week: 17 }),
    ]);
    expect(recordScheduleTrigger).toHaveBeenCalledWith(
      expect.objectContaining({ season: 2026, week: 17 }),
    );
  });

  test('the freshness reader still uses source-observed SeasonService context', async () => {
    const readScheduler = intelligentScheduler as any;
    readScheduler.seasonService = { current: mockSeasonCurrent };
    readScheduler.checkDataFreshness = Object.getPrototypeOf(readScheduler).checkDataFreshness;
    jest.spyOn(readScheduler, 'getDatasetsForSchedule').mockReturnValue([]);

    await expect(readScheduler.checkDataFreshness('unknown_read_only')).resolves.toEqual([]);
    expect(mockSeasonCurrent).toHaveBeenCalledTimes(1);
  });
});
