/** @jest-environment jsdom */
import React from 'react';
import { afterEach, expect, jest, test } from '@jest/globals';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DraftReviewData } from '../components/draftReview/DraftReviewData';
import type { DraftReview } from '../pages/TiberDraftReview';
import { historicalCatalogEvidence } from '../../../server/modules/draftReview/historicalEvidence';
const originalFetch = global.fetch;
const review = { input: { canonicalUrl: 'https://sleeper.com/roster/123/1' }, generated_at: '2026-09-01T00:00:00Z' } as DraftReview;
function catalog() {
  const evidence = historicalCatalogEvidence();
  evidence.players = evidence.players.slice(0, 5);
  return { schema_version: 'tiber_team_historical_catalog_v1', evidence, labels: evidence.players.map((p, i) => ({ player_id: p.player_id, name: `Example ${i}` })), directory: { fetched_at: null, source_updated_at: null, source_url: 'https://api.sleeper.app/v1/players/nfl', reason: 'Unavailable' } };
}
afterEach(() => { cleanup(); global.fetch = originalFetch; });
test('lazy load, four-player cap, filters preserve comparison and scoped handoff', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => catalog() })) as typeof fetch;
  const writeText = jest.fn(async (_text: string) => undefined);
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
  render(React.createElement(DraftReviewData, { review }));
  expect(global.fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Open historical data'));
  await screen.findByLabelText('Compare Example 0');
  for (let i = 0; i < 4; i++) fireEvent.click(screen.getByLabelText(`Compare Example ${i}`));
  expect((screen.getByLabelText('Compare Example 4') as HTMLInputElement).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Find player or ID'), { target: { value: 'no match' } });
  expect(screen.getByText('Remove Example 0')).toBeTruthy();
  fireEvent.click(screen.getByText('Copy data investigation'));
  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
  const packet = JSON.parse(writeText.mock.calls[0][0]);
  expect(packet.data_study.historical_evidence.players).toHaveLength(4);
  expect(packet.data_study.manager_judgment.preferred_player_id).toBeNull();
  fireEvent.click(screen.getByText('Close historical data'));
  fireEvent.click(screen.getByText('Open historical data'));
  await screen.findByLabelText('Compare Example 0');
  expect((screen.getByLabelText('Compare Example 0') as HTMLInputElement).checked).toBe(false);
});
test('load failures show retry and malformed evidence fails closed', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({}) })) as typeof fetch;
  render(React.createElement(DraftReviewData, { review }));
  fireEvent.click(screen.getByText('Open historical data'));
  await screen.findByText('Retry data');
  expect(screen.queryByText('Copy data investigation')).toBeNull();
});
test('a late response from a closed workspace cannot replace the reopened selection', async () => {
  let resolveFirst!: (value: Response) => void;
  const first = new Promise<Response>(resolve => { resolveFirst = resolve; });
  let calls = 0;
  global.fetch = jest.fn(() => ++calls === 1 ? first : Promise.resolve({ ok: true, json: async () => catalog() } as Response)) as typeof fetch;
  render(React.createElement(DraftReviewData, { review }));
  fireEvent.click(screen.getByText('Open historical data'));
  fireEvent.click(screen.getByText('Close historical data'));
  fireEvent.click(screen.getByText('Open historical data'));
  await screen.findByLabelText('Compare Example 0');
  fireEvent.click(screen.getByLabelText('Compare Example 0'));
  resolveFirst({ ok: true, json: async () => ({}) } as Response);
  await waitFor(() => expect(screen.getByText('Remove Example 0')).toBeTruthy());
  expect(screen.queryByText('Retry data')).toBeNull();
});
