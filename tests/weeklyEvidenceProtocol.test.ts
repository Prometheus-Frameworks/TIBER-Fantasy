import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { buildWeeklyEvidenceServer } from '../server/mcp/weeklyEvidenceServer';
import { EVIDENCE_ID, SUBJECT_ID, TOOL_NAMES } from '../server/modules/weeklyEvidence/catalog';
import { readPinnedModel } from '../server/modules/weeklyEvidence/weeklyEvidenceService';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

test('real SDK initialization, exact tool discovery, strict refusal and full model read', { timeout: 10_000 }, async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  let reads = 0;
  const server = buildWeeklyEvidenceServer(async () => { reads++; return readPinnedModel(); });
  const client = new Client({ name: 'offline-protocol-conformance', version: '1' });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(t => t.name), [...TOOL_NAMES]);
    for (const tool of tools) {
      assert.equal(tool.inputSchema.additionalProperties, false);
      assert.equal(tool.annotations?.readOnlyHint, true);
      assert.equal(tool.annotations?.openWorldHint, false);
    }
    const list = await client.callTool({ name: 'tiber_list_evidence', arguments: { season: 2026, season_type: 'REG', subject_id: SUBJECT_ID } });
    assert.equal((list.structuredContent as any).data.entries[0].remote_consumer_enabled, false);
    assert.equal(reads, 0);
    const invalid = await client.callTool({ name: 'tiber_get_evidence', arguments: { evidence_id: EVIDENCE_ID, live: true } });
    assert.equal((invalid.structuredContent as any).status, 'invalid_input');
    assert.equal(reads, 0);
    const unknown = await client.callTool({ name: 'secret_unknown_tool', arguments: {} });
    assert.equal((unknown.structuredContent as any).status, 'unknown_tool');
    const evidence = await client.callTool({ name: 'tiber_get_evidence', arguments: { evidence_id: EVIDENCE_ID } });
    assert.equal((evidence.structuredContent as any).status, 'available_for_offline_inspection');
    assert.deepEqual((evidence.structuredContent as any).data.model, JSON.parse((await readPinnedModel()).toString()));
    assert.equal(reads, 1);
  } finally { await client.close(); await server.close(); }
});

test('actual stdio subprocess launches from foreign cwd with no DB/provider credentials', { timeout: 15_000 }, async () => {
  const launcher = fileURLToPath(new URL('../scripts/runWeeklyEvidenceOffline.mjs', import.meta.url));
  const transport = new StdioClientTransport({
    command: process.execPath, args: [launcher, '--offline'], cwd: '/tmp', stderr: 'pipe',
    env: { DATABASE_URL: 'INVALID_SENTINEL', ADMIN_API_KEY: 'DO_NOT_FORWARD', NODE_OPTIONS: '' },
  });
  let stderr = '';
  transport.stderr?.on('data', chunk => { stderr += chunk.toString(); });
  const client = new Client({ name: 'offline-stdio-smoke', version: '1' });
  try {
    await client.connect(transport);
    assert.deepEqual((await client.listTools()).tools.map(t => t.name), [...TOOL_NAMES]);
    const result = await client.callTool({ name: 'tiber_get_evidence', arguments: { evidence_id: EVIDENCE_ID } });
    assert.equal((result.structuredContent as any).data.model.identity.sourceNativePlayerId, SUBJECT_ID);
    assert.equal((result.structuredContent as any).remote_consumer_enabled, false);
    assert(!stderr.includes('INVALID_SENTINEL'));
    assert(!stderr.includes('DO_NOT_FORWARD'));
  } finally { await client.close(); }
});

test('launcher rejects implicit startup and extra flags; import alone is inert', () => {
  const launcher = fileURLToPath(new URL('../scripts/runWeeklyEvidenceOffline.mjs', import.meta.url));
  for (const args of [[], ['--offline', '--live']]) {
    const result = spawnSync(process.execPath, [launcher, ...args], { encoding: 'utf8', timeout: 5_000, env: { PATH: process.env.PATH } });
    assert.equal(result.status, 2);
    assert.equal(result.stdout, '');
  }
});

test('stdio framing ceiling closes an oversized incomplete message without echoing it', { timeout: 10_000 }, async () => {
  const launcher = fileURLToPath(new URL('../scripts/runWeeklyEvidenceOffline.mjs', import.meta.url));
  const child = spawn(process.execPath, [launcher, '--offline'], { cwd: '/tmp', env: { PATH: process.env.PATH }, stdio: 'pipe' });
  let stdout = '', stderr = '';
  child.stdout.on('data', chunk => { stdout += chunk.toString(); });
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  try {
    const completed = new Promise<void>((resolve, reject) => {
      child.once('error', reject);
      child.once('close', () => resolve());
    });
    child.stdin.end('SECRET_OVERSIZE' + 'x'.repeat(8_192));
    await completed;
    assert.equal(stdout, '');
    assert(stderr.includes('weekly_evidence_protocol_error'));
    assert(!stderr.includes('SECRET_OVERSIZE'));
  } finally { child.kill(); }
});
