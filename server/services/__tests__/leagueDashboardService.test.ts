import { playerIdentityMap } from '@shared/schema';

let computeLeagueDashboard: typeof import('../leagueDashboardService').computeLeagueDashboard;

function createDbMock({ identities = [], forgeRows = [], insertSpy, gsisOwners, updateSpy, readBack, readBackError, updateAffects = 1 }: { identities?: any[]; forgeRows?: any[]; insertSpy?: jest.Mock; gsisOwners?: any[]; updateSpy?: jest.Mock; readBack?: any[]; readBackError?: Error; updateAffects?: number }) {
  // The mock cannot introspect drizzle predicates, so identity selects are
  // distinguished by call order: 1 = roster lookup, 2 = the GSIS-ownership
  // probe hydration performs before writing, 3 = the post-write read-back.
  //
  // `readBack` defaults to `[]` on purpose: an empty authoritative read-back is
  // the realistic shape of an insert that `onConflictDoNothing()` skipped, and
  // the service must treat it as an answer rather than falling back to the
  // candidate rows it tried to write.
  let identitySelectCount = 0;
  return {
    update: jest.fn(() => ({
      set: (values: any) => ({
        where: (clause: any) => {
          updateSpy?.(values, clause);
          const affected = Array.from({ length: updateAffects }, () => ({ updated: true }));
          const result: any = Promise.resolve(affected);
          // Mirrors drizzle: `.returning()` yields the affected rows, which is
          // how the service decides whether it actually won the attach.
          result.returning = () => Promise.resolve(affected);
          return result;
        },
      }),
    })),
    select: jest.fn(() => ({
      from: (table: any) => ({
        where: () => {
          if (table === playerIdentityMap) {
            identitySelectCount += 1;
            if (identitySelectCount === 2 && gsisOwners !== undefined) {
              return Promise.resolve(gsisOwners);
            }
            if (identitySelectCount >= 3) {
              if (readBackError) return Promise.reject(readBackError);
              return Promise.resolve(readBack ?? []);
            }
            return Promise.resolve(identities);
          }
          return {
            orderBy: () => Promise.resolve(forgeRows),
          };
        },
        orderBy: () => Promise.resolve(forgeRows),
      }),
    })),
    insert: jest.fn(() => ({
      values: (rows: any) => {
        insertSpy?.(rows);
        return {
          onConflictDoNothing: jest.fn().mockResolvedValue(undefined),
          onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
        };
      },
    })),
  } as any;
}

jest.mock('../../infra/db', () => ({ db: {} }));
jest.mock('../../storage', () => ({ storage: {} }));

function forgeStaticLookup(rows: any[], artifact: any = {}) {
  const rowsByPlayerId = new Map(rows.map((row) => [row.playerId, row]));
  const playerSpecificCount = rows.filter((row) => row.isPlayerSpecificEvidence).length;
  const generatedBaselineCount = rows.filter((row) => row.isGeneratedBaselineVisibility).length;
  return {
    artifact: {
      state: 'available',
      available: true,
      reason: null,
      code: null,
      sourcePath: '/tmp/forge_player_static_v1.json',
      artifactId: 'FORGE_PLAYER_STATIC_V1',
      contractVersion: 'v1',
      generatedAt: '2026-06-07T00:00:00.000Z',
      rowCount: rows.length,
      playerSpecificCount,
      generatedBaselineCount,
      nonEvidenceCount: rows.length - playerSpecificCount - generatedBaselineCount,
      ...artifact,
    },
    rowsByPlayerId,
  };
}


function identityCrosswalkLookup(mappings: Array<{ provider: string; providerId: string; tiberPlayerId: string }>, artifact: any = {}) {
  const tiberPlayerIdsByProviderKey = new Map(mappings.map((mapping) => [`${mapping.provider}:${mapping.providerId}`, mapping.tiberPlayerId]));
  return {
    artifact: {
      state: 'available',
      available: true,
      reason: null,
      code: null,
      sourcePath: '/tmp/tiber_identity_crosswalk_v1.json',
      artifactId: 'TIBER_IDENTITY_CROSSWALK_V1',
      contractVersion: 'v1',
      generatedAt: '2026-06-08T00:00:00.000Z',
      rowCount: mappings.length,
      providerMappingCount: mappings.length,
      providerCount: new Set(mappings.map((mapping) => mapping.provider)).size,
      ...artifact,
    },
    rows: mappings.map((mapping) => ({
      provider: mapping.provider,
      providerId: mapping.providerId,
      providerCanonicalId: `${mapping.provider}:${mapping.providerId}`,
      tiberPlayerId: mapping.tiberPlayerId,
      playerName: null,
      position: null,
      raw: {},
    })),
    tiberPlayerIdsByProviderKey,
  };
}

const emptyIdentityCrosswalkLookup = () => identityCrosswalkLookup([]);

function forgeStaticRow(overrides: any) {
  return {
    playerId: 'p1',
    playerName: 'Player One',
    position: 'WR',
    team: null,
    alpha: 50,
    tier: null,
    confidence: 0.9,
    scoreSource: 'player_specific',
    isPlayerSpecificEvidence: true,
    isGeneratedBaselineVisibility: false,
    provenance: { score_source: 'player_specific' },
    raw: {},
    ...overrides,
  };
}

