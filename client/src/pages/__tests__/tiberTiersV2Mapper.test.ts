import { mapRankingsV2ItemsToTiersPlayers } from '../tiberTiersV2Mapper';

describe('mapRankingsV2ItemsToTiersPlayers', () => {
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
});
