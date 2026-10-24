/** Local built-Worker check only; never publishes or calls a hosted endpoint. */
import assert from 'node:assert/strict';
import { realpath, readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

try {
  const [, , grant, path, sha] = process.argv;
  if (grant !== '--owner-private' || !path?.startsWith('/') || process.argv.length !== 5 ||
      ['CI', 'GITHUB_ACTIONS', 'GITLAB_CI', 'BUILDKITE', 'CIRCLECI', 'TF_BUILD', 'JENKINS_URL', 'TEAMCITY_VERSION'].some(k => process.env[k])) throw Error();
  const repo = await realpath('.'), workerPath = await realpath(path);
  if (workerPath.startsWith(repo + '/')) throw Error();
  const bytes = await readFile(workerPath);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), sha);
  const start = performance.now();
  const worker = (await import(pathToFileURL(workerPath).href)).default;
  const initializationMs = Math.round(performance.now() - start);
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls++; throw Error('network_forbidden'); };
  const request = (name: string, args = {}, identity = true, origin = 'https://chatgpt.com') => new Request('https://private.invalid/mcp', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-11-25', Origin: origin, ...(identity ? { 'oai-authenticated-user-id': 'synthetic-owner' } : {}) },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
  });
  const env = { TIBER_ROP_SOURCE: 'private-frozen-w01-w05-v2' };
  const query = { subject: { namespace: 'nflverse:gsis', id: '00-0040138' }, season: 2026, seasonType: 'REG', weeks: [1, 2, 3, 4, 5] };
  assert.equal((await worker.fetch(request('tiber_get_rop_role_history', query, false), env)).status, 403);
  assert.equal((await worker.fetch(request('tiber_get_rop_role_history', query, true, 'https://untrusted.invalid'), env)).status, 403);
  const response = await worker.fetch(request('tiber_get_rop_role_history', query), env);
  assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store');
  const body = await response.json();
  assert.equal(body.result.isError, false);
  const result = body.result.structuredContent;
  assert.equal(result.weeks.length, 5); assert.ok(result.weeks.every((w: any) => w.status === 'observed'));
  assert.equal(result.weeks[0].record.fields.carries.value, 0);
  const disabled = await worker.fetch(request('tiber_get_rop_role_history', query), {});
  assert.equal((await disabled.json()).result.structuredContent.reason, 'source_disabled');
  for (const marker of ['public-sleeper', 'anything-else']) {
    const wrong = await worker.fetch(request('tiber_get_rop_role_history', query), { TIBER_ROP_SOURCE: marker });
    assert.equal((await wrong.json()).result.structuredContent.reason, 'source_disabled');
  }
  const caps = await worker.fetch(request('tiber_league_capabilities'), env);
  const capability = (await caps.json()).result.structuredContent;
  assert.equal(capability.sourceMode, 'disabled');
  assert.equal(capability.families.ROP.status, 'available');
  assert.ok(!capability.withheld.includes('ROP')); assert.ok(capability.withheld.includes('Forecast'));
  const unknown = await worker.fetch(request('unknown', query), env);
  assert.equal((await unknown.json()).result.isError, true);
  assert.equal(networkCalls, 0);
  console.log(JSON.stringify({ status: 'passed', localBuiltWorkerOnly: true, initializationMs,
    identityRejection: true, originRejection: true, noStore: true, independentKillSwitch: true,
    noelWeeks: 5, unexpectedNetworkCalls: networkCalls,
    responseBytes: Buffer.byteLength(JSON.stringify(body)), workerSha256: sha }));
} catch {
  console.error('{"status":"failed","reason":"local_private_worker_check_failed"}');
  process.exitCode = 1;
}
