import {
  mapRankingsV2ItemsToTiersPlayers,
  resolveRankingsSourceView,
  resolveTiersHeadline,
  resolveTiersViewState,
  validateRankingsV2WeeklyResponse,
} from '../tiberTiersV2Mapper';

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

describe('resolveRankingsSourceView', () => {
  it('labels Expected/VORP when the scoring service (promoted_artifact) produced the items', () => {
    const view = resolveRankingsSourceView([
      { layer: 'promoted_artifact' },
      { layer: 'confidence_stability' },
    ]);

    expect(view).toMatchObject({ layer: 'promoted_artifact', expectedLabel: 'Expected', valueLabel: 'VORP' });
  });

  it('does not label FORGE alpha as Expected/VORP when the forge cache fallback served the items', () => {
    const view = resolveRankingsSourceView([{ layer: 'forge' }, { layer: 'confidence_stability' }]);

    expect(view.layer).toBe('forge');
    expect(view.expectedLabel).not.toBe('Expected');
    expect(view.valueLabel).not.toBe('VORP');
    expect(view.expectedLabel).toBe('FORGE Alpha');
    expect(view.valueLabel).toBe('Raw Alpha');
    expect(view.sourceNote).toMatch(/unavailable/i);
  });

  it('falls back to a neutral label when sourceStack is missing or empty', () => {
    expect(resolveRankingsSourceView(undefined).layer).toBe('unknown');
    expect(resolveRankingsSourceView([]).layer).toBe('unknown');
  });
});

describe('resolveTiersHeadline', () => {
  it('does not assert "Canonical FORGE Alpha ranks" when the scoring service produced the rows', () => {
    expect(resolveTiersHeadline('promoted_artifact')).toBe('Weekly Forecast Rankings');
  });

  it('labels FORGE-sourced rankings distinctly', () => {
    expect(resolveTiersHeadline('forge')).toBe('Canonical FORGE Alpha ranks');
  });

  it('uses neutral copy before the source is known', () => {
    expect(resolveTiersHeadline('unknown')).toBe('Weekly Rankings');
  });
});

describe('resolveTiersViewState', () => {
  it('prioritizes loading over every other signal', () => {
    expect(
      resolveTiersViewState({ isLoading: true, isError: true, isCacheUncomputed: true, playersCount: 5 }),
    ).toBe('loading');
  });

  it('treats a failed request as an error, not a genuine empty result', () => {
    expect(
      resolveTiersViewState({ isLoading: false, isError: true, isCacheUncomputed: false, playersCount: 0 }),
    ).toBe('error');
  });

  it('reports an uncomputed FORGE cache as unavailable, distinct from a genuinely empty ranking', () => {
    expect(
      resolveTiersViewState({ isLoading: false, isError: false, isCacheUncomputed: true, playersCount: 0 }),
    ).toBe('unavailable');
  });

  it('reports zero players with no error/uncomputed signal as a genuinely empty result', () => {
    expect(
      resolveTiersViewState({ isLoading: false, isError: false, isCacheUncomputed: false, playersCount: 0 }),
    ).toBe('empty');
  });

  it('reports data once players are present and nothing else is wrong', () => {
    expect(
      resolveTiersViewState({ isLoading: false, isError: false, isCacheUncomputed: false, playersCount: 12 }),
    ).toBe('data');
  });
});

describe('validateRankingsV2WeeklyResponse', () => {
  const wellFormed = { asOf: '2026-04-12T00:00:00.000Z', sourceStack: [{ layer: 'forge' }], items: [] };

  const wellFormedItem = {
    rank: 1,
    playerId: '00-1',
    playerName: 'Justin Jefferson',
    position: 'WR',
    team: 'MIN',
    tier: 'T1',
    score: 20.1,
    value: 3.4,
    explanation: { placementSummary: 'Strong outlook.', pillarNotes: [{ pillar: 'volume', note: '12.0' }] },
  };

  it('accepts a well-formed response, including an explicit empty items array as a genuine result', () => {
    expect(validateRankingsV2WeeklyResponse(wellFormed)).toEqual(wellFormed);
  });

  it('accepts a well-formed item with valid nested explanation/pillarNotes', () => {
    const payload = { ...wellFormed, items: [wellFormedItem] };
    expect(validateRankingsV2WeeklyResponse(payload)).toEqual(payload);
  });

  it.each([
    ['a non-object payload', 'not-json'],
    ['null', null],
    ['an array instead of an object', []],
    ['missing items entirely', { ...wellFormed, items: undefined }],
    ['a null items value', { ...wellFormed, items: null }],
    ['a non-array items value', { ...wellFormed, items: 'garbage' }],
    ['missing sourceStack entirely', { ...wellFormed, sourceStack: undefined }],
    ['a non-array sourceStack value', { ...wellFormed, sourceStack: 'garbage' }],
    ['a missing asOf', { ...wellFormed, asOf: undefined }],
    ['an invalid asOf', { ...wellFormed, asOf: 'not-a-real-timestamp' }],
    // Matches the canonical z.string().datetime() contract exactly: permissive Date
    // coercion previously accepted all three of these non-contract timestamps.
    ['a bare-number asOf', { ...wellFormed, asOf: '1' }],
    ['a date-only asOf (no time component)', { ...wellFormed, asOf: '2026-04-12' }],
    ['a calendar-invalid asOf (February 30th does not exist)', { ...wellFormed, asOf: '2026-02-30' }],
    // Nested shapes the page actually dereferences/formats — a top-level-array-only check
    // would accept every one of these and let it crash further down the render tree.
    ['a null sourceStack entry', { ...wellFormed, sourceStack: [null] }],
    ['a non-object sourceStack entry', { ...wellFormed, sourceStack: ['garbage'] }],
    ['a sourceStack entry with an unsafe layer type', { ...wellFormed, sourceStack: [{ layer: 123 }] }],
    ['a non-object item', { ...wellFormed, items: [{}] }],
    ['an item with a null explanation', { ...wellFormed, items: [{ ...wellFormedItem, explanation: null }] }],
    ['an item missing explanation.pillarNotes', { ...wellFormed, items: [{ ...wellFormedItem, explanation: {} }] }],
    [
      'an item with a non-array explanation.pillarNotes',
      { ...wellFormed, items: [{ ...wellFormedItem, explanation: { pillarNotes: 'garbage' } }] },
    ],
    [
      'an item with a malformed pillar-note entry',
      { ...wellFormed, items: [{ ...wellFormedItem, explanation: { pillarNotes: [{ note: 'missing pillar field' }] } }] },
    ],
    ['an item with a non-numeric score', { ...wellFormed, items: [{ ...wellFormedItem, score: 'twenty' }] }],
    ['an item with a non-numeric value', { ...wellFormed, items: [{ ...wellFormedItem, value: {} }] }],
    ['an item with a wrong-typed playerId', { ...wellFormed, items: [{ ...wellFormedItem, playerId: 12345 }] }],
    ['an item missing playerName', { ...wellFormed, items: [{ ...wellFormedItem, playerName: undefined }] }],
  ])('throws for %s — a 2xx body must not silently become a genuine empty result', (_label, payload) => {
    expect(() => validateRankingsV2WeeklyResponse(payload)).toThrow();
  });
});
