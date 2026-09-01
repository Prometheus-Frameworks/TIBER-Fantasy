import { createHash } from 'node:crypto';
import { proposeAuthorizedAppend, type AcceptanceHeadV0 } from '../conformance';
import { canonicalizeForProfile, canonicalizeProductionRecord, digestCanonicalPreimage, type ArrayRule } from '../canonicalization';
import { AuthorizationIntentV0Schema } from '../schemas';

const h64 = (c: string) => c.repeat(64);
const privateRef = (schema_id:string, record_id:string, record_digest=`sha256:${h64('9')}`) => ({ ref_kind:'operator_private_record' as const, schema_id, record_id, workspace_id:'ws:joe', record_digest });
const contractRef = { ref_kind:'governed_contract' as const, governance_namespace:'tiber', contract_schema_id:'contract/v0', contract_id:'policy', contract_version:'v0', digest_profile:'sha256', contract_digest:`sha256:${h64('d')}` };
const envelope = (schema_id:string, record_id:string) => ({ schema_id, record_id, workspace_id:'ws:joe', operator_id:'op:joe', season_scope:'nfl:2026', scope:'operator_local', visibility:'operator_private', clocks:{ recorded_at:'2026-09-01T00:00:00Z', observed_at:null, received_at:null }, actor:{ actor_type:'operator', actor_ref:'op:joe' }, record_authority:{ source_authority:'operator_supplied', derivation_type:'observed', basis_refs:[] }, provenance_refs:[], predecessor_refs:[], digest_profile:'tiber.hypothesis-core.digest/jcs-sha256-v0', record_digest:`sha256:${h64('0')}` });
const withDigest = <T extends Record<string, unknown>>(record:T):T => {
  const pre = { ...record, record_digest:`sha256:${h64('0')}` };
  return { ...pre, record_digest:digestCanonicalPreimage(canonicalizeProductionRecord(pre)) } as T;
};
const intentDigest = (intent:unknown, projection:string, arrayRules:ArrayRule[]=[]) => digestCanonicalPreimage(canonicalizeForProfile(intent, { purpose:'component_fingerprint', component:'authorization_intent', schema:'tiber.hypothesis-core/authorization-intent/v0', projection, payloadSchema:AuthorizationIntentV0Schema, arrayRules }));
const initialRules = ['/related_subjects','/cem_refs','/payoff_condition/unresolved_terms','/payoff_condition/predicates','/payoff_condition/expression/predicate_ids','/resolution_plan/missing_witnesses','/dependency_manifest/related_subject_refs','/dependency_manifest/witness_type_refs','/dependency_manifest/artifact_family_refs','/dependency_manifest/football_field_refs','/dependency_manifest/scenario_family_refs','/dependency_manifest/operator_context_field_refs','/dependency_manifest/boundary_refs','/dependency_manifest/freshness_governance'].map(path=>({ path:`/payload/target_payload_without_authority_ref${path}`, semantics:'set' as const, key:'$element' as const }));
const identityRef = privateRef('tiber.hypothesis-core/canonical-subject-receipt/v0',`tbr_hyid_${'c'.repeat(32)}`,`sha256:${h64('c')}`);
const versionPayload = { hypothesis_id:`tbr_hyp_${'e'.repeat(32)}`, version_ordinal:1, primary_subject:{ subject_type:'tiber_player', tiber_player_id:'tbr_p_01ARZ3NDEKTSV4RRFFQ69G5FAV', identity_receipt_ref:identityRef }, related_subjects:[], cem_refs:[], statement:'Synthetic unresolved proposition.', management_horizon:'horizon:v0', payoff_condition:{ predicate_status:'unresolved', unresolved_terms:['synthetic_term'], predicates:[], expression:{ mode:'policy_ref', predicate_ids:[], policy_ref:contractRef } }, resolution_plan:{ evidence_window:'unknown', next_decision_boundary_ref:null, occurs_after_expected_evidence:'unknown', relevance_horizon_ref:null, expires_before_resolution:'unknown', bounded:false, missing_witnesses:[] }, dependency_manifest:{ primary_subject_ref:'primary', related_subject_refs:[], witness_type_refs:[], artifact_family_refs:[], football_field_refs:[], scenario_family_refs:[], operator_context_field_refs:[], boundary_refs:[], freshness_governance:[] }, predecessor_version_ref:null, predecessor_hypothesis_ref:null };
const intent = { action_class:'create_initial_unrelated', target_schema_id:'tiber.hypothesis-core/hypothesis-version/v0', workspace_id:'ws:joe', operator_id:'op:joe', season_scope:'nfl:2026', target_payload_without_authority_ref:versionPayload };
const receipt = withDigest({ ...envelope('tiber.hypothesis-core/hypothesis-authority-receipt/v0',`tbr_hya_${'a'.repeat(32)}`), action_class:'create_initial_unrelated', decision:'authorized', intent_projection_id:'unrelated_initial_version_intent_v0', intent_digest:intentDigest(intent,'unrelated_initial_version_intent_v0',initialRules), confirmation_mode:'explicit_operator_confirmation', single_use:true });
const receiptRef = privateRef(receipt.schema_id,receipt.record_id,receipt.record_digest);
const version = withDigest({ ...envelope('tiber.hypothesis-core/hypothesis-version/v0',`tbr_hyv_${'f'.repeat(32)}`), ...versionPayload, version_authority_receipt_ref:receiptRef });
const versionRef = privateRef(version.schema_id,version.record_id,version.record_digest);
const baseHead: AcceptanceHeadV0 = { workspace_id:'ws:joe', operator_id:'op:joe', hypothesis_id:null, current_version_ref:null, lifecycle_state:'absent', latest_evaluation_ref:null, source_dependency_projection_digest:null, freshness_head_refs:[], consumed_authority_receipt_digests:[] };

