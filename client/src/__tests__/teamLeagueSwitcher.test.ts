/** @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TeamLeagueSwitcher from '@/components/draftReview/TeamLeagueSwitcher';

const response = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body } as Response);
const clock = '2026-09-13T00:00:00.000Z';
const list = (name = 'Synthetic account') => ({ status: 'available', season: '2026', account: { userId: '123', username: 'synthetic', displayName: name },
  leagues: [
    { leagueId: '10', name: 'Alpha dynasty', season: '2026', totalRosters: 12, mode: 'dynasty', receptionPoints: 1, superflex: true },
    { leagueId: '20', name: 'Beta keeper', season: '2026', totalRosters: 10, mode: 'keeper', receptionPoints: .5, superflex: false },
  ], observations: { accountReceivedAt: clock, leaguesReceivedAt: clock, sourceUrls: [] }, accountControlVerified: false });
const memberships = (leagueId = '10', rosters = [{ rosterId: 4, relationship: 'owner', canonicalUrl: `https://sleeper.com/roster/${leagueId}/4` }]) => ({
  status: 'available', leagueId, season: '2026', rosters, observations: { leagueReceivedAt: clock, rostersReceivedAt: clock, sourceUrls: [] }, accountControlVerified: false,
});
const original = global.fetch;
beforeEach(() => { global.fetch = jest.fn(async input => response(String(input).includes('league-rosters') ? memberships() : list())); });
afterEach(() => { cleanup(); global.fetch = original; jest.restoreAllMocks(); });
function mount() {
  const onSelect = jest.fn(() => true);
  const props = { authEnabled: false, navigationKey: '', onSelect };
  const view = render(React.createElement(React.StrictMode, null, React.createElement(TeamLeagueSwitcher, props)));
  return { view, props, onSelect };
}
async function find() {
  fireEvent.click(screen.getByRole('button', { name: /Find leagues by Sleeper username/ }));
  fireEvent.change(screen.getByLabelText('Sleeper username or user ID'), { target: { value: 'synthetic' } });
  fireEvent.change(screen.getByLabelText('Season'), { target: { value: '2026' } });
  fireEvent.click(screen.getByRole('button', { name: 'Find leagues' }));
  await screen.findByRole('button', { name: /Alpha dynasty/ });
}
test('public discovery loads once, supports filtering and selects the exact fresh roster', async () => {
  const { onSelect, view, props } = mount();
  expect(global.fetch).not.toHaveBeenCalled(); await find();
  expect(screen.queryByRole('button', { name: /Account/ })).toBeNull();
  fireEvent.change(screen.getByLabelText('Filter leagues'), { target: { value: 'superflex' } });
  expect(screen.queryByRole('button', { name: /Beta keeper/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Alpha dynasty/ }));
  await waitFor(() => expect(onSelect).toHaveBeenCalledWith('https://sleeper.com/roster/10/4'));
  view.rerender(React.createElement(React.StrictMode, null, React.createElement(TeamLeagueSwitcher, { ...props, currentLeagueId: '10', navigationKey: '?sleeper_url=10' })));
  fireEvent.click(screen.getByRole('button', { name: /Alpha dynasty.*2 leagues/ }));
  expect(screen.getByLabelText('Filter leagues')).toBeTruthy();
  expect((global.fetch as jest.Mock).mock.calls.filter(([url]) => String(url).includes('/leagues?'))).toHaveLength(1);
  expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('userId=123&leagueId=10&season=2026');
  expect(window.localStorage.length).toBe(0); expect(window.sessionStorage.length).toBe(0);
});
test('a late league lookup cannot reopen an old account', async () => {
  let release!: (value: Response) => void;
  (global.fetch as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  mount(); fireEvent.click(screen.getByRole('button', { name: /Find leagues by/ }));
  fireEvent.change(screen.getByLabelText('Sleeper username or user ID'), { target: { value: 'synthetic' } });
  fireEvent.change(screen.getByLabelText('Season'), { target: { value: '2026' } });
  fireEvent.click(screen.getByRole('button', { name: 'Find leagues' }));
  fireEvent.change(screen.getByLabelText('Sleeper username or user ID'), { target: { value: 'another' } });
  await act(async () => release(response(list('Old account'))));
  expect(screen.queryByText(/Old account/)).toBeNull(); expect(screen.queryByRole('button', { name: /Alpha dynasty/ })).toBeNull();
});
test('later league choice wins even when the earlier membership request finishes last', async () => {
  const { onSelect } = mount(); await find();
  let release!: (value: Response) => void;
  (global.fetch as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { release = resolve; })).mockResolvedValueOnce(response(memberships('20')));
  fireEvent.click(screen.getByRole('button', { name: /Alpha dynasty/ }));
  fireEvent.click(screen.getByRole('button', { name: /Beta keeper/ }));
  await waitFor(() => expect(onSelect).toHaveBeenCalledWith('https://sleeper.com/roster/20/4'));
  await act(async () => release(response(memberships('10'))));
  expect(onSelect).toHaveBeenCalledTimes(1);
});
test('manual navigation invalidates a pending automatic roster selection', async () => {
  const { onSelect, view, props } = mount(); await find();
  let release!: (value: Response) => void;
  (global.fetch as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: /Alpha dynasty/ }));
  view.rerender(React.createElement(React.StrictMode, null, React.createElement(TeamLeagueSwitcher, { ...props, navigationKey: '?manual=changed' })));
  await act(async () => release(response(memberships())));
  expect(onSelect).not.toHaveBeenCalled();
});
test('multiple memberships require a choice; zero membership cannot borrow another roster', async () => {
  const { onSelect } = mount(); await find();
  (global.fetch as jest.Mock).mockResolvedValueOnce(response(memberships('10', [
    { rosterId: 4, relationship: 'owner', canonicalUrl: 'https://sleeper.com/roster/10/4' },
    { rosterId: 8, relationship: 'co_owner', canonicalUrl: 'https://sleeper.com/roster/10/8' },
  ])));
  fireEvent.click(screen.getByRole('button', { name: /Alpha dynasty/ }));
  await screen.findByText('Multiple roster memberships were reported. Choose one:');
  expect(onSelect).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Roster 8 · co-owner' }));
  expect(onSelect).toHaveBeenCalledWith('https://sleeper.com/roster/10/8');
  fireEvent.click(screen.getByRole('button', { name: /Find leagues by Sleeper username/ }));
  (global.fetch as jest.Mock).mockResolvedValueOnce(response(memberships('20', [])));
  fireEvent.click(screen.getByRole('button', { name: /Beta keeper/ }));
  await screen.findByText(/No roster membership was reported/); expect(onSelect).toHaveBeenCalledTimes(1);
});
test('declining to clear an existing study leaves the league picker open', async () => {
  const { onSelect } = mount(); onSelect.mockReturnValue(false); await find();
  fireEvent.click(screen.getByRole('button', { name: /Alpha dynasty/ }));
  await waitFor(() => expect(onSelect).toHaveBeenCalled());
  expect(screen.getByLabelText('Filter leagues')).toBeTruthy();
});
test('a failed refresh removes the prior list and exposes a retryable error', async () => {
  mount(); await find(); (global.fetch as jest.Mock).mockResolvedValueOnce(response({ error: 'unavailable' }, 502));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh leagues' }));
  await screen.findByRole('alert'); expect(screen.queryByRole('button', { name: /Alpha dynasty/ })).toBeNull();
  expect(screen.getByRole('button', { name: 'Find leagues' })).toBeTruthy();
});
