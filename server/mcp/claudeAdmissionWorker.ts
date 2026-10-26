/**
 * Claude admission adapter (candidate, static bearer v1).
 *
 * A separate Worker entry for a separate, owner-private deployment reached by a Claude custom
 * connector using an organization-Owner request header (`Authorization: Bearer <token>`).
 * The ChatGPT Worker (`leagueReaderWorker.ts`) and all tool/domain code are reused unchanged.
 *
 * Admission order (fail closed; nothing reaches the inner Worker until all pass):
 *   1. path is exactly /mcp, otherwise 404 (no landing page, no discovery documents)
 *   2. explicit kill switch TIBER_CLAUDE_ADMISSION=static-bearer-v1, otherwise 503
 *   3. TIBER_CLAUDE_TOKEN_SHA256 is a 64-char lowercase hex digest, otherwise 503
 *   4. Anthropic egress range 160.79.104.0/21 via CF-Connecting-IP, unless explicitly
 *      TIBER_CLAUDE_EGRESS_CHECK=off
 *   5. no foreign browser Origin (including chatgpt.com)
 *   6. bearer token whose SHA-256 matches in constant time, otherwise 401
 *
 * Only after admission are caller-supplied identity/credential headers removed and a fixed
 * principal injected for the inner Worker's identity check. One principal, one profile:
 * this adapter must never be shared with anyone else while the profile is single-owner.
 * The 401 deliberately carries no OAuth `resource_metadata`, so Claude never starts OAuth.
 *
 * Frozen ROP is never enabled here: only league environment values are forwarded, and the
 * companion build script refuses private input.
 */
import inner from './leagueReaderWorker';

type Env = {
  TIBER_CLAUDE_ADMISSION?: string;
  TIBER_CLAUDE_TOKEN_SHA256?: string;
  TIBER_CLAUDE_EGRESS_CHECK?: string;
  TIBER_LEAGUE_SOURCE?: string;
  TIBER_PROFILE_USER_ID?: string;
  TIBER_DEFAULT_LEAGUE_ID?: string;
};

export const CLAUDE_ADMISSION_MODE = 'static-bearer-v1';
export const CLAUDE_PRINCIPAL = 'claude-static-owner';
const TOKEN = /^Bearer ([A-Za-z0-9._~+/=-]{32,512})$/;
const DIGEST = /^[0-9a-f]{64}$/;
const STRIPPED = ['authorization', 'cookie', 'oai-authenticated-user-id'];

const json = (status: number, reason: string, extra: Record<string, string> = {}) =>
  Response.json({ error: reason }, { status, headers: { 'Cache-Control': 'no-store', ...extra } });

/** IPv4 only: 160.79.104.0/21 (Anthropic connector egress per claude.com connector docs). */
export function inAnthropicEgress(ip: string | null): boolean {
  const parts = ip?.trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!parts) return false;
  const octets = parts.slice(1).map(Number);
  if (octets.some(o => o > 255)) return false;
  return octets[0] === 160 && octets[1] === 79 && octets[2] >= 104 && octets[2] <= 111;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

/** Both inputs are fixed-length hex digests, so the loop length never depends on the secret. */
function digestsEqual(a: string, b: string): boolean {
  if (a.length !== 64 || b.length !== 64) return false;
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== '/mcp') return json(404, 'not_found');
    if (env.TIBER_CLAUDE_ADMISSION !== CLAUDE_ADMISSION_MODE) return json(503, 'claude_admission_disabled');
    const expected = env.TIBER_CLAUDE_TOKEN_SHA256 ?? '';
    if (!DIGEST.test(expected)) return json(503, 'claude_admission_unconfigured');
    if (env.TIBER_CLAUDE_EGRESS_CHECK !== 'off' && !inAnthropicEgress(request.headers.get('cf-connecting-ip'))) {
      return json(403, 'egress_not_allowed');
    }
    const origin = request.headers.get('origin');
    if (origin && origin !== url.origin) return json(403, 'origin_not_allowed');
    const presented = request.headers.get('authorization')?.match(TOKEN)?.[1];
    // Hash a fixed placeholder when absent so the refusal path does the same work either way.
    const actual = await sha256Hex(presented ?? 'absent');
    if (!presented || !digestsEqual(actual, expected)) {
      return json(401, 'invalid_credentials', { 'WWW-Authenticate': 'Bearer realm="tiber"' });
    }
    const headers = new Headers(request.headers);
    for (const name of STRIPPED) headers.delete(name);
    headers.set('oai-authenticated-user-id', CLAUDE_PRINCIPAL);
    const admitted = new Request(request, { headers });
    // League values only; TIBER_ROP_SOURCE is never forwarded.
    return inner.fetch(admitted, {
      TIBER_LEAGUE_SOURCE: env.TIBER_LEAGUE_SOURCE,
      TIBER_PROFILE_USER_ID: env.TIBER_PROFILE_USER_ID,
      TIBER_DEFAULT_LEAGUE_ID: env.TIBER_DEFAULT_LEAGUE_ID,
    });
  },
};
