/**
 * @jest-environment jsdom
 *
 * Exercises the real production chain the default-exported `TiberTiers` container wires
 * together: TiberTiers -> useQuery -> queryFn -> fetch -> validateRankingsV2WeeklyResponse
 * -> query state -> TiberTiersView. Unlike TiberTiers.render.test.ts (which renders
 * TiberTiersView directly with hand-built props — a presentation-level test), this file
 * renders the actual container with a real QueryClient/QueryClientProvider and a mocked
 * network layer only, so the malformed-2xx -> error transition is proved end-to-end
 * instead of inferred from testing the validator and the view separately.
 *
 * Uses @testing-library/react + jest-environment-jsdom (added as R2-authorized dev
 * dependencies) via this file's own @jest-environment docblock — the repository-wide Jest
 * config (testEnvironment: 'node') is unchanged. No @testing-library/jest-dom matchers
 * (not on the R2 dependency allowlist) — assertions use plain Jest/DOM APIs instead.
 */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TiberTiers from '../TiberTiers';
import {
  EXACT_WEEK_UNAVAILABLE_STATUS,
  RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
  TIERS_EXACT_WEEK_UNAVAILABLE_MESSAGE,
} from '../tiberTiersV2Mapper';

type MockHttpResponse = {
  ok: boolean;
  status?: number;
  json: () => Promise<unknown>;
};

const FRESH_CURRENT_WEEK = {
  currentWeek: 1,
  season: 2026,
  weekStatus: 'not_started',
  mondayNightCompleted: false,
  weekStartDate: '2026-09-10T20:00:00.000Z',
  weekEndDate: '2026-09-16T04:00:00.000Z',
  gamesCompleted: 0,
  totalGames: 16,
  upcomingWeek: 1,
  success: true,
  phase: 'preseason',
  phaseLabel: 'Preseason',
  seasonPhaseLabel: '2026 · Preseason',
  regularSeasonWeek: null,
  targetSeason: 2026,
  targetWeek: 1,
  targetLabel: 'Target: Week 1',
  scheduleSource: 'anchor_derived',
  targetProvenance: 'anchor_derived',
  targetIsProvisional: true,
  configStatus: 'ok',
  configNote: null,
  configuredSeasons: [2025, 2026],
};

const STALE_CURRENT_WEEK = {
  ...FRESH_CURRENT_WEEK,
  season: 2027,
  upcomingWeek: null,
  phase: 'offseason',
  phaseLabel: 'Offseason',
  seasonPhaseLabel: '2027 · Offseason',
  targetSeason: null,
  targetWeek: null,
  targetLabel: null,
  scheduleSource: null,
  targetProvenance: null,
  targetIsProvisional: false,
  configStatus: 'stale_calendar_config',
  configNote: 'NFL season calendar ends after 2026.',
  // Which seasons are CONFIGURED is independent of the live calendar's own
  // staleness — a stale live phase does not un-configure an archive.
  configuredSeasons: [2025, 2026],
};

// A same-contract-version server that predates `configuredSeasons` entirely —
// the key is OMITTED, not sent as `[]`. Built by deleting the key rather than
// setting it to `undefined`: `JSON.stringify`/a real fetch response would
// drop an `undefined` value the same way, but building the fixture by
// deletion keeps that omission explicit and doesn't rely on JSON semantics
// the mock's `json: async () => payload` bypasses anyway.
const LEGACY_CURRENT_WEEK = (() => {
  const { configuredSeasons, ...rest } = FRESH_CURRENT_WEEK;
  void configuredSeasons;
  return rest;
})();

function currentWeekResponse(payload: Record<string, unknown> = FRESH_CURRENT_WEEK) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => payload,
  });
}

function mockFetch(
  rankingsResponse: (url: string) => Promise<MockHttpResponse>,
  currentWeekPayload: Record<string, unknown> = FRESH_CURRENT_WEEK,
  currentWeekOk = true,
) {
  const fetchMock = jest.fn((input: unknown) => {
    const url = String(input);
    if (url.includes('/api/system/current-week')) {
      return currentWeekOk
        ? currentWeekResponse(currentWeekPayload)
        : Promise.resolve({ ok: false, status: 503, json: async () => ({ error: 'calendar unavailable' }) });
    }
    if (url.includes('/api/rankings/v2/weekly')) return rankingsResponse(url);
    return Promise.reject(new Error(`Unexpected fetch call in test: ${url}`));
  });
  (global as any).fetch = fetchMock;
  return fetchMock;
}

