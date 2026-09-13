/** @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DraftReviewMatchup from '@/components/draftReview/DraftReviewMatchup';
import type { DraftReview } from '@/pages/TiberDraftReview';
const review = { input: { canonicalUrl: 'https://sleeper.com/roster/123/1', leagueId: '123', rosterId: 1 }, observed: { league: { season: '2026' } } } as DraftReview;
const originalFetch = global.fetch;
const data = () => ({ schema_version: 'tiber_team_matchup_v1', input: review.input, season: '2026', week: 1, observed: { you: { roster_id: 1, name: 'Mine', points: 0, custom_points: null, starters: [] }, opponent: { roster_id: 2, name: 'Theirs', points: 12, custom_points: null, starters: [] } }, derived: { score_margin: -12, shared_offense: [] }, unavailable: ['Game timing'], provenance: { received_at: '2026-09-12T12:00:00Z', directory_fetched_at: '2026-09-12T11:00:00Z', source_urls: [], disclosures: [] } });
beforeEach(() => { Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn().mockResolvedValue(undefined) } }); });
afterEach(() => { cleanup(); global.fetch = originalFetch; });
test('loads on demand and copies explicit manager preference', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => data() });
  render(React.createElement(DraftReviewMatchup, { review }));
  expect(global.fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Open matchup' }));
  await screen.findByText('Mine');
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Discuss matchup' }));
  await screen.findByText(/Matchup context copied/);
  expect(JSON.parse(jest.mocked(navigator.clipboard.writeText).mock.calls[0][0]).operator_context.lineup_settled).toBe(true);
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ...data(), week: 2 }) });
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } });
  await screen.findByText('Mine');
  expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(false);
});
test('rejects cross-week payload and clears previous export on refresh failure', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => data() }).mockResolvedValue({ ok: false });
  render(React.createElement(DraftReviewMatchup, { review }));
  fireEvent.click(screen.getByRole('button', { name: 'Open matchup' })); await screen.findByText('Mine');
  fireEvent.click(screen.getByRole('button', { name: 'Refresh matchup' }));
  await screen.findByRole('alert'); expect(screen.queryByRole('button', { name: 'Discuss matchup' })).toBeNull();
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ ...data(), week: 3 }) });
  fireEvent.change(screen.getByRole('combobox'), { target: { value: '2' } });
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(screen.queryByText('Mine')).toBeNull();
});
