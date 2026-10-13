import { HISTORY_ENDPOINT, parseHistory, validateIds, type ReadResult } from './player-state.ts';

export const MAX_RESPONSE_BYTES = 192 * 1024;
export const READ_TIMEOUT_MS = 8000;

async function boundedJson(response: Response): Promise<unknown> {
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json') || !response.body) throw new Error('Source unavailable');
  const declared = response.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_RESPONSE_BYTES)) {
    await response.body.cancel(); throw new Error('Response too large');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw new Error('Response too large');
      chunks.push(chunk.value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {}); throw error;
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
}

export async function readPlayers(ids: string[], fetcher: typeof fetch = fetch): Promise<ReadResult> {
  validateIds(ids); // Reject before any network call.
  const started = new Date().toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), READ_TIMEOUT_MS);
  try {
    const url = new URL(HISTORY_ENDPOINT);
    url.searchParams.set('player_ids', ids.join(','));
    const response = await fetcher(url, {
      method: 'GET', headers: { Accept: 'application/json' },
      credentials: 'omit', redirect: 'manual', cache: 'no-store', signal: controller.signal,
    });
    const history = parseHistory(await boundedJson(response), ids);
    return { schema_version: 'tiber_trade_compare_read_v0', selected_ids: [...ids],
      status: history.status, history, reason: history.reason,
      transport: { endpoint: HISTORY_ENDPOINT, retrieval_started_at: started, retrieved_at: new Date().toISOString() } };
  } catch {
    return { schema_version: 'tiber_trade_compare_read_v0', selected_ids: [...ids], status: 'unavailable', history: null,
      reason: 'Historical evidence is unavailable: the source could not be reached or its response failed scope, size or contract checks.',
      transport: { endpoint: HISTORY_ENDPOINT, retrieval_started_at: started, retrieved_at: new Date().toISOString() } };
  } finally { clearTimeout(timer); }
}

export async function comparisonGet(request: Request, fetcher: typeof fetch = fetch): Promise<Response> {
  const url = new URL(request.url);
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  try {
    const keys = [...url.searchParams.keys()];
    if (request.method !== 'GET' || keys.length !== 1 || keys[0] !== 'ids') throw new Error('Invalid read');
    const ids = validateIds((url.searchParams.get('ids') ?? '').split(','));
    return new Response(JSON.stringify(await readPlayers(ids, fetcher)), { headers });
  } catch {
    return new Response(JSON.stringify({ status: 'invalid_input', reason: 'Only one ids parameter containing one to three distinct numeric Sleeper IDs is supported.' }), { status: 400, headers });
  }
}
