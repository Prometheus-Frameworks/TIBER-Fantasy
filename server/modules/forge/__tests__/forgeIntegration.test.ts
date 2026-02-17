import { sql } from 'drizzle-orm';
import { db } from '../../../infra/db';
import { gradeForgeWithMeta, type ForgeFullResult } from '../forgeGrading';
import { runForgeEngineBatch, type ForgeEngineOutput, type Position } from '../forgeEngine';

jest.setTimeout(60_000);

const TEST_SEASON = 2025;
const POSITIONS: Position[] = ['QB', 'RB', 'WR', 'TE'];
const VALID_TIERS = new Set(['T1', 'T2', 'T3', 'T4', 'T5']);

type CachedBatch = {
  engine: ForgeEngineOutput[];
  redraft: ForgeFullResult[];
  dynasty: ForgeFullResult[];
  bestball: ForgeFullResult[];
};

const batchCache = new Map<Position, Promise<CachedBatch>>();

function toRanked(results: ForgeFullResult[]): ForgeFullResult[] {
  return [...results].sort((a, b) => b.alpha - a.alpha);
}

async function getBatch(position: Position): Promise<CachedBatch> {
  const existing = batchCache.get(position);
  if (existing) return existing;

  const pending = (async () => {
    const engine = await runForgeEngineBatch(position, TEST_SEASON, 'season', 80);
    const redraft = toRanked(engine.map((r) => gradeForgeWithMeta(r, { mode: 'redraft' })));
    const dynasty = toRanked(engine.map((r) => gradeForgeWithMeta(r, { mode: 'dynasty' })));
    const bestball = toRanked(engine.map((r) => gradeForgeWithMeta(r, { mode: 'bestball' })));

    return { engine, redraft, dynasty, bestball };
  })();

  batchCache.set(position, pending);
  return pending;
}

function expectInRange(value: number, label: string): void {
  expect(value).toBeGreaterThanOrEqual(0);
  expect(value).toBeLessThanOrEqual(100);
  expect(Number.isFinite(value)).toBe(true);
  expect(value).not.toBeNaN();
  expect(typeof label).toBe('string');
}

function playerRank(results: ForgeFullResult[], playerId: string): number {
  return results.findIndex((row) => row.playerId === playerId);
}

async function resolveCanonicalId(position: Position, fullNamePatterns: string[]): Promise<string | null> {
  for (const pattern of fullNamePatterns) {
    const rows = await db.execute(sql`
      SELECT canonical_id
      FROM player_identity_map
      WHERE position = ${position}
        AND full_name ILIKE ${`%${pattern}%`}
      ORDER BY canonical_id ASC
      LIMIT 1
    `);

    const canonicalId = (rows.rows[0] as { canonical_id?: string } | undefined)?.canonical_id;
    if (canonicalId) return canonicalId;
  }
  return null;
}

describe('FORGE Batch Sanity', () => {
  for (const position of POSITIONS) {
    it(`${position} batch returns valid results`, async () => {
      const { engine, redraft } = await getBatch(position);

      // Guardrail: Batch should have enough players to represent real rankings.
      expect(engine.length).toBeGreaterThanOrEqual(10);

      // Guardrail: Public rankings should remain alpha-sorted for deterministic UX/API behavior.
      for (let i = 0; i < redraft.length - 1; i += 1) {
        expect(redraft[i].alpha).toBeGreaterThanOrEqual(redraft[i + 1].alpha);
      }

      for (const result of redraft) {
        // Guardrail: overall alpha and each pillar should remain bounded to 0-100.
        expectInRange(result.alpha, `${result.playerName} alpha`);
        expectInRange(result.pillars.volume, `${result.playerName} volume`);
        expectInRange(result.pillars.efficiency, `${result.playerName} efficiency`);
        expectInRange(result.pillars.teamContext, `${result.playerName} teamContext`);
        expectInRange(result.pillars.stability, `${result.playerName} stability`);

        // Guardrail: only valid tier labels should ever be emitted.
        expect(VALID_TIERS.has(result.tier)).toBe(true);

        // Regression guard: full-season contributors should not have zero stability.
        if (result.gamesPlayed >= 10) {
          expect(result.pillars.stability).toBeGreaterThan(0);
        }
      }
    });
  }
});

