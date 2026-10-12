import { createHash, timingSafeEqual } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { AUTH_POLICY, TeamAuthError } from '@shared/teamAuth';

export interface GoogleIdentity { issuer: 'https://accounts.google.com'; subject: string; expiresAt: number }
export type GoogleVerifier = (credential: string, nonceHash: string, challengeCreatedAt: number) => Promise<GoogleIdentity>;

export const authHash = (value: string) => createHash('sha256').update(value).digest('hex');
class GoogleCertificateUnavailable extends TeamAuthError {
  constructor() { super(503, 'AUTH_IDENTITY_UNAVAILABLE'); }
}
export function constantEqual(a: string, b: string): boolean {
  const left = Buffer.from(a); const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

// The interceptor runs for each certificate request, including library retries.
// It aborts the underlying request, rather than merely abandoning its Promise.
export function boundedGoogleClient(): OAuth2Client {
  const client = new OAuth2Client({ useAuthRequestParameters: false });
  client.transporter.interceptors.request.add({ resolved: async options => {
    options.timeout = AUTH_POLICY.sourceTimeoutMs;
    options.signal = AbortSignal.timeout(AUTH_POLICY.sourceTimeoutMs);
    options.retry = false;
    options.retryConfig = { retry: 0 };
    return options;
  } });
  // Classify at the certificate boundary: transport libraries do not promise
  // a common message prefix for aborts, DNS, TLS, HTTP or decoding failures.
  const certificates = client.getFederatedSignonCertsAsync.bind(client);
  client.getFederatedSignonCertsAsync = async () => {
    try { return await certificates(); }
    catch { throw new GoogleCertificateUnavailable(); }
  };
  return client;
}

export function createGoogleVerifier(
  audience: string,
  client: Pick<OAuth2Client, 'verifyIdToken'> = boundedGoogleClient(),
  now: () => number = Date.now,
): GoogleVerifier {
  return async (credential, nonceHash, challengeCreatedAt) => {
    try {
      const ticket = await client.verifyIdToken({ idToken: credential, audience });
      const claims = ticket.getPayload() as unknown as Record<string, unknown> | undefined;
      const clock = now();
      if (!claims || typeof claims.iss !== 'string' || !['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss) ||
          claims.aud !== audience || (claims.azp !== undefined && claims.azp !== audience) ||
          typeof claims.sub !== 'string' || claims.sub.length === 0 || claims.sub.length > 255 ||
          typeof claims.nonce !== 'string' || !/^[a-f0-9]{64}$/.test(claims.nonce) ||
          !constantEqual(authHash(claims.nonce), nonceHash) ||
          typeof claims.iat !== 'number' || !Number.isSafeInteger(claims.iat) ||
          typeof claims.exp !== 'number' || !Number.isSafeInteger(claims.exp) ||
          claims.exp * 1000 <= clock || claims.exp <= claims.iat ||
          claims.iat * 1000 > clock + AUTH_POLICY.clockSkewMs ||
          claims.iat * 1000 < challengeCreatedAt - AUTH_POLICY.clockSkewMs ||
          clock >= challengeCreatedAt + AUTH_POLICY.challengeMs) {
        throw new TeamAuthError(401, 'AUTH_INVALID_CREDENTIAL');
      }
      return { issuer: 'https://accounts.google.com', subject: claims.sub, expiresAt: claims.exp * 1000 };
    } catch (error) {
      if (error instanceof GoogleCertificateUnavailable) throw error;
      throw new TeamAuthError(401, 'AUTH_INVALID_CREDENTIAL');
    }
  };
}
