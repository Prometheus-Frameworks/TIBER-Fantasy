import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { buildLeagueReaderServer } from './leagueReaderServer';
import { createLeagueTools, publicReaders, type Readers } from '../modules/leagueMcp/tools';
import { createPersonalReaders } from '../modules/leagueMcp/personalContext';
import { BodyReadDeadlineError, readBoundedText } from '../integrations/boundedFetch';

type Env = { TIBER_LEAGUE_SOURCE?: string; TIBER_PROFILE_USER_ID?: string; TIBER_DEFAULT_LEAGUE_ID?: string };
let cachedKey = '';
let cachedCall: ReturnType<typeof createLeagueTools> | undefined;
let windowStart = 0, readCount = 0;
const json = (status: number, reason: string) => Response.json({ error: reason }, { status, headers: { 'Cache-Control': 'no-store' } });

/** Sites owns OAuth and owner-private admission; identity is also required for data calls. */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/' && request.method === 'GET') {
      return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>TIBER League Context</title><body style="max-width:650px;margin:12vh auto;padding:24px;font:18px system-ui;line-height:1.6;color:#18241e;background:#fafcf9"><p style="color:#b05425">TIBER · PERSONAL CONNECTOR</p><h1>Your league, in the conversation.</h1><p>This private, read-only connector supplies Sleeper rosters, scoring, lineups, verified byes and candidate availability to ChatGPT.</p><p>Connect the TIBER League Context plugin, then ask about your lineup. It cannot submit claims, bids or roster changes.</p></body></html>', { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
    }
    if (url.pathname !== '/mcp') return json(404, 'not_found');
    if (request.method !== 'POST') return new Response(null, { status: 405, headers: { Allow: 'POST' } });
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin && origin !== 'https://chatgpt.com') return json(403, 'origin_not_allowed');
    let body: unknown;
    try { body = JSON.parse(await readBoundedText(request, 16_384)); }
    catch (error) { return error instanceof BodyReadDeadlineError ? json(408, 'request_body_deadline') : json(413, 'invalid_or_oversized_request'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json(400, 'single_request_required');
    const method = (body as { method?: unknown }).method;
    if (method === 'tools/call') {
      if (!request.headers.get('oai-authenticated-user-id')?.trim()) return json(403, 'authenticated_user_required');
      if (Date.now() - windowStart >= 60_000) { windowStart = Date.now(); readCount = 0; }
      if (++readCount > 30) return json(429, 'read_rate_limit');
    }
    const key = JSON.stringify([env.TIBER_LEAGUE_SOURCE, env.TIBER_PROFILE_USER_ID, env.TIBER_DEFAULT_LEAGUE_ID]);
    let readers: Readers | null = null;
    if (env.TIBER_LEAGUE_SOURCE === 'public-sleeper') {
      readers = { ...publicReaders };
      if (env.TIBER_PROFILE_USER_ID) {
        try { Object.assign(readers, createPersonalReaders({ userId: env.TIBER_PROFILE_USER_ID,
          ...(env.TIBER_DEFAULT_LEAGUE_ID ? { defaultLeagueId: env.TIBER_DEFAULT_LEAGUE_ID } : {}) })); }
        catch { return json(503, 'profile_configuration_unavailable'); }
      }
    }
    if (!cachedCall || cachedKey !== key) { cachedCall = createLeagueTools(readers, 30_000, true); cachedKey = key; }
    const server = buildLeagueReaderServer(readers, cachedCall);
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    try {
      await server.connect(transport);
      const response = await transport.handleRequest(request, { parsedBody: body });
      response.headers.set('Cache-Control', 'no-store');
      return response;
    } catch { return json(503, 'reader_unavailable'); }
    finally { await server.close(); }
  },
};
