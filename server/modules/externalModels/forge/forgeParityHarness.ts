import stableStringify from 'json-stable-stringify';
import { ForgeCompareService, forgeCompareService } from './forgeCompareService';
import {
  ForgeParityStatus,
  TiberForgeComparisonResult,
  TiberForgeComparisonSide,
  TiberForgeEvaluation,
} from './types';
import { ForgeParityFixture, forgeParityFixtures } from './fixtures/forgeParityFixtures';

const PARITY_STATUS_ORDER: ForgeParityStatus[] = ['close', 'drift', 'unavailable', 'not_comparable'];

type ParityComponentKey = 'volume' | 'efficiency' | 'teamContext' | 'stability';

export interface ForgeParityFixtureResult {
  fixtureId: string;
  fixtureName: string;
  fixtureNote: string;
  request: ForgeParityFixture['request'];
  parityStatus: ForgeParityStatus;
  comparable: boolean;
  scoreDelta: number | null;
  absoluteScoreDelta: number | null;
  componentDeltas: Record<ParityComponentKey, number> | null;
  notes: string[];
  legacyAvailable: boolean;
  externalAvailable: boolean;
  legacyStatus: TiberForgeEvaluation['metadata']['status'] | null;
  externalStatus: TiberForgeEvaluation['metadata']['status'] | null;
  legacyErrorCategory?: TiberForgeComparisonSide['error']['category'];
  externalErrorCategory?: TiberForgeComparisonSide['error']['category'];
  compareError?: string;
}

export interface ForgeParitySummary {
  totalFixtures: number;
  comparableCount: number;
  closeCount: number;
  driftCount: number;
  unavailableCount: number;
  notComparableCount: number;
  averageAbsoluteScoreDelta: number | null;
  worstScoreDelta: {
    fixtureId: string;
    fixtureName: string;
    delta: number;
    absoluteDelta: number;
  } | null;
  perFixture: ForgeParityFixtureResult[];
}

function round(value: number, precision = 3): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function createUnavailableFixtureResult(fixture: ForgeParityFixture, error: unknown): ForgeParityFixtureResult {
  const message = error instanceof Error ? error.message : 'Unknown compare failure.';

  return {
    fixtureId: fixture.id,
    fixtureName: fixture.name,
    fixtureNote: fixture.note,
    request: fixture.request,
    parityStatus: 'unavailable',
    comparable: false,
    scoreDelta: null,
    absoluteScoreDelta: null,
    componentDeltas: null,
    notes: ['Compare service threw unexpectedly; result recorded as unavailable for containment.'],
    legacyAvailable: false,
    externalAvailable: false,
    legacyStatus: null,
    externalStatus: null,
    compareError: message,
  };
}

function toFixtureResult(fixture: ForgeParityFixture, result: TiberForgeComparisonResult): ForgeParityFixtureResult {
  const scoreDelta = typeof result.comparison.scoreDelta === 'number' ? round(result.comparison.scoreDelta) : null;
  const componentDeltas = result.comparison.componentDeltas
    ? {
        volume: round(result.comparison.componentDeltas.volume),
        efficiency: round(result.comparison.componentDeltas.efficiency),
        teamContext: round(result.comparison.componentDeltas.teamContext),
        stability: round(result.comparison.componentDeltas.stability),
      }
    : null;

  return {
    fixtureId: fixture.id,
    fixtureName: fixture.name,
    fixtureNote: fixture.note,
    request: fixture.request,
    parityStatus: result.comparison.parityStatus,
    comparable: result.comparison.parityStatus === 'close' || result.comparison.parityStatus === 'drift',
    scoreDelta,
    absoluteScoreDelta: scoreDelta == null ? null : round(Math.abs(scoreDelta)),
    componentDeltas,
    notes: [...result.comparison.notes],
    legacyAvailable: result.legacy.available,
    externalAvailable: result.external.available,
    legacyStatus: result.legacy.data?.metadata.status ?? null,
    externalStatus: result.external.data?.metadata.status ?? null,
    legacyErrorCategory: result.legacy.error?.category,
    externalErrorCategory: result.external.error?.category,
  };
}

