import {
  buildRankingRowKey,
  EXACT_WEEK_UNAVAILABLE_STATUS,
  SEASON_CONFIG_STALE_STATUS,
  getLinkablePlayerId,
  isExactWeekUnavailable,
  isCalendarUnavailable,
  mapRankingsV2ItemsToTiersPlayers,
  RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
  resolveRankingsSourceView,
  resolveRequestedSeason,
  resolveTiersHeadline,
  resolveTiersViewState,
  TIERS_EXACT_WEEK_UNAVAILABLE_MESSAGE,
  TIERS_STALE_CALENDAR_MESSAGE,
  TIERS_SEASON_METADATA_UNAVAILABLE_MESSAGE,
  validateRankingsV2WeeklyResponse,
} from '../tiberTiersV2Mapper';

const CANONICAL_IDENTITY = {
  status: 'canonical' as const,
  canonicalId: 'structured-player',
  sourceId: 'structured-player',
  sourceType: 'canonical' as const,
  reason: null,
  linkable: true as const,
};

describe('mapRankingsV2ItemsToTiersPlayers', () => {
  it('uses structured uiMeta fields instead of explanation/trust text parsing', () => {
    const rows = mapRankingsV2ItemsToTiersPlayers([
      {
        identity: CANONICAL_IDENTITY,
        rank: 1,
        playerId: 'structured-player',
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
        identity: { ...CANONICAL_IDENTITY, canonicalId: 'nullable-player', sourceId: 'nullable-player' },
        rank: 1,
        playerId: 'nullable-player',
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
      playerId: 'nullable-player',
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
        identity: { ...CANONICAL_IDENTITY, canonicalId: 'partial-player', sourceId: 'partial-player' },
        rank: 2,
        playerId: 'partial-player',
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
      resolveTiersViewState({
        isLoading: true,
        isError: true,
        isCalendarStale: true,
        isCacheUncomputed: true,
        playersCount: 5,
      }),
    ).toBe('loading');
  });

  it('treats a failed request as an error, not a genuine empty result', () => {
    expect(
      resolveTiersViewState({
        isLoading: false,
        isError: true,
        isCalendarStale: true,
        isCacheUncomputed: false,
        playersCount: 0,
      }),
    ).toBe('error');
  });

  it('reports a stale season calendar as its own unavailable state before cache/empty signals', () => {
    expect(
      resolveTiersViewState({
        isLoading: false,
        isError: false,
        isCalendarStale: true,
        isCacheUncomputed: true,
        playersCount: 0,
      }),
    ).toBe('calendar_unavailable');
  });

  it('reports an unanswerable exact week before the cache/empty signals', () => {
    // The regression: with zero items and no other signal this fell through to
    // `empty`, so a fail-closed response rendered as "no players match this
    // filter". It has to win over both remaining states.
    expect(
      resolveTiersViewState({
        isLoading: false,
        isError: false,
        isCalendarStale: false,
        isExactWeekUnavailable: true,
        isCacheUncomputed: true,
        playersCount: 0,
      }),
    ).toBe('exact_week_unavailable');
  });

  it('keeps loading, error and stale-calendar ahead of the exact-week state', () => {
    const base = {
      isCalendarStale: false,
      isExactWeekUnavailable: true,
      isCacheUncomputed: false,
      playersCount: 0,
    };
    expect(resolveTiersViewState({ ...base, isLoading: true, isError: false })).toBe('loading');
    expect(resolveTiersViewState({ ...base, isLoading: false, isError: true })).toBe('error');
    expect(resolveTiersViewState({ ...base, isLoading: false, isError: false, isCalendarStale: true }))
      .toBe('calendar_unavailable');
  });

  it('reads the signal off the server status, and only that status', () => {
    expect(isExactWeekUnavailable({ status: EXACT_WEEK_UNAVAILABLE_STATUS })).toBe(true);
    expect(isExactWeekUnavailable({ status: 'forge_cache_empty_uncomputed' })).toBe(false);
    expect(isExactWeekUnavailable({ status: 'archive_season_not_current' })).toBe(false);
    expect(isExactWeekUnavailable({ status: null })).toBe(false);
    expect(isExactWeekUnavailable(null)).toBe(false);
    expect(isExactWeekUnavailable(undefined)).toBe(false);
  });

  it('gives the exact-week state copy distinct from the empty and uncomputed copy', () => {
    // Three different situations must not share one sentence: "nothing
    // matched", "not computed yet", and "could not be produced" are different
    // claims, and only the last is true here.
    expect(TIERS_EXACT_WEEK_UNAVAILABLE_MESSAGE).not.toBe(TIERS_STALE_CALENDAR_MESSAGE);
    expect(TIERS_EXACT_WEEK_UNAVAILABLE_MESSAGE).toMatch(/requested week is unavailable/i);
    expect(TIERS_EXACT_WEEK_UNAVAILABLE_MESSAGE).toMatch(/does not substitute/i);
    // And it must not imply the answer is simply "none" or "soon".
    expect(TIERS_EXACT_WEEK_UNAVAILABLE_MESSAGE).not.toMatch(/no players match/i);
    expect(TIERS_EXACT_WEEK_UNAVAILABLE_MESSAGE).not.toMatch(/have not been computed yet/i);
  });

  it('reports an uncomputed FORGE cache as unavailable, distinct from a genuinely empty ranking', () => {
    expect(
      resolveTiersViewState({
        isLoading: false,
        isError: false,
        isCalendarStale: false,
        isCacheUncomputed: true,
        playersCount: 0,
      }),
    ).toBe('unavailable');
  });

  it('reports zero players with no error/uncomputed signal as a genuinely empty result', () => {
    expect(
      resolveTiersViewState({
        isLoading: false,
        isError: false,
        isCalendarStale: false,
        isCacheUncomputed: false,
        playersCount: 0,
      }),
    ).toBe('empty');
  });

  it('reports data once players are present and nothing else is wrong', () => {
    expect(
      resolveTiersViewState({
        isLoading: false,
        isError: false,
        isCalendarStale: false,
        isCacheUncomputed: false,
        playersCount: 12,
      }),
    ).toBe('data');
  });

  it('reports season-metadata-unavailable ahead of every other signal but loading/error', () => {
    // Every other signal (calendar staleness, exact-week, cache-uncomputed,
    // empty, data) is itself read FROM seasonMeta, so none of them can be
    // evaluated honestly once it is absent.
    const base = {
      isLoading: false,
      isError: false,
      isMetadataUnavailable: true,
      isCalendarStale: true,
      isExactWeekUnavailable: true,
      isCacheUncomputed: true,
      playersCount: 12,
    };
    expect(resolveTiersViewState(base)).toBe('season_metadata_unavailable');
    expect(resolveTiersViewState({ ...base, isLoading: true })).toBe('loading');
    expect(resolveTiersViewState({ ...base, isError: true })).toBe('error');
  });

  it('the stale-calendar-unavailable signal is read off the typed status, never off configStatus alone', () => {
    // A successfully served configured archive still carries
    // `configStatus: 'stale_calendar_config'` — gating on that alone hid its
    // admitted rows behind the calendar-unavailable panel.
    expect(isCalendarUnavailable({ status: SEASON_CONFIG_STALE_STATUS })).toBe(true);
    expect(isCalendarUnavailable({ status: 'archive_season_not_current' })).toBe(false);
    expect(isCalendarUnavailable({ status: null })).toBe(false);
    expect(isCalendarUnavailable(null)).toBe(false);
    expect(isCalendarUnavailable(undefined)).toBe(false);
  });
});

describe('resolveRequestedSeason', () => {
  const CONFIGURED = [2025, 2026];

  it('an explicit configured selection wins, live calendar ok', () => {
    expect(
      resolveRequestedSeason({ selectedSeason: 2025, configuredSeasons: CONFIGURED, configStatus: 'ok', detectedSeason: 2026 }),
    ).toBe(2025);
  });

  it('an explicit configured selection wins even while the live calendar is stale', () => {
    expect(
      resolveRequestedSeason({
        selectedSeason: 2025,
        configuredSeasons: CONFIGURED,
        configStatus: 'stale_calendar_config',
        detectedSeason: null,
      }),
    ).toBe(2025);
  });

  it('a stale calendar with no explicit selection keeps season null and fails closed', () => {
    expect(
      resolveRequestedSeason({
        selectedSeason: null,
        configuredSeasons: CONFIGURED,
        configStatus: 'stale_calendar_config',
        detectedSeason: null,
      }),
    ).toBeNull();
  });

  it('with no explicit selection and an ok calendar, the detected season is used', () => {
    expect(
      resolveRequestedSeason({ selectedSeason: null, configuredSeasons: CONFIGURED, configStatus: 'ok', detectedSeason: 2026 }),
    ).toBe(2026);
  });

  it('an unconfigured retained selection never becomes the request — it falls through instead of bypassing', () => {
    // Live calendar ok: falls through to the detected season, not the stale
    // retained value.
    expect(
      resolveRequestedSeason({ selectedSeason: 2024, configuredSeasons: CONFIGURED, configStatus: 'ok', detectedSeason: 2026 }),
    ).toBe(2026);
    // Live calendar stale: falls through to null (fail closed), not the
    // unconfigured retained value either.
    expect(
      resolveRequestedSeason({
        selectedSeason: 2024,
        configuredSeasons: CONFIGURED,
        configStatus: 'stale_calendar_config',
        detectedSeason: null,
      }),
    ).toBeNull();
  });

  it('an explicit empty configured-season list never lets any selection through', () => {
    // A REAL fact — the server explicitly reported zero configured seasons —
    // distinct from `undefined` (never reported at all), tested below.
    expect(
      resolveRequestedSeason({ selectedSeason: 2025, configuredSeasons: [], configStatus: 'ok', detectedSeason: 2026 }),
    ).toBe(2026);
  });

  describe('configuredSeasons: undefined — no explicit list has ever been seen (Fantasy #307 correction round 5)', () => {
    it('a direct legacy mount invents no season: falls through exactly like an unconfigured selection', () => {
      expect(
        resolveRequestedSeason({ selectedSeason: null, configuredSeasons: undefined, configStatus: 'ok', detectedSeason: 2026 }),
      ).toBe(2026);
      expect(
        resolveRequestedSeason({
          selectedSeason: null,
          configuredSeasons: undefined,
          configStatus: 'stale_calendar_config',
          detectedSeason: null,
        }),
      ).toBeNull();
    });

    it('an unvalidatable selection never survives, even one that would be valid against a list never actually seen', () => {
      // `undefined` must not behave like "checked and matched" for any
      // selectedSeason — there is nothing to check it against.
      expect(
        resolveRequestedSeason({ selectedSeason: 2025, configuredSeasons: undefined, configStatus: 'ok', detectedSeason: 2026 }),
      ).toBe(2026);
      expect(
        resolveRequestedSeason({
          selectedSeason: 2025,
          configuredSeasons: undefined,
          configStatus: 'stale_calendar_config',
          detectedSeason: null,
        }),
      ).toBeNull();
    });

    it('is NOT equivalent to an explicit empty list for a null selection under a stale calendar', () => {
      // Both currently return null here (no selection to validate either
      // way), but the two inputs mean different things upstream — the
      // container must retain `undefined` rather than ever coalescing it to
      // `[]`, which this pins by keeping the assertion but documenting why
      // it is not a proof of equivalence.
      const withUndefined = resolveRequestedSeason({
        selectedSeason: null, configuredSeasons: undefined, configStatus: 'stale_calendar_config', detectedSeason: null,
      });
      const withEmpty = resolveRequestedSeason({
        selectedSeason: null, configuredSeasons: [], configStatus: 'stale_calendar_config', detectedSeason: null,
      });
      expect(withUndefined).toBeNull();
      expect(withEmpty).toBeNull();
    });
  });
});

describe('TIERS_SEASON_METADATA_UNAVAILABLE_MESSAGE', () => {
  it('is distinct compatibility copy, not the stale-calendar or exact-week text', () => {
    expect(TIERS_SEASON_METADATA_UNAVAILABLE_MESSAGE).not.toBe(TIERS_STALE_CALENDAR_MESSAGE);
    expect(TIERS_SEASON_METADATA_UNAVAILABLE_MESSAGE).not.toBe(TIERS_EXACT_WEEK_UNAVAILABLE_MESSAGE);
    expect(TIERS_SEASON_METADATA_UNAVAILABLE_MESSAGE).toMatch(/older server/i);
  });
});

describe('validateRankingsV2WeeklyResponse', () => {
  const SEASON_META = {
  currentSeason: 2026,
  forwardRankingSeason: 2026,
  currentPhase: 'preseason' as const,
  currentPhaseLabel: '2026 · Preseason',
  currentRegularSeasonWeek: null,
  targetSeason: 2026,
  targetWeek: 1,
  targetLabel: 'Target: Week 1',
  scheduleSource: 'anchor_derived' as const,
  configStatus: 'ok' as const,
  configNote: null,
  evidenceSeason: 2025,
  evidenceWeek: 18,
  decisionTargetSeason: 2026,
  decisionTargetWeek: 1,
  decisionTargetProvenance: 'anchor_derived' as const,
  decisionTargetIsProvisional: true,
  phaseTargetSeason: 2025,
  phaseTargetWeek: 12,
  phaseTargetProvenance: 'anchor_derived',
  phaseTargetIsProvisional: true,
  evidenceThroughSeason: 2025,
  evidenceThroughWeek: 18,
  evidenceProvenance: 'source_declared_as_of',
  completionVerified: false,
  finalizedThroughWeek: null,
  completionCopy: 'Completion not verified.',
  generatedAt: '2026-08-08T19:04:15.325Z',
  isArchiveView: true,
  status: 'archive_season_not_current',
  statusDetail: 'Showing 2025 evidence while the league is in 2026 · Preseason.',
};

  const wellFormed = {
    contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
    asOf: '2026-04-12T00:00:00.000Z',
    sourceStack: [{ layer: 'forge' }],
    items: [],
    seasonMeta: SEASON_META,
  };

  const IDENTITY = {
    status: 'resolved' as const,
    canonicalId: 'tiber-amon-ra-st-brown',
    sourceId: '00-0036963',
    sourceType: 'gsis' as const,
    reason: null,
    linkable: true,
  };

  const wellFormedItem = {
    identity: IDENTITY,
    rank: 1,
    playerId: 'tiber-amon-ra-st-brown',
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

  describe('rolling compatibility: seasonMeta absence vs. a present-but-invalid value', () => {
    // Fantasy #307 correction round 4: a same-contract-version server that
    // predates Phase A never sends `seasonMeta` at all. That is accepted —
    // the legacy signal — but a response that TRIED to carry it and sent
    // `null` or something malformed must still fail exactly as before.
    it('accepts a response with seasonMeta entirely absent (the key omitted)', () => {
      const { seasonMeta, ...withoutSeasonMeta } = wellFormed;
      void seasonMeta;
      const result = validateRankingsV2WeeklyResponse(withoutSeasonMeta);
      expect(result.seasonMeta).toBeUndefined();
      expect(result.items).toEqual([]);
      expect(result.contractVersion).toBe(RANKINGS_V2_EXPECTED_CONTRACT_VERSION);
    });

    it('accepts a response with seasonMeta present but set to undefined (equivalent to absence)', () => {
      const result = validateRankingsV2WeeklyResponse({ ...wellFormed, seasonMeta: undefined });
      expect(result.seasonMeta).toBeUndefined();
    });

    it('still rejects an explicit null seasonMeta — absence, not null, is the compatibility signal', () => {
      expect(() => validateRankingsV2WeeklyResponse({ ...wellFormed, seasonMeta: null })).toThrow();
    });

    it('still rejects a malformed present seasonMeta', () => {
      expect(() =>
        validateRankingsV2WeeklyResponse({ ...wellFormed, seasonMeta: { ...SEASON_META, currentPhase: 'bye_week' } }),
      ).toThrow();
      expect(() =>
        validateRankingsV2WeeklyResponse({ ...wellFormed, seasonMeta: { ...SEASON_META, generatedAt: 'yesterday' } }),
      ).toThrow();
    });

    it('the no_rankable_source/sourceStack refinement does not fire when seasonMeta is absent', () => {
      // The response-level check reads `response.seasonMeta?.evidenceProvenance`;
      // with no seasonMeta there is no provenance to contradict a nonempty
      // sourceStack, so a legacy payload with a real sourceStack still passes.
      const { seasonMeta, ...withoutSeasonMeta } = wellFormed;
      void seasonMeta;
      const payload = { ...withoutSeasonMeta, sourceStack: [{ layer: 'forge' }] };
      expect(() => validateRankingsV2WeeklyResponse(payload)).not.toThrow();
    });

    it('current (non-legacy) payload rendering/validation is unchanged', () => {
      expect(validateRankingsV2WeeklyResponse(wellFormed)).toEqual(wellFormed);
      expect(validateRankingsV2WeeklyResponse(wellFormed).seasonMeta).toEqual(SEASON_META);
    });
  });

  it.each([
    ['a non-object payload', 'not-json'],
    ['null', null],
    ['an array instead of an object', []],
    ['a null seasonMeta', { ...wellFormed, seasonMeta: null }],
    ['a seasonMeta with an unknown phase', { ...wellFormed, seasonMeta: { ...SEASON_META, currentPhase: 'bye_week' } }],
    ['a seasonMeta with a non-ISO generatedAt', { ...wellFormed, seasonMeta: { ...SEASON_META, generatedAt: 'yesterday' } }],
    ['an item missing identity', { ...wellFormed, items: [{ ...wellFormedItem, identity: undefined }] }],
    ['an item whose identity omits linkable', { ...wellFormed, items: [{ ...wellFormedItem, identity: { ...IDENTITY, linkable: undefined } }] }],
    ['the previous public contract revision', { ...wellFormed, contractVersion: 'v2-scaffold-2026-04-02' }],
    ['a missing contract version', { ...wellFormed, contractVersion: undefined }],
    ['a linkable identity with a mismatched playerId', { ...wellFormed, items: [{ ...wellFormedItem, playerId: 'someone-else' }] }],
    ['a linkable identity with a null playerId', { ...wellFormed, items: [{ ...wellFormedItem, playerId: null }] }],
    [
      'a resolved identity carrying an unresolved reason',
      {
        ...wellFormed,
        items: [{
          ...wellFormedItem,
          identity: { ...IDENTITY, reason: 'gsis_ambiguous_duplicate_crosswalk_rows' },
        }],
      },
    ],
    [
      'a canonical identity whose sourceId differs from canonicalId',
      {
        ...wellFormed,
        items: [{
          ...wellFormedItem,
          playerId: 'canonical-player',
          identity: {
            status: 'canonical',
            canonicalId: 'canonical-player',
            sourceId: 'different-source',
            sourceType: 'canonical',
            reason: null,
            linkable: true,
          },
        }],
      },
    ],
    [
      'two rows with the same rank',
      {
        ...wellFormed,
        items: [wellFormedItem, { ...wellFormedItem, playerName: 'Different Player' }],
      },
    ],
    [
      'an unresolved identity with a non-null playerId',
      {
        ...wellFormed,
        items: [{
          ...wellFormedItem,
          playerId: 'someone-else',
          identity: {
            status: 'unresolved',
            canonicalId: null,
            sourceId: '00-0099999',
            sourceType: 'gsis',
            reason: 'gsis_not_in_identity_map',
            linkable: false,
          },
        }],
      },
    ],
    [
      'an unresolved identity that claims linkable true',
      {
        ...wellFormed,
        items: [{
          ...wellFormedItem,
          playerId: null,
          identity: {
            status: 'unresolved',
            canonicalId: null,
            sourceId: '00-0099999',
            sourceType: 'gsis',
            reason: 'gsis_not_in_identity_map',
            linkable: true,
          },
        }],
      },
    ],
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

describe('identity-safe rendering helpers', () => {
  const coherent = {
    rank: 1,
    position: 'WR',
    playerId: 'tiber-amon-ra-st-brown',
    identity: {
      status: 'resolved' as const,
      canonicalId: 'tiber-amon-ra-st-brown',
      sourceId: '00-0036963',
      sourceType: 'gsis' as const,
      reason: null,
      linkable: true as const,
    },
  };

  it('returns a link only for the same non-null canonical key', () => {
    expect(getLinkablePlayerId(coherent)).toBe('tiber-amon-ra-st-brown');
    expect(getLinkablePlayerId({ ...coherent, playerId: null })).toBeNull();
    expect(getLinkablePlayerId({ ...coherent, playerId: 'different-player' })).toBeNull();
  });

  it('uses a composite row key when the producer repeats a source id', () => {
    expect(buildRankingRowKey(coherent)).not.toBe(buildRankingRowKey({ ...coherent, rank: 2 }));
    expect(buildRankingRowKey(coherent)).toContain('00-0036963');
    expect(buildRankingRowKey(coherent)).toContain('WR');
  });
});
