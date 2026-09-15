import { teamAccountRequest, TeamAccountRequestError } from './teamAccountApi';

const WINDOW_MS = 61_000; // Server route permits 30 requests per 60-second window.
const LIMIT = 30;
function pause(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new Error('Request cancelled')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, Math.min(ms, 60_000));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

/** Retained across refreshes/account changes in this page, without persistent storage.
 * Reserve before fetch, including failures/aborts. A shared-IP 429 also pauses both workers.
 * Waiting belongs only to an explicit refresh and is cancelled with its AbortSignal. */
export function createManagerRequester(request = teamAccountRequest) {
  let starts: number[] = [];
  let blockedUntil = 0;
  return async (path: string, options: { signal: AbortSignal }) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      while (true) {
        if (options.signal.aborted) throw new Error('Request cancelled');
        const now = Date.now();
        starts = starts.filter(time => now - time < WINDOW_MS);
        const wait = Math.max(blockedUntil - now, starts.length >= LIMIT ? starts[0] + WINDOW_MS - now : 0);
        if (wait <= 0) { starts.push(now); break; }
        await pause(wait, options.signal);
      }
      try { return await request(path, options); }
      catch (error) {
        if (!(error instanceof TeamAccountRequestError) || error.status !== 429) throw error;
        blockedUntil = Math.max(blockedUntil, Date.now() + WINDOW_MS);
        if (attempt === 1) throw error;
      }
    }
  };
}
export const requestManagerResult = createManagerRequester();
