import {
  clamp,
  normalizeMetric,
  computeStdDev,
  getCapsForPosition,
  POSITION_CAPS,
  DEFAULT_CAPS,
} from "../playerVectorService";

describe("playerVectorService", () => {
  describe("clamp", () => {
    it("clamps values within range", () => {
      expect(clamp(5, 0, 10)).toBe(5);
      expect(clamp(-5, 0, 10)).toBe(0);
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe("getCapsForPosition", () => {
    it("returns WR caps for WR position", () => {
      expect(getCapsForPosition("WR")).toBe(POSITION_CAPS.WR);
    });

    it("returns RB caps for RB position", () => {
      expect(getCapsForPosition("RB")).toBe(POSITION_CAPS.RB);
    });

    it("returns TE caps for TE position", () => {
      expect(getCapsForPosition("TE")).toBe(POSITION_CAPS.TE);
    });

    it("returns QB caps for QB position", () => {
      expect(getCapsForPosition("QB")).toBe(POSITION_CAPS.QB);
    });

    it("falls back to DEFAULT_CAPS (WR) for missing position", () => {
      expect(getCapsForPosition(null)).toBe(DEFAULT_CAPS);
      expect(getCapsForPosition(null)).toBe(POSITION_CAPS.WR);
    });

    it("falls back to DEFAULT_CAPS for unrecognized position", () => {
      expect(getCapsForPosition("K")).toBe(DEFAULT_CAPS);
      expect(getCapsForPosition("DEF")).toBe(DEFAULT_CAPS);
    });

    it("handles case insensitivity", () => {
      expect(getCapsForPosition("wr")).toBe(POSITION_CAPS.WR);
      expect(getCapsForPosition("Rb")).toBe(POSITION_CAPS.RB);
    });
  });

  describe("normalizeMetric - availability", () => {
    it("week 3 player with 3 games should have availability near 100", () => {
      const availabilityValue = 3 / clamp(3, 1, 18);
      const normalized = normalizeMetric("availability", availabilityValue);
      expect(normalized).toBe(100);
    });

    it("week 3 player with 2 games should have availability ~67", () => {
      const availabilityValue = 2 / clamp(3, 1, 18);
      const normalized = normalizeMetric("availability", availabilityValue);
      expect(normalized).toBeCloseTo(66.67, 1);
    });

    it("week 18 player with 17 games should have availability ~94.4", () => {
      const availabilityValue = 17 / clamp(18, 1, 18);
      const normalized = normalizeMetric("availability", availabilityValue);
      expect(normalized).toBeCloseTo(94.44, 1);
    });
  });

  describe("normalizeMetric - fp_consistency", () => {
    it("returns 100 for perfect consistency (std dev = 0)", () => {
      const normalized = normalizeMetric("fp_consistency", 0);
      expect(normalized).toBe(100);
    });

    it("returns floor of 20 for extremely high variance", () => {
      const normalized = normalizeMetric("fp_consistency", 15);
      expect(normalized).toBe(20);
    });

    it("handles moderate variance correctly", () => {
      const normalized = normalizeMetric("fp_consistency", 5);
      expect(normalized).toBe(50);
    });

    it("clamps std dev to 8 before scaling", () => {
      const normalized = normalizeMetric("fp_consistency", 8);
      expect(normalized).toBe(20);
    });
  });

  describe("normalizeMetric - position-aware caps", () => {
    it("WR touches_per_game scales to cap of 12", () => {
      const caps = POSITION_CAPS.WR;
      const normalized = normalizeMetric("touches_per_game", 12, caps);
      expect(normalized).toBe(100);
    });

    it("RB touches_per_game scales to cap of 25", () => {
      const caps = POSITION_CAPS.RB;
      const normalized = normalizeMetric("touches_per_game", 25, caps);
      expect(normalized).toBe(100);
    });

    it("same touches value normalizes differently per position", () => {
      const wrNorm = normalizeMetric("touches_per_game", 10, POSITION_CAPS.WR);
      const rbNorm = normalizeMetric("touches_per_game", 10, POSITION_CAPS.RB);
      expect(wrNorm).toBeCloseTo(83.33, 1);
      expect(rbNorm).toBe(40);
    });
  });

  describe("normalizeMetric - all outputs within 0-100", () => {
    const metrics = [
      "snap_share_pct",
      "target_share_pct",
      "routes_per_game",
      "touches_per_game",
      "fantasy_points_per_touch",
      "yards_per_touch",
      "catch_rate",
      "td_rate",
      "tds_per_game",
      "high_leverage_usage",
      "availability",
      "fp_consistency",
      "sample_size",
      "recent_usage_trend",
      "role_security",
    ];

    const testValues = [-10, 0, 0.5, 1, 5, 10, 50, 100, 1000];

    for (const metric of metrics) {
      for (const value of testValues) {
        it(`${metric} with value ${value} stays within 0-100`, () => {
          const normalized = normalizeMetric(metric, value);
          expect(normalized).toBeGreaterThanOrEqual(0);
          expect(normalized).toBeLessThanOrEqual(100);
        });
      }
    }
  });

  describe("normalizeMetric - handles null/NaN gracefully", () => {
    it("returns null for null input", () => {
      expect(normalizeMetric("availability", null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(normalizeMetric("availability", undefined)).toBeNull();
    });

    it("returns null for NaN input", () => {
      expect(normalizeMetric("availability", NaN)).toBeNull();
    });
  });

  describe("computeStdDev", () => {
    it("returns 0 for empty array", () => {
      expect(computeStdDev([])).toBe(0);
    });

    it("returns 0 for single value", () => {
      expect(computeStdDev([10])).toBe(0);
    });

    it("computes correct std dev for known values", () => {
      expect(computeStdDev([10, 10, 10, 10])).toBe(0);
      expect(computeStdDev([0, 10])).toBe(5);
    });
  });
});
