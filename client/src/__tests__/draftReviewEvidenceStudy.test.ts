/** @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DraftReviewEvidenceStudy from '@/components/draftReview/DraftReviewEvidenceStudy';
import type { DraftReview } from '@/pages/TiberDraftReview';
import type { StudyAttachment } from '@shared/draftReviewStudy';

const originalFetch = global.fetch;
afterEach(() => { cleanup(); global.fetch = originalFetch; });
const roster = [
  { player_id: '11', name: 'First WR', position: 'WR', team: 'A', roster_state: 'starter', status: 'Active', active: true },
  { player_id: '33', name: 'Roster RB', position: 'RB', team: 'C', roster_state: 'bench', status: 'Active', active: true },
  { player_id: '22', name: 'Second WR', position: 'WR', team: 'B', roster_state: 'bench', status: 'Active', active: true },
];
const review = {
  input: { canonicalUrl: 'https://sleeper.com/roster/123/1', leagueId: '123', rosterId: 1 }, generated_at: '2026-09-07T00:00:00Z',
  observed: { current_roster: roster, league: { lineup_slots: { WR: 1, FLEX: 1, BN: 1 } }, draft: { full_board: [{ player_id: '44', name: 'Candidate RB', position: 'RB', team: 'C' }] } },
} as DraftReview;
function evidence(ids: string[], tag: string) {
  return { schema_version: 'tiber_draft_review_historical_v1', status: 'available', reason: null, provenance: null,
    players: ids.map(id => ({ player_id: id, status: 'unavailable', reason: tag, identity: null, observed: null, derived: {} })) };
}
function response(body: unknown) { return { ok: true, json: async () => body } as Response; }

test('late comparison response cannot replace a newer pair; no personal judgment is invented', async () => {
  const pending: Array<(value: Response) => void> = [];
  global.fetch = jest.fn(() => new Promise<Response>(resolve => pending.push(resolve)));
  let latest: StudyAttachment | undefined;
  const onChange = (value: StudyAttachment) => { latest = value; };
  render(React.createElement(DraftReviewEvidenceStudy, { review, onChange }));
  await waitFor(() => expect(pending).toHaveLength(1));
  expect(screen.queryByLabelText('My preference')).toBeNull();
  expect(screen.queryByLabelText('My reasoning')).toBeNull();
  fireEvent.change(screen.getByLabelText('Comparison player 2'), { target: { value: '33' } });
  expect(latest!.operator_context).toMatchObject({ preferred_player_id: null, note: '', applies_to_player_ids: ['11', '33'] });
  expect(latest!.comparison).toMatchObject({ status: 'loading', evidence: null });
  await waitFor(() => expect(pending).toHaveLength(2));
  await act(async () => { pending[1](response(evidence(['11', '33'], 'New pair evidence'))); });
  await act(async () => { pending[0](response(evidence(['11', '22'], 'Stale pair evidence'))); });
  expect(screen.queryByText('Stale pair evidence')).toBeNull();
  expect(latest!.comparison.evidence!.players.map(p => p.player_id)).toEqual(['11', '33']);
});
test('error stays explicit and remounting a new review clears local operator and hypothetical state', async () => {
  global.fetch = jest.fn(async () => { throw new Error('private detail'); });
  let latest: StudyAttachment | undefined;
  const onChange = (value: StudyAttachment) => { latest = value; };
  const mounted = render(React.createElement(DraftReviewEvidenceStudy, { key: 'first', review, onChange }));
  await screen.findByText('Historical evidence could not be loaded.');
  expect(screen.queryByText('private detail')).toBeNull();
  expect(screen.getByText('Optional roster geometry').closest('details')!.open).toBe(false);
  fireEvent.change(screen.getByLabelText('Outgoing player 1'), { target: { value: '11' } });
  fireEvent.change(screen.getByLabelText('Incoming candidate'), { target: { value: '44' } });
  expect(latest!.hypothetical_roster?.status).toBe('available');
  mounted.rerender(React.createElement(DraftReviewEvidenceStudy, { key: 'second', review: { ...review, generated_at: '2026-09-08T00:00:00Z' }, onChange }));
  expect(latest!.operator_context.note).toBe('');
  expect(latest!.hypothetical_roster).toBeNull();
  await screen.findByText('Historical evidence could not be loaded.');
});
test('same-player comparison is unavailable and never fetched as a comparison', async () => {
  global.fetch = jest.fn(async () => response(evidence(['11', '22'], 'No history')));
  let latest: StudyAttachment | undefined;
  render(React.createElement(DraftReviewEvidenceStudy, { review, onChange: value => { latest = value; } }));
  await waitFor(() => expect(latest?.comparison.status).toBe('available'));
  fireEvent.change(screen.getByLabelText('Comparison player 2'), { target: { value: '11' } });
  expect(latest!.comparison).toMatchObject({ status: 'unavailable', evidence: null });
  expect(global.fetch).toHaveBeenCalledTimes(1);
});


test('compact receiving comparison keeps zero, missing values and unequal coverage distinct', async () => {
  const body = evidence(['11', '22'], 'No admitted exact Sleeper-to-GSIS identity mapping.');
  Object.assign(body.players[0], { status: 'available', reason: null, observed: { weeks: [1, 2], historical_teams: ['A'], usage_conflict_weeks: [], usage_missing_weeks: [] }, derived: {
    targets: { mean: 0, total: 0, nonnull_weeks: 2, recorded_weeks: 2 },
    receptions: { mean: null, total: null, nonnull_weeks: 0, recorded_weeks: 2 },
    receiving_yards: { mean: 8, total: null, nonnull_weeks: 1, recorded_weeks: 2 },
  } });
  global.fetch = jest.fn(async () => response(body));
  render(React.createElement(DraftReviewEvidenceStudy, { review, onChange: () => undefined }));
  const table = await screen.findByRole('table', { name: '2025 · per recorded week' });
  expect(within(table).getAllByRole('row')).toHaveLength(6);
  expect(within(table).getByText('0')).toBeTruthy();
  expect(within(table).getByText('1/2 recorded weeks')).toBeTruthy();
  expect(within(table).getAllByText('Not recorded')).toHaveLength(3);
  expect(table.querySelector('[rowspan="5"]')).toBeTruthy();
  expect(screen.getAllByText('2025 stats are not connected: historical identity link unavailable.')).toHaveLength(1);
  expect(screen.getByText('Totals, coverage and source details').closest('details')!.open).toBe(false);
  expect(screen.getByText(/Total unavailable · 8 mean/)).toBeTruthy();
  expect(within(table).queryByText('Passing yards')).toBeNull();
});

test('unsupported positions have one coverage explanation and no empty comparison table', async () => {
  const unsupported = { ...review, observed: { ...review.observed, current_roster: roster.map(p => ({ ...p, position: 'K' })) } } as DraftReview;
  global.fetch = jest.fn(async () => response(evidence(['11', '22'], 'No mapping')));
  render(React.createElement(DraftReviewEvidenceStudy, { review: unsupported, onChange: () => undefined }));
  await screen.findAllByText('Kicking and team-defense statistics are not included in this comparison.');
  expect(screen.queryByRole('table')).toBeNull();
});


test('discussion waits for the current request but permits an explicit unavailable result', async () => {
  let settle!: (value: Response) => void;
  global.fetch = jest.fn(() => new Promise<Response>(resolve => { settle = resolve; }));
  const onDiscuss = jest.fn();
  render(React.createElement(DraftReviewEvidenceStudy, { review, onChange: () => undefined, onDiscuss }));
  const button = screen.getByRole('button', { name: 'Discuss this comparison' }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(onDiscuss).not.toHaveBeenCalled();
  await act(async () => settle(response({ ...evidence([], 'Unavailable'), status: 'unavailable', reason: 'No admitted history' })));
  expect(button.disabled).toBe(false);
  fireEvent.click(button);
  expect(onDiscuss).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText('Comparison player 2'), { target: { value: '33' } });
  expect(button.disabled).toBe(true);
});

test('third player validates all IDs, exports one selection and ignores a removed third-player response', async () => {
  const pending: Array<(value: Response) => void> = [];
  global.fetch = jest.fn(() => new Promise<Response>(resolve => pending.push(resolve)));
  let latest!: StudyAttachment;
  render(React.createElement(DraftReviewEvidenceStudy, { review, onChange: value => { latest = value; }, onDiscuss: jest.fn() }));
  await act(async () => pending[0](response(evidence(['11', '22'], 'Pair'))));
  fireEvent.click(screen.getByRole('button', { name: 'Add third player' }));
  for (const index of [1, 2, 3]) {
    const select = screen.getByLabelText(`Comparison player ${index}`);
    expect(within(select).getAllByRole('option').map(option => (option as HTMLOptionElement).value)).toEqual(['', '11', '33', '22']);
    expect(within(select).queryByRole('option', { name: /Candidate RB/ })).toBeNull();
  }
  const discuss = screen.getByRole('button', { name: 'Discuss this comparison' }) as HTMLButtonElement;
  expect(discuss.disabled).toBe(true);
  expect(latest.comparison.evidence).toBeNull();
  fireEvent.change(screen.getByLabelText('Comparison player 3'), { target: { value: '22' } });
  expect(global.fetch).toHaveBeenCalledTimes(1);
  fireEvent.change(screen.getByLabelText('Comparison player 3'), { target: { value: '33' } });
  expect(global.fetch).toHaveBeenLastCalledWith('/api/draft-review/evidence?player_ids=11%2C22%2C33', expect.anything());
  expect(latest.operator_context.applies_to_player_ids).toEqual(['11', '22', '33']);
  expect(discuss.disabled).toBe(true);
  await act(async () => pending[1](response(evidence(['11', '22', '33'], 'Three unavailable'))));
  expect(latest.comparison.selected_player_ids).toEqual(['11', '22', '33']);
  expect(latest.comparison.evidence!.players).toHaveLength(3);
  expect(discuss.disabled).toBe(false);
  // A new third-player request is invalidated by removing that selector.
  fireEvent.change(screen.getByLabelText('Comparison player 3'), { target: { value: '11' } });
  expect(discuss.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Comparison player 3'), { target: { value: '33' } });
  fireEvent.click(screen.getByRole('button', { name: 'Remove third player' }));
  expect(screen.queryByLabelText('Comparison player 3')).toBeNull();
  await act(async () => pending[3](response(evidence(['11', '22'], 'Restored pair'))));
  await act(async () => pending[2](response(evidence(['11', '22', '33'], 'Stale triple'))));
  expect(latest.comparison.selected_player_ids).toEqual(['11', '22']);
  expect(latest.comparison.evidence!.players).toHaveLength(2);
  expect(screen.queryByText('Stale triple')).toBeNull();
});

test('three columns retain independent coverage, real zeros and mixed-position metric union', async () => {
  global.fetch = jest.fn(async (url) => {
    const ids = decodeURIComponent(String(url).split('=')[1]).split(',');
    const body = evidence(ids, 'No admitted exact Sleeper-to-GSIS identity mapping.');
    for (const player of body.players.filter(p => p.player_id !== '22')) {
      const count = player.player_id === '11' ? 2 : 3;
      Object.assign(player, { status: 'available', reason: null,
        observed: { weeks: Array.from({ length: count }, (_, i) => i + 1), historical_teams: ['A'], usage_conflict_weeks: [], usage_missing_weeks: [] },
        derived: { targets: { mean: 0, total: 0, nonnull_weeks: count, recorded_weeks: count } } });
    }
    return response(body);
  });
  render(React.createElement(DraftReviewEvidenceStudy, { review, onChange: () => undefined }));
  await screen.findByRole('table', { name: '2025 · per recorded week' });
  fireEvent.click(screen.getByRole('button', { name: 'Add third player' }));
  fireEvent.change(screen.getByLabelText('Comparison player 3'), { target: { value: '33' } });
  const table = await screen.findByRole('table', { name: '2025 · per recorded week' });
  expect(within(table).getAllByRole('columnheader').map(h => h.textContent)).toEqual(['Metric', 'First WR', 'Second WR', 'Roster RB']);
  const targetRow = within(table).getByRole('rowheader', { name: 'Targets' }).closest('tr')!;
  expect(within(targetRow).getAllByText('0')).toHaveLength(2);
  expect(within(targetRow).getByText('2/2 recorded weeks')).toBeTruthy();
  expect(within(targetRow).getByText('3/3 recorded weeks')).toBeTruthy();
  expect(within(table).getByText('Carries')).toBeTruthy();
  expect(screen.getAllByText('2025 stats are not connected: historical identity link unavailable.')).toHaveLength(1);
  expect(table.classList.contains('drp-three-comparison')).toBe(true);
});
