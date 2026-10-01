/** @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import TeamFreshnessPanel from '@/components/draftReview/TeamFreshnessPanel';
import type { TeamFreshness } from '@shared/teamFreshness';

const metadata: TeamFreshness = {
  schema_version: 'tiber_team_freshness_v1', server_build: { revision: 'a'.repeat(40), revision_basis: 'railway_reported_commit', built_at: null, deployed_at: null },
  historical_evidence: { status: 'available', window: { season: 2025, week_start: 1, week_end: 18 }, source_acquired_at: null, source_updated_at: null, last_successful_refresh_at: null },
  weekly_evidence: { status: 'unavailable' },
};
const originalFetch = global.fetch;
const response = (body: unknown, ok = true) => ({ ok, json: async () => body } as Response);
afterEach(() => { cleanup(); global.fetch = originalFetch; jest.useRealTimers(); });

test('historical window and compiler clock remain distinct; changing roster clears only its clock', async () => {
  global.fetch = jest.fn(async () => response(metadata));
  const view = render(React.createElement(TeamFreshnessPanel, { rosterCompiledAt: '2026-10-01T12:00:00Z' }));
  await screen.findByText('2025 · Weeks 1–18');
  expect(screen.getByText('2026-10-01T12:00:00Z')).toBeTruthy();
  expect(screen.getAllByText('Unknown')).toHaveLength(2);
  expect(screen.getByText(/does not certify cached page code/)).toBeTruthy();
  view.rerender(React.createElement(TeamFreshnessPanel));
  expect(screen.getByText('Not loaded')).toBeTruthy();
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch).toHaveBeenCalledWith('/api/draft-review/freshness', expect.objectContaining({ cache: 'no-store' }));
});
test.each([{}, { ...metadata, server_build: { ...metadata.server_build, built_at: '2026-10-01T00:00:00Z' } }, { ...metadata, historical_evidence: { ...metadata.historical_evidence, window: { season: 2025, week_start: 9, week_end: 1 } } }])('malformed metadata never claims current coverage', async body => {
  global.fetch = jest.fn(async () => response(body));
  render(React.createElement(TeamFreshnessPanel));
  await screen.findByText(/Freshness metadata unavailable/);
  expect(screen.queryByText('2025 · Weeks 1–18')).toBeNull();
});
test('recheck clears previously available metadata while pending and failure does not revive it', async () => {
  let finish!: (value: Response) => void;
  global.fetch = jest.fn().mockResolvedValueOnce(response(metadata)).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  render(React.createElement(TeamFreshnessPanel)); await screen.findByText('2025 · Weeks 1–18');
  fireEvent.click(screen.getByRole('button', { name: 'Check freshness again' }));
  expect(screen.queryByText('2025 · Weeks 1–18')).toBeNull();
  await act(async () => { await Promise.resolve(); });
  await act(async () => finish(response({}, false)));
  await screen.findByText(/Freshness metadata unavailable/);
});
test('timeout withholds late success', async () => {
  jest.useFakeTimers(); let finish!: (value: Response) => void;
  global.fetch = jest.fn(() => new Promise(resolve => { finish = resolve; }));
  render(React.createElement(TeamFreshnessPanel));
  await act(async () => jest.advanceTimersByTime(8000));
  expect(screen.getByText(/Freshness metadata unavailable/)).toBeTruthy();
  await act(async () => finish(response(metadata)));
  expect(screen.queryByText('2025 · Weeks 1–18')).toBeNull();
});
