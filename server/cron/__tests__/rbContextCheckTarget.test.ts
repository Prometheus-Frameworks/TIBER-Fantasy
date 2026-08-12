const mockSchedule = jest.fn();
const mockStoreRbContextMetrics = jest.fn();
const mockCalculateTiberAdjustedEpa = jest.fn();
const mockGetRbContextComparison = jest.fn();

jest.mock('node-cron', () => ({
  __esModule: true,
  default: { schedule: mockSchedule },
}));
jest.mock('../../services/rbContextCheck', () => ({
  rbContextCheckService: {
    storeRbContextMetrics: mockStoreRbContextMetrics,
    calculateTiberAdjustedEpa: mockCalculateTiberAdjustedEpa,
    getRbContextComparison: mockGetRbContextComparison,
  },
}));

import { setupRBContextCheckCron } from '../rbContextCheck';

describe('RB Context Check governed target', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.clearAllMocks();
    mockStoreRbContextMetrics.mockResolvedValue(undefined);
    mockCalculateTiberAdjustedEpa.mockResolvedValue(undefined);
    mockGetRbContextComparison.mockResolvedValue({
      summary: {
        totalRbs: 0,
        avgRawEpa: 0,
        avgAdjEpa: 0,
        avgDifference: 0,
      },
      dataQuality: {
        hasDuplicates: false,
        adjustedLastCalculated: new Date('2027-01-05T12:00:00.000Z'),
        isStale: false,
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function runScheduledCallback(): Promise<void> {
    setupRBContextCheckCron();
    const callback = mockSchedule.mock.calls[0]?.[1] as (() => Promise<void>) | undefined;
    expect(callback).toBeDefined();
    await callback!();
  }

  test('January rollover writes derived RB evidence only for football season 2026', async () => {
    jest.setSystemTime(new Date('2027-01-05T12:00:00.000Z'));

    await runScheduledCallback();

    expect(mockStoreRbContextMetrics).toHaveBeenCalledWith(2026);
    expect(mockCalculateTiberAdjustedEpa).toHaveBeenCalledWith(2026);
    expect(mockGetRbContextComparison).toHaveBeenCalledWith(2026);
  });

  test.each([
    '2026-08-12T12:00:00.000Z',
    '2028-03-01T12:00:00.000Z',
  ])('preseason/stale defaults fail before RB evidence writes at %s', async (now) => {
    jest.setSystemTime(new Date(now));

    await runScheduledCallback();

    expect(mockStoreRbContextMetrics).not.toHaveBeenCalled();
    expect(mockCalculateTiberAdjustedEpa).not.toHaveBeenCalled();
    expect(mockGetRbContextComparison).not.toHaveBeenCalled();
  });
});