describe('FORGE Pinned Player Rankings (2025)', () => {
  it('QB pinned expectations: Josh Allen and Dak Prescott remain high-end profiles', async () => {
    const { redraft } = await getBatch('QB');

    const joshAllenId = await resolveCanonicalId('QB', ['Josh Allen']);
    const dakPrescottId = await resolveCanonicalId('QB', ['Dak Prescott']);

    expect(joshAllenId).toBeTruthy();
    expect(dakPrescottId).toBeTruthy();

    const allen = redraft.find((row) => row.playerId === joshAllenId);
    const dak = redraft.find((row) => row.playerId === dakPrescottId);

    expect(allen).toBeDefined();
    expect(allen?.alpha ?? 0).toBeGreaterThanOrEqual(60);
    expect(['T1', 'T2']).toContain(allen?.tier);

    expect(dak).toBeDefined();
    expect(dak?.alpha ?? 0).toBeGreaterThanOrEqual(65);

    // Regression guard from previous stability-zero bug reports.
    for (const qb of redraft.filter((row) => row.gamesPlayed >= 14)) {
      expect(qb.pillars.stability).toBeGreaterThanOrEqual(15);
    }
  });

  it('RB pinned expectations: elite bellcows are top tier and top alpha is elite', async () => {
    const { redraft } = await getBatch('RB');

    const saquonId = await resolveCanonicalId('RB', ['Saquon Barkley']);
    const henryId = await resolveCanonicalId('RB', ['Derrick Henry']);
    const cmcId = await resolveCanonicalId('RB', ['Christian McCaffrey', 'C. McCaffrey']);

    const eliteBellcow = redraft.find(
      (row) => row.playerId === saquonId || row.playerId === henryId,
    );
    expect(eliteBellcow).toBeDefined();
    expect(eliteBellcow?.tier).toBe('T1');

    const cmc = redraft.find((row) => row.playerId === cmcId);
    expect(cmc).toBeDefined();
    expect(cmc?.alpha ?? 0).toBeGreaterThanOrEqual(60);

    expect(redraft[0].alpha).toBeGreaterThanOrEqual(80);
  });

  it('WR pinned expectations: at least one elite anchor remains in T1', async () => {
    const { redraft } = await getBatch('WR');

    const chaseId = await resolveCanonicalId('WR', ["Ja'Marr Chase", 'Jamar Chase']);
    const amonRaId = await resolveCanonicalId('WR', ['Amon-Ra St. Brown', 'Amon Ra St Brown']);

    const eliteWr = redraft.find((row) => row.playerId === chaseId || row.playerId === amonRaId);
    expect(eliteWr).toBeDefined();
    expect(eliteWr?.tier).toBe('T1');

    expect(redraft[0].alpha).toBeGreaterThanOrEqual(80);
  });

  it('TE pinned expectations: Kelce or Kittle remain in top five and top alpha stays high', async () => {
    const { redraft } = await getBatch('TE');

    const kelceId = await resolveCanonicalId('TE', ['Travis Kelce']);
    const kittleId = await resolveCanonicalId('TE', ['George Kittle']);

    const topFiveIds = new Set(redraft.slice(0, 5).map((row) => row.playerId));
    expect(topFiveIds.has(kelceId ?? '') || topFiveIds.has(kittleId ?? '')).toBe(true);

    expect(redraft[0].alpha).toBeGreaterThanOrEqual(75);
  });
});

describe('FORGE Cross-Position Consistency', () => {
  it('top-end alpha scales and tier distribution remain healthy across positions', async () => {
    const qb = (await getBatch('QB')).redraft;
    const rb = (await getBatch('RB')).redraft;

    // Guardrail: positional top-end scores should stay in the same rough scale.
    expect(Math.abs(qb[0].alpha - rb[0].alpha)).toBeLessThanOrEqual(20);

    for (const position of POSITIONS) {
      const ranked = (await getBatch(position)).redraft;
      const t1Count = ranked.filter((r) => r.tier === 'T1').length;
      const t5Count = ranked.filter((r) => r.tier === 'T5').length;

      expect(t1Count).toBeGreaterThanOrEqual(2);
      expect(t5Count).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('FORGE Mode Consistency', () => {
  it('dynasty mode keeps top redraft players within ±5 ranking slots', async () => {
    for (const position of POSITIONS) {
      const { redraft, dynasty } = await getBatch(position);

      const topTenRedraft = redraft.slice(0, 10);
      for (const player of topTenRedraft) {
        const redraftRank = playerRank(redraft, player.playerId);
        const dynastyRank = playerRank(dynasty, player.playerId);

        expect(dynastyRank).toBeGreaterThanOrEqual(0);
        expect(Math.abs(dynastyRank - redraftRank)).toBeLessThanOrEqual(5);
      }
    }
  });

  it('bestball mode produces valid alpha and pillar ranges for every position', async () => {
    for (const position of POSITIONS) {
      const { bestball } = await getBatch(position);
      expect(bestball.length).toBeGreaterThanOrEqual(10);

      for (const row of bestball) {
        expectInRange(row.alpha, `${row.playerName} bestball alpha`);
        expectInRange(row.pillars.volume, `${row.playerName} bestball volume`);
        expectInRange(row.pillars.efficiency, `${row.playerName} bestball efficiency`);
        expectInRange(row.pillars.teamContext, `${row.playerName} bestball team context`);
        expectInRange(row.pillars.stability, `${row.playerName} bestball stability`);
      }
    }
  });
});

describe('FORGE Stability Pillar Regression Guards', () => {
  it('no player with >=14 games has stability exactly zero', async () => {
    for (const position of POSITIONS) {
      const { redraft } = await getBatch(position);
      for (const row of redraft.filter((p) => p.gamesPlayed >= 14)) {
        expect(row.pillars.stability).toBeGreaterThan(0);
      }
    }
  });

  it('QB and RB stability distributions stay above baseline means/max thresholds', async () => {
    const qbs = (await getBatch('QB')).redraft;
    const rbs = (await getBatch('RB')).redraft;

    const qbStability = qbs.map((q) => q.pillars.stability);
    const rbStability = rbs.map((r) => r.pillars.stability);

    const qbMean = qbStability.reduce((sum, n) => sum + n, 0) / qbStability.length;
    const qbMax = Math.max(...qbStability);
    const rbMean = rbStability.reduce((sum, n) => sum + n, 0) / rbStability.length;

    expect(qbMean).toBeGreaterThan(25);
    expect(qbMax).toBeGreaterThan(50);
    expect(rbMean).toBeGreaterThan(20);
  });
});
