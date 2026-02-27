/**
 * Context modifier unit tests for FORGE.
 *
 * Covers pure math/label helpers in:
 * - contextModifiers.ts
 * - forgeAlphaModifiers.ts
 */

jest.mock('../../../infra/db', () => ({ db: {} }));

import {
  applyForgeEnvModifier,
  getEnvLabel,
  applyForgeMatchupModifier,
  getMatchupLabel,
} from '../contextModifiers';

import {
  applyForgeModifiers,
  getEnvScoreLabel,
  getMatchupScoreLabel,
  calculateModifierEffect,
} from '../forgeAlphaModifiers';

import type { TeamEnvironment, MatchupContext } from '../types';

describe('applyForgeEnvModifier', () => {
  it('returns alpha unchanged when envScore is null', () => {
    const result = applyForgeEnvModifier({ rawAlpha: 60, envScore: null });
    expect(result.envAdjustedAlpha).toBe(60);
    expect(result.envMultiplier).toBe(1);
  });

  it('returns alpha unchanged when envScore is 50 (neutral)', () => {
    const result = applyForgeEnvModifier({ rawAlpha: 60, envScore: 50 });
    expect(result.envAdjustedAlpha).toBe(60);
    expect(result.envMultiplier).toBe(1);
  });

  it('increases alpha when envScore > 50 (favorable environment)', () => {
    const result = applyForgeEnvModifier({ rawAlpha: 60, envScore: 80 });
    expect(result.envAdjustedAlpha).toBeGreaterThan(60);
  });

  it('decreases alpha when envScore < 50 (unfavorable environment)', () => {
    const result = applyForgeEnvModifier({ rawAlpha: 60, envScore: 20 });
    expect(result.envAdjustedAlpha).toBeLessThan(60);
  });

  it('clamps result to [0, 100] bounds (via internal 25-90 FORGE band)', () => {
    const high = applyForgeEnvModifier({ rawAlpha: 300, envScore: 100 });
    const low = applyForgeEnvModifier({ rawAlpha: -100, envScore: 0 });

    expect(high.envAdjustedAlpha).toBeGreaterThanOrEqual(0);
    expect(high.envAdjustedAlpha).toBeLessThanOrEqual(100);
    expect(low.envAdjustedAlpha).toBeGreaterThanOrEqual(0);
    expect(low.envAdjustedAlpha).toBeLessThanOrEqual(100);

    // Explicitly verify hard FORGE clamp in implementation.
    expect(high.envAdjustedAlpha).toBe(90);
    expect(low.envAdjustedAlpha).toBe(25);
  });
});

describe('getEnvLabel', () => {
  it('returns a non-empty string for any numeric input', () => {
    const label = getEnvLabel(67);
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });

  it('returns a string for null input', () => {
    const label = getEnvLabel(null);
    expect(typeof label).toBe('string');
  });

  it('returns different labels for scores of 20, 50, and 80', () => {
    const poor = getEnvLabel(20);
    const avg = getEnvLabel(50);
    const elite = getEnvLabel(80);

    expect(new Set([poor, avg, elite]).size).toBe(3);
  });
});

describe('applyForgeMatchupModifier', () => {
  it('returns alpha unchanged when matchupScore is null', () => {
    const result = applyForgeMatchupModifier({ alphaAfterEnv: 60, matchupScore: null });
    expect(result.finalAlpha).toBe(60);
    expect(result.matchupMultiplier).toBe(1);
  });

  it('returns alpha unchanged when matchupScore is 50 (neutral)', () => {
    const result = applyForgeMatchupModifier({ alphaAfterEnv: 60, matchupScore: 50 });
    expect(result.finalAlpha).toBe(60);
    expect(result.matchupMultiplier).toBe(1);
  });

  it('increases alpha when matchupScore > 50 (favorable matchup)', () => {
    const result = applyForgeMatchupModifier({ alphaAfterEnv: 60, matchupScore: 80 });
    expect(result.finalAlpha).toBeGreaterThan(60);
  });

  it('decreases alpha when matchupScore < 50 (unfavorable matchup)', () => {
    const result = applyForgeMatchupModifier({ alphaAfterEnv: 60, matchupScore: 20 });
    expect(result.finalAlpha).toBeLessThan(60);
  });

  it('clamps result to [0, 100] bounds (via internal 25-90 FORGE band)', () => {
    const high = applyForgeMatchupModifier({ alphaAfterEnv: 300, matchupScore: 100 });
    const low = applyForgeMatchupModifier({ alphaAfterEnv: -100, matchupScore: 0 });

    expect(high.finalAlpha).toBeGreaterThanOrEqual(0);
    expect(high.finalAlpha).toBeLessThanOrEqual(100);
    expect(low.finalAlpha).toBeGreaterThanOrEqual(0);
    expect(low.finalAlpha).toBeLessThanOrEqual(100);

    expect(high.finalAlpha).toBe(90);
    expect(low.finalAlpha).toBe(25);
  });
});

