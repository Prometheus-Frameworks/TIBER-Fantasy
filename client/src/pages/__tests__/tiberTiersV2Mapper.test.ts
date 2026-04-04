import { mapRankingsV2ItemsToTiersPlayers } from '../tiberTiersV2Mapper';

describe('mapRankingsV2ItemsToTiersPlayers', () => {
  it('uses structured uiMeta fields instead of explanation/trust text parsing', () => {
    const rows = mapRankingsV2ItemsToTiersPlayers([
      {
        rank: 1,
        playerId: '00-structured',
        playerName: 'Structured Player',
        position: 'WR',
        team: 'MIA',
        tier: 'T1',
        score: 88.4,
        value: 86.2,
        explanation: {
          pillarNotes: [
            { pillar: 'volume', note: '12.0' },
            { pillar: 'efficiency', note: '12.0' },
          ],
        },
        trust: {
          confidence: 10,
          sampleNote: 'Games played: 2.',
          stabilityNote: 'Trajectory: declining.',
        },
        uiMeta: {
          subscores: {
            volume: 90,
            efficiency: 84,
            teamContext: 80,
            stability: 78,
          },
          confidence: 91,
          gamesPlayed: 17,
          trajectory: 'rising',
          footballLensIssues: ['Small sample'],
          lensAdjustment: -1.5,
        },
      },
    ]);

    expect(rows[0]).toMatchObject({
      subscores: {
        volume: 90,
        efficiency: 84,
        teamContext: 80,
        stability: 78,
      },
      confidence: 91,
      gamesPlayed: 17,
      trajectory: 'rising',
      footballLensIssues: ['Small sample'],
      lensAdjustment: -1.5,
    });
  });

  it('maps nullable explanation/trust fields without crashing', () => {
    const rows = mapRankingsV2ItemsToTiersPlayers([
      {
        rank: 1,
        playerId: '00-nullable',
        playerName: 'Nullable Player',
        position: 'WR',
        team: 'BUF',
        tier: 'T2',
        score: 77.2,
        value: null,
        explanation: null,
        trust: null,
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      playerId: '00-nullable',
      playerName: 'Nullable Player',
      tier: 'T2',
      alpha: 77.2,
      confidence: null,
      gamesPlayed: null,
    });
    expect(rows[0].subscores).toEqual({
      volume: null,
      efficiency: null,
      teamContext: null,
      stability: null,
    });
  });

  it('degrades safely when uiMeta is missing or partial', () => {
    const rows = mapRankingsV2ItemsToTiersPlayers([
      {
        rank: 2,
        playerId: '00-partial',
        playerName: 'Partial Meta',
        position: 'RB',
        team: 'DET',
        tier: 'T3',
        score: 70.5,
        value: 69.1,
        trust: { confidence: 74 },
        uiMeta: {
          subscores: { volume: 77 },
        },
      },
    ]);

    expect(rows[0].subscores).toEqual({
      volume: 77,
      efficiency: null,
      teamContext: null,
      stability: null,
    });
    expect(rows[0].confidence).toBe(74);
    expect(rows[0].gamesPlayed).toBeNull();
    expect(rows[0].trajectory).toBeNull();
    expect(rows[0].footballLensIssues).toEqual([]);
    expect(rows[0].lensAdjustment).toBeNull();
  });
});
