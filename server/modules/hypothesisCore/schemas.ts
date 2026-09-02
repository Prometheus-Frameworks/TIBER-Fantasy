import { z } from 'zod';
import { TIBER_PLAYER_ID_PATTERN } from '../../services/identity/tiberPlayerId';

export const DIGEST_PROFILE = 'tiber.hypothesis-core.digest/jcs-sha256-v0' as const;
export const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
export const RFC3339_INSTANT_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const opaque = z.string().min(1).max(512);
const digest = z.string().regex(DIGEST_PATTERN);
const instant = z.string().regex(RFC3339_INSTANT_PATTERN);
const privateId = (prefix: string) => z.string().regex(new RegExp(`^${prefix}[0-9a-f]{32}$`));

export const PrivateRecordRefV0Schema = z.object({
  ref_kind: z.literal('operator_private_record'), schema_id: opaque, record_id: opaque,
  workspace_id: opaque, record_digest: digest,
}).strict();
export type PrivateRecordRefV0 = z.infer<typeof PrivateRecordRefV0Schema>;

export const GovernedContractRefV0Schema = z.object({
  ref_kind: z.literal('governed_contract'), governance_namespace: opaque,
  contract_schema_id: opaque, contract_id: opaque, contract_version: opaque,
  digest_profile: opaque, contract_digest: digest,
}).strict();
export type GovernedContractRefV0 = z.infer<typeof GovernedContractRefV0Schema>;
export const ReferenceV0Schema = z.discriminatedUnion('ref_kind', [PrivateRecordRefV0Schema, GovernedContractRefV0Schema]);

export const ActorV0Schema = z.object({
  actor_type: z.enum(['operator', 'agent', 'system', 'provider_observer', 'synthetic_fixture']),
  actor_ref: opaque,
}).strict();
export const RecordAuthorityV0Schema = z.object({
  source_authority: z.enum(['provider_operational', 'governed_football_artifact', 'operator_supplied', 'synthetic_test', 'none']),
  derivation_type: z.enum(['observed', 'deterministic_mechanical', 'agent_interpretation', 'unavailable']),
  basis_refs: z.array(PrivateRecordRefV0Schema),
}).strict();

const envelopeShape = {
  schema_id: opaque, record_id: opaque, workspace_id: opaque, operator_id: opaque,
  season_scope: z.string().regex(/^nfl:\d{4}$/), scope: z.literal('operator_local'),
  visibility: z.literal('operator_private'),
  clocks: z.object({ recorded_at: instant, observed_at: instant.nullable(), received_at: instant.nullable() }).strict(),
  actor: ActorV0Schema, record_authority: RecordAuthorityV0Schema,
  provenance_refs: z.array(PrivateRecordRefV0Schema), predecessor_refs: z.array(PrivateRecordRefV0Schema),
  digest_profile: z.literal(DIGEST_PROFILE), record_digest: digest,
};
export const CommonEnvelopeV0Schema = z.object(envelopeShape).strict();
export type CommonEnvelopeV0 = z.infer<typeof CommonEnvelopeV0Schema>;

function collectPrivateRefs(value: unknown, refs: PrivateRecordRefV0[] = []): PrivateRecordRefV0[] {
  if (Array.isArray(value)) {
    for (const member of value) collectPrivateRefs(member, refs);
  } else if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    if (candidate.ref_kind === 'operator_private_record') {
      const parsed = PrivateRecordRefV0Schema.safeParse(candidate);
      if (parsed.success) refs.push(parsed.data);
    } else {
      for (const member of Object.values(candidate)) collectPrivateRefs(member, refs);
    }
  }
  return refs;
}

const record = <T extends z.ZodRawShape>(schemaId: string, prefix: string, payload: T) =>
  z.object({ ...envelopeShape, ...payload }).strict().superRefine((value, ctx) => {
    const envelope = value as unknown as CommonEnvelopeV0;
    if (envelope.schema_id !== schemaId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['schema_id'], message: 'schema_id does not match record type' });
    if (!new RegExp(`^${prefix}[0-9a-f]{32}$`).test(envelope.record_id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['record_id'], message: 'record_id namespace invalid' });
    for (const ref of collectPrivateRefs(value)) {
      if (ref.workspace_id !== envelope.workspace_id) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'private reference crosses workspace' });
    }
  });

