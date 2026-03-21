import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  exportForgeParityReport,
  renderForgeParityReport,
} from '../forgeParityReportExporter';

const report = {
  generatedAt: '2026-03-21T00:00:00.000Z',
  integration: {
    enabled: true,
    baseUrlConfigured: true,
    endpointPath: '/v1/forge/evaluations',
    timeoutMs: 5000,
    readiness: 'ready' as const,
    startupConfigLogged: true,
    harnessRan: true,
    skippedReason: null,
  },
  summary: {
    totalFixtures: 2,
    comparableCount: 2,
    closeCount: 1,
    driftCount: 1,
    unavailableCount: 0,
    notComparableCount: 0,
    averageAbsoluteScoreDelta: 3.75,
    worstScoreDelta: {
      fixtureId: 'fixture-drift',
      fixtureName: 'Fixture drift',
      delta: 6.5,
      absoluteDelta: 6.5,
    },
  },
  results: [
    {
      fixtureId: 'fixture-close',
      fixtureName: 'Fixture close',
      fixtureNote: 'close',
      request: {
        playerId: '00-0036322',
        position: 'WR',
        season: 2025,
        week: 'season' as const,
        mode: 'redraft' as const,
        includeSourceMeta: true,
        includeRawCanonical: false,
      },
      parityStatus: 'close' as const,
      comparable: true,
      scoreDelta: 1,
      absoluteScoreDelta: 1,
      confidenceDelta: 0.01,
      componentDeltas: { volume: 1, efficiency: 1, teamContext: 0, stability: 1 },
      notes: ['Within tolerance.'],
      legacyAvailable: true,
      externalAvailable: true,
      legacyStatus: 'ok' as const,
      externalStatus: 'ok' as const,
    },
  ],
};

describe('forgeParityReportExporter', () => {
  it('renders a console summary for stdout inspection', () => {
    const output = renderForgeParityReport(report, 'pretty');

    expect(output).toContain('[FORGE parity report]');
    expect(output).toContain('summary fixtures=2 comparable=2 close=1 drift=1 unavailable=0 notComparable=0');
    expect(output).toContain('"generatedAt": "2026-03-21T00:00:00.000Z"');
  });

  it('writes a stable JSON report when an output path is provided', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'forge-parity-report-'));
    const outputPath = path.join(tempDir, 'report.json');
    const generateReport = jest.fn().mockResolvedValue(report);

    const result = await exportForgeParityReport({ format: 'json', outputPath }, { generateReport } as any);

    expect(result).toBe(report);
    expect(generateReport).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fs.readFileSync(outputPath, 'utf8'))).toEqual(report);
  });
});
