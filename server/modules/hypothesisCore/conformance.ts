import { createHash } from 'node:crypto';
import {
  ACTION_CLASSES, AuthorizationIntentV0Schema, HypothesisAuthorityReceiptV0Schema,
  HypothesisSupersessionEventV0Schema, HypothesisVersionV0Schema, PaperFixtureV1Schema, PaperRefusalV0Schema, ProductionRecordV0Schema,
  type PrivateRecordRefV0,
} from './schemas';
import { canonicalizeForProfile, canonicalizeProductionRecord, digestCanonicalPreimage, type ArrayRule } from './canonicalization';

export type Accepted<T> = { status: 'accepted'; value: T };
export type NoOp<T = undefined> = { status: 'no_op'; reason_code: string; value?: T };
export type Refused = { status: 'refused'; reason_code: string; details?: readonly string[] };
export type ConformanceResult<T> = Accepted<T> | NoOp<T> | Refused;
const refused = (reason_code: string, details?: readonly string[]): Refused => ({ status: 'refused', reason_code, ...(details ? { details } : {}) });

export function validateProductionRecord(input: unknown): ConformanceResult<unknown> {
  if (PaperFixtureV1Schema.safeParse(input).success || PaperRefusalV0Schema.safeParse(input).success || (input as { schema?: string })?.schema?.includes('/paper-fixture/')) {
    return refused('refused_non_governed_fixture');
  }
  const parsed = ProductionRecordV0Schema.safeParse(input);
  if (!parsed.success) return refused('record_schema_invalid', parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`));
  try {
    const digest = digestCanonicalPreimage(canonicalizeProductionRecord(parsed.data));
    if (digest !== parsed.data.record_digest) return refused('record_digest_mismatch');
  } catch (error) { return refused(error instanceof Error ? error.message : 'canonical_input_schema_invalid'); }
  return { status: 'accepted', value: parsed.data };
}

export interface PaperEvaluation {
  fixture_id: string; primary_subject: string; trigger_class: 'football_evidence_changed';
  evaluation_delta: 'strengthened'; proposition_resolution: 'unresolved'; evidence_completeness: 'incomplete';
  remaining_missing_witnesses: string[]; dimensions: { probability: 'unavailable'; upside: 'unavailable'; roster_fit: 'not_evaluated'; holding_cost: 'not_evaluated' };
  production_admission: { result: 'refused_non_governed_fixture'; durable_records_emitted: 0; active_hypothesis_created: false };
}

export function evaluatePaperFixture(prior: unknown, syntheticAppend?: unknown): ConformanceResult<PaperEvaluation> {
  const candidate = syntheticAppend ?? prior;
  const parsed = PaperFixtureV1Schema.safeParse(typeof candidate === 'string' ? safeJson(candidate) : candidate);
  if (!parsed.success) return refused('paper_fixture_schema_invalid', parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`));
  const fixture = parsed.data;
  if (typeof prior === 'string' && typeof syntheticAppend === 'string' && prior === syntheticAppend) return { status: 'no_op', reason_code: 'paper_fixture_replay', value: derivePaper(fixture) };
  const f0 = fixture.payload.paper_f0.witness_states;
  const observations = fixture.payload.paper_f1.synthetic_observations;
  const declared = new Set(f0.map(w => w.witness_id));
  const seen = new Set<string>();
  for (const observation of observations) {
    if (!declared.has(observation.witness_id) || seen.has(observation.witness_id)) return refused('paper_witness_domain_mismatch');
    seen.add(observation.witness_id);
    if (observation.effect_map.observed_present !== 'strengthens') return refused('paper_effect_map_invalid');
  }
  const remaining = f0.filter(w => !seen.has(w.witness_id)).map(w => w.witness_id);
  if (JSON.stringify(remaining) !== JSON.stringify(fixture.payload.paper_expected.f1.remaining_missing_witnesses)) return refused('paper_remaining_witness_order_mismatch');
  return { status: 'accepted', value: derivePaper(fixture) };
}

function derivePaper(fixture: ReturnType<typeof PaperFixtureV1Schema.parse>): PaperEvaluation {
  return {
    fixture_id: fixture.payload.fixture_id, primary_subject: fixture.payload.primary_subject,
    trigger_class: 'football_evidence_changed', evaluation_delta: 'strengthened',
    proposition_resolution: 'unresolved', evidence_completeness: 'incomplete',
    remaining_missing_witnesses: [...fixture.payload.paper_expected.f1.remaining_missing_witnesses],
    dimensions: { probability:'unavailable', upside:'unavailable', roster_fit:'not_evaluated', holding_cost:'not_evaluated' },
    production_admission: { result: 'refused_non_governed_fixture', durable_records_emitted: 0, active_hypothesis_created: false },
  };
}
function safeJson(input: string): unknown { try { return JSON.parse(input); } catch { return undefined; } }