export const PrimarySubjectV0Schema = z.object({
  subject_type: z.literal('tiber_player'), tiber_player_id: z.string().regex(TIBER_PLAYER_ID_PATTERN),
  identity_receipt_ref: PrivateRecordRefV0Schema,
}).strict();
export const RelatedSubjectV0Schema = z.object({
  relation_id: opaque, relation_type: z.enum(['competition', 'availability_dependency', 'opportunity_dependency', 'context']),
  tiber_player_id: z.string().regex(TIBER_PLAYER_ID_PATTERN), identity_receipt_ref: PrivateRecordRefV0Schema,
}).strict();

const PredicateOperandV0Schema = z.object({
  value_type: z.enum(['boolean', 'integer', 'decimal_string', 'string', 'enum']),
  value: z.union([z.boolean(), z.number().int().safe(), z.string()]), unit_ref: GovernedContractRefV0Schema.nullable(),
}).strict().superRefine((value, ctx) => {
  const typeMatches = value.value_type === 'boolean' ? typeof value.value === 'boolean'
    : value.value_type === 'integer' ? typeof value.value === 'number'
    : typeof value.value === 'string';
  if (!typeMatches) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'operand value does not match value_type' });
  if (value.value_type === 'decimal_string' && (typeof value.value !== 'string' || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value.value))) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'invalid canonical decimal string' });
});
export const PayoffPredicateV0Schema = z.object({
  predicate_id: opaque, status: z.enum(['operational', 'unresolved']), subject_ref: opaque,
  measure_ref: GovernedContractRefV0Schema,
  test: z.object({ operator: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'rank_at_most', 'present', 'absent']), operand: PredicateOperandV0Schema }).strict(),
  scope_ref: GovernedContractRefV0Schema, window_ref: GovernedContractRefV0Schema,
  applicability_predicate_ids: z.array(opaque), evidence_policy_ref: GovernedContractRefV0Schema,
  unresolved_reason: z.string().min(1).nullable(),
}).strict().superRefine((value, ctx) => {
  if (value.status === 'operational' && value.unresolved_reason !== null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'operational predicate cannot carry unresolved_reason' });
  if (value.status === 'unresolved' && value.unresolved_reason === null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'unresolved predicate requires reason' });
});

export const MissingWitnessV0Schema = z.object({
  witness_id: opaque, predicate_ids: z.array(opaque).min(1), subject_refs: z.array(opaque).min(1),
  witness_type_ref: GovernedContractRefV0Schema, admissible_evidence_contract_refs: z.array(GovernedContractRefV0Schema).min(1),
  window_ref: GovernedContractRefV0Schema, required_for_completeness: z.boolean(),
  absence_semantics: z.enum(['not_evidence', 'observable_zero_under_complete_window']), coverage_policy_ref: GovernedContractRefV0Schema,
  effect_map: z.object({
    observed_present: z.enum(['strengthens', 'weakens', 'falsifies_component', 'no_change', 'indeterminate']),
    observed_absent: z.enum(['strengthens', 'weakens', 'falsifies_component', 'no_change', 'indeterminate']),
  }).strict(),
}).strict();

export const FreshnessGovernanceV0Schema = z.object({
  dependency_key: opaque, owning_input_component: z.enum(['football_evidence', 'operator_context']),
  freshness_policy_ref: GovernedContractRefV0Schema, clock_basis: z.enum(['observed_at', 'received_at', 'governed_boundary']),
  boundary_contract_ref: GovernedContractRefV0Schema, non_expiring: z.boolean(),
}).strict();
export const DependencyManifestV0Schema = z.object({
  primary_subject_ref: z.literal('primary'), related_subject_refs: z.array(opaque), witness_type_refs: z.array(GovernedContractRefV0Schema),
  artifact_family_refs: z.array(GovernedContractRefV0Schema), football_field_refs: z.array(GovernedContractRefV0Schema),
  scenario_family_refs: z.array(GovernedContractRefV0Schema), operator_context_field_refs: z.array(GovernedContractRefV0Schema),
  boundary_refs: z.array(GovernedContractRefV0Schema), freshness_governance: z.array(FreshnessGovernanceV0Schema),
}).strict();

