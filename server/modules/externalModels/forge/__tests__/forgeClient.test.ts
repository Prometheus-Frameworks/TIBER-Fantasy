import { ForgeClient } from '../forgeClient';

describe('ForgeClient', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it('maps upstream unavailability to a stable error code', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
    } as any);

    const client = new ForgeClient({
      baseUrl: 'http://forge.example',
      timeoutMs: 50,
      enabled: true,
    });

    await expect(
      client.fetchEvaluation({
        playerId: '00-0036322',
        position: 'WR',
        season: 2025,
        week: 17,
        mode: 'redraft',
        includeSourceMeta: true,
        includeRawCanonical: false,
      }),
    ).rejects.toMatchObject({
      code: 'upstream_unavailable',
      status: 503,
    });
  });

  it('maps request timeouts to a stable timeout error', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn((_url, init) => new Promise((_resolve, _reject) => {
      init?.signal?.addEventListener('abort', () => {
        const abortError = new Error('aborted');
        abortError.name = 'AbortError';
        _reject(abortError);
      });
    })) as any;

    const client = new ForgeClient({
      baseUrl: 'http://forge.example',
      timeoutMs: 25,
      enabled: true,
    });

    const promise = client.fetchEvaluation({
      playerId: '00-0036322',
      position: 'WR',
      season: 2025,
      week: 17,
      mode: 'redraft',
      includeSourceMeta: true,
      includeRawCanonical: false,
    });

    const expectation = expect(promise).rejects.toMatchObject({
      code: 'upstream_timeout',
      status: 504,
    });

    await jest.advanceTimersByTimeAsync(30);
    await expectation;
  });
});
