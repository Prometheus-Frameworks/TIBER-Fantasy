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
const versionRuleSpecs: Array<[string, ArrayRule['key']]> = [
  ['/related_subjects','$field:relation_id'],['/cem_refs','$private_ref'],['/payoff_condition/unresolved_terms','$scalar'],['/payoff_condition/predicates','$field:predicate_id'],
  ['/payoff_condition/predicates/*/applicability_predicate_ids','$scalar'],['/payoff_condition/expression/predicate_ids','$scalar'],['/resolution_plan/missing_witnesses','$field:witness_id'],
  ['/resolution_plan/missing_witnesses/*/predicate_ids','$scalar'],['/resolution_plan/missing_witnesses/*/subject_refs','$scalar'],['/resolution_plan/missing_witnesses/*/admissible_evidence_contract_refs','$contract_ref'],
  ['/dependency_manifest/related_subject_refs','$scalar'],['/dependency_manifest/witness_type_refs','$contract_ref'],['/dependency_manifest/artifact_family_refs','$contract_ref'],['/dependency_manifest/football_field_refs','$contract_ref'],
  ['/dependency_manifest/scenario_family_refs','$contract_ref'],['/dependency_manifest/operator_context_field_refs','$contract_ref'],['/dependency_manifest/boundary_refs','$contract_ref'],['/dependency_manifest/freshness_governance','$field:dependency_key'],
];
const versionIntentRules = (root:string):ArrayRule[] => versionRuleSpecs.map(([path,key])=>({ path:`${root}${path}`, semantics:'set', key }));
const initialRules = versionIntentRules('/payload/target_payload_without_authority_ref');
const identityRef = privateRef('tiber.hypothesis-core/canonical-subject-receipt/v0',`tbr_hyid_${'c'.repeat(32)}`,`sha256:${h64('c')}`);
const versionPayload = { hypothesis_id:`tbr_hyp_${'e'.repeat(32)}`, version_ordinal:1, primary_subject:{ subject_type:'tiber_player', tiber_player_id:'tbr_p_01ARZ3NDEKTSV4RRFFQ69G5FAV', identity_receipt_ref:identityRef }, related_subjects:[], cem_refs:[], statement:'Synthetic unresolved proposition.', management_horizon:'horizon:v0', payoff_condition:{ predicate_status:'unresolved', unresolved_terms:['synthetic_term'], predicates:[], expression:{ mode:'policy_ref', predicate_ids:[], policy_ref:contractRef } }, resolution_plan:{ evidence_window:'unknown', next_decision_boundary_ref:null, occurs_after_expected_evidence:'unknown', relevance_horizon_ref:null, expires_before_resolution:'unknown', bounded:false, missing_witnesses:[] }, dependency_manifest:{ primary_subject_ref:'primary', related_subject_refs:[], witness_type_refs:[], artifact_family_refs:[], football_field_refs:[], scenario_family_refs:[], operator_context_field_refs:[], boundary_refs:[], freshness_governance:[] }, predecessor_version_ref:null, predecessor_hypothesis_ref:null };
const intent = { action_class:'create_initial_unrelated', target_schema_id:'tiber.hypothesis-core/hypothesis-version/v0', workspace_id:'ws:joe', operator_id:'op:joe', season_scope:'nfl:2026', target_payload_without_authority_ref:versionPayload };
const receipt = withDigest({ ...envelope('tiber.hypothesis-core/hypothesis-authority-receipt/v0',`tbr_hya_${'a'.repeat(32)}`), action_class:'create_initial_unrelated', decision:'authorized', intent_projection_id:'unrelated_initial_version_intent_v0', intent_digest:intentDigest(intent,'unrelated_initial_version_intent_v0',initialRules), confirmation_mode:'explicit_operator_confirmation', single_use:true });
const receiptRef = privateRef(receipt.schema_id,receipt.record_id,receipt.record_digest);
const version = withDigest({ ...envelope('tiber.hypothesis-core/hypothesis-version/v0',`tbr_hyv_${'f'.repeat(32)}`), ...versionPayload, version_authority_receipt_ref:receiptRef });
const versionRef = privateRef(version.schema_id,version.record_id,version.record_digest);
const baseHead: AcceptanceHeadV0 = { workspace_id:'ws:joe', operator_id:'op:joe', hypothesis_id:null, current_version_ref:null, lifecycle_state:'absent', latest_evaluation_ref:null, source_dependency_projection_digest:null, freshness_head_refs:[], consumed_authority_receipt_digests:[] };
const activeHead: AcceptanceHeadV0 = { ...baseHead, hypothesis_id:version.hypothesis_id, current_version_ref:versionRef, lifecycle_state:'active', existing_records:[version] };

