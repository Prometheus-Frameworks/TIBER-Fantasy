/** @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import DraftReviewWaivers from '@/components/draftReview/DraftReviewWaivers';
import type { DraftReview } from '@/pages/TiberDraftReview';
import { deriveWaiverSettings } from '@shared/teamWaiverContext';
const originalFetch = global.fetch;
const review = { input: { canonicalUrl: 'https://sleeper.com/roster/123/1', leagueId: '123', rosterId: 1 }, generated_at: '2026-09-16T00:00:00Z', observed: { league: { season: '2026' } }, waiver_context: deriveWaiverSettings({ waiver_type: 2, waiver_budget: 100 }, { waiver_budget_used: 0, waiver_position: 5 }) } as DraftReview;
function payload() {
  return { schema_version: 'tiber_team_waiver_candidates_v1', status: 'available', input: review.input, season: '2026', waiver_settings: review.waiver_context,
    observations: { league_received_at: review.generated_at, rosters_received_at: review.generated_at, directory_fetched_at: review.generated_at, directory_source_updated_at: null, directory_cache_max_age_hours: 24, expected_rosters: 2, received_rosters: 2, source_urls: ['https://example.com/league', 'https://example.com/rosters', 'https://example.com/players'] },
    derivation: 'active_current_nfl_team_skill_players_minus_all_league_membership', claim_eligibility: 'unknown',
    candidates: ['11', '22', '33', '44', '55', '66'].map(player_id => ({ player_id, name: `Candidate ${player_id}`, position: 'WR', team: 'NO', active: true, status: 'Active' })) };
}
const response = (value: unknown, ok = true) => ({ ok, json: async () => value } as Response);
afterEach(() => { cleanup(); global.fetch = originalFetch; });
test('lazy load, bounded shortlist, search and failed refresh clear attachment', async () => {
  let calls = 0;
  global.fetch = jest.fn(async () => ++calls === 2 ? response({}, false) : response(payload()));
  const onChange = jest.fn(); render(React.createElement(DraftReviewWaivers, { review, onChange }));
  expect(global.fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Add waiver candidates to agent context'));
  fireEvent.click(screen.getByRole('button', { name: 'Check unrostered players' }));
  await screen.findByRole('button', { name: /Candidate 11/ });
  for (const id of ['11', '22', '33', '44', '55']) fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Candidate ${id}`) }));
  expect((screen.getByRole('button', { name: /^Candidate 66/ }) as HTMLButtonElement).disabled).toBe(true);
  expect(onChange.mock.calls.at(-1)[0].evidence.selected_candidates).toHaveLength(5);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '66' } });
  fireEvent.click(screen.getByRole('button', { name: 'Remove Candidate 11' }));
  fireEvent.click(screen.getByRole('button', { name: /^Candidate 66/ }));
  expect(onChange.mock.calls.at(-1)[0].evidence.selected_candidates.map((p: any) => p.player_id)).toEqual(['22', '33', '44', '55', '66']);
  fireEvent.click(screen.getByRole('button', { name: 'Refresh candidate check' }));
  await screen.findByRole('alert'); expect(onChange.mock.calls.at(-1)[0]).toBeNull();
  expect(screen.queryByText(/Unrostered when checked:/)).toBeNull();
});
test('scope mismatch and unmounted request cannot populate another roster', async () => {
  global.fetch = jest.fn(async () => response({ ...payload(), season: '2025' }));
  const onChange = jest.fn(); const view = render(React.createElement(DraftReviewWaivers, { review, onChange }));
  fireEvent.click(screen.getByText('Add waiver candidates to agent context'));
  fireEvent.click(screen.getByRole('button', { name: 'Check unrostered players' }));
  await screen.findByRole('alert'); expect(onChange.mock.calls.at(-1)[0]).toBeNull();
  let resolve!: (value: Response) => void;
  global.fetch = jest.fn(() => new Promise<Response>(r => { resolve = r; }));
  fireEvent.click(screen.getByRole('button', { name: 'Check unrostered players' }));
  view.unmount(); const count = onChange.mock.calls.length;
  await act(async () => resolve(response(payload())));
  expect(onChange).toHaveBeenCalledTimes(count);
});
