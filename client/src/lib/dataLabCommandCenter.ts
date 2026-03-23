export type CommandCenterWorkspaceState = 'ready' | 'partial' | 'empty' | 'error';
export type CommandCenterSectionState = 'ready' | 'empty' | 'unavailable';
export type CommandCenterModuleStatusState = 'ready' | 'empty' | 'unavailable';

export interface DataLabCommandCenterResponse {
  success: true;
  data: {
    season: number | null;
    availableSeasons: number[];
    state: CommandCenterWorkspaceState;
    framing: {
      title: string;
      description: string;
      posture: string;
    };
    moduleStatuses: Array<{
      moduleId: 'breakout-signals' | 'role-opportunity' | 'age-curves' | 'point-scenarios';
      title: string;
      href: string;
      state: CommandCenterModuleStatusState;
      detail: string;
    }>;
    priorities: Array<{
      id: string;
      title: string;
      reason: string;
      moduleTitle: string;
      moduleHref: string;
      primaryAction: { label: string; href: string };
      secondaryAction?: { label: string; href: string } | null;
    }>;
    warnings: string[];
    sections: {
      breakoutCandidates: {
        state: CommandCenterSectionState;
        title: string;
        description: string;
        moduleTitle: string;
        linkHref: string;
        message: string;
        items: Array<{
          playerId: string | null;
          playerName: string;
          team: string | null;
          candidateRank: number | null;
          finalSignalScore: number | null;
          breakoutLabel: string | null;
          breakoutContext: string | null;
          links: { moduleHref: string; playerResearchHref: string };
        }>;
      };
      roleOpportunity: {
        state: CommandCenterSectionState;
        title: string;
        description: string;
        moduleTitle: string;
        linkHref: string;
        message: string;
        items: Array<{
          playerId: string;
          playerName: string;
          team: string;
          position: string;
          primaryRole: string;
          targetShare: number | null;
          routeParticipation: number | null;
          snapShare: number | null;
          usageRate: number | null;
          confidenceTier: string | null;
          insights: string[];
          links: { moduleHref: string; playerResearchHref: string };
        }>;
      };
      ageCurves: {
        state: CommandCenterSectionState;
        title: string;
        description: string;
        moduleTitle: string;
        linkHref: string;
        message: string;
        items: Array<{
          playerId: string | null;
          playerName: string;
          team: string | null;
          position: string | null;
          trajectoryLabel: string | null;
          peerBucket: string | null;
          expectedPpg: number | null;
          actualPpg: number | null;
          ppgDelta: number | null;
          signalDirection: 'overperformer' | 'underperformer';
          links: { moduleHref: string; playerResearchHref: string };
        }>;
      };
      pointScenarios: {
        state: CommandCenterSectionState;
        title: string;
        description: string;
        moduleTitle: string;
        linkHref: string;
        message: string;
        items: Array<{
          playerId: string | null;
          playerName: string;
          team: string | null;
          position: string | null;
          scenarioName: string;
          delta: number | null;
          baselineProjection: number | null;
          adjustedProjection: number | null;
          confidenceLabel: string | null;
          eventType: string | null;
          links: { moduleHref: string; playerResearchHref: string };
        }>;
      };
      teamEnvironments: {
        state: CommandCenterSectionState;
        title: string;
        description: string;
        moduleTitle: string;
        linkHref: string;
        message: string;
        items: Array<{
          team: string;
          teamName: string;
          breakoutCandidateCount: number;
          rolePlayerCount: number;
          ageSignalCount: number;
          scenarioPlayerCount: number;
          avgTargetShare: number | null;
          avgRouteParticipation: number | null;
          maxScenarioDelta: number | null;
          topPlayers: string[];
          links: { moduleHref: string; teamResearchHref: string };
        }>;
      };
    };
  };
  meta: {
    module: 'data-lab-command-center';
    adapter: string;
    readOnly: true;
    fetchedAt: string;
  };
}

export interface DataLabCommandCenterApiError {
  success: false;
  error: string;
}

export interface DataLabCommandCenterQueryState {
  season: string;
}

export function readDataLabCommandCenterQuery(search: string, fallbackSeason: string): DataLabCommandCenterQueryState {
  const params = new URLSearchParams(search);
  return {
    season: params.get('season')?.trim() || fallbackSeason,
  };
}

export function buildDataLabCommandCenterHref(query: Partial<DataLabCommandCenterQueryState>): string {
  const params = new URLSearchParams();
  if (query.season) {
    params.set('season', query.season);
  }
  const serialized = params.toString();
  return serialized ? `/tiber-data-lab/command-center?${serialized}` : '/tiber-data-lab/command-center';
}

export function getCommandCenterStateLabel(state: CommandCenterWorkspaceState): string {
  switch (state) {
    case 'ready':
      return 'All promoted sections available';
    case 'partial':
      return 'Partial promoted coverage';
    case 'empty':
      return 'No promoted summaries available';
    case 'error':
      return 'Promoted sources unavailable';
    default:
      return 'Read-only orchestration';
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
