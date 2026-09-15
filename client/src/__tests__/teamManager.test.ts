/** @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import TeamManager from '@/components/draftReview/TeamManager';
const reply = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body } as Response);
const clock = '2026-09-15T12:00:00Z';
const leagues = { status: 'available', season: '2026', account: { userId: '123', displayName: 'Synthetic' },
  leagues: [{ leagueId: '10', name: 'Alpha league', mode: 'redraft', totalRosters: 2 }, { leagueId: '20', name: 'Beta league', mode: 'dynasty', totalRosters: 2 }] };
const result = (id = '10', week = 1) => ({ schemaVersion: 'tiber_manager_week_v1', status: 'available', leagueId: id, season: '2026', week,
  rosters: [{ rosterId: 1, opponentRosterId: 2, canonicalUrl: `https://sleeper.com/roster/${id}/1`, points: 110, opponentPoints: 100, outcome: 'win' }],
  observations: { matchupsReceivedAt: clock, rostersReceivedAt: clock } });
const original = global.fetch;
beforeEach(() => { global.fetch = jest.fn(async url => reply(String(url).includes('manager-week') ? result() : leagues)); });
afterEach(() => { cleanup(); global.fetch = original; jest.restoreAllMocks(); });
async function setup() {
  const onOpenTeam = jest.fn(); render(React.createElement(TeamManager, { onOpenTeam }));
  fireEvent.change(screen.getByLabelText('Sleeper username or user ID'), { target: { value: 'synthetic' } });
  fireEvent.change(screen.getByLabelText('Season'), { target: { value: '2026' } });
  fireEvent.click(screen.getByRole('button', { name: 'Find leagues' }));
  await screen.findByLabelText(/Alpha league/); return onOpenTeam;
}
test('only selected leagues are requested; exact Team link and provisional aggregate', async () => {
  const open = await setup(); expect((global.fetch as jest.Mock).mock.calls).toHaveLength(1);
  fireEvent.click(screen.getByLabelText(/Alpha league/)); fireEvent.click(screen.getByRole('button', { name: 'Refresh results' }));
  await screen.findByText('Win · provisional'); expect(screen.getByText('Week 1: 1 W · 0 L · 0 T')).toBeTruthy();
  expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('userId=123&leagueId=10&season=2026&week=1');
  fireEvent.click(screen.getByRole('button', { name: 'Open Team' })); expect(open).toHaveBeenCalledWith('https://sleeper.com/roster/10/1');
  expect(window.localStorage.length).toBe(0); expect(window.sessionStorage.length).toBe(0);
});
test('week change clears prior wins and ignores a late response', async () => {
  await setup(); let release!: (value: Response) => void;
  (global.fetch as jest.Mock).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  fireEvent.click(screen.getByLabelText(/Alpha league/)); fireEvent.click(screen.getByRole('button', { name: 'Refresh results' }));
  fireEvent.change(screen.getByLabelText('Week'), { target: { value: '2' } });
  await act(async () => release(reply(result())));
  expect(screen.queryByText('Win · provisional')).toBeNull(); expect(screen.getByText('Week 2: 0 W · 0 L · 0 T')).toBeTruthy();
});
test('failed refresh removes a previously displayed win', async () => {
  await setup(); fireEvent.click(screen.getByLabelText(/Alpha league/)); fireEvent.click(screen.getByRole('button', { name: 'Refresh results' }));
  await screen.findByText('Win · provisional'); (global.fetch as jest.Mock).mockResolvedValueOnce(reply({}, 502));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh results' }));
  await screen.findByRole('alert'); expect(screen.queryByText('Win · provisional')).toBeNull();
  expect(screen.getByText('Week 1: 0 W · 0 L · 0 T')).toBeTruthy();
});
test('multiple memberships count once only after explicit roster choice', async () => {
  await setup(); const value = result(); value.rosters.push({ ...value.rosters[0], rosterId: 2, outcome: 'loss' });
  (global.fetch as jest.Mock).mockResolvedValueOnce(reply(value));
  fireEvent.click(screen.getByLabelText(/Alpha league/)); fireEvent.click(screen.getByRole('button', { name: 'Refresh results' }));
  await screen.findByLabelText('Roster to track in this league'); expect(screen.getByText('Week 1: 0 W · 0 L · 0 T')).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Roster to track in this league'), { target: { value: '2' } });
  expect(screen.getByText('Week 1: 0 W · 1 L · 0 T')).toBeTruthy();
});
test('account edits invalidate all selected/results state', async () => {
  await setup(); fireEvent.click(screen.getByLabelText(/Alpha league/)); fireEvent.click(screen.getByRole('button', { name: 'Refresh results' }));
  await screen.findByText('Win · provisional'); fireEvent.change(screen.getByLabelText('Sleeper username or user ID'), { target: { value: 'different' } });
  expect(screen.queryByText('Win · provisional')).toBeNull(); expect(screen.queryByLabelText(/Alpha league/)).toBeNull();
});

test('one league failure does not erase another league result or become a loss', async () => {
  await setup();
  (global.fetch as jest.Mock).mockImplementation(async url => String(url).includes('leagueId=20') ? reply({}, 502) : reply(result()));
  fireEvent.click(screen.getByLabelText(/Alpha league/)); fireEvent.click(screen.getByLabelText(/Beta league/));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh results' }));
  await screen.findByText('Win · provisional'); await screen.findByRole('alert');
  expect(screen.getByText('Week 1: 1 W · 0 L · 0 T')).toBeTruthy();
  expect(screen.getByText('0 pending · 1 unavailable · 2 selected leagues')).toBeTruthy();
});