export interface WakeFingerprints { hypothesis_definition: string; football_evidence: string; operator_context: string; evaluation_method: string; }
export interface TriggerEvaluationInput {
  prior_evaluation_ref: PrivateRecordRefV0 | null; old_input_fingerprints: WakeFingerprints | null;
  new_input_fingerprints: WakeFingerprints; prior_dependency_projected_input_digest: string | null;
  dependency_projected_input_digest: string; changed_dependency_keys: readonly string[];
}
export function evaluateTrigger(priorEvaluation: TriggerEvaluationInput, projectedInputs?: Partial<TriggerEvaluationInput>): ConformanceResult<{ decision: 'append_evaluation'; changed_components: string[] }> {
  const input = { ...priorEvaluation, ...projectedInputs } as TriggerEvaluationInput;
  const components = ['hypothesis_definition','football_evidence','operator_context','evaluation_method'] as const;
  const changed = input.old_input_fingerprints === null ? [...components] : components.filter(k => input.old_input_fingerprints?.[k] !== input.new_input_fingerprints[k]);
  if (!changed.length && input.prior_dependency_projected_input_digest === input.dependency_projected_input_digest) return { status: 'no_op', reason_code: 'trigger_projection_unchanged' };
  if (!input.changed_dependency_keys.length && changed.some(c => c !== 'evaluation_method' && c !== 'hypothesis_definition')) return refused('trigger_projection_inconsistent');
  return { status: 'accepted', value: { decision: 'append_evaluation', changed_components: changed } };
}

export interface AcceptanceHeadV0 {
  workspace_id: string; operator_id: string; hypothesis_id: string | null; current_version_ref: PrivateRecordRefV0 | null;
  lifecycle_state: 'absent' | 'active' | 'parked' | 'resolved' | 'superseded'; latest_evaluation_ref: PrivateRecordRefV0 | null;
  source_dependency_projection_digest: string | null; freshness_head_refs: readonly PrivateRecordRefV0[];
  consumed_authority_receipt_digests: readonly string[]; accepted_unit_digests?: readonly string[];
}
export interface AppendProposal { ordered_records: readonly unknown[]; consumes_authority_receipt_digest: string; atomic: true; replay: false; }