function renderContainer() {
  // TiberTiers.tsx's own useQuery call sets `retry: 1` (a deliberate production reliability
  // choice, left untouched here), which overrides this QueryClient's `retry` default — but
  // not `retryDelay`, so keeping that at 0 keeps the one retry from adding TanStack Query's
  // exponential backoff wait to every error-path test.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  const renderResult = render(
    React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(TiberTiers)),
  );
  return { queryClient, renderResult };
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
  phaseTargetSeason: 2026,
  phaseTargetWeek: 1,
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

const STALE_SEASON_META = {
  ...SEASON_META,
  currentSeason: null,
  forwardRankingSeason: null,
  currentPhase: null,
  currentPhaseLabel: null,
  currentRegularSeasonWeek: null,
  targetSeason: null,
  targetWeek: null,
  targetLabel: null,
  scheduleSource: null,
  configStatus: 'stale_calendar_config' as const,
  configNote: 'NFL season calendar ends after 2026.',
  evidenceSeason: null,
  evidenceWeek: null,
  decisionTargetSeason: null,
  decisionTargetWeek: null,
  decisionTargetProvenance: null,
  decisionTargetIsProvisional: false,
  phaseTargetSeason: null,
  phaseTargetWeek: null,
  phaseTargetProvenance: null,
  phaseTargetIsProvisional: false,
  evidenceThroughSeason: null,
  evidenceThroughWeek: null,
  evidenceProvenance: 'no_rankable_source',
  completionVerified: false,
  finalizedThroughWeek: null,
  completionCopy: 'Completion not verified.',
  generatedAt: null,
  isArchiveView: false,
  status: 'season_calendar_config_stale',
  statusDetail: 'NFL season calendar ends after 2026.',
};
const IDENTITY = {
    status: 'resolved' as const,
    canonicalId: 'tiber-amon-ra-st-brown',
    sourceId: '00-0036963',
    sourceType: 'gsis' as const,
    reason: null,
    linkable: true,
  };

function wellFormedItem(overrides: Record<string, unknown> = {}) {
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
    ...overrides,
  };
}

