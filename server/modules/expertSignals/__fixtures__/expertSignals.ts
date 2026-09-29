import type { ExpertMockDraftSnapshotV0, ExpertSignalEventV0 } from '../contracts';

const BASE_FORMAT = {
  leagueType: 'redraft',
  scoring: 'ppr',
  qbMode: '1qb',
  rosterShape: '1qb-2rb-2wr-1te-2flex',
} as const;

export const SYNTHETIC_WEEKLY_RANKING_EVENT: ExpertSignalEventV0 = {
  schemaVersion: 'ffcc.expert-signal.v0.1.0',
  signalId: 'sig:synthetic:weekly-ranking:001',
  sourceId: 'source:synthetic-expert-alpha',
  analystId: 'analyst:synthetic-alpha',
  publisherId: 'publisher:synthetic-lab',
  sourceTraceRef: 'synthetic://expert-alpha/2026/week-2/rb',
  publishedAt: '2026-09-15T13:00:00Z',
  retrievedAt: '2026-09-15T13:05:00Z',
  knownAt: '2026-09-15T13:05:00Z',
  season: 2026,
  week: 2,
  horizon: 'week:2',
  format: BASE_FORMAT,
  signalType: 'WEEKLY_RANKING',
  subjectPlayerIds: ['player:synthetic-a'],
  subjectTeamIds: [],
  rawPositionOrTier: 'RB12',
  normalizedDirection: 'UP',
  strengthIfExplicit: null,
  rationaleTags: ['ROLE_USAGE'],
  summaryParaphrase: 'Synthetic analyst moved the player up after a larger observed role.',
  independenceCluster: 'cluster:synthetic-origin-001',
  sourcePolicyRef: 'cif.source-policy/synthetic-expert-alpha/v0',
  qualityState: 'NORMALIZED',
  readinessState: 'READY',
  correctionOf: null,
  supersedes: null,
  warnings: [],
};

export const SYNTHETIC_ROLE_INTERPRETATION_EVENT: ExpertSignalEventV0 = {
  ...SYNTHETIC_WEEKLY_RANKING_EVENT,
  signalId: 'sig:synthetic:role-interpretation:001',
  analystId: 'analyst:synthetic-beta',
  sourceTraceRef: 'synthetic://expert-beta/2026/week-2/role-note',
  publishedAt: '2026-09-15T13:01:00Z',
  retrievedAt: '2026-09-15T13:06:00Z',
  knownAt: '2026-09-15T13:06:00Z',
  signalType: 'ROLE_INTERPRETATION',
  rawPositionOrTier: null,
  normalizedDirection: 'UP',
  rationaleTags: ['ROLE_USAGE', 'VACATED_OPPORTUNITY'],
  summaryParaphrase: 'Synthetic analyst interprets the role change as potentially durable.',
  independenceCluster: 'cluster:synthetic-origin-001',
};

export const SYNTHETIC_CORRECTION_EVENT: ExpertSignalEventV0 = {
  ...SYNTHETIC_WEEKLY_RANKING_EVENT,
  signalId: 'sig:synthetic:weekly-ranking:001:correction-1',
  sourceTraceRef: 'synthetic://expert-alpha/2026/week-2/rb-correction',
  publishedAt: '2026-09-15T14:00:00Z',
  retrievedAt: '2026-09-15T14:02:00Z',
  knownAt: '2026-09-15T14:02:00Z',
  normalizedDirection: 'NEUTRAL',
  summaryParaphrase: 'Synthetic correction narrows the original role interpretation.',
  correctionOf: SYNTHETIC_WEEKLY_RANKING_EVENT.signalId,
  supersedes: SYNTHETIC_WEEKLY_RANKING_EVENT.signalId,
};

