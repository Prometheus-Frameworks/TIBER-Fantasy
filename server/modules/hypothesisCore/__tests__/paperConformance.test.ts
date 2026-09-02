import { createHash } from 'node:crypto';
import { evaluatePaperFixture, validateProductionRecord } from '../conformance';
import { CURRENT_PAPER_VECTORS_V1, HISTORICAL_PAPER_VECTORS_V0, LIVE_T0 } from '../fixtures/paperVectors';

const sha = (s: string) => `sha256:${createHash('sha256').update(s, 'utf8').digest('hex')}`;
describe('paper conformance', () => {
  it('preserves LIVE-T0 as not_comparable', () => {
    expect(Buffer.byteLength(LIVE_T0.preimage)).toBe(680);
    expect(sha(LIVE_T0.preimage)).toBe(LIVE_T0.digest);
    const parsed = JSON.parse(LIVE_T0.preimage);
    expect(parsed.payload).toMatchObject({ result: 'not_comparable', derived_relations: [], attention_evaluated: false, active_hypothesis_created: false, durable_records_emitted: 0 });
  });

  it.each(Object.entries(HISTORICAL_PAPER_VECTORS_V0))('keeps historical v0 %s immutable but non-current', (_name, vector) => {
    expect(Buffer.byteLength(vector.preimage)).toBe(vector.bytes);
    expect(sha(vector.preimage)).toBe(vector.digest);
    expect(JSON.parse(vector.preimage).schema.endsWith('/paper-fixture/v0')).toBe(true);
  });

  it.each(Object.entries(CURRENT_PAPER_VECTORS_V1))('uses authoritative v1 %s as current conformance', (_name, vector) => {
    expect(Buffer.byteLength(vector.preimage)).toBe(vector.bytes);
    expect(sha(vector.preimage)).toBe(vector.digest);
    const parsed = JSON.parse(vector.preimage);
    const result = evaluatePaperFixture(parsed);
    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') {
      expect(result.value.evaluation_delta).toBe('strengthened');
      expect(result.value.dimensions).toEqual({ holding_cost:'not_evaluated', probability:'unavailable', roster_fit:'not_evaluated', upside:'unavailable' });
    }
    expect(validateProductionRecord(parsed)).toEqual({ status:'refused', reason_code:'refused_non_governed_fixture' });
  });

  it('keeps all three subjects independent', () => {
    const ids = Object.values(CURRENT_PAPER_VECTORS_V1).map(v => JSON.parse(v.preimage).payload.primary_subject);
    expect(new Set(ids).size).toBe(3);
  });
});