describe('computeLeagueDashboard', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://example.com/testdb';
    computeLeagueDashboard = (await import('../leagueDashboardService')).computeLeagueDashboard;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const baseLeague = {
    id: 'league1',
    season: 2024,
    userId: 'u1',
    leagueIdExternal: 'ext1',
    teams: [
      { id: 'team1', externalUserId: 'owner1', displayName: 'Team One' },
    ],
  } as any;

  const sleeperDeps = {
    getLeagueRosters: jest.fn().mockResolvedValue([{ owner_id: 'owner1', players: ['s1'] }]),
    getLeague: jest.fn().mockResolvedValue({ season: 2024, week: 1 }),
  };

  const storageDeps = {
    getLeagueWithTeams: jest.fn().mockResolvedValue(baseLeague),
    getLeagueDashboardSnapshot: jest.fn().mockResolvedValue(null),
    saveLeagueDashboardSnapshot: jest.fn().mockResolvedValue(undefined),
  };

  const forgeScore = {
    playerId: 'p1',
    playerName: 'Player One',
    position: 'WR',
    season: 2024,
    asOfWeek: 1,
    alpha: 50,
    rawAlpha: 48,
    subScores: {} as any,
    trajectory: 'up',
    confidence: 90,
    gamesPlayed: 8,
    dataQuality: {
      hasAdvancedStats: true,
      hasSnapData: true,
      hasDvPData: true,
      hasEnvironmentData: true,
      cappedDueToMissingData: false,
    },
    scoredAt: new Date(),
  };

  it('consumes player_specific FORGE_PLAYER_STATIC_V1 rows when identities resolve', async () => {
    const dbMock = createDbMock({ identities: [{ sleeperId: 's1', canonicalId: 'p1', position: 'WR', fullName: 'Player One' }] });
    const insertSpy = jest.fn();
    (dbMock.insert as jest.Mock).mockImplementation(() => ({
      values: (rows: any) => {
        insertSpy(rows);
        return {
          onConflictDoNothing: jest.fn().mockResolvedValue(undefined),
          onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
        };
      },
    }));

    const result = await computeLeagueDashboard(
      { userId: 'u1', leagueId: 'league1', week: 1, season: 2024 },
      {
        storage: storageDeps as any,
        sleeperClient: sleeperDeps as any,
        db: dbMock,
        forgeService: { getForgeScoresForPlayers: jest.fn().mockResolvedValue([forgeScore]) } as any,
        forgePlayerStaticService: { getLookup: jest.fn().mockResolvedValue(forgeStaticLookup([forgeStaticRow({})])) } as any,
        tiberIdentityCrosswalkService: { getLookup: jest.fn().mockResolvedValue(emptyIdentityCrosswalkLookup()) } as any,
      }
    );

    expect(result.teams[0].overall_total).toBeGreaterThan(0);
    expect(result.unresolvedPlayers).toEqual([]);
    expect(result.diagnostics?.computedForgeCount).toBe(0);
    expect(result.diagnostics?.forgeScoredCount).toBe(1);
    expect(result.diagnostics?.forgeBaselineCount).toBe(0);
    expect(result.diagnostics?.playerSpecificForgeCoverageCount).toBe(1);
    expect(result.diagnostics?.generatedBaselineVisibilityCount).toBe(0);
    expect(result.diagnostics?.forgeRosterMatching).toEqual(expect.objectContaining({
      rosterCanonicalIdsChecked: 1,
      rosterCanonicalIdsMatched: 1,
      playerSpecificRosterMatches: 1,
      generatedBaselineRosterMatches: 0,
      sampleMatchedCanonicalIds: ['p1'],
      sampleUnmatchedCanonicalIds: [],
    }));
    expect(result.teams[0].roster[0]).toEqual(expect.objectContaining({
      alpha: 50,
      forgeScoreSource: 'player_specific',
      visibilityState: 'forge_scored',
      unavailableReason: null,
    }));
    expect(insertSpy).not.toHaveBeenCalledWith([expect.objectContaining({ confidenceScore: 90 })]);
  });


  it('reports 3 player_specific evidence rows and 0 generated_baseline visibility rows without inflating baseline visibility', async () => {
    const result = await computeLeagueDashboard(
      { userId: 'u1', leagueId: 'league1', week: 1, season: 2025 },
      {
        storage: storageDeps as any,
        sleeperClient: {
          ...sleeperDeps,
          getLeagueRosters: jest.fn().mockResolvedValue([{ owner_id: 'owner1', players: ['6797', 'puka', 'bijan'] }]),
        } as any,
        db: createDbMock({ identities: [
          { sleeperId: '6797', canonicalId: 'tiber-data-player-2025-justin-herbert', position: 'QB', fullName: 'Justin Herbert' },
          { sleeperId: 'puka', canonicalId: 'tiber-data-player-2025-puka-nacua', position: 'WR', fullName: 'Puka Nacua' },
          { sleeperId: 'bijan', canonicalId: 'tiber-data-player-2025-bijan-robinson', position: 'RB', fullName: 'Bijan Robinson' },
        ] }),
        forgeService: { getForgeScoresForPlayers: jest.fn().mockResolvedValue([]) } as any,
        forgePlayerStaticService: {
          getLookup: jest.fn().mockResolvedValue(forgeStaticLookup([
            forgeStaticRow({ playerId: 'tiber-data-player-2025-justin-herbert', playerName: 'Justin Herbert', position: 'QB', alpha: 61.4 }),
            forgeStaticRow({ playerId: 'tiber-data-player-2025-puka-nacua', playerName: 'Puka Nacua', position: 'WR', alpha: 67.2 }),
            forgeStaticRow({ playerId: 'tiber-data-player-2025-bijan-robinson', playerName: 'Bijan Robinson', position: 'RB', alpha: 64.8 }),
          ])),
        } as any,
        tiberIdentityCrosswalkService: { getLookup: jest.fn().mockResolvedValue(emptyIdentityCrosswalkLookup()) } as any,
      }
    );

    expect(result.teams[0].roster).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Justin Herbert', forgeScoreSource: 'player_specific', visibilityState: 'forge_scored' }),
      expect.objectContaining({ name: 'Puka Nacua', forgeScoreSource: 'player_specific', visibilityState: 'forge_scored' }),
      expect.objectContaining({ name: 'Bijan Robinson', forgeScoreSource: 'player_specific', visibilityState: 'forge_scored' }),
    ]));
    expect(result.diagnostics?.forgeRosterMatching).toEqual(expect.objectContaining({
      rosterCanonicalIdsChecked: 3,
      rosterCanonicalIdsMatched: 3,
      playerSpecificRosterMatches: 3,
      generatedBaselineRosterMatches: 0,
    }));
    expect(result.diagnostics?.rosterVisibility).toEqual({
      total: 3,
      identityCovered: 3,
      baselineVisible: 0,
      forgeScored: 3,
      forgeBaseline: 0,
      generatedBaselineVisibility: 0,
      rookieAlphaFallback: 0,
      knownUnscored: 0,
      unresolved: 0,
      evidenceCovered: 3,
    });
    expect(result.diagnostics?.playerSpecificForgeCoverageCount).toBe(3);
    expect(result.diagnostics?.generatedBaselineVisibilityCount).toBe(0);
    expect(result.diagnostics?.baselineVisibleCount).toBe(0);
  });

  it('uses TIBER_IDENTITY_CROSSWALK_V1 to resolve Sleeper fallback canonical IDs to FORGE_PLAYER_STATIC_V1 canonical player IDs', async () => {
    const result = await computeLeagueDashboard(
      { userId: 'u1', leagueId: 'league1', week: 1, season: 2025 },
      {
        storage: storageDeps as any,
        sleeperClient: sleeperDeps as any,
        db: createDbMock({ identities: [{ sleeperId: 's1', canonicalId: 'sleeper:6797', position: 'QB', fullName: 'Justin Herbert' }] }),
        forgeService: { getForgeScoresForPlayers: jest.fn().mockResolvedValue([]) } as any,
        forgePlayerStaticService: {
          getLookup: jest.fn().mockResolvedValue(forgeStaticLookup([
            forgeStaticRow({
              playerId: 'tiber-data-player-2025-justin-herbert',
              playerName: 'Justin Herbert',
              position: 'QB',
              alpha: 61.4,
              tier: 'T2',
            }),
          ])),
        } as any,
        tiberIdentityCrosswalkService: {
          getLookup: jest.fn().mockResolvedValue(identityCrosswalkLookup([
            { provider: 'sleeper', providerId: '6797', tiberPlayerId: 'tiber-data-player-2025-justin-herbert' },
          ])),
        } as any,
      }
    );

    expect(result.teams[0].roster[0]).toEqual(expect.objectContaining({
      canonicalId: 'sleeper:6797',
      alpha: 61.4,
      forgeScoreSource: 'player_specific',
      visibilityState: 'forge_scored',
    }));
    expect(result.teams[0].roster[0].forgeScoreProvenance).toEqual(expect.objectContaining({
      matchType: 'identity_crosswalk',
      rosterCanonicalId: 'sleeper:6797',
      forgePlayerId: 'tiber-data-player-2025-justin-herbert',
    }));
    expect(result.diagnostics?.forgeRosterMatching).toEqual(expect.objectContaining({
      rosterCanonicalIdsChecked: 1,
      rosterCanonicalIdsMatched: 1,
      directCanonicalMatches: 0,
      crosswalkCanonicalMatches: 1,
      playerSpecificRosterMatches: 1,
      sampleCrosswalkMatchedCanonicalIds: [{ rosterCanonicalId: 'sleeper:6797', forgePlayerId: 'tiber-data-player-2025-justin-herbert', providerKey: 'sleeper:6797' }],
      sampleUnmatchedCanonicalIds: [],
    }));
  });

  it('matches raw Sleeper provider IDs through TIBER_IDENTITY_CROSSWALK_V1 before FORGE lookup', async () => {
    const result = await computeLeagueDashboard(
      { userId: 'u1', leagueId: 'league1', week: 1, season: 2025 },
      {
        storage: storageDeps as any,
        sleeperClient: {
          ...sleeperDeps,
          getLeagueRosters: jest.fn().mockResolvedValue([{ owner_id: 'owner1', players: ['6797'] }]),
        } as any,
        db: createDbMock({ identities: [{ sleeperId: '6797', canonicalId: 'local-herbert', position: 'QB', fullName: 'Justin Herbert' }] }),
        forgeService: { getForgeScoresForPlayers: jest.fn().mockResolvedValue([]) } as any,
        forgePlayerStaticService: {
          getLookup: jest.fn().mockResolvedValue(forgeStaticLookup([
            forgeStaticRow({
              playerId: 'tiber-data-player-2025-justin-herbert',
              playerName: 'Justin Herbert',
              position: 'QB',
              alpha: 61.4,
            }),
          ])),
        } as any,
        tiberIdentityCrosswalkService: {
          getLookup: jest.fn().mockResolvedValue(identityCrosswalkLookup([
            { provider: 'sleeper', providerId: '6797', tiberPlayerId: 'tiber-data-player-2025-justin-herbert' },
          ])),
        } as any,
      }
    );

    expect(result.teams[0].roster[0]).toEqual(expect.objectContaining({
      canonicalId: 'local-herbert',
      alpha: 61.4,
      forgeScoreSource: 'player_specific',
    }));
    expect(result.teams[0].roster[0].forgeScoreProvenance).toEqual(expect.objectContaining({
      matchType: 'identity_crosswalk',
      identityProviderKey: 'sleeper:6797',
      identityCrosswalkArtifactId: 'TIBER_IDENTITY_CROSSWALK_V1',
    }));
  });


  it('expands identity crosswalk mapping without counting missing/generated-baseline rows as player-specific evidence or team truth', async () => {
    const rosterIds = ['11635', '11624', '3198', '4034', '13299'];
    const result = await computeLeagueDashboard(
      { userId: 'u1', leagueId: 'league1', week: 1, season: 2025 },
      {
        storage: storageDeps as any,
        sleeperClient: {
          ...sleeperDeps,
          getLeagueRosters: jest.fn().mockResolvedValue([{ owner_id: 'owner1', players: rosterIds }]),
        } as any,
        db: createDbMock({
          identities: [
            { sleeperId: '11635', canonicalId: 'sleeper:11635', position: 'WR', fullName: 'Ladd McConkey', nflTeam: 'CURRENT_LAC' },
            { sleeperId: '11624', canonicalId: 'sleeper:11624', position: 'WR', fullName: 'Xavier Worthy', nflTeam: 'CURRENT_KC' },
            { sleeperId: '3198', canonicalId: 'sleeper:3198', position: 'RB', fullName: 'Derrick Henry', nflTeam: 'CURRENT_BAL' },
            { sleeperId: '4034', canonicalId: 'sleeper:4034', position: 'RB', fullName: 'Christian McCaffrey', nflTeam: 'CURRENT_SF' },
            { sleeperId: '13299', canonicalId: 'sleeper:13299', position: 'WR', fullName: 'Omitted Player', nflTeam: 'CURRENT_FA' },
          ],
        }),
        forgeService: { getForgeScoresForPlayers: jest.fn().mockResolvedValue([]) } as any,
        forgePlayerStaticService: { getLookup: jest.fn().mockResolvedValue(forgeStaticLookup([
          forgeStaticRow({
            playerId: 'tiber-data-player-2025-ladd-mcconkey',
            playerName: 'Ladd McConkey',
            alpha: 60,
            scoreSource: 'generated_baseline',
            isPlayerSpecificEvidence: false,
            isGeneratedBaselineVisibility: true,
          }),
        ])) } as any,
        tiberIdentityCrosswalkService: {
          getLookup: jest.fn().mockResolvedValue(identityCrosswalkLookup([
            { provider: 'sleeper', providerId: '11635', tiberPlayerId: 'tiber-data-player-2025-ladd-mcconkey' },
            { provider: 'sleeper', providerId: '11624', tiberPlayerId: 'tiber-data-player-2025-xavier-worthy' },
            { provider: 'sleeper', providerId: '3198', tiberPlayerId: 'tiber-data-player-2025-derrick-henry' },
            { provider: 'sleeper', providerId: '4034', tiberPlayerId: 'tiber-data-player-2025-christian-mccaffrey' },
          ], { rowCount: 25, providerMappingCount: 25 }))
        } as any,
      }
    );

    const rosterBySleeperId = new Map(result.teams[0].roster.map((player) => [player.sleeperId, player]));
    expect(rosterBySleeperId.get('11635')).toEqual(expect.objectContaining({
      currentTiberPlayerId: 'tiber-data-player-2025-ladd-mcconkey',
      crosswalkStatus: 'matched',
      forgeScoreSource: 'generated_baseline',
      visibilityState: 'forge_baseline',
      unavailableReason: 'forge_generated_baseline_not_player_specific',
      nflTeam: 'CURRENT_LAC',
    }));
    expect(rosterBySleeperId.get('11624')).toEqual(expect.objectContaining({
      currentTiberPlayerId: 'tiber-data-player-2025-xavier-worthy',
      crosswalkStatus: 'matched',
      alpha: null,
      missingReason: 'missing_forge_row',
      visibilityState: 'known_unscored',
      nflTeam: 'CURRENT_KC',
    }));
    expect(rosterBySleeperId.get('13299')).toEqual(expect.objectContaining({
      currentTiberPlayerId: null,
      crosswalkStatus: 'missing',
      alpha: null,
      missingReason: 'missing_forge_row',
    }));
    expect(result.teams[0].overall_total).toBe(0);
    expect(result.diagnostics?.playerSpecificForgeCoverageCount).toBe(0);
    expect(result.diagnostics?.generatedBaselineVisibilityCount).toBe(1);
    expect(result.diagnostics?.rosterVisibility).toEqual(expect.objectContaining({
      total: 5,
      identityCovered: 5,
      baselineVisible: 1,
      forgeScored: 0,
      forgeBaseline: 1,
      generatedBaselineVisibility: 1,
      knownUnscored: 4,
      evidenceCovered: 0,
    }));
    expect(result.diagnostics?.forgeRosterMatching).toEqual(expect.objectContaining({
      rosterCanonicalIdsChecked: 5,
      rosterCanonicalIdsMatched: 1,
      crosswalkCanonicalMatches: 1,
      playerSpecificRosterMatches: 0,
      generatedBaselineRosterMatches: 1,
    }));
    expect(result.diagnostics?.identityCrosswalkArtifact).toEqual(expect.objectContaining({
      rowCount: 25,
      providerMappingCount: 25,
    }));
  });

  it('fails closed when TIBER_IDENTITY_CROSSWALK_V1 is missing and no direct canonical FORGE row exists', async () => {
    const result = await computeLeagueDashboard(
      { userId: 'u1', leagueId: 'league1', week: 1, season: 2025 },
      {
        storage: storageDeps as any,
        sleeperClient: sleeperDeps as any,
        db: createDbMock({ identities: [{ sleeperId: 's1', canonicalId: 'sleeper:6797', position: 'QB', fullName: 'Justin Herbert' }] }),
        forgeService: { getForgeScoresForPlayers: jest.fn().mockResolvedValue([]) } as any,
        forgePlayerStaticService: {
          getLookup: jest.fn().mockResolvedValue(forgeStaticLookup([
            forgeStaticRow({
              playerId: 'tiber-data-player-2025-justin-herbert',
              playerName: 'Justin Herbert',
              position: 'QB',
              alpha: 61.4,
            }),
          ])),
        } as any,
        tiberIdentityCrosswalkService: {
          getLookup: jest.fn().mockResolvedValue(identityCrosswalkLookup([], {
            available: false,
            state: 'missing',
            code: 'not_found',
            reason: 'missing crosswalk',
          })),
        } as any,
      }
    );

    expect(result.teams[0].roster[0]).toEqual(expect.objectContaining({
      canonicalId: 'sleeper:6797',
      alpha: null,
      missingReason: 'missing_forge_row',
      visibilityState: 'known_unscored',
    }));
    expect(result.diagnostics?.identityCrosswalkArtifact).toEqual(expect.objectContaining({
      available: false,
      state: 'missing',
    }));
    expect(result.diagnostics?.forgeRosterMatching).toEqual(expect.objectContaining({
      rosterCanonicalIdsMatched: 0,
      crosswalkCanonicalMatches: 0,
      sampleUnmatchedCanonicalIds: ['sleeper:6797'],
    }));
  });

  it('keeps generated FORGE baselines visible without counting them as scored coverage', async () => {
    const baselineScore = {
      ...forgeScore,
      alpha: 13.5,
      rawAlpha: 13.5,
      confidence: 20,
      gamesPlayed: 0,
      dataQuality: {
        hasAdvancedStats: false,
        hasSnapData: false,
        hasDvPData: false,
        hasEnvironmentData: false,
        cappedDueToMissingData: true,
      },
    };
    const dbMock = createDbMock({ identities: [{ sleeperId: 's1', canonicalId: 'p1', position: 'WR', fullName: 'Player One' }] });

    const result = await computeLeagueDashboard(
      { userId: 'u1', leagueId: 'league1', week: 1, season: 2024 },
      {
        storage: storageDeps as any,
        sleeperClient: sleeperDeps as any,
        db: dbMock,
        forgeService: { getForgeScoresForPlayers: jest.fn().mockResolvedValue([baselineScore]) } as any,
        forgePlayerStaticService: { getLookup: jest.fn().mockResolvedValue(forgeStaticLookup([forgeStaticRow({ alpha: 13.5, confidence: 0.2, scoreSource: 'generated_baseline', isPlayerSpecificEvidence: false, isGeneratedBaselineVisibility: true, provenance: { score_source: 'generated_baseline' } })])) } as any,
      }
    );

    expect(result.teams[0].overall_total).toBe(0);
    expect(result.teams[0].roster[0]).toEqual(expect.objectContaining({
      alpha: 13.5,
      forgeScoreSource: 'generated_baseline',
      visibilityState: 'forge_baseline',
      unavailableReason: 'forge_generated_baseline_not_player_specific',
    }));
    expect(result.diagnostics?.playerSpecificForgeCoverageCount).toBe(0);
    expect(result.diagnostics?.generatedBaselineVisibilityCount).toBe(1);
    expect(result.diagnostics?.forgeRosterMatching).toEqual(expect.objectContaining({
      rosterCanonicalIdsChecked: 1,
      rosterCanonicalIdsMatched: 1,
      playerSpecificRosterMatches: 0,
      generatedBaselineRosterMatches: 1,
      sampleMatchedCanonicalIds: ['p1'],
      sampleUnmatchedCanonicalIds: [],
    }));
    expect(result.diagnostics?.rosterVisibility).toEqual({
      total: 1,
      identityCovered: 1,
      baselineVisible: 1,
      forgeScored: 0,
      forgeBaseline: 1,
      generatedBaselineVisibility: 1,
      rookieAlphaFallback: 0,
      knownUnscored: 0,
      unresolved: 0,
      evidenceCovered: 0,
    });
  });



  it('falls back to first and last name when resolved identity fullName is blank', async () => {
    const baselineScore = {
      ...forgeScore,
      alpha: 13.5,
      rawAlpha: 13.5,
      confidence: 20,
      gamesPlayed: 0,
    };
    const dbMock = createDbMock({
      identities: [{ sleeperId: 's1', canonicalId: 'p1', position: 'WR', fullName: '   ', firstName: 'Player', lastName: 'One', nflTeam: 'CIN' }],
    });

    const result = await computeLeagueDashboard(
      { userId: 'u1', leagueId: 'league1', week: 1, season: 2024 },
      {
        storage: storageDeps as any,
        sleeperClient: sleeperDeps as any,
        db: dbMock,
        forgeService: { getForgeScoresForPlayers: jest.fn().mockResolvedValue([baselineScore]) } as any,
        forgePlayerStaticService: { getLookup: jest.fn().mockResolvedValue(forgeStaticLookup([forgeStaticRow({ alpha: 13.5, confidence: 0.2, scoreSource: 'generated_baseline', isPlayerSpecificEvidence: false, isGeneratedBaselineVisibility: true, provenance: { score_source: 'generated_baseline' } })])) } as any,
      }
    );

    expect(result.teams[0].roster[0]).toEqual(expect.objectContaining({
      name: 'Player One',
      nflTeam: 'CIN',
      alpha: 13.5,
      forgeScoreSource: 'generated_baseline',
      visibilityState: 'forge_baseline',
    }));
  });

  it('surfaces unmapped sleeper ids without synthetic canonical ids', async () => {
    const forgeServiceMock = { getForgeScoresForPlayers: jest.fn().mockResolvedValue([]) };
    const result = await computeLeagueDashboard(
      { userId: 'u1', leagueId: 'league1', week: 1, season: 2024 },
      {
        storage: storageDeps as any,
        sleeperClient: sleeperDeps as any,
        db: createDbMock({ identities: [] }),
        forgeService: forgeServiceMock as any,
        forgePlayerStaticService: { getLookup: jest.fn().mockResolvedValue(forgeStaticLookup([])) } as any,
      }
    );

    expect(result.unresolvedPlayers.length).toBe(1);
    expect(result.unresolvedPlayers[0]).toEqual({ sleeperId: 's1', reason: 'unmapped_sleeper_id' });
    expect(forgeServiceMock.getForgeScoresForPlayers).not.toHaveBeenCalled();
    const rosterPlayer = result.teams[0].roster[0];
    expect(rosterPlayer.canonicalId).toBeNull();
    expect(rosterPlayer.alpha).toBeNull();
    expect(rosterPlayer.missingReason).toBe('unmapped_sleeper_id');
    expect(rosterPlayer.visibilityState).toBe('unresolved');
    expect(rosterPlayer.unavailableReason).toBe('identity_unresolved');
    expect(result.diagnostics?.rosterVisibility).toEqual({
      total: 1,
      identityCovered: 0,
      baselineVisible: 0,
      forgeScored: 0,
      forgeBaseline: 0,
      generatedBaselineVisibility: 0,
      rookieAlphaFallback: 0,
      knownUnscored: 0,
      unresolved: 1,
      evidenceCovered: 0,
    });
  });

  describe('hydration cannot create a second owner of a GSIS', () => {
    const sleeperPlayerWithGsis = {
      s1: {
        player_id: 's1', full_name: 'Player One', first_name: 'Player', last_name: 'One',
        position: 'WR', team: 'CIN', active: true, fantasy_data_id: 12345, gsis_id: '00-0030001',
      },
    };

    const runHydration = async (dbMock: any) =>
      computeLeagueDashboard(
        { userId: 'u1', leagueId: 'league1', week: 1, season: 2024 },
        {
          storage: storageDeps as any,
          sleeperClient: { ...sleeperDeps, getNflPlayers: jest.fn().mockResolvedValue(sleeperPlayerWithGsis) } as any,
          db: dbMock,
          forgeService: { getForgeScoresForPlayers: jest.fn().mockResolvedValue([]) } as any,
          forgePlayerStaticService: { getLookup: jest.fn().mockResolvedValue(forgeStaticLookup([])) } as any,
        },
      );

    it('attaches the Sleeper id to the one existing GSIS owner instead of inserting a rival row', async () => {
      // The duplicate-owner path: a canonical row already owns this GSIS but has
      // no Sleeper id. Inserting `sleeper:s1` carrying the same GSIS would make
      // it ambiguous, and the #308 resolvers would then refuse to resolve it —
      // disabling links for that player after an ordinary dashboard read.
      const insertSpy = jest.fn();
      const updateSpy = jest.fn();
      const dbMock = createDbMock({
        identities: [],
        gsisOwners: [{ canonicalId: 'tiber-player-one', gsisId: '00-0030001', sleeperId: null }],
        insertSpy,
        updateSpy,
      });

      await runHydration(dbMock);

      expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ sleeperId: 's1' }), expect.anything());
      const insertedGsis = insertSpy.mock.calls.flatMap(([rows]) => rows ?? []).map((row: any) => row.gsisId);
      expect(insertedGsis).not.toContain('00-0030001');
    });

    it('withholds the GSIS when it is already owned by a different Sleeper id', async () => {
      const insertSpy = jest.fn();
      const updateSpy = jest.fn();
      const dbMock = createDbMock({
        identities: [],
        gsisOwners: [{ canonicalId: 'tiber-someone-else', gsisId: '00-0030001', sleeperId: 'other' }],
        insertSpy,
        updateSpy,
      });

      await runHydration(dbMock);

      expect(updateSpy).not.toHaveBeenCalled();
      const inserted = insertSpy.mock.calls.flatMap(([rows]) => rows ?? []);
      expect(inserted).toEqual([expect.objectContaining({ canonicalId: 'sleeper:s1', gsisId: null })]);
    });

    it('withholds the GSIS when ownership is already ambiguous', async () => {
      const insertSpy = jest.fn();
      const dbMock = createDbMock({
        identities: [],
        gsisOwners: [
          { canonicalId: 'dupe-a', gsisId: '00-0030001', sleeperId: null },
          { canonicalId: 'dupe-b', gsisId: '00-0030001', sleeperId: null },
        ],
        insertSpy,
      });

      await runHydration(dbMock);

      const inserted = insertSpy.mock.calls.flatMap(([rows]) => rows ?? []);
      expect(inserted).toEqual([expect.objectContaining({ canonicalId: 'sleeper:s1', gsisId: null })]);
    });
  });

  describe('hydration can never mint a second GSIS owner', () => {
    const twoPlayersSameGsis = {
      s1: { player_id: 's1', full_name: 'Player One', first_name: 'Player', last_name: 'One',
            position: 'WR', team: 'CIN', active: true, gsis_id: '00-0030001' },
      s2: { player_id: 's2', full_name: 'Player Two', first_name: 'Player', last_name: 'Two',
            position: 'RB', team: 'BUF', active: true, gsis_id: '00-0030001' },
    };

    const run = async (dbMock: any, players: any, rosterIds: string[] = ['s1']) =>
      computeLeagueDashboard(
        { userId: 'u1', leagueId: 'league1', week: 1, season: 2024 },
        {
          storage: storageDeps as any,
          sleeperClient: {
            ...sleeperDeps,
            getLeagueRosters: jest.fn().mockResolvedValue([{ owner_id: 'owner1', players: rosterIds }]),
            getNflPlayers: jest.fn().mockResolvedValue(players),
          } as any,
          db: dbMock,
          forgeService: { getForgeScoresForPlayers: jest.fn().mockResolvedValue([]) } as any,
          forgePlayerStaticService: { getLookup: jest.fn().mockResolvedValue(forgeStaticLookup([])) } as any,
        },
      );

    it('two candidates sharing a GSIS in one batch cannot both insert it', async () => {
      // The same-batch race: a pre-read snapshot says "unowned" for both, and
      // without this guard both rows would be inserted carrying the same GSIS.
      const insertSpy = jest.fn();
      const dbMock = createDbMock({ identities: [], gsisOwners: [], insertSpy });

      await run(dbMock, twoPlayersSameGsis, ['s1', 's2']);

      const inserted = insertSpy.mock.calls.flatMap(([rows]) => rows ?? []);
      expect(inserted.length).toBeGreaterThan(0);
      expect(inserted.every((row: any) => row.gsisId === null)).toBe(true);
    });

    it('an unowned GSIS is withheld rather than inserted, because the read is only a snapshot', async () => {
      // Concurrency equivalent: another request could insert the same GSIS
      // between our read and our write, and no unique index would stop it.
      const insertSpy = jest.fn();
      const dbMock = createDbMock({ identities: [], gsisOwners: [], insertSpy });

      await run(dbMock, twoPlayersSameGsis, ['s1']);

      const inserted = insertSpy.mock.calls.flatMap(([rows]) => rows ?? []);
      expect(inserted).toEqual([expect.objectContaining({ canonicalId: 'sleeper:s1', gsisId: null })]);
    });

    it('an attach is bound to the exact selected owner and unclaimed state', async () => {
      const updateSpy = jest.fn();
      const insertSpy = jest.fn();
      const dbMock = createDbMock({
        identities: [],
        gsisOwners: [{ canonicalId: 'tiber-player-one', gsisId: '00-0030001', sleeperId: null }],
        updateSpy,
        insertSpy,
      });

      await run(dbMock, twoPlayersSameGsis, ['s1']);

      expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ sleeperId: 's1' }), expect.anything());
      // Attaching replaces the insert entirely; no rival row is written.
      const inserted = insertSpy.mock.calls.flatMap(([rows]) => rows ?? []);
      expect(inserted).toEqual([]);
    });

    it('the attached owner is returned in the same response, not only on a later one', async () => {
      // The repairing request must not still report the player unresolved.
      const dbMock = createDbMock({
        identities: [],
        gsisOwners: [{ canonicalId: 'tiber-player-one', gsisId: '00-0030001', sleeperId: null }],
        readBack: [{ canonicalId: 'tiber-player-one', gsisId: '00-0030001', sleeperId: 's1',
                     position: 'WR', fullName: 'Player One' }],
      });

      const result = await run(dbMock, twoPlayersSameGsis, ['s1']);

      expect(result.unresolvedPlayers).toEqual([]);
      expect(result.teams[0].roster[0]).toEqual(expect.objectContaining({
        canonicalId: 'tiber-player-one',
        sleeperId: 's1',
      }));
    });
  });

  describe('only a confirmed read-back may expose a hydrated identity', () => {
    // `toInsert` is a candidate set, never a result. Every insert runs under
    // `onConflictDoNothing()`, so a candidate can be silently skipped and never
    // reach `player_identity_map`. Returning candidates therefore publishes a
    // canonical identity that may not exist — and because the caller splices
    // hydration output straight into `identities`, the fabricated row is
    // indistinguishable from a real one in the same request's dashboard state.
    // Carries a GSIS so the ownership probe runs. That keeps the mock's
    // documented select ordering intact (1 = roster, 2 = GSIS probe,
    // 3 = read-back); without it the probe short-circuits, select #2 becomes
    // the read-back, and these tests would pass by reading the roster stub
    // rather than the read-back they exist to exercise.
    const onePlayer = {
      s1: { player_id: 's1', full_name: 'Player One', first_name: 'Player', last_name: 'One',
            position: 'WR', team: 'CIN', active: true, gsis_id: '00-0030001' },
    };

    const run = async (dbMock: any) =>
      computeLeagueDashboard(
        { userId: 'u1', leagueId: 'league1', week: 1, season: 2024 },
        {
          storage: storageDeps as any,
          sleeperClient: {
            ...sleeperDeps,
            getLeagueRosters: jest.fn().mockResolvedValue([{ owner_id: 'owner1', players: ['s1'] }]),
            getNflPlayers: jest.fn().mockResolvedValue(onePlayer),
          } as any,
          db: dbMock,
          forgeService: { getForgeScoresForPlayers: jest.fn().mockResolvedValue([]) } as any,
          forgePlayerStaticService: { getLookup: jest.fn().mockResolvedValue(forgeStaticLookup([])) } as any,
        },
      );

    it('a skipped insert with an empty read-back leaves the player unresolved, not fabricated', async () => {
      // The reproduction: the insert is attempted, `onConflictDoNothing()`
      // skips it, and the authoritative read-back confirms nothing. An empty
      // read-back is an ANSWER — the row is not there — so the candidate must
      // not be substituted for it.
      const insertSpy = jest.fn();
      const dbMock = createDbMock({ identities: [], gsisOwners: [], insertSpy, readBack: [] });

      const result = await run(dbMock);

      // The insert really was attempted; this is not a test that skipped the path.
      expect(insertSpy).toHaveBeenCalledWith([expect.objectContaining({ canonicalId: 'sleeper:s1' })]);
      expect(result.unresolvedPlayers).toEqual([expect.objectContaining({ sleeperId: 's1' })]);
      expect(result.teams[0].roster[0]).toEqual(expect.objectContaining({
        canonicalId: null,
        visibilityState: 'unresolved',
      }));
    });

    it('a failed read-back yields nothing rather than the unconfirmed candidates', async () => {
      // A read-back error is not an answer at all. It must not be downgraded
      // into "assume the write landed".
      const insertSpy = jest.fn();
      const dbMock = createDbMock({
        identities: [],
        gsisOwners: [],
        insertSpy,
        readBackError: new Error('connection terminated during read-back'),
      });

      const result = await run(dbMock);

      expect(insertSpy).toHaveBeenCalled();
      expect(result.unresolvedPlayers).toEqual([expect.objectContaining({ sleeperId: 's1' })]);
      expect(result.teams[0].roster[0]).toEqual(expect.objectContaining({ canonicalId: null }));
    });

    it('an unconfirmed candidate never reaches the same request’s dashboard state', async () => {
      // The snapshot assertion, distinct from the two above: no part of the
      // response may carry the candidate canonical id, and roster visibility
      // must count the player as unresolved rather than identity-covered.
      const dbMock = createDbMock({ identities: [], gsisOwners: [], readBack: [] });

      const result = await run(dbMock);

      // The provider key itself may still be echoed — that is the request's own
      // input, not a claim about identity. What must be absent is any CANONICAL
      // identity for a row the read-back never confirmed.
      const player = result.teams[0].roster[0];
      expect(player.canonicalId).toBeNull();
      expect(player.currentTiberPlayerId).toBeNull();
      expect(player.crosswalkStatus).toBe('unresolved');
      expect(result.diagnostics?.rosterVisibility).toEqual(expect.objectContaining({
        total: 1,
        identityCovered: 0,
        unresolved: 1,
      }));
    });

    it('a confirmed read-back is still exposed', async () => {
      // The fix must fail closed without disabling hydration: when the row IS
      // confirmed present, it resolves exactly as before.
      const dbMock = createDbMock({
        identities: [],
        gsisOwners: [],
        readBack: [{ canonicalId: 'sleeper:s1', gsisId: null, sleeperId: 's1',
                     position: 'WR', fullName: 'Player One', nflTeam: 'CIN' }],
      });

      const result = await run(dbMock);

      expect(result.unresolvedPlayers).toEqual([]);
      expect(result.teams[0].roster[0]).toEqual(expect.objectContaining({
        canonicalId: 'sleeper:s1',
        sleeperId: 's1',
      }));
    });
  });

  it('hydrates missing roster identities from Sleeper player metadata before classifying them unresolved', async () => {
    const insertSpy = jest.fn();
    // The read-back must confirm the row for it to be exposed. This test is
    // about the hydration path producing the right INSERT and the right
    // resolved shape, so the read-back reflects a write that actually landed;
    // the skipped-insert case is covered separately above.
    const dbMock = createDbMock({
      identities: [],
      insertSpy,
      readBack: [{
        canonicalId: 'sleeper:s1',
        sleeperId: 's1',
        fullName: 'Player One',
        position: 'WR',
        nflTeam: 'CIN',
        fantasyDataId: '12345',
        gsisId: null,
      }],
    });
    const forgeServiceMock = { getForgeScoresForPlayers: jest.fn().mockResolvedValue([]) };

    const result = await computeLeagueDashboard(
      { userId: 'u1', leagueId: 'league1', week: 1, season: 2024 },
      {
        storage: storageDeps as any,
        sleeperClient: {
          ...sleeperDeps,
          getNflPlayers: jest.fn().mockResolvedValue({
            s1: {
              player_id: 's1',
              full_name: 'Player One',
              first_name: 'Player',
              last_name: 'One',
              position: 'WR',
              team: 'CIN',
              active: true,
              fantasy_data_id: 12345,
              gsis_id: '00-0030001',
            },
          }),
        } as any,
        db: dbMock,
        forgeService: forgeServiceMock as any,
        forgePlayerStaticService: { getLookup: jest.fn().mockResolvedValue(forgeStaticLookup([])) } as any,
      }
    );

    expect(result.unresolvedPlayers).toEqual([]);
    expect(forgeServiceMock.getForgeScoresForPlayers).not.toHaveBeenCalled();
    expect(insertSpy).toHaveBeenCalledWith([expect.objectContaining({
      canonicalId: 'sleeper:s1',
      sleeperId: 's1',
      fullName: 'Player One',
      position: 'WR',
      nflTeam: 'CIN',
      fantasyDataId: '12345',
      // Hydration never inserts a GSIS: gsis_id has no unique index, so any
      // insert carrying one is a race that can mint a second owner.
      gsisId: null,
    })]);
    expect(result.teams[0].roster[0]).toEqual(expect.objectContaining({
      rosterKey: 'sleeper:s1',
      canonicalId: 'sleeper:s1',
      sleeperId: 's1',
      name: 'Player One',
      pos: 'WR',
      nflTeam: 'CIN',
      alpha: null,
      missingReason: 'missing_forge_row',
      visibilityState: 'known_unscored',
      unavailableReason: 'rookie_alpha_fallback_unavailable',
    }));
    expect(result.diagnostics?.rosterVisibility).toEqual({
      total: 1,
      identityCovered: 1,
      baselineVisible: 0,
      forgeScored: 0,
      forgeBaseline: 0,
      generatedBaselineVisibility: 0,
      rookieAlphaFallback: 0,
      knownUnscored: 1,
      unresolved: 0,
      evidenceCovered: 0,
    });
  });

  it('exposes available FORGE_PLAYER_STATIC_V1 diagnostics when roster canonical IDs do not match artifact rows', async () => {
    const result = await computeLeagueDashboard(
      { userId: 'u1', leagueId: 'league1', week: 1, season: 2024 },
      {
        storage: storageDeps as any,
        sleeperClient: sleeperDeps as any,
        db: createDbMock({ identities: [{ sleeperId: 's1', canonicalId: 'p1', position: 'WR', fullName: 'Player One' }] }),
        forgeService: { getForgeScoresForPlayers: jest.fn().mockResolvedValue([forgeScore]) } as any,
        forgePlayerStaticService: { getLookup: jest.fn().mockResolvedValue(forgeStaticLookup([forgeStaticRow({ playerId: 'p2', playerName: 'Player Two' })])) } as any,
      }
    );

    expect(result.teams[0].overall_total).toBe(0);
    expect(result.teams[0].roster[0]).toEqual(expect.objectContaining({
      canonicalId: 'p1',
      alpha: null,
      missingReason: 'missing_forge_row',
      visibilityState: 'known_unscored',
    }));
    expect(result.diagnostics?.forgeArtifact).toEqual(expect.objectContaining({
      available: true,
      rowCount: 1,
      playerSpecificCount: 1,
    }));
    expect(result.diagnostics?.forgeRosterMatching).toEqual(expect.objectContaining({
      rosterCanonicalIdsChecked: 1,
      rosterCanonicalIdsMatched: 0,
      playerSpecificRosterMatches: 0,
      generatedBaselineRosterMatches: 0,
      sampleMatchedCanonicalIds: [],
      sampleUnmatchedCanonicalIds: ['p1'],
    }));
  });

  it('adds promoted Rookie Alpha context when FORGE remains unavailable', async () => {
    const rookieAsset = {
      source: 'rookie_alpha_promoted_artifact' as const,
      playerName: 'Jeremiyah Love',
      position: 'RB',
      alphaRank: 1,
      positionRank: 'RB1',
      rookieAlphaScore: 83,
      talentScore: 91,
      consensusDelta: 4.2,
      interpretation: 'High-value rookie asset currently outside FORGE coverage.',
    };
    const result = await computeLeagueDashboard(
      { userId: 'u1', leagueId: 'league1', week: 1, season: 2026 },
      {
        storage: storageDeps as any,
        sleeperClient: { ...sleeperDeps, getLeague: jest.fn().mockResolvedValue({ season: 2026, week: 1 }) } as any,
        db: createDbMock({ identities: [{ sleeperId: 's1', canonicalId: 'p1', position: 'RB', fullName: 'Jeremiyah Love' }] }),
        forgeService: { getForgeScoresForPlayers: jest.fn().mockResolvedValue([]) } as any,
        rookieArtifactService: { getRookieAssetLookup: jest.fn().mockResolvedValue(new Map([['name:jeremiyahlove', rookieAsset]])) },
        forgePlayerStaticService: { getLookup: jest.fn().mockResolvedValue(forgeStaticLookup([])) } as any,
      }
    );

    expect(result.teams[0].roster[0]).toEqual(expect.objectContaining({
      alpha: null,
      rookieAsset,
      visibilityState: 'rookie_alpha_fallback',
      unavailableReason: 'missing_forge_row',
    }));
    expect(result.teams[0].overall_total).toBe(0);
    expect(result.diagnostics?.rookieAlphaMatchedCount).toBe(1);
    expect(result.diagnostics?.rosterVisibility).toEqual({
      total: 1,
      identityCovered: 1,
      baselineVisible: 0,
      forgeScored: 0,
      forgeBaseline: 0,
      generatedBaselineVisibility: 0,
      rookieAlphaFallback: 1,
      knownUnscored: 0,
      unresolved: 0,
      evidenceCovered: 1,
    });
  });


  it('fails Management roster output closed when FORGE_PLAYER_STATIC_V1 is unavailable', async () => {
    const result = await computeLeagueDashboard(
      { userId: 'u1', leagueId: 'league1', week: 1, season: 2024 },
      {
        storage: storageDeps as any,
        sleeperClient: sleeperDeps as any,
        db: createDbMock({ identities: [{ sleeperId: 's1', canonicalId: 'p1', position: 'WR', fullName: 'Player One' }] }),
        forgeService: { getForgeScoresForPlayers: jest.fn().mockResolvedValue([forgeScore]) } as any,
        forgePlayerStaticService: { getLookup: jest.fn().mockResolvedValue(forgeStaticLookup([], { available: false, state: 'missing', code: 'not_found', reason: 'missing artifact' })) } as any,
      }
    );

    expect(result.teams[0].overall_total).toBe(0);
    expect(result.teams[0].roster[0]).toEqual(expect.objectContaining({
      alpha: null,
      forgeScoreSource: null,
      missingReason: 'forge_artifact_unavailable',
      visibilityState: 'known_unscored',
      unavailableReason: 'forge_player_static_v1_unavailable',
    }));
    expect(result.diagnostics?.forgeArtifact).toEqual(expect.objectContaining({ available: false, state: 'missing' }));
    expect(result.diagnostics?.forgeRosterMatching).toEqual(expect.objectContaining({
      rosterCanonicalIdsChecked: 1,
      rosterCanonicalIdsMatched: 0,
      playerSpecificRosterMatches: 0,
      generatedBaselineRosterMatches: 0,
      sampleMatchedCanonicalIds: [],
      sampleUnmatchedCanonicalIds: ['p1'],
    }));
    expect(result.diagnostics?.playerSpecificForgeCoverageCount).toBe(0);
    expect(result.diagnostics?.generatedBaselineVisibilityCount).toBe(0);
  });

  it('defaults week to latest league week when not provided', async () => {
    const dbMock = createDbMock({
      identities: [{ sleeperId: 's1', canonicalId: 'p1', position: 'WR', fullName: 'Player One' }],
      forgeRows: [{ playerId: 'p1', alphaFinal: 55, alphaRaw: 55, season: 2024, week: 3, computedAt: new Date() }],
    });

    const storageMock = {
      ...storageDeps,
      getLeagueDashboardSnapshot: jest.fn().mockResolvedValue(null),
      saveLeagueDashboardSnapshot: jest.fn().mockResolvedValue(undefined),
    };

    const result = await computeLeagueDashboard(
      { userId: 'u1', leagueId: 'league1', season: 2024 },
      {
        storage: storageMock as any,
        sleeperClient: {
          ...sleeperDeps,
          getLeague: jest.fn().mockResolvedValue({ season: 2024, week: 3 }),
        } as any,
        db: dbMock,
        forgeService: { getForgeScoresForPlayers: jest.fn().mockResolvedValue([]) } as any,
        forgePlayerStaticService: { getLookup: jest.fn().mockResolvedValue(forgeStaticLookup([forgeStaticRow({ alpha: 55 })])) } as any,
      }
    );

    expect(result.meta.week).toBe(3);
    expect(storageMock.saveLeagueDashboardSnapshot).toHaveBeenCalled();
    const callArgs = (storageMock.saveLeagueDashboardSnapshot as jest.Mock).mock.calls[0][0];
    expect(callArgs.week).toBe(3);
  });
});
