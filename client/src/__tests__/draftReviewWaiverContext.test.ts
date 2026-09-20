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

function history(ids = ['11', '22']) {
  return { schema_version: 'tiber_draft_review_historical_v1', status: 'available', reason: null,
    window: { season: 2025, week_start: 1, week_end: 18, period_basis: 'recorded weeks' },
    provenance: { producer_repo: 'TIBER-Data', producer_commit: 'test', sources: [], operator_acceptance: 'fixture', attribution: { name: 'nflverse', source_url: 'https://example.com/source', license: 'CC BY 4.0', license_url: 'https://example.com/license', notice: 'Attribution' } },
    limitations: ['Synthetic test only'], unavailable_metrics: {}, forecast: { status: 'unavailable', fabricated_values: false },
    players: ids.map((player_id, index) => ({ player_id, status: index === 0 ? 'available' : 'unavailable', reason: index === 0 ? null : 'Historical identity unavailable', identity: index === 0 ? { tiber_player_id: 'test', confidence: 'medium', match_method: 'fixture' } : null, observed: index === 0 ? { weeks: [1, 2], historical_teams: ['NO'], historical_positions: ['WR'], usage_missing_weeks: [], usage_conflict_weeks: [] } : null, derived: index === 0 ? { targets: { total: 0, mean: 0, nonnull_weeks: 2, recorded_weeks: 2 } } : {} })) };
}
async function openPair() {
  const view = render(React.createElement(DraftReviewWaivers, { review, onChange: jest.fn() }));
  fireEvent.click(screen.getByText('Add waiver candidates to agent context'));
  fireEvent.click(screen.getByRole('button', { name: 'Check unrostered players' }));
  await screen.findByRole('button', { name: /^Candidate 11/ });
  fireEvent.click(screen.getByRole('button', { name: /^Candidate 11/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Compare Candidate 11 with another waiver player' }));
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '22' } });
  fireEvent.click(screen.getByRole('button', { name: /^Candidate 22/ }));
  fireEvent.change(screen.getByLabelText('Second waiver player'), { target: { value: '22' } });
  return view;
}
test('search retains first candidate; pair exports only two selected candidates with evidence, clocks and unknown forecast', async () => {
  global.fetch = jest.fn(async url => response(String(url).includes('waiver-candidates') ? payload() : history()));
  const writeText = jest.fn(async () => undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  await openPair();
  await screen.findByText('Historical identity unavailable');
  expect(screen.getByText('Comparing Candidate 11.', { exact: false })).toBeTruthy();
  expect(screen.getAllByText('0').length).toBeGreaterThan(0);
  expect(screen.queryByRole('option', { name: 'Candidate 11' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Discuss this waiver comparison' }));
  await screen.findByText('Waiver comparison context copied');
  const packet = JSON.parse(writeText.mock.calls[0][0]);
  expect(packet.waiver_comparison.selected_player_ids).toEqual(['11', '22']);
  expect(packet.waiver_exploration.selected_candidates.map((p: any) => p.player_id)).toEqual(['11', '22']);
  expect(packet.waiver_exploration.candidates).toBeUndefined();
  expect(packet.waiver_exploration.observations.rosters_received_at).toBe(review.generated_at);
  expect(packet.waiver_comparison.forecast.status).toBe('unavailable');
  expect(packet.study).toBeUndefined();
  fireEvent.click(screen.getByRole('button', { name: 'Remove Candidate 22' }));
  expect(screen.queryByText('Waiver comparison context copied')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Discuss this waiver comparison' })).toBeNull();
});
test('candidate refresh invalidates pair, late history and pending clipboard completion', async () => {
  let resolveCopy!: () => void;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: jest.fn(() => new Promise<void>(r => { resolveCopy = r; })) } });
  global.fetch = jest.fn(async url => response(String(url).includes('waiver-candidates') ? payload() : history()));
  await openPair(); await screen.findByText('Historical identity unavailable');
  fireEvent.click(screen.getByRole('button', { name: 'Discuss this waiver comparison' }));
  global.fetch = jest.fn(async () => response({}, false));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh candidate check' }));
  await screen.findByRole('alert');
  await act(async () => resolveCopy());
  expect(screen.queryByRole('region', { name: 'Waiver player comparison' })).toBeNull();
  expect(screen.queryByText('Waiver comparison context copied')).toBeNull();
});
test('late evidence cannot populate a different pair, and roster navigation resets comparison', async () => {
  let resolveOld!: (r: Response) => void;
  global.fetch = jest.fn(url => String(url).includes('waiver-candidates') ? Promise.resolve(response(payload())) : new Promise<Response>(r => { resolveOld = r; }));
  const view = await openPair();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '33' } });
  fireEvent.click(screen.getByRole('button', { name: /^Candidate 33/ }));
  global.fetch = jest.fn(async () => response(history(['11', '33'])));
  fireEvent.change(screen.getByLabelText('Second waiver player'), { target: { value: '33' } });
  await screen.findByText('Historical identity unavailable');
  await act(async () => resolveOld(response(history())));
  expect(screen.queryByRole('columnheader', { name: 'Candidate 22' })).toBeNull();
  expect(screen.getAllByRole('columnheader', { name: 'Candidate 33' }).length).toBeGreaterThan(0);
  view.rerender(React.createElement(DraftReviewWaivers, { review: { ...review, generated_at: '2026-09-17T00:00:00Z' }, onChange: jest.fn() }));
  expect(screen.queryByRole('region', { name: 'Waiver player comparison' })).toBeNull();
});
test('mismatched history stays unavailable but pair remains discussable; incomplete membership cannot open comparison', async () => {
  global.fetch = jest.fn(async url => response(String(url).includes('waiver-candidates') ? payload() : history(['11', '99'])));
  const writeText = jest.fn(async () => undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  await openPair();
  await screen.findAllByText('Historical evidence unavailable.');
  fireEvent.click(screen.getByRole('button', { name: 'Discuss this waiver comparison' }));
  await screen.findByText('Waiver comparison context copied');
  expect(JSON.parse(writeText.mock.calls[0][0]).waiver_comparison.historical.evidence).toBeNull();
  const invalid = payload(); invalid.observations.received_rosters = 1;
  global.fetch = jest.fn(async () => response(invalid));
  fireEvent.click(screen.getByRole('button', { name: 'Refresh candidate check' }));
  await screen.findByRole('alert');
  expect(screen.queryByRole('region', { name: 'Waiver player comparison' })).toBeNull();
});