export const ResolutionPlanV0Schema = z.object({
  evidence_window: z.enum(['before_next_decision', 'next_game', 'one_to_two_games', 'multi_week', 'open_ended', 'unknown']),
  next_decision_boundary_ref: PrivateRecordRefV0Schema.nullable(), occurs_after_expected_evidence: z.union([z.boolean(), z.literal('unknown')]),
  relevance_horizon_ref: GovernedContractRefV0Schema.nullable(), expires_before_resolution: z.union([z.boolean(), z.literal('unknown')]),
  bounded: z.boolean(), missing_witnesses: z.array(MissingWitnessV0Schema),
}).strict();

export const HypothesisVersionV0Schema = record('tiber.hypothesis-core/hypothesis-version/v0', 'tbr_hyv_', {
  hypothesis_id: privateId('tbr_hyp_'), version_ordinal: z.number().int().positive(), version_authority_receipt_ref: PrivateRecordRefV0Schema,
  primary_subject: PrimarySubjectV0Schema, related_subjects: z.array(RelatedSubjectV0Schema), cem_refs: z.array(PrivateRecordRefV0Schema),
  statement: z.string().min(1), management_horizon: opaque,
  payoff_condition: z.object({ predicate_status: z.enum(['operational', 'unresolved']), unresolved_terms: z.array(opaque), predicates: z.array(PayoffPredicateV0Schema), expression: z.object({ mode: z.enum(['all', 'any', 'policy_ref']), predicate_ids: z.array(opaque), policy_ref: GovernedContractRefV0Schema.nullable() }).strict() }).strict(),
  resolution_plan: ResolutionPlanV0Schema, dependency_manifest: DependencyManifestV0Schema,
  predecessor_version_ref: PrivateRecordRefV0Schema.nullable(), predecessor_hypothesis_ref: PrivateRecordRefV0Schema.nullable(),
}).superRefine((value, ctx) => {
  const ids = new Set(value.payoff_condition.predicates.map(p => p.predicate_id));
  if (ids.size !== value.payoff_condition.predicates.length) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'duplicate predicate_id' });
  if (value.payoff_condition.predicate_status === 'operational' && (value.payoff_condition.unresolved_terms.length || value.payoff_condition.predicates.some(p => p.status !== 'operational'))) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'non_operational_payoff_predicate' });
  const expr = value.payoff_condition.expression;
  if ((expr.mode === 'all' || expr.mode === 'any') && (!expr.predicate_ids.length || expr.policy_ref !== null)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid payoff expression' });
  if ((expr.mode === 'all' || expr.mode === 'any') && expr.predicate_ids.some(id => !ids.has(id))) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'payoff expression references undeclared predicate' });
  if (expr.mode === 'policy_ref' && (expr.policy_ref === null || expr.predicate_ids.length)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'invalid policy expression' });
  if (value.version_ordinal === 1 && value.predecessor_version_ref !== null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'initial version cannot have predecessor_version_ref' });
});

export const CanonicalSubjectReceiptV0Schema = record('tiber.hypothesis-core/canonical-subject-receipt/v0', 'tbr_hyid_', {
  registry_contract_ref: GovernedContractRefV0Schema, lookup_basis_ref: PrivateRecordRefV0Schema, lookup_observed_at: instant,
  locator: z.object({ kind: z.enum(['tiber_player_id', 'player_name']), value: opaque }).strict(),
  resolution_status: z.enum(['resolved', 'not_found', 'ambiguous', 'merge_broken', 'identity_incomplete', 'unavailable']),
  resolved_subject: z.object({ subject_type: z.literal('tiber_player'), tiber_player_id: z.string().regex(TIBER_PLAYER_ID_PATTERN), merge_resolution_status: z.literal('resolved_to_survivor') }).strict().nullable(),
}).superRefine((value, ctx) => {
  if ((value.resolution_status === 'resolved') !== (value.resolved_subject !== null)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'resolved subject/status mismatch' });
});

