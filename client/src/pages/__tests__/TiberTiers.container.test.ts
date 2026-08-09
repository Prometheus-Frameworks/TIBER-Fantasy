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
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TiberTiers from '../TiberTiers';

function currentWeekResponse() {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: async () => ({
      currentWeek: 5,
      season: 2025,
      weekStatus: 'in_progress',
      mondayNightCompleted: false,
      weekStartDate: '2026-04-06',
      weekEndDate: '2026-04-12',
      gamesCompleted: 8,
      totalGames: 16,
      upcomingWeek: 6,
      success: true,
    }),
  });
}

function mockFetch(rankingsResponse: () => Promise<{ ok: boolean; status?: number; json: () => Promise<unknown> }>) {
  (global as any).fetch = jest.fn((input: unknown) => {
    const url = String(input);
    if (url.includes('/api/system/current-week')) return currentWeekResponse();
    if (url.includes('/api/rankings/v2/weekly')) return rankingsResponse();
    return Promise.reject(new Error(`Unexpected fetch call in test: ${url}`));
  });
}

function renderContainer() {
  // TiberTiers.tsx's own useQuery call sets `retry: 1` (a deliberate production reliability
  // choice, left untouched here), which overrides this QueryClient's `retry` default — but
  // not `retryDelay`, so keeping that at 0 keeps the one retry from adding TanStack Query's
  // exponential backoff wait to every error-path test.
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } });
  return render(
    React.createElement(QueryClientProvider, { client: queryClient }, React.createElement(TiberTiers)),
  );
}

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

  it('renders the genuine-empty state for a valid, explicitly empty response', async () => {
    mockFetch(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          asOf: '2026-04-12T00:00:00.000Z',
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
