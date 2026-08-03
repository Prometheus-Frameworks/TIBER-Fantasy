process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://example.com/testdb';
jest.mock('../../infra/db', () => ({ db: {} }));
jest.mock('../../storage', () => ({ storage: {} }));

import express from 'express';
import request from 'supertest';
import { createManagementRouter } from '../managementRoutes';
import {
  classifyTeamDirection as classifyTeamDirectionWithoutReceipt,
  type ClassifierOptions,
} from '../../services/teamDirectionClassifier';
import { buildTeamDirectionForgeFreshnessReceipt } from '../../modules/management/forgeTeamDirectionFreshnessPolicy';

function buildApp(overrides: Parameters<typeof createManagementRouter>[0]) {
  const app = express();
  app.use(express.json());
  app.use(createManagementRouter(overrides));
  return app;
}

const baseTeam = { id: 'team-1', displayName: 'Test Team', externalRosterId: 'roster-1' };
const baseLeague = { id: 'league-1', leagueName: 'Test League', teams: [baseTeam] };
const baseContext = { preference: null, activeLeague: baseLeague, activeTeam: baseTeam };

function rosterOf(players: { name?: string; pos: string; alpha: number | null; missingReason?: string; forgeScoreSource?: 'player_specific' | 'generated_baseline' | 'cached_unknown' | null; rookieAsset?: object }[]) {
  return players.map((p, i) => ({
    rosterKey: `k${i}`,
    name: p.name,
    pos: p.pos,
    alpha: p.alpha,
    missingReason: p.missingReason ?? (p.alpha === null ? 'missing_forge_row' : undefined),
    forgeScoreSource: p.forgeScoreSource === undefined && typeof p.alpha === 'number'
      ? 'player_specific'
      : p.forgeScoreSource,
    rookieAsset: p.rookieAsset,
  }));
}

const CLASSIFIER_NOW = new Date('2026-08-01T00:00:00.000Z');

function acceptedReceiptForRoster(roster: ReturnType<typeof rosterOf>) {
  return buildTeamDirectionForgeFreshnessReceipt({
    artifact: {
      state: 'available',
      available: true,
      code: null,
      sourcePath: 'server/artifacts/external/forge/forge_player_static_v1.json',
      contractVersion: 'forge_player_static_v1',
      generatedAt: '2026-07-31T00:00:00.000Z',
      generatedAtSource: 'root_generated_at',
      promotedAt: null,
    },
    rosterPlayers: roster,
    now: CLASSIFIER_NOW,
  });
}

function classifyTeamDirection(
  roster: ReturnType<typeof rosterOf>,
  picks: any[],
  options: ClassifierOptions = {},
) {
  return classifyTeamDirectionWithoutReceipt(roster, picks, {
    ...options,
    forgeFreshnessReceipt: options.forgeFreshnessReceipt ?? acceptedReceiptForRoster(roster),
  });
}

