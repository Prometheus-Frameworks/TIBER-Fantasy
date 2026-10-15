/** Bound decoded response bytes before parsing, including chunked/compressed bodies. */
export async function readBoundedText(response: Pick<Response, 'headers' | 'body'>, maxBytes: number): Promise<string> {
  const declared = response.headers.get('content-length');
  if (declared && Number(declared) > maxBytes) {
    await response.body?.cancel();
    throw new Error('Response limit exceeded');
  }
  if (!response.body) throw new Error('Missing response body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const parts: string[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) throw new Error('Response limit exceeded');
      parts.push(decoder.decode(chunk.value, { stream: true }));
    }
    parts.push(decoder.decode());
    return parts.join('');
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
}
