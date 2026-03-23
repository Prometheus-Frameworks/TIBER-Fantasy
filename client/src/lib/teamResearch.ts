export type TeamResearchSectionState = 'idle' | 'ready' | 'not_available' | 'error';
export type TeamResearchWorkspaceState = 'idle' | 'ready' | 'partial' | 'empty' | 'error';

export interface TeamResearchSearchEntry {
  team: string;
  teamName: string;
  conference: string | null;
  division: string | null;
  playerCount: number;
  modules: {
    breakoutSignals: boolean;
    roleOpportunity: boolean;
    ageCurves: boolean;
    pointScenarios: boolean;
  };
}

export interface TeamResearchPlayerSummary {
  playerId: string | null;
  playerName: string;
  team: string;
  position: string | null;
  playerResearchHref: string;
  modules: {
    breakoutSignals: boolean;
    roleOpportunity: boolean;
    ageCurves: boolean;
    pointScenarios: boolean;
  };
  primaryRole: string | null;
  targetShare: number | null;
  routeParticipation: number | null;
  snapShare: number | null;
  usageRate: number | null;
  breakoutSignalScore: number | null;
  breakoutLabel: string | null;
  breakoutRank: number | null;
  trajectoryLabel: string | null;
  ageCurveScore: number | null;
  ppgDelta: number | null;
  scenarioDelta: number | null;
  scenarioCount: number;
}

interface TeamResearchSectionBase<TSummary> {
  state: TeamResearchSectionState;
  title: string;
  description: string;
  linkHref: string;
  summary: TSummary | null;
  message: string | null;
  readOnly: true;
  provenanceNote: string;
  error: { code: string; message: string } | null;
}

export interface TeamResearchResponse {
  success: true;
  data: {
    season: number | null;
    availableSeasons: number[];
    state: TeamResearchWorkspaceState;
    requestedTeam: string | null;
    selectedTeam: {
      team: string;
      teamName: string;
      conference: string | null;
      division: string | null;
      matchStrategy: 'team_code' | 'team_name' | 'normalized_name' | null;
    } | null;
    searchIndex: TeamResearchSearchEntry[];
    framing: {
      title: string;
      description: string;
      provenanceNote: string;
    };
    warnings: string[];
    header: {
      team: string | null;
      teamName: string | null;
      conference: string | null;
      division: string | null;
    };
    keyPlayers: TeamResearchPlayerSummary[];
    sections: {
      offensiveContext: TeamResearchSectionBase<{
        team: string;
        teamName: string;
        promotedPlayerCount: number;
        positionsCovered: string[];
        breakoutCandidateCount: number;
        rolePlayerCount: number;
        ageCurvePlayerCount: number;
        scenarioPlayerCount: number;
        avgTargetShare: number | null;
        avgRouteParticipation: number | null;
        avgSnapShare: number | null;
        avgUsageRate: number | null;
        topPlayers: string[];
        notes: string[];
      }>;
      roleOpportunity: TeamResearchSectionBase<{
        playerCount: number;
        avgTargetShare: number | null;
        avgRouteParticipation: number | null;
        avgSnapShare: number | null;
        avgUsageRate: number | null;
        keyPlayers: TeamResearchPlayerSummary[];
        source: {
          provider: string | null;
          location: string | null;
          mode: 'api' | 'artifact' | null;
        };
      }>;
      breakoutSignals: TeamResearchSectionBase<{
        candidateCount: number;
        topSignalScore: number | null;
        bestRecipeName: string | null;
        players: TeamResearchPlayerSummary[];
        source: {
          provider: 'signal-validation-model';
          exportDirectory: string;
        } | null;
      }>;
      pointScenarios: TeamResearchSectionBase<{
        playerCount: number;
        totalScenarioCount: number;
        maxDelta: number | null;
        players: TeamResearchPlayerSummary[];
        source: {
          provider: string | null;
          location: string | null;
          mode: 'api' | 'artifact' | null;
        };
      }>;
      ageCurves: TeamResearchSectionBase<{
        playerCount: number;
        players: TeamResearchPlayerSummary[];
        source: {
          provider: string | null;
          location: string | null;
          mode: 'api' | 'artifact' | null;
        };
      }>;
    };
  };
  meta: {
    module: 'team-research-workspace';
    adapter: string;
    readOnly: true;
    fetchedAt: string;
  };
}

export interface TeamResearchApiError {
  success: false;
  error: string;
}

export interface TeamResearchQueryState {
  season: string;
  team: string | null;
}

function normalizeToken(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function buildTeamResearchHref(query: Partial<TeamResearchQueryState>): string {
  const params = new URLSearchParams();

  if (query.season) {
    params.set('season', query.season);
  }
  if (query.team) {
    params.set('team', query.team);
  }

  const serialized = params.toString();
  return serialized ? `/tiber-data-lab/team-research?${serialized}` : '/tiber-data-lab/team-research';
}

export function readTeamResearchQuery(search: string, fallbackSeason: string): TeamResearchQueryState {
  const params = new URLSearchParams(search);

  return {
    season: params.get('season')?.trim() || fallbackSeason,
    team: params.get('team')?.trim() || null,
  };
}

export function filterTeamResearchSearchIndex(entries: TeamResearchSearchEntry[], query: string): TeamResearchSearchEntry[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return entries.slice(0, 12);
  }

  return entries.filter((entry) => [entry.team, entry.teamName, entry.conference ?? '', entry.division ?? ''].join(' ').toLowerCase().includes(normalizedQuery));
}

export function findTeamSearchEntry(entries: TeamResearchSearchEntry[], teamQuery: string | null | undefined): TeamResearchSearchEntry | null {
  if (!teamQuery) {
    return null;
  }

  const trimmed = teamQuery.trim();
  const byCode = entries.find((entry) => entry.team.toLowerCase() === trimmed.toLowerCase());
  if (byCode) {
    return byCode;
  }

  const byName = entries.find((entry) => entry.teamName.toLowerCase() === trimmed.toLowerCase());
  if (byName) {
    return byName;
  }

  const normalized = normalizeToken(trimmed);
  return entries.find((entry) => normalizeToken(entry.teamName) === normalized) ?? null;
}

export function getTeamResearchStateLabel(state: TeamResearchWorkspaceState): string {
  switch (state) {
    case 'ready':
      return 'All promoted sections available';
    case 'partial':
      return 'Partial promoted coverage';
    case 'empty':
      return 'No promoted team match found';
    case 'error':
      return 'Promoted sources unavailable';
    default:
      return 'Select a team to begin';
  }
}

export function formatPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }

  return `${Math.round(value * 100)}%`;
}

export function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }

  return value.toFixed(digits);
}

export function formatSignedNumber(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) {
    return '—';
  }

  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}`;
}
