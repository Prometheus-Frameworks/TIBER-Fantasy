import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { formatMetric, parseHistory, projectPlayerState, researchPacket, validateIds, HISTORY_ENDPOINT, type ReadResult } from '../lib/player-state.ts';
import { readPlayers, comparisonGet, MAX_RESPONSE_BYTES } from '../lib/railway-read.ts';
import { revisionGuard } from '../lib/revision-guard.ts';
import { PlayerStateCard, safeHttps } from '../components/player-state-card';
import TradeCompare from '../components/trade-compare';

// Synthetic values for conformance only. No current football claims or source grants.
function fixture(ids = ['8112', '9487']) {
  return {
    schema_version: 'tiber_draft_review_historical_v1', status: 'available', reason: null,
    window: { season: 2025, week_start: 1, week_end: 18, period_basis: 'synthetic fixture; not source evidence' },
    players: ids.map((id, i) => ({ player_id: id, status: 'available', reason: null,
      identity: { tiber_player_id: '00-' + String(i + 1).padStart(7, '0'), confidence: 'medium', match_method: 'name_exact' },
      observed: { weeks: [1, 2], historical_teams: ['TEST'], historical_positions: ['WR'], usage_conflict_weeks: [], usage_missing_weeks: [] },
      derived: { targets: { total: 6, mean: 3, nonnull_weeks: 2, recorded_weeks: 2 },
        receptions: { total: 0, mean: 0, nonnull_weeks: 2, recorded_weeks: 2 },
        receiving_yards: { total: null, mean: 5, nonnull_weeks: 1, recorded_weeks: 2 },
        target_share: { total: null, mean: .25, nonnull_weeks: 2, recorded_weeks: 2 } },
    })),
    provenance: { producer_repo: 'Prometheus-Frameworks/TIBER-Data', producer_commit: 'a'.repeat(40),
      sources: [{ path: 'synthetic/not-a-real-artifact.json', sha256: 'b'.repeat(64) }], operator_acceptance: 'synthetic only; no authority',
      source_acquired_at: null, source_updated_at: null, original_release_hash: null, package_version: null,
      transform: 'synthetic test transform', attribution: { name: 'Synthetic fixture', source_url: 'https://example.com', license: 'fixture only', license_url: 'https://example.com', notice: 'not football evidence' },
      team_roster_identity_promotion: { path: 'synthetic/promotion.json', sha256: 'c'.repeat(64), receipt: { status: 'accepted_for_historical_consumer_use', historical_consumer_use_authorized: true, retained_extra_limit: 'preserve me' } },
    },
    limitations: ['synthetic fixture'], unavailable_metrics: { fantasy_points: null }, forecast: { status: 'unavailable', fabricated_values: false },
  };
}
function result(ids = ['8112', '9487']): ReadResult {
  return { schema_version: 'tiber_trade_compare_read_v0', selected_ids: ids, status: 'available', reason: null,
    history: parseHistory(fixture(ids), ids), transport: { endpoint: HISTORY_ENDPOINT, retrieval_started_at: '2026-10-12T00:00:00Z', retrieved_at: '2026-10-12T00:00:01Z' } };
}
function jsonResponse(value: unknown) { return new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } }); }