export const ACTION_CLASSES = ['create_initial_unrelated', 'create_initial_hypothesis_successor', 'create_successor_version', 'park', 'correct_record', 'withdraw_record'] as const;
export const HypothesisAuthorityReceiptV0Schema = record('tiber.hypothesis-core/hypothesis-authority-receipt/v0', 'tbr_hya_', {
  action_class: z.enum(ACTION_CLASSES), decision: z.literal('authorized'), intent_projection_id: opaque,
  intent_digest: digest, confirmation_mode: z.literal('explicit_operator_confirmation'), single_use: z.literal(true),
});

export const HypothesisLifecycleEventV0Schema = record('tiber.hypothesis-core/hypothesis-lifecycle-event/v0', 'tbr_hyl_', {
  hypothesis_id: privateId('tbr_hyp_'), hypothesis_version_ref: PrivateRecordRefV0Schema, event_type: z.literal('parked'),
  from_state: z.literal('active'), to_state: z.literal('parked'), effective_at: instant,
  authority_receipt_ref: PrivateRecordRefV0Schema, reason_codes: z.array(opaque),
});

export const FingerprintSetV0Schema = z.object({
  hypothesis_definition: digest, football_evidence: digest, operator_context: digest, evaluation_method: digest, composite_evaluation: digest,
}).strict();
export const WitnessResultV0Schema = z.object({
  witness_id: opaque, window_state: z.enum(['open', 'closed', 'unknown']), observation_state: z.enum(['unobserved', 'observed_present', 'observed_absent', 'unavailable', 'contradicted']),
  coverage_state: z.enum(['complete', 'incomplete', 'unknown']), evaluative_effect: z.enum(['strengthens', 'weakens', 'falsifies_component', 'no_change', 'indeterminate']),
  basis_refs: z.array(PrivateRecordRefV0Schema), coverage_receipt_refs: z.array(PrivateRecordRefV0Schema), contradiction_refs: z.array(PrivateRecordRefV0Schema), reason_codes: z.array(opaque),
}).strict().superRefine((value, ctx) => {
  if (value.coverage_state === 'complete' && value.coverage_receipt_refs.length === 0) ctx.addIssue({ code:z.ZodIssueCode.custom, message:'complete coverage requires a receipt' });
  if ((value.observation_state === 'unobserved' || value.observation_state === 'unavailable' || value.observation_state === 'contradicted') && value.evaluative_effect !== 'indeterminate') ctx.addIssue({ code:z.ZodIssueCode.custom, message:'missing or contradicted evidence must remain indeterminate' });
  if ((value.observation_state === 'observed_present' || value.observation_state === 'observed_absent' || value.observation_state === 'contradicted') && value.basis_refs.length === 0) ctx.addIssue({ code:z.ZodIssueCode.custom, message:'observed or contradicted state requires basis' });
  if (value.observation_state === 'observed_absent' && (value.window_state !== 'closed' || value.coverage_state !== 'complete' || value.coverage_receipt_refs.length === 0)) ctx.addIssue({ code:z.ZodIssueCode.custom, message:'observed absence requires closed window and complete governed coverage' });
  if (value.observation_state === 'contradicted' && value.contradiction_refs.length === 0) ctx.addIssue({ code:z.ZodIssueCode.custom, message:'contradicted state requires contradiction refs' });
  if (value.observation_state === 'unavailable' && value.reason_codes.length === 0) ctx.addIssue({ code:z.ZodIssueCode.custom, message:'unavailable state requires a reason' });
});
export const PredicateResultV0Schema = z.object({
  predicate_id: opaque, state: z.enum(['satisfied', 'not_satisfied', 'unresolved', 'unavailable', 'contradicted']), window_state: z.enum(['open', 'closed', 'unknown']), coverage_state: z.enum(['complete', 'incomplete', 'unknown']),
  basis_refs: z.array(PrivateRecordRefV0Schema), coverage_receipt_refs: z.array(PrivateRecordRefV0Schema),
  source_authority: z.enum(['governed_football_artifact', 'operator_supplied', 'synthetic_test', 'none']), derivation_type: z.enum(['observed', 'deterministic_mechanical', 'agent_interpretation', 'unavailable']), reason_codes: z.array(opaque),
}).strict().superRefine((value, ctx) => {
  if ((value.state === 'satisfied' || value.state === 'not_satisfied') && (value.basis_refs.length === 0 || value.derivation_type === 'agent_interpretation' || value.derivation_type === 'unavailable')) ctx.addIssue({ code:z.ZodIssueCode.custom, message:'determinate predicate result requires admitted deterministic basis' });
  if (value.coverage_state === 'complete' && value.coverage_receipt_refs.length === 0) ctx.addIssue({ code:z.ZodIssueCode.custom, message:'complete coverage requires a receipt' });
});

