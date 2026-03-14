import { batchAssignRoles, PlayerRole, PlayerRoleAssignment } from "./batchAssignRoles";
import { LabeledRoleFixture } from "./calibrationFixtures";

export interface CalibrationMiss {
  fixtureId: string;
  playerId: string;
  playerName: string;
  expectedRole: PlayerRole;
  actualRole: PlayerRole;
  confidence: number;
}

export interface CalibrationReport {
  totalEvaluated: number;
  matches: number;
  misses: number;
  missesByRole: Partial<Record<PlayerRole, number>>;
  confusionPairs: Record<string, number>;
  unknownRate: number;
  missDetails: CalibrationMiss[];
}

export interface CalibrationEvaluation {
  assignments: PlayerRoleAssignment[];
  report: CalibrationReport;
}

function toConfusionKey(expectedRole: PlayerRole, actualRole: PlayerRole): string {
  return `${expectedRole}=>${actualRole}`;
}

export function buildCalibrationReport(
  fixtures: LabeledRoleFixture[],
  assignments: PlayerRoleAssignment[],
): CalibrationReport {
  if (fixtures.length !== assignments.length) {
    throw new Error("fixtures and assignments must have equal length for calibration reporting");
  }

  const missesByRole: Partial<Record<PlayerRole, number>> = {};
  const confusionPairs: Record<string, number> = {};
  const missDetails: CalibrationMiss[] = [];

  let matches = 0;
  let unknownCount = 0;

  fixtures.forEach((fixture, index) => {
    const assignment = assignments[index];

    if (assignment.assignedRole === "UNKNOWN") {
      unknownCount += 1;
    }

    if (assignment.assignedRole === fixture.expectedRole) {
      matches += 1;
      return;
    }

    missesByRole[fixture.expectedRole] = (missesByRole[fixture.expectedRole] ?? 0) + 1;

    const confusionKey = toConfusionKey(fixture.expectedRole, assignment.assignedRole);
    confusionPairs[confusionKey] = (confusionPairs[confusionKey] ?? 0) + 1;

    missDetails.push({
      fixtureId: fixture.fixtureId,
      playerId: fixture.profile.playerId,
      playerName: fixture.profile.playerName,
      expectedRole: fixture.expectedRole,
      actualRole: assignment.assignedRole,
      confidence: assignment.confidence,
    });
  });

  const totalEvaluated = fixtures.length;

  return {
    totalEvaluated,
    matches,
    misses: totalEvaluated - matches,
    missesByRole,
    confusionPairs,
    unknownRate: totalEvaluated === 0 ? 0 : Number((unknownCount / totalEvaluated).toFixed(4)),
    missDetails,
  };
}

export function evaluateCalibration(fixtures: LabeledRoleFixture[]): CalibrationEvaluation {
  const assignments = batchAssignRoles(fixtures.map((fixture) => fixture.profile));

  return {
    assignments,
    report: buildCalibrationReport(fixtures, assignments),
  };
}
