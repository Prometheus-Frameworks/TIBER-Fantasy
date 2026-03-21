import { ForgeIntegrationError, TiberForgeComparisonResult, TiberForgeEvaluation } from '../types';
import {
  ForgeParityFixtureResult,
  ForgeParityHarness,
  formatForgeParitySnapshot,
  summarizeForgeParityResults,
} from '../forgeParityHarness';
import { ForgeParityFixture } from '../fixtures/forgeParityFixtures';

function buildEvaluation(overrides: Partial<TiberForgeEvaluation> = {}): TiberForgeEvaluation {
  return {
    playerId: '00-0036322',
    playerName: 'Justin Jefferson',
    position: 'WR',
    team: 'MIN',
    season: 2025,
    week: 'season',
    mode: 'redraft',
    score: {
      alpha: 80,
      tier: 'T2',
      tierRank: 2,
      confidence: 0.8,
    },
    components: {
      volume: 82,
      efficiency: 77,
      teamContext: 70,
      stability: 79,
    },
    metadata: {
      gamesSampled: 15,
      positionRank: 2,
      status: 'ok',
      issues: [],
    },
    source: {
      provider: 'legacy-forge',
      modelVersion: 'legacy-eg-v2',
      generatedAt: '2026-03-21T00:00:00.000Z',
    },
    ...overrides,
  };
}

function buildComparisonResult(
  fixture: ForgeParityFixture,
  overrides: Partial<TiberForgeComparisonResult> = {},
): TiberForgeComparisonResult {
  return {
    request: fixture.request,
    legacy: {
      available: true,
      data: buildEvaluation(),
    },
    external: {
      available: true,
      data: buildEvaluation({
        source: {
          provider: 'external-forge',
          modelVersion: '2026.03.0',
          contractVersion: '1.0.0',
          calibrationVersion: 'alpha-redraft-2025-v1',
          generatedAt: '2026-03-21T00:00:00.000Z',
        },
      }),
    },
    comparison: {
      scoreDelta: 1,
      componentDeltas: {
        volume: 1,
        efficiency: 1,
        teamContext: 0,
        stability: 1,
      },
      confidenceDelta: 0.01,
      notes: ['Within tolerance.'],
      parityStatus: 'close',
    },
    ...overrides,
  };
}