export const ReevaluationTriggerReceiptV0Schema = record('tiber.hypothesis-core/reevaluation-trigger-receipt/v0', 'tbr_hyt_', {
  hypothesis_version_ref: PrivateRecordRefV0Schema, prior_evaluation_ref: PrivateRecordRefV0Schema.nullable(),
  trigger_class: z.enum(['initial_evaluation', 'hypothesis_definition_changed', 'football_evidence_changed', 'operator_context_changed', 'evaluation_method_changed', 'governed_freshness_changed', 'witness_window_closed', 'decision_boundary_changed', 'correction_or_withdrawal']),
  old_input_fingerprints: FingerprintSetV0Schema.omit({ composite_evaluation: true }).nullable(), new_input_fingerprints: FingerprintSetV0Schema.omit({ composite_evaluation: true }),
  changed_components: z.array(z.enum(['hypothesis_definition', 'football_evidence', 'operator_context', 'evaluation_method'])),
  dependency_matches: z.array(z.object({ dependency_key: opaque, changed_input_ref: PrivateRecordRefV0Schema }).strict()),
  decision: z.enum(['append_evaluation', 'no_op']), reason_codes: z.array(opaque), logical_trigger_key: digest,
});

export const EvaluationSnapshotV0Schema = record('tiber.hypothesis-core/hypothesis-core-evaluation-snapshot/v0', 'tbr_hye_', {
  hypothesis_version_ref: PrivateRecordRefV0Schema, prior_evaluation_ref: PrivateRecordRefV0Schema.nullable(), trigger_receipt_ref: PrivateRecordRefV0Schema,
  evidence_cutoff_at: instant,
  input_bundle: z.object({ governed_football_evidence_refs: z.array(PrivateRecordRefV0Schema), operator_context_refs: z.array(PrivateRecordRefV0Schema), scenario_refs: z.array(PrivateRecordRefV0Schema), correction_or_withdrawal_refs: z.array(PrivateRecordRefV0Schema), governed_freshness_transition_refs: z.array(PrivateRecordRefV0Schema), explicit_unavailable_inputs: z.array(z.object({ owning_input_component: z.enum(['football_evidence', 'operator_context']), dependency_key: opaque, reason_code: opaque }).strict()) }).strict(),
  input_bundle_digest: digest, fingerprints: FingerprintSetV0Schema, dependency_projected_input_digest: digest,
  evaluation_method_contract_ref: GovernedContractRefV0Schema, witness_results: z.array(WitnessResultV0Schema), predicate_results: z.array(PredicateResultV0Schema),
  axes: z.object({ lifecycle_at_cutoff: z.enum(['active', 'parked']), proposition_resolution: z.enum(['unresolved', 'partial', 'supported_for_window', 'falsified', 'expired_unresolved', 'indeterminate']), evidence_completeness: z.enum(['incomplete', 'complete']), evaluation_delta: z.enum(['strengthened', 'weakened', 'mixed', 'unchanged']).nullable() }).strict(),
  relevance_horizon_state: z.enum(['not_expired', 'expired', 'unknown']),
  dimension_states: z.object({ probability: z.enum(['unavailable', 'qualitative_only']), upside: z.enum(['unavailable', 'qualitative_only', 'governed_scenario_only']), resolution: z.literal('categorical'), roster_fit: z.enum(['not_evaluated', 'unavailable', 'external_assessment_ref']), holding_cost: z.enum(['not_evaluated', 'unavailable', 'external_assessment_ref']) }).strict(),
  dimension_assessment_refs: z.array(PrivateRecordRefV0Schema), unknowns: z.array(z.object({ unknown_id: opaque, scope: opaque, target_id: opaque, reason_code: opaque, basis_refs: z.array(PrivateRecordRefV0Schema) }).strict()),
  contradictions: z.array(z.object({ contradiction_id: opaque, target_kind: opaque, target_id: opaque, predicate_ids: z.array(opaque), basis_refs: z.array(PrivateRecordRefV0Schema), concise_summary: z.string() }).strict()),
  rationale: z.object({ concise_summary: z.string(), support_refs: z.array(PrivateRecordRefV0Schema), hidden_chain_of_thought_required: z.literal(false) }).strict(), rationale_digest: digest,
});

