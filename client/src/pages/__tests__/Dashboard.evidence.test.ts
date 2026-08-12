/**
 * @jest-environment jsdom
 *
 * Fantasy #307 — the Dashboard aggregate is RETROSPECTIVE, so its season is
 * the SOURCE-DECLARED evidence season, not the forward decision season.
 *
 * The regression: /lab-agg was queried by `resolvedSeason` — the forward
 * decision context. During the 2026 preseason that asked the snapshot store
 * for 2026 football it does not hold, and the empty answer rendered as zeros
 * under a current-looking heading. The pipeline's own health report declares
 * what it has actually snapshotted (`latestSnapshot.season`), and that is the
 * only season the aggregate may be asked for. These tests drive the real
 * chain (component -> useQuery -> fetch) with a mocked network layer only.
 */
import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from '../Dashboard';

const LAB_PLAYER = {
  playerName: 'Amon-Ra St. Brown',
  teamId: 'DET',
  position: 'WR',
  gamesPlayed: 16,
  totalFptsPpr: 320,
  avgEpaPerTarget: 0.42,
  totalTargets: 140,
};

const CURRENT_WEEK_2026_PRESEASON = {
  currentWeek: 0,
  season: 2026,
  weekStatus: 'not_started',
  mondayNightCompleted: null,
  weekStartDate: '2026-09-10T20:00:00.000Z',
  weekEndDate: '2026-09-16T04:00:00.000Z',
  gamesCompleted: null,
  totalGames: 16,
  upcomingWeek: null,
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
};

type Scenario = {
  health: Record<string, unknown>;
  labAggOk?: boolean;
  currentWeek?: Record<string, unknown>;
  /** Rows the (successful) lab-agg response carries. Defaults to one row. */
  labAggData?: unknown[];
  /** Never resolves the lab-agg fetch — for pinning the pending/loading state. */
  labAggPending?: boolean;
};

let fetchCalls: string[];

function mockFetch(scenario: Scenario) {
  fetchCalls = [];
  (global as any).fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    fetchCalls.push(url);
    if (url.includes('/api/system/current-week')) {
      return { ok: true, status: 200, json: async () => scenario.currentWeek ?? CURRENT_WEEK_2026_PRESEASON };
    }
    if (url.includes('/api/data-lab/health')) {
      return { ok: true, status: 200, json: async () => scenario.health };
    }
    if (url.includes('/api/data-lab/lab-agg')) {
      if (scenario.labAggPending) {
        return new Promise(() => {}); // deliberately never resolves
      }
      if (scenario.labAggOk === false) {
        return { ok: false, status: 500, json: async () => ({ data: [LAB_PLAYER], count: 1 }) };
      }
      const rows = scenario.labAggData ?? [LAB_PLAYER];
      return { ok: true, status: 200, json: async () => ({ data: rows, count: rows.length }) };
    }
    if (url.includes('/api/data-lab/command-center')) {
      return { ok: false, status: 503, json: async () => ({}) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
}

function renderDashboard() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        // Mirror the app's default queryFn: queries without their own queryFn
        // (the health query) fetch queryKey[0].
        queryFn: async ({ queryKey }) => {
          const res = await (global as any).fetch(String(queryKey[0]));
          if (!res.ok) throw new Error(`request failed: ${res.status}`);
          return res.json();
        },
      },
    },
  });
  render(React.createElement(QueryClientProvider, { client }, React.createElement(Dashboard)));
  return client;
}

const labAggCalls = () => fetchCalls.filter((u) => u.includes('/api/data-lab/lab-agg'));

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe('the Dashboard aggregate uses the source-declared evidence season', () => {
  it('2026 preseason with a latest official 2025 snapshot requests season=2025, never 2026', async () => {
    mockFetch({
      health: { status: 'healthy', latestSnapshot: { season: 2025, week: 18, rowCount: 5000 } },
    });
    renderDashboard();

    await waitFor(() => expect(labAggCalls().length).toBeGreaterThan(0));
    const url = new URL(labAggCalls()[0], 'http://localhost');
    // The defect: this carried the forward decision season 2026, asking the
    // snapshot store for football it does not hold.
    expect(url.searchParams.get('season')).toBe('2025');
    expect(labAggCalls().some((u) => new URL(u, 'http://localhost').searchParams.get('season') === '2026'))
      .toBe(false);

    // And the surface says which football it is showing: the evidence season,
    // so the 2026 decision context cannot make 2025 evidence look current.
    const label = await screen.findByTestId('snapshot-evidence-season');
    expect(label.textContent).toMatch(/2025 evidence/);
    expect(label.textContent).not.toMatch(/2026/);
  });

  it('when decision and evidence seasons are both 2026 it requests 2026 normally', async () => {
    mockFetch({
      health: { status: 'healthy', latestSnapshot: { season: 2026, week: 3, rowCount: 900 } },
    });
    renderDashboard();

    await waitFor(() => expect(labAggCalls().length).toBeGreaterThan(0));
    expect(new URL(labAggCalls()[0], 'http://localhost').searchParams.get('season')).toBe('2026');
    expect((await screen.findByTestId('snapshot-evidence-season')).textContent).toMatch(/2026 evidence/);
  });

  it('no official snapshot fires no aggregate request and renders unavailable, not zeros', async () => {
    mockFetch({ health: { status: 'degraded' } });
    renderDashboard();

    // Health must have answered before absence means gated rather than pending.
    await waitFor(() => expect(fetchCalls.some((u) => u.includes('/api/data-lab/health'))).toBe(true));
    expect(await screen.findByTestId('snapshot-evidence-unavailable')).toBeTruthy();

    // No aggregate request was made with any season — there is no evidence
    // season to ask about, and the decision season must not stand in.
    expect(labAggCalls()).toEqual([]);
    // And the unavailable state never renders as a searched-and-empty board.
    expect(screen.queryByText('No players found')).toBeNull();
    expect(screen.queryByTestId('snapshot-evidence-season')).toBeNull();
  });

  it('a non-OK aggregate response is surfaced as unavailable, not parsed as data', async () => {
    // The body even contains a plausible player row; parsing it anyway is the
    // defect this case pins.
    mockFetch({
      health: { status: 'healthy', latestSnapshot: { season: 2025, week: 18, rowCount: 5000 } },
      labAggOk: false,
    });
    renderDashboard();

    await waitFor(() => expect(labAggCalls().length).toBeGreaterThan(0));
    expect(await screen.findByTestId('snapshot-evidence-unavailable')).toBeTruthy();
    expect(screen.queryByText('Amon-Ra St. Brown')).toBeNull();
    expect(screen.queryByText('No players found')).toBeNull();
  });

  it('changing the evidence season changes the query key', async () => {
    mockFetch({
      health: { status: 'healthy', latestSnapshot: { season: 2025, week: 18, rowCount: 5000 } },
    });
    const client2025 = renderDashboard();
    await waitFor(() => expect(labAggCalls().length).toBeGreaterThan(0));
    const keys2025 = client2025
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey)
      .filter((k) => k[0] === '/api/data-lab/lab-agg');
    expect(keys2025).toEqual([['/api/data-lab/lab-agg', 'WR', 2025]]);
    cleanup();

    mockFetch({
      health: { status: 'healthy', latestSnapshot: { season: 2026, week: 3, rowCount: 900 } },
    });
    const client2026 = renderDashboard();
    await waitFor(() => expect(labAggCalls().length).toBeGreaterThan(0));
    const keys2026 = client2026
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey)
      .filter((k) => k[0] === '/api/data-lab/lab-agg');
    // Distinct keys: one evidence season's aggregate can never be served from
    // the other's cache entry.
    expect(keys2026).toEqual([['/api/data-lab/lab-agg', 'WR', 2026]]);
  });
});

