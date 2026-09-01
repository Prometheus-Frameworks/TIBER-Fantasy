import { CanonicalSubjectReceiptV0Schema, HypothesisAuthorityReceiptV0Schema, PaperFixtureV0Schema, PaperFixtureV1Schema, PrivateRecordRefV0Schema, ReferenceV0Schema } from '../schemas';
import { CURRENT_PAPER_VECTORS_V1, HISTORICAL_PAPER_VECTORS_V0 } from '../fixtures/paperVectors';

const hex = 'a'.repeat(64);
const privateRef = { ref_kind:'operator_private_record', schema_id:'tiber.hypothesis-core/x/v0', record_id:`tbr_hyv_${'a'.repeat(32)}`, workspace_id:'ws:joe', record_digest:`sha256:${hex}` } as const;
const contractRef = { ref_kind:'governed_contract', governance_namespace:'tiber', contract_schema_id:'contract/v0', contract_id:'identity-registry', contract_version:'v0', digest_profile:'sha256', contract_digest:`sha256:${hex}` } as const;
const envelope = { schema_id:'tiber.hypothesis-core/canonical-subject-receipt/v0', record_id:`tbr_hyid_${'b'.repeat(32)}`, workspace_id:'ws:joe', operator_id:'op:joe', season_scope:'nfl:2026', scope:'operator_local', visibility:'operator_private', clocks:{ recorded_at:'2026-09-01T00:00:00Z', observed_at:null, received_at:null }, actor:{ actor_type:'operator', actor_ref:'op:joe' }, record_authority:{ source_authority:'operator_supplied', derivation_type:'observed', basis_refs:[] }, provenance_refs:[], predecessor_refs:[], digest_profile:'tiber.hypothesis-core.digest/jcs-sha256-v0', record_digest:`sha256:${hex}` } as const;

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
});