export const GovernedFreshnessTransitionReceiptV0Schema = record('tiber.hypothesis-core/governed-freshness-transition-receipt/v0', 'tbr_hyf_', {
  hypothesis_version_ref: PrivateRecordRefV0Schema, dependency_key: opaque, logical_transition_key: digest,
  owning_input_component: z.enum(['football_evidence', 'operator_context']), freshness_policy_ref: GovernedContractRefV0Schema, boundary_contract_ref: GovernedContractRefV0Schema,
  prior_transition_receipt_ref: PrivateRecordRefV0Schema.nullable(), transition_kind: z.enum(['initial_state', 'source_observation_advanced', 'governed_boundary_crossed', 'witness_window_closed', 'source_became_unavailable']),
  from_freshness_state: z.enum(['fresh', 'stale', 'expired', 'unavailable', 'unknown']).nullable(), to_freshness_state: z.enum(['fresh', 'stale', 'expired', 'unavailable', 'unknown']),
  from_window_state: z.enum(['open', 'closed', 'unknown']).nullable(), to_window_state: z.enum(['open', 'closed', 'unknown']),
  source_basis_ref: PrivateRecordRefV0Schema, source_observed_at: instant.nullable(), source_received_at: instant.nullable(), evaluated_boundary_at: instant, valid_through: instant.nullable(), basis_refs: z.array(PrivateRecordRefV0Schema).min(1),
});

export const RecordCorrectionEventV0Schema = record('tiber.hypothesis-core/record-correction-event/v0', 'tbr_hyc_', {
  target_record_ref: PrivateRecordRefV0Schema, disposition: z.enum(['corrected', 'withdrawn']), replacement_record_ref: PrivateRecordRefV0Schema.nullable(),
  effective_at: instant, reason_codes: z.array(opaque), basis_refs: z.array(PrivateRecordRefV0Schema), authority_receipt_ref: PrivateRecordRefV0Schema,
  affected_input_component: z.enum(['hypothesis_definition', 'football_evidence', 'operator_context', 'evaluation_method', 'none']),
}).superRefine((value, ctx) => {
  if ((value.disposition === 'corrected') !== (value.replacement_record_ref !== null)) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'replacement/disposition mismatch' });
});

export const HypothesisSupersessionEventV0Schema = record('tiber.hypothesis-core/hypothesis-supersession-event/v0', 'tbr_hys_', {
  scope: z.enum(['version', 'hypothesis']), predecessor_ref: PrivateRecordRefV0Schema, successor_ref: PrivateRecordRefV0Schema,
  effective_at: instant, reason_code: z.enum(['resolution_plan_revised', 'dependency_plan_revised', 'proposition_changed', 'environment_changed', 'identity_corrected', 'other']), authority_receipt_ref: PrivateRecordRefV0Schema,
});

export const HypothesisResolutionRecordV0Schema = record('tiber.hypothesis-core/hypothesis-resolution-record/v0', 'tbr_hyr_', {
  hypothesis_version_ref: PrivateRecordRefV0Schema, resolving_evaluation_ref: PrivateRecordRefV0Schema,
  resolution_state: z.enum(['supported_for_window', 'falsified', 'expired_unresolved', 'indeterminate']), resolved_at: instant,
  predicate_outcomes: z.array(PredicateResultV0Schema), component_outcomes: z.array(WitnessResultV0Schema), reusable_observation_refs: z.array(PrivateRecordRefV0Schema),
  failure_mode_attributions: z.array(z.object({ code: opaque, attribution_authority: z.enum(['observed', 'inferred']), support_refs: z.array(PrivateRecordRefV0Schema) }).strict()), global_subject_judgment: z.literal('prohibited'),
});

