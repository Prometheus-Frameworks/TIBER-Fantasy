import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  ConformanceFixtureV0PayloadSchema, DIGEST_PROFILE, PaperFixtureV0Schema,
  PaperFixtureV1Schema, PaperRefusalV0Schema, ProductionRecordV0Schema,
} from './schemas';

export type CanonicalRefusalCode =
  | 'canonical_input_non_json' | 'canonical_input_number_invalid' | 'canonical_input_array_invalid'
  | 'canonical_input_set_key_collision' | 'canonical_input_duplicate_member'
  | 'canonical_input_timestamp_invalid' | 'canonical_input_timestamp_leap_second'
  | 'canonical_input_timestamp_precision' | 'canonical_input_unicode_invalid'
  | 'canonical_input_schema_invalid' | 'canonical_input_projection_invalid';

export class CanonicalizationError extends Error {
  constructor(public readonly code: CanonicalRefusalCode, message: string) { super(message); this.name = 'CanonicalizationError'; }
}

export type ArrayRule = { path: string; semantics: 'ordered' | 'set'; key?: '$scalar' | '$element' | '$private_ref' | '$contract_ref' | `$field:${string}` | `$tuple:${string}` };
export interface CanonicalRegistryEntry {
  purpose: 'record_content' | 'component_fingerprint' | 'projected_input_bundle' | 'evaluation_output' | 'rationale';
  component: string; schema: string; projection: string; payloadSchema?: z.ZodTypeAny; arrayRules?: readonly ArrayRule[];
  mode?: 'production' | 'paper' | 'test';
}

export const PRODUCTION_RECORD_REGISTRY = Object.freeze({
  'tiber.hypothesis-core/hypothesis-version/v0': ['hypothesis_version', 'hypothesis_version_record_content_v0'],
  'tiber.hypothesis-core/canonical-subject-receipt/v0': ['canonical_subject_receipt', 'canonical_subject_receipt_record_content_v0'],
  'tiber.hypothesis-core/hypothesis-authority-receipt/v0': ['hypothesis_authority_receipt', 'hypothesis_authority_receipt_record_content_v0'],
  'tiber.hypothesis-core/hypothesis-lifecycle-event/v0': ['hypothesis_lifecycle_event', 'hypothesis_lifecycle_event_record_content_v0'],
  'tiber.hypothesis-core/reevaluation-trigger-receipt/v0': ['reevaluation_trigger_receipt', 'reevaluation_trigger_receipt_record_content_v0'],
  'tiber.hypothesis-core/hypothesis-core-evaluation-snapshot/v0': ['hypothesis_core_evaluation_snapshot', 'hypothesis_core_evaluation_snapshot_record_content_v0'],
  'tiber.hypothesis-core/governed-freshness-transition-receipt/v0': ['governed_freshness_transition_receipt', 'governed_freshness_transition_receipt_record_content_v0'],
  'tiber.hypothesis-core/record-correction-event/v0': ['record_correction_event', 'record_correction_event_record_content_v0'],
  'tiber.hypothesis-core/hypothesis-supersession-event/v0': ['hypothesis_supersession_event', 'hypothesis_supersession_event_record_content_v0'],
  'tiber.hypothesis-core/hypothesis-resolution-record/v0': ['hypothesis_resolution_record', 'hypothesis_resolution_record_content_v0'],
  'tiber.hypothesis-core/retrospective-review/v0': ['retrospective_review', 'retrospective_review_record_content_v0'],
} as const);

const FIXTURE_TUPLES = new Map<string, z.ZodTypeAny>([
  ['record_content|paper_refusal|tiber.hypothesis-core/paper-refusal/v0|paper_refusal_content_v0', PaperRefusalV0Schema],
  ['record_content|paper_fixture|tiber.hypothesis-core/paper-fixture/v0|paper_fixture_content_v0', PaperFixtureV0Schema],
  ['record_content|paper_fixture|tiber.hypothesis-core/paper-fixture/v1|paper_fixture_content_v1', PaperFixtureV1Schema],
]);

const CONFORMANCE_TUPLES = new Set([
  'component_fingerprint|hypothesis_definition', 'component_fingerprint|football_evidence',
  'evaluation_output|composite_evaluation',
]);

const hasLoneSurrogate = (text: string) => {
  for (let i = 0; i < text.length; i++) {
    const n = text.charCodeAt(i);
    if (n >= 0xd800 && n <= 0xdbff) { const next = text.charCodeAt(++i); if (!(next >= 0xdc00 && next <= 0xdfff)) return true; }
    else if (n >= 0xdc00 && n <= 0xdfff) return true;
  }
  return false;
};

