/**
 * @jest-environment jsdom
 *
 * Fantasy #307 — StrategyTab must consume the decision target as a
 * SEASON-AND-WEEK pair.
 *
 * The regression: the tab read `targetWeek` and discarded its paired
 * `targetSeason`, so /start-sit and /targets omitted `season` — and the
 * server's legacy default filled in 2025. During the 2026 preseason the UI
 * therefore presented the 2026 Week 1 forward target over recommendations
 * computed from 2025 football. A week number without its season is not a
 * target, and these tests drive the real chain (component -> useQuery ->
 * fetch) to prove both halves travel together, share the cache key, and gate
 * the request when either is unresolved.
 */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import StrategyTab from '../StrategyTab';

type FetchCall = { url: string };

const CURRENT_WEEK_BASE = {
  currentWeek: 0,
  weekStatus: 'not_started',
  mondayNightCompleted: null,
  weekStartDate: '2026-09-10T20:00:00.000Z',
  weekEndDate: '2026-09-16T04:00:00.000Z',
  gamesCompleted: null,
  totalGames: 16,
  upcomingWeek: null,
  success: true,
  phaseLabel: 'Preseason',
  regularSeasonWeek: null,
  targetLabel: 'Target: Week 1',
  scheduleSource: 'anchor_derived',
  targetProvenance: 'anchor_derived',
  targetIsProvisional: true,
  configStatus: 'ok',
  configNote: null,
};

let fetchCalls: FetchCall[];

function mockFetch(currentWeek: Record<string, unknown>) {
  fetchCalls = [];
  (global as any).fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    fetchCalls.push({ url });
    if (url.includes('/api/system/current-week')) {
      return { ok: true, status: 200, json: async () => currentWeek };
    }
    // Strategy endpoints: shape does not matter for these tests; the URL does.
    return { ok: true, status: 200, json: async () => ({ recommendations: [], targets: [] }) };
  });
}

function renderTab() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    React.createElement(QueryClientProvider, { client }, React.createElement(StrategyTab)),
  );
}

const strategyCalls = (path: string) => fetchCalls.filter((c) => c.url.includes(path));

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe('StrategyTab sends the decision target as season AND week', () => {
  it('2026 preseason targeting 2026 Week 1: both requests carry season=2026&week=1', async () => {
    mockFetch({
      ...CURRENT_WEEK_BASE,
      season: 2026,
      phase: 'preseason',
      seasonPhaseLabel: '2026 · Preseason',
      targetSeason: 2026,
      targetWeek: 1,
    });
    renderTab();

    await waitFor(() => expect(strategyCalls('/api/strategy/start-sit').length).toBeGreaterThan(0));
    const startSitUrl = new URL(strategyCalls('/api/strategy/start-sit')[0].url, 'http://localhost');
    // The defect: `season` was absent here, and the server defaulted it to
    // 2025 under a UI that said 2026 Week 1.
    expect(startSitUrl.searchParams.get('season')).toBe('2026');
    expect(startSitUrl.searchParams.get('week')).toBe('1');

    fireEvent.click(screen.getByTestId('button-strategy-waivers'));
    await waitFor(() => expect(strategyCalls('/api/strategy/targets').length).toBeGreaterThan(0));
    const waiverUrl = new URL(strategyCalls('/api/strategy/targets')[0].url, 'http://localhost');
    expect(waiverUrl.searchParams.get('season')).toBe('2026');
    expect(waiverUrl.searchParams.get('week')).toBe('1');
  });

  it('2025 postseason rollover targeting 2026 Week 1: the TARGET season is sent, not the phase season', async () => {
    // The pair the rollover makes treacherous: the league is IN 2025 (phase
    // season) while the forward board targets 2026 Week 1. Sending the phase
    // season here would be the same defect with a different wrong year.
    mockFetch({
      ...CURRENT_WEEK_BASE,
      season: 2025,
      phase: 'postseason',
      seasonPhaseLabel: '2025 · Postseason',
      targetSeason: 2026,
      targetWeek: 1,
    });
    renderTab();

    await waitFor(() => expect(strategyCalls('/api/strategy/start-sit').length).toBeGreaterThan(0));
    const url = new URL(strategyCalls('/api/strategy/start-sit')[0].url, 'http://localhost');
    expect(url.searchParams.get('season')).toBe('2026');
    expect(url.searchParams.get('week')).toBe('1');
  });

  it('identical week numbers in different seasons produce distinct URLs and query keys', async () => {
    // Week 1 of 2025 and Week 1 of 2026 are the same week number about
    // different football. The URL must differ, and — because the query key
    // now carries the season — the cache entries must be distinct, so one
    // season's recommendations can never be served under the other's label.
    mockFetch({
      ...CURRENT_WEEK_BASE,
      season: 2025,
      phase: 'regular_season',
      seasonPhaseLabel: '2025 · Week 1',
      regularSeasonWeek: 1,
      targetSeason: 2025,
      targetWeek: 1,
    });
    const first = renderTab();
    await waitFor(() => expect(strategyCalls('/api/strategy/start-sit').length).toBeGreaterThan(0));
    const url2025 = strategyCalls('/api/strategy/start-sit')[0].url;
    first.unmount();

    mockFetch({
      ...CURRENT_WEEK_BASE,
      season: 2026,
      phase: 'preseason',
      seasonPhaseLabel: '2026 · Preseason',
      targetSeason: 2026,
      targetWeek: 1,
    });
    renderTab();
    await waitFor(() => expect(strategyCalls('/api/strategy/start-sit').length).toBeGreaterThan(0));
    const url2026 = strategyCalls('/api/strategy/start-sit')[0].url;

    expect(url2025).not.toBe(url2026);
    expect(new URL(url2025, 'http://localhost').searchParams.get('season')).toBe('2025');
    expect(new URL(url2026, 'http://localhost').searchParams.get('season')).toBe('2026');
    // Same week number both times — the season is the only distinguisher.
    expect(new URL(url2025, 'http://localhost').searchParams.get('week')).toBe('1');
    expect(new URL(url2026, 'http://localhost').searchParams.get('week')).toBe('1');
  });

  it('an unresolved target season disables both requests', async () => {
    // A resolved week with an unresolved season is still an unresolved
    // TARGET. Relying on the server's legacy season default would silently
    // re-ask the 2025 question, so neither request may fire at all.
    mockFetch({
      ...CURRENT_WEEK_BASE,
      season: 2025,
      phase: 'offseason',
      seasonPhaseLabel: '2025 · Offseason',
      targetSeason: null,
      targetWeek: 1,
    });
    renderTab();

    // The current-week request itself must complete before absence means gated.
    await waitFor(() =>
      expect(fetchCalls.some((c) => c.url.includes('/api/system/current-week'))).toBe(true),
    );
    fireEvent.click(screen.getByTestId('button-strategy-waivers'));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(strategyCalls('/api/strategy/start-sit')).toEqual([]);
    expect(strategyCalls('/api/strategy/targets')).toEqual([]);
  });

  it('an unresolved target week also disables both requests', async () => {
    mockFetch({
      ...CURRENT_WEEK_BASE,
      season: 2026,
      phase: 'offseason',
      seasonPhaseLabel: '2026 · Offseason',
      targetSeason: 2026,
      targetWeek: null,
    });
    renderTab();

    await waitFor(() =>
      expect(fetchCalls.some((c) => c.url.includes('/api/system/current-week'))).toBe(true),
    );
    fireEvent.click(screen.getByTestId('button-strategy-waivers'));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(strategyCalls('/api/strategy/start-sit')).toEqual([]);
    expect(strategyCalls('/api/strategy/targets')).toEqual([]);
  });
});
