import {
  assignOffensiveRole,
  batchAssignRoles,
  NormalizedOffensiveUsageProfile,
} from "../batchAssignRoles";

describe("batchAssignRoles", () => {
  it("assigns expected deterministic roles across offensive positions", () => {
    const profiles: NormalizedOffensiveUsageProfile[] = [
      {
        playerId: "qb_dual",
        playerName: "Dual QB",
        position: "QB",
        metrics: {
          passAttemptShare: 0.75,
          designedRushShare: 0.88,
          redZoneShare: 0.73,
        },
      },
      {
        playerId: "rb_workhorse",
        playerName: "Workhorse RB",
        position: "RB",
        metrics: {
          snapShare: 0.83,
          carryShare: 0.86,
          routeParticipation: 0.57,
        },
      },
      {
        playerId: "wr_slot",
        playerName: "Slot WR",
        position: "WR",
        metrics: {
          routeParticipation: 0.8,
          targetShare: 0.77,
          adot: 0.29,
        },
      },
      {
        playerId: "te_red_zone",
        playerName: "Red Zone TE",
        position: "TE",
        metrics: {
          redZoneShare: 0.9,
          targetShare: 0.58,
          routeParticipation: 0.47,
        },
      },
    ];

    const assignments = batchAssignRoles(profiles);

    expect(assignments).toHaveLength(4);
    expect(assignments.map((assignment) => assignment.assignedRole)).toEqual([
      "QB_DUAL_THREAT",
      "RB_WORKHORSE",
      "WR_SLOT_VOLUME",
      "TE_RED_ZONE",
    ]);

    assignments.forEach((assignment) => {
      expect(assignment.isUnknownRole).toBe(false);
      expect(assignment.reasons.length).toBeGreaterThan(0);
      expect(assignment.candidateScores.length).toBeGreaterThan(1);
      expect(assignment.candidateScores[0].score).toBeGreaterThanOrEqual(assignment.candidateScores[1].score);
    });
  });

  it("keeps unknown-role handling for low coverage profile", () => {
    const assignment = assignOffensiveRole({
      playerId: "wr_unknown",
      playerName: "Unknown WR",
      position: "WR",
      metrics: {
        targetShare: 0.52,
      },
    });

    expect(assignment.assignedRole).toBe("UNKNOWN");
    expect(assignment.isUnknownRole).toBe(true);
    expect(assignment.reasons.some((reason) => reason.includes("UNKNOWN"))).toBe(true);
  });
});
