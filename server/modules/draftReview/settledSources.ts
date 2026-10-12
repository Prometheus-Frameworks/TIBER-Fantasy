/** Drain every started source request before a bounded caller releases its slot.
 * A failed sibling must not leave live upstream requests outside that slot. */
export async function settleSourceReads<T extends readonly unknown[]>(
  reads: { [K in keyof T]: Promise<T[K]> },
): Promise<T> {
  const results = await Promise.allSettled(reads);
  if (results.some(result => result.status === 'rejected')) throw new Error('Source reads unavailable');
  return results.map(result => (result as PromiseFulfilledResult<unknown>).value) as unknown as T;
}