const normalizeInstant = (value: string): string => {
  if (/:60(?:[.,]|Z|[+-])/.test(value)) throw new CanonicalizationError('canonical_input_timestamp_leap_second', 'leap seconds are not admitted');
  const fractional = value.match(/\.(\d+)(?=Z|[+-]\d{2}:\d{2}$)/)?.[1];
  if (fractional && fractional.length > 3) throw new CanonicalizationError('canonical_input_timestamp_precision', 'precision exceeds milliseconds');
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw new CanonicalizationError('canonical_input_timestamp_invalid', 'timestamp requires an explicit offset');
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|([+-])(\d{2}):(\d{2}))$/);
  if (!parts) throw new CanonicalizationError('canonical_input_timestamp_invalid', 'invalid timestamp');
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, , offsetHourText, offsetMinuteText] = parts;
  const [year, month, day, hour, minute, second, offsetHour, offsetMinute] = [yearText, monthText, dayText, hourText, minuteText, secondText, offsetHourText ?? '0', offsetMinuteText ?? '0'].map(Number);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (daysInMonth === undefined || day < 1 || day > daysInMonth || hour > 23 || minute > 59 || second > 59 || offsetHour > 23 || offsetMinute > 59) throw new CanonicalizationError('canonical_input_timestamp_invalid', 'invalid timestamp');
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) throw new CanonicalizationError('canonical_input_timestamp_invalid', 'invalid timestamp');
  return new Date(ms).toISOString();
};

const isTimestampKey = (key: string) => key.endsWith('_at') || ['recorded_at', 'observed_at', 'received_at', 'valid_through'].includes(key);
const jcs = (value: unknown): string => {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw new CanonicalizationError('canonical_input_number_invalid', 'numbers must be safe integers and not -0');
    return String(value);
  }
  if (typeof value === 'string') {
    if (hasLoneSurrogate(value)) throw new CanonicalizationError('canonical_input_unicode_invalid', 'lone surrogate');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(jcs).join(',')}]`;
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value as object).sort().map(k => `${JSON.stringify(k)}:${jcs((value as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  throw new CanonicalizationError('canonical_input_non_json', 'input must be plain JSON');
};

const ruleAt = (rules: readonly ArrayRule[], path: string) => rules.find(r => {
  const pattern = `^${r.path.split('/').map(part => part === '*' ? '[^/]+' : part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/')}$`;
  return new RegExp(pattern).test(path);
});
const setKey = (value: unknown, key: ArrayRule['key']): string => {
  if (key === '$scalar') return jcs(value);
  if (key?.startsWith('$field:')) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CanonicalizationError('canonical_input_array_invalid', 'field key requires object members');
    return jcs((value as Record<string, unknown>)[key.slice(7)]);
  }
  if (key?.startsWith('$tuple:')) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CanonicalizationError('canonical_input_array_invalid', 'tuple key requires object members');
    return jcs(key.slice(7).split(',').map(k => (value as Record<string, unknown>)[k]));
  }
  if (key === '$private_ref') {
    const v = value as Record<string, unknown>;
    return jcs(['operator_private_record',v.schema_id,v.workspace_id,v.record_id,v.record_digest]);
  }
  if (key === '$contract_ref') {
    const v = value as Record<string, unknown>;
    return jcs(['governed_contract',v.governance_namespace,v.contract_schema_id,v.contract_id,v.contract_version,v.digest_profile,v.contract_digest]);
  }
  return jcs(value);
};

function normalize(value: unknown, path: string, key: string | null, rules: readonly ArrayRule[]): unknown {
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (hasLoneSurrogate(value)) throw new CanonicalizationError('canonical_input_unicode_invalid', `lone surrogate at ${path}`);
    return key && isTimestampKey(key) ? normalizeInstant(value) : value;
  }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) throw new CanonicalizationError('canonical_input_number_invalid', `invalid number at ${path}`);
    return value;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) if (!(i in value)) throw new CanonicalizationError('canonical_input_array_invalid', `sparse array at ${path}`);
    const rule = ruleAt(rules, path);
    if (!rule) throw new CanonicalizationError('canonical_input_array_invalid', `undeclared array at ${path}`);
    const members = value.map((x, i) => normalize(x, `${path}/*`, String(i), rules));
    if (rule.semantics === 'ordered') return members;
    const byKey = new Map<string, unknown>();
    for (const member of members) {
      const k = setKey(member, rule.key);
      const existing = byKey.get(k);
      if (existing !== undefined && jcs(existing) !== jcs(member)) throw new CanonicalizationError('canonical_input_set_key_collision', `set-key collision at ${path}`);
      if (existing !== undefined && rule.key !== '$scalar') throw new CanonicalizationError('canonical_input_duplicate_member', `duplicate member at ${path}`);
      byKey.set(k, member);
    }
    return [...byKey.entries()].sort(([a], [b]) => Buffer.compare(Buffer.from(a), Buffer.from(b))).map(([, v]) => v);
  }
  if (typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as object).sort()) out[k] = normalize((value as Record<string, unknown>)[k], `${path}/${k}`, k, rules);
    return out;
  }
  throw new CanonicalizationError('canonical_input_non_json', `non-JSON value at ${path}`);
}

