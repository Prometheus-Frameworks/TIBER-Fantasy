import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createWeeklyEvidenceService, readPinnedModel } from '../server/modules/weeklyEvidence/weeklyEvidenceService';
import { createToolHandler } from '../server/modules/weeklyEvidence/toolDefinitions';
import { EVIDENCE_ID, MODEL_SHA256, RESULT_LIMIT, SUBJECT_ID } from '../server/modules/weeklyEvidence/catalog';

const raw = await readPinnedModel();
const expected = JSON.parse(raw.toString('utf8'));
const data = (r: any) => r.structuredContent;

test('pinned decoder preserves every field, null, raw denominator, clock and limitation', async () => {
  assert.equal(createHash('sha256').update(raw).digest('hex'), MODEL_SHA256);
  const service = createWeeklyEvidenceService();
  const result = await service.get(EVIDENCE_ID);
  assert.deepEqual(result.model, expected);
  assert.equal(result.model?.identity.sleeperPlayerId, null);
  assert.equal(result.model?.evidenceHealth.rop.evidenceCutoff.week2, null);
  assert.equal(result.model?.scope.join.week1.gameId, '2026_01_GB_MIN');
  // No reference reuse or mutable cached projection across calls.
  (result.model!.identity as any).name = 'changed by caller';
  assert.deepEqual((await service.get(EVIDENCE_ID)).model, expected);
});

test('capability and catalog reads do not invoke the evidence reader or claim remote admission', async () => {
  let reads = 0;
  const service = createWeeklyEvidenceService(async () => { reads++; return raw; });
  assert.equal(service.describe().remote_consumer_enabled, false);
  assert.equal(service.list().entries[0].current_byte_integrity, 'not_checked_by_catalog');
  assert.equal(service.list().entries[0].remote_consumer_enabled, false);
  assert.equal(reads, 0);
});

test('missing, tampered, oversized and failed evidence reads sanitize errors and recover', async () => {
  let bytes = Buffer.from(raw);
  const service = createWeeklyEvidenceService(async () => bytes);
  bytes[0] ^= 1;
  await assert.rejects(service.get(EVIDENCE_ID), { code: 'evidence_unavailable' });
  bytes = Buffer.alloc(40_001);
  await assert.rejects(service.get(EVIDENCE_ID), { code: 'evidence_unavailable' });
  bytes = raw;
  assert.deepEqual((await service.get(EVIDENCE_ID)).model, expected);
  const failure = createToolHandler(createWeeklyEvidenceService(async () => { throw new Error('SECRET_PATH_TOKEN'); }));
  const result = await failure('tiber_get_evidence', { evidence_id: EVIDENCE_ID });
  assert.equal(data(result).status, 'evidence_unavailable');
  assert.equal(result.isError, true);
  assert(!JSON.stringify(result).includes('SECRET_PATH_TOKEN'));
});

test('strict schemas and byte limits reject before read; unknown tool names are not echoed', async () => {
  let reads = 0;
  const handle = createToolHandler(createWeeklyEvidenceService(async () => { reads++; return raw; }));
  const invalid = [
    ['tiber_describe_capabilities', { live: true }],
    ['tiber_list_evidence', { season: 2026, season_type: 'REG', subject_id: SUBJECT_ID, weeks: [3] }],
    ['tiber_list_evidence', { season: 2025, season_type: 'REG', subject_id: SUBJECT_ID }],
    ['tiber_list_evidence', { season: 2026, season_type: 'REG', subject_id: 'Christian Watson' }],
    ['tiber_get_evidence', { evidence_id: EVIDENCE_ID, source_url: 'https://example.test' }],
    ['tiber_get_evidence', { evidence_id: '../../private' }],
    ['tiber_get_evidence', []],
    ['tiber_describe_capabilities', null],
  ] as const;
  for (const [name, args] of invalid) assert.equal(data(await handle(name, args)).status, 'invalid_input');
  assert.equal(data(await handle('tiber_get_evidence', { evidence_id: 'é'.repeat(2_000) })).status, 'input_too_large');
  const unknown = await handle('SECRET_TOOL_NAME', {});
  assert.equal(data(unknown).status, 'unknown_tool');
  assert(!JSON.stringify(unknown).includes('SECRET_TOOL_NAME'));
  assert.equal(reads, 0);
});

