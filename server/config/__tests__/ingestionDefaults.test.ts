jest.mock('../../infra/db', () => ({ db: {} }));
jest.mock('../../../src/data/resolvers/playerResolver', () => ({
  getAllPlayers: jest.fn(),
  resolvePlayer: jest.fn(),
}));
jest.mock('../../compute', () => ({
  computeBuysSellsForAllPositions: jest.fn().mockResolvedValue(undefined),
}));

import { computeBuysSellsForAllPositions } from '../../compute';
import { CoreWeekIngestETL } from '../../etl/CoreWeekIngest';
import { NightlyBuysSellsETL } from '../../etl/nightlyBuysSellsUpdate';
import { INGESTION_DEFAULT_SEASON } from '../season';

describe('active ingestion defaults use the season agreement source', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2027-01-05T12:00:00.000Z'));
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('Core Week no-season ingestion passes the configured default through the pipeline', async () => {
    const etl = new CoreWeekIngestETL();
    const internals = etl as unknown as Record<string, jest.Mock>;
    internals.fetchNFLStats = jest.fn().mockResolvedValue([]);
    internals.fetchECRData = jest.fn().mockResolvedValue([]);
    internals.fetchADPData = jest.fn().mockResolvedValue([]);
    internals.mergeDataSources = jest.fn().mockResolvedValue([]);
    internals.applyQualityFilters = jest.fn().mockResolvedValue([]);
    internals.validateDataQuality = jest.fn().mockResolvedValue(undefined);
    internals.computeAdvancedMetrics = jest.fn().mockResolvedValue([]);
    internals.upsertPlayerWeekFacts = jest.fn().mockResolvedValue(undefined);
    internals.calculateCrossReferenceRate = jest.fn().mockReturnValue(0);

    const result = await etl.ingestWeeklyData();

    expect(result.season).toBe(INGESTION_DEFAULT_SEASON);
    expect(result.week).toBe(17);
    expect(internals.fetchNFLStats).toHaveBeenCalledWith(17, INGESTION_DEFAULT_SEASON);
    expect(internals.computeAdvancedMetrics).toHaveBeenCalledWith([], 17, INGESTION_DEFAULT_SEASON);
  });

  test('nightly automated and week-specific no-season runs use the same configured default', async () => {
    const etl = new NightlyBuysSellsETL();
    const internals = etl as unknown as Record<string, jest.Mock>;
    internals.verifyPlayerDataFreshness = jest.fn().mockResolvedValue(undefined);
    internals.processAllCombinations = jest.fn().mockResolvedValue(undefined);
    internals.generateSummaryStats = jest.fn().mockResolvedValue(undefined);

    const nightly = await etl.processNightlyBuysSells();
    const specific = await etl.processSpecificWeek(8, INGESTION_DEFAULT_SEASON);

    expect(nightly).toMatchObject({ week: 17, season: INGESTION_DEFAULT_SEASON });
    expect(internals.verifyPlayerDataFreshness).toHaveBeenCalledWith(INGESTION_DEFAULT_SEASON, 17);
    expect(internals.generateSummaryStats).toHaveBeenNthCalledWith(1, {
      season: INGESTION_DEFAULT_SEASON,
      week: 17,
    });
    expect(specific).toMatchObject({ week: 8, season: INGESTION_DEFAULT_SEASON });
    expect(computeBuysSellsForAllPositions).toHaveBeenCalledWith(8, INGESTION_DEFAULT_SEASON);
    expect(internals.generateSummaryStats).toHaveBeenNthCalledWith(2, {
      season: INGESTION_DEFAULT_SEASON,
      week: 8,
    });
  });
});
