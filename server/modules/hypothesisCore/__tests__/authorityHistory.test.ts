import { proposeAuthorizedAppend, type AcceptanceHeadV0 } from '../conformance';
import { canonicalizeForProfile, digestCanonicalPreimage } from '../canonicalization';
import { AuthorizationIntentV0Schema } from '../schemas';

const h64 = (c: string) => c.repeat(64);
const envelope = { schema_id:'tiber.hypothesis-core/hypothesis-authority-receipt/v0', record_id:`tbr_hya_${'a'.repeat(32)}`, workspace_id:'ws:joe', operator_id:'op:joe', season_scope:'nfl:2026', scope:'operator_local', visibility:'operator_private', clocks:{ recorded_at:'2026-09-01T00:00:00Z', observed_at:null, received_at:null }, actor:{ actor_type:'operator', actor_ref:'op:joe' }, record_authority:{ source_authority:'operator_supplied', derivation_type:'observed', basis_refs:[] }, provenance_refs:[], predecessor_refs:[], digest_profile:'tiber.hypothesis-core.digest/jcs-sha256-v0', record_digest:`sha256:${h64('b')}` } as const;
const baseHead: AcceptanceHeadV0 = { workspace_id:'ws:joe', operator_id:'op:joe', hypothesis_id:null, current_version_ref:null, lifecycle_state:'absent', latest_evaluation_ref:null, source_dependency_projection_digest:null, freshness_head_refs:[], consumed_authority_receipt_digests:[] };
const receiptRef = { ref_kind:'operator_private_record', schema_id:envelope.schema_id, record_id:envelope.record_id, workspace_id:envelope.workspace_id, record_digest:envelope.record_digest } as const;
const identityRef = { ...receiptRef, schema_id:'tiber.hypothesis-core/canonical-subject-receipt/v0', record_id:`tbr_hyid_${'c'.repeat(32)}`, record_digest:`sha256:${h64('c')}` } as const;
const contractRef = { ref_kind:'governed_contract', governance_namespace:'tiber', contract_schema_id:'contract/v0', contract_id:'policy', contract_version:'v0', digest_profile:'sha256', contract_digest:`sha256:${h64('d')}` } as const;
const versionPayload = { hypothesis_id:`tbr_hyp_${'e'.repeat(32)}`, version_ordinal:1, primary_subject:{ subject_type:'tiber_player', tiber_player_id:'tbr_p_01ARZ3NDEKTSV4RRFFQ69G5FAV', identity_receipt_ref:identityRef }, related_subjects:[], cem_refs:[], statement:'Synthetic unresolved proposition.', management_horizon:'horizon:v0', payoff_condition:{ predicate_status:'unresolved', unresolved_terms:['synthetic_term'], predicates:[], expression:{ mode:'policy_ref', predicate_ids:[], policy_ref:contractRef } }, resolution_plan:{ evidence_window:'unknown', next_decision_boundary_ref:null, occurs_after_expected_evidence:'unknown', relevance_horizon_ref:null, expires_before_resolution:'unknown', bounded:false, missing_witnesses:[] }, dependency_manifest:{ primary_subject_ref:'primary', related_subject_refs:[], witness_type_refs:[], artifact_family_refs:[], football_field_refs:[], scenario_family_refs:[], operator_context_field_refs:[], boundary_refs:[], freshness_governance:[] }, predecessor_version_ref:null, predecessor_hypothesis_ref:null } as const;
const intent = { action_class:'create_initial_unrelated', target_schema_id:'tiber.hypothesis-core/hypothesis-version/v0', workspace_id:'ws:joe', operator_id:'op:joe', season_scope:'nfl:2026', target_payload_without_authority_ref:versionPayload } as const;
const intentDigest = digestCanonicalPreimage(canonicalizeForProfile(intent, { purpose:'component_fingerprint', component:'authorization_intent', schema:'tiber.hypothesis-core/authorization-intent/v0', projection:'unrelated_initial_version_intent_v0', payloadSchema:AuthorizationIntentV0Schema, arrayRules:[
  '/related_subjects','/cem_refs','/payoff_condition/unresolved_terms','/payoff_condition/predicates','/payoff_condition/expression/predicate_ids','/resolution_plan/missing_witnesses','/dependency_manifest/related_subject_refs','/dependency_manifest/witness_type_refs','/dependency_manifest/artifact_family_refs','/dependency_manifest/football_field_refs','/dependency_manifest/scenario_family_refs','/dependency_manifest/operator_context_field_refs','/dependency_manifest/boundary_refs','/dependency_manifest/freshness_governance',
].map(path=>({ path:`/payload/target_payload_without_authority_ref${path}`, semantics:'set' as const, key:'$element' as const })) }));
const receipt = { ...envelope, action_class:'create_initial_unrelated', decision:'authorized', intent_projection_id:'unrelated_initial_version_intent_v0', intent_digest:intentDigest, confirmation_mode:'explicit_operator_confirmation', single_use:true } as const;
const version = { ...envelope, schema_id:'tiber.hypothesis-core/hypothesis-version/v0', record_id:`tbr_hyv_${'f'.repeat(32)}`, record_digest:`sha256:${h64('f')}`, ...versionPayload, version_authority_receipt_ref:receiptRef } as const;

