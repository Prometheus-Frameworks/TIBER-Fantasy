import type { PlayerRoleAssignment, TeamSeasonRoleMap } from '@shared/types/playerRoleAssignment';

export function teamRoleMapBuilder(assignments: PlayerRoleAssignment[]): TeamSeasonRoleMap[] {
  const grouped = new Map<string, TeamSeasonRoleMap>();

  for (const assignment of assignments) {
    if (!assignment.team || assignment.season === undefined) continue;

    const key = `${assignment.team}::${assignment.season}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.assignments.push(assignment);
      continue;
    }

    grouped.set(key, {
      team: assignment.team,
      season: assignment.season,
      assignments: [assignment],
    });
  }

  return Array.from(grouped.values()).sort(
    (a, b) => a.season - b.season || a.team.localeCompare(b.team)
  );
}