const makeInitialUnit = ({receiptSeason='nfl:2026',intentSeason='nfl:2026',candidateSeason='nfl:2026'}: {receiptSeason?:string;intentSeason?:string;candidateSeason?:string}={}) => {
  const unitIntent={...intent,season_scope:intentSeason};
  const unitReceipt=withDigest({...receipt,season_scope:receiptSeason,intent_digest:intentDigest(unitIntent,'unrelated_initial_version_intent_v0',initialRules)});
  const unitReceiptRef=privateRef(unitReceipt.schema_id,unitReceipt.record_id,unitReceipt.record_digest);
  const unitVersion=withDigest({...version,season_scope:candidateSeason,version_authority_receipt_ref:unitReceiptRef});
  return {intent:unitIntent,receipt:unitReceipt,records:[unitVersion] as const};
};

const makeVersionSuccessorUnit = ({candidateHypothesisId=version.hypothesis_id,candidateOrdinal=2,binding={},successorRef={}}: {candidateHypothesisId?:string;candidateOrdinal?:number;binding?:Record<string,unknown>;successorRef?:Record<string,unknown>}={}) => {
  const successorVersionPayload={...versionPayload,hypothesis_id:candidateHypothesisId,version_ordinal:candidateOrdinal,predecessor_version_ref:versionRef,predecessor_hypothesis_ref:null};
  const eventIntentPayload={predecessor_ref:versionRef,effective_at:'2026-09-01T00:03:00Z',reason_code:'resolution_plan_revised'};
  const successorBinding={hypothesis_id:version.hypothesis_id,version_ordinal:2,predecessor_version_ref:versionRef,...binding};
  const unitIntent={...intent,action_class:'create_successor_version',target_schema_id:'tiber.hypothesis-core/successor-version-acceptance-unit/v0',target_payload_without_authority_ref:{successor_version_payload_without_authority_ref:successorVersionPayload,version_supersession_event_payload_without_authority_and_successor_ref:eventIntentPayload,successor_member_binding:successorBinding}};
  const unitReceipt=withDigest({...receipt,record_id:`tbr_hya_${'6'.repeat(32)}`,action_class:'create_successor_version',intent_projection_id:'successor_version_unit_intent_v0',intent_digest:intentDigest(unitIntent,'successor_version_unit_intent_v0',versionIntentRules('/payload/target_payload_without_authority_ref/successor_version_payload_without_authority_ref'))});
  const unitReceiptRef=privateRef(unitReceipt.schema_id,unitReceipt.record_id,unitReceipt.record_digest);
  const successorVersion=withDigest({...envelope('tiber.hypothesis-core/hypothesis-version/v0',`tbr_hyv_${'7'.repeat(32)}`),...successorVersionPayload,version_authority_receipt_ref:unitReceiptRef});
  const successorVersionRef=privateRef(successorVersion.schema_id,successorVersion.record_id,successorVersion.record_digest);
  const event=withDigest({...envelope('tiber.hypothesis-core/hypothesis-supersession-event/v0',`tbr_hys_${'8'.repeat(32)}`),scope:'version',...eventIntentPayload,successor_ref:{...successorVersionRef,...successorRef},authority_receipt_ref:unitReceiptRef});
  return {intent:unitIntent,receipt:unitReceipt,records:[successorVersion,event] as const};
};

