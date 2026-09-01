import { CanonicalizationError, canonicalizeForProfile, digestCanonicalPreimage } from '../canonicalization';
import { DIGEST_VECTORS } from '../fixtures/digestVectors';

describe('Hypothesis Core canonicalization', () => {
  for (const vector of Object.values(DIGEST_VECTORS)) {
    it(`reproduces ${vector.id} bytes and digest`, () => {
      const bytes = canonicalizeForProfile(vector.payload, vector.entry);
      expect(Buffer.from(bytes).toString('utf8')).toBe(vector.preimage);
      expect(bytes.byteLength).toBe(vector.bytes);
      expect(digestCanonicalPreimage(bytes)).toBe(vector.digest);
    });
  }

  it('keeps ordered arrays distinct', () => {
    expect(DIGEST_VECTORS.O1.digest).not.toBe(DIGEST_VECTORS.O2.digest);
  });

  it('normalizes set-like scalar arrays and collapses identical duplicates', () => {
    const bytes = canonicalizeForProfile({ id: 'h_1', witness_types: ['target','snap','target'] }, DIGEST_VECTORS.S1.entry);
    expect(Buffer.from(bytes).toString()).toBe(DIGEST_VECTORS.S1.preimage);
  });

  it.each([
    [{ id: 'h_1', observed_at: '2026-09-01T00:04:60Z' }, 'canonical_input_timestamp_leap_second'],
    [{ id: 'h_1', observed_at: '2026-09-01T00:04:05.1201Z' }, 'canonical_input_timestamp_precision'],
    [{ id: 'h_1', observed_at: '2026-09-01T00:04:05' }, 'canonical_input_timestamp_invalid'],
  ])('fails closed for invalid canonical input', (payload, code) => {
    try { canonicalizeForProfile(payload, DIGEST_VECTORS.T1.entry); throw new Error('expected refusal'); }
    catch (error) { expect(error).toBeInstanceOf(CanonicalizationError); expect((error as CanonicalizationError).code).toBe(code); }
  });
});