function compareFixtureResults(a: ForgeParityFixtureResult, b: ForgeParityFixtureResult): number {
  const parityOrder = PARITY_STATUS_ORDER.indexOf(a.parityStatus) - PARITY_STATUS_ORDER.indexOf(b.parityStatus);
  if (parityOrder !== 0) {
    return parityOrder;
  }

  return a.fixtureId.localeCompare(b.fixtureId);
}

export function summarizeForgeParityResults(results: ForgeParityFixtureResult[]): ForgeParitySummary {
  const perFixture = [...results].sort(compareFixtureResults);
  const comparableResults = perFixture.filter((result) => result.comparable && result.absoluteScoreDelta != null);
  const totalAbsoluteDelta = comparableResults.reduce((sum, result) => sum + (result.absoluteScoreDelta ?? 0), 0);
  const worst = comparableResults.reduce<ForgeParityFixtureResult | null>((current, result) => {
    if (!current || (result.absoluteScoreDelta ?? -1) > (current.absoluteScoreDelta ?? -1)) {
      return result;
    }
    return current;
  }, null);

  return {
    totalFixtures: perFixture.length,
    comparableCount: comparableResults.length,
    closeCount: perFixture.filter((result) => result.parityStatus === 'close').length,
    driftCount: perFixture.filter((result) => result.parityStatus === 'drift').length,
    unavailableCount: perFixture.filter((result) => result.parityStatus === 'unavailable').length,
    notComparableCount: perFixture.filter((result) => result.parityStatus === 'not_comparable').length,
    averageAbsoluteScoreDelta:
      comparableResults.length > 0 ? round(totalAbsoluteDelta / comparableResults.length) : null,
    worstScoreDelta: worst && worst.scoreDelta != null && worst.absoluteScoreDelta != null
      ? {
          fixtureId: worst.fixtureId,
          fixtureName: worst.fixtureName,
          delta: worst.scoreDelta,
          absoluteDelta: worst.absoluteScoreDelta,
        }
      : null,
    perFixture,
  };
}

export function formatForgeParitySnapshot(summary: ForgeParitySummary): string {
  const orderedSummary = {
    totalFixtures: summary.totalFixtures,
    comparableCount: summary.comparableCount,
    closeCount: summary.closeCount,
    driftCount: summary.driftCount,
    unavailableCount: summary.unavailableCount,
    notComparableCount: summary.notComparableCount,
    averageAbsoluteScoreDelta: summary.averageAbsoluteScoreDelta,
    worstScoreDelta: summary.worstScoreDelta,
    perFixture: summary.perFixture.map((fixture) => ({
      fixtureId: fixture.fixtureId,
      fixtureName: fixture.fixtureName,
      fixtureNote: fixture.fixtureNote,
      request: fixture.request,
      parityStatus: fixture.parityStatus,
      comparable: fixture.comparable,
      scoreDelta: fixture.scoreDelta,
      absoluteScoreDelta: fixture.absoluteScoreDelta,
      legacyAvailable: fixture.legacyAvailable,
      externalAvailable: fixture.externalAvailable,
      legacyStatus: fixture.legacyStatus,
      externalStatus: fixture.externalStatus,
      legacyErrorCategory: fixture.legacyErrorCategory,
      externalErrorCategory: fixture.externalErrorCategory,
      compareError: fixture.compareError,
      notes: fixture.notes,
    })),
  };

  return stableStringify(orderedSummary, { space: 2 });
}

export class ForgeParityHarness {
  constructor(
    private readonly compareService: Pick<ForgeCompareService, 'compare'> = forgeCompareService,
    private readonly fixtures: ForgeParityFixture[] = forgeParityFixtures,
  ) {}

  async run(): Promise<ForgeParitySummary> {
    const results: ForgeParityFixtureResult[] = [];

    for (const fixture of this.fixtures) {
      try {
        const comparison = await this.compareService.compare(fixture.request);
        results.push(toFixtureResult(fixture, comparison));
      } catch (error) {
        results.push(createUnavailableFixtureResult(fixture, error));
      }
    }

    return summarizeForgeParityResults(results);
  }
}

export const forgeParityHarness = new ForgeParityHarness();