describe('classifyTeamDirection (pure unit tests)', () => {
  test('returns uncertain when roster is empty', () => {
    const result = classifyTeamDirection([], []);
    expect(result.direction).toBe('uncertain');
    expect(result.confidence).toBe('low');
    expect(result.blockers.length).toBeGreaterThan(0);
    expect(result.coverage.total).toBe(0);
    expect(result.coverage.matched).toBe(0);
  });

  test('returns uncertain when coverage < 50%', () => {
    const roster = rosterOf([
      { pos: 'QB', alpha: null },
      { pos: 'WR', alpha: null },
      { pos: 'RB', alpha: null },
      { pos: 'WR', alpha: 65 },
    ]);
    const result = classifyTeamDirection(roster, []);
    expect(result.direction).toBe('uncertain');
    expect(result.coverage.matched).toBe(1);
    expect(result.coverage.total).toBe(4);
    expect(result.blockers.some((b) => b.includes('50%'))).toBe(true);
  });

  test('counts Rookie Alpha fallback as covered evidence without blending it into FORGE strength', () => {
    const roster = rosterOf([
      { pos: 'QB', alpha: 70 },
      { pos: 'RB', alpha: 68 },
      { pos: 'WR', alpha: 72 },
      { pos: 'WR', alpha: null, rookieAsset: { rookieAlphaScore: 83 } },
    ]);
    const result = classifyTeamDirection(roster, []);
    expect(result.coverage).toEqual(expect.objectContaining({ matched: 4, forgeMatched: 3, rookieAlphaMatched: 1, rate: 1 }));
    expect(result.evidenceCoverage).toEqual({ matched: 4, total: 4, rate: 1, rookieAlphaMatched: 1 });
    expect(result.forgeCoverage).toEqual({ matched: 3, total: 4, rate: 0.75 });
    expect(result.visibilityCounts).toEqual({
      total: 4,
      identityCovered: 4,
      baselineVisible: 0,
      forgeScored: 3,
      forgeBaseline: 0,
      generatedBaselineVisibility: 0,
      rookieAlphaFallback: 1,
      knownUnscored: 0,
      unresolved: 0,
      evidenceCovered: 4,
    });
    expect(result.confidenceInputs).toEqual(expect.objectContaining({
      driver: 'forge_scoring_coverage_and_position_quality',
      scoredPlayers: 3,
      forgeCoverage: { matched: 3, total: 4, rate: 0.75 },
      evidenceCoverage: { matched: 4, total: 4, rate: 1, rookieAlphaMatched: 1 },
    }));
    expect(result.reasons.some((reason) => reason.includes('without blending into FORGE scoring'))).toBe(true);
  });

  test('Rookie Alpha evidence completeness does not inflate direction confidence', () => {
    const roster = rosterOf([
      { pos: 'QB', alpha: 70 },
      { pos: 'RB', alpha: 68 },
      { pos: 'WR', alpha: 72 },
      { pos: 'WR', alpha: 65 },
      { pos: 'TE', alpha: 60 },
      { pos: 'RB', alpha: 62 },
      ...Array.from({ length: 6 }, (_, index) => ({
        pos: index % 2 === 0 ? 'WR' : 'RB',
        alpha: null,
        rookieAsset: { rookieAlphaScore: 85 - index },
      })),
    ]);

    const result = classifyTeamDirection(roster, []);

    expect(result.direction).toBe('contender');
    expect(result.evidenceCoverage).toEqual({ matched: 12, total: 12, rate: 1, rookieAlphaMatched: 6 });
    expect(result.forgeCoverage).toEqual({ matched: 6, total: 12, rate: 0.5 });
    expect(result.confidence).toBe('low');
    expect(result.blockers.some((blocker) => blocker.includes('Direction confidence is limited by scored data only'))).toBe(true);
  });

  test('does not classify roster strength from Rookie Alpha fallback alone', () => {
    const roster = rosterOf([
      { pos: 'RB', alpha: null, rookieAsset: { rookieAlphaScore: 83 } },
      { pos: 'WR', alpha: null, rookieAsset: { rookieAlphaScore: 81 } },
    ]);
    const result = classifyTeamDirection(roster, []);
    expect(result.direction).toBe('uncertain');
    expect(result.coverage.rookieAlphaMatched).toBe(2);
    expect(result.blockers.some((blocker) => blocker.includes('still needs sufficient FORGE scoring coverage'))).toBe(true);
  });

  test('does not count generated/default baseline alpha values as FORGE scoring coverage', () => {
    const roster = rosterOf([
      { pos: 'QB', alpha: 22.7, forgeScoreSource: 'generated_baseline' },
      { pos: 'RB', alpha: 15.0, forgeScoreSource: 'generated_baseline' },
      { pos: 'WR', alpha: 13.5, forgeScoreSource: 'generated_baseline' },
      { pos: 'WR', alpha: 13.5, forgeScoreSource: 'generated_baseline' },
      { pos: 'TE', alpha: 9.2, forgeScoreSource: 'generated_baseline' },
    ]);
    const result = classifyTeamDirection(roster, []);
    expect(result.direction).toBe('uncertain');
    expect(result.confidence).toBe('low');
    expect(result.forgeCoverage).toEqual({ matched: 0, total: 5, rate: 0 });
    expect(result.visibilityCounts).toEqual({
      total: 5,
      identityCovered: 5,
      baselineVisible: 5,
      forgeScored: 0,
      forgeBaseline: 5,
      generatedBaselineVisibility: 5,
      rookieAlphaFallback: 0,
      knownUnscored: 0,
      unresolved: 0,
      evidenceCovered: 0,
    });
    expect(result.blockers.some((blocker) => blocker.includes('generated/default FORGE baseline values'))).toBe(true);
  });

  test('does not classify sparse FORGE scoring coverage even when Rookie Alpha lifts visibility coverage', () => {
    const roster = rosterOf([
      { pos: 'QB', alpha: 92 },
      ...Array.from({ length: 7 }, (_, index) => ({ pos: index % 2 === 0 ? 'RB' : 'WR', alpha: null, rookieAsset: { rookieAlphaScore: 80 - index } })),
      ...Array.from({ length: 7 }, (_, index) => ({ pos: index % 2 === 0 ? 'WR' : 'TE', alpha: null })),
    ]);
    const result = classifyTeamDirection(roster, []);
    expect(result.direction).toBe('uncertain');
    expect(result.evidenceCoverage).toEqual({ matched: 8, total: 15, rate: 8 / 15, rookieAlphaMatched: 7 });
    expect(result.forgeCoverage).toEqual({ matched: 1, total: 15, rate: 1 / 15 });
    expect(result.visibilityCounts).toEqual({
      total: 15,
      identityCovered: 15,
      baselineVisible: 0,
      forgeScored: 1,
      forgeBaseline: 0,
      generatedBaselineVisibility: 0,
      rookieAlphaFallback: 7,
      knownUnscored: 7,
      unresolved: 0,
      evidenceCovered: 8,
    });
    expect(result.blockers).toContain(
      'Rookie Alpha covers 7 assets for visibility, but Team Direction still needs sufficient FORGE scoring coverage before classifying roster strength.'
    );
  });

  test('post-PR200 Management state classifies 24/30 realistic player-specific FORGE evidence as Rebuild High with neutral concentration wording', () => {
    const playerSpecificForgeRows = [
      { name: 'Puka Nacua', pos: 'WR', alpha: 30.24 },
      { name: 'Bijan Robinson', pos: 'RB', alpha: 25.03 },
      { name: 'Justin Herbert', pos: 'QB', alpha: 26.88 },
      { name: 'Ladd McConkey', pos: 'WR', alpha: 24.18 },
      { name: 'Christian McCaffrey', pos: 'RB', alpha: 21.33 },
      { name: 'Derrick Henry', pos: 'RB', alpha: 28.76 },
      { name: 'T.J. Hockenson', pos: 'TE', alpha: 13.77 },
      { name: 'Xavier Worthy', pos: 'WR', alpha: 22.91 },
      { name: 'Frank Gore Jr.', pos: 'RB', alpha: 12.94 },
      { name: 'Ryan Flournoy', pos: 'WR', alpha: 10.82 },
      { name: 'Terrance Ferguson', pos: 'TE', alpha: 11.41 },
      { name: 'Harold Fannin Jr.', pos: 'TE', alpha: 12.09 },
      { name: 'Luther Burden III', pos: 'WR', alpha: 17.64 },
      { name: 'Travis Hunter', pos: 'WR', alpha: 19.27 },
      { name: 'Depth RB 1', pos: 'RB', alpha: 14.82 },
      { name: 'Depth RB 2', pos: 'RB', alpha: 15.16 },
      { name: 'Depth WR 1', pos: 'WR', alpha: 16.45 },
      { name: 'Depth WR 2', pos: 'WR', alpha: 13.38 },
      { name: 'Depth WR 3', pos: 'WR', alpha: 12.73 },
      { name: 'Depth QB 1', pos: 'QB', alpha: 18.52 },
      { name: 'Depth RB 3', pos: 'RB', alpha: 11.66 },
      { name: 'Depth WR 4', pos: 'WR', alpha: 10.95 },
      { name: 'Depth TE 1', pos: 'TE', alpha: 9.84 },
      { name: 'Depth RB 4', pos: 'RB', alpha: 8.91 },
    ];
    const unscored = Array.from({ length: 6 }, (_, index) => ({
      name: `Mapped Missing FORGE ${index + 1}`,
      pos: index % 2 === 0 ? 'WR' : 'RB',
      alpha: null,
      missingReason: 'missing_forge_row',
    }));

    const result = classifyTeamDirection(rosterOf([...playerSpecificForgeRows, ...unscored]), []);
    const explanationText = [...result.reasons, ...result.blockers].join(' ');

    expect(result.direction).toBe('rebuild');
    expect(result.confidence).toBe('high');
    expect(result.forgeCoverage).toEqual({ matched: 24, total: 30, rate: 0.8 });
    expect(result.evidenceCoverage).toEqual({ matched: 24, total: 30, rate: 0.8, rookieAlphaMatched: 0 });
    expect(result.visibilityCounts.generatedBaselineVisibility).toBe(0);
    expect(explanationText).not.toContain('No clear top-end difference-makers');
    expect(explanationText).toContain('concentration');
    expect(explanationText).toContain('clean contender read');
    expect(explanationText).toContain('durable long-term anchors');
  });

  test('generated_baseline rows remain visibility only and cannot lift Team Direction above low-coverage Uncertain', () => {
    const roster = rosterOf([
      { name: 'Player-Specific QB', pos: 'QB', alpha: 68, forgeScoreSource: 'player_specific' },
      { name: 'Player-Specific WR', pos: 'WR', alpha: 64, forgeScoreSource: 'player_specific' },
      { name: 'Generated RB 1', pos: 'RB', alpha: 70, forgeScoreSource: 'generated_baseline' },
      { name: 'Generated RB 2', pos: 'RB', alpha: 69, forgeScoreSource: 'generated_baseline' },
      { name: 'Generated WR', pos: 'WR', alpha: 67, forgeScoreSource: 'generated_baseline' },
      { name: 'Generated TE', pos: 'TE', alpha: 65, forgeScoreSource: 'generated_baseline' },
    ]);

    const result = classifyTeamDirection(roster, []);

    expect(result.direction).toBe('uncertain');
    expect(result.confidence).toBe('low');
    expect(result.forgeCoverage).toEqual({ matched: 2, total: 6, rate: 2 / 6 });
    expect(result.visibilityCounts.generatedBaselineVisibility).toBe(4);
    expect(result.blockers.some((blocker) => blocker.includes('Need ≥ 50% to classify'))).toBe(true);
  });

  test('returns contender with high average alpha and strong QB', () => {
    const roster = rosterOf([
      { pos: 'QB', alpha: 70 },
      { pos: 'RB', alpha: 68 },
      { pos: 'WR', alpha: 72 },
      { pos: 'WR', alpha: 65 },
      { pos: 'TE', alpha: 60 },
      { pos: 'RB', alpha: 62 },
    ]);
    const result = classifyTeamDirection(roster, []);
    expect(result.direction).toBe('contender');
    expect(['medium', 'high']).toContain(result.confidence);
    expect(result.reasons.length).toBeGreaterThan(0);
  });

  test('returns rebuild with low average alpha and many picks', () => {
    const roster = rosterOf([
      { pos: 'QB', alpha: 30 },
      { pos: 'RB', alpha: 28 },
      { pos: 'WR', alpha: 35 },
      { pos: 'WR', alpha: 22 },
      { pos: 'TE', alpha: 38 },
      { pos: 'RB', alpha: 25 },
    ]);
    const picks = [
      { season: 2026, round: 1, source: 'trade' },
      { season: 2026, round: 2, source: 'original' },
      { season: 2027, round: 1, source: 'trade' },
    ];
    const result = classifyTeamDirection(roster, picks);
    expect(result.direction).toBe('rebuild');
    expect(result.reasons.some((r) => r.includes('below') || r.includes('rebuild') || r.includes('Below'))).toBe(true);
  });

  test('returns retool for mixed signal roster', () => {
    const roster = rosterOf([
      { pos: 'QB', alpha: 48 },
      { pos: 'RB', alpha: 55 },
      { pos: 'WR', alpha: 52 },
      { pos: 'WR', alpha: 45 },
      { pos: 'TE', alpha: 50 },
      { pos: 'RB', alpha: 47 },
    ]);
    const result = classifyTeamDirection(roster, []);
    expect(result.direction).toBe('retool');
  });

  test('coverage block appears when unmatched players exist above 50% threshold', () => {
    const roster = rosterOf([
      { pos: 'QB', alpha: 70 },
      { pos: 'RB', alpha: 65 },
      { pos: 'WR', alpha: 72 },
      { pos: 'WR', alpha: 60 },
      { pos: 'TE', alpha: null, missingReason: 'missing_forge_row' },
      { pos: 'RB', alpha: null, missingReason: 'unmapped_sleeper_id' },
    ]);
    const result = classifyTeamDirection(roster, []);
    expect(result.direction).not.toBe('uncertain');
    expect(result.blockers.some((b) => b.includes('missing FORGE') || b.includes('coverage'))).toBe(true);
  });

  test('result always has required shape', () => {
    const result = classifyTeamDirection([], []);
    expect(result).toHaveProperty('direction');
    expect(result).toHaveProperty('confidence');
    expect(Array.isArray(result.reasons)).toBe(true);
    expect(Array.isArray(result.blockers)).toBe(true);
    expect(result.coverage).toHaveProperty('matched');
    expect(result.coverage).toHaveProperty('total');
    expect(result.coverage).toHaveProperty('rate');
    expect(result.classificationAvailable).toBe(false);
  });

  test('fails closed when the named freshness receipt is missing', () => {
    const roster = rosterOf([
      { pos: 'QB', alpha: 70 },
      { pos: 'RB', alpha: 68 },
      { pos: 'WR', alpha: 72 },
      { pos: 'WR', alpha: 65 },
    ]);

    const result = classifyTeamDirectionWithoutReceipt(roster, []);

    expect(result).toMatchObject({
      classificationAvailable: false,
      direction: 'uncertain',
      confidence: 'low',
      forgeCoverage: { matched: 0, total: 4, rate: 0 },
      confidenceInputs: { scoredPlayers: 0 },
      classificationFailure: { code: 'forge_freshness_receipt_missing_or_invalid' },
    });
    expect(result.reasons).toEqual([]);
  });

  test('fails closed on an unsupported freshness receipt version', () => {
    const roster = rosterOf([
      { pos: 'QB', alpha: 70 },
      { pos: 'RB', alpha: 68 },
      { pos: 'WR', alpha: 72 },
      { pos: 'WR', alpha: 65 },
    ]);
    const unsupported = {
      ...acceptedReceiptForRoster(roster),
      receiptVersion: 'team_direction_forge_player_static_freshness_receipt_v2',
    } as any;

    const result = classifyTeamDirectionWithoutReceipt(roster, [], { forgeFreshnessReceipt: unsupported });

    expect(result).toMatchObject({
      classificationAvailable: false,
      direction: 'uncertain',
      forgeCoverage: { matched: 0, total: 4, rate: 0 },
      classificationFailure: { code: 'forge_freshness_receipt_missing_or_invalid' },
    });
  });

  test.each([
    ['unavailable artifact', (receipt: ReturnType<typeof acceptedReceiptForRoster>) => ({
      ...receipt,
      artifact: { ...receipt.artifact, available: false, state: 'missing' },
    })],
    ['future root clock', (receipt: ReturnType<typeof acceptedReceiptForRoster>) => ({
      ...receipt,
      clocks: { ...receipt.clocks, generatedAt: '2026-08-02T00:00:00.000Z' },
    })],
  ])('fails closed when an accepted-looking receipt has a contradictory %s', (_label, mutate) => {
    const roster = rosterOf([
      { pos: 'QB', alpha: 70 },
      { pos: 'RB', alpha: 68 },
      { pos: 'WR', alpha: 72 },
      { pos: 'WR', alpha: 65 },
    ]);
    const contradictory = mutate(acceptedReceiptForRoster(roster));

    const result = classifyTeamDirectionWithoutReceipt(roster, [], {
      forgeFreshnessReceipt: contradictory as any,
    });

    expect(result).toMatchObject({
      classificationAvailable: false,
      direction: 'uncertain',
      confidence: 'low',
      forgeCoverage: { matched: 0, total: 4, rate: 0 },
      confidenceInputs: { scoredPlayers: 0 },
    });
  });

  test('requires explicit player_specific provenance even when the receipt is fresh', () => {
    const roster = rosterOf([
      { pos: 'QB', alpha: 70, forgeScoreSource: null },
      { pos: 'RB', alpha: 68, forgeScoreSource: null },
      { pos: 'WR', alpha: 72, forgeScoreSource: null },
      { pos: 'WR', alpha: 65, forgeScoreSource: null },
    ]);

    const result = classifyTeamDirection(roster, []);

    expect(result).toMatchObject({
      classificationAvailable: false,
      direction: 'uncertain',
      confidence: 'low',
      forgeCoverage: { matched: 0, total: 4, rate: 0 },
    });
  });

  test('does not count NaN or Infinity as player-specific FORGE evidence', () => {
    const roster = rosterOf([
      { pos: 'QB', alpha: Number.NaN, forgeScoreSource: 'player_specific' },
      { pos: 'RB', alpha: Number.POSITIVE_INFINITY, forgeScoreSource: 'player_specific' },
      { pos: 'WR', alpha: 72, forgeScoreSource: 'player_specific' },
      { pos: 'WR', alpha: null },
    ]);

    const result = classifyTeamDirection(roster, []);

    expect(result.forgeCoverage).toEqual({ matched: 1, total: 4, rate: 0.25 });
    expect(result.direction).toBe('uncertain');
  });

  test('rejects high Alpha rows without leaking them into direction, confidence, or eligible coverage', () => {
    const roster = rosterOf([
      { pos: 'QB', alpha: 99 },
      { pos: 'RB', alpha: 98 },
      { pos: 'WR', alpha: 97 },
      { pos: 'WR', alpha: 96 },
    ]);
    const rejectedReceipt = buildTeamDirectionForgeFreshnessReceipt({
      artifact: {
        state: 'available',
        available: true,
        generatedAt: '2026-01-08T00:00:00.000Z',
        generatedAtSource: 'root_generated_at',
        promotedAt: null,
      },
      rosterPlayers: roster,
      now: CLASSIFIER_NOW,
    });

    const result = classifyTeamDirectionWithoutReceipt(roster, [], { forgeFreshnessReceipt: rejectedReceipt });

    expect(result).toMatchObject({
      classificationAvailable: false,
      direction: 'uncertain',
      confidence: 'low',
      forgeCoverage: { matched: 0, total: 4, rate: 0 },
      visibilityCounts: { forgeScored: 0 },
      confidenceInputs: {
        scoredPlayers: 0,
        scoredPositionCounts: { QB: 0, RB: 0, WR: 0, TE: 0, Other: 0 },
      },
      classificationFailure: { code: 'forge_freshness_receipt_rejected', reasonCode: 'root_generated_at_stale' },
    });
    expect(result.visibilityCounts.knownUnscored).toBe(4);
    expect(
      result.visibilityCounts.forgeScored
      + result.visibilityCounts.forgeBaseline
      + result.visibilityCounts.rookieAlphaFallback
      + result.visibilityCounts.knownUnscored
      + result.visibilityCounts.unresolved,
    ).toBe(result.visibilityCounts.total);
    expect(result.reasons).toEqual([]);
    expect([...result.reasons, ...result.blockers].join(' ')).not.toContain('99');
  });

  test('contender with null QB adds blocker instead of silently passing in 1QB', () => {
    const roster = rosterOf([
      { pos: 'RB', alpha: 72 },
      { pos: 'WR', alpha: 68 },
      { pos: 'WR', alpha: 65 },
      { pos: 'WR', alpha: 62 },
      { pos: 'TE', alpha: 60 },
      { pos: 'RB', alpha: 70 },
    ]);
    const result = classifyTeamDirection(roster, []);
    // Strong avg alpha should pass the contender gate in 1QB when no QB veto
    expect(result.direction).toBe('contender');
    // Must include a QB blocker acknowledging missing QB data
    expect(result.blockers.some((b) => b.toLowerCase().includes('qb'))).toBe(true);
  });

  test('Superflex: null QB data forces out of contender even with high avg alpha', () => {
    const roster = rosterOf([
      { pos: 'RB', alpha: 72 },
      { pos: 'WR', alpha: 70 },
      { pos: 'WR', alpha: 68 },
      { pos: 'TE', alpha: 65 },
      { pos: 'RB', alpha: 62 },
      { pos: 'WR', alpha: 60 },
    ]);
    const result = classifyTeamDirection(roster, [], { superflex: true });
    // Without QB data in Superflex, should NOT classify as contender
    expect(result.direction).not.toBe('contender');
    expect(result.blockers.some((b) => b.toLowerCase().includes('qb'))).toBe(true);
  });

  test('Superflex: weak QB alpha (< 58) blocks contender classification', () => {
    const roster = rosterOf([
      { pos: 'QB', alpha: 45 },
      { pos: 'RB', alpha: 72 },
      { pos: 'WR', alpha: 70 },
      { pos: 'WR', alpha: 65 },
      { pos: 'TE', alpha: 62 },
      { pos: 'RB', alpha: 60 },
    ]);
    const result = classifyTeamDirection(roster, [], { superflex: true });
    expect(result.direction).not.toBe('contender');
    expect(result.blockers.some((b) => b.toLowerCase().includes('qb'))).toBe(true);
  });

  test('Superflex: strong QB depth with high avg alpha classifies as contender', () => {
    const roster = rosterOf([
      { pos: 'QB', alpha: 72 },
      { pos: 'QB', alpha: 62 },
      { pos: 'RB', alpha: 68 },
      { pos: 'WR', alpha: 70 },
      { pos: 'WR', alpha: 65 },
      { pos: 'TE', alpha: 60 },
    ]);
    const result = classifyTeamDirection(roster, [], { superflex: true });
    expect(result.direction).toBe('contender');
    expect(result.reasons.some((r) => r.toLowerCase().includes('qb'))).toBe(true);
  });

  test('WR/TE depth: weak WR corps on otherwise-contender roster adds WR blocker', () => {
    const roster = rosterOf([
      { pos: 'QB', alpha: 68 },
      { pos: 'RB', alpha: 72 },
      { pos: 'WR', alpha: 38 },
      { pos: 'WR', alpha: 35 },
      { pos: 'TE', alpha: 62 },
      { pos: 'RB', alpha: 65 },
    ]);
    const result = classifyTeamDirection(roster, []);
    if (result.direction === 'contender' || result.direction === 'retool') {
      expect(result.blockers.some((b) => b.toLowerCase().includes('wr') || b.toLowerCase().includes('receiver'))).toBe(true);
    }
  });

  test('strong WR depth appears in contender reasons', () => {
    const roster = rosterOf([
      { pos: 'QB', alpha: 65 },
      { pos: 'RB', alpha: 68 },
      { pos: 'WR', alpha: 72 },
      { pos: 'WR', alpha: 68 },
      { pos: 'WR', alpha: 65 },
      { pos: 'TE', alpha: 62 },
    ]);
    const result = classifyTeamDirection(roster, []);
    expect(result.direction).toBe('contender');
    // Either WR depth is in reasons or TE is mentioned
    const allText = [...result.reasons, ...result.blockers].join(' ').toLowerCase();
    expect(allText.includes('wr') || allText.includes('te') || allText.includes('receiver')).toBe(true);
  });
});