export function proposeAuthorizedAppend(currentHead: AcceptanceHeadV0, receiptInput: unknown, intentInput: unknown, candidateRecords: readonly unknown[]): ConformanceResult<AppendProposal> {
  const receipt = HypothesisAuthorityReceiptV0Schema.safeParse(receiptInput);
  if (!receipt.success) return refused('history_authority_invalid');
  const intent = AuthorizationIntentV0Schema.safeParse(intentInput);
  if (!intent.success) return refused('history_authority_invalid');
  if (receipt.data.workspace_id !== currentHead.workspace_id || receipt.data.operator_id !== currentHead.operator_id || intent.data.workspace_id !== currentHead.workspace_id || intent.data.operator_id !== currentHead.operator_id) return refused('history_workspace_mismatch');
  if (receipt.data.action_class !== intent.data.action_class) return refused('history_authority_invalid');
  if (!ACTION_CLASSES.includes(receipt.data.action_class)) return refused('history_authority_invalid');
  const projection = intentProjection(intent.data.action_class);
  if (receipt.data.intent_projection_id !== projection) return refused('history_authority_invalid');
  const expectedTargetSchema = intent.data.action_class === 'create_successor_version' ? 'tiber.hypothesis-core/successor-version-acceptance-unit/v0'
    : intent.data.action_class === 'create_initial_hypothesis_successor' ? 'tiber.hypothesis-core/hypothesis-successor-acceptance-unit/v0'
    : intent.data.action_class === 'create_initial_unrelated' ? 'tiber.hypothesis-core/hypothesis-version/v0'
    : intent.data.action_class === 'park' ? 'tiber.hypothesis-core/hypothesis-lifecycle-event/v0'
    : 'tiber.hypothesis-core/record-correction-event/v0';
  if (intent.data.target_schema_id !== expectedTargetSchema) return refused('history_authority_invalid');
  let calculatedIntentDigest: string;
  try {
    calculatedIntentDigest = digestCanonicalPreimage(canonicalizeForProfile(intent.data, {
      purpose:'component_fingerprint', component:'authorization_intent', schema:'tiber.hypothesis-core/authorization-intent/v0',
      projection, payloadSchema:AuthorizationIntentV0Schema, arrayRules:intentArrayRules(intent.data.action_class),
    }));
  } catch { return refused('history_authority_invalid'); }
  if (receipt.data.intent_digest !== calculatedIntentDigest) return refused('history_authority_invalid');
  const unitDigest = `sha256:${createHash('sha256').update(JSON.stringify(candidateRecords)).digest('hex')}`;
  if (currentHead.accepted_unit_digests?.includes(unitDigest)) return { status: 'no_op', reason_code: 'idempotent_replay' };
  if (currentHead.consumed_authority_receipt_digests.includes(receipt.data.record_digest)) return refused('authority_receipt_already_consumed');
  if (currentHead.lifecycle_state === 'resolved' || currentHead.lifecycle_state === 'superseded') return refused('terminal_lifecycle_conflict');

  const expectedCount = receipt.data.action_class === 'create_successor_version' || receipt.data.action_class === 'create_initial_hypothesis_successor' ? 2 : 1;
  if (candidateRecords.length !== expectedCount) return refused(receipt.data.action_class === 'create_successor_version' ? 'successor_version_atomic_append_incomplete' : receipt.data.action_class === 'create_initial_hypothesis_successor' ? 'hypothesis_successor_atomic_append_incomplete' : 'history_atomic_append_incomplete');
  const parsedCandidates = candidateRecords.map(candidate => ProductionRecordV0Schema.safeParse(candidate));
  if (parsedCandidates.some(candidate => !candidate.success)) return refused('record_schema_invalid');
  if (parsedCandidates.some(candidate => candidate.success && (candidate.data.workspace_id !== currentHead.workspace_id || candidate.data.operator_id !== currentHead.operator_id))) return refused('history_workspace_mismatch');
  const receiptRef = { ref_kind:'operator_private_record', schema_id:receipt.data.schema_id, record_id:receipt.data.record_id, workspace_id:receipt.data.workspace_id, record_digest:receipt.data.record_digest } as const;
  const sameRef = (a: PrivateRecordRefV0 | null, b: PrivateRecordRefV0 | null) => JSON.stringify(a) === JSON.stringify(b);
  if (receipt.data.action_class === 'create_initial_unrelated' && currentHead.lifecycle_state !== 'absent') return refused('initial_version_authority_mismatch');
  if (receipt.data.action_class === 'create_initial_unrelated') {
    const version = HypothesisVersionV0Schema.safeParse(candidateRecords[0]);
    const target = intent.data.target_payload_without_authority_ref;
    if (!version.success || version.data.version_ordinal !== 1 || version.data.predecessor_version_ref !== null || version.data.predecessor_hypothesis_ref !== null || !sameRef(version.data.version_authority_receipt_ref, receiptRef) || stableJson(versionPayloadWithoutAuthority(version.data)) !== stableJson(target)) return refused('initial_version_authority_mismatch');
  }
  if (receipt.data.action_class === 'create_successor_version' && !['active','parked'].includes(currentHead.lifecycle_state)) return refused('successor_version_head_conflict');
  if (receipt.data.action_class === 'create_successor_version') {
    const version = HypothesisVersionV0Schema.safeParse(candidateRecords[0]);
    const event = HypothesisSupersessionEventV0Schema.safeParse(candidateRecords[1]);
    const target = intent.data.target_payload_without_authority_ref as Record<string, unknown>;
    if (!version.success || !event.success || event.data.scope !== 'version' || version.data.predecessor_hypothesis_ref !== null || !sameRef(version.data.predecessor_version_ref, currentHead.current_version_ref) || !sameRef(event.data.predecessor_ref, currentHead.current_version_ref) || !sameRef(version.data.version_authority_receipt_ref, receiptRef) || !sameRef(event.data.authority_receipt_ref, receiptRef) || event.data.successor_ref.record_digest !== version.data.record_digest || stableJson(versionPayloadWithoutAuthority(version.data)) !== stableJson(target.successor_version_payload_without_authority_ref) || stableJson(eventPayloadWithoutDerivedRefs(event.data)) !== stableJson(target.version_supersession_event_payload_without_authority_and_successor_ref)) return refused('successor_version_authority_mismatch');
  }
  if (receipt.data.action_class === 'create_initial_hypothesis_successor' && !['active','parked'].includes(currentHead.lifecycle_state)) return refused('hypothesis_successor_head_conflict');
  if (receipt.data.action_class === 'create_initial_hypothesis_successor') {
    const version = HypothesisVersionV0Schema.safeParse(candidateRecords[0]);
    const event = HypothesisSupersessionEventV0Schema.safeParse(candidateRecords[1]);
    const target = intent.data.target_payload_without_authority_ref as Record<string, unknown>;
    if (!version.success || !event.success || event.data.scope !== 'hypothesis' || version.data.version_ordinal !== 1 || version.data.predecessor_version_ref !== null || !sameRef(version.data.predecessor_hypothesis_ref, currentHead.current_version_ref) || !sameRef(event.data.predecessor_ref, currentHead.current_version_ref) || !sameRef(version.data.version_authority_receipt_ref, receiptRef) || !sameRef(event.data.authority_receipt_ref, receiptRef) || event.data.successor_ref.record_digest !== version.data.record_digest || stableJson(versionPayloadWithoutAuthority(version.data)) !== stableJson(target.successor_hypothesis_initial_version_payload_without_authority_ref) || stableJson(eventPayloadWithoutDerivedRefs(event.data)) !== stableJson(target.hypothesis_supersession_event_payload_without_authority_and_successor_ref)) return refused('hypothesis_successor_authority_mismatch');
  }
  return { status: 'accepted', value: { ordered_records: [...candidateRecords], consumes_authority_receipt_digest: receipt.data.record_digest, atomic: true, replay: false } };
}

