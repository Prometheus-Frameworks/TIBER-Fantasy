/** @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Weekly from '@/components/draftReview/DraftReviewWeekly';
import type { DraftReview } from '@/pages/TiberDraftReview';

const review = {
  generated_at: '2026-09-15T00:00:00Z', input: { leagueId: '123', rosterId: 1, canonicalUrl: 'https://sleeper.com/roster/123/1' },
  observed: { league: { season: '2026', name: 'Synthetic league' }, team: { roster_id: 1 },
    current_roster: [{ player_id: '11', name: 'Synthetic WR', position: 'WR', roster_state: 'bench' }] },
} as DraftReview;
const unavailable = (week = 1) => ({ schema_version: 'tiber_weekly_evidence_v0', status: 'unavailable',
  consumer_admitted: false, scope: { season: 2026, season_type: 'REG', week }, players: [], reason: 'Not admitted' });
const response = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;
const originalFetch = global.fetch;
let copy: jest.Mock;
beforeEach(() => {
  global.fetch = jest.fn(async () => response(unavailable()));
  copy = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: copy } });
});
afterEach(() => { cleanup(); global.fetch = originalFetch; });
function open() { render(React.createElement(Weekly, { review })); fireEvent.click(screen.getByRole('button', { name: 'Open weekly evidence' })); }
test('loads only on entry, keeps unavailable distinct from zero and copies dated selected context', async () => {
  render(React.createElement(Weekly, { review }));
  expect(global.fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Open weekly evidence' }));
  await screen.findByText(/not yet available/);
  expect(global.fetch).toHaveBeenCalledWith('/api/draft-review/weekly?season=2026&week=1', expect.objectContaining({ cache: 'no-store' }));
  fireEvent.change(screen.getByLabelText('Player to investigate'), { target: { value: '11' } });
  fireEvent.click(screen.getByRole('button', { name: 'Copy player investigation request' }));
  await screen.findByText(/Investigation request copied/);
  const packet = JSON.parse(copy.mock.calls[0][0]);
  expect(packet.requested_scope.week).toBe(1);
  expect(packet.weekly_evidence).toEqual({ status: 'unavailable', consumer_admitted: false, players: [] });
  expect(packet.current_roster_context.selected_player.player_id).toBe('11');
  expect(packet.current_roster_context.generated_at).toBe(review.generated_at);
  expect(packet.current_roster_context.identity_namespace).toBe('sleeper');
});
test.each([
  { ...unavailable(), status: 'preview_not_admitted', players: [{ player_name: 'Do not render' }] },
  { ...unavailable(), consumer_admitted: true },
  unavailable(2),
  { ...unavailable(), players: null },
])('rejects unsupported or scope-mismatched evidence', async body => {
  global.fetch = jest.fn(async () => response(body)); open();
  await screen.findByRole('alert');
  expect(screen.queryByText('Do not render')).toBeNull();
  expect(screen.queryByLabelText('Player to investigate')).toBeNull();
});
test('late week-one response cannot overwrite week two; request carries week two', async () => {
  let resolve!: (r: Response) => void;
  global.fetch = jest.fn().mockImplementationOnce(() => new Promise<Response>(r => { resolve = r; }))
    .mockResolvedValueOnce(response(unavailable(2)));
  open();
  fireEvent.change(screen.getByLabelText('Report week'), { target: { value: '2' } });
  await screen.findByText(/not yet available in Team for 2026, Week 2/);
  await act(async () => resolve(response(unavailable())));
  expect(screen.getByText(/not yet available in Team for 2026, Week 2/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText('Player to investigate'), { target: { value: '11' } });
  fireEvent.click(screen.getByRole('button', { name: 'Copy player investigation request' }));
  await waitFor(() => expect(copy).toHaveBeenCalled());
  expect(JSON.parse(copy.mock.calls[0][0]).requested_scope.week).toBe(2);
});
test('network failure is retryable and clipboard failure stays visible', async () => {
  global.fetch = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response(unavailable()));
  open(); await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button', { name: 'Retry weekly evidence' }));
  await screen.findByText(/not yet available/);
  copy.mockRejectedValueOnce(new Error('denied'));
  fireEvent.change(screen.getByLabelText('Player to investigate'), { target: { value: '11' } });
  fireEvent.click(screen.getByRole('button', { name: 'Copy player investigation request' }));
  await screen.findByText(/Could not copy/);
});
