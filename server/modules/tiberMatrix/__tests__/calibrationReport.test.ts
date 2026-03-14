import { CALIBRATION_FIXTURES } from "../calibrationFixtures";
import { buildCalibrationReport, evaluateCalibration } from "../calibrationReport";

describe("calibrationReport", () => {
  it("evaluates fixtures and reports aggregate calibration metrics", () => {
    const { assignments, report } = evaluateCalibration(CALIBRATION_FIXTURES);

    expect(assignments).toHaveLength(CALIBRATION_FIXTURES.length);
    expect(report.totalEvaluated).toBe(CALIBRATION_FIXTURES.length);
    expect(report.matches).toBeGreaterThanOrEqual(7);
    expect(report.misses).toBe(report.totalEvaluated - report.matches);
    expect(report.unknownRate).toBeGreaterThanOrEqual(0);
    expect(report.unknownRate).toBeLessThanOrEqual(1);
  });

  it("tracks misses by expected role and confusion pair", () => {
    const report = buildCalibrationReport(
      [
        {
          fixtureId: "fixture_1",
          expectedRole: "WR_ALPHA",
          profile: {
            playerId: "wr_alpha_1",
            playerName: "WR Alpha",
            position: "WR",
            metrics: {},
          },
        },
        {
          fixtureId: "fixture_2",
          expectedRole: "WR_ALPHA",
          profile: {
            playerId: "wr_alpha_2",
            playerName: "WR Alpha 2",
            position: "WR",
            metrics: {},
          },
        },
      ],
      [
        {
          playerId: "wr_alpha_1",
          playerName: "WR Alpha",
          position: "WR",
          assignedRole: "WR_DEEP_THREAT",
          confidence: 0.72,
          isUnknownRole: false,
          reasons: [],
          candidateScores: [],
        },
        {
          playerId: "wr_alpha_2",
          playerName: "WR Alpha 2",
          position: "WR",
          assignedRole: "UNKNOWN",
          confidence: 0.41,
          isUnknownRole: true,
          reasons: [],
          candidateScores: [],
        },
      ],
    );

    expect(report.matches).toBe(0);
    expect(report.misses).toBe(2);
    expect(report.missesByRole.WR_ALPHA).toBe(2);
    expect(report.confusionPairs["WR_ALPHA=>WR_DEEP_THREAT"]).toBe(1);
    expect(report.confusionPairs["WR_ALPHA=>UNKNOWN"]).toBe(1);
    expect(report.unknownRate).toBe(0.5);
    expect(report.missDetails).toHaveLength(2);
  });
});