test('exact pair and three-player scope preserve source values, denominators and full provenance', () => {
  for (const ids of [['8112', '9487'], ['8112', '9487', '8137']]) {
    const raw = fixture(ids); const h = parseHistory(raw, ids);
    assert.deepEqual(h, raw);
    assert.equal(h.players[0].derived.receiving_yards.total, null);
  }
});
test('zero is observed zero; missing mean is unavailable', () => {
  assert.equal(formatMetric(result().history!.players[0].derived.receptions, 'count'), '0');
  assert.equal(formatMetric(undefined, 'count'), 'unavailable');
  assert.equal(formatMetric({ mean: null, total: null, nonnull_weeks: 0, recorded_weeks: 2 }, 'count'), 'unavailable');
});
test('unmapped selected player remains discussable with canonical identity unavailable', () => {
  const raw = fixture(); raw.players[1] = { ...raw.players[1], status: 'unavailable', reason: 'No admitted mapping', identity: null, observed: null, derived: {} } as never;
  const read = { ...result(), history: parseHistory(raw, ['8112', '9487']) };
  const p = projectPlayerState('9487', read);
  assert.equal(p.identity.sourceNativePlayerId, null); assert.equal(p.historical, null);
  assert.equal(p.historicalReason, 'No admitted mapping');
  assert.equal(researchPacket(['8112', '9487'], read, {}, '', 'compare').selected_player_ids.length, 2);
});
test('same player state survives compare, trade and a different hypothetical/operator thesis', () => {
  const read = result(); const before = JSON.stringify(read);
  const compare = researchPacket(read.selected_ids, read, {}, '', 'compare');
  const trade = researchPacket(read.selected_ids, read, { '8112': 'give', '9487': 'receive' }, 'Maybe his role changes', 'trade');
  assert.deepEqual(compare.player_states, trade.player_states);
  assert.equal(JSON.stringify(read), before);
  assert.equal(trade.operator_context.epistemic_class, 'operator');
  assert.equal(trade.operator_context.forced_cuts, 'unavailable');
  assert.equal(trade.operator_context.counterparty_willingness, 'unknown');
  assert.equal(trade.interpretation.conditional_redistribution, 'unmodeled');
});
for (const [name, mutate] of [
  ['wrong season', (h: ReturnType<typeof fixture>) => { h.window.season = 2026; }],
  ['foreign player', (h: ReturnType<typeof fixture>) => { h.players[0].player_id = '999'; }],
  ['duplicate player', (h: ReturnType<typeof fixture>) => { h.players[1].player_id = h.players[0].player_id; }],
  ['duplicate canonical identity', (h: ReturnType<typeof fixture>) => { h.players[1].identity.tiber_player_id = h.players[0].identity.tiber_player_id; }],
  ['available without identity', (h: ReturnType<typeof fixture>) => { h.players[0].identity = null as never; }],
  ['inconsistent denominator', (h: ReturnType<typeof fixture>) => { h.players[0].derived.targets.nonnull_weeks = 3; }],
  ['partial total disguised as complete', (h: ReturnType<typeof fixture>) => { h.players[0].derived.receiving_yards.total = 5 as never; }],
  ['missing provenance', (h: ReturnType<typeof fixture>) => { h.provenance = null as never; }],
  ['unadmitted source', (h: ReturnType<typeof fixture>) => { h.provenance.team_roster_identity_promotion.receipt.historical_consumer_use_authorized = false as never; }],
] as const) test('fail closed: ' + name, () => { const h = fixture(); mutate(h); assert.throws(() => parseHistory(h, ['8112', '9487'])); });
test('incomplete selected pair, duplicates and stale research packets are rejected', () => {
  assert.throws(() => parseHistory(fixture(['8112']), ['8112', '9487']));
  assert.throws(() => validateIds(['8112', '8112']));
  assert.throws(() => researchPacket(['9487', '8112'], result(), {}, '', 'compare'));
});
test('revision guard invalidates late reads and clipboard completion after selection or thesis changes', () => {
  const reads = revisionGuard(), copies = revisionGuard();
  const oldRead = reads.begin(), oldCopy = copies.begin();
  reads.invalidate(); copies.invalidate();
  const newRead = reads.begin();
  assert.equal(reads.isCurrent(oldRead), false); assert.equal(copies.isCurrent(oldCopy), false);
  assert.equal(reads.isCurrent(newRead), true);
  reads.invalidate(); assert.equal(reads.isCurrent(newRead), false);
});
test('relay uses one fixed GET over HTTPS with no incoming credentials, cookies, user IDs or source overrides', async () => {
  let count = 0;
  const response = await comparisonGet(new Request('https://private.test/api/compare?ids=8112,9487', { headers: { Cookie: 'private-session', Authorization: 'private-auth', 'oai-authenticated-user-id': 'private-owner' } }), async (url, options) => {
    count++; assert.equal(new URL(String(url)).origin, 'https://tiber-fantasy-production.up.railway.app');
    assert.equal(new URL(String(url)).pathname, '/api/draft-review/evidence');
    assert.equal(new URL(String(url)).searchParams.get('player_ids'), '8112,9487');
    assert.equal(options?.method, 'GET'); assert.equal(options?.credentials, 'omit'); assert.equal(options?.redirect, 'manual');
    assert.deepEqual(options?.headers, { Accept: 'application/json' });
    return jsonResponse(fixture());
  });
  assert.equal(count, 1); assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  const body = await response.json() as ReadResult; assert.equal(body.status, 'available');
  assert.equal(body.history!.provenance!.source_updated_at, null);
});
for (const query of ['', '?ids=8112,8112', '?ids=1,2,3,4', '?ids=8112&user_id=default_user', '?ids=8112&url=https://evil.test', '?ids=8112&ids=9487', '?ids=..%2Fsecret']) {
  test('unsupported request fails before source read: ' + query, async () => {
    let calls = 0; const r = await comparisonGet(new Request('https://private.test/api/compare' + query), async () => { calls++; return jsonResponse(fixture()); });
    assert.equal(r.status, 400); assert.equal(calls, 0);
  });
}
test('POST rejected before outbound request', async () => {
  let calls = 0; const r = await comparisonGet(new Request('https://private.test/api/compare?ids=8112', { method: 'POST' }), async () => { calls++; return jsonResponse(fixture()); });
  assert.equal(r.status, 400); assert.equal(calls, 0);
});
test('redirect response remains unavailable and no second request is made', async () => {
  let calls = 0;
  const read = await readPlayers(['8112', '9487'], async (_url, options) => {
    calls++; assert.equal(options?.redirect, 'manual');
    return new Response(null, { status: 302, headers: { Location: 'https://must-not-be-followed.test/' } });
  });
  assert.equal(calls, 1); assert.equal(read.status, 'unavailable'); assert.equal(read.history, null);
});
for (const [name, fetcher] of [
  ['HTTP failure', async () => new Response('no', { status: 502 })],
  ['HTML fallback', async () => new Response('<html>login</html>', { headers: { 'Content-Type': 'text/html' } })],
  ['invalid JSON', async () => new Response('{', { headers: { 'Content-Type': 'application/json' } })],
  ['oversize stream', async () => new Response(' '.repeat(MAX_RESPONSE_BYTES + 1), { headers: { 'Content-Type': 'application/json' } })],
  ['oversize declared', async () => new Response('{}', { headers: { 'Content-Type': 'application/json', 'Content-Length': String(MAX_RESPONSE_BYTES + 1) } })],
  ['network or timeout failure', async () => { throw new DOMException('aborted', 'AbortError'); }],
  ['foreign response', async () => jsonResponse(fixture(['8112', '999']))],
] as const) test('read becomes unavailable without fallback: ' + name, async () => {
  const r = await readPlayers(['8112', '9487'], fetcher);
  assert.equal(r.status, 'unavailable'); assert.equal(r.history, null);
  assert.ok(r.transport.retrieved_at); assert.ok(!JSON.stringify(r).includes('login'));
});
test('card shows confidence, historical clocks, unavailable modules and denominator; untrusted text escapes', () => {
  const model = projectPlayerState('8112', result());
  const html = renderToStaticMarkup(<PlayerStateCard model={{ ...model, identity: { ...model.identity, name: '<script>evil()</script>' } }} />);
  assert.ok(html.includes('&lt;script&gt;')); assert.ok(!html.includes('<script>evil'));
  assert.ok(html.includes('medium')); assert.ok(html.includes('2/2 recorded weeks')); assert.ok(html.includes('1/2 recorded weeks'));
  assert.ok(html.includes('Original source acquisition and update clocks: unavailable'));
  for (const title of ['Opportunity xFP', 'Weekly role &amp; opportunity', 'Forward projection', 'Next opponent']) assert.ok(html.includes(title));
  assert.equal(safeHttps('javascript:alert(1)'), undefined); assert.equal(safeHttps('https://user:pass@evil.test'), undefined);
});
test('initial rendered page keeps source loading, scenario layers, phone scroller and manager boundary explicit', () => {
  const html = renderToStaticMarkup(<TradeCompare />);
  for (const phrase of ['Loading selected historical evidence', 'aria-busy="true"', 'role="region"', 'tabindex="0"', 'Compare players', 'Explore as trade', 'Illustrative fixture only', 'unmodeled', 'The manager makes it.', 'Operator note']) assert.ok(html.includes(phrase), phrase);
  assert.ok(html.includes('Copy research context')); assert.ok(html.includes('disabled=""'));
});