const RECORD_ENVELOPE_KEYS = new Set(['schema_id','record_id','workspace_id','operator_id','season_scope','scope','visibility','clocks','actor','record_authority','provenance_refs','predecessor_refs','digest_profile','record_digest']);
function versionPayloadWithoutAuthority(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !RECORD_ENVELOPE_KEYS.has(key) && key !== 'version_authority_receipt_ref'));
}
function eventPayloadWithoutDerivedRefs(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !RECORD_ENVELOPE_KEYS.has(key) && key !== 'authority_receipt_ref' && key !== 'successor_ref'));
}
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${stableJson(v)}`).join(',')}}`;
  return JSON.stringify(value);
}

function intentProjection(action: (typeof ACTION_CLASSES)[number]): string {
  return ({ create_initial_unrelated:'unrelated_initial_version_intent_v0', create_initial_hypothesis_successor:'hypothesis_successor_unit_intent_v0', create_successor_version:'successor_version_unit_intent_v0', park:'park_intent_v0', correct_record:'correction_intent_v0', withdraw_record:'correction_intent_v0' } as const)[action];
}
function intentArrayRules(action: (typeof ACTION_CLASSES)[number]): ArrayRule[] {
  const root = action === 'create_successor_version' ? '/payload/target_payload_without_authority_ref/successor_version_payload_without_authority_ref'
    : action === 'create_initial_hypothesis_successor' ? '/payload/target_payload_without_authority_ref/successor_hypothesis_initial_version_payload_without_authority_ref'
    : '/payload/target_payload_without_authority_ref';
  const r = (path:string, key:ArrayRule['key']='$element'):ArrayRule => ({ path:`${root}${path}`, semantics:'set', key });
  return [
    r('/record_authority/basis_refs','$private_ref'),r('/provenance_refs','$private_ref'),r('/predecessor_refs','$private_ref'),r('/related_subjects','$field:relation_id'),r('/cem_refs','$private_ref'),
    r('/payoff_condition/unresolved_terms','$scalar'),r('/payoff_condition/predicates','$field:predicate_id'),r('/payoff_condition/predicates/*/applicability_predicate_ids','$scalar'),r('/payoff_condition/expression/predicate_ids','$scalar'),
    r('/resolution_plan/missing_witnesses','$field:witness_id'),r('/resolution_plan/missing_witnesses/*/predicate_ids','$scalar'),r('/resolution_plan/missing_witnesses/*/subject_refs','$scalar'),r('/resolution_plan/missing_witnesses/*/admissible_evidence_contract_refs','$contract_ref'),
    r('/dependency_manifest/related_subject_refs','$scalar'),r('/dependency_manifest/witness_type_refs','$contract_ref'),r('/dependency_manifest/artifact_family_refs','$contract_ref'),r('/dependency_manifest/football_field_refs','$contract_ref'),
    r('/dependency_manifest/scenario_family_refs','$contract_ref'),r('/dependency_manifest/operator_context_field_refs','$contract_ref'),r('/dependency_manifest/boundary_refs','$contract_ref'),r('/dependency_manifest/freshness_governance','$field:dependency_key'),
    r('/reason_codes','$scalar'),r('/basis_refs','$private_ref'),
  ];
}
