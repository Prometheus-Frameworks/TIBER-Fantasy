/** Bound decoded response bytes before parsing, including chunked/compressed bodies. */
export class BodyReadDeadlineError extends Error {
  constructor() { super('Body read deadline exceeded'); }
}
export async function readBoundedText(response: Pick<Response, 'headers' | 'body'>, maxBytes: number, deadlineMs = 10_000): Promise<string> {
  const declared = response.headers.get('content-length');
  if (declared && Number(declared) > maxBytes) {
    void response.body?.cancel().catch(() => {});
    throw new Error('Response limit exceeded');
  }
  if (!response.body) throw new Error('Missing response body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const parts: string[] = [];
  let bytes = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const read = async () => {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) throw new Error('Response limit exceeded');
      parts.push(decoder.decode(chunk.value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join('');
  };
  try {
    return await Promise.race([read(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new BodyReadDeadlineError()), deadlineMs);
    })]);
  } catch (error) {
    // A stalled inbound upload (or a rejecting cancel hook) must not hold a request forever.
    void reader.cancel().catch(() => {});
    throw error;
  } finally { if (timer) clearTimeout(timer); reader.releaseLock(); }
}
