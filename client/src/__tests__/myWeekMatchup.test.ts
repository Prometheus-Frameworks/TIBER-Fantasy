/** @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import MyWeekMatchup from '@/components/draftReview/MyWeekMatchup';
const clock = '2026-10-03T15:00:00Z';
const props = { url: 'https://sleeper.com/roster/10/1', leagueId: '10', rosterId: 1, opponentRosterId: 2, season: '2026', week: 4 };
const player = (id: string | null, name: string, designation: string | null, points: number | null) => ({ slot: 'WR', player_id: id, name, injury_status: designation, points, team: 'BAL', position: 'WR', status: null });
const data = () => ({ schema_version: 'tiber_team_matchup_v1', input: { canonicalUrl: props.url, leagueId: '10', rosterId: 1 }, season: '2026', week: 4,
  observed: { you: { roster_id: 1, name: 'Synthetic home', points: 0, custom_points: null, starters: [player('11', 'Flagged player', 'Questionable', 0), player(null, 'Empty slot', null, null)] }, opponent: { roster_id: 2, name: 'Synthetic away', points: 12, custom_points: null, starters: [player('22', 'Other player', null, 12), player('33', 'Unknown points', null, null)] } },
  derived: { score_margin: -12, shared_offense: [] }, unavailable: ['Players remaining and lineup locks'], provenance: { received_at: clock, directory_fetched_at: clock, source_urls: ['https://api.sleeper.app/v1/players/nfl'], disclosures: ['Synthetic observations'] } });
const original = global.fetch;
const reply = (body: unknown, status = 200) => ({ ok: status === 200, status, json: async () => body } as Response);
beforeEach(() => { global.fetch = jest.fn(async () => reply(data())); });
afterEach(() => { cleanup(); global.fetch = original; });
test('loads only on intent, preserves zero and missing points, and labels current-directory attention', async () => {
  render(React.createElement(MyWeekMatchup, props)); expect(global.fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Open lineups and attention check' }));
  await screen.findByText('2 starting slots to review');
  expect(screen.getByText('0.00')).toBeTruthy(); expect(screen.getAllByText('—')).toHaveLength(2);
  expect(screen.getByText(/even for an earlier week/)).toBeTruthy();
  expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('season=2026&week=4');
});
test('closing cancels a delayed read and prevents old attention from appearing', async () => {
  let finish!: (r: Response) => void; global.fetch = jest.fn(() => new Promise(resolve => { finish = resolve; })) as any;
  render(React.createElement(MyWeekMatchup, props)); fireEvent.click(screen.getByRole('button', { name: 'Open lineups and attention check' }));
  const signal = (global.fetch as jest.Mock).mock.calls[0][1].signal;
  fireEvent.click(screen.getByRole('button', { name: 'Close lineups' })); expect(signal.aborted).toBe(true);
  await act(async () => finish(reply(data()))); expect(screen.queryByText('2 starting slots to review')).toBeNull();
});
test.each(['week', 'identity', 'opponent', 'failure'])('rejects %s and removes old lineups on failed refresh', async kind => {
  render(React.createElement(MyWeekMatchup, props)); fireEvent.click(screen.getByRole('button', { name: 'Open lineups and attention check' })); await screen.findByText('2 starting slots to review');
  const next = data(); if (kind === 'week') next.week = 3; if (kind === 'identity') next.observed.you.roster_id = 9; if (kind === 'opponent') next.observed.opponent.roster_id = 3;
  (global.fetch as jest.Mock).mockResolvedValueOnce(reply(next, kind === 'failure' ? 502 : 200));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh lineups' })); await screen.findByRole('alert');
  expect(screen.queryByText('Flagged player')).toBeNull(); expect(screen.queryByText('2 starting slots to review')).toBeNull();
});
