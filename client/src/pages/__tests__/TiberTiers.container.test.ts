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
  configStatus: 'ok',
  configNote: null,
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
  configStatus: 'stale_calendar_config',
  configNote: 'NFL season calendar ends after 2026.',
};

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
) {
  const fetchMock = jest.fn((input: unknown) => {
    const url = String(input);
    if (url.includes('/api/system/current-week')) return currentWeekResponse(currentWeekPayload);
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
  generatedAt: '2026-08-08T19:04:15.325Z',
  isArchiveView: true,
  status: 'archive_season_not_current',
  statusDetail: 'Showing 2025 evidence while the league is in 2026 · Preseason.',
};

const STALE_SEASON_META = {
  ...SEASON_META,
  currentSeason: 2027,
  forwardRankingSeason: 2027,
  currentPhase: 'offseason' as const,
  currentPhaseLabel: '2027 · Offseason',
  targetSeason: null,
  targetWeek: null,
  targetLabel: null,
  scheduleSource: null,
  configStatus: 'stale_calendar_config' as const,
  configNote: 'NFL season calendar ends after 2026.',
  evidenceSeason: null,
  evidenceWeek: null,
  generatedAt: null,
  isArchiveView: false,
  status: 'season_calendar_config_stale',
  statusDetail: 'NFL season calendar ends after 2026.',
};

function wellFormedItem(overrides: Record<string, unknown> = {}) {
  return {
    rank: 1,
    playerId: '00-0036322',
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

  it('renders the error state for a malformed 2xx response with page-unsafe nested shapes', async () => {
    // sourceStack: [null] and an item missing `explanation` both previously crashed
    // rather than being rejected at the boundary.
    mockFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
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

  it('clears a retained season and omits it from the actual request when the mounted page becomes stale', async () => {
    const fetchMock = mockFetch(async (url) => {
      const request = new URL(url, 'http://localhost');
      const requestedSeason = request.searchParams.get('season');

      if (requestedSeason === null) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
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
      return {
        ok: true,
        status: 200,
        json: async () => ({
          asOf: '2026-08-09T12:00:00.000Z',
          seasonMeta: {
            ...SEASON_META,
            evidenceSeason,
            evidenceWeek: evidenceSeason === 2025 ? 18 : 1,
            isArchiveView: evidenceSeason !== 2026,
            status: evidenceSeason === 2026 ? null : 'archive_season_not_current',
            statusDetail:
              evidenceSeason === 2026
                ? null
                : 'Showing 2025 evidence while the forward board targets 2026 (2026 · Preseason).',
          },
          sourceStack: [{ layer: 'forge' }],
          trust: { sampleNote: null, stabilityNote: null },
          items: [wellFormedItem()],
        }),
      };
    });
    const { queryClient } = renderContainer();

    expect(await screen.findByText('Justin Jefferson')).toBeTruthy();
    fireEvent.click(screen.getByTestId('season-2025'));
    await waitFor(() => {
      expect(screen.getByTestId('season-2025').getAttribute('aria-pressed')).toBe('true');
      expect(
        fetchMock.mock.calls.some(([input]) => {
          const url = String(input);
          return (
            url.includes('/api/rankings/v2/weekly') &&
            new URL(url, 'http://localhost').searchParams.get('season') === '2025'
          );
        }),
      ).toBe(true);
    });

    const rankingsCallCountBeforeStale = fetchMock.mock.calls.filter(([input]) =>
      String(input).includes('/api/rankings/v2/weekly'),
    ).length;

    await act(async () => {
      queryClient.setQueryData(['/api/system/current-week'], STALE_CURRENT_WEEK);
    });

    expect(await screen.findByText('Season calendar unavailable')).toBeTruthy();
    const rankingsUrls = fetchMock.mock.calls
      .map(([input]) => String(input))
      .filter((url) => url.includes('/api/rankings/v2/weekly'));
    const staleTransitionUrls = rankingsUrls.slice(rankingsCallCountBeforeStale);
    expect(staleTransitionUrls).toHaveLength(1);
    expect(new URL(staleTransitionUrls[0], 'http://localhost').searchParams.has('season')).toBe(false);
    expect(screen.queryByText('No players match this filter yet.')).toBeNull();
    expect(screen.queryByText('0 players')).toBeNull();
    expect(screen.queryByText('Rankings are not available yet')).toBeNull();
    expect(screen.queryByText(/FORGE grades for this filter/i)).toBeNull();

    // The effect clears the retained 2025 choice, not merely masks it while
    // stale. Once configured state returns, the detected 2026 season wins.
    await act(async () => {
      queryClient.setQueryData(['/api/system/current-week'], FRESH_CURRENT_WEEK);
    });
    await waitFor(() => {
      expect(screen.getByTestId('season-2026').getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByTestId('season-2025').getAttribute('aria-pressed')).toBe('false');
    });
  });

  it('renders the genuine-empty state for a valid, explicitly empty response', async () => {
    mockFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
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

  it('renders Forecast/scoring data with the source-specific headline and Expected/VORP labels', async () => {
    mockFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
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
});