const makeHypothesisSuccessorUnit = ({candidateHypothesisId=`tbr_hyp_${'1'.repeat(32)}`,candidateOrdinal=1,binding={},successorRef={}}: {candidateHypothesisId?:string;candidateOrdinal?:number;binding?:Record<string,unknown>;successorRef?:Record<string,unknown>}={}) => {
  const successorVersionPayload={...versionPayload,hypothesis_id:candidateHypothesisId,version_ordinal:candidateOrdinal,statement:'Materially changed synthetic proposition.',predecessor_version_ref:null,predecessor_hypothesis_ref:versionRef};
  const eventIntentPayload={predecessor_ref:versionRef,effective_at:'2026-09-01T00:04:00Z',reason_code:'proposition_changed'};
  const successorBinding={predecessor_hypothesis_id:version.hypothesis_id,predecessor_version_ref:versionRef,successor_hypothesis_id:candidateHypothesisId,successor_version_ordinal:1,...binding};
  const unitIntent={...intent,action_class:'create_initial_hypothesis_successor',target_schema_id:'tiber.hypothesis-core/hypothesis-successor-acceptance-unit/v0',target_payload_without_authority_ref:{successor_hypothesis_initial_version_payload_without_authority_ref:successorVersionPayload,hypothesis_supersession_event_payload_without_authority_and_successor_ref:eventIntentPayload,successor_member_binding:successorBinding}};
  const unitReceipt=withDigest({...receipt,record_id:`tbr_hya_${'9'.repeat(32)}`,action_class:'create_initial_hypothesis_successor',intent_projection_id:'hypothesis_successor_unit_intent_v0',intent_digest:intentDigest(unitIntent,'hypothesis_successor_unit_intent_v0',versionIntentRules('/payload/target_payload_without_authority_ref/successor_hypothesis_initial_version_payload_without_authority_ref'))});
  const unitReceiptRef=privateRef(unitReceipt.schema_id,unitReceipt.record_id,unitReceipt.record_digest);
  const successorVersion=withDigest({...envelope('tiber.hypothesis-core/hypothesis-version/v0',`tbr_hyv_${'1'.repeat(32)}`),...successorVersionPayload,version_authority_receipt_ref:unitReceiptRef});
  const successorVersionRef=privateRef(successorVersion.schema_id,successorVersion.record_id,successorVersion.record_digest);
  const event=withDigest({...envelope('tiber.hypothesis-core/hypothesis-supersession-event/v0',`tbr_hys_${'2'.repeat(32)}`),scope:'hypothesis',...eventIntentPayload,successor_ref:{...successorVersionRef,...successorRef},authority_receipt_ref:unitReceiptRef});
  return {intent:unitIntent,receipt:unitReceipt,records:[successorVersion,event] as const};
};

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

  it('binds receipt, intent, and every candidate to one season', () => {
    for (const unit of [makeInitialUnit({receiptSeason:'nfl:2027'}),makeInitialUnit({intentSeason:'nfl:2027'}),makeInitialUnit({candidateSeason:'nfl:2027'})]) {
      expect(proposeAuthorizedAppend(baseHead,unit.receipt,unit.intent,unit.records)).toMatchObject({status:'refused',reason_code:'history_season_mismatch'});
    }
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
    expect(proposeAuthorizedAppend(activeHead,successorReceipt,successorIntent,[version])).toMatchObject({status:'refused',reason_code:'successor_version_atomic_append_incomplete'});
    const hypothesisSuccessor=makeHypothesisSuccessorUnit();
    expect(proposeAuthorizedAppend(activeHead,hypothesisSuccessor.receipt,hypothesisSuccessor.intent,[hypothesisSuccessor.records[0]])).toMatchObject({status:'refused',reason_code:'hypothesis_successor_atomic_append_incomplete'});
  });

  it('accepts complete authority-bound R2 and R3 proposals as values only', () => {
    const r2=makeVersionSuccessorUnit();
    const r3=makeHypothesisSuccessorUnit();
    expect(proposeAuthorizedAppend(activeHead,r2.receipt,r2.intent,r2.records)).toMatchObject({status:'accepted',value:{atomic:true,replay:false}});
    expect(proposeAuthorizedAppend(activeHead,r3.receipt,r3.intent,r3.records)).toMatchObject({status:'accepted',value:{atomic:true,replay:false}});
    expect(activeHead.consumed_authority_receipt_digests).toEqual([]);
  });

  it('requires the complete successor reference in both atomic-unit actions', () => {
    const r2=makeVersionSuccessorUnit({successorRef:{schema_id:'tiber.hypothesis-core/fabricated/v0',record_id:'fabricated'}});
    const r3=makeHypothesisSuccessorUnit({successorRef:{schema_id:'tiber.hypothesis-core/fabricated/v0',record_id:'fabricated'}});
    expect(proposeAuthorizedAppend(activeHead,r2.receipt,r2.intent,r2.records)).toMatchObject({status:'refused',reason_code:'successor_version_authority_mismatch'});
    expect(proposeAuthorizedAppend(activeHead,r3.receipt,r3.intent,r3.records)).toMatchObject({status:'refused',reason_code:'hypothesis_successor_authority_mismatch'});
  });

  it('enforces same-aggregate successor identity, ordinal continuity, and every R2 member binding', () => {
    const differentHypothesis=makeVersionSuccessorUnit({candidateHypothesisId:`tbr_hyp_${'2'.repeat(32)}`,binding:{hypothesis_id:`tbr_hyp_${'2'.repeat(32)}`}});
    const skippedOrdinal=makeVersionSuccessorUnit({candidateOrdinal:9,binding:{version_ordinal:9}});
    const wrongBoundHypothesis=makeVersionSuccessorUnit({binding:{hypothesis_id:`tbr_hyp_${'2'.repeat(32)}`}});
    const wrongBoundOrdinal=makeVersionSuccessorUnit({binding:{version_ordinal:3}});
    const wrongBoundPredecessor=makeVersionSuccessorUnit({binding:{predecessor_version_ref:{...versionRef,record_id:'fabricated'}}});
    for (const unit of [differentHypothesis,skippedOrdinal,wrongBoundHypothesis,wrongBoundOrdinal,wrongBoundPredecessor]) {
      expect(proposeAuthorizedAppend(activeHead,unit.receipt,unit.intent,unit.records)).toMatchObject({status:'refused',reason_code:'successor_version_authority_mismatch'});
    }
  });

  it('enforces distinct successor identity and every R3 member binding', () => {
    const sameHypothesis=makeHypothesisSuccessorUnit({candidateHypothesisId:version.hypothesis_id});
    const wrongOrdinal=makeHypothesisSuccessorUnit({candidateOrdinal:2});
    const wrongPredecessorId=makeHypothesisSuccessorUnit({binding:{predecessor_hypothesis_id:`tbr_hyp_${'2'.repeat(32)}`}});
    const wrongPredecessorRef=makeHypothesisSuccessorUnit({binding:{predecessor_version_ref:{...versionRef,record_id:'fabricated'}}});
    const wrongSuccessorId=makeHypothesisSuccessorUnit({binding:{successor_hypothesis_id:`tbr_hyp_${'2'.repeat(32)}`}});
    for (const unit of [sameHypothesis,wrongOrdinal,wrongPredecessorId,wrongPredecessorRef,wrongSuccessorId]) {
      expect(proposeAuthorizedAppend(activeHead,unit.receipt,unit.intent,unit.records)).toMatchObject({status:'refused',reason_code:'hypothesis_successor_authority_mismatch'});
    }
  });

  it('requires the current R3 predecessor to exist, verify, and match the head', () => {
    const unit=makeHypothesisSuccessorUnit();
    expect(proposeAuthorizedAppend({...activeHead,existing_records:[]},unit.receipt,unit.intent,unit.records)).toMatchObject({status:'refused',reason_code:'hypothesis_successor_authority_mismatch'});
    expect(proposeAuthorizedAppend({...activeHead,existing_records:[{...version,statement:'Forged predecessor content.'}]},unit.receipt,unit.intent,unit.records)).toMatchObject({status:'refused',reason_code:'hypothesis_successor_authority_mismatch'});

    const differentHeadHypothesis=`tbr_hyp_${'2'.repeat(32)}`;
    const mismatchedUnit=makeHypothesisSuccessorUnit({binding:{predecessor_hypothesis_id:differentHeadHypothesis}});
    expect(proposeAuthorizedAppend({...activeHead,hypothesis_id:differentHeadHypothesis},mismatchedUnit.receipt,mismatchedUnit.intent,mismatchedUnit.records)).toMatchObject({status:'refused',reason_code:'hypothesis_successor_authority_mismatch'});
  });
});