describe('authority and append-only history proposals', () => {
  it('accepts one digest-verified value-only initial append proposal', () => {
    const result = proposeAuthorizedAppend(baseHead,receipt,intent,[version]);
    expect(result.status).toBe('accepted');
    if(result.status==='accepted') expect(result.value).toMatchObject({atomic:true,replay:false,consumes_authority_receipt_digest:receipt.record_digest});
    expect(baseHead.consumed_authority_receipt_digests).toEqual([]);
  });

  it('refuses forged receipt and candidate digests', () => {
    expect(proposeAuthorizedAppend(baseHead,{...receipt,record_digest:`sha256:${h64('1')}`},intent,[version])).toMatchObject({status:'refused',reason_code:'history_authority_invalid'});
    expect(proposeAuthorizedAppend(baseHead,receipt,intent,[{...version,record_digest:`sha256:${h64('1')}`}])).toMatchObject({status:'refused',reason_code:'record_digest_mismatch'});
  });

  it('identifies replay from canonical ordered record identities', () => {
    const unitDigest=`sha256:${createHash('sha256').update(JSON.stringify([[version.schema_id,version.workspace_id,version.record_id,version.record_digest]])).digest('hex')}`;
    const reordered=Object.fromEntries(Object.entries(version).reverse());
    expect(proposeAuthorizedAppend({...baseHead,accepted_unit_digests:[unitDigest],consumed_authority_receipt_digests:[receipt.record_digest]},receipt,intent,[reordered])).toMatchObject({status:'no_op',reason_code:'idempotent_replay'});
  });

  it('binds park to current version, active lifecycle, receipt, and intent', () => {
    const parkPayload={hypothesis_id:version.hypothesis_id,hypothesis_version_ref:versionRef,event_type:'parked',from_state:'active',to_state:'parked',effective_at:'2026-09-01T00:01:00Z',reason_codes:['operator_pause']};
    const parkIntent={action_class:'park',target_schema_id:'tiber.hypothesis-core/hypothesis-lifecycle-event/v0',workspace_id:'ws:joe',operator_id:'op:joe',season_scope:'nfl:2026',target_payload_without_authority_ref:parkPayload};
    const parkReceipt=withDigest({...envelope('tiber.hypothesis-core/hypothesis-authority-receipt/v0',`tbr_hya_${'1'.repeat(32)}`),action_class:'park',decision:'authorized',intent_projection_id:'park_intent_v0',intent_digest:intentDigest(parkIntent,'park_intent_v0',[{path:'/payload/target_payload_without_authority_ref/reason_codes',semantics:'set',key:'$scalar'}]),confirmation_mode:'explicit_operator_confirmation',single_use:true});
    const parkRef=privateRef(parkReceipt.schema_id,parkReceipt.record_id,parkReceipt.record_digest);
    const event=withDigest({...envelope('tiber.hypothesis-core/hypothesis-lifecycle-event/v0',`tbr_hyl_${'2'.repeat(32)}`),...parkPayload,authority_receipt_ref:parkRef});
    const active={...baseHead,hypothesis_id:version.hypothesis_id,current_version_ref:versionRef,lifecycle_state:'active' as const};
    expect(proposeAuthorizedAppend(active,parkReceipt,parkIntent,[event]).status).toBe('accepted');
    expect(proposeAuthorizedAppend({...active,lifecycle_state:'parked'},parkReceipt,parkIntent,[event])).toMatchObject({status:'refused',reason_code:'lifecycle_authority_mismatch'});
    expect(proposeAuthorizedAppend(active,parkReceipt,parkIntent,[version])).toMatchObject({status:'refused',reason_code:'lifecycle_authority_mismatch'});
  });

  it('binds correction disposition, target existence, authority, and intent', () => {
    const replacement=withDigest({...version,record_id:`tbr_hyv_${'3'.repeat(32)}`,record_digest:`sha256:${h64('0')}`});
    const correctionPayload={target_record_ref:versionRef,disposition:'corrected',replacement_record_ref:privateRef(replacement.schema_id,replacement.record_id,replacement.record_digest),effective_at:'2026-09-01T00:02:00Z',reason_codes:['record_defect'],basis_refs:[],affected_input_component:'hypothesis_definition'};
    const correctionIntent={action_class:'correct_record',target_schema_id:'tiber.hypothesis-core/record-correction-event/v0',workspace_id:'ws:joe',operator_id:'op:joe',season_scope:'nfl:2026',target_payload_without_authority_ref:correctionPayload};
    const rules:ArrayRule[]=[{path:'/payload/target_payload_without_authority_ref/reason_codes',semantics:'set',key:'$scalar'},{path:'/payload/target_payload_without_authority_ref/basis_refs',semantics:'set',key:'$private_ref'}];
    const correctionReceipt=withDigest({...envelope('tiber.hypothesis-core/hypothesis-authority-receipt/v0',`tbr_hya_${'4'.repeat(32)}`),action_class:'correct_record',decision:'authorized',intent_projection_id:'correction_intent_v0',intent_digest:intentDigest(correctionIntent,'correction_intent_v0',rules),confirmation_mode:'explicit_operator_confirmation',single_use:true});
    const correctionRef=privateRef(correctionReceipt.schema_id,correctionReceipt.record_id,correctionReceipt.record_digest);
    const correction=withDigest({...envelope('tiber.hypothesis-core/record-correction-event/v0',`tbr_hyc_${'5'.repeat(32)}`),...correctionPayload,authority_receipt_ref:correctionRef});
    const head={...baseHead,lifecycle_state:'active' as const,existing_records:[version,replacement]};
    expect(proposeAuthorizedAppend(head,correctionReceipt,correctionIntent,[correction]).status).toBe('accepted');
    expect(proposeAuthorizedAppend({...head,existing_records:[replacement]},correctionReceipt,correctionIntent,[correction])).toMatchObject({status:'refused',reason_code:'correction_schema_or_identity_mismatch'});
  });

  it('requires both members for R2 and R3 atomic units', () => {
    const successorIntent={...intent,action_class:'create_successor_version',target_schema_id:'tiber.hypothesis-core/successor-version-acceptance-unit/v0',target_payload_without_authority_ref:{successor_version_payload_without_authority_ref:{},version_supersession_event_payload_without_authority_and_successor_ref:{},successor_member_binding:{hypothesis_id:version.hypothesis_id,version_ordinal:2,predecessor_version_ref:versionRef}}};
    const successorReceipt=withDigest({...receipt,record_id:`tbr_hya_${'6'.repeat(32)}`,record_digest:`sha256:${h64('0')}`,action_class:'create_successor_version',intent_projection_id:'successor_version_unit_intent_v0',intent_digest:intentDigest(successorIntent,'successor_version_unit_intent_v0')});
    const active={...baseHead,hypothesis_id:version.hypothesis_id,current_version_ref:versionRef,lifecycle_state:'active' as const};
    expect(proposeAuthorizedAppend(active,successorReceipt,successorIntent,[version])).toMatchObject({status:'refused',reason_code:'successor_version_atomic_append_incomplete'});
  });
});
