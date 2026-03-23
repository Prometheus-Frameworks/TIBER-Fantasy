import { TiberAgeCurveLabRow } from '../ageCurves/types';
import { TiberPointScenarioLabRow } from '../pointScenarios/types';
import { TiberRoleOpportunityLabRow } from '../roleOpportunity/types';
import { TiberWrBreakoutSignalRow } from '../signalValidation/types';

export type TeamResearchSectionState = 'idle' | 'ready' | 'not_available' | 'error';
export type TeamResearchWorkspaceState = 'idle' | 'ready' | 'partial' | 'empty' | 'error';
export type TeamResearchMatchStrategy = 'team_code' | 'team_name' | 'normalized_name' | null;

export interface TeamResearchQuery {
  season?: number;
  team?: string;
}

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

export interface TeamResearchResolvedTeam {
  team: string;
  teamName: string;
  conference: string | null;
  division: string | null;
  matchStrategy: TeamResearchMatchStrategy;
}

export interface TeamResearchSectionError {
  code: string;
  message: string;
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

export interface TeamOffensiveContextSummary {
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
}

export interface TeamRoleOpportunitySummary {
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
}

export interface TeamBreakoutSummary {
  candidateCount: number;
  topSignalScore: number | null;
  bestRecipeName: string | null;
  players: TeamResearchPlayerSummary[];
  source: {
    provider: 'signal-validation-model';
    exportDirectory: string;
  } | null;
  rawRows?: TiberWrBreakoutSignalRow[];
}

export interface TeamScenarioSummary {
  playerCount: number;
  totalScenarioCount: number;
  maxDelta: number | null;
  players: TeamResearchPlayerSummary[];
  source: {
    provider: string | null;
    location: string | null;
    mode: 'api' | 'artifact' | null;
  };
  rawRows?: TiberPointScenarioLabRow[];
}

export interface TeamAgeCurveSummary {
  playerCount: number;
  players: TeamResearchPlayerSummary[];
  source: {
    provider: string | null;
    location: string | null;
    mode: 'api' | 'artifact' | null;
  };
  rawRows?: TiberAgeCurveLabRow[];
}

export interface TeamResearchSection<TSummary> {
  state: TeamResearchSectionState;
  title: string;
  description: string;
  linkHref: string;
  summary: TSummary | null;
  message: string | null;
  readOnly: true;
  provenanceNote: string;
  error: TeamResearchSectionError | null;
}

export interface TeamResearchWorkspace {
  season: number | null;
  availableSeasons: number[];
  state: TeamResearchWorkspaceState;
  requestedTeam: string | null;
  selectedTeam: TeamResearchResolvedTeam | null;
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
    offensiveContext: TeamResearchSection<TeamOffensiveContextSummary>;
    roleOpportunity: TeamResearchSection<TeamRoleOpportunitySummary>;
    breakoutSignals: TeamResearchSection<TeamBreakoutSummary>;
    pointScenarios: TeamResearchSection<TeamScenarioSummary>;
    ageCurves: TeamResearchSection<TeamAgeCurveSummary>;
  };
}

export type TeamResearchRoleRow = TiberRoleOpportunityLabRow;
export type TeamResearchBreakoutRow = TiberWrBreakoutSignalRow;
export type TeamResearchAgeRow = TiberAgeCurveLabRow;
export type TeamResearchScenarioRow = TiberPointScenarioLabRow;
