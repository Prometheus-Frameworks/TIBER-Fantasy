/**
 * Renders the actual `/tiers` presentational component (TiberTiersView — the exact JSX
 * TiberTiers delegates to; see TiberTiers.tsx) via `react-dom/server`'s
 * `renderToStaticMarkup`. This needs no jsdom, no @testing-library, and no new
 * dependencies — react-dom is already a project dependency, and static-markup rendering
 * runs entirely in Node (no `document`/`window` required), matching this repo's existing
 * `testEnvironment: 'node'` Jest config. A previous review correctly noted that
 * mapper-only tests do not prove the page's actual rendered output; this file renders the
 * production component tree directly, unlike tiberTiersV2Mapper.test.ts's pure-function
 * coverage.
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TiberTiersView, TiberTiersViewProps, TiersApiResponse } from '../TiberTiers';
import {
  RankingsV2Item,
  RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
  validateRankingsV2WeeklyResponse,
} from '../tiberTiersV2Mapper';

const IDENTITY = {
  status: 'resolved' as const,
  canonicalId: 'tiber-amon-ra-st-brown',
  sourceId: '00-0036963',
  sourceType: 'gsis' as const,
  reason: null,
  linkable: true,
};

function makeItem(overrides: Partial<RankingsV2Item> = {}): RankingsV2Item {
  return {
    identity: IDENTITY,
    rank: 1,
    playerId: 'tiber-amon-ra-st-brown',
    playerName: 'Justin Jefferson',
    position: 'WR',
    team: 'MIN',
    tier: 'T1',
    score: 20.1,
    value: 3.4,
    explanation: { placementSummary: 'Strong WR1 outlook.', pillarNotes: [] },
    trust: { confidence: null, sampleNote: null, stabilityNote: null },
    uiMeta: { subscores: {}, confidence: null, gamesPlayed: null, trajectory: null, footballLensIssues: null, lensAdjustment: null },
    ...overrides,
  } as RankingsV2Item;
}

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

function baseProps(overrides: Partial<TiberTiersViewProps> = {}): TiberTiersViewProps {
  return {
    season: 2025,
    asOfWeek: 5,
    availableSeasons: [2025, 2026],
    onSeasonChange: () => {},
    position: 'WR',
    onPositionChange: () => {},
    sortDirection: 'desc',
    onToggleSortDirection: () => {},
    data: undefined,
    isLoading: false,
    isError: false,
    isFetching: false,
    onRefetch: () => {},
    ...overrides,
  };
}

function render(props: TiberTiersViewProps): string {
  return renderToStaticMarkup(React.createElement(TiberTiersView, props));
}

describe('TiberTiersView rendered output', () => {
  it('renders neutral loading copy and suppresses the player-count/source metadata line', () => {
    const html = render(baseProps({ isLoading: true }));

    expect(html).toContain('Loading rankings...');
    expect(html).not.toContain('Loading FORGE tiers');
    expect(html).not.toMatch(/\d+ players/);
    expect(html).not.toContain('Source:');
    expect(html).not.toContain('Unable to load rankings');
  });

  it('renders a generic, user-safe error state and suppresses metadata — not the genuinely-empty message', () => {
    const html = render(baseProps({ isError: true }));

    expect(html).toContain('Unable to load rankings');
    expect(html).toContain('This is an error, not an empty result');
    expect(html).not.toContain('No players match this filter yet.');
    expect(html).not.toMatch(/\d+ players/);
    expect(html).not.toContain('Source:');
    // The error panel must never echo a raw backend/exception message.
    expect(html).not.toContain('Failed to fetch weekly rankings');
  });

  it('renders the uncomputed-cache state without any operator/admin mutation instruction', () => {
    const data: TiersApiResponse = {
      contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
      asOf: '2026-04-12T00:00:00.000Z',
      seasonMeta: SEASON_META,
      sourceStack: [{ layer: 'forge' }],
      trust: { sampleNote: 'FORGE grades for this filter have not been computed yet. Please check back shortly.', stabilityNote: 'forge_cache_empty_uncomputed' },
      items: [],
    };

    const html = render(baseProps({ data }));

    expect(html).toContain('Rankings are not available yet');
    expect(html).not.toContain('POST /api/forge/compute-grades');
    expect(html).not.toContain('compute-grades');
    expect(html).not.toMatch(/\d+ players/);
    expect(html).not.toContain('Source:');
  });

  it('renders no evidence-season claim, no archive banner, and no FORGE headline for a no_rankable_source empty-cache response', () => {
    // The complete no_rankable_source invariant, as the UI actually receives
    // it post-fix: null evidence fields, isArchiveView false, empty
    // sourceStack. Neither path that can produce this state may render text
    // implying evidence exists.
    const noRankableSourceMeta = {
      ...SEASON_META,
      evidenceSeason: null,
      evidenceWeek: null,
      evidenceThroughSeason: null,
      evidenceThroughWeek: null,
      evidenceProvenance: 'no_rankable_source' as const,
      generatedAt: null,
      isArchiveView: false,
      status: 'forge_cache_empty_uncomputed',
      statusDetail: 'FORGE grades for this filter have not been computed yet.',
    };
    const data: TiersApiResponse = {
      contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
      asOf: '2026-04-12T00:00:00.000Z',
      seasonMeta: noRankableSourceMeta,
      sourceStack: [],
      trust: { sampleNote: 'FORGE grades for this filter have not been computed yet. Please check back shortly.', stabilityNote: 'forge_cache_empty_uncomputed' },
      items: [],
    };

    const html = render(baseProps({ data }));

    expect(html).not.toMatch(/\d{4} evidence/);
    expect(html).not.toContain('extent not stated');
    expect(html).not.toContain('Archive:');
    expect(html).not.toContain('data-testid="tiers-archive-notice"');
    expect(html).not.toContain('Canonical FORGE Alpha ranks');
    expect(html).toContain('No ranking evidence available.');
  });

  it('renders no evidence-season claim, no archive banner, and no FORGE headline for a no_rankable_source exact-week-unavailable response', () => {
    const noRankableSourceMeta = {
      ...SEASON_META,
      evidenceSeason: null,
      evidenceWeek: null,
      evidenceThroughSeason: null,
      evidenceThroughWeek: null,
      evidenceProvenance: 'no_rankable_source' as const,
      generatedAt: null,
      isArchiveView: false,
      status: 'exact_week_evidence_unavailable',
      statusDetail: 'Rankings for the requested week 7 are unavailable; the exact week was not substituted.',
    };
    const data: TiersApiResponse = {
      contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
      asOf: '2026-04-12T00:00:00.000Z',
      seasonMeta: noRankableSourceMeta,
      sourceStack: [],
      trust: { sampleNote: null, stabilityNote: null },
      items: [],
    };

    const html = render(baseProps({ data }));

    expect(html).toContain('data-testid="tiers-exact-week-unavailable"');
    expect(html).not.toMatch(/\d{4} evidence/);
    expect(html).not.toContain('extent not stated');
    expect(html).not.toContain('Archive:');
    expect(html).not.toContain('data-testid="tiers-archive-notice"');
    expect(html).not.toContain('Canonical FORGE Alpha ranks');
    expect(html).toContain('No ranking evidence available.');
  });

  it('renders the genuine-empty state distinctly, with metadata visible', () => {
    const data: TiersApiResponse = {
      contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
      asOf: '2026-04-12T00:00:00.000Z',
      seasonMeta: SEASON_META,
      sourceStack: [{ layer: 'forge' }],
      trust: { sampleNote: null, stabilityNote: null },
      items: [],
    };

    const html = render(baseProps({ data }));

    expect(html).toContain('No players match this filter yet.');
    expect(html).toContain('0 players');
    expect(html).toContain('Source:');
  });

  it('labels Expected/VORP and a Forecast headline when the scoring service produced the rows', () => {
    const data: TiersApiResponse = {
      contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
      asOf: '2026-04-12T00:00:00.000Z',
      seasonMeta: SEASON_META,
      sourceStack: [{ layer: 'promoted_artifact' }],
      trust: { sampleNote: null, stabilityNote: null },
      items: [makeItem()],
    };

    const html = render(baseProps({ data }));

    expect(html).toContain('Weekly Forecast Rankings');
    expect(html).toContain('Expected');
    expect(html).toContain('VORP');
    expect(html).toContain('Justin Jefferson');
    expect(html).toContain('20.1');
    expect(html).not.toContain('FORGE Alpha');
  });

  it('labels FORGE Alpha/Raw Alpha and a FORGE headline when the cache fallback produced the rows', () => {
    const data: TiersApiResponse = {
      contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
      asOf: '2026-04-12T00:00:00.000Z',
      seasonMeta: SEASON_META,
      sourceStack: [{ layer: 'forge' }],
      trust: { sampleNote: null, stabilityNote: null },
      items: [makeItem()],
    };

    const html = render(baseProps({ data }));

    expect(html).toContain('Canonical FORGE Alpha ranks');
    expect(html).toContain('FORGE Alpha');
    expect(html).toContain('Raw Alpha');
    expect(html).not.toContain('>Expected<');
    expect(html).not.toContain('>VORP<');
  });

  it('renders the league phase and the forward target as separate facts (Fantasy #307)', () => {
    const data: TiersApiResponse = {
      asOf: '2026-08-08T19:04:15.325Z',
      seasonMeta: SEASON_META,
      sourceStack: [{ layer: 'forge' }],
      trust: { sampleNote: null, stabilityNote: null },
      items: [makeItem()],
    };

    const html = render(baseProps({ data }));

    expect(html).toContain('2026 · Preseason');
    expect(html).toContain('Target: Week 1');
    // The old headline collapsed everything into "(2025, through week 18)".
    expect(html).not.toContain('through week 18)');
  });

  it('shows an archive notice when the rows are not from the current season', () => {
    const data: TiersApiResponse = {
      asOf: '2026-08-08T19:04:15.325Z',
      seasonMeta: SEASON_META,
      sourceStack: [{ layer: 'forge' }],
      trust: { sampleNote: null, stabilityNote: null },
      items: [makeItem()],
    };

    const html = render(baseProps({ data }));

    expect(html).toContain('tiers-archive-notice');
    expect(html).toContain('Showing 2025 evidence while the league is in 2026 · Preseason.');
  });

  it('separates computation time from evidence scope in the metadata line', () => {
    const data: TiersApiResponse = {
      asOf: '2026-08-08T19:04:15.325Z',
      seasonMeta: SEASON_META,
      sourceStack: [{ layer: 'forge' }],
      trust: { sampleNote: null, stabilityNote: null },
      items: [makeItem()],
    };

    const html = render(baseProps({ data }));

    expect(html).toContain('Computed');
    expect(html).toContain('Archive: 2025 evidence, through week 18');
  });

  it('renders an explicit season control', () => {
    const data: TiersApiResponse = {
      asOf: '2026-08-08T19:04:15.325Z',
      seasonMeta: SEASON_META,
      sourceStack: [{ layer: 'forge' }],
      trust: { sampleNote: null, stabilityNote: null },
      items: [makeItem()],
    };

    const html = render(baseProps({ data, season: 2025, availableSeasons: [2025, 2026] }));

    expect(html).toContain('tiers-season-control');
    expect(html).toContain('season-2025');
    expect(html).toContain('season-2026');
    // The non-current season is marked as an archive in the control itself.
    expect(html).toContain('2025 · archive');
  });

  it('marks archive options against the forward board season during the postseason', () => {
    const postseasonMeta = {
      ...SEASON_META,
      currentSeason: 2025,
      forwardRankingSeason: 2026,
      currentPhase: 'postseason' as const,
      currentPhaseLabel: '2025 · Postseason',
      targetSeason: 2026,
      evidenceSeason: 2026,
      evidenceWeek: 1,
      decisionTargetSeason: 2026,
      decisionTargetWeek: 1,
      decisionTargetProvenance: 'anchor_derived' as const,
      decisionTargetIsProvisional: true,
      phaseTargetSeason: 2025,
      phaseTargetWeek: 12,
      phaseTargetProvenance: 'anchor_derived',
      phaseTargetIsProvisional: true,
      evidenceThroughSeason: 2025,
      evidenceThroughWeek: 1,
      evidenceProvenance: 'source_declared_as_of',
      completionVerified: false,
      finalizedThroughWeek: null,
      completionCopy: 'Completion not verified.',
      isArchiveView: false,
      status: null,
      statusDetail: null,
    };
    const data: TiersApiResponse = {
      asOf: '2026-01-20T00:00:00.000Z',
      seasonMeta: postseasonMeta,
      sourceStack: [{ layer: 'forge' }],
      trust: { sampleNote: null, stabilityNote: null },
      items: [makeItem()],
    };

    const html = render(baseProps({ data, season: 2026, availableSeasons: [2025, 2026] }));

    expect(html).toContain('2025 · archive');
    expect(html).not.toContain('2026 · archive');
  });

  it('renders a stale calendar as calendar-specific unavailable, never empty or FORGE-uncomputed', () => {
    const staleMeta = {
      ...SEASON_META,
      configStatus: 'stale_calendar_config' as const,
      configNote: 'NFL season calendar ends after 2026.',
      evidenceSeason: null,
      evidenceWeek: null,
      decisionTargetSeason: 2026,
      decisionTargetWeek: 1,
      decisionTargetProvenance: 'anchor_derived' as const,
      decisionTargetIsProvisional: true,
      phaseTargetSeason: 2025,
      phaseTargetWeek: 12,
      phaseTargetProvenance: 'anchor_derived',
      phaseTargetIsProvisional: true,
      evidenceThroughSeason: null,
      evidenceThroughWeek: null,
      evidenceProvenance: 'source_extent_unknown',
      completionVerified: false,
      finalizedThroughWeek: null,
      completionCopy: 'Completion not verified.',
      generatedAt: null,
      targetWeek: null,
      targetLabel: null,
      isArchiveView: false,
      status: 'season_calendar_config_stale',
      statusDetail: 'NFL season calendar ends after 2026.',
    };
    const data: TiersApiResponse = {
      asOf: '2026-08-08T19:04:15.325Z',
      seasonMeta: staleMeta,
      sourceStack: [],
      trust: {
        sampleNote: 'NFL season calendar ends after 2026.',
        stabilityNote: 'season_calendar_config_stale',
      },
      items: [],
    };

    const html = render(baseProps({ data }));

    expect(html).toContain('Season state unavailable');
    expect(html).toContain('NFL season calendar ends after 2026.');
    expect(html).toContain('Season calendar unavailable');
    expect(html).toContain('cannot determine which season or week');
    expect(html).not.toContain('No players match this filter yet.');
    expect(html).not.toMatch(/\d+ players/);
    expect(html).not.toContain('FORGE grades for this filter have not been computed yet');
  });

  it('renders a successfully served configured-history archive under a stale calendar: "Archive:" framing ALONGSIDE, not instead of, the stale-calendar warning', () => {
    // Fantasy #307 correction round 5: the route's own stale-calendar gate
    // proves an admitted response here can only be an explicitly requested,
    // configured historical season — `isArchiveView: true` — but the live
    // calendar is still stale (`configStatus` unchanged), so the phase
    // heading and the archive/stale warning banner still say so too.
    const staleArchiveMeta = {
      ...SEASON_META,
      configStatus: 'stale_calendar_config' as const,
      configNote: 'NFL season calendar ends after 2026.',
      evidenceSeason: 2025,
      evidenceWeek: 18,
      decisionTargetSeason: 2025,
      decisionTargetWeek: 18,
      decisionTargetProvenance: null,
      decisionTargetIsProvisional: false,
      phaseTargetSeason: null,
      phaseTargetWeek: null,
      phaseTargetProvenance: null,
      phaseTargetIsProvisional: false,
      evidenceThroughSeason: 2025,
      evidenceThroughWeek: 18,
      evidenceProvenance: 'source_declared_as_of',
      completionVerified: false,
      finalizedThroughWeek: null,
      completionCopy: 'Completion not verified.',
      generatedAt: '2026-08-08T19:04:15.325Z',
      targetWeek: null,
      targetLabel: null,
      isArchiveView: true,
      status: 'archive_season_not_current',
      statusDetail: 'Showing configured historical 2025 evidence while live season state is unavailable.',
    };
    const data: TiersApiResponse = {
      contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
      asOf: '2026-08-08T19:04:15.325Z',
      seasonMeta: staleArchiveMeta,
      sourceStack: [{ layer: 'forge' }],
      trust: { sampleNote: null, stabilityNote: null },
      items: [makeItem()],
    };

    const html = render(baseProps({ data }));

    // The archive framing renders...
    expect(html).toContain('Archive: 2025 evidence, through week 18');
    // ...ALONGSIDE the stale-calendar warning, not in place of it.
    expect(html).toContain('Season state unavailable');
    expect(html).toContain('NFL season calendar ends after 2026.');
    // Neither claims a live forward target/season the calendar cannot supply.
    expect(html).not.toMatch(/forward board targets/);
    // The admitted rows actually render — this is NOT the calendar-unavailable panel.
    expect(html).not.toContain('data-testid="tiers-calendar-unavailable"');
    expect(html).toContain('Justin Jefferson');
  });

  it('renders an unresolved row with no player link and no player-research link (Fantasy #308)', () => {
    const unresolved = makeItem({
      playerId: null,
      playerName: 'Unmapped Player',
      identity: {
        status: 'unresolved',
        canonicalId: null,
        sourceId: '00-0099999',
        sourceType: 'gsis',
        reason: 'gsis_not_in_identity_map',
        linkable: false,
      },
    });
    const data: TiersApiResponse = {
      seasonMeta: SEASON_META,
      contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
      asOf: '2026-08-08T19:04:15.325Z',
      sourceStack: [{ layer: 'forge' }],
      trust: { sampleNote: null, stabilityNote: null },
      items: [unresolved],
    };

    const html = render(baseProps({ data }));

    // The row is still on the board.
    expect(html).toContain('Unmapped Player');
    // No player deep link, and no link built from the raw source id.
    expect(html).not.toContain('/player/00-0099999');
    expect(html).not.toContain('/player/null');
    expect(html).toContain('player-unresolved-00-0099999');
    // Player Research is absent; team/command-center research remain.
    expect(html).not.toContain('link-player-research');
    expect(html).toContain('link-team-research');
  });

  it('independently refuses /player/null when contradictory fields bypass validation', () => {
    const contradictory = makeItem({
      playerId: null,
      playerName: 'Contradictory Fixture',
      identity: {
        status: 'resolved',
        canonicalId: 'tiber-contradictory-fixture',
        sourceId: '00-0036000',
        sourceType: 'gsis',
        reason: null,
        linkable: true,
      },
    });
    const data: TiersApiResponse = {
      seasonMeta: SEASON_META,
      contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
      asOf: '2026-08-08T19:04:15.325Z',
      sourceStack: [{ layer: 'forge' }],
      trust: { sampleNote: null, stabilityNote: null },
      items: [contradictory],
    };

    const html = render(baseProps({ data }));

    expect(html).toContain('Contradictory Fixture');
    expect(html).not.toContain('/player/null');
    expect(html).not.toContain('/player/tiber-contradictory-fixture');
    expect(html).not.toContain('link-player-research');
  });

  it('renders a resolved row with a canonical link and a player-research link', () => {
    const resolved = makeItem({
      playerId: 'tiber-amon-ra-st-brown',
      playerName: 'Amon-Ra St. Brown',
      identity: {
        status: 'resolved',
        canonicalId: 'tiber-amon-ra-st-brown',
        sourceId: '00-0036963',
        sourceType: 'gsis',
        reason: null,
        linkable: true,
      },
    });
    const data: TiersApiResponse = {
      seasonMeta: SEASON_META,
      contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
      asOf: '2026-08-08T19:04:15.325Z',
      sourceStack: [{ layer: 'forge' }],
      trust: { sampleNote: null, stabilityNote: null },
      items: [resolved],
    };

    const html = render(baseProps({ data }));

    expect(html).toContain('/player/tiber-amon-ra-st-brown');
    // Never the raw GSIS.
    expect(html).not.toContain('/player/00-0036963');
    expect(html).toContain('link-player-research');
  });

  it('proves malformed 2xx JSON is rejected before it can render as a genuine empty result', () => {
    // This is the client-boundary half of the "malformed vs. genuine empty" requirement:
    // the validator (wired into TiberTiers' queryFn) must throw for these shapes so React
    // Query lands in the error state rendered by the case above, rather than in the
    // genuine-empty case exercised two tests up.
    expect(() => validateRankingsV2WeeklyResponse({})).toThrow();
    expect(() => validateRankingsV2WeeklyResponse(null)).toThrow();
    expect(() => validateRankingsV2WeeklyResponse({ items: null, sourceStack: [], asOf: '2026-04-12T00:00:00.000Z' })).toThrow();
    expect(() => validateRankingsV2WeeklyResponse({ items: [], sourceStack: null, asOf: '2026-04-12T00:00:00.000Z' })).toThrow();
    expect(() => validateRankingsV2WeeklyResponse({ items: [], sourceStack: [], asOf: 'not-a-date' })).toThrow();
    // A response missing the contract version entirely is malformed regardless
    // of seasonMeta — the version negotiation is unconditional.
    expect(() =>
      validateRankingsV2WeeklyResponse({ items: [], sourceStack: [], asOf: '2026-04-12T00:00:00.000Z' }),
    ).toThrow();
    // An explicit, well-formed empty array with the negotiated contract version
    // AND the season/phase envelope is the current-era genuine empty result.
    expect(() =>
      validateRankingsV2WeeklyResponse({
        contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
        items: [],
        sourceStack: [],
        asOf: '2026-04-12T00:00:00.000Z',
        seasonMeta: SEASON_META,
      }),
    ).not.toThrow();
    // Rolling compatibility (Fantasy #307 correction round 4): the contract
    // version is unchanged, so a same-version response that simply omits
    // `seasonMeta` — a pre-Phase-A server — is accepted too, not thrown. The
    // container renders it as the dedicated `season_metadata_unavailable`
    // state (see below) rather than treating it as malformed.
    expect(() =>
      validateRankingsV2WeeklyResponse({
        contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
        items: [],
        sourceStack: [],
        asOf: '2026-04-12T00:00:00.000Z',
      }),
    ).not.toThrow();
    // Missing the contract version is still malformed even with a well-formed
    // seasonMeta present — omission of seasonMeta is the only thing rolling
    // compatibility relaxes.
    expect(() =>
      validateRankingsV2WeeklyResponse({
        items: [],
        sourceStack: [],
        asOf: '2026-04-12T00:00:00.000Z',
        seasonMeta: SEASON_META,
      }),
    ).toThrow();
  });

  it('renders explicit compatibility copy and suppresses the table/links/phase/evidence/archive claims for a legacy response with no seasonMeta', () => {
    const data: TiersApiResponse = {
      contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
      asOf: '2026-04-12T00:00:00.000Z',
      sourceStack: [{ layer: 'forge' }],
      trust: { sampleNote: null, stabilityNote: null },
      items: [makeItem()],
    };

    const html = render(baseProps({ data }));

    expect(html).toContain('data-testid="tiers-season-metadata-unavailable"');
    expect(html).toContain('Season context unavailable');
    // No table, no player row, no player link.
    expect(html).not.toContain('Justin Jefferson');
    expect(html).not.toContain('/player/');
    // No phase/target claim, no evidence-extent claim, no archive/completion
    // claim, no empty-result copy, and no headline fabricated from sourceStack.
    expect(html).not.toContain('Preseason');
    expect(html).not.toContain('Target: Week');
    expect(html).not.toMatch(/\d{4} evidence/);
    expect(html).not.toContain('Archive:');
    expect(html).not.toContain('Completion not verified');
    expect(html).not.toContain('No players match this filter yet.');
    expect(html).not.toMatch(/\d+ players/);
    expect(html).not.toContain('Source:');
    expect(html).not.toContain('Canonical FORGE Alpha ranks');
    expect(html).not.toContain('Weekly Rankings');
    expect(html).not.toContain('data-testid="tiers-archive-notice"');
  });

  it('renders the current, non-legacy state unchanged when seasonMeta is present', () => {
    const data: TiersApiResponse = {
      contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
      asOf: '2026-04-12T00:00:00.000Z',
      seasonMeta: SEASON_META,
      sourceStack: [{ layer: 'forge' }],
      trust: { sampleNote: null, stabilityNote: null },
      items: [makeItem()],
    };

    const html = render(baseProps({ data }));

    expect(html).not.toContain('tiers-season-metadata-unavailable');
    expect(html).not.toContain('Season context unavailable');
    expect(html).toContain('Justin Jefferson');
  });
});
