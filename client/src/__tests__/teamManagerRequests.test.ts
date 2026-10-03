import { createManagerRequester } from '@/lib/teamManagerRequests';
import { TeamAccountRequestError } from '@/lib/teamAccountApi';
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(0); });
afterEach(() => jest.useRealTimers());
test('31 selected leagues stay within the route budget and complete after the window', async () => {
  const request = jest.fn().mockResolvedValue({}); const read = createManagerRequester(request);
  const options = { signal: new AbortController().signal };
  const work = Array.from({ length: 31 }, () => read('/manager', options));
  expect(request).toHaveBeenCalledTimes(30);
  await jest.advanceTimersByTimeAsync(60_000); expect(request).toHaveBeenCalledTimes(30);
  await jest.advanceTimersByTimeAsync(1_000); await Promise.all(work); expect(request).toHaveBeenCalledTimes(31);
});
test('an immediate second 16-league refresh retains the first refresh budget', async () => {
  const request = jest.fn().mockResolvedValue({}); const read = createManagerRequester(request);
  const options = { signal: new AbortController().signal };
  await Promise.all(Array.from({ length: 16 }, () => read('/manager', options)));
  const second = Promise.all(Array.from({ length: 16 }, () => read('/manager', options)));
  expect(request).toHaveBeenCalledTimes(30);
  await jest.advanceTimersByTimeAsync(61_000); await second; expect(request).toHaveBeenCalledTimes(32);
});
test('cancelled queued requests never reach the source', async () => {
  const request = jest.fn().mockResolvedValue({}); const read = createManagerRequester(request);
  const controller = new AbortController();
  await Promise.all(Array.from({ length: 30 }, () => read('/manager', { signal: controller.signal })));
  const queued = read('/manager', { signal: controller.signal }); const rejected = expect(queued).rejects.toThrow('cancelled');
  controller.abort(); await rejected; await jest.advanceTimersByTimeAsync(61_000);
  expect(request).toHaveBeenCalledTimes(30); expect(jest.getTimerCount()).toBe(0);
});
test('429 pauses peers and retries once; repeated throttling stays a rate error', async () => {
  const error = new TeamAccountRequestError(429, 'Rate limit exceeded');
  const request = jest.fn().mockRejectedValue(error); const read = createManagerRequester(request);
  const work = read('/manager', { signal: new AbortController().signal }); const rejected = expect(work).rejects.toBe(error);
  await jest.advanceTimersByTimeAsync(0); expect(request).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(60_000); expect(request).toHaveBeenCalledTimes(1);
  await jest.advanceTimersByTimeAsync(1_000); await rejected; expect(request).toHaveBeenCalledTimes(2);
});
test('non-rate failures do not wait or retry', async () => {
  const request = jest.fn().mockRejectedValue(new TeamAccountRequestError(502, 'source')); const read = createManagerRequester(request);
  await expect(read('/manager', { signal: new AbortController().signal })).rejects.toMatchObject({ status: 502 });
  expect(request).toHaveBeenCalledTimes(1); expect(jest.getTimerCount()).toBe(0);
});
