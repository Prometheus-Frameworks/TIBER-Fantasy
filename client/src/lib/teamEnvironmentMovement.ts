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

/**
 * Producer-owned governance block forwarded from team_environment_movement_v1
 * (TIBER-Teamstate PR #41). Optional: older payloads / v0 / the invalid-request
 * branch omit it, in which case the promotion gate fails closed.
 */
export interface TeamEnvironmentMovementGovernance {
  governanceStatus?: string | null;
  governanceSource?: string | null;
  contractVersion?: string | null;
  generatedAt?: string | null;
  promotedAt?: string | null;
  promotionNotes?: string | null;
}

export interface TeamEnvironmentMovementResponse {
  ok: boolean;
  // Accepts the team-state-only v1 successor and the legacy v0 during the migration transition.
  artifact: 'team_environment_movement_v0' | 'team_environment_movement_v1';
  artifactAvailable: boolean;
  // ISO timestamp the movement artifact was generated, forwarded from the
  // already-read service value for honest freshness (G6). May be absent on older
  // payloads or the invalid-request branch; absence is treated as not-fresh.
  generatedAt?: string | null;
  // Producer-owned explicit governance block (v1); absent when not provided.
  governance?: TeamEnvironmentMovementGovernance | null;
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

export type TeamEnvironmentMovementSignalStatus =
  | 'available'
  | 'governed'
  | 'fixture-only'
  | 'missing'
  | 'unavailable';

/**
 * Read-only signal-inventory status for the Teamstate Movement artifact, derived
 * ONLY from the existing /api/data-lab/team-environment-movement payload — no new
 * reads, no scoring/threshold logic. Truthful mapping for the Observatory live
 * signal inventory (#264 PR C):
 *  - unavailable : no response, or the endpoint returned errors
 *  - missing     : reachable but the artifact is not available
 *  - fixture-only: present but provenance is a fixture/synthetic scaffold
 *  - governed    : present with a producer governance block (status + contract version)
 *  - available   : present, governance not explicitly declared
 *
 * Freshness ("stale") is intentionally NOT decided here; the inventory surfaces
 * the raw generatedAt timestamp instead of inventing a freshness verdict.
 */
export function getTeamEnvironmentMovementSignalStatus(
  response: TeamEnvironmentMovementResponse | null | undefined,
): { status: TeamEnvironmentMovementSignalStatus; label: string } {
  if (!response || (response.errors?.length ?? 0) > 0) {
    return { status: 'unavailable', label: 'Unavailable' };
  }
  if (!response.artifactAvailable) {
    return { status: 'missing', label: 'Missing' };
  }
  if (response.provenanceStatus === 'fixture_scaffold') {
    return { status: 'fixture-only', label: 'Fixture-only' };
  }
  if (response.governance?.governanceStatus && response.governance?.contractVersion) {
    return { status: 'governed', label: 'Governed' };
  }
  return { status: 'available', label: 'Available' };
}
