import { afterEach, expect, jest, test } from '@jest/globals';
import { buildHistoricalCatalog } from '../historicalCatalog';
import { historicalCatalogEvidence } from '../historicalEvidence';
import { __resetDraftReviewCacheForTests } from '../draftReviewService';
import { historicalCatalogSchema, historicalDataPacket, sortHistoricalRows } from '../../../../shared/teamHistoricalData';
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; __resetDraftReviewCacheForTests(); });
test('directory failure preserves exact admitted cohort and source receipts', async () => {
  global.fetch = jest.fn(async () => { throw new Error('private failure'); }) as typeof fetch;
  const catalog = await buildHistoricalCatalog();
  expect(catalog.evidence.players).toHaveLength(94);
  expect(catalog.evidence).toEqual(historicalCatalogEvidence());
  expect(catalog.directory.fetched_at).toBeNull();
  expect(catalog.labels[0].name).toMatch(/^Sleeper player /);
  expect(JSON.stringify(catalog)).not.toContain('private failure');
  catalog.evidence.players.length = 0;
  expect(historicalCatalogEvidence().players).toHaveLength(94);
});
test('handoff preserves selected evidence, independent clocks and no inferred preference', async () => {
  global.fetch = jest.fn(async () => { throw new Error('offline'); }) as typeof fetch;
  const c = await buildHistoricalCatalog();
  const ids = c.evidence.players.slice(0, 4).map(p => p.player_id);
  const packet = historicalDataPacket({ input: { canonicalUrl: 'https://sleeper.com/roster/123/1' }, generated_at: '2026-09-01T00:00:00Z' }, c, ids, ['targets']);
  expect(packet.data_study.historical_evidence.players.map(p => p.player_id)).toEqual(ids);
  expect(packet.data_study.historical_evidence.provenance).toEqual(c.evidence.provenance);
  expect(packet.data_study.manager_judgment.preferred_player_id).toBeNull();
  expect(() => historicalDataPacket(packet.context, c, [...ids, c.evidence.players[4].player_id], ['targets'])).toThrow();
  expect(() => historicalCatalogSchema.parse({ ...c, labels: [] })).toThrow();
});
test('numeric sorting keeps unavailable last in both directions and does not mutate input', () => {
  const base = historicalCatalogEvidence().players[0];
  const row = (name: string, mean: number | null) => ({ name, history: { ...base, derived: { targets: { mean, total: mean, nonnull_weeks: mean === null ? 0 : 1, recorded_weeks: 1 } } } });
  const rows = [row('Missing', null), row('High', 9), row('Zero', 0)];
  expect(sortHistoricalRows(rows, 'targets', 'mean', false).map(p => p.name)).toEqual(['Zero', 'High', 'Missing']);
  expect(sortHistoricalRows(rows, 'targets', 'mean', true).map(p => p.name)).toEqual(['High', 'Zero', 'Missing']);
  expect(rows[0].name).toBe('Missing');
});