const fixtures: ForgeParityFixture[] = [
  {
    id: 'fixture-close',
    name: 'Fixture close',
    note: 'close',
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
    id: 'fixture-drift',
    name: 'Fixture drift',
    note: 'drift',
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
  {
    id: 'fixture-unavailable',
    name: 'Fixture unavailable',
    note: 'unavailable',
    request: {
      playerId: '00-0034791',
      position: 'RB',
      season: 2025,
      week: 'season',
      mode: 'redraft',
      includeSourceMeta: true,
      includeRawCanonical: false,
    },
  },
  {
    id: 'fixture-not-comparable',
    name: 'Fixture not comparable',
    note: 'not-comparable',
    request: {
      playerId: '00-0039338',
      position: 'TE',
      season: 2025,
      week: 'season',
      mode: 'dynasty',
      includeSourceMeta: true,
      includeRawCanonical: false,
    },
  },
  {
    id: 'fixture-throws',
    name: 'Fixture throws',
    note: 'throws',
    request: {
      playerId: '00-0037256',
      position: 'RB',
      season: 2025,
      week: 'season',
      mode: 'redraft',
      includeSourceMeta: true,
      includeRawCanonical: false,
    },
  },
];

describe('ForgeParityHarness', () => {
  it('aggregates close, drift, unavailable, and not comparable outcomes deterministically', async () => {
    const compare = jest.fn(async (request: ForgeParityFixture['request']) => {
      switch (request.playerId) {
        case '00-0036322':
          return buildComparisonResult(fixtures[0]);
        case '00-0033280':
          return buildComparisonResult(fixtures[1], {
            comparison: {
              scoreDelta: 6.5,
              componentDeltas: {
                volume: 7,
                efficiency: 2,
                teamContext: 1,
                stability: 5,
              },
              confidenceDelta: 0.08,
              notes: ['Tier changed.', 'Alpha drift is 6.5 points.'],
              parityStatus: 'drift',
            },
          });
        case '00-0034791':
          return buildComparisonResult(fixtures[2], {
            external: {
              available: false,
              error: {
                category: 'upstream_unavailable',
                message: 'External FORGE unavailable.',
              },
            },
            comparison: {
              notes: ['Only one FORGE implementation returned data for this request.'],
              parityStatus: 'unavailable',
            },
          });
        case '00-0039338':
          return buildComparisonResult(fixtures[3], {
            external: {
              available: true,
              data: buildEvaluation({ position: 'WR', source: {
                provider: 'external-forge',
                modelVersion: '2026.03.0',
                contractVersion: '1.0.0',
                calibrationVersion: 'alpha-redraft-2025-v1',
                generatedAt: '2026-03-21T00:00:00.000Z',
              } }),
            },
            comparison: {
              notes: ['Legacy and external FORGE returned different positions, so parity is not comparable.'],
              parityStatus: 'not_comparable',
            },
          });
        case '00-0037256':
          throw new Error('compare exploded');
        default:
          throw new Error('unexpected fixture');
      }
    });

    const harness = new ForgeParityHarness({ compare } as any, fixtures);
    const summary = await harness.run();

    expect(summary).toEqual({
      totalFixtures: 5,
      comparableCount: 2,
      closeCount: 1,
      driftCount: 1,
      unavailableCount: 2,
      notComparableCount: 1,
      averageAbsoluteScoreDelta: 3.75,
      worstScoreDelta: {
        fixtureId: 'fixture-drift',
        fixtureName: 'Fixture drift',
        delta: 6.5,
        absoluteDelta: 6.5,
      },
      results: [
        expect.objectContaining({ fixtureId: 'fixture-close', parityStatus: 'close', scoreDelta: 1, confidenceDelta: 0.01, componentDeltas: { volume: 1, efficiency: 1, teamContext: 0, stability: 1 }, comparable: true }),
        expect.objectContaining({ fixtureId: 'fixture-drift', parityStatus: 'drift', scoreDelta: 6.5, confidenceDelta: 0.08, componentDeltas: { volume: 7, efficiency: 2, teamContext: 1, stability: 5 }, comparable: true }),
        expect.objectContaining({ fixtureId: 'fixture-throws', parityStatus: 'unavailable', compareError: 'compare exploded', confidenceDelta: null, componentDeltas: null }),
        expect.objectContaining({ fixtureId: 'fixture-unavailable', parityStatus: 'unavailable', externalErrorCategory: 'upstream_unavailable', confidenceDelta: null, componentDeltas: null }),
        expect.objectContaining({ fixtureId: 'fixture-not-comparable', parityStatus: 'not_comparable', comparable: false, confidenceDelta: null, componentDeltas: null }),
      ],
      perFixture: [
        expect.objectContaining({ fixtureId: 'fixture-close', parityStatus: 'close', scoreDelta: 1, comparable: true }),
        expect.objectContaining({ fixtureId: 'fixture-drift', parityStatus: 'drift', scoreDelta: 6.5, comparable: true }),
        expect.objectContaining({ fixtureId: 'fixture-throws', parityStatus: 'unavailable', compareError: 'compare exploded' }),
        expect.objectContaining({ fixtureId: 'fixture-unavailable', parityStatus: 'unavailable', externalErrorCategory: 'upstream_unavailable' }),
        expect.objectContaining({ fixtureId: 'fixture-not-comparable', parityStatus: 'not_comparable', comparable: false }),
      ],
    });

    expect(formatForgeParitySnapshot(summary)).toMatchInlineSnapshot(`
"{
  "averageAbsoluteScoreDelta": 3.75,
  "closeCount": 1,
  "comparableCount": 2,
  "driftCount": 1,
  "notComparableCount": 1,
  "results": [
    {
      "absoluteScoreDelta": 1,
      "comparable": true,
      "componentDeltas": {
        "efficiency": 1,
        "stability": 1,
        "teamContext": 0,
        "volume": 1
      },
      "confidenceDelta": 0.01,
      "externalAvailable": true,
      "externalStatus": "ok",
      "fixtureId": "fixture-close",
      "fixtureName": "Fixture close",
      "fixtureNote": "close",
      "legacyAvailable": true,
      "legacyStatus": "ok",
      "notes": [
        "Within tolerance."
      ],
      "parityStatus": "close",
      "request": {
        "includeRawCanonical": false,
        "includeSourceMeta": true,
        "mode": "redraft",
        "playerId": "00-0036322",
        "position": "WR",
        "season": 2025,
        "week": "season"
      },
      "scoreDelta": 1
    },
    {
      "absoluteScoreDelta": 6.5,
      "comparable": true,
      "componentDeltas": {
        "efficiency": 2,
        "stability": 5,
        "teamContext": 1,
        "volume": 7
      },
      "confidenceDelta": 0.08,
      "externalAvailable": true,
      "externalStatus": "ok",
      "fixtureId": "fixture-drift",
      "fixtureName": "Fixture drift",
      "fixtureNote": "drift",
      "legacyAvailable": true,
      "legacyStatus": "ok",
      "notes": [
        "Tier changed.",
        "Alpha drift is 6.5 points."
      ],
      "parityStatus": "drift",
      "request": {
        "includeRawCanonical": false,
        "includeSourceMeta": true,
        "mode": "bestball",
        "playerId": "00-0033280",
        "position": "RB",
        "season": 2025,
        "week": "season"
      },
      "scoreDelta": 6.5
    },
    {
      "absoluteScoreDelta": null,
      "comparable": false,
      "compareError": "compare exploded",
      "componentDeltas": null,
      "confidenceDelta": null,
      "externalAvailable": false,
      "externalStatus": null,
      "fixtureId": "fixture-throws",
      "fixtureName": "Fixture throws",
      "fixtureNote": "throws",
      "legacyAvailable": false,
      "legacyStatus": null,
      "notes": [
        "Compare service threw unexpectedly; result recorded as unavailable for containment."
      ],
      "parityStatus": "unavailable",
      "request": {
        "includeRawCanonical": false,
        "includeSourceMeta": true,
        "mode": "redraft",
        "playerId": "00-0037256",
        "position": "RB",
        "season": 2025,
        "week": "season"
      },
      "scoreDelta": null
    },
    {
      "absoluteScoreDelta": null,
      "comparable": false,
      "componentDeltas": null,
      "confidenceDelta": null,
      "externalAvailable": false,
      "externalErrorCategory": "upstream_unavailable",
      "externalStatus": null,
      "fixtureId": "fixture-unavailable",
      "fixtureName": "Fixture unavailable",
      "fixtureNote": "unavailable",
      "legacyAvailable": true,
      "legacyStatus": "ok",
      "notes": [
        "Only one FORGE implementation returned data for this request."
      ],
      "parityStatus": "unavailable",
      "request": {
        "includeRawCanonical": false,
        "includeSourceMeta": true,
        "mode": "redraft",
        "playerId": "00-0034791",
        "position": "RB",
        "season": 2025,
        "week": "season"
      },
      "scoreDelta": null
    },
    {
      "absoluteScoreDelta": null,
      "comparable": false,
      "componentDeltas": null,
      "confidenceDelta": null,
      "externalAvailable": true,
      "externalStatus": "ok",
      "fixtureId": "fixture-not-comparable",
      "fixtureName": "Fixture not comparable",
      "fixtureNote": "not-comparable",
      "legacyAvailable": true,
      "legacyStatus": "ok",
      "notes": [
        "Legacy and external FORGE returned different positions, so parity is not comparable."
      ],
      "parityStatus": "not_comparable",
      "request": {
        "includeRawCanonical": false,
        "includeSourceMeta": true,
        "mode": "dynasty",
        "playerId": "00-0039338",
        "position": "TE",
        "season": 2025,
        "week": "season"
      },
      "scoreDelta": null
    }
  ],
  "totalFixtures": 5,
  "unavailableCount": 2,
  "worstScoreDelta": {
    "absoluteDelta": 6.5,
    "delta": 6.5,
    "fixtureId": "fixture-drift",
    "fixtureName": "Fixture drift"
  }
}"
`);
  });

  it('summarizes precomputed fixture results without losing debug metadata', () => {
    const summary = summarizeForgeParityResults([
      {
        fixtureId: 'drift-a',
        fixtureName: 'Drift A',
        fixtureNote: 'debug drift',
        request: fixtures[1].request,
        parityStatus: 'drift',
        comparable: true,
        scoreDelta: -4,
        absoluteScoreDelta: 4,
        confidenceDelta: -0.044,
        componentDeltas: { volume: -2, efficiency: -1, teamContext: -3, stability: 0 },
        notes: ['debug note'],
        legacyAvailable: true,
        externalAvailable: true,
        legacyStatus: 'ok',
        externalStatus: 'partial',
        externalErrorCategory: undefined,
        legacyErrorCategory: undefined,
      },
      {
        fixtureId: 'close-b',
        fixtureName: 'Close B',
        fixtureNote: 'debug close',
        request: fixtures[0].request,
        parityStatus: 'close',
        comparable: true,
        scoreDelta: 2,
        absoluteScoreDelta: 2,
        confidenceDelta: 0.02,
        componentDeltas: { volume: 1, efficiency: 0, teamContext: 1, stability: 0 },
        notes: ['close note'],
        legacyAvailable: true,
        externalAvailable: true,
        legacyStatus: 'ok',
        externalStatus: 'ok',
        externalErrorCategory: undefined,
        legacyErrorCategory: undefined,
      },
    ] satisfies ForgeParityFixtureResult[]);

    expect(summary.averageAbsoluteScoreDelta).toBe(3);
    expect(summary.worstScoreDelta).toEqual({
      fixtureId: 'drift-a',
      fixtureName: 'Drift A',
      delta: -4,
      absoluteDelta: 4,
    });
    expect(summary.results).toBe(summary.perFixture);
    expect(summary.perFixture[1]).toEqual(expect.objectContaining({
      fixtureId: 'drift-a',
      fixtureNote: 'debug drift',
      confidenceDelta: -0.044,
      componentDeltas: { volume: -2, efficiency: -1, teamContext: -3, stability: 0 },
      externalStatus: 'partial',
      notes: ['debug note'],
    }));
  });

  it('maps typed upstream errors into contained unavailable results', async () => {
    const compare = jest.fn().mockRejectedValue(
      new ForgeIntegrationError('upstream_timeout', 'External FORGE timed out.', 504),
    );

    const harness = new ForgeParityHarness({ compare } as any, [fixtures[0]]);
    const summary = await harness.run();

    expect(summary.unavailableCount).toBe(1);
    expect(summary.perFixture[0]).toEqual(expect.objectContaining({
      fixtureId: 'fixture-close',
      parityStatus: 'unavailable',
      compareError: 'External FORGE timed out.',
      confidenceDelta: null,
      componentDeltas: null,
      legacyAvailable: false,
      externalAvailable: false,
    }));
  });
});
