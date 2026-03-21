import { ForgeParityReportService } from '../forgeParityReportService';
import { ForgeParityFixture } from '../fixtures/forgeParityFixtures';

const fixtures: ForgeParityFixture[] = [
  {
    id: 'fixture-a',
    name: 'Fixture A',
    note: 'first',
    request: {
      playerId: '00-0036322',
      position: 'WR',
      season: 2025,
      week: 'season',
      mode: 'redraft',
      includeSourceMeta: true,
      includeRawCanonical: false,
    },
  },
  {
    id: 'fixture-b',
    name: 'Fixture B',
    note: 'second',
    request: {
      playerId: '00-0033280',
      position: 'RB',
      season: 2025,
      week: 'season',
      mode: 'bestball',
      includeSourceMeta: true,
      includeRawCanonical: false,
    },
  },
];

describe('ForgeParityReportService', () => {
  it('returns harness output with stable integration metadata when external FORGE is ready', async () => {
    const run = jest.fn().mockResolvedValue({
      totalFixtures: 2,
      comparableCount: 1,
      closeCount: 1,
      driftCount: 0,
      unavailableCount: 1,
      notComparableCount: 0,
      averageAbsoluteScoreDelta: 1.5,
      worstScoreDelta: {
        fixtureId: 'fixture-a',
        fixtureName: 'Fixture A',
        delta: 1.5,
        absoluteDelta: 1.5,
      },
      results: [
        {
          fixtureId: 'fixture-a',
          fixtureName: 'Fixture A',
          fixtureNote: 'first',
          request: fixtures[0].request,
          parityStatus: 'close',
          comparable: true,
          scoreDelta: 1.5,
          absoluteScoreDelta: 1.5,
          confidenceDelta: 0.01,
          componentDeltas: { volume: 1, efficiency: 1, teamContext: 0, stability: 1 },
          notes: ['Within tolerance.'],
          legacyAvailable: true,
          externalAvailable: true,
          legacyStatus: 'ok',
          externalStatus: 'ok',
        },
      ],
      perFixture: [],
    });
    const getStatus = jest.fn().mockReturnValue({
      enabled: true,
      configured: true,
      endpointPath: '/v1/forge/evaluations',
      timeoutMs: 5000,
      readiness: 'ready',
      startupConfigLogged: true,
    });

    const report = await new ForgeParityReportService({ run } as any, { getStatus } as any, fixtures).generateReport();

    expect(run).toHaveBeenCalledTimes(1);
    expect(report.integration).toEqual({
      enabled: true,
      baseUrlConfigured: true,
      endpointPath: '/v1/forge/evaluations',
      timeoutMs: 5000,
      readiness: 'ready',
      startupConfigLogged: true,
      harnessRan: true,
      skippedReason: null,
    });
    expect(report.summary).toEqual({
      totalFixtures: 2,
      comparableCount: 1,
      closeCount: 1,
      driftCount: 0,
      unavailableCount: 1,
      notComparableCount: 0,
      averageAbsoluteScoreDelta: 1.5,
      worstScoreDelta: {
        fixtureId: 'fixture-a',
        fixtureName: 'Fixture A',
        delta: 1.5,
        absoluteDelta: 1.5,
      },
    });
    expect(report.results).toHaveLength(1);
    expect(report.generatedAt).toEqual(expect.any(String));
  });

  it('returns deterministic unavailable results without running the harness when external FORGE is disabled', async () => {
    const run = jest.fn();
    const getStatus = jest.fn().mockReturnValue({
      enabled: false,
      configured: false,
      endpointPath: '/v1/forge/evaluations',
      timeoutMs: 5000,
      readiness: 'not_ready',
      startupConfigLogged: true,
    });

    const report = await new ForgeParityReportService({ run } as any, { getStatus } as any, fixtures).generateReport();

    expect(run).not.toHaveBeenCalled();
    expect(report.integration.harnessRan).toBe(false);
    expect(report.integration.skippedReason).toBe('integration_disabled');
    expect(report.summary).toMatchObject({
      totalFixtures: 2,
      comparableCount: 0,
      closeCount: 0,
      driftCount: 0,
      unavailableCount: 2,
      notComparableCount: 0,
      averageAbsoluteScoreDelta: null,
      worstScoreDelta: null,
    });
    expect(report.results).toEqual([
      expect.objectContaining({
        fixtureId: 'fixture-a',
        parityStatus: 'unavailable',
        externalErrorCategory: 'config_error',
        notes: ['External FORGE parity report skipped because the integration is disabled.'],
      }),
      expect.objectContaining({
        fixtureId: 'fixture-b',
        parityStatus: 'unavailable',
        externalErrorCategory: 'config_error',
      }),
    ]);
  });

  it('marks missing base url as a skipped parity report without running the harness', async () => {
    const run = jest.fn();
    const getStatus = jest.fn().mockReturnValue({
      enabled: true,
      configured: false,
      endpointPath: '/v1/forge/evaluations',
      timeoutMs: 5000,
      readiness: 'not_ready',
      startupConfigLogged: true,
    });

    const report = await new ForgeParityReportService({ run } as any, { getStatus } as any, fixtures).generateReport();

    expect(run).not.toHaveBeenCalled();
    expect(report.integration.skippedReason).toBe('base_url_missing');
    expect(report.results[0].notes).toEqual([
      'External FORGE parity report skipped because FORGE_SERVICE_BASE_URL is not configured.',
    ]);
  });
});