describe('GET /api/management/team-direction (endpoint)', () => {
  const goodRoster = rosterOf([
    { pos: 'QB', alpha: 70 },
    { pos: 'RB', alpha: 68 },
    { pos: 'WR', alpha: 72 },
    { pos: 'WR', alpha: 65 },
    { pos: 'TE', alpha: 60 },
    { pos: 'RB', alpha: 62 },
  ]);

  function makeDeps(overrides: {
    context?: Partial<typeof baseContext>;
    roster?: typeof goodRoster;
    picks?: any[];
    forgeArtifact?: any;
  } = {}) {
    const context = { ...baseContext, ...overrides.context } as typeof baseContext;
    const roster = overrides.roster ?? goodRoster;
    const picks = overrides.picks ?? [];
    const playerSpecificMatches = roster.filter((player) => player.forgeScoreSource === 'player_specific' && typeof player.alpha === 'number').length;
    const forgeArtifact = overrides.forgeArtifact ?? {
      state: 'available',
      available: true,
      reason: null,
      code: null,
      sourcePath: 'server/artifacts/external/forge/forge_player_static_v1.json',
      contractVersion: 'forge_player_static_v1',
      generatedAt: '2026-07-31T00:00:00.000Z',
      generatedAtSource: 'root_generated_at',
      promotedAt: null,
      playerSpecificCount: 45,
      generatedBaselineCount: 14,
      freshness: { status: 'fresh', ageDays: 1, timestamp: '2026-07-31T00:00:00.000Z', maxAgeDays: 45 },
    };
    return {
      storage: {
        getUserLeagueContext: jest.fn().mockResolvedValue(context),
        getLeagueFuturePicks: jest.fn().mockResolvedValue(picks),
      } as any,
      computeLeagueDashboard: jest.fn().mockResolvedValue({
        diagnostics: {
          forgeArtifact,
          forgeRosterMatching: { rosterCanonicalIdsChecked: roster.length, rosterCanonicalIdsMatched: playerSpecificMatches, playerSpecificRosterMatches: playerSpecificMatches, generatedBaselineRosterMatches: 0, sampleUnmatchedCanonicalIds: [], sampleMatchedCanonicalIds: ['p1'] },
          rosterVisibility: { total: roster.length, identityCovered: roster.length, baselineVisible: 0, forgeScored: playerSpecificMatches, forgeBaseline: 0, generatedBaselineVisibility: 0, rookieAlphaFallback: 0, knownUnscored: roster.length - playerSpecificMatches, unresolved: 0, evidenceCovered: playerSpecificMatches },
          strategyOntologyArtifact: {
            state: 'available',
            available: true,
            reason: null,
            code: null,
            sourcePath: 'server/artifacts/external/strategy/dynasty_strategy_ontology_v1.json',
            artifactId: 'DYNASTY_STRATEGY_ONTOLOGY_V1',
            artifactType: 'DYNASTY_STRATEGY_ONTOLOGY_V1',
            contractVersion: 'dynasty_strategy_ontology_v1',
            modelVersion: 'dynasty-strategy-ontology-v1.0.0',
            generatedAt: '2026-06-10T00:00:00.000Z',
            rowCount: 0,
            concepts: 11,
            playerAssetArchetypes: 10,
            rosterStateDefinitions: 8,
            timelineRules: 9,
            explanationTemplates: 7,
            futureContractInputs: ['age_band', 'experience_band', 'role_security_signal', 'market_liquidity_signal'],
            safetyRules: ['cannot_override_identity'],
            archetypeAssignmentEnabled: false,
            templateSelectionEnabled: false,
          },
          strategyOntologyTemplates: [
            { template_id: 'rebuild_low_alpha_concentration', applies_to: ['rebuild'] },
            { template_id: 'rebuild_premium_assets_timeline_mismatch', applies_to: ['rebuild', 'timeline_mismatch'] },
            { template_id: 'productive_rebuild_with_anchor_base', applies_to: ['productive_rebuild'] },
            { template_id: 'contender_with_future_pick_drag', applies_to: ['contender'] },
          ],
        },
        teams: [
          { team_id: 'team-1', display_name: 'Test Team', roster, totals: {}, overall_total: 0 },
        ],
      }),
      classifyTeamDirection,
      now: () => CLASSIFIER_NOW,
    };
  }

  test('returns 400 when league_id is missing', async () => {
    const app = buildApp(makeDeps());
    const res = await request(app).get('/api/management/team-direction?user_id=default_user');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns available:false with quiet message when no active team', async () => {
    const deps = makeDeps({ context: { ...baseContext, activeTeam: null } as any });
    const app = buildApp(deps);
    const res = await request(app).get('/api/management/team-direction?user_id=default_user&league_id=league-1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.available).toBe(false);
    expect(typeof res.body.reason).toBe('string');
  });

  test('returns direction payload for valid team with good roster', async () => {
    const app = buildApp(makeDeps());
    const res = await request(app).get('/api/management/team-direction?user_id=default_user&league_id=league-1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.available).toBe(true);
    expect(['contender', 'rebuild', 'retool', 'uncertain']).toContain(res.body.direction);
    expect(['high', 'medium', 'low']).toContain(res.body.confidence);
    expect(Array.isArray(res.body.reasons)).toBe(true);
    expect(Array.isArray(res.body.blockers)).toBe(true);
    expect(res.body.coverage).toHaveProperty('matched');
    expect(res.body.coverage).toHaveProperty('total');
    expect(res.body.coverage).toHaveProperty('rate');
    expect(res.body.evidenceCoverage).toHaveProperty('rate');
    expect(res.body.forgeCoverage).toHaveProperty('rate');
    expect(res.body.forgeDiagnostics).toEqual(expect.objectContaining({
      artifact: expect.objectContaining({ state: 'available', available: true }),
      rosterMatching: expect.objectContaining({ rosterCanonicalIdsChecked: goodRoster.length }),
      strategyOntology: expect.objectContaining({
        available: true,
        artifactType: 'DYNASTY_STRATEGY_ONTOLOGY_V1',
        contractVersion: 'dynasty_strategy_ontology_v1',
        modelVersion: 'dynasty-strategy-ontology-v1.0.0',
        generatedAt: '2026-06-10T00:00:00.000Z',
        archetypeAssignmentEnabled: false,
        templateSelectionEnabled: false,
      }),
    }));
    expect(res.body.confidenceInputs).toEqual(expect.objectContaining({
      driver: 'forge_scoring_coverage_and_position_quality',
      forgeCoverage: expect.objectContaining({ rate: expect.any(Number) }),
      evidenceCoverage: expect.objectContaining({ rate: expect.any(Number) }),
      scoredPositionCounts: expect.any(Object),
    }));
    expect(res.body).toMatchObject({
      classificationAvailable: true,
      forge_freshness_receipt: {
        policyId: 'team_direction_forge_player_static_freshness_v1',
        decision: 'accepted',
        status: 'fresh',
      },
    });
    expect(res.body.strategy_template_diagnostics).toMatchObject({
      available: true,
      template_selection_enabled: false,
      selected_template_id: null,
      current_team_direction: 'Contender',
      current_confidence: 'Medium',
      evaluated_template_count: 4,
      classification_compatible_template_ids: ['contender_with_future_pick_drag'],
      blocked_reasons: ['template_selection_disabled', 'missing_future_contract_inputs'],
      missing_future_contract_inputs: ['age_band', 'experience_band', 'role_security_signal', 'market_liquidity_signal'],
    });
    expect(res.body.forgeDiagnostics.strategyTemplateDiagnostics).toEqual(res.body.strategy_template_diagnostics);
    expect(JSON.stringify(res.body.strategy_template_diagnostics)).not.toContain('text');
  });


  test('exposes additive read-only strategy_context_activation diagnostics without changing existing fields', async () => {
    const app = buildApp(makeDeps());
    const res = await request(app).get('/api/management/team-direction?user_id=default_user&league_id=league-1');
    expect(res.status).toBe(200);

    // Additive, clearly labeled diagnostic field.
    expect(res.body.strategy_context_activation).toBeDefined();
    const activation = res.body.strategy_context_activation;
    expect(activation.diagnostic).toBe(true);
    expect(activation.readOnly).toBe(true);
    expect(activation.useId).toBe('strategy_context.readiness');
    // Ontology available + direction/confidence present → inspectable but blocked,
    // capped to read-only diagnostic visibility (Level 1) in this slice.
    expect(activation.status).toBe('blocked');
    expect(activation.effectiveLevel).toBe(1);
    // Templates remain disabled — never activated by this diagnostic.
    expect(activation.templateSelectionEnabled).toBe(false);
    expect(activation.selectedTemplateId).toBeNull();
    expect(res.body.forgeDiagnostics.strategyContextActivation).toEqual(activation);

    // Existing behavior unchanged: classification + template diagnostics intact.
    expect(['contender', 'rebuild', 'retool', 'uncertain']).toContain(res.body.direction);
    expect(res.body.strategy_template_diagnostics.selected_template_id).toBeNull();
    expect(res.body.management_strategy_context.selected_template_id).toBeNull();
    // No rendered template content leaks through the new field.
    expect(JSON.stringify(activation)).not.toMatch(/\{\{|\}\}/);
  });

  test('uses the enforced G6 receipt in read-only forge_evidence_activation diagnostics', async () => {
    const app = buildApp(makeDeps());
    const res = await request(app).get('/api/management/team-direction?user_id=default_user&league_id=league-1');
    expect(res.status).toBe(200);

    const forgeActivation = res.body.forge_evidence_activation;
    expect(forgeActivation).toBeDefined();
    expect(forgeActivation.diagnostic).toBe(true);
    expect(forgeActivation.readOnly).toBe(true);
    expect(forgeActivation.playerSpecific.useId).toBe('forge_player_specific.team_direction_classification');
    expect(forgeActivation.generatedBaseline.useId).toBe('forge_generated_baseline.visibility');
    expect(forgeActivation.playerSpecific.effectiveLevel).toBe(3);
    expect(forgeActivation.playerSpecific.failedGates).not.toContain('G6');
    expect(forgeActivation.freshnessReceipt).toEqual(res.body.forge_freshness_receipt);
    // Generated baselines are never promoted to evidence.
    expect(forgeActivation.generatedBaseline.effectiveLevel).toBeLessThan(3);
    expect(res.body.forgeDiagnostics.forgeEvidenceActivation).toEqual(forgeActivation);

    expect(res.body.classificationAvailable).toBe(true);
    expect(['contender', 'rebuild', 'retool']).toContain(res.body.direction);
    expect(res.body.forgeCoverage).toHaveProperty('rate');
    // Slice 3 diagnostics remain present and unchanged.
    expect(res.body.strategy_context_activation).toBeDefined();
    expect(res.body.strategy_context_activation.useId).toBe('strategy_context.readiness');
    // No advice/recommendation language leaks through the new field.
    expect(JSON.stringify(forgeActivation).toLowerCase()).not.toMatch(/\brecommend|\badvis|you should|trade away/);
  });

  test('recomputes stale cached evidence per request and fails Team Direction closed', async () => {
    const deps = makeDeps({
      forgeArtifact: {
        state: 'available',
        available: true,
        reason: null,
        code: null,
        sourcePath: 'server/artifacts/external/forge/forge_player_static_v1.json',
        contractVersion: 'forge_player_static_v1',
        generatedAt: '2026-01-08T00:00:00.000Z',
        generatedAtSource: 'root_generated_at',
        promotedAt: '2026-07-31T00:00:00.000Z',
        // Cached generic metadata deliberately disagrees with the named policy.
        freshness: { status: 'fresh', ageDays: 1, timestamp: '2026-07-31T00:00:00.000Z', maxAgeDays: 45 },
        playerSpecificCount: 45,
        generatedBaselineCount: 14,
      },
    });
    const res = await request(buildApp(deps)).get('/api/management/team-direction?user_id=default_user&league_id=league-1');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      available: true,
      classificationAvailable: false,
      direction: 'uncertain',
      confidence: 'low',
      forgeCoverage: { matched: 0, total: goodRoster.length, rate: 0 },
      confidenceInputs: { scoredPlayers: 0 },
      classificationFailure: {
        code: 'forge_freshness_receipt_rejected',
        reasonCode: 'root_generated_at_stale',
      },
      forge_freshness_receipt: {
        decision: 'rejected',
        status: 'stale',
        reasonCode: 'root_generated_at_stale',
        clocks: { promotedAtCanRefreshClock: false },
        evidence: {
          observedPlayerSpecificRows: goodRoster.length,
          eligiblePlayerSpecificRows: 0,
          rejectedPlayerSpecificRows: goodRoster.length,
        },
      },
    });
    expect(res.body.reasons).toEqual([]);
    expect(res.body.forge_evidence_activation.playerSpecific.failedGates).toContain('G6');
    expect(res.body.forge_evidence_activation.freshnessReceipt).toEqual(res.body.forge_freshness_receipt);
    expect(res.body.forge_freshness_receipt.conflicts).toEqual(expect.arrayContaining([
      'warn_only_freshness_disagrees_with_named_policy',
      'promoted_at_present_but_ineligible_to_refresh_clock',
    ]));
  });

  test('preserves the same rejected receipt in backend diagnostics when dashboard diagnostics are absent', async () => {
    const deps = makeDeps();
    const baseDashboardPayload = await deps.computeLeagueDashboard({} as any);
    deps.computeLeagueDashboard = jest.fn().mockResolvedValue({
      ...baseDashboardPayload,
      diagnostics: undefined,
    });

    const res = await request(buildApp(deps)).get('/api/management/team-direction?user_id=default_user&league_id=league-1');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      classificationAvailable: false,
      direction: 'uncertain',
      forge_freshness_receipt: {
        decision: 'rejected',
        status: 'unknown',
        reasonCode: 'artifact_unavailable',
      },
      forge_evidence_activation: {
        playerSpecific: { failedGates: expect.arrayContaining(['G6']) },
      },
      forgeDiagnostics: {
        artifact: null,
        forgeFreshnessReceipt: { decision: 'rejected', status: 'unknown' },
      },
    });
    expect(res.body.forge_evidence_activation.freshnessReceipt).toEqual(res.body.forge_freshness_receipt);
    expect(res.body.forgeDiagnostics.forgeEvidenceActivation.freshnessReceipt).toEqual(res.body.forge_freshness_receipt);
  });

  test('strategy ontology diagnostics do not change Management classification output', async () => {
    const depsWithOntology = makeDeps();
    const depsWithoutOntology = makeDeps();
    const baseDashboardPayload = await depsWithoutOntology.computeLeagueDashboard({} as any);
    depsWithoutOntology.computeLeagueDashboard = jest.fn().mockResolvedValue({
      ...baseDashboardPayload,
      diagnostics: {
        ...baseDashboardPayload.diagnostics,
        strategyOntologyArtifact: { available: false, state: 'missing', reason: 'missing artifact', artifactType: null, contractVersion: null, modelVersion: null, generatedAt: null, futureContractInputs: [], archetypeAssignmentEnabled: false, templateSelectionEnabled: false },
        strategyOntologyTemplates: [],
      },
    });

    const withRes = await request(buildApp(depsWithOntology)).get('/api/management/team-direction?user_id=default_user&league_id=league-1');
    const withoutRes = await request(buildApp(depsWithoutOntology)).get('/api/management/team-direction?user_id=default_user&league_id=league-1');

    expect(withRes.body.direction).toBe(withoutRes.body.direction);
    expect(withRes.body.confidence).toBe(withoutRes.body.confidence);
    expect(withRes.body.reasons).toEqual(withoutRes.body.reasons);
    expect(withRes.body.blockers).toEqual(withoutRes.body.blockers);
    expect(withRes.body.forgeDiagnostics.strategyOntology).toMatchObject({
      archetypeAssignmentEnabled: false,
      templateSelectionEnabled: false,
    });
    expect(withRes.body.strategy_template_diagnostics.selected_template_id).toBeNull();
    expect(withRes.body.strategy_template_diagnostics.template_selection_enabled).toBe(false);
    expect(withRes.body.strategy_template_diagnostics.current_team_direction.toLowerCase()).toBe(withRes.body.direction);
  });

  test('returns low-coverage result as uncertain when roster is mostly unmatched', async () => {
    const sparseRoster = rosterOf([
      { pos: 'QB', alpha: null },
      { pos: 'RB', alpha: null },
      { pos: 'WR', alpha: null },
      { pos: 'WR', alpha: null },
      { pos: 'TE', alpha: 60 },
    ]);
    const app = buildApp(makeDeps({ roster: sparseRoster }));
    const res = await request(app).get('/api/management/team-direction?user_id=default_user&league_id=league-1');
    expect(res.status).toBe(200);
    expect(res.body.direction).toBe('uncertain');
    expect(res.body.blockers.length).toBeGreaterThan(0);
  });

  test('returns available:false when team not found in dashboard', async () => {
    const deps = makeDeps();
    deps.computeLeagueDashboard = jest.fn().mockResolvedValue({ teams: [] });
    const app = buildApp(deps);
    const res = await request(app).get('/api/management/team-direction?user_id=default_user&league_id=league-1');
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(false);
  });
});
