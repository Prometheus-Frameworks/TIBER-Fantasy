import { TiberAgeCurveLabRow } from '../ageCurves/types';
import { TiberPointScenarioLabRow } from '../pointScenarios/types';
import { TiberRoleOpportunityLabRow } from '../roleOpportunity/types';
import { TiberWrBreakoutSignalRow } from '../signalValidation/types';

export type PlayerResearchSectionState = 'idle' | 'ready' | 'not_available' | 'error';
export type PlayerResearchWorkspaceState = 'idle' | 'ready' | 'partial' | 'empty' | 'error';
export type PlayerResearchMatchStrategy = 'player_id' | 'exact_name' | 'normalized_name' | null;

export interface PlayerResearchQuery {
  season?: number;
  playerId?: string;
  playerName?: string;
}

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

export interface PlayerResearchResolvedPlayer {
  playerId: string | null;
  playerName: string;
  team: string | null;
  position: string | null;
  matchStrategy: PlayerResearchMatchStrategy;
}

export interface PlayerResearchSectionError {
  code: string;
  message: string;
}

export interface BreakoutSignalsResearchSummary {
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
  rawRow?: TiberWrBreakoutSignalRow;
}

export interface RoleOpportunityResearchSummary {
  primaryRole: string;
  routeParticipation: number | null;
  targetShare: number | null;
  airYardShare: number | null;
  snapShare: number | null;
  usageRate: number | null;
  confidenceScore: number | null;
  confidenceTier: string | null;
  insights: string[];
  source: TiberRoleOpportunityLabRow['source'];
  rawRow?: TiberRoleOpportunityLabRow;
}

export interface AgeCurveResearchSummary {
  age: number | null;
  careerYear: number | null;
  expectedPpg: number | null;
  actualPpg: number | null;
  ppgDelta: number | null;
  trajectoryLabel: string | null;
  peerBucket: string | null;
  ageCurveScore: number | null;
  provenance: TiberAgeCurveLabRow['provenance'];
  rawRow?: TiberAgeCurveLabRow;
}

export interface PointScenarioResearchSummary {
  baselineProjection: number | null;
  adjustedProjection: number | null;
  delta: number | null;
  confidenceBand: string | null;
  confidenceLabel: string | null;
  scenarioCount: number;
  topScenarioNames: string[];
  notes: string[];
  source: TiberPointScenarioLabRow['provenance'];
  rawRows?: TiberPointScenarioLabRow[];
}

export interface PlayerResearchSection<TSummary> {
  state: PlayerResearchSectionState;
  title: string;
  description: string;
  linkHref: string;
  summary: TSummary | null;
  message: string | null;
  readOnly: true;
  provenanceNote: string;
  error: PlayerResearchSectionError | null;
}

export interface PlayerResearchWorkspace {
  season: number | null;
  availableSeasons: number[];
  state: PlayerResearchWorkspaceState;
  requestedPlayerId: string | null;
  requestedPlayerName: string | null;
  selectedPlayer: PlayerResearchResolvedPlayer | null;
  searchIndex: PlayerResearchSearchEntry[];
  framing: {
    title: string;
    description: string;
    provenanceNote: string;
  };
  warnings: string[];
  sections: {
    breakoutSignals: PlayerResearchSection<BreakoutSignalsResearchSummary>;
    roleOpportunity: PlayerResearchSection<RoleOpportunityResearchSummary>;
    ageCurves: PlayerResearchSection<AgeCurveResearchSummary>;
    pointScenarios: PlayerResearchSection<PointScenarioResearchSummary>;
  };
}
