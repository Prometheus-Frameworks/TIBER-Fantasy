/** @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DraftReviewTeExplorer from '@/components/draftReview/DraftReviewTeExplorer';
import type { DraftReview } from '@/pages/TiberDraftReview';
import type { UnrosteredTes } from '@shared/draftReviewWaivers';
const originalFetch = global.fetch;
const review = { input: { canonicalUrl: 'https://sleeper.com/roster/123/1', leagueId: '123', rosterId: 1 }, generated_at: '2026-09-11T11:00:00Z', observed: { league: { season: '2026' } } } as DraftReview;
function availability(): UnrosteredTes {
  return { schema_version: 'tiber_team_unrostered_tes_v1', status: 'available', input: review.input, season: '2026',
    observations: { league_received_at: '2026-09-11T12:00:00Z', rosters_received_at: '2026-09-11T12:00:01Z', directory_fetched_at: '2026-09-11T00:00:00Z', directory_source_updated_at: null, directory_cache_max_age_hours: 24, expected_rosters: 2, received_rosters: 2, source_urls: ['https://api.sleeper.app/v1/league/123', 'https://api.sleeper.app/v1/league/123/rosters', 'https://api.sleeper.app/v1/players/nfl'] },
    derivation: 'directory_primary_position_TE_minus_all_league_membership', claim_eligibility: 'unknown',
    candidates: ['11', '22'].map(player_id => ({ player_id, name: `Candidate ${player_id}`, position: 'TE', team: 'CAR', active: true, status: 'Active' })),
  };
}
function response(body: unknown, ok = true) { return { ok, json: async () => body } as Response; }
function missing(id = '11') { return { schema_version: 'tiber_draft_review_historical_v1', status: 'available', reason: null, provenance: null, players: [{ player_id: id, status: 'unavailable', reason: 'No admitted history', identity: null, observed: null, derived: {} }] }; }
function expand(container: HTMLElement) { const details = container.querySelector('details')!; details.open = true; fireEvent(details, new Event('toggle')); }
function mount() { const view = render(React.createElement(DraftReviewTeExplorer, { review })); expand(view.container); return view; }
beforeEach(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn().mockResolvedValue(undefined) } }));
afterEach(() => { cleanup(); global.fetch = originalFetch; });

test('collapsed panel makes no requests; unknown history still permits bounded candidate discussion', async () => {
  global.fetch = jest.fn(async input => response(String(input).includes('/evidence?') ? missing() : availability()));
  const view = render(React.createElement(DraftReviewTeExplorer, { review }));
  expect(global.fetch).not.toHaveBeenCalled();
  expand(view.container);
  fireEvent.click(await screen.findByRole('button', { name: /Candidate 11/ }));
  await screen.findByText('No admitted history');
  fireEvent.click(screen.getByRole('button', { name: 'Discuss this TE' }));
  await screen.findByText('TE candidate context copied');
  const packet = JSON.parse((navigator.clipboard.writeText as jest.Mock).mock.calls[0][0]);
  expect(packet.candidate_exploration.selected_candidate.player_id).toBe('11');
  expect(packet.candidate_exploration.historical.status).toBe('unavailable');
  expect(packet.context.generated_at).toBe(review.generated_at);
  expect(packet).not.toHaveProperty('study');
  fireEvent.click(screen.getByRole('button', { name: /Candidate 11/ }));
  expect((screen.getByRole('button', { name: 'Discuss this TE' }) as HTMLButtonElement).disabled).toBe(false);
});

test('old history and clipboard completion cannot replace a new selection', async () => {
  const pending: Array<(response: Response) => void> = [];
  global.fetch = jest.fn(input => String(input).includes('/evidence?') ? new Promise<Response>(resolve => pending.push(resolve)) : Promise.resolve(response(availability())));
  mount();
  fireEvent.click(await screen.findByRole('button', { name: /Candidate 11/ }));
  expect((screen.getByRole('button', { name: 'Discuss this TE' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: /Candidate 22/ }));
  await act(async () => pending[0](response(missing('11'))));
  expect(screen.queryByText('No admitted history')).toBeNull();
  await act(async () => pending[1](response(missing('22'))));
  let completeCopy!: () => void;
  (navigator.clipboard.writeText as jest.Mock).mockImplementation(() => new Promise<void>(resolve => { completeCopy = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: 'Discuss this TE' }));
  fireEvent.click(screen.getByRole('button', { name: /Candidate 11/ }));
  await act(async () => completeCopy());
  expect(screen.queryByText('TE candidate context copied')).toBeNull();
});

test('failed refresh removes old availability and candidate, and retry recovers', async () => {
  let calls = 0;
  global.fetch = jest.fn(async input => String(input).includes('/evidence?') ? response(missing()) : ++calls === 2 ? response({}, false) : response(availability()));
  mount();
  fireEvent.click(await screen.findByRole('button', { name: /Candidate 11/ }));
  await screen.findByText('No admitted history');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh TE check' }));
  await screen.findByRole('alert');
  expect(screen.queryByRole('region', { name: 'Selected TE candidate' })).toBeNull();
  expect(screen.queryByRole('button', { name: /Candidate 11/ })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry TE check' }));
  await screen.findByRole('button', { name: /Candidate 11/ });
});

test('wrong league response fails closed; valid empty list is explicit', async () => {
  const wrong = availability(); wrong.input = { ...wrong.input, leagueId: '456', canonicalUrl: 'https://sleeper.com/roster/456/1' };
  global.fetch = jest.fn(async () => response(wrong));
  mount();
  await screen.findByRole('alert');
  expect(screen.queryByRole('button', { name: /Candidate 11/ })).toBeNull();
  const empty = availability(); empty.candidates = [];
  global.fetch = jest.fn(async () => response(empty));
  fireEvent.click(screen.getByRole('button', { name: 'Retry TE check' }));
  await screen.findByText('No unrostered TEs found in this directory snapshot.');
});

test('search is local; clipboard rejection is visible; malformed evidence becomes unavailable', async () => {
  global.fetch = jest.fn(async input => response(String(input).includes('/evidence?') ? missing('99') : availability()));
  mount();
  await screen.findByRole('button', { name: /Candidate 11/ });
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Candidate 11' } });
  expect(screen.queryByRole('button', { name: /Candidate 22/ })).toBeNull();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: /Candidate 11/ }));
  await screen.findByText('Historical evidence could not be loaded.');
  (navigator.clipboard.writeText as jest.Mock).mockRejectedValue(new Error('Denied'));
  fireEvent.click(screen.getByRole('button', { name: 'Discuss this TE' }));
  await screen.findByRole('alert');
  expect(screen.queryByText('TE candidate context copied')).toBeNull();
});

test('closing clears pending availability and reopening starts a fresh check', async () => {
  const pending: Array<(response: Response) => void> = [];
  global.fetch = jest.fn(() => new Promise<Response>(resolve => pending.push(resolve)));
  const view = mount();
  const details = view.container.querySelector('details')!;
  details.open = false; fireEvent(details, new Event('toggle'));
  await act(async () => pending[0](response(availability())));
  expect(screen.queryByRole('button', { name: /Candidate 11/ })).toBeNull();
  expand(view.container);
  await waitFor(() => expect(pending).toHaveLength(2));
  await act(async () => pending[1](response(availability())));
  await screen.findByRole('button', { name: /Candidate 11/ });
});

test('defaults to current-team TEs, orders by adds and allows explicit broader directory', async () => {
  const data = availability();
  data.candidates.push({ player_id: '33', name: 'Archive TE', position: 'TE', team: null, active: true, status: 'Active' });
  data.candidates.push({ player_id: '44', name: 'Inactive TE', position: 'TE', team: 'CAR', active: false, status: 'Inactive' });
  data.trends = { status: 'available', received_at: '2026-09-11T12:00:05Z', lookback_hours: 24, limit: 1000, source_url: 'https://api.sleeper.app/v1/players/nfl/trending/add?lookback_hours=24&limit=1000', counts: { '22': 80 } };
  global.fetch = jest.fn(async () => response(data));
  mount();
  await screen.findByRole('button', { name: /Candidate 22/ });
  expect(screen.queryByRole('button', { name: /Archive TE/ })).toBeNull();
  expect(screen.queryByRole('button', { name: /Inactive TE/ })).toBeNull();
  expect(screen.getAllByRole('button').filter(b => b.hasAttribute('aria-pressed'))[0].textContent).toContain('Candidate 22');
  fireEvent.click(screen.getByRole('checkbox'));
  expect(screen.getByRole('button', { name: /Archive TE/ })).toBeTruthy();
  expect(screen.getByRole('button', { name: /Inactive TE/ })).toBeTruthy();
});