describe('TiberTiers container (real useQuery -> fetch -> validator -> render chain)', () => {
  afterEach(() => {
    cleanup();
    jest.resetAllMocks();
  });

  it('renders the loading state while the request is unresolved', async () => {
    mockFetch(() => new Promise(() => {})); // never resolves
    renderContainer();

    expect(await screen.findByText('Loading rankings...')).toBeTruthy();
    expect(screen.queryByText('Unable to load rankings')).toBeNull();
  });

  it('renders the error state for a non-2xx response', async () => {
    mockFetch(() => Promise.resolve({ ok: false, status: 500, json: async () => ({ error: 'Upstream failure' }) }));
    renderContainer();

    expect(await screen.findByText('Unable to load rankings')).toBeTruthy();
    expect(screen.queryByText('No players match this filter yet.')).toBeNull();
    expect(screen.queryByText(/\d+ players/)).toBeNull();
    // The generic message, never the raw backend text.
    expect(screen.queryByText('Upstream failure')).toBeNull();
  });

  it('renders the error state — not the genuine-empty state — for a malformed 2xx response', async () => {
    mockFetch(() => Promise.resolve({ ok: true, status: 200, json: async () => ({}) }));
    renderContainer();

    expect(await screen.findByText('Unable to load rankings')).toBeTruthy();
    expect(screen.queryByText('No players match this filter yet.')).toBeNull();
    expect(screen.queryByText(/\d+ players/)).toBeNull();
  });

  it('rejects the pre-nullable contract revision instead of silently coercing it', async () => {
    mockFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          contractVersion: 'v2-scaffold-2026-04-02',
          asOf: '2026-04-12T00:00:00.000Z',
          sourceStack: [{ layer: 'forge' }],
          items: [],
        }),
      }),
    );
    renderContainer();

    expect(await screen.findByText('Unable to load rankings')).toBeTruthy();
    expect(screen.queryByText('No players match this filter yet.')).toBeNull();
  });

  it('renders the error state for a malformed 2xx response with page-unsafe nested shapes', async () => {
    // sourceStack: [null] and an item missing `explanation` both previously crashed
    // rather than being rejected at the boundary.
    mockFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
          asOf: '2026-04-12T00:00:00.000Z',
          seasonMeta: SEASON_META,
          sourceStack: [null],
          items: [{}],
        }),
      }),
    );
    renderContainer();

    expect(await screen.findByText('Unable to load rankings')).toBeTruthy();
    expect(screen.queryByText('No players match this filter yet.')).toBeNull();
  });

  it('renders the error state for a malformed 2xx response with a non-contract asOf timestamp', async () => {
    // "2026-02-30" is not a real calendar date; permissive Date coercion previously
    // accepted it (silently normalized into March) instead of rejecting it at the boundary.
    mockFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
          asOf: '2026-02-30',
          sourceStack: [{ layer: 'forge' }],
          items: [],
        }),
      }),
    );
    renderContainer();

    expect(await screen.findByText('Unable to load rankings')).toBeTruthy();
    expect(screen.queryByText('No players match this filter yet.')).toBeNull();
    expect(screen.queryByText(/\d+ players/)).toBeNull();
  });

  it('renders the unavailable state for an uncomputed FORGE cache', async () => {
    mockFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
          asOf: '2026-04-12T00:00:00.000Z',
          seasonMeta: SEASON_META,
          sourceStack: [{ layer: 'forge' }],
          trust: { sampleNote: null, stabilityNote: 'forge_cache_empty_uncomputed' },
          items: [],
        }),
      }),
    );
    renderContainer();

    expect(await screen.findByText('Rankings are not available yet')).toBeTruthy();
    expect(screen.queryByText('compute-grades', { exact: false })).toBeNull();
  });

  it('carries an auto-derived target origin through the real URL and uncomputed-status render chain', async () => {
    const fetchMock = mockFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
          asOf: '2026-08-09T12:00:00.000Z',
          seasonMeta: {
            ...SEASON_META,
            evidenceSeason: null,
            evidenceWeek: null,
            evidenceThroughSeason: null,
            evidenceThroughWeek: null,
            evidenceProvenance: 'no_rankable_source',
            generatedAt: null,
            isArchiveView: false,
            status: 'forge_cache_empty_uncomputed',
            statusDetail: 'FORGE grades for this target have not been computed yet.',
            decisionTargetOrigin: 'phase_default',
          },
          sourceStack: [],
          trust: { sampleNote: null, stabilityNote: 'forge_cache_empty_uncomputed' },
          items: [],
        }),
      }),
    );
    renderContainer();

    expect(await screen.findByText('Rankings are not available yet')).toBeTruthy();
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([input]) =>
        String(input).includes('targetOrigin=phase_default'),
      )).toBe(true);
    });
    const rankingsUrl = fetchMock.mock.calls
      .map(([input]) => String(input))
      .find((url) => url.includes('targetOrigin=phase_default'));
    expect(rankingsUrl).toBeDefined();
    const params = new URL(rankingsUrl!, 'http://localhost').searchParams;
    expect(params.get('season')).toBe('2026');
    expect(params.get('asOfWeek')).toBe('1');
    expect(params.get('targetOrigin')).toBe('phase_default');
    expect(screen.queryByTestId('tiers-exact-week-unavailable')).toBeNull();
    expect(screen.queryByText('No players match this filter yet.')).toBeNull();
  });

  it('renders the exact-week-unavailable state, never the empty filtered board', async () => {
    // The regression: the server correctly returns
    // `exact_week_evidence_unavailable` with zero items, but the resolver did
    // not recognise it and fell through to `empty` — so a fail-closed response
    // told the user "No players match this filter yet". That reads as "we
    // looked and there is nothing", when the truth is the board could not be
    // produced and another week's rows were deliberately not substituted.
    //
    // The status string here is the one the server actually publishes; the
    // server suite pins that literal against the client constant.
    mockFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
          asOf: '2026-04-12T00:00:00.000Z',
          seasonMeta: {
            ...SEASON_META,
            status: EXACT_WEEK_UNAVAILABLE_STATUS,
            statusDetail:
              'No evidence is available for 2025 week 7. FORGE grades are not computed for that exact week. ' +
              "A different week's rows are not substituted.",
          },
          sourceStack: [{ layer: 'forge' }],
          trust: { sampleNote: null, stabilityNote: EXACT_WEEK_UNAVAILABLE_STATUS },
          items: [],
        }),
      }),
    );
    renderContainer();

    expect(await screen.findByText('Rankings unavailable for the requested week')).toBeTruthy();
    expect(screen.getByText(TIERS_EXACT_WEEK_UNAVAILABLE_MESSAGE)).toBeTruthy();
    // The server's own detail names the week it could not answer for.
    expect(screen.getByTestId('tiers-exact-week-detail').textContent).toMatch(/2025 week 7/);

    // The three statements it must NOT make.
    expect(screen.queryByText('No players match this filter yet.')).toBeNull();
    expect(screen.queryByText('Rankings are not available yet')).toBeNull();
    expect(screen.queryByTestId('tiers-table')).toBeNull();
  });

  it('still renders the genuine-empty state when no such status is present', async () => {
    // Fail-closed copy must not swallow the real empty case: a valid response
    // with zero items and no status is still "nothing matched this filter".
    mockFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
          asOf: '2026-04-12T00:00:00.000Z',
          seasonMeta: SEASON_META,
          sourceStack: [{ layer: 'forge' }],
          trust: { sampleNote: null, stabilityNote: null },
          items: [],
        }),
      }),
    );
    renderContainer();

    expect(await screen.findByText('No players match this filter yet.')).toBeTruthy();
    expect(screen.queryByTestId('tiers-exact-week-unavailable')).toBeNull();
  });

  /**
   * A single mock rankings responder shared by the stale-calendar regressions
   * below: `season` absent -> the typed calendar-unavailable payload;
   * `season` present -> an admitted archive/live response for that season,
   * still carrying `configStatus: 'stale_calendar_config'` whenever the
   * mounted current-week state is stale — a successfully served configured
   * archive does NOT stop the live calendar itself from being stale.
   */
  function mockConfiguredArchiveResponder(isLiveCalendarStale: () => boolean) {
    return async (url: string) => {
      const requestParams = new URL(url, 'http://localhost').searchParams;
      const requestedSeason = requestParams.get('season');
      if (requestedSeason === null) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
            asOf: '2031-10-01T12:00:00.000Z',
            seasonMeta: STALE_SEASON_META,
            sourceStack: [],
            trust: {
              sampleNote: 'NFL season calendar ends after 2026.',
              stabilityNote: 'season_calendar_config_stale',
            },
            items: [],
          }),
        };
      }

      const evidenceSeason = Number(requestedSeason);
      const requestedWeek = requestParams.get('asOfWeek');
      const isPhaseDefault = requestParams.get('targetOrigin') === 'phase_default';
      // Fantasy #307 correction round 5: while the live calendar is stale,
      // ANY admitted evidence is archive by construction — the route's own
      // stale-calendar gate already proved this can only be an explicitly
      // requested, configured historical season, with no forward target to
      // compare against. While the live calendar is ok, archive stays a
      // comparison against the forward season (2026 here).
      const isArchiveView = isLiveCalendarStale() ? true : evidenceSeason !== 2026;
      const statusDetail = !isArchiveView
        ? null
        : isLiveCalendarStale()
          ? `Showing configured historical ${evidenceSeason} evidence while live season state is unavailable.`
          : 'Showing 2025 evidence while the forward board targets 2026 (2026 · Preseason).';
      return {
        ok: true,
        status: 200,
        json: async () => ({
          contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
          asOf: '2026-08-09T12:00:00.000Z',
          seasonMeta: {
            ...(isLiveCalendarStale() ? STALE_SEASON_META : SEASON_META),
            decisionTargetSeason: evidenceSeason,
            decisionTargetWeek: requestedWeek === null ? null : Number(requestedWeek),
            decisionTargetProvenance: isPhaseDefault ? 'anchor_derived' : null,
            decisionTargetIsProvisional: isPhaseDefault,
            decisionTargetOrigin: isPhaseDefault ? 'phase_default' : null,
            evidenceSeason,
            evidenceWeek: evidenceSeason === 2025 ? 18 : 1,
            evidenceThroughSeason: evidenceSeason,
            evidenceThroughWeek: evidenceSeason === 2025 ? 18 : 1,
            evidenceProvenance: 'source_declared_as_of',
            generatedAt: '2026-08-09T12:00:00.000Z',
            isArchiveView,
            status: isArchiveView ? 'archive_season_not_current' : null,
            statusDetail,
            // Configured-history-only serving does not depend on the live
            // calendar's own state — this stays whatever the mounted
            // current-week state says, independent of `evidenceSeason`.
            configStatus: isLiveCalendarStale() ? 'stale_calendar_config' : 'ok',
          },
          sourceStack: [{ layer: 'forge' }],
          trust: { sampleNote: null, stabilityNote: null },
          items: [wellFormedItem()],
        }),
      };
    };
  }

  it('fresh -> stale retains an explicit configured selection and refetches it', async () => {
    let liveCalendarStale = false;
    const fetchMock = mockFetch(mockConfiguredArchiveResponder(() => liveCalendarStale));
    const { queryClient } = renderContainer();

    expect(await screen.findByText('Justin Jefferson')).toBeTruthy();
    fireEvent.click(screen.getByTestId('season-2025'));
    await waitFor(() => {
      expect(screen.getByTestId('season-2025').getAttribute('aria-pressed')).toBe('true');
    });

    const rankingsCallCountBeforeStale = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes('/api/rankings/v2/weekly'),
    ).length;

    liveCalendarStale = true;
    await act(async () => {
      queryClient.setQueryData(['/api/system/current-week'], STALE_CURRENT_WEEK);
    });

    // The explicit, still-configured 2025 selection survives the stale
    // transition: it is refetched (a new request fires) and its admitted
    // rows render — the panel is NOT the calendar-unavailable one, even
    // though the response's own `configStatus` says the live calendar is
    // stale.
    await waitFor(() => {
      const rankingsUrls = fetchMock.mock.calls
        .map(([input]) => String(input))
        .filter((url) => url.includes('/api/rankings/v2/weekly'));
      expect(rankingsUrls.length).toBeGreaterThan(rankingsCallCountBeforeStale);
      const latest = rankingsUrls[rankingsUrls.length - 1];
      expect(new URL(latest, 'http://localhost').searchParams.get('season')).toBe('2025');
    });
    expect(screen.queryByTestId('tiers-calendar-unavailable')).toBeNull();
    expect(await screen.findByText('Justin Jefferson')).toBeTruthy();
    expect(screen.getByTestId('season-2025').getAttribute('aria-pressed')).toBe('true');
  });

  it('fresh -> stale without an explicit selection omits season and remains calendar-unavailable', async () => {
    let liveCalendarStale = false;
    const fetchMock = mockFetch(mockConfiguredArchiveResponder(() => liveCalendarStale));
    const { queryClient } = renderContainer();

    // 2026 is the detected season here, not an explicit selection.
    await waitFor(() => {
      expect(
        fetchMock.mock.calls.some(([input]) => {
          const url = String(input);
          return (
            url.includes('/api/rankings/v2/weekly') &&
            new URL(url, 'http://localhost').searchParams.get('season') === '2026'
          );
        }),
      ).toBe(true);
    });

    const rankingsCallCountBeforeStale = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes('/api/rankings/v2/weekly'),
    ).length;

    liveCalendarStale = true;
    await act(async () => {
      queryClient.setQueryData(['/api/system/current-week'], STALE_CURRENT_WEEK);
    });

    expect(await screen.findByTestId('tiers-calendar-unavailable')).toBeTruthy();
    const rankingsUrls = fetchMock.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url.includes('/api/rankings/v2/weekly'));
    const staleTransitionUrls = rankingsUrls.slice(rankingsCallCountBeforeStale);
    expect(staleTransitionUrls).toHaveLength(1);
    expect(new URL(staleTransitionUrls[0], 'http://localhost').searchParams.has('season')).toBe(false);
    expect(screen.queryByText('No players match this filter yet.')).toBeNull();
    expect(screen.queryByText('0 players')).toBeNull();
  });

  it('direct stale mount exposes exactly the configured seasons; the initial parameterless request fails closed', async () => {
    const fetchMock = mockFetch(
      mockConfiguredArchiveResponder(() => true),
      STALE_CURRENT_WEEK,
    );
    renderContainer();

    expect(await screen.findByTestId('tiers-calendar-unavailable')).toBeTruthy();
    expect(screen.getByTestId('season-2025')).toBeTruthy();
    expect(screen.getByTestId('season-2026')).toBeTruthy();
    await waitFor(() => {
      const rankingsUrls = fetchMock.mock.calls
        .map(([input]) => String(input))
        .filter((url) => url.includes('/api/rankings/v2/weekly'));
      expect(rankingsUrls.length).toBeGreaterThan(0);
      expect(new URL(rankingsUrls[0], 'http://localhost').searchParams.has('season')).toBe(false);
    });
  });

  it('selecting 2025 sends season=2025 without asOfWeek and renders admitted rows despite stale configStatus', async () => {
    const fetchMock = mockFetch(
      mockConfiguredArchiveResponder(() => true),
      STALE_CURRENT_WEEK,
    );
    renderContainer();
    expect(await screen.findByTestId('tiers-calendar-unavailable')).toBeTruthy();

    fireEvent.click(screen.getByTestId('season-2025'));

    expect(await screen.findByText('Justin Jefferson')).toBeTruthy();
    expect(screen.queryByTestId('tiers-calendar-unavailable')).toBeNull();
    await waitFor(() => {
      const rankingsUrls = fetchMock.mock.calls
        .map(([input]) => String(input))
        .filter((url) => url.includes('/api/rankings/v2/weekly'));
      const latest = rankingsUrls[rankingsUrls.length - 1];
      const params = new URL(latest, 'http://localhost').searchParams;
      expect(params.get('season')).toBe('2025');
      expect(params.has('asOfWeek')).toBe(false);
    });
  });

  describe('configuredSeasons: an omitted field is unknown, not an explicit empty list (Fantasy #307 correction round 5)', () => {
    it('new -> legacy omission: an explicit 2025 selection survives a response that merely omits configuredSeasons', async () => {
      const fetchMock = mockFetch(mockConfiguredArchiveResponder(() => false));
      const { queryClient } = renderContainer();

      expect(await screen.findByText('Justin Jefferson')).toBeTruthy();
      fireEvent.click(screen.getByTestId('season-2025'));
      await waitFor(() => {
        expect(screen.getByTestId('season-2025').getAttribute('aria-pressed')).toBe('true');
      });
      await waitFor(() => {
        const rankingsUrls = fetchMock.mock.calls
          .map(([input]) => String(input))
          .filter((url) => url.includes('/api/rankings/v2/weekly'));
        expect(new URL(rankingsUrls[rankingsUrls.length - 1], 'http://localhost').searchParams.get('season'))
          .toBe('2025');
      });

      // The server alternates to a legacy response that omits the field
      // entirely — NOT an explicit `[]`.
      await act(async () => {
        queryClient.setQueryData(['/api/system/current-week'], LEGACY_CURRENT_WEEK);
      });

      // The retained list (still [2025, 2026] from the prior response) still
      // validates the selection: the request season stays 2025 (no refetch
      // is even expected — nothing the rankings request depends on changed —
      // and the selector still shows it selected).
      await waitFor(() => {
        expect(screen.getByTestId('season-2025').getAttribute('aria-pressed')).toBe('true');
      });
      const rankingsUrls = fetchMock.mock.calls
        .map(([input]) => String(input))
        .filter((url) => url.includes('/api/rankings/v2/weekly'));
      expect(new URL(rankingsUrls[rankingsUrls.length - 1], 'http://localhost').searchParams.get('season'))
        .toBe('2025');
      // The selector still shows both retained options — nothing was invented,
      // but nothing valid was discarded either.
      expect(screen.getByTestId('season-2026')).toBeTruthy();
    });

    it('an explicit newer list excluding 2025 invalidates a previously valid selection', async () => {
      // A third configured season (2024) keeps 2+ options after 2025 is
      // dropped, so the selector itself stays visible (it renders only for
      // `availableSeasons.length > 1`, unrelated to this fix) and the
      // "invalidated, not merely narrowed to a single default" signal stays
      // legible: season-2024 remains offered, season-2025 does not.
      const THREE_SEASONS_CURRENT_WEEK = { ...FRESH_CURRENT_WEEK, configuredSeasons: [2024, 2025, 2026] };
      const fetchMock = mockFetch(mockConfiguredArchiveResponder(() => false), THREE_SEASONS_CURRENT_WEEK);
      const { queryClient } = renderContainer();

      expect(await screen.findByText('Justin Jefferson')).toBeTruthy();
      fireEvent.click(screen.getByTestId('season-2025'));
      await waitFor(() => {
        expect(screen.getByTestId('season-2025').getAttribute('aria-pressed')).toBe('true');
      });
      expect(fetchMock.mock.calls.some(([input]) => {
        const url = String(input);
        return url.includes('/api/rankings/v2/weekly')
          && new URL(url, 'http://localhost').searchParams.get('season') === '2025';
      })).toBe(true);

      // A fresh EXPLICIT list arrives that no longer configures 2025.
      await act(async () => {
        queryClient.setQueryData(['/api/system/current-week'], {
          ...THREE_SEASONS_CURRENT_WEEK,
          configuredSeasons: [2024, 2026],
        });
      });

      // The retained selection is invalidated: the selector no longer offers
      // 2025 at all, and falls back to the detected season (2026).
      await waitFor(() => {
        expect(screen.queryByTestId('season-2025')).toBeNull();
      });
      expect(screen.getByTestId('season-2024')).toBeTruthy();
      expect(screen.getByTestId('season-2026').getAttribute('aria-pressed')).toBe('true');
    });

    it('a direct legacy mount (configuredSeasons never reported) invents no options and no selection', async () => {
      const fetchMock = mockFetch(mockConfiguredArchiveResponder(() => false), LEGACY_CURRENT_WEEK);
      renderContainer();

      expect(await screen.findByText('Justin Jefferson')).toBeTruthy();
      // No explicit list has EVER been seen: the selector renders no options
      // at all (not an invented `[current-1, current]` pair, not `[]`
      // treated as "checked and empty").
      expect(screen.queryByTestId('season-2025')).toBeNull();
      expect(screen.queryByTestId('season-2026')).toBeNull();
      expect(screen.queryByTestId('tiers-season-control')).toBeNull();
      // The request still uses the detected live season normally — omission
      // of the configured-season list does not fail the live board closed.
      await waitFor(() => {
        const rankingsUrls = fetchMock.mock.calls
          .map(([input]) => String(input))
          .filter((url) => url.includes('/api/rankings/v2/weekly'));
        expect(new URL(rankingsUrls[rankingsUrls.length - 1], 'http://localhost').searchParams.get('season'))
          .toBe('2026');
      });
    });

    it('subsequent restoration: a fresh explicit list after omission revalidates a new selection', async () => {
      const fetchMock = mockFetch(mockConfiguredArchiveResponder(() => false), LEGACY_CURRENT_WEEK);
      const { queryClient } = renderContainer();

      expect(await screen.findByText('Justin Jefferson')).toBeTruthy();
      expect(screen.queryByTestId('season-2025')).toBeNull();

      // The explicit list is restored.
      await act(async () => {
        queryClient.setQueryData(['/api/system/current-week'], FRESH_CURRENT_WEEK);
      });
      await waitFor(() => {
        expect(screen.getByTestId('season-2025')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('season-2025'));
      await waitFor(() => {
        const rankingsUrls = fetchMock.mock.calls
          .map(([input]) => String(input))
          .filter((url) => url.includes('/api/rankings/v2/weekly'));
        expect(new URL(rankingsUrls[rankingsUrls.length - 1], 'http://localhost').searchParams.get('season'))
          .toBe('2025');
      });
      expect(screen.getByTestId('season-2025').getAttribute('aria-pressed')).toBe('true');
    });
  });

  it('sends the DECISION TARGET as asOfWeek, not regularSeasonWeek', async () => {
    // The week this page requests is the forward target from phase detection
    // (targetWeek), which rolls ahead of the in-play week once its final game
    // window opens. The fixture's regularSeasonWeek is null (preseason) while
    // targetWeek is 1: the request must carry asOfWeek=1 — a page keyed on
    // regularSeasonWeek would send nothing here and, mid-season, would send
    // the in-play week after the target had already rolled.
    const fetchMock = mockFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
          asOf: '2026-04-12T00:00:00.000Z',
          seasonMeta: SEASON_META,
          sourceStack: [{ layer: 'forge' }],
          trust: { sampleNote: null, stabilityNote: null },
          items: [],
        }),
      }),
    );
    renderContainer();
    await screen.findByText('No players match this filter yet.');

    // The very first request can fire before the current-week query resolves
    // (season/week both still null), so the invariant is pinned on the settled
    // request — the latest one once detection has landed.
    await waitFor(() => {
      const rankingsUrl = fetchMock.mock.calls
        .map(([input]) => String(input))
        .filter((url) => url.includes('/api/rankings/v2/weekly'))
        .pop()!;
      const params = new URL(rankingsUrl, 'http://localhost').searchParams;
      expect(params.get('season')).toBe('2026');
      expect(params.get('asOfWeek')).toBe('1');
      expect(params.get('targetOrigin')).toBe('phase_default');
    });

    // An archive selection has no forward target: switching to 2025 (not the
    // target season) must drop the week entirely rather than send either the
    // 2026 target or a reconstructed number — the server derives that season's
    // own extent.
    fireEvent.click(screen.getByTestId('season-2025'));
    await waitFor(() => {
      const archiveUrl = fetchMock.mock.calls
        .map(([input]) => String(input))
        .filter((url) => url.includes('/api/rankings/v2/weekly'))
        .pop()!;
      const archiveParams = new URL(archiveUrl, 'http://localhost').searchParams;
      expect(archiveParams.get('season')).toBe('2025');
      expect(archiveParams.has('asOfWeek')).toBe(false);
      expect(archiveParams.has('targetOrigin')).toBe(false);
    });

    // Selecting the live target season again still auto-derives Week 1; the
    // click chose the season, not a week, so its origin remains phase_default.
    fireEvent.click(screen.getByTestId('season-2026'));
    await waitFor(() => {
      const liveUrls = fetchMock.mock.calls
        .map(([input]) => String(input))
        .filter((url) => {
          if (!url.includes('/api/rankings/v2/weekly')) return false;
          const params = new URL(url, 'http://localhost').searchParams;
          return params.get('season') === '2026' && params.get('targetOrigin') === 'phase_default';
        });
      expect(liveUrls.length).toBeGreaterThan(0);
      const liveUrl = liveUrls[liveUrls.length - 1];
      const liveParams = new URL(liveUrl, 'http://localhost').searchParams;
      expect(liveParams.get('season')).toBe('2026');
      expect(liveParams.get('asOfWeek')).toBe('1');
      expect(liveParams.get('targetOrigin')).toBe('phase_default');
    });
  });

  it('renders the genuine-empty state for a valid, explicitly empty response', async () => {
    mockFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
          asOf: '2026-04-12T00:00:00.000Z',
          seasonMeta: SEASON_META,
          sourceStack: [{ layer: 'forge' }],
          trust: { sampleNote: null, stabilityNote: null },
          items: [],
        }),
      }),
    );
    renderContainer();

    expect(await screen.findByText('No players match this filter yet.')).toBeTruthy();
    expect(await screen.findByText('0 players')).toBeTruthy();
  });

  it('the real chain accepts a main-era payload with no seasonMeta and renders the compatibility state, not an error', async () => {
    // Fantasy #307 correction round 4, the other deployment direction: a
    // same-contract-version server that predates Phase A and never sends
    // `seasonMeta`. Exercised through the actual container ->
    // useQuery -> fetch -> validateRankingsV2WeeklyResponse -> render chain,
    // not just the mapper/view in isolation.
    mockFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
          asOf: '2026-04-12T00:00:00.000Z',
          sourceStack: [{ layer: 'forge' }],
          trust: { sampleNote: null, stabilityNote: null },
          items: [wellFormedItem()],
        }),
      }),
    );
    renderContainer();

    expect(await screen.findByTestId('tiers-season-metadata-unavailable')).toBeTruthy();
    expect(screen.getByText('Season context unavailable')).toBeTruthy();
    // Not the error state — this is a well-formed, accepted legacy response.
    expect(screen.queryByText('Unable to load rankings')).toBeNull();
    // No player row rendered.
    expect(screen.queryByText('Justin Jefferson')).toBeNull();
  });

  it('renders Forecast/scoring data with the source-specific headline and Expected/VORP labels', async () => {
    mockFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
          asOf: '2026-04-12T00:00:00.000Z',
          seasonMeta: SEASON_META,
          sourceStack: [{ layer: 'promoted_artifact' }],
          trust: { sampleNote: null, stabilityNote: null },
          items: [wellFormedItem()],
        }),
      }),
    );
    renderContainer();

    expect(await screen.findByText('Justin Jefferson')).toBeTruthy();
    expect(screen.getByText('Weekly Forecast Rankings', { exact: false })).toBeTruthy();
    expect(screen.getByText('Expected')).toBeTruthy();
    expect(screen.getByText('VORP')).toBeTruthy();
    expect(screen.queryByText('FORGE Alpha')).toBeNull();
  });

  it('renders FORGE-fallback data with the FORGE headline and FORGE Alpha/Raw Alpha labels', async () => {
    mockFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
          asOf: '2026-04-12T00:00:00.000Z',
          seasonMeta: SEASON_META,
          sourceStack: [{ layer: 'forge' }],
          trust: { sampleNote: null, stabilityNote: null },
          items: [wellFormedItem()],
        }),
      }),
    );
    renderContainer();

    expect(await screen.findByText('Justin Jefferson')).toBeTruthy();
    expect(screen.getByText('Canonical FORGE Alpha ranks', { exact: false })).toBeTruthy();
    expect(screen.getByText('FORGE Alpha')).toBeTruthy();
    expect(screen.getByText('Raw Alpha')).toBeTruthy();
  });

  it('uses validated response evidence for row research links when current-week resolution fails', async () => {
    const fetchMock = mockFetch(
      () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            contractVersion: RANKINGS_V2_EXPECTED_CONTRACT_VERSION,
            asOf: '2026-04-12T00:00:00.000Z',
            seasonMeta: SEASON_META,
            sourceStack: [{ layer: 'forge' }],
            trust: { sampleNote: null, stabilityNote: null },
            items: [wellFormedItem()],
          }),
        }),
      FRESH_CURRENT_WEEK,
      false,
    );
    renderContainer();

    const researchLink = await screen.findByTestId('link-player-research');
    const href = researchLink.getAttribute('href');
    expect(href).toContain('season=2025');
    expect(href).not.toContain('season=null');
    expect(fetchMock.mock.calls.some(([input]) => String(input).includes('/api/system/current-week'))).toBe(true);
    // The row still rendered from the independently validated rankings
    // response even though no container season was available.
    expect(screen.getByText('Justin Jefferson')).toBeTruthy();
  });
});
