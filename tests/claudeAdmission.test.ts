import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import claude, { inAnthropicEgress, CLAUDE_PRINCIPAL } from '../server/mcp/claudeAdmissionWorker';
import chatgpt from '../server/mcp/leagueReaderWorker';

// Synthetic credential for tests only; never a deployed value.
const TOKEN = 'synthetic-test-token-0123456789abcdefghijklmnop';
const DIGEST = createHash('sha256').update(TOKEN).digest('hex');
const ANTHROPIC_IP = '160.79.104.10';
const env = (extra: Record<string, string | undefined> = {}) => ({
  TIBER_CLAUDE_ADMISSION: 'static-api-key-v1', TIBER_CLAUDE_TOKEN_SHA256: DIGEST, ...extra,
});
const rpc = (method: string, params: unknown = {}) => ({ jsonrpc: '2.0', id: 1, method, params });
const req = (body: unknown, headers: Record<string, string> = {}, path = '/mcp', method = 'POST') =>
  new Request(`https://claude-private.example${path}`, {
    method, headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-11-25', 'cf-connecting-ip': ANTHROPIC_IP, ...headers },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });
const auth = { 'x-api-key': TOKEN };
const noFetch = async (fn: () => Promise<void>) => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw Error('admission must not reach a source'); };
  try { await fn(); } finally { globalThis.fetch = original; }
};
const reason = async (r: Response) => ((await r.json()) as any).error;

test('kill switch: missing or wrong admission mode refuses before any credential check', () => noFetch(async () => {
  for (const mode of [undefined, '', 'static-bearer-v1', 'static-api-key-v0', 'on']) {
    const r = await claude.fetch(req(rpc('tools/list'), auth), env({ TIBER_CLAUDE_ADMISSION: mode }));
    assert.equal(r.status, 503); assert.equal(await reason(r), 'claude_admission_disabled');
    assert.equal(r.headers.get('Cache-Control'), 'no-store');
  }
}));

test('unconfigured or malformed digest fails closed', () => noFetch(async () => {
  for (const digest of [undefined, '', 'abc', DIGEST.toUpperCase(), DIGEST + '0', TOKEN]) {
    const r = await claude.fetch(req(rpc('tools/list'), auth), env({ TIBER_CLAUDE_TOKEN_SHA256: digest }));
    assert.equal(r.status, 503); assert.equal(await reason(r), 'claude_admission_unconfigured');
  }
}));

test('missing, malformed, wrong and spoofed credentials are refused without OAuth discovery', () => noFetch(async () => {
  const cases: Record<string, string>[] = [
    {}, { 'x-api-key': '' }, { 'x-api-key': 'short' }, { 'x-api-key': `Bearer ${TOKEN}` },
    { 'x-api-key': `${TOKEN}x` }, { 'x-api-key': TOKEN.slice(0, -1) }, { 'x-api-key': `${TOKEN} ${TOKEN}` },
    { 'x-api-key': DIGEST }, { 'x-api-key': `${TOKEN};` },
    // The right token in the wrong header is refused: Authorization belongs to OAuth.
    { Authorization: `Bearer ${TOKEN}` }, { Authorization: TOKEN }, { 'x-auth-token': TOKEN },
    { 'oai-authenticated-user-id': 'joe' }, { 'oai-authenticated-user-id': CLAUDE_PRINCIPAL },
  ];
  for (const headers of cases) {
    for (const method of ['initialize', 'tools/list', 'tools/call']) {
      const r = await claude.fetch(req(rpc(method), headers), env());
      assert.equal(r.status, 401, JSON.stringify(headers));
      assert.equal(await reason(r), 'invalid_credentials');
      const challenge = r.headers.get('WWW-Authenticate') ?? '';
      assert.ok(!/resource_metadata/i.test(challenge), 'must not advertise OAuth discovery');
    }
  }
  // Fetch Headers strip trailing whitespace per spec: this is the same token, not a variant.
  const trimmed = await claude.fetch(req(rpc('tools/list'), { 'x-api-key': ` ${TOKEN} ` }), env());
  assert.equal(trimmed.status, 200);
}));

test('egress range is enforced by default and only disabled explicitly', () => noFetch(async () => {
  for (const ip of ['160.79.104.0', '160.79.107.200', '160.79.111.255']) assert.ok(inAnthropicEgress(ip), ip);
  for (const ip of [null, '', '160.79.103.255', '160.79.112.0', '160.78.104.1', '10.0.0.1', '160.79.104', '160.79.104.256', '::1', '2001:db8::1'])
    assert.ok(!inAnthropicEgress(ip), String(ip));
  const outside = await claude.fetch(req(rpc('tools/list'), { ...auth, 'cf-connecting-ip': '203.0.113.9' }), env());
  assert.equal(outside.status, 403); assert.equal(await reason(outside), 'egress_not_allowed');
  for (const flag of [undefined, '', 'Off', 'false', 'anthropic-v1']) {
    const r = await claude.fetch(req(rpc('tools/list'), { ...auth, 'cf-connecting-ip': '203.0.113.9' }), env({ TIBER_CLAUDE_EGRESS_CHECK: flag }));
    assert.equal(r.status, 403, String(flag));
  }
  const off = await claude.fetch(req(rpc('tools/list'), { ...auth, 'cf-connecting-ip': '203.0.113.9' }), env({ TIBER_CLAUDE_EGRESS_CHECK: 'off' }));
  assert.equal(off.status, 200);
}));

