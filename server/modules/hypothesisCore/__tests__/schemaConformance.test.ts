import { CanonicalSubjectReceiptV0Schema, HypothesisAuthorityReceiptV0Schema, HypothesisVersionV0Schema, PaperFixtureV0Schema, PaperFixtureV1Schema, PayoffPredicateV0Schema, PrivateRecordRefV0Schema, ReferenceV0Schema, WitnessResultV0Schema } from '../schemas';
import { CURRENT_PAPER_VECTORS_V1, HISTORICAL_PAPER_VECTORS_V0 } from '../fixtures/paperVectors';

const hex = 'a'.repeat(64);
const privateRef = { ref_kind:'operator_private_record', schema_id:'tiber.hypothesis-core/x/v0', record_id:`tbr_hyv_${'a'.repeat(32)}`, workspace_id:'ws:joe', record_digest:`sha256:${hex}` } as const;
const contractRef = { ref_kind:'governed_contract', governance_namespace:'tiber', contract_schema_id:'contract/v0', contract_id:'identity-registry', contract_version:'v0', digest_profile:'sha256', contract_digest:`sha256:${hex}` } as const;
const envelope = { schema_id:'tiber.hypothesis-core/canonical-subject-receipt/v0', record_id:`tbr_hyid_${'b'.repeat(32)}`, workspace_id:'ws:joe', operator_id:'op:joe', season_scope:'nfl:2026', scope:'operator_local', visibility:'operator_private', clocks:{ recorded_at:'2026-09-01T00:00:00Z', observed_at:null, received_at:null }, actor:{ actor_type:'operator', actor_ref:'op:joe' }, record_authority:{ source_authority:'operator_supplied', derivation_type:'observed', basis_refs:[] }, provenance_refs:[], predecessor_refs:[], digest_profile:'tiber.hypothesis-core.digest/jcs-sha256-v0', record_digest:`sha256:${hex}` } as const;
const predicate = { predicate_id:'p1', status:'operational', subject_ref:'primary', measure_ref:contractRef, test:{ operator:'eq', operand:{ value_type:'boolean', value:true, unit_ref:null } }, scope_ref:contractRef, window_ref:contractRef, applicability_predicate_ids:[], evidence_policy_ref:contractRef, unresolved_reason:null } as const;
const version = {
  ...envelope, schema_id:'tiber.hypothesis-core/hypothesis-version/v0', record_id:`tbr_hyv_${'d'.repeat(32)}`,
  hypothesis_id:`tbr_hyp_${'e'.repeat(32)}`, version_ordinal:1, version_authority_receipt_ref:privateRef,
  primary_subject:{ subject_type:'tiber_player', tiber_player_id:'tbr_p_01ARZ3NDEKTSV4RRFFQ69G5FAV', identity_receipt_ref:privateRef }, related_subjects:[], cem_refs:[],
  statement:'Synthetic operational proposition.', management_horizon:'horizon:v0', payoff_condition:{ predicate_status:'operational', unresolved_terms:[], predicates:[predicate], expression:{ mode:'all', predicate_ids:['p1'], policy_ref:null } },
  resolution_plan:{ evidence_window:'unknown', next_decision_boundary_ref:null, occurs_after_expected_evidence:'unknown', relevance_horizon_ref:null, expires_before_resolution:'unknown', bounded:false, missing_witnesses:[] },
  dependency_manifest:{ primary_subject_ref:'primary', related_subject_refs:[], witness_type_refs:[], artifact_family_refs:[], football_field_refs:[], scenario_family_refs:[], operator_context_field_refs:[], boundary_refs:[], freshness_governance:[] },
  predecessor_version_ref:null, predecessor_hypothesis_ref:null,
} as const;