const retrospectiveAttribution = z.object({
  code: z.enum(['opportunity_not_realized', 'performance_underwhelmed', 'competitor_outperformed', 'environment_changed', 'player_availability_changed', 'evidence_quality_failure', 'decision_window_expired', 'identity_or_coverage_failure', 'mixed', 'unknown']),
  attribution_authority: z.enum(['observed', 'inferred']), support_refs: z.array(PrivateRecordRefV0Schema),
}).strict();
export const RetrospectiveReviewV0Schema = record('tiber.hypothesis-core/retrospective-review/v0', 'tbr_hyrr_', {
  hypothesis_version_ref: PrivateRecordRefV0Schema, resolution_ref: PrivateRecordRefV0Schema.nullable(), external_operator_record_ref: PrivateRecordRefV0Schema.nullable(),
  process_assessment: z.enum(['sound', 'defect_detected', 'indeterminate']), evidence_timing: z.enum(['known_at_decision', 'arrived_after_decision', 'mixed']), outcome: z.enum(['favorable', 'adverse', 'neutral', 'unresolved']),
  operator_alignment: z.enum(['followed_referral', 'overrode_referral', 'deferred', 'no_referral']), failure_mode_attributions: z.array(retrospectiveAttribution), basis_refs: z.array(PrivateRecordRefV0Schema),
});

export const ProductionRecordV0Schema = z.union([
  HypothesisVersionV0Schema, CanonicalSubjectReceiptV0Schema, HypothesisAuthorityReceiptV0Schema,
  HypothesisLifecycleEventV0Schema, ReevaluationTriggerReceiptV0Schema, EvaluationSnapshotV0Schema,
  GovernedFreshnessTransitionReceiptV0Schema, RecordCorrectionEventV0Schema, HypothesisSupersessionEventV0Schema,
  HypothesisResolutionRecordV0Schema, RetrospectiveReviewV0Schema,
]);

const sixKeyIntent = (action: z.ZodTypeAny, target: z.ZodTypeAny) => z.object({
  action_class: action, target_schema_id: opaque, workspace_id: opaque, operator_id: opaque,
  season_scope: z.string().regex(/^nfl:\d{4}$/), target_payload_without_authority_ref: target,
}).strict();
export const UnrelatedInitialVersionIntentV0Schema = sixKeyIntent(z.literal('create_initial_unrelated'), z.record(z.unknown()));
export const SuccessorVersionUnitIntentV0Schema = sixKeyIntent(z.literal('create_successor_version'), z.object({
  successor_version_payload_without_authority_ref: z.record(z.unknown()),
  version_supersession_event_payload_without_authority_and_successor_ref: z.record(z.unknown()),
  successor_member_binding: z.object({ hypothesis_id: privateId('tbr_hyp_'), version_ordinal: z.number().int().positive(), predecessor_version_ref: PrivateRecordRefV0Schema }).strict(),
}).strict());
export const HypothesisSuccessorUnitIntentV0Schema = sixKeyIntent(z.literal('create_initial_hypothesis_successor'), z.object({
  successor_hypothesis_initial_version_payload_without_authority_ref: z.record(z.unknown()),
  hypothesis_supersession_event_payload_without_authority_and_successor_ref: z.record(z.unknown()),
  successor_member_binding: z.object({ predecessor_hypothesis_id: privateId('tbr_hyp_'), predecessor_version_ref: PrivateRecordRefV0Schema, successor_hypothesis_id: privateId('tbr_hyp_'), successor_version_ordinal: z.literal(1) }).strict(),
}).strict());
export const ParkIntentV0Schema = sixKeyIntent(z.literal('park'), z.record(z.unknown()));
export const CorrectionIntentV0Schema = sixKeyIntent(z.enum(['correct_record', 'withdraw_record']), z.record(z.unknown()));
export const AuthorizationIntentV0Schema = z.union([UnrelatedInitialVersionIntentV0Schema, SuccessorVersionUnitIntentV0Schema, HypothesisSuccessorUnitIntentV0Schema, ParkIntentV0Schema, CorrectionIntentV0Schema]);