export const TEST_FIXTURE_RULES: readonly ArrayRule[] = [
  { path: '/payload/steps', semantics: 'ordered' }, { path: '/payload/witness_types', semantics: 'set', key: '$scalar' },
];

export function canonicalizeForProfile(input: unknown, entry: CanonicalRegistryEntry): Uint8Array {
  const tuple = `${entry.purpose}|${entry.component}|${entry.schema}|${entry.projection}`;
  // Canonical-domain failures take precedence over schema failures.
  const normalized = normalize(input, '/payload', null, entry.arrayRules ?? TEST_FIXTURE_RULES);
  if (entry.schema === 'tiber.hypothesis-core/conformance-fixture-v0') {
    if (!CONFORMANCE_TUPLES.has(`${entry.purpose}|${entry.component}`) || entry.projection !== 'fixture_payload_v0') throw new CanonicalizationError('canonical_input_projection_invalid', 'unregistered conformance tuple');
    const parsed = ConformanceFixtureV0PayloadSchema.safeParse(normalized);
    if (!parsed.success) throw new CanonicalizationError('canonical_input_schema_invalid', parsed.error.message);
  } else if (entry.mode === 'paper') {
    const schema = FIXTURE_TUPLES.get(tuple);
    const envelope = { component: entry.component, domain: 'tiber.hypothesis-core', payload: normalized, profile: DIGEST_PROFILE, projection: entry.projection, purpose: entry.purpose, schema: entry.schema };
    if (!schema?.safeParse(envelope).success) throw new CanonicalizationError('canonical_input_schema_invalid', 'paper fixture schema invalid');
  } else if (entry.mode === 'production') {
    const row = PRODUCTION_RECORD_REGISTRY[entry.schema as keyof typeof PRODUCTION_RECORD_REGISTRY];
    if (!row || row[0] !== entry.component || row[1] !== entry.projection || entry.purpose !== 'record_content') throw new CanonicalizationError('canonical_input_projection_invalid', 'unregistered production tuple');
  } else if (!entry.payloadSchema?.safeParse(input).success) throw new CanonicalizationError('canonical_input_projection_invalid', 'unregistered tuple');

  const envelope = normalize({ component: entry.component, domain: 'tiber.hypothesis-core', payload: normalized, profile: DIGEST_PROFILE, projection: entry.projection, purpose: entry.purpose, schema: entry.schema }, '', null, [
    ...(entry.arrayRules ?? TEST_FIXTURE_RULES).map(r => ({ ...r, path: r.path.startsWith('/payload') ? r.path : `/payload${r.path}` })),
  ]);
  return Buffer.from(jcs(envelope), 'utf8');
}

