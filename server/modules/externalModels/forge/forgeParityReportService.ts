import stableStringify from 'json-stable-stringify';
import {
  ForgeParityFixture,
  forgeParityFixtures,
} from './fixtures/forgeParityFixtures';
import {
  ForgeParityFixtureResult,
  ForgeParityHarness,
  ForgeParitySummary,
  forgeParityHarness,
  summarizeForgeParityResults,
} from './forgeParityHarness';
import { ForgeService, forgeService } from './forgeService';

export interface ForgeParityReportSummary {
  totalFixtures: number;
  comparableCount: number;
  closeCount: number;
  driftCount: number;
  unavailableCount: number;
  notComparableCount: number;
  averageAbsoluteScoreDelta: number | null;
  worstScoreDelta: ForgeParitySummary['worstScoreDelta'];
}

export interface ForgeParityReport {
  generatedAt: string;
  integration: {
    enabled: boolean;
    baseUrlConfigured: boolean;
    endpointPath: string;
    timeoutMs: number;
    readiness: 'ready' | 'not_ready';
    startupConfigLogged: boolean;
    harnessRan: boolean;
    skippedReason: 'integration_disabled' | 'base_url_missing' | null;
  };
  summary: ForgeParityReportSummary;
  results: ForgeParityFixtureResult[];
}

function toReportSummary(summary: ForgeParitySummary): ForgeParityReportSummary {
  return {
    totalFixtures: summary.totalFixtures,
    comparableCount: summary.comparableCount,
    closeCount: summary.closeCount,
    driftCount: summary.driftCount,
    unavailableCount: summary.unavailableCount,
    notComparableCount: summary.notComparableCount,
    averageAbsoluteScoreDelta: summary.averageAbsoluteScoreDelta,
    worstScoreDelta: summary.worstScoreDelta,
  };
}

function createSkippedFixtureResult(
  fixture: ForgeParityFixture,
  skippedReason: NonNullable<ForgeParityReport['integration']['skippedReason']>,
): ForgeParityFixtureResult {
  const message = skippedReason === 'integration_disabled'
    ? 'External FORGE parity report skipped because the integration is disabled.'
    : 'External FORGE parity report skipped because FORGE_SERVICE_BASE_URL is not configured.';

  return {
    fixtureId: fixture.id,
    fixtureName: fixture.name,
    fixtureNote: fixture.note,
    request: fixture.request,
    parityStatus: 'unavailable',
    comparable: false,
    scoreDelta: null,
    absoluteScoreDelta: null,
    confidenceDelta: null,
    componentDeltas: null,
    notes: [message],
    legacyAvailable: false,
    externalAvailable: false,
    legacyStatus: null,
    externalStatus: null,
    externalErrorCategory: 'config_error',
  };
}

function createSkippedSummary(
  fixtures: ForgeParityFixture[],
  skippedReason: NonNullable<ForgeParityReport['integration']['skippedReason']>,
): ForgeParitySummary {
  return summarizeForgeParityResults(fixtures.map((fixture) => createSkippedFixtureResult(fixture, skippedReason)));
}

export function formatForgeParityReportJson(report: ForgeParityReport): string {
  return stableStringify(report, { space: 2 });
}

export function formatForgeParityReportConsole(report: ForgeParityReport): string {
  const worstDelta = report.summary.worstScoreDelta
    ? `${report.summary.worstScoreDelta.fixtureId} (${report.summary.worstScoreDelta.delta})`
    : 'none';

  return [
    '[FORGE parity report]',
    `generatedAt=${report.generatedAt}`,
    `integration enabled=${report.integration.enabled} configured=${report.integration.baseUrlConfigured} readiness=${report.integration.readiness} harnessRan=${report.integration.harnessRan}`,
    report.integration.skippedReason ? `skippedReason=${report.integration.skippedReason}` : null,
    `summary fixtures=${report.summary.totalFixtures} comparable=${report.summary.comparableCount} close=${report.summary.closeCount} drift=${report.summary.driftCount} unavailable=${report.summary.unavailableCount} notComparable=${report.summary.notComparableCount}`,
    `averageAbsoluteScoreDelta=${report.summary.averageAbsoluteScoreDelta ?? 'null'}`,
    `worstScoreDelta=${worstDelta}`,
    '',
    formatForgeParityReportJson(report),
  ].filter((line): line is string => Boolean(line)).join('\n');
}

export class ForgeParityReportService {
  constructor(
    private readonly parityHarness: Pick<ForgeParityHarness, 'run'> = forgeParityHarness,
    private readonly service: Pick<ForgeService, 'getStatus'> = forgeService,
    private readonly fixtures: ForgeParityFixture[] = forgeParityFixtures,
  ) {}

  async generateReport(): Promise<ForgeParityReport> {
    const generatedAt = new Date().toISOString();
    const status = this.service.getStatus();
    const skippedReason = !status.enabled
      ? 'integration_disabled'
      : !status.configured
        ? 'base_url_missing'
        : null;

    const summary = skippedReason
      ? createSkippedSummary(this.fixtures, skippedReason)
      : await this.parityHarness.run();

    return {
      generatedAt,
      integration: {
        enabled: status.enabled,
        baseUrlConfigured: status.configured,
        endpointPath: status.endpointPath,
        timeoutMs: status.timeoutMs,
        readiness: status.readiness,
        startupConfigLogged: status.startupConfigLogged,
        harnessRan: skippedReason == null,
        skippedReason,
      },
      summary: toReportSummary(summary),
      results: summary.results,
    };
  }
}

export const forgeParityReportService = new ForgeParityReportService();
