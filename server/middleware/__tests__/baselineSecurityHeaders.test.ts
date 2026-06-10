/**
 * M6 phase 1 — baseline security headers.
 * Verifies the low-risk headers are set on every response and that NO
 * Content-Security-Policy is introduced here (CSP is deferred to a later
 * phase to avoid breaking the Vite/React asset graph).
 */
import { baselineSecurityHeaders } from '../security';

function runMiddleware() {
  const headers: Record<string, string> = {};
  const removed: string[] = [];
  const res = {
    setHeader: (name: string, value: string) => {
      headers[name] = value;
    },
    removeHeader: (name: string) => {
      removed.push(name);
    },
  };
  let nextCalled = false;
  const next = () => {
    nextCalled = true;
  };

  baselineSecurityHeaders()({} as any, res as any, next as any);
  return { headers, removed, nextCalled };
}

describe('baselineSecurityHeaders', () => {
  it('sets the expected low-risk security headers', () => {
    const { headers } = runMiddleware();
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Permissions-Policy']).toBe('camera=(), microphone=(), geolocation=()');
    expect(headers['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');
  });

  it('removes the X-Powered-By fingerprint', () => {
    const { removed } = runMiddleware();
    expect(removed).toContain('X-Powered-By');
  });

  it('does NOT set a Content-Security-Policy (deferred to a later phase)', () => {
    const { headers } = runMiddleware();
    expect(headers['Content-Security-Policy']).toBeUndefined();
  });

  it('calls next()', () => {
    const { nextCalled } = runMiddleware();
    expect(nextCalled).toBe(true);
  });
});
