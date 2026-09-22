import * as directoryService from '../draftReviewService';
import { afterEach, expect, jest, test } from '@jest/globals';
import { buildHistoricalCatalog } from '../historicalCatalog';
import { historicalCatalogEvidence } from '../historicalEvidence';
import { __resetDraftReviewCacheForTests } from '../draftReviewService';
import { historicalCatalogSchema, historicalDataPacket, sortHistoricalRows } from '../../../../shared/teamHistoricalData';
const originalFetch = global.fetch;
afterEach(() => { jest.restoreAllMocks(); global.fetch = originalFetch; __resetDraftReviewCacheForTests(); });
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


test.each([null, {}, { fetchedAt: 1 }, { fetchedAt: 1, players: null }, { fetchedAt: 1, players: [] }, { fetchedAt: 1, players: 'invalid' }, { fetchedAt: NaN, players: {} }, { fetchedAt: 9e15, players: {} }])('malformed directory snapshot preserves history with ID fallback: %p', async snapshot => {
  jest.spyOn(directoryService, 'getDraftReviewPlayerDirectory').mockResolvedValue(snapshot as never);
  const catalog = await buildHistoricalCatalog();
  expect(catalog.evidence).toEqual(historicalCatalogEvidence());
  expect(catalog.labels.every(p => p.name === `Sleeper player ${p.player_id}`)).toBe(true);
  expect(catalog.directory.fetched_at).toBeNull();
  expect(catalog.directory.reason).not.toBeNull();
});
test('valid directory names and acquisition clock survive container validation', async () => {
  const id = historicalCatalogEvidence().players[0].player_id;
  jest.spyOn(directoryService, 'getDraftReviewPlayerDirectory').mockResolvedValue({ fetchedAt: 1, players: { [id]: { player_id: id, full_name: 'Example Player' } } } as never);
  const catalog = await buildHistoricalCatalog();
  expect(catalog.labels[0].name).toBe('Example Player');
  expect(catalog.directory.fetched_at).toBe('1970-01-01T00:00:00.001Z');
  expect(catalog.directory.reason).toBeNull();
});
test.each([0, null])('tie sorting pins English for names and IDs regardless of ambient locale: %p', mean => {
  const nativeCompare = String.prototype.localeCompare;
  jest.spyOn(String.prototype, 'localeCompare').mockImplementation(function(this: string, other: string, locales?: string | string[], options?: Intl.CollatorOptions) {
    return nativeCompare.call(this, other, locales ?? 'sv', options);
  });
  const base = historicalCatalogEvidence().players[0];
  const rows = [['Zed', '9'], ['Åke', '2'], ['Åke', '1']].map(([name, id]) => ({ name, history: { ...base, player_id: id, derived: { targets: { mean, total: mean, nonnull_weeks: mean === null ? 0 : 1, recorded_weeks: 1 } } } }));
  for (const descending of [false, true]) expect(sortHistoricalRows(rows, 'targets', 'mean', descending).map(p => p.history.player_id)).toEqual(['1', '2', '9']);
  const calls = (String.prototype.localeCompare as jest.Mock).mock.calls;
  expect(calls.some(([other]) => other === 'Åke')).toBe(true);
  expect(calls.every(([, locale]) => locale === 'en')).toBe(true);
});