test('only POST /mcp is served; no landing page or discovery documents', () => noFetch(async () => {
  for (const path of ['/', '/.well-known/oauth-protected-resource', '/.well-known/oauth-authorization-server', '/mcp/', '/sse']) {
    const r = await claude.fetch(req(null, auth, path, 'GET'), env());
    assert.equal(r.status, 404, path);
  }
  const get = await claude.fetch(req(null, auth, '/mcp', 'GET'), env());
  assert.equal(get.status, 405);
}));

test('foreign browser origins are refused, including chatgpt.com', () => noFetch(async () => {
  for (const origin of ['https://chatgpt.com', 'https://claude.ai', 'https://evil.example']) {
    const r = await claude.fetch(req(rpc('tools/list'), { ...auth, Origin: origin }), env());
    assert.equal(r.status, 403, origin); assert.equal(await reason(r), 'origin_not_allowed');
  }
}));

test('valid credential reaches the unchanged reader with the same tool set as the ChatGPT host, ROP never enabled', () => noFetch(async () => {
  const init = await claude.fetch(req(rpc('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'synthetic', version: '1' } }), auth), env());
  assert.equal(init.status, 200);
  assert.equal(((await init.json()) as any).result.protocolVersion, '2025-11-25');
  const listed = await claude.fetch(req(rpc('tools/list'), auth), env({ TIBER_ROP_SOURCE: 'private-frozen-w01-w05-v2' } as any));
  const tools = ((await listed.json()) as any).result.tools as { name: string }[];
  const reference = await chatgpt.fetch(req(rpc('tools/list'), { 'oai-authenticated-user-id': 'x' }), {});
  const referenceTools = ((await reference.json()) as any).result.tools as { name: string }[];
  assert.deepEqual(tools.map(t => t.name).sort(), referenceTools.map(t => t.name).sort());
  assert.equal(tools.length, 8);
  assert.ok(!tools.some(t => /rop|role/i.test(t.name)), 'frozen ROP must not be exposed');
}));

test('admitted tools/call passes identity; disabled source stays a refusal, not a fabricated answer', () => noFetch(async () => {
  const r = await claude.fetch(req(rpc('tools/call', { name: 'tiber_get_my_leagues', arguments: {} }), auth), env());
  assert.equal(r.status, 200);
  const text = await r.text();
  assert.ok(!text.includes('authenticated_user_required'));
  assert.ok(!text.includes(TOKEN) && !text.includes(DIGEST), 'credential never echoed');
  const body = JSON.parse(text);
  assert.ok(body.result?.isError === true || /unavailable|disabled|not_configured|source/i.test(JSON.stringify(body)), 'source-disabled call must not fabricate data');
}));

test('credential is stripped and fixed principal injected before the inner Worker', async () => {
  const seen: Headers[] = [];
  const original = chatgpt.fetch;
  (chatgpt as any).fetch = async (request: Request) => { seen.push(request.headers); return new Response('{}'); };
  try {
    await claude.fetch(req(rpc('tools/list'), { ...auth, Authorization: 'Bearer oauth-would-go-here', Cookie: 'a=b', 'oai-authenticated-user-id': 'spoof' }), env());
  } finally { (chatgpt as any).fetch = original; }
  assert.equal(seen.length, 1);
  assert.equal(seen[0].get('authorization'), null);
  assert.equal(seen[0].get('x-api-key'), null);
  assert.equal(seen[0].get('cookie'), null);
  assert.equal(seen[0].get('oai-authenticated-user-id'), CLAUDE_PRINCIPAL);
});

test('refused requests never reach the inner Worker', async () => {
  let reached = 0;
  const original = chatgpt.fetch;
  (chatgpt as any).fetch = async () => { reached++; return new Response('{}'); };
  try {
    await claude.fetch(req(rpc('tools/list')), env());
    await claude.fetch(req(rpc('tools/list'), auth), env({ TIBER_CLAUDE_ADMISSION: undefined }));
    await claude.fetch(req(rpc('tools/list'), { ...auth, 'cf-connecting-ip': '1.1.1.1' }), env());
    await claude.fetch(req(rpc('tools/list'), { ...auth, Origin: 'https://chatgpt.com' }), env());
  } finally { (chatgpt as any).fetch = original; }
  assert.equal(reached, 0);
});
