export type CommandCenterWorkspaceState = 'ready' | 'partial' | 'empty' | 'error';
export type CommandCenterSectionState = 'ready' | 'empty' | 'unavailable';
export type CommandCenterModuleStatusState = 'ready' | 'empty' | 'unavailable';

export interface CommandCenterQuery {
  season?: number;
}

export interface CommandCenterModuleStatus {
  moduleId: 'breakout-signals' | 'role-opportunity' | 'age-curves' | 'point-scenarios';
  title: string;
  href: string;
  state: CommandCenterModuleStatusState;
  detail: string;
}

export interface CommandCenterPriorityLink {
  label: string;
  href: string;
}

export interface CommandCenterPriorityItem {
  id: string;
  title: string;
  reason: string;
  moduleTitle: string;
  moduleHref: string;
  primaryAction: CommandCenterPriorityLink;
  secondaryAction?: CommandCenterPriorityLink | null;
}

export interface CommandCenterPlayerLinkSet {
  moduleHref: string;
  playerResearchHref: string;
}

export interface CommandCenterTeamLinkSet {
  moduleHref: string;
  teamResearchHref: string;
}

export interface CommandCenterBreakoutItem {
  playerId: string | null;
  playerName: string;
  team: string | null;
  candidateRank: number | null;
  finalSignalScore: number | null;
  breakoutLabel: string | null;
  breakoutContext: string | null;
  links: CommandCenterPlayerLinkSet;
}

export interface CommandCenterRoleItem {
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
  links: CommandCenterPlayerLinkSet;
}

export interface CommandCenterAgeCurveItem {
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
  links: CommandCenterPlayerLinkSet;
}

export interface CommandCenterScenarioItem {
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
  links: CommandCenterPlayerLinkSet;
}

export interface CommandCenterTeamEnvironmentItem {
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
  links: CommandCenterTeamLinkSet;
}

export interface CommandCenterSection<TItem> {
  state: CommandCenterSectionState;
  title: string;
  description: string;
  moduleTitle: string;
  linkHref: string;
  message: string;
  items: TItem[];
}

export interface DataLabCommandCenterWorkspace {
  season: number | null;
  availableSeasons: number[];
  state: CommandCenterWorkspaceState;
  framing: {
    title: string;
    description: string;
    posture: string;
  };
  moduleStatuses: CommandCenterModuleStatus[];
  priorities: CommandCenterPriorityItem[];
  warnings: string[];
  sections: {
    breakoutCandidates: CommandCenterSection<CommandCenterBreakoutItem>;
    roleOpportunity: CommandCenterSection<CommandCenterRoleItem>;
    ageCurves: CommandCenterSection<CommandCenterAgeCurveItem>;
    pointScenarios: CommandCenterSection<CommandCenterScenarioItem>;
    teamEnvironments: CommandCenterSection<CommandCenterTeamEnvironmentItem>;
  };
}