describe('the snapshot lifecycle propagates into DataLabDiscoveryWidget (Fantasy #307 correction round 5)', () => {
  // The regression: the Dashboard could say "snapshot evidence unavailable"
  // in the Player Snapshot section while the widget above it rendered
  // measured-looking `0` Players/Avg PPG/Elite from the same unresolved or
  // failed aggregate. `widget-fallback-summary`'s `data-summary-state`
  // attribute is the stable signal these tests pin against.
  const summaryState = async () => (await screen.findByTestId('widget-fallback-summary')).getAttribute('data-summary-state');

  it('no snapshot: the widget summary is unavailable, not zeroed', async () => {
    mockFetch({ health: { status: 'degraded' } });
    renderDashboard();

    expect(await screen.findByTestId('snapshot-evidence-unavailable')).toBeTruthy();
    expect(await summaryState()).toBe('unavailable');
    expect((await screen.findByTestId('widget-metric-players')).textContent).toBe('—');
  });

  it('a failed aggregate request: the widget summary is unavailable', async () => {
    mockFetch({
      health: { status: 'healthy', latestSnapshot: { season: 2025, week: 18, rowCount: 5000 } },
      labAggOk: false,
    });
    renderDashboard();

    expect(await screen.findByTestId('snapshot-evidence-unavailable')).toBeTruthy();
    expect(await summaryState()).toBe('unavailable');
  });

  it('a pending aggregate: the widget summary is loading, distinct from resolved-unavailable or resolved-empty', async () => {
    mockFetch({
      health: { status: 'healthy', latestSnapshot: { season: 2025, week: 18, rowCount: 5000 } },
      labAggPending: true,
    });
    renderDashboard();

    // Health has answered (so the health-loading window has passed) and the
    // lab-agg request is in flight but deliberately never resolves.
    await waitFor(() => expect(labAggCalls().length).toBeGreaterThan(0));
    expect(await summaryState()).toBe('loading');
    expect((await screen.findByTestId('widget-metric-players')).textContent).toBe('—');
    expect(screen.queryByTestId('snapshot-evidence-unavailable')).toBeNull();
  });

  it('a successfully resolved, genuinely EMPTY aggregate: the widget summary is available with real 0 / 0 / 0', async () => {
    mockFetch({
      health: { status: 'healthy', latestSnapshot: { season: 2025, week: 18, rowCount: 5000 } },
      labAggData: [],
    });
    renderDashboard();

    await waitFor(() => expect(labAggCalls().length).toBeGreaterThan(0));
    expect(await summaryState()).toBe('available');
    await waitFor(() => {
      expect(screen.getByTestId('widget-metric-players').textContent).toBe('0');
    });
    expect(screen.getByTestId('widget-metric-avg-ppg').textContent).toBe('0');
    expect(screen.getByTestId('widget-metric-elite').textContent).toBe('0');
    expect(screen.queryByTestId('snapshot-evidence-unavailable')).toBeNull();
  });

  it('a populated aggregate: the widget summary is available with the real measured numbers', async () => {
    mockFetch({
      health: { status: 'healthy', latestSnapshot: { season: 2025, week: 18, rowCount: 5000 } },
      labAggData: [LAB_PLAYER],
    });
    renderDashboard();

    await waitFor(() => expect(labAggCalls().length).toBeGreaterThan(0));
    expect(await summaryState()).toBe('available');
    await waitFor(() => {
      expect(screen.getByTestId('widget-metric-players').textContent).toBe('1');
    });
    // Real PPG for a 16-game, 320-point player, not an em dash or a zero.
    expect(screen.getByTestId('widget-metric-avg-ppg').textContent).not.toBe('—');
    expect(screen.getByTestId('widget-metric-avg-ppg').textContent).not.toBe('0');
  });
});