export const SYNTHETIC_MISSING_CONTEXT_EVENT: ExpertSignalEventV0 = {
  ...SYNTHETIC_WEEKLY_RANKING_EVENT,
  signalId: 'sig:synthetic:missing-context:001',
  sourceTraceRef: 'synthetic://expert-alpha/2026/missing-context',
  format: {
    leagueType: null,
    scoring: null,
    qbMode: null,
    rosterShape: null,
  },
  readinessState: 'PARTIAL',
  warnings: ['format_context_missing'],
};

export const SYNTHETIC_FUTURE_SIGNAL_EVENT: ExpertSignalEventV0 = {
  ...SYNTHETIC_WEEKLY_RANKING_EVENT,
  signalId: 'sig:synthetic:future:001',
  sourceTraceRef: 'synthetic://expert-alpha/2026/future',
  publishedAt: '2026-09-15T18:00:00Z',
  retrievedAt: '2026-09-15T18:02:00Z',
  knownAt: '2026-09-15T18:02:00Z',
};

export const SYNTHETIC_REDRAFT_MOCK: ExpertMockDraftSnapshotV0 = {
  schemaVersion: 'ffcc.expert-mock-draft.v0.1.0',
  snapshotId: 'mock:synthetic:redraft:001',
  sourceId: 'source:synthetic-mock-alpha',
  analystIds: ['analyst:synthetic-alpha'],
  publishedAt: '2026-09-15T12:00:00Z',
  retrievedAt: '2026-09-15T12:03:00Z',
  knownAt: '2026-09-15T12:03:00Z',
  mockType: 'redraft',
  leagueFormat: {
    teams: 12,
    qbMode: '1qb',
    scoring: 'ppr',
    rosterShape: 'standard-redraft-synthetic',
  },
  participantType: 'single_analyst',
  picks: [
    { overallPick: 1, round: 1, slot: 1, playerId: 'player:synthetic-a', position: 'RB', rationaleTags: ['ROLE_USAGE'] },
    { overallPick: 2, round: 1, slot: 2, playerId: 'player:synthetic-b', position: 'WR', rationaleTags: ['TEAM_ENVIRONMENT'] },
    { overallPick: 3, round: 1, slot: 3, playerId: 'player:synthetic-c', position: 'WR', rationaleTags: ['TALENT_EFFICIENCY'] },
  ],
  coverageStatus: 'PARTIAL',
  sourcePolicyRef: 'cif.source-policy/synthetic-mock-alpha/v0',
  independenceCluster: 'cluster:synthetic-mock-alpha-001',
  warnings: [],
};

export const SYNTHETIC_NFL_MOCK: ExpertMockDraftSnapshotV0 = {
  ...SYNTHETIC_REDRAFT_MOCK,
  snapshotId: 'mock:synthetic:nfl:001',
  sourceId: 'source:synthetic-nfl-mock',
  publishedAt: '2026-09-15T11:00:00Z',
  retrievedAt: '2026-09-15T11:04:00Z',
  knownAt: '2026-09-15T11:04:00Z',
  mockType: 'nfl',
  leagueFormat: {
    teams: 32,
    qbMode: null,
    scoring: null,
    rosterShape: null,
  },
  participantType: 'single_analyst',
  picks: [
    { overallPick: 1, round: 1, slot: 1, playerId: 'prospect:synthetic-001', position: 'QB', rationaleTags: ['ROOKIE_DEVELOPMENT'] },
    { overallPick: 2, round: 1, slot: 2, playerId: 'prospect:synthetic-002', position: 'EDGE', rationaleTags: ['OTHER_TYPED'] },
  ],
  sourcePolicyRef: 'cif.source-policy/synthetic-nfl-mock/v0',
  independenceCluster: 'cluster:synthetic-nfl-mock-001',
};

export const SYNTHETIC_FUTURE_MOCK: ExpertMockDraftSnapshotV0 = {
  ...SYNTHETIC_REDRAFT_MOCK,
  snapshotId: 'mock:synthetic:redraft:future-001',
  publishedAt: '2026-09-15T19:00:00Z',
  retrievedAt: '2026-09-15T19:03:00Z',
  knownAt: '2026-09-15T19:03:00Z',
};
