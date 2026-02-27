/**
 * FORGE Football Lens Unit Tests
 *
 * Validates football-sense issue detection and bounded pillar adjustments in
 * applyFootballLens. Function under test is pure and DB-free, but db.ts is
 * mocked to bypass DATABASE_URL guard at import time.
 */

jest.mock('../../../infra/db', () => ({ db: {} }));

import { applyFootballLens } from '../forgeFootballLens';
import type { ForgeEngineOutput, ForgePillarScores } from '../forgeEngine';

function makeOutput(
  position: 'WR' | 'RB' | 'TE' | 'QB',
  pillars: Partial<ForgePillarScores>,
  gamesPlayed = 10
): ForgeEngineOutput {
  return {
    position,
    gamesPlayed,
    pillars: {
      volume: 60,
      efficiency: 60,
      teamContext: 60,
      stability: 60,
      ...pillars,
    },
  } as ForgeEngineOutput;
}

describe('applyFootballLens', () => {
  describe('WR rules', () => {
    it('flags WR_TD_SPIKE_LOW_VOLUME when WR volume < 40 and efficiency > 85', () => {
      const result = applyFootballLens(
        makeOutput('WR', { volume: 39, efficiency: 86 })
      );

      expect(result.issues.some((issue) => issue.code === 'WR_TD_SPIKE_LOW_VOLUME')).toBe(true);
    });

    it('scales down WR efficiency pillar by 0.9 on TD spike flag', () => {
      const output = makeOutput('WR', { volume: 30, efficiency: 90 });
      const result = applyFootballLens(output);

      expect(result.pillars.efficiency).toBeCloseTo(90 * 0.9, 5);
    });

    it('flags WR_HIGH_VOLUME_LOW_EFFICIENCY when volume > 75 and efficiency < 40', () => {
      const result = applyFootballLens(
        makeOutput('WR', { volume: 76, efficiency: 39 })
      );

      expect(
        result.issues.some((issue) => issue.code === 'WR_HIGH_VOLUME_LOW_EFFICIENCY')
      ).toBe(true);
    });

    it('does NOT scale efficiency on WR_HIGH_VOLUME_LOW_EFFICIENCY (info only)', () => {
      const output = makeOutput('WR', { volume: 80, efficiency: 30 });
      const result = applyFootballLens(output);

      expect(result.pillars.efficiency).toBe(30);
    });

    it('produces no issues for a balanced WR (volume=65, efficiency=65)', () => {
      const result = applyFootballLens(
        makeOutput('WR', { volume: 65, efficiency: 65 })
      );

      expect(result.issues).toHaveLength(0);
    });
  });

  describe('RB rules', () => {
    it('flags RB_VOLUME_WITH_BAD_EFFICIENCY when volume > 70 and efficiency < 50', () => {
      const result = applyFootballLens(
        makeOutput('RB', { volume: 71, efficiency: 49 })
      );

      expect(
        result.issues.some((issue) => issue.code === 'RB_VOLUME_WITH_BAD_EFFICIENCY')
      ).toBe(true);
    });

    it('flags RB_WORKHORSE_BAD_OFFENSE when volume > 80 and teamContext < 35', () => {
      const result = applyFootballLens(
        makeOutput('RB', { volume: 81, teamContext: 34 })
      );

      expect(result.issues.some((issue) => issue.code === 'RB_WORKHORSE_BAD_OFFENSE')).toBe(true);
    });

    it('flags RB_LOW_VOLUME_HIGH_EFFICIENCY and scales efficiency by 0.92', () => {
      const output = makeOutput('RB', { volume: 39, efficiency: 90 });
      const result = applyFootballLens(output);

      expect(result.issues.some((issue) => issue.code === 'RB_LOW_VOLUME_HIGH_EFFICIENCY')).toBe(
        true
      );
      expect(result.pillars.efficiency).toBeCloseTo(90 * 0.92, 5);
    });
  });

  describe('TE rules', () => {
    it('flags TE_TD_DEPENDENT when volume < 35 and efficiency > 80', () => {
      const result = applyFootballLens(
        makeOutput('TE', { volume: 34, efficiency: 81 })
      );

      expect(result.issues.some((issue) => issue.code === 'TE_TD_DEPENDENT')).toBe(true);
    });

    it('scales down TE efficiency pillar by 0.88 on TD-dependent flag', () => {
      const output = makeOutput('TE', { volume: 20, efficiency: 95 });
      const result = applyFootballLens(output);

      expect(result.pillars.efficiency).toBeCloseTo(95 * 0.88, 5);
    });
  });

  describe('QB rules', () => {
    it('flags QB_BOOM_BUST when efficiency > 85 and stability < 40', () => {
      const result = applyFootballLens(
        makeOutput('QB', { efficiency: 86, stability: 39 })
      );

      expect(result.issues.some((issue) => issue.code === 'QB_BOOM_BUST')).toBe(true);
    });

    it('flags QB_GARBAGE_TIME_VOLUME when volume > 75 and efficiency < 45', () => {
      const result = applyFootballLens(
        makeOutput('QB', { volume: 76, efficiency: 44 })
      );

      expect(result.issues.some((issue) => issue.code === 'QB_GARBAGE_TIME_VOLUME')).toBe(true);
    });
  });

  describe('cross-position rules', () => {
    it('flags PILLAR_POLARIZATION when one pillar >= 90 and another <= 30', () => {
      const result = applyFootballLens(
        makeOutput('WR', { volume: 90, efficiency: 30 })
      );

      expect(result.issues.some((issue) => issue.code === 'PILLAR_POLARIZATION')).toBe(true);
    });

    it('flags SMALL_SAMPLE_SIZE when gamesPlayed < 3', () => {
      const result = applyFootballLens(
        makeOutput('WR', { volume: 65, efficiency: 65 }, 2)
      );

      expect(result.issues.some((issue) => issue.code === 'SMALL_SAMPLE_SIZE')).toBe(true);
    });

    it('does not flag SMALL_SAMPLE_SIZE when gamesPlayed >= 3', () => {
      const result = applyFootballLens(
        makeOutput('WR', { volume: 65, efficiency: 65 }, 3)
      );

      expect(result.issues.some((issue) => issue.code === 'SMALL_SAMPLE_SIZE')).toBe(false);
    });
  });

  describe('output contract', () => {
    it('always returns pillars and issues keys', () => {
      const result = applyFootballLens(makeOutput('WR', {}));

      expect(result).toHaveProperty('pillars');
      expect(result).toHaveProperty('issues');
      expect(Array.isArray(result.issues)).toBe(true);
    });

    it('returned pillars are always clamped between 0 and 100', () => {
      const wrResult = applyFootballLens(
        makeOutput('WR', { volume: 10, efficiency: 500 })
      );
      const teResult = applyFootballLens(
        makeOutput('TE', { volume: 10, efficiency: -25 })
      );

      const values = [
        ...Object.values(wrResult.pillars),
        ...Object.values(teResult.pillars),
      ].filter((v): v is number => typeof v === 'number');

      for (const value of values) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    });

    it('does not mutate the original engineOutput pillars object', () => {
      const original = makeOutput('WR', { volume: 35, efficiency: 90 });
      const before = { ...original.pillars };

      const result = applyFootballLens(original);

      expect(original.pillars).toEqual(before);
      expect(result.pillars).not.toBe(original.pillars);
      expect(result.pillars.efficiency).toBeCloseTo(90 * 0.9, 5);
    });
  });
});