test('W3 and Forecast IDs remain successful domain-unavailable reads without any source work', async () => {
  let reads = 0;
  const handle = createToolHandler(createWeeklyEvidenceService(async () => { reads++; return raw; }));
  for (const evidence_id of ['watson-gb-2026-reg-w03', 'watson-forecast']) {
    const result = await handle('tiber_get_evidence', { evidence_id });
    assert.equal(result.isError, false);
    assert.equal(data(result).status, 'unavailable');
    assert.equal(data(result).data.producer_executed, false);
    assert.equal(data(result).data.substitution_performed, false);
  }
  assert.equal(reads, 0);
});

test('overlapping reads fail busy; the original read and later reads remain usable', async () => {
  let release!: (raw: Buffer) => void;
  const pending = new Promise<Buffer>(resolve => { release = resolve; });
  const service = createWeeklyEvidenceService(() => pending);
  const first = service.get(EVIDENCE_ID);
  await assert.rejects(service.get(EVIDENCE_ID), { code: 'busy' });
  release(raw);
  assert.deepEqual((await first).model, expected);
  assert.deepEqual((await service.get(EVIDENCE_ID)).model, expected);
});

test('structured/text result equivalence, full response ceiling and distinct call clocks', async () => {
  const result = await createToolHandler()('tiber_get_evidence', { evidence_id: EVIDENCE_ID });
  assert.deepEqual(JSON.parse((result.content[0] as any).text), result.structuredContent);
  assert(Buffer.byteLength(JSON.stringify(result)) <= RESULT_LIMIT);
  assert.equal(data(result).clock_meaning, 'adapter_call_times_not_football_or_source_update_times');
  assert.deepEqual(data(result).data.model, expected);
  const oversized = createToolHandler({ ...createWeeklyEvidenceService(), describe: () => ({ large: 'x'.repeat(RESULT_LIMIT) }) } as any);
  const refused = await oversized('tiber_describe_capabilities', {});
  assert.equal(data(refused).status, 'response_too_large');
  assert.equal(refused.isError, true);
  assert.equal(data(refused).data, null);
});

test('read deadline refuses without releasing an unfinished read slot', async () => {
  let release!: (raw: Buffer) => void;
  const pending = new Promise<Buffer>(resolve => { release = resolve; });
  const service = createWeeklyEvidenceService(() => pending, 10);
  await assert.rejects(service.get(EVIDENCE_ID), { code: 'evidence_unavailable' });
  await assert.rejects(service.get(EVIDENCE_ID), { code: 'busy' });
  release(raw);
  await pending;
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual((await service.get(EVIDENCE_ID)).model, expected);
});

test('source graph is bounded and the inherited reader/model remain byte-identical', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  for (const name of ['server/modules/weeklyEvidence/catalog.ts', 'server/modules/weeklyEvidence/weeklyEvidenceService.ts', 'server/modules/weeklyEvidence/toolDefinitions.ts', 'server/mcp/weeklyEvidenceServer.ts']) {
    const source = await readFile(root + name, 'utf8');
    const imports = [...source.matchAll(/from ['"]([^'"]+)['"]/g)].map(match => match[1]);
    assert(!imports.some(path => path.startsWith('.') && /infra\/db|storage|server\/index|routes|llm|scheduler|platformSync/.test(path)));
  }
  const { offlineEnvironment } = await import('../scripts/runWeeklyEvidenceOffline.mjs');
  assert.deepEqual(Object.keys(offlineEnvironment()).sort(), ['LANG', 'PATH', 'TIBER_WEEKLY_EVIDENCE_OFFLINE', 'TZ']);
  assert(!('NODE_OPTIONS' in offlineEnvironment()));
});
