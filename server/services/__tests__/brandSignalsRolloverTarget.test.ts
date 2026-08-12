const mockEmit = jest.fn();
const mockRecordJobExecution = jest.fn();

jest.mock('../BrandBus', () => ({
  brandBus: {
    emit: mockEmit,
    register: jest.fn(),
    healthCheck: jest.fn(),
    getPluginsInfo: jest.fn().mockReturnValue([]),
  },
}));
jest.mock('../MonitoringService', () => ({
  MonitoringService: {
    getInstance: () => ({ recordJobExecution: mockRecordJobExecution }),
  },
}));

import { brandSignalsIntegration } from '../BrandSignalsIntegration';

describe('Brand signal rollover governed target', () => {
  const integration = brandSignalsIntegration as any;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.clearAllMocks();
    mockEmit.mockResolvedValue(undefined);
    mockRecordJobExecution.mockResolvedValue(undefined);
    integration.isInitialized = true;
    integration.lastKnownWeek = 16;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('January rollover emits the governed 2026 Week 17 event', async () => {
    jest.setSystemTime(new Date('2027-01-05T12:00:00.000Z'));

    await integration.checkWeekRollover();

    expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'DATASET.ROLL_WEEK',
      season: 2026,
      week: 17,
      previousWeek: 16,
      seasonType: 'regular',
    }));
    expect(integration.lastKnownWeek).toBe(17);
  });

  test.each([
    '2026-08-12T12:00:00.000Z',
    '2028-03-01T12:00:00.000Z',
  ])('preseason/stale rollover checks fail before signal writes at %s', async (now) => {
    jest.setSystemTime(new Date(now));

    await integration.checkWeekRollover();

    expect(mockEmit).not.toHaveBeenCalled();
    expect(integration.lastKnownWeek).toBe(16);
    expect(mockRecordJobExecution).toHaveBeenCalledWith(
      'brand_signals_week_rollover',
      'error',
      0,
      expect.objectContaining({ error: expect.any(String) }),
    );
  });
});
