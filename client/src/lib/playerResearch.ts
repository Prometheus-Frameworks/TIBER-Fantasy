export type PlayerResearchSectionState = 'idle' | 'ready' | 'not_available' | 'error';
export type PlayerResearchWorkspaceState = 'idle' | 'ready' | 'partial' | 'empty' | 'error';

export interface PlayerResearchSearchEntry {
  playerId: string | null;
  playerName: string;
  team: string | null;
  position: string | null;
  modules: {
    breakoutSignals: boolean;
    roleOpportunity: boolean;
    ageCurves: boolean;
    pointScenarios: boolean;
  };
}

export interface PlayerResearchSectionBase<TSummary> {
  state: PlayerResearchSectionState;
  title: string;
  description: string;
  linkHref: string;
  summary: TSummary | null;
  message: string | null;
  readOnly: true;
  provenanceNote: string;
  error: {
    code: string;
    message: string;
  } | null;
}

export interface PlayerResearchResponse {
  success: true;
  data: {
    season: number | null;
    availableSeasons: number[];
    state: PlayerResearchWorkspaceState;
    requestedPlayerId: string | null;
    requestedPlayerName: string | null;
    selectedPlayer: {
      playerId: string | null;
      playerName: string;
      team: string | null;
      position: string | null;
      matchStrategy: 'player_id' | 'exact_name' | 'normalized_name' | null;
    } | null;
    searchIndex: PlayerResearchSearchEntry[];
    framing: {
      title: string;
      description: string;
      provenanceNote: string;
    };
    warnings: string[];
    sections: {
      breakoutSignals: PlayerResearchSectionBase<{
        candidateRank: number | null;
        finalSignalScore: number | null;
        bestRecipeName: string | null;
        breakoutLabel: string | null;
        breakoutContext: string | null;
        componentSummary: Array<{ label: string; value: number | null }>;
        source: {
          provider: 'signal-validation-model';
          exportDirectory: string;
        };
      }>;
      roleOpportunity: PlayerResearchSectionBase<{
        primaryRole: string;
        routeParticipation: number | null;
        targetShare: number | null;
        airYardShare: number | null;
        snapShare: number | null;
        usageRate: number | null;
        confidenceScore: number | null;
        confidenceTier: string | null;
        insights: string[];
        source: {
          sourceName: string | null;
          sourceType: string | null;
          modelVersion: string | null;
          generatedAt: string | null;
        };
      }>;
      ageCurves: PlayerResearchSectionBase<{
        age: number | null;
        careerYear: number | null;
        expectedPpg: number | null;
        actualPpg: number | null;
        ppgDelta: number | null;
        trajectoryLabel: string | null;
        peerBucket: string | null;
        ageCurveScore: number | null;
        provenance: {
          provider: string | null;
          sourceName: string | null;
          sourceType: string | null;
          modelVersion: string | null;
          generatedAt: string | null;
          notes: string[];
        };
      }>;
      pointScenarios: PlayerResearchSectionBase<{
        baselineProjection: number | null;
        adjustedProjection: number | null;
        delta: number | null;
        confidenceBand: string | null;
        confidenceLabel: string | null;
        scenarioCount: number;
        topScenarioNames: string[];
        notes: string[];
        source: {
          provider: string | null;
          sourceName: string | null;
          sourceType: string | null;
          modelVersion: string | null;
          generatedAt: string | null;
          sourceMetadata: Record<string, unknown>;
        };
      }>;
    };
  };
  meta: {
    module: 'player-research-workspace';
    adapter: string;
    readOnly: true;
    fetchedAt: string;
  };
}

export interface PlayerResearchApiError {
  success: false;
  error: string;
}

export interface PlayerResearchQueryState {
  season: string | null;
  hasSeasonParam: boolean;
  playerId: string | null;
  playerName: string | null;
}

function normalizeToken(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

export function filterPlayerResearchSearchIndex(entries: PlayerResearchSearchEntry[], query: string): PlayerResearchSearchEntry[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return entries.slice(0, 12);
  }

  return entries.filter((entry) => {
    const haystack = [entry.playerName, entry.playerId ?? '', entry.team ?? '', entry.position ?? '']
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

export function buildPlayerResearchHref(query: Partial<PlayerResearchQueryState>): string {
  const params = new URLSearchParams();

  if (query.season) {
    params.set('season', query.season);
  }

  if (query.playerId) {
    params.set('playerId', query.playerId);
  }

  if (query.playerName) {
    params.set('playerName', query.playerName);
  }

  const serialized = params.toString();
  return serialized ? `/tiber-data-lab/player-research?${serialized}` : '/tiber-data-lab/player-research';
}

export function readPlayerResearchQuery(search: string): PlayerResearchQueryState {
  const params = new URLSearchParams(search);
  const season = params.get('season')?.trim() || null;

  return {
    season,
    hasSeasonParam: season !== null,
    playerId: params.get('playerId')?.trim() || null,
    playerName: params.get('playerName')?.trim() || null,
  };
}

export function findSearchEntryByQuery(
  entries: PlayerResearchSearchEntry[],
  query: { playerId?: string | null; playerName?: string | null },
): PlayerResearchSearchEntry | null {
  if (query.playerId) {
    const byId = entries.find((entry) => entry.playerId === query.playerId);
    if (byId) {
      return byId;
    }
  }

  if (query.playerName) {
    const exact = entries.find((entry) => entry.playerName.toLowerCase() === query.playerName!.toLowerCase());
    if (exact) {
      return exact;
    }

    const normalized = normalizeToken(query.playerName);
    return entries.find((entry) => normalizeToken(entry.playerName) === normalized) ?? null;
  }

  return null;
}

export function getPlayerResearchStateLabel(state: PlayerResearchWorkspaceState): string {
  switch (state) {
    case 'ready':
      return 'All promoted sections available';
    case 'partial':
      return 'Partial promoted coverage';
    case 'empty':
      return 'No promoted match found';
    case 'error':
      return 'Promoted sources unavailable';
    default:
      return 'Select a player to begin';
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