export function digestCanonicalPreimage(bytes: Uint8Array): `sha256:${string}` {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

export function canonicalizeProductionRecord(recordInput: unknown): Uint8Array {
  const parsed = ProductionRecordV0Schema.safeParse(recordInput);
  if (!parsed.success) throw new CanonicalizationError('canonical_input_schema_invalid', parsed.error.message);
  const { record_digest: _digest, ...payload } = parsed.data as Record<string, unknown>;
  const row = PRODUCTION_RECORD_REGISTRY[parsed.data.schema_id as keyof typeof PRODUCTION_RECORD_REGISTRY];
  if (!row) throw new CanonicalizationError('canonical_input_projection_invalid', 'record schema is not registered');
  return canonicalizeForProfile(payload, { purpose: 'record_content', component: row[0], schema: parsed.data.schema_id, projection: row[1], mode: 'production', arrayRules: productionArrayRules(parsed.data.schema_id) });
}

function productionArrayRules(schema: string): ArrayRule[] {
  const p = (path: string, key: ArrayRule['key'] = '$element', semantics: ArrayRule['semantics'] = 'set'): ArrayRule => ({ path:`/payload${path}`, semantics, key });
  const common = [p('/record_authority/basis_refs','$private_ref'),p('/provenance_refs','$private_ref'),p('/predecessor_refs','$private_ref')];
  const suffix = schema.slice('tiber.hypothesis-core/'.length);
  const bySchema: Record<string, ArrayRule[]> = {
    'hypothesis-version/v0': [
      p('/related_subjects','$field:relation_id'),p('/cem_refs','$private_ref'),p('/payoff_condition/unresolved_terms','$scalar'),p('/payoff_condition/predicates','$field:predicate_id'),
      p('/payoff_condition/predicates/*/applicability_predicate_ids','$scalar'),p('/payoff_condition/expression/predicate_ids','$scalar'),p('/resolution_plan/missing_witnesses','$field:witness_id'),
      p('/resolution_plan/missing_witnesses/*/predicate_ids','$scalar'),p('/resolution_plan/missing_witnesses/*/subject_refs','$scalar'),p('/resolution_plan/missing_witnesses/*/admissible_evidence_contract_refs','$contract_ref'),
      p('/dependency_manifest/related_subject_refs','$scalar'),p('/dependency_manifest/witness_type_refs','$contract_ref'),p('/dependency_manifest/artifact_family_refs','$contract_ref'),
      p('/dependency_manifest/football_field_refs','$contract_ref'),p('/dependency_manifest/scenario_family_refs','$contract_ref'),p('/dependency_manifest/operator_context_field_refs','$contract_ref'),
      p('/dependency_manifest/boundary_refs','$contract_ref'),p('/dependency_manifest/freshness_governance','$field:dependency_key'),
    ],
    'hypothesis-lifecycle-event/v0':[p('/reason_codes','$scalar')],
    'reevaluation-trigger-receipt/v0':[p('/changed_components','$scalar'),p('/dependency_matches','$field:dependency_key'),p('/reason_codes','$scalar')],
    'hypothesis-core-evaluation-snapshot/v0':[
      p('/input_bundle/governed_football_evidence_refs','$private_ref'),p('/input_bundle/operator_context_refs','$private_ref'),p('/input_bundle/scenario_refs','$private_ref'),
      p('/input_bundle/correction_or_withdrawal_refs','$private_ref'),p('/input_bundle/governed_freshness_transition_refs','$private_ref'),p('/input_bundle/explicit_unavailable_inputs','$tuple:owning_input_component,dependency_key'),
      p('/witness_results',undefined,'ordered'),p('/predicate_results',undefined,'ordered'),p('/witness_results/*/basis_refs','$private_ref'),p('/witness_results/*/coverage_receipt_refs','$private_ref'),
      p('/witness_results/*/contradiction_refs','$private_ref'),p('/witness_results/*/reason_codes','$scalar'),p('/predicate_results/*/basis_refs','$private_ref'),p('/predicate_results/*/coverage_receipt_refs','$private_ref'),
      p('/predicate_results/*/reason_codes','$scalar'),p('/dimension_assessment_refs','$private_ref'),p('/unknowns','$field:unknown_id'),p('/unknowns/*/basis_refs','$private_ref'),
      p('/contradictions','$field:contradiction_id'),p('/contradictions/*/predicate_ids','$scalar'),p('/contradictions/*/basis_refs','$private_ref'),p('/rationale/support_refs','$private_ref'),
    ],
    'governed-freshness-transition-receipt/v0':[p('/basis_refs','$private_ref')],
    'record-correction-event/v0':[p('/reason_codes','$scalar'),p('/basis_refs','$private_ref')],
    'hypothesis-resolution-record/v0':[
      p('/predicate_outcomes',undefined,'ordered'),p('/component_outcomes',undefined,'ordered'),p('/predicate_outcomes/*/basis_refs','$private_ref'),p('/predicate_outcomes/*/coverage_receipt_refs','$private_ref'),p('/predicate_outcomes/*/reason_codes','$scalar'),
      p('/component_outcomes/*/basis_refs','$private_ref'),p('/component_outcomes/*/coverage_receipt_refs','$private_ref'),p('/component_outcomes/*/contradiction_refs','$private_ref'),p('/component_outcomes/*/reason_codes','$scalar'),
      p('/reusable_observation_refs','$private_ref'),p('/failure_mode_attributions','$field:code'),p('/failure_mode_attributions/*/support_refs','$private_ref'),
    ],
    'retrospective-review/v0':[p('/failure_mode_attributions','$field:code'),p('/failure_mode_attributions/*/support_refs','$private_ref'),p('/basis_refs','$private_ref')],
  };
  return [...common, ...(bySchema[suffix] ?? [])];
}
