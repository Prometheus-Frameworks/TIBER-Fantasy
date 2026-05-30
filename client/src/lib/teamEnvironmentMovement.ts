export interface TeamEnvironmentMovementCoverage {
  teams: string[];
  seasons: number[];
  weeks: number[];
  latestWeek: number | null;
  isFullLeague: boolean | null;
  [key: string]: unknown;
}

export interface TeamEnvironmentMovementEntry {
  team: string;
  season: number | null;
  earlyWindow: Record<string, unknown> | null;
  lateWindow: Record<string, unknown> | null;
  deltas: Record<string, unknown> | null;
  offenseDirection: string | null;
  pressureDirection: string | null;
  passEnvironmentDirection: string | null;
  verdict: string | null;
  warnings: string[];
  raw: Record<string, unknown>;
}

export interface TeamEnvironmentMovementResponse {
  ok: boolean;
  artifact: 'team_environment_movement_v0';
  artifactAvailable: boolean;
  provenanceStatus: string | null;
  inputSources: unknown[];
  coverage: TeamEnvironmentMovementCoverage | null;
  teams: TeamEnvironmentMovementEntry[];
  selectedTeam: TeamEnvironmentMovementEntry | null;
  warnings: string[];
  errors: Array<{ code: string; message: string }>;
  source?: {
    provider: 'tiber-teamstate';
    mode: 'artifact';
    artifactPath: string;
    readOnly: true;
  };
  meta?: {
    module: 'team-environment-movement-lab';
    adapter: string;
    readOnly: true;
    fetchedAt: string;
  };
}

function humanizeDirection(value: string | null | undefined): string | null {
  return value ? value.replace(/_/g, ' ') : null;
}

export function buildTeamEnvironmentMovementSummary(entry: TeamEnvironmentMovementEntry): string {
  const details = [
    entry.offenseDirection ? `offensive environment ${humanizeDirection(entry.offenseDirection)}` : null,
    entry.pressureDirection ? `pressure ${humanizeDirection(entry.pressureDirection)}` : null,
    entry.passEnvironmentDirection ? `pass environment ${humanizeDirection(entry.passEnvironmentDirection)}` : null,
  ].filter(Boolean);

  return `${entry.team}: ${details.length ? details.join(', ') : 'movement context available'}`;
}

export function getTeamEnvironmentMovementProvenanceWarning(provenanceStatus: string | null | undefined): string | null {
  if (provenanceStatus === 'fixture_scaffold') {
    return 'fixture/synthetic Teamstate movement artifact; do not treat as governed production truth';
  }
  return null;
}
