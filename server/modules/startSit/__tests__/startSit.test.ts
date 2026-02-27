describe('buildStartSitPlayerProfile', () => {
  function createDbMock(selectResults: any[]) {
    const queue = [...selectResults];

    return {
      select: jest.fn(() => ({
        from: jest.fn(() => {
          const chain = {
            where: jest.fn(() => chain),
            orderBy: jest.fn(() => chain),
            limit: jest.fn(() => Promise.resolve(queue.shift() ?? [])),
          };

          return chain;
        }),
      })),
    } as any;
  }

  it('is called with correct playerId, week, and season parameters', async () => {
    const dbMock = createDbMock([
      [
        {
          playerId: 'test-player-001',
          playerName: 'Test Player',
          position: 'WR',
          team: 'KC',
        },
      ],
      [
        {
          epaPerPlay: 0.4,
          targetShare: 0.2,
        },
      ],
      [
        {
          team: 'BUF',
          passEpaAllowed: 0.05,
          rushEpaAllowed: -0.1,
          pressureRateGenerated: 0.2,
          week: 10,
        },
      ],
    ]);

    jest.resetModules();
    jest.doMock('../../../infra/db', () => ({ db: dbMock }));

    const { buildStartSitPlayerProfile } = await import('../dataAssembler');

    const result = await buildStartSitPlayerProfile('test-player-001', 10, 'BUF', 2024);

    expect(result).not.toBeNull();
    expect(result?.playerId).toBe('test-player-001');
    expect(result?.week).toBe(10);
    expect(result?.season).toBe(2024);
  });

  it('returns null when player is not found', async () => {
    const dbMock = createDbMock([[], [], []]);

    jest.resetModules();
    jest.doMock('../../../infra/db', () => ({ db: dbMock }));

    const { buildStartSitPlayerProfile } = await import('../dataAssembler');

    const result = await buildStartSitPlayerProfile('missing-player', 10, 'BUF', 2024);

    expect(result).toBeNull();
  });
});

describe('StartSitAgent', () => {
  function makeAssemblerProfile(overrides: Record<string, any> = {}) {
    return {
      playerId: 'test-player-001',
      playerName: 'Test Player',
      position: 'WR',
      team: 'KC',
      opponent: 'BUF',
      week: 10,
      season: 2024,
      dataAvailability: {
        epaMetrics: true,
        defenseContext: true,
        injuryStatus: false,
        usageMetrics: false,
      },
      playerInput: {
        id: 'test-player-001',
        name: 'Test Player',
        position: 'WR',
        team: 'KC',
        opponent: 'BUF',
        projPoints: 14,
        projFloor: 9,
        projCeiling: 19,
        targetShare: 24,
        snapPct: undefined,
        routeParticipation: undefined,
        weightedTouches: undefined,
        rzTouches: undefined,
        defRankVsPos: 18,
        oasisMatchupScore: 58,
        impliedTeamTotal: undefined,
        olHealthIndex: undefined,
        weatherImpact: undefined,
        stdevLast5: undefined,
        injuryTag: undefined,
        committeeRisk: undefined,
        depthChartThreats: undefined,
        newsHeat: undefined,
        ecrDelta: undefined,
      },
      ...overrides,
    };
  }

  async function loadAgentWithMocks(assemblerImpl: jest.Mock) {
    jest.resetModules();
    jest.doMock('../dataAssembler', () => ({
      buildStartSitPlayerProfile: assemblerImpl,
    }));

    return import('../startSitAgent');
  }

  it('returns a recommendation payload when profile is valid', async () => {
    const assemblerMock = jest.fn().mockResolvedValue(makeAssemblerProfile());
    const { startSitAgent } = await loadAgentWithMocks(assemblerMock);

    const result = await startSitAgent.analyze({ kind: 'single', playerId: 'p1', week: 10, season: 2024 });

    expect(result.kind).toBe('single');
    expect(result.verdict).toBeDefined();
  });

  it('recommendation contains a decision-style verdict field', async () => {
    const assemblerMock = jest.fn().mockResolvedValue(makeAssemblerProfile());
    const { startSitAgent } = await loadAgentWithMocks(assemblerMock);

    const result = await startSitAgent.analyze({ kind: 'single', playerId: 'p1', week: 10, season: 2024 });

    expect(['START', 'FLEX', 'SIT', 'BENCH']).toContain(result.verdict.verdict);
  });

  it('recommendation contains rationale strings', async () => {
    const assemblerMock = jest.fn().mockResolvedValue(makeAssemblerProfile());
    const { startSitAgent } = await loadAgentWithMocks(assemblerMock);

    const result = await startSitAgent.analyze({ kind: 'single', playerId: 'p1', week: 10, season: 2024 });

    expect(Array.isArray(result.verdict.rationale)).toBe(true);
    expect(result.verdict.rationale.length).toBeGreaterThan(0);
    expect(typeof result.verdict.rationale[0]).toBe('string');
  });

  it('calls buildStartSitPlayerProfile exactly once per analyze request', async () => {
    const assemblerMock = jest.fn().mockResolvedValue(makeAssemblerProfile());
    const { startSitAgent } = await loadAgentWithMocks(assemblerMock);

    await startSitAgent.analyze({ kind: 'single', playerId: 'p1', week: 10, season: 2024 });

    expect(assemblerMock).toHaveBeenCalledTimes(1);
    expect(assemblerMock).toHaveBeenCalledWith('p1', 10, 'TBD', 2024);
  });

  it('handles null profile by rejecting with player not found error', async () => {
    const assemblerMock = jest.fn().mockResolvedValue(null);
    const { startSitAgent } = await loadAgentWithMocks(assemblerMock);

    await expect(
      startSitAgent.analyze({ kind: 'single', playerId: 'missing', week: 10, season: 2024 })
    ).rejects.toThrow('Player not found: missing');
  });

  it('handles assembler rejection without swallowing the error', async () => {
    const assemblerMock = jest.fn().mockRejectedValue(new Error('timeout'));
    const { startSitAgent } = await loadAgentWithMocks(assemblerMock);

    await expect(
      startSitAgent.analyze({ kind: 'single', playerId: 'p1', week: 10, season: 2024 })
    ).rejects.toThrow('timeout');
  });

  it('recommendation verdict is never undefined when a profile exists', async () => {
    const assemblerMock = jest.fn().mockResolvedValue(makeAssemblerProfile({ playerInput: { ...makeAssemblerProfile().playerInput, projPoints: 6 } }));
    const { startSitAgent } = await loadAgentWithMocks(assemblerMock);

    const result = await startSitAgent.analyze({ kind: 'single', playerId: 'p1', week: 10, season: 2024 });

    expect(result.verdict.verdict).toBeDefined();
  });

  it('does not return verdicts for players whose profiles cannot be assembled in compare', async () => {
    const assemblerMock = jest
      .fn()
      .mockResolvedValueOnce(makeAssemblerProfile({ playerId: 'resolved-a', playerName: 'A' }))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(makeAssemblerProfile({ playerId: 'resolved-c', playerName: 'C' }));

    const { startSitAgent } = await loadAgentWithMocks(assemblerMock);

    const verdicts = await startSitAgent.compare({ playerIds: ['a', 'b', 'c'], week: 10, season: 2024 });

    expect(verdicts).toHaveLength(2);
    expect(verdicts.map((v) => v.playerId).sort()).toEqual(['a', 'c']);
  });
});
