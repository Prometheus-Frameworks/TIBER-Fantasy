/**
 * M6 phase 1 — baseline security headers.
 * Verifies the low-risk headers are set on every response and that NO
 * Content-Security-Policy is introduced here (CSP is deferred to a later
 * phase to avoid breaking the Vite/React asset graph).
 */
import express from 'express';
import http from 'node:http';
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

describe('baselineSecurityHeaders ordering (parser-error coverage)', () => {
  // Mirrors server/index.ts: headers are registered BEFORE the body parsers,
  // so a malformed-JSON 400 from express.json() still carries the headers.
  it('still sets baseline headers when express.json() rejects malformed JSON', async () => {
    const app = express();
    app.use(baselineSecurityHeaders());
    app.use(express.json());
    app.post('/echo', (_req, res) => res.json({ ok: true }));
    app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(err?.status ?? err?.statusCode ?? 500).json({ message: 'error' });
    });

    const server = await new Promise<http.Server>((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });

    try {
      const { port } = server.address() as { port: number };
      const result = await new Promise<{ status: number; headers: http.IncomingHttpHeaders }>(
        (resolve, reject) => {
          const req = http.request(
            {
              host: '127.0.0.1',
              port,
              path: '/echo',
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
            },
            (res) => {
              res.resume();
              res.on('end', () => resolve({ status: res.statusCode || 0, headers: res.headers }));
            },
          );
          req.on('error', reject);
          req.end('{ not valid json ');
        },
      );

      expect(result.status).toBe(400);
      expect(result.headers['x-content-type-options']).toBe('nosniff');
      expect(result.headers['strict-transport-security']).toBe('max-age=31536000; includeSubDomains');
      expect(result.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
