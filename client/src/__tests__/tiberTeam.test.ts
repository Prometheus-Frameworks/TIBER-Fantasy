/** @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  if (url.pathname === '/api/draft-review/matchup') return response({ error: 'Matchup unavailable in fixture' }, 502);
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
async function loaded(id = 1) { await screen.findByRole('heading', { name: `Synthetic team ${id}` }); fireEvent.click(screen.getByRole('button', { name: 'Team board', exact: true })); }
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
  expect(within(screen.getByRole('region', { name: 'Team board' })).getByText('Allowed')).toBeTruthy();
  expect(within(screen.getByRole('region', { name: 'Team board' })).getByText('Not allowed')).toBeTruthy();
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

test('link is a locator; snapshot includes optional geometry, which refresh warns about and clears', async () => {
  open(); await loaded();
  await screen.findByText('No admitted history');
  fireEvent.change(screen.getByLabelText('Outgoing player 1'), { target: { value: '11' } });
  fireEvent.click(screen.getByRole('button', { name: 'Settings', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Copy roster link' }));
  await screen.findByText('Roster link copied');
  const link = new URL((navigator.clipboard.writeText as jest.Mock).mock.calls[0][0]);
  expect(link.pathname).toBe('/team');
  expect([...link.searchParams]).toEqual([['sleeper_url', canonical()]]);
  fireEvent.click(screen.getByRole('button', { name: 'Settings', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Copy agent context' }));
  await screen.findByText('Agent context copied');
  const packet = JSON.parse((navigator.clipboard.writeText as jest.Mock).mock.calls[1][0]);
  expect(packet.context.input.canonicalUrl).toBe(canonical());
  expect(packet.operator_context).toMatchObject({ kind: 'manager_judgment', note: '', preferred_player_id: null });
  expect(packet.study.hypothetical_roster).not.toBeNull();
  (window.confirm as jest.Mock).mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh roster' }));
  expect((screen.getByLabelText('Outgoing player 1') as HTMLSelectElement).value).toBe('11');
  (window.confirm as jest.Mock).mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh roster' }));
  expect(screen.queryByRole('button', { name: 'Copy agent context' })).toBeNull();
  await loaded();
  expect((screen.getByLabelText('Outgoing player 1') as HTMLSelectElement).value).toBe('');
  expect(screen.queryByLabelText('My preference')).toBeNull();
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
  await screen.findByText('No admitted history');
  (navigator.clipboard.writeText as jest.Mock).mockRejectedValue(new Error('Denied'));
  fireEvent.click(screen.getByRole('button', { name: 'Settings', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Copy agent context' }));
  await screen.findByText('Could not copy. Check clipboard access and try again.');
  expect(screen.queryByText('Agent context copied')).toBeNull();
});

test('browser back and forward reload the matching roster without carrying local geometry', async () => {
  open(); await loaded();
  fireEvent.change(screen.getByLabelText('Outgoing player 1'), { target: { value: '11' } });
  act(() => window.history.pushState({}, '', `/team?sleeper_url=${encodeURIComponent(canonical(2))}`));
  await loaded(2);
  act(() => window.history.back());
  await loaded(1);
  expect((screen.getByLabelText('Outgoing player 1') as HTMLSelectElement).value).toBe('');
  act(() => window.history.forward());
  await loaded(2);
});


test('discussion exports selected evidence and rejects stale clipboard success after selection changes', async () => {
  open(); await loaded(); await screen.findByText('No admitted history');
  let finish!: () => void;
  (navigator.clipboard.writeText as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: 'Discuss this comparison' }));
  const packet = JSON.parse((navigator.clipboard.writeText as jest.Mock).mock.calls[0][0]);
  expect(packet.study.comparison.selected_player_ids).toEqual(['11', '22']);
  expect(packet.instruction).toContain('Ask the manager what decision and time horizon');
  expect(packet.operator_context).toMatchObject({ note: '', preferred_player_id: null });
  fireEvent.change(screen.getByLabelText('Comparison player 2'), { target: { value: '44' } });
  await act(async () => finish());
  expect(screen.queryByText('Comparison context copied')).toBeNull();
  (navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(new Error('Denied'));
  fireEvent.click(screen.getByRole('button', { name: 'Discuss this comparison' }));
  await screen.findByRole('alert');
});

test('roster refresh unmounts the TE explorer and ignores its late response', async () => {
  let finish!: (value: Response) => void;
  global.fetch = jest.fn((input) => String(input).includes('/unrostered-tes?')
    ? new Promise<Response>(resolve => { finish = resolve; }) : Promise.resolve(serve(String(input))));
  open(); await loaded();
  const details = screen.getByText('Explore unrostered TEs').closest('details')!;
  details.open = true; fireEvent(details, new Event('toggle'));
  await screen.findByText('Checking all league rosters…');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh roster' }));
  await loaded();
  await act(async () => finish(response({ error: 'old response' }, 502)));
  expect(screen.queryByText(/TE availability could not be established/)).toBeNull();
  expect(screen.getByText('Explore unrostered TEs').closest('details')!.open).toBe(false);
});

test('Chapter is the default room; Settings labels future rooms and locator versus snapshot without storage', async () => {
  open('/draft-review', 'sleeper_input');
  await screen.findByRole('heading', { name: 'Synthetic team 1' });
  expect(screen.getByRole('button', { name: 'Chapter', exact: true }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.getByRole('region', { name: 'Chapter' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Current roster' })).toBeNull();
  expect(screen.getByRole('heading', { name: '1 starting slot needs a look' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Discuss this pressure card' }));
  await screen.findByText('Pressure card and roster snapshot copied.');
  const packet = JSON.parse((navigator.clipboard.writeText as jest.Mock).mock.calls[0][0]);
  expect(packet.context.input.canonicalUrl).toBe(canonical());
  expect(packet.chapter.pressure_card.kind).toBe('unfilled_starting_slots');
  fireEvent.click(screen.getByRole('button', { name: 'Settings', exact: true }));
  expect(screen.getByRole('heading', { name: 'Not built yet' })).toBeTruthy();
  expect(screen.getByText(/Roster link = locator/)).toBeTruthy();
  expect(screen.getByText(/Selecting it does not verify ownership/)).toBeTruthy();
});

test('Chapter labels a bench designation without offering a starter replacement', async () => {
  global.fetch = jest.fn(async input => {
    if (!String(input).startsWith('/api/draft-review?')) return serve(String(input));
    const r = roster(); r.observed.league.lineup_slots = { WR: 1, BN: 3 };
    r.observed.current_roster[0].injury_status = null;
    r.observed.current_roster[1].injury_status = 'Out';
    return response(r);
  });
  open(); await screen.findByRole('heading', { name: 'Synthetic team 1' });
  expect(screen.getByRole('heading', { name: 'Second WR: Out' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Compare WR alternatives' })).toBeNull();
  const limits = screen.getByText('Reserve rules and evidence limits').closest('details')!;
  limits.open = true; fireEvent(limits, new Event('toggle'));
  expect(screen.getByText('Changes since your last visit are not available yet.')).toBeTruthy();
});


test('WR pressure opens a conditional comparison and closing removes its local state', async () => {
  const r=roster(); r.observed.league.lineup_slots={WR:1,BN:3};
  r.observed.current_roster[0].injury_status='Questionable';
  global.fetch=jest.fn(async input => String(input).startsWith('/api/draft-review?') ? response(r)
    : String(input).startsWith('/api/draft-review/wr-replacement?') ? response({},502) : serve(String(input)));
  open(); await screen.findByRole('heading',{name:'First WR: Questionable'});
  expect(screen.queryByRole('region',{name:'WR replacement outlook'})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'Compare WR alternatives'}));
  await screen.findByText('The WR pool could not be verified against this roster. Refresh your roster, then retry.');
  expect(screen.getByRole('region',{name:'WR replacement outlook'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:'Close WR alternatives'}));
  expect(screen.queryByRole('region',{name:'WR replacement outlook'})).toBeNull();
});

test('RB coverage card copies observed flags, counts and unknown eligibility through both copy paths', async () => {
  const r = roster(); r.observed.league.lineup_slots = { RB: 2, FLEX: 1, BN: 1 };
  r.observed.league.reserve = { configured_slots: 0, occupied_slots: 0, open_slots: 0, configured_eligibility: {}, current_player_eligibility: { status: 'unavailable', reason: 'Unavailable' } };
  r.observed.current_roster.forEach((p, i) => { p.position = 'RB'; p.roster_state = i < 3 ? 'starter' : 'bench'; p.status = i < 3 ? 'Active' : 'Inactive'; p.active = true; });
  global.fetch = jest.fn(async input => String(input).startsWith('/api/draft-review?') ? response(r) : serve(String(input)));
  open(); await screen.findByRole('heading', { name: 'Limited RB cover' });
  expect(screen.getByText(/3 starting-group RBs · 1 bench RB · 1 recorded flag/)).toBeTruthy();
  expect(screen.queryByText('All clear')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Compare WR alternatives' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Discuss this pressure card' }));
  await screen.findByText('Pressure card and roster snapshot copied.');
  const pressurePacket = JSON.parse((navigator.clipboard.writeText as jest.Mock).mock.calls[0][0]);
  expect(pressurePacket.chapter.pressure_card.trigger.roster_coverage).toMatchObject({ starter_count: 3, bench_count: 1, flagged_count: 1 });
  expect(pressurePacket.chapter.pressure_card.league_rule_context.reserve_state).toBe('not_configured');
  fireEvent.click(screen.getByRole('button', { name: 'Settings', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Copy agent context' }));
  await screen.findByText('Agent context copied');
  const generalPacket = JSON.parse((navigator.clipboard.writeText as jest.Mock).mock.calls[1][0]);
  expect(generalPacket.chapter.pressure_card).toEqual(pressurePacket.chapter.pressure_card);
  expect(generalPacket.context.observed.current_roster[3]).toMatchObject({ status: 'Inactive', active: true });
});
test('no-match wording limits its claim and leaves missing designation coverage explicit', async () => {
  const r = roster(); r.observed.league.lineup_slots = { WR: 1, BN: 3 };
  global.fetch = jest.fn(async input => String(input).startsWith('/api/draft-review?') ? response(r) : serve(String(input)));
  open(); await screen.findByRole('heading', { name: 'No pressure detected in available observations' });
  expect(screen.getByText(/Roster designation coverage is incomplete/)).toBeTruthy();
  expect(screen.queryByText('All clear')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Discuss this pressure card' })).toBeNull();
});


test('plan survives rooms, accompanies both handoffs and clears on refresh without changing evidence', async () => {
  open(); await screen.findByRole('heading', { name: 'Synthetic team 1' });
  const editor = screen.getByText('Your plan / Revisit when').closest('details')!;
  editor.open = true; fireEvent(editor, new Event('toggle'));
  fireEvent.change(screen.getByLabelText('Your plan'), { target: { value: 'Keep roster. Waivers off per manager.' } });
  fireEvent.change(screen.getByLabelText('Revisit when'), { target: { value: 'An RB designation changes.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Discuss this pressure card' }));
  await screen.findByText('Pressure card and roster snapshot copied.');
  const first = JSON.parse((navigator.clipboard.writeText as jest.Mock).mock.calls[0][0]);
  expect(first.operator_context.chapter_plan).toMatchObject({ plan: 'Keep roster. Waivers off per manager.', revisit_when: 'An RB designation changes.', monitoring: false });
  expect(first.chapter.pressure_card.kind).toBe('unfilled_starting_slots');
  fireEvent.click(screen.getByRole('button', { name: 'Team board', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Settings', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Copy agent context' }));
  await screen.findByText('Agent context copied');
  const second = JSON.parse((navigator.clipboard.writeText as jest.Mock).mock.calls[1][0]);
  expect(second.operator_context.chapter_plan).toEqual(first.operator_context.chapter_plan);
  fireEvent.click(screen.getByRole('button', { name: 'Chapter', exact: true }));
  expect((screen.getByLabelText('Your plan') as HTMLTextAreaElement).value).toBe(first.operator_context.chapter_plan.plan);
  (window.confirm as jest.Mock).mockReturnValue(false);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh roster' }));
  expect((screen.getByLabelText('Your plan') as HTMLTextAreaElement).value).toBe(first.operator_context.chapter_plan.plan);
  (window.confirm as jest.Mock).mockReturnValue(true);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh roster' }));
  await screen.findByRole('heading', { name: 'Synthetic team 1' });
  const refreshed = screen.getByText('Your plan / Revisit when').closest('details')!;
  refreshed.open = true; fireEvent(refreshed, new Event('toggle'));
  expect((screen.getByLabelText('Your plan') as HTMLTextAreaElement).value).toBe('');
});

test('editing invalidates pending copy feedback and clear/navigation never carry a plan to another roster', async () => {
  open(); await screen.findByRole('heading', { name: 'Synthetic team 1' });
  const editor = screen.getByText('Your plan / Revisit when').closest('details')!;
  editor.open = true; fireEvent(editor, new Event('toggle'));
  fireEvent.change(screen.getByLabelText('Your plan'), { target: { value: '<script>not executable</script>' } });
  let finish!: () => void;
  (navigator.clipboard.writeText as jest.Mock).mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: 'Discuss this pressure card' }));
  fireEvent.change(screen.getByLabelText('Revisit when'), { target: { value: 'New evidence' } });
  await act(async () => finish());
  expect(screen.queryByText('Pressure card and roster snapshot copied.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Clear plan' }));
  expect((screen.getByLabelText('Your plan') as HTMLTextAreaElement).value).toBe('');
  fireEvent.change(screen.getByLabelText('Your plan'), { target: { value: 'Only roster one' } });
  act(() => window.history.pushState({}, '', `/team?sleeper_url=${encodeURIComponent(canonical(2))}`));
  await screen.findByRole('heading', { name: 'Synthetic team 2' });
  await screen.findByText('No admitted history');
  fireEvent.click(screen.getByRole('button', { name: 'Discuss this pressure card' }));
  await screen.findByText('Pressure card and roster snapshot copied.');
  const packet = JSON.parse((navigator.clipboard.writeText as jest.Mock).mock.calls.at(-1)[0]);
  expect(packet.operator_context.chapter_plan).toBeNull();
});