describe('authority and append-only history proposals', () => {
  it('returns a value-only append proposal and consumes no state', () => {
    const result = proposeAuthorizedAppend(baseHead, receipt, intent, [version]);
    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') expect(result.value).toMatchObject({ atomic:true, replay:false, consumes_authority_receipt_digest:receipt.record_digest });
    expect(baseHead.consumed_authority_receipt_digests).toEqual([]);
  });

  it('fails closed on workspace mismatch or prior receipt consumption', () => {
    expect(proposeAuthorizedAppend({ ...baseHead, workspace_id:'ws:other' }, receipt, intent, [version])).toMatchObject({ status:'refused', reason_code:'history_workspace_mismatch' });
    expect(proposeAuthorizedAppend({ ...baseHead, consumed_authority_receipt_digests:[receipt.record_digest] }, receipt, intent, [version])).toMatchObject({ status:'refused', reason_code:'authority_receipt_already_consumed' });
  });

  it('requires both members for R2 and R3 atomic units', () => {
    const successorIntent = { ...intent, action_class:'create_successor_version', target_schema_id:'tiber.hypothesis-core/successor-version-acceptance-unit/v0', target_payload_without_authority_ref:{ successor_version_payload_without_authority_ref:{}, version_supersession_event_payload_without_authority_and_successor_ref:{}, successor_member_binding:{ hypothesis_id:`tbr_hyp_${'c'.repeat(32)}`, version_ordinal:2, predecessor_version_ref:{ ref_kind:'operator_private_record', schema_id:'tiber.hypothesis-core/hypothesis-version/v0', record_id:`tbr_hyv_${'d'.repeat(32)}`, workspace_id:'ws:joe', record_digest:`sha256:${h64('e')}` } } } } as const;
    const digest = digestCanonicalPreimage(canonicalizeForProfile(successorIntent, { purpose:'component_fingerprint', component:'authorization_intent', schema:'tiber.hypothesis-core/authorization-intent/v0', projection:'successor_version_unit_intent_v0', payloadSchema:AuthorizationIntentV0Schema, arrayRules:[] }));
    const successorReceipt = { ...receipt, action_class:'create_successor_version', intent_projection_id:'successor_version_unit_intent_v0', intent_digest:digest };
    const active = { ...baseHead, hypothesis_id:`tbr_hyp_${'c'.repeat(32)}`, lifecycle_state:'active' as const };
    expect(proposeAuthorizedAppend(active, successorReceipt, successorIntent, [{}])).toMatchObject({ status:'refused', reason_code:'successor_version_atomic_append_incomplete' });
  });

  it('never admits a terminal aggregate append', () => {
    expect(proposeAuthorizedAppend({ ...baseHead, lifecycle_state:'resolved' }, receipt, intent, [version])).toMatchObject({ status:'refused', reason_code:'terminal_lifecycle_conflict' });
  });
});