describe('getMatchupLabel', () => {
  it('returns a non-empty string for any numeric input', () => {
    const label = getMatchupLabel(55);
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });

  it('returns a string for null input', () => {
    const label = getMatchupLabel(null);
    expect(typeof label).toBe('string');
  });
});

describe('calculateModifierEffect', () => {
  const baseEnv: TeamEnvironment = {
    season: 2025,
    week: 1,
    team: 'KC',
    envScore100: 50,
  };

  const baseMatchup: MatchupContext = {
    season: 2025,
    week: 1,
    offenseTeam: 'KC',
    defenseTeam: 'DEN',
    position: 'WR',
    matchupScore100: 50,
  };

  it('returns neutral multipliers when env/matchup scores are 50', () => {
    const result = calculateModifierEffect(baseEnv, baseMatchup);
    expect(result.envMultiplier).toBe(1);
    expect(result.matchupMultiplier).toBe(1);
    expect(result.combinedMultiplier).toBe(1);
  });

  it('returns multipliers above 1 when scores are above 50', () => {
    const result = calculateModifierEffect(
      { ...baseEnv, envScore100: 80 },
      { ...baseMatchup, matchupScore100: 80 }
    );

    expect(result.envMultiplier).toBeGreaterThan(1);
    expect(result.matchupMultiplier).toBeGreaterThan(1);
    expect(result.combinedMultiplier).toBeGreaterThan(1);
  });

  it('returns multipliers below 1 when scores are below 50', () => {
    const result = calculateModifierEffect(
      { ...baseEnv, envScore100: 20 },
      { ...baseMatchup, matchupScore100: 20 }
    );

    expect(result.envMultiplier).toBeLessThan(1);
    expect(result.matchupMultiplier).toBeLessThan(1);
    expect(result.combinedMultiplier).toBeLessThan(1);
  });

  it('scales proportionally with weight', () => {
    const lowWeight = calculateModifierEffect(
      { ...baseEnv, envScore100: 80 },
      null,
      { w_env: 0.1, w_mu: 0.25 }
    );

    const highWeight = calculateModifierEffect(
      { ...baseEnv, envScore100: 80 },
      null,
      { w_env: 0.5, w_mu: 0.25 }
    );

    expect(highWeight.envMultiplier - 1).toBeGreaterThan(lowWeight.envMultiplier - 1);
  });
});

describe('applyForgeModifiers', () => {
  const env: TeamEnvironment = {
    season: 2025,
    week: 1,
    team: 'KC',
    envScore100: 80,
  };

  const matchup: MatchupContext = {
    season: 2025,
    week: 1,
    offenseTeam: 'KC',
    defenseTeam: 'DEN',
    position: 'WR',
    matchupScore100: 75,
  };

  it('returns rawAlpha unchanged when both env and matchup are null', () => {
    expect(applyForgeModifiers(62, null, null)).toBe(62);
  });

  it('applies both env and matchup adjustments when both are provided', () => {
    const raw = 60;
    const adjusted = applyForgeModifiers(raw, env, matchup);
    expect(adjusted).not.toBe(raw);
    expect(adjusted).toBeGreaterThan(raw);
  });

  it('result is always a finite number between 0 and 100 for bounded alpha inputs', () => {
    const adjusted = applyForgeModifiers(70, env, matchup);
    expect(typeof adjusted).toBe('number');
    expect(Number.isFinite(adjusted)).toBe(true);
    expect(adjusted).toBeGreaterThanOrEqual(0);
    expect(adjusted).toBeLessThanOrEqual(100);
  });
});

describe('label functions (getEnvScoreLabel, getMatchupScoreLabel)', () => {
  it('return a non-empty string for scores 0, 25, 50, 75, 100', () => {
    const scores = [0, 25, 50, 75, 100];

    for (const score of scores) {
      const envLabel = getEnvScoreLabel(score);
      const matchupLabel = getMatchupScoreLabel(score);

      expect(typeof envLabel).toBe('string');
      expect(envLabel.length).toBeGreaterThan(0);

      expect(typeof matchupLabel).toBe('string');
      expect(matchupLabel.length).toBeGreaterThan(0);
    }
  });
});
