import { evaluatePaperFixture, evaluateTrigger } from '../conformance';
import { CURRENT_PAPER_VECTORS_V1 } from '../fixtures/paperVectors';

describe('witness and trigger evaluation', () => {
  it('derives remaining witnesses in F0 order from local effect maps', () => {
    const fixture = JSON.parse(CURRENT_PAPER_VECTORS_V1.holani.preimage);
    const result = evaluatePaperFixture(fixture);
    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') expect(result.value.remaining_missing_witnesses).toEqual(['two_minute_usage','competition_carry_split','relevant_availability_state']);
  });

  it('refuses an asserted delta without strict witness-local effect_map', () => {
    const fixture = JSON.parse(CURRENT_PAPER_VECTORS_V1.boston.preimage);
    delete fixture.payload.paper_f1.synthetic_observations[0].effect_map;
    expect(evaluatePaperFixture(fixture).status).toBe('refused');
  });

  it('does not wake from unchanged projected input', () => {
    const fingerprints = { hypothesis_definition:'sha256:a', football_evidence:'sha256:b', operator_context:'sha256:c', evaluation_method:'sha256:d' };
    expect(evaluateTrigger({ prior_evaluation_ref:null, old_input_fingerprints:fingerprints, new_input_fingerprints:fingerprints, prior_dependency_projected_input_digest:'sha256:x', dependency_projected_input_digest:'sha256:x', changed_dependency_keys:[] })).toEqual({ status:'no_op', reason_code:'trigger_projection_unchanged' });
  });

  it('wakes only on one of the four declared input fingerprints', () => {
    const oldF = { hypothesis_definition:'a', football_evidence:'b', operator_context:'c', evaluation_method:'d' };
    const result = evaluateTrigger({ prior_evaluation_ref:null, old_input_fingerprints:oldF, new_input_fingerprints:{...oldF, football_evidence:'new'}, prior_dependency_projected_input_digest:'x', dependency_projected_input_digest:'y', changed_dependency_keys:['evidence:route'] });
    expect(result).toEqual({ status:'accepted', value:{ decision:'append_evaluation', changed_components:['football_evidence'] } });
  });
});
