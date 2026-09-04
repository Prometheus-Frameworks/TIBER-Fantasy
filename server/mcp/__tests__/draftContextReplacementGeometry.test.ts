import { calculateReplacementGeometry } from '../draftContextReplacementGeometry';

describe('draft-context replacement geometry', () => {
  test('matches the Forecast v0 geometry for a 10-team 1/2/2/1 + 2 FLEX league', () => {
    const result = calculateReplacementGeometry(10, {
      QB: 1,
      RB: 2,
      WR: 2,
      TE: 1,
      FLEX: 2,
    });

    expect(result.flexSlots).toBe(20);
    expect(result.flexAllocation).toEqual({ RB: 0.35, WR: 0.5, TE: 0.15 });
    expect(result.starterDemand).toEqual({ QB: 10, RB: 27, WR: 30, TE: 13 });
    expect(result.replacementBuffer).toBe(0.1);
    expect(result.replacementRank).toEqual({ QB: 11, RB: 30, WR: 33, TE: 15 });
  });

  test('normalizes a caller-supplied flex allocation before calculating demand', () => {
    const result = calculateReplacementGeometry(
      10,
      { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1 },
      { RB: 0.25, WR: 0.25, TE: 0 },
    );

    expect(result.flexAllocation).toEqual({ RB: 0.5, WR: 0.5, TE: 0 });
    expect(result.starterDemand).toEqual({ QB: 10, RB: 25, WR: 25, TE: 10 });
    expect(result.replacementRank).toEqual({ QB: 11, RB: 28, WR: 28, TE: 11 });
  });

  test('fails safely to the documented default allocation when configured flex weights sum to zero', () => {
    const result = calculateReplacementGeometry(
      10,
      { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 2 },
      { RB: 0, WR: 0, TE: 0 },
    );

    expect(result.flexAllocation).toEqual({ RB: 0.35, WR: 0.5, TE: 0.15 });
    expect(result.replacementRank).toEqual({ QB: 11, RB: 30, WR: 33, TE: 15 });
  });
});
