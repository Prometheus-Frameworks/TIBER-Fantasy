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
  teamId: string | null;
  teamAbbr: string;
  season: number | null;
  weeksCovered: number[];
  earlyWindow: Record<string, unknown> | null;
  lateWindow: Record<string, unknown> | null;
  deltas: Record<string, unknown> | null;
  offenseDirection: string | null;
  pressureDirection: string | null;
  passEnvironmentDirection: string | null;
  paceDirection: string | null;
  volatilityDirection: string | null;
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
    entry.paceDirection ? `pace ${humanizeDirection(entry.paceDirection)}` : null,
    entry.volatilityDirection ? `volatility ${humanizeDirection(entry.volatilityDirection)}` : null,
  ].filter(Boolean);

  return `${entry.team}: ${details.length ? details.join(', ') : 'movement context available'}`;
}

export function getTeamEnvironmentMovementProvenanceWarning(provenanceStatus: string | null | undefined): string | null {
  if (provenanceStatus === 'fixture_scaffold') {
    return 'fixture/synthetic Teamstate movement artifact; do not treat as governed production truth';
  }
  return null;
}

export function hasUsableTeamEnvironmentMovementContext(response: TeamEnvironmentMovementResponse | null | undefined): boolean {
  return Boolean(
    response?.ok
    && response.artifactAvailable
    && ((response.teams?.length ?? 0) > 0 || response.selectedTeam),
  );
}

export function getTeamEnvironmentMovementReadinessDetails(response: TeamEnvironmentMovementResponse | null | undefined): string[] {
  if (!response) return [];

  const details = new Set<string>();
  const provenanceWarning = getTeamEnvironmentMovementProvenanceWarning(response.provenanceStatus);

  if (response.provenanceStatus) details.add(`Provenance status: ${response.provenanceStatus}.`);
  if (provenanceWarning) details.add(provenanceWarning);
  for (const warning of response.warnings ?? []) details.add(warning);
  for (const error of response.errors ?? []) details.add(error.message);

  if (response.artifactAvailable && !hasUsableTeamEnvironmentMovementContext(response)) {
    details.add('Teamstate artifact is present, but no usable movement rows are available.');
  }

  return Array.from(details);
}