const dimensions = z.object({ holding_cost: z.literal('not_evaluated'), probability: z.literal('unavailable'), roster_fit: z.literal('not_evaluated'), upside: z.literal('unavailable') }).strict();
const paperWitness = z.object({ coverage_state: z.literal('unknown'), evaluative_effect: z.literal('indeterminate'), observation_state: z.literal('unobserved'), witness_id: opaque }).strict();
const paperObservationV0 = z.object({ coverage_state: z.literal('complete'), fixture_value: opaque, observation_state: z.literal('observed_present'), witness_id: opaque }).strict();
const paperObservationV1 = paperObservationV0.extend({ effect_map: z.object({ observed_present: z.literal('strengthens') }).strict() }).strict();
const paperPayload = (obs: z.ZodTypeAny) => z.object({
  authority: z.literal('synthetic_fixture_only'), fixture_id: z.string().regex(/^fixture:/), frozen_statement: z.string(), paper_evidence_window: z.enum(['one_to_two_games', 'next_game', 'unknown']),
  paper_expected: z.object({ f0: z.object({ dimensions, evidence_completeness: z.literal('incomplete'), proposition_resolution: z.literal('unresolved') }).strict(), f1: z.object({ dimensions, evaluation_delta: z.literal('strengthened'), evidence_completeness: z.literal('incomplete'), paper_simulated_trigger_class: z.literal('football_evidence_changed'), proposition_resolution: z.literal('unresolved'), remaining_missing_witnesses: z.array(opaque) }).strict() }).strict(),
  paper_f0: z.object({ recorded_at: instant, witness_states: z.array(paperWitness).min(1) }).strict(), paper_f1: z.object({ recorded_at: instant, synthetic_observations: z.array(obs).min(1) }).strict(),
  primary_subject: z.string().regex(/^fixture:subject:/), production_expected: z.object({ active_hypothesis_created: z.literal(false), durable_records_emitted: z.literal(0), reason_codes: z.tuple([z.literal('non_canonical_subject'), z.literal('non_operational_payoff_predicate'), z.literal('synthetic_evidence')]), result: z.literal('refused_non_governed_fixture') }).strict(), related_subjects: z.tuple([]),
}).strict();
export const PaperFixtureV0Schema = z.object({ component: z.literal('paper_fixture'), domain: z.literal('tiber.hypothesis-core'), payload: paperPayload(paperObservationV0), profile: z.literal(DIGEST_PROFILE), projection: z.literal('paper_fixture_content_v0'), purpose: z.literal('record_content'), schema: z.literal('tiber.hypothesis-core/paper-fixture/v0') }).strict();
export const PaperFixtureV1Schema = z.object({ component: z.literal('paper_fixture'), domain: z.literal('tiber.hypothesis-core'), payload: paperPayload(paperObservationV1), profile: z.literal(DIGEST_PROFILE), projection: z.literal('paper_fixture_content_v1'), purpose: z.literal('record_content'), schema: z.literal('tiber.hypothesis-core/paper-fixture/v1') }).strict();
export const PaperRefusalV0Schema = z.object({
  component: z.literal('paper_refusal'), domain: z.literal('tiber.hypothesis-core'), profile: z.literal(DIGEST_PROFILE), projection: z.literal('paper_refusal_content_v0'), purpose: z.literal('record_content'), schema: z.literal('tiber.hypothesis-core/paper-refusal/v0'),
  payload: z.object({ active_hypothesis_created: z.literal(false), attention_evaluated: z.literal(false), derived_relations: z.tuple([]), durable_records_emitted: z.literal(0), live_inputs_authorized: z.literal(false), mode: z.literal('paper_expected_production_refusal'), reason_codes: z.tuple([z.literal('canonical_subject_receipts_not_supplied'), z.literal('governed_football_evidence_not_supplied'), z.literal('roster_context_out_of_scope'), z.literal('league_occupancy_out_of_scope'), z.literal('comparison_activation_unclassified')]), result: z.literal('not_comparable'), trace_id: z.literal('LIVE-T0') }).strict(),
}).strict();
export const ConformanceFixtureV0PayloadSchema = z.object({ id: z.string(), optional_note: z.string().nullable().optional(), steps: z.array(z.string()).optional(), witness_types: z.array(z.string()).optional(), observed_at: instant.optional() }).strict();
