/** @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TiberDraftReview, { type DraftReview } from '@/pages/TiberDraftReview';

jest.mock('@/pages/TiberDraftReview.css', () => ({}));
// Wouter's ESM history hook is mocked at its browser boundary; retain reactive URL semantics.
jest.mock('wouter/use-browser-location', () => ({
  useSearch: () => React.useSyncExternalStore(
    (listener) => { window.addEventListener('popstate', listener); return () => window.removeEventListener('popstate', listener); },
    () => window.location.search,
  ),
}));

const originalFetch = global.fetch;
const canonical = (id = 1) => `https://sleeper.com/roster/123/${id}`;
function roster(id = 1): DraftReview {
  return {
    schema_version: 'tiber_draft_review_v0_1', generated_at: '2026-09-10T00:00:00Z',
    input: { canonicalUrl: canonical(id), leagueId: '123', rosterId: id },
    observed: {
      league: { name: 'Synthetic league', season: '2026', total_rosters: 2, league_mode: 'redraft', scoring_format: 'ppr', lineup_slots: { WR: 1, FLEX: 1, BN: 1 },
        reserve: { configured_slots: 1, occupied_slots: 0, open_slots: 1, configured_eligibility: { out: true, doubtful: false, not_active: null }, current_player_eligibility: { status: 'unavailable', reason: 'Unavailable' } } },
      team: { display_name: `Synthetic team ${id}`, manager_name: null, roster_id: id },
      current_roster: [
        { player_id: '11', name: 'First WR', position: 'WR', team: null, status: null, active: null, roster_state: 'starter' },
        { player_id: '22', name: 'Second WR', position: 'WR', team: 'B', status: null, active: null, roster_state: 'bench' },
        { player_id: 'NE', name: 'Synthetic defense', position: 'DEF', team: 'NE', status: null, active: null, roster_state: 'bench' },
        { player_id: '44', name: 'Synthetic kicker', position: 'K', team: 'C', status: null, active: null, roster_state: 'bench' },
      ],
      draft: { status: 'unavailable', reason: 'No draft reported', draft_id: null, picks: [] },
    },
    derived: { roster_count: 4, starter_count: 1, bench_count: 3, reserve_count: 0, position_counts: { WR: 2, K: 1, DEF: 1 }, roster_flags: ['One starting slot is unfilled'], bye_week_geometry: { status: 'unavailable', reason: 'No bye evidence', fabricated_values: false }, decision_context: { league_mode: 'redraft', scoring_format: 'ppr', lineup_slots: { WR: 1, FLEX: 1, BN: 1 }, evaluation_horizons: [] } },
    forecast: { status: 'unavailable', reason: 'Forecast evidence unavailable', requested_horizons: [], fabricated_values: false },
    provenance: { authority: 'Synthetic test', disclosures: [] },
  };
}
const selection = { status: 'team_selection_required', league: { league_id: '123', name: 'Synthetic league', season: '2026', total_rosters: 2 }, teams: [1, 2].map(id => ({ roster_id: id, display_name: `Synthetic team ${id}`, manager_name: null, canonicalUrl: canonical(id) })) };
function response(body: unknown, status = 200) { return { ok: status < 400, status, json: async () => body } as Response; }
function serve(input: string): Response {
  const url = new URL(input, window.location.origin);
  if (url.pathname === '/api/draft-review/evidence') return response({ schema_version: 'tiber_draft_review_historical_v1', status: 'unavailable', reason: 'No admitted history', players: [] });
  if (url.pathname === '/api/draft-review/resolve') {
    const value = url.searchParams.get('sleeper_input')!;
    return response(value.includes('/roster/') ? { status: 'roster_resolved', canonicalUrl: value } : selection);
  }
  if (url.pathname === '/api/draft-review') return response(roster(Number(url.searchParams.get('sleeper_url')!.split('/').pop())));
  throw new Error(`Unexpected request outside public Draft Review: ${url.pathname}`);
}
function open(path = '/team', key = 'sleeper_url', value = canonical()) {
  window.history.replaceState({}, '', `${path}${value ? `?${key}=${encodeURIComponent(value)}` : ''}`);
  return render(React.createElement(React.StrictMode, null, React.createElement(TiberDraftReview)));
}
async function loaded(id = 1) { await screen.findByRole('heading', { name: `Synthetic team ${id}` }); }
beforeEach(() => {
  window.history.replaceState({}, '', '/team');
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method].bind(window.history);
    jest.spyOn(window.history, method).mockImplementation((...args) => { original(...args); window.dispatchEvent(new PopStateEvent('popstate')); });
  }
  global.fetch = jest.fn(async input => serve(String(input)));
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn(async () => undefined) } });
  jest.spyOn(window, 'confirm').mockReturnValue(true);
});
afterEach(() => { cleanup(); jest.restoreAllMocks(); global.fetch = originalFetch; });

test.each(['/team', '/draft-review'])('%s keeps both legacy query names and truthful roster groups', async path => {
  const mounted = open(path, 'sleeper_input');
  await loaded();
  expect(window.location.pathname).toBe(path);
  expect(new URLSearchParams(window.location.search).get('sleeper_url')).toBe(canonical());
  expect(screen.getByRole('heading', { name: 'TIBER Team' })).toBeTruthy();
  for (const name of ['Starters · 1', 'Bench · 3', 'Reserve · 0', 'Taxi · 0']) expect(screen.getByRole('heading', { name })).toBeTruthy();
  expect(screen.getAllByText('None reported')).toHaveLength(2);
  expect(screen.getByText('Allowed')).toBeTruthy();
  expect(screen.getByText('Not allowed')).toBeTruthy();
  expect(screen.getAllByText('Unknown').length).toBeGreaterThanOrEqual(2);
  expect(screen.queryByText('FA')).toBeNull();
  expect(screen.getByText('Synthetic defense')).toBeTruthy();
  expect(screen.getByText('Synthetic kicker')).toBeTruthy();
  expect(screen.getByText('No draft reported')).toBeTruthy();
  mounted.unmount();
  open(path); // A fresh browser load of the canonical query works too.
  await loaded();
});

test.each(['123', 'https://sleeper.com/leagues/123', 'https://sleeper.com/draft/nfl/456'])('resolves %s, changes roster and league without ownership or persisted state', async input => {
  open('/team', 'sleeper_input', input);
  await screen.findByRole('heading', { name: 'Choose a roster' });
  fireEvent.click(screen.getByRole('button', { name: 'Synthetic team 1 Roster 1' }));
  await loaded();
  fireEvent.click(screen.getByRole('button', { name: 'Change roster' }));
  await screen.findByRole('heading', { name: 'Choose a roster' });
  expect(screen.queryByRole('heading', { name: 'Synthetic team 1' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Synthetic team 2 Roster 2' }));
  await loaded(2);
  fireEvent.click(screen.getByRole('button', { name: 'Change league' }));
  expect(screen.queryByRole('heading', { name: 'Synthetic team 2' })).toBeNull();
  expect(window.location.search).toBe('');
  expect(document.activeElement).toBe(screen.getByLabelText('Sleeper link or league ID'));
});

test('link is a locator; snapshot includes local judgment, which refresh warns about and clears', async () => {
  open(); await loaded();
  await screen.findByText('No admitted history');
  fireEvent.change(screen.getByLabelText('My reasoning'), { target: { value: 'Synthetic local reasoning' } });
  fireEvent.change(screen.getByLabelText('My preference'), { target: { value: '11' } });
  fireEvent.click(screen.getByRole('button', { name: 'Copy roster link' }));
  await screen.findByText('Roster link copied');
  const link = new URL((navigator.clipboard.writeText as jest.Mock).mock.calls[0][0]);
  expect(link.pathname).toBe('/team');
  expect([...link.searchParams]).toEqual([['sleeper_url', canonical()]]);
  fireEvent.click(screen.getByRole('button', { name: 'Copy agent context' }));
  await screen.findByText('Agent context copied');
  const packet = JSON.parse((navigator.clipboard.writeText as jest.Mock).mock.calls[1][0]);
  expect(packet.context.input.canonicalUrl).toBe(canonical());
  expect(packet.operator_context).toMatchObject({ kind: 'manager_judgment', note: 'Synthetic local reasoning', preferred_player_id: '11' });
  expect(JSON.stringify((global.fetch as jest.Mock).mock.calls)).not.toContain('Synthetic local reasoning');
  (window.confirm as jest.Mock).mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh roster' }));
  expect((screen.getByLabelText('My reasoning') as HTMLTextAreaElement).value).toBe('Synthetic local reasoning');
  (window.confirm as jest.Mock).mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh roster' }));
  expect(screen.queryByRole('button', { name: 'Copy agent context' })).toBeNull();
  await loaded();
  expect((screen.getByLabelText('My reasoning') as HTMLTextAreaElement).value).toBe('');
  expect((screen.getByLabelText('My preference') as HTMLSelectElement).value).toBe('');
});

test('query navigation invalidates an older pending roster and clearing the link clears the page', async () => {
  const pending: Array<(value: Response) => void> = [];
  global.fetch = jest.fn(async input => String(input).startsWith('/api/draft-review?') ? new Promise<Response>(resolve => pending.push(resolve)) : serve(String(input)));
  open();
  await waitFor(() => expect(pending).toHaveLength(1));
  act(() => window.history.pushState({}, '', `/team?sleeper_url=${encodeURIComponent(canonical(2))}`));
  await waitFor(() => expect(pending).toHaveLength(2));
  await act(async () => pending[1](response(roster(2))));
  await loaded(2);
  await act(async () => pending[0](response(roster(1))));
  expect(screen.queryByRole('heading', { name: 'Synthetic team 1' })).toBeNull();
  act(() => { window.history.replaceState({}, '', '/team'); window.dispatchEvent(new PopStateEvent('popstate')); });
  expect(screen.queryByRole('heading', { name: 'Synthetic team 2' })).toBeNull();
});

test('rate limit retry, empty selector and clipboard denial are explicit', async () => {
  global.fetch = jest.fn(async () => response({ error: 'Too many requests. Try again later.' }, 429));
  open();
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: 'Copy roster link' })).toBeNull();
  global.fetch = jest.fn(async () => response({ ...selection, teams: [] }));
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByText('No rosters were reported for this league. Try again or enter another league.');
  global.fetch = jest.fn(async input => serve(String(input)));
  fireEvent.click(screen.getByRole('button', { name: 'Load roster' }));
  await loaded();
  (navigator.clipboard.writeText as jest.Mock).mockRejectedValue(new Error('Denied'));
  fireEvent.click(screen.getByRole('button', { name: 'Copy agent context' }));
  await screen.findByText('Could not copy. Check clipboard access and try again.');
  expect(screen.queryByText('Agent context copied')).toBeNull();
});

test('browser back and forward reload the matching roster without carrying local notes', async () => {
  open(); await loaded();
  fireEvent.change(screen.getByLabelText('My reasoning'), { target: { value: 'Unsaved synthetic note' } });
  act(() => window.history.pushState({}, '', `/team?sleeper_url=${encodeURIComponent(canonical(2))}`));
  await loaded(2);
  act(() => window.history.back());
  await loaded(1);
  expect((screen.getByLabelText('My reasoning') as HTMLTextAreaElement).value).toBe('');
  act(() => window.history.forward());
  await loaded(2);
});
