import fs from 'node:fs';
import path from 'node:path';

const GOVERNED_DEFAULT_FILES = [
  'server/cron/weeklyUpdate.ts',
  'server/cron/scheduleSync.ts',
  'server/etl/CoreWeekIngest.ts',
  'server/etl/nightlyBuysSellsUpdate.ts',
  'server/routes/etlRoutes.ts',
  'server/routes/nightlyProcessingRoutes.ts',
  'server/routes/buysSellsRoutes.ts',
  'server/routes/systemCurrentWeekRoute.ts',
  'server/ingest/nflfastr.ts',
  'server/adapters/SleeperAdapter.ts',
  'server/adapters/ECRAdapter.ts',
  'server/adapters/NFLDataPyAdapter.ts',
  'server/adapters/MySportsFeedsAdapter.ts',
  'server/services/UPHScheduler.ts',
  'server/services/IntelligentScheduler.ts',
  'server/services/UPHCoordinator.ts',
  'server/services/GoldLayerService.ts',
  'server/processors/facts/SeasonFactsProcessor.ts',
  'server/routes/uphAdminRoutes.ts',
  'server/services/sleeperSyncV2/syncService.ts',
  'server/services/sleeperSyncV2/scheduler.ts',
  'server/routes/sleeperSyncV2Routes.ts',
  'server/services/SeasonService.ts',
  'server/cron/injurySync.ts',
  'server/cron/rbContextCheck.ts',
] as const;

describe('governed evidence-default source tripwire', () => {
  test.each(GOVERNED_DEFAULT_FILES)(
    '%s cannot re-import the legacy shared/config/seasons default',
    (relativePath) => {
      const source = fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
      expect(source).not.toMatch(/shared\/config\/seasons/);
      expect(source).not.toMatch(/CURRENT_NFL_SEASON/);
    },
  );

  test.each([
    'server/services/UPHCoordinator.ts',
    'server/services/GoldLayerService.ts',
  ])('%s cannot restore the legacy 2025 UPH fallback', (relativePath) => {
    const source = fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
    expect(source).not.toMatch(/(?:scope|filters)\.season\s*\|\|\s*2025/);
  });

  test('SeasonFacts quality cannot restore wall-clock math from the 2025 kickoff', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'server/processors/facts/SeasonFactsProcessor.ts'),
      'utf8',
    );
    expect(source).not.toContain("new Date('2025-09-04')");
    expect(source).toContain('resolveSeasonQualityEvidenceWeek');
  });

  test('Sleeper ownership sync cannot restore wall-year season/week derivation', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'server/services/sleeperSyncV2/syncService.ts'),
      'utf8',
    );
    expect(source).not.toMatch(/getCurrentNfl(?:Season|Week)/);
    expect(source).not.toMatch(/getFullYear\s*\(/);
    expect(source).toContain('resolveSourceObservedTarget');
  });

  test('SeasonService final fallback cannot restore wall-year estimation', () => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'server/services/SeasonService.ts'),
      'utf8',
    );
    expect(source).not.toContain('estimateCurrentWeek');
    expect(source).not.toMatch(/getFullYear\s*\(/);
    expect(source).toContain('resolveSourceObservedTarget');
  });
});