describe('strict Hypothesis Core schemas', () => {
  it('keeps reference branches disjoint and closed', () => {
    expect(ReferenceV0Schema.safeParse(privateRef).success).toBe(true);
    expect(ReferenceV0Schema.safeParse(contractRef).success).toBe(true);
    expect(ReferenceV0Schema.safeParse({ ...privateRef, contract_id:'smuggled' }).success).toBe(false);
    expect(PrivateRecordRefV0Schema.safeParse({ ...privateRef, workspace_id:undefined }).success).toBe(false);
  });

  it('requires a merge-resolved canonical subject only for resolved receipts', () => {
    const valid = { ...envelope, registry_contract_ref:contractRef, lookup_basis_ref:privateRef, lookup_observed_at:'2026-09-01T00:00:00Z', locator:{ kind:'player_name', value:'Synthetic Player' }, resolution_status:'resolved', resolved_subject:{ subject_type:'tiber_player', tiber_player_id:'tbr_p_01ARZ3NDEKTSV4RRFFQ69G5FAV', merge_resolution_status:'resolved_to_survivor' } };
    expect(CanonicalSubjectReceiptV0Schema.safeParse(valid).success).toBe(true);
    expect(CanonicalSubjectReceiptV0Schema.safeParse({ ...valid, extra:true }).success).toBe(false);
    expect(CanonicalSubjectReceiptV0Schema.safeParse({ ...valid, resolution_status:'ambiguous' }).success).toBe(false);
    expect(CanonicalSubjectReceiptV0Schema.safeParse({ ...valid, lookup_basis_ref:{...privateRef,workspace_id:'ws:other'} }).success).toBe(false);
  });

  it('admits only the R3 action domain', () => {
    const authority = { ...envelope, schema_id:'tiber.hypothesis-core/hypothesis-authority-receipt/v0', record_id:`tbr_hya_${'c'.repeat(32)}`, action_class:'create_initial_unrelated', decision:'authorized', intent_projection_id:'unrelated_initial_version_intent_v0', intent_digest:`sha256:${hex}`, confirmation_mode:'explicit_operator_confirmation', single_use:true };
    expect(HypothesisAuthorityReceiptV0Schema.safeParse(authority).success).toBe(true);
    expect(HypothesisAuthorityReceiptV0Schema.safeParse({ ...authority, action_class:'create_initial' }).success).toBe(false);
    expect(HypothesisAuthorityReceiptV0Schema.safeParse({ ...authority, action_class:'supersede_hypothesis' }).success).toBe(false);
  });

  it('separates immutable historical v0 from authoritative current v1 paper schemas', () => {
    expect(PaperFixtureV0Schema.safeParse(JSON.parse(HISTORICAL_PAPER_VECTORS_V0.boston.preimage)).success).toBe(true);
    expect(PaperFixtureV1Schema.safeParse(JSON.parse(CURRENT_PAPER_VECTORS_V1.boston.preimage)).success).toBe(true);
    expect(PaperFixtureV1Schema.safeParse(JSON.parse(HISTORICAL_PAPER_VECTORS_V0.boston.preimage)).success).toBe(false);
  });

  it('keeps unavailable/unobserved witnesses indeterminate and gates observed absence', () => {
    const base={witness_id:'w1',window_state:'open',observation_state:'unavailable',coverage_state:'unknown',evaluative_effect:'indeterminate',basis_refs:[],coverage_receipt_refs:[],contradiction_refs:[],reason_codes:['input_unavailable']};
    expect(WitnessResultV0Schema.safeParse(base).success).toBe(true);
    expect(WitnessResultV0Schema.safeParse({...base,evaluative_effect:'weakens'}).success).toBe(false);
    expect(WitnessResultV0Schema.safeParse({...base,observation_state:'unobserved',reason_codes:[],evaluative_effect:'falsifies_component'}).success).toBe(false);
    expect(WitnessResultV0Schema.safeParse({...base,observation_state:'observed_absent',reason_codes:[],basis_refs:[privateRef]}).success).toBe(false);
    expect(WitnessResultV0Schema.safeParse({...base,observation_state:'observed_absent',reason_codes:[],window_state:'closed',coverage_state:'complete',basis_refs:[privateRef],coverage_receipt_refs:[privateRef],evaluative_effect:'weakens'}).success).toBe(true);
  });

  it('requires all and any expressions to name declared predicates', () => {
    expect(HypothesisVersionV0Schema.safeParse(version).success).toBe(true);
    expect(HypothesisVersionV0Schema.safeParse({ ...version, payoff_condition:{ ...version.payoff_condition, expression:{ mode:'any', predicate_ids:['p1'], policy_ref:null } } }).success).toBe(true);
    expect(HypothesisVersionV0Schema.safeParse({ ...version, payoff_condition:{ ...version.payoff_condition, expression:{ mode:'all', predicate_ids:['missing'], policy_ref:null } } }).success).toBe(false);
    expect(HypothesisVersionV0Schema.safeParse({ ...version, payoff_condition:{ ...version.payoff_condition, expression:{ mode:'any', predicate_ids:['p1','missing'], policy_ref:null } } }).success).toBe(false);
  });

  it.each([
    ['boolean', true, true], ['boolean', 'false', false],
    ['integer', 12, true], ['integer', '12', false], ['integer', 1.5, false],
    ['decimal_string', '12.5', true], ['decimal_string', 12, false], ['decimal_string', '01.5', false],
    ['string', 'value', true], ['string', false, false],
    ['enum', 'member', true], ['enum', 1, false],
  ])('binds %s operands to their declared runtime representation', (value_type, value, expected) => {
    const candidate = { ...predicate, test:{ ...predicate.test, operand:{ value_type, value, unit_ref:null } } };
    expect(PayoffPredicateV0Schema.safeParse(candidate).success).toBe(expected);
  });
});
