/**
 * Post-cutoff signal ledger contract (issue #297).
 *
 * TIBER-Forecast owns the frozen model artifact; TIBER-Fantasy owns this
 * operator intake/presentation layer. Ledger entries are candidate operator
 * evidence only — saving one never mutates Forecast outputs, rankings,
 * projections, or player cards, and an unreviewed entry is never governed
 * truth.
 *
 * The paste parser below is a deterministic hand-rolled YAML subset
 * (scalars, one level of `- item` lists, one level of nested `key: value`
 * maps). The repo intentionally has no YAML dependency; this follows the
 * client/src/lib/stressLab.ts precedent. Parsing never invents values:
 * unknown keys are preserved in `unrecognized_fields`, and values outside a
 * contract enum are surfaced as warnings and preserved rather than coerced.
 */

export const LEDGER_EVENT_TYPES = [
  'availability_change',
  'injury_update',
  'transaction',
  'depth_chart_change',
  'role_expansion',
  'role_compression',
  'personnel_usage',
  'scheme_change',
  'contract_or_suspension',
  'other',
] as const;
export type LedgerEventType = (typeof LEDGER_EVENT_TYPES)[number];

export const FORECAST_PRESSURES = ['upward', 'downward', 'mixed', 'none', 'unresolved'] as const;
export type ForecastPressure = (typeof FORECAST_PRESSURES)[number];

export const CONFIDENCE_LEVELS = ['low', 'moderate', 'high'] as const;
export type ConfidenceLevel = (typeof CONFIDENCE_LEVELS)[number];

export const LEDGER_STATUSES = [
  'candidate_operator_observation',
  'corroboration_pending',
  'confirmed_observation',
  'superseded',
  'closed_no_change',
] as const;
export type LedgerStatus = (typeof LEDGER_STATUSES)[number];

export const ROOKIES_PROFILE_STATUSES = ['available', 'partial', 'missing', 'not_applicable'] as const;
export type RookiesProfileStatus = (typeof ROOKIES_PROFILE_STATUSES)[number];

export interface LedgerPlayerRef {
  /** Canonical TIBER identity (GSIS `00-XXXXXXX`). Never joined silently by display name. */
  canonical_player_id: string | null;
  display_name: string;
  identity_status: 'resolved' | 'unresolved';
}

export interface LedgerSourceRef {
  ref: string;
  note: string | null;
  /** A source URL is never automatically treated as verified evidence. */
  verified: boolean;
}

export interface LedgerLinkedArtifacts {
  forecast_player_row_ref: string | null;
  rookies_profile_ref: string | null;
  rookies_profile_status: RookiesProfileStatus;
}

export interface LedgerUnrecognizedField {
  key: string;
  value: string | string[];
}

/** Mutable entry state carried by each immutable revision record. */
export interface LedgerEntry {
  baseline_run_id: string;
  player_ref: LedgerPlayerRef;
  observed_at: string;
  event_type: LedgerEventType;
  observations: string[];
  inferences: string[];
  forecast_pressure: ForecastPressure;
  confidence: ConfidenceLevel;
  status: LedgerStatus;
  source_refs: LedgerSourceRef[];
  linked_artifacts: LedgerLinkedArtifacts;
  limitations: string[];
  open_questions: string[];
  unrecognized_fields: LedgerUnrecognizedField[];
}

/**
 * One immutable record in the append-only ledger. Edits, corroboration,
 * supersession, and closure each append a new record pointing at the record
 * they supersede; prior records are never rewritten.
 */
export interface LedgerRecord {
  record_id: string;
  ledger_entry_id: string;
  revision: number;
  supersedes_record_id: string | null;
  recorded_at: string;
  change_note: string | null;
  entry: LedgerEntry;
}

/** Current-state view of an entry (latest revision) plus ledger metadata. */
export interface LedgerEntryView {
  ledger_entry_id: string;
  created_at: string;
  updated_at: string;
  revision: number;
  entry: LedgerEntry;
}

/** Editable draft: enum fields stay plain strings until validated at save. */
export interface LedgerEntryDraft {
  baseline_run_id: string;
  canonical_player_id: string | null;
  display_name: string;
  observed_at: string;
  event_type: string;
  observations: string[];
  inferences: string[];
  forecast_pressure: string;
  confidence: string;
  status: string;
  source_refs: LedgerSourceRef[];
  forecast_player_row_ref: string | null;
  rookies_profile_ref: string | null;
  rookies_profile_status: string;
  limitations: string[];
  open_questions: string[];
  unrecognized_fields: LedgerUnrecognizedField[];
}

export function emptyLedgerEntryDraft(): LedgerEntryDraft {
  return {
    baseline_run_id: '',
    canonical_player_id: null,
    display_name: '',
    observed_at: '',
    event_type: '',
    observations: [],
    inferences: [],
    forecast_pressure: '',
    confidence: '',
    status: 'candidate_operator_observation',
    source_refs: [],
    forecast_player_row_ref: null,
    rookies_profile_ref: null,
    rookies_profile_status: 'missing',
    limitations: [],
    open_questions: [],
    unrecognized_fields: [],
  };
}

export interface ParsedLedgerPaste {
  draft: LedgerEntryDraft;
  warnings: string[];
}

type RawValue = string | string[] | Record<string, string>;

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

interface RawParseResult {
  fields: { key: string; value: RawValue }[];
  warnings: string[];
}

/** Line-based deterministic parse of the pasted YAML-like text. */
export function parseRawLedgerText(text: string): RawParseResult {
  const fields: { key: string; value: RawValue }[] = [];
  const warnings: string[] = [];
  let current: { key: string; value: RawValue } | null = null;

  const lines = text.replace(/\r\n/g, '\n').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const content = line.trim();
    if (!content || content.startsWith('#') || content === '---' || content === '```' || content.startsWith('```')) {
      continue;
    }
    const indent = line.length - line.trimStart().length;

    if (content.startsWith('- ')) {
      if (!current) {
        warnings.push(`Line ${i + 1}: list item has no preceding field and was ignored: "${content}"`);
        continue;
      }
      if (typeof current.value === 'string' && current.value !== '') {
        warnings.push(`Line ${i + 1}: list item under scalar field "${current.key}" was ignored: "${content}"`);
        continue;
      }
      if (!Array.isArray(current.value)) current.value = [];
      current.value.push(stripQuotes(content.slice(2)));
      continue;
    }

    const kv = content.match(/^([A-Za-z0-9_][A-Za-z0-9_ .\-/]*):\s*(.*)$/);
    if (!kv) {
      warnings.push(`Line ${i + 1}: could not parse "${content}"; line preserved as unrecognized field`);
      fields.push({ key: `_unparsed_line_${i + 1}`, value: content });
      continue;
    }

    const key = kv[1].trim().toLowerCase().replace(/[\s.\-/]+/g, '_');
    const rest = kv[2];

    if (indent > 0 && current && typeof current.value === 'object' && !Array.isArray(current.value)) {
      (current.value as Record<string, string>)[key] = stripQuotes(rest);
      continue;
    }
    if (indent > 0 && current && Array.isArray(current.value) && current.value.length === 0) {
      // First indented child of an open key decides its shape: nested map.
      current.value = { [key]: stripQuotes(rest) };
      continue;
    }

    current = { key, value: rest.trim() === '' ? [] : stripQuotes(rest) };
    fields.push(current);
  }

  return { fields, warnings };
}

function asList(value: RawValue): string[] {
  if (Array.isArray(value)) return value.filter((item) => item.trim() !== '');
  if (typeof value === 'string') return value.trim() === '' ? [] : [value];
  return Object.entries(value).map(([k, v]) => `${k}: ${v}`);
}

function asScalar(value: RawValue): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join('; ');
  return Object.entries(value)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');
}

const FIELD_ALIASES: Record<string, string> = {
  player: 'display_name',
  player_name: 'display_name',
  display_name: 'display_name',
  baseline_run: 'baseline_run_id',
  baseline_run_id: 'baseline_run_id',
  baseline: 'baseline_run_id',
  event_type: 'event_type',
  event: 'event_type',
  observed: 'observations',
  observations: 'observations',
  observation: 'observations',
  inference: 'inferences',
  inferences: 'inferences',
  forecast_pressure: 'forecast_pressure',
  pressure: 'forecast_pressure',
  confidence: 'confidence',
  status: 'status',
  observed_at: 'observed_at',
  date: 'observed_at',
  source: 'source_refs',
  sources: 'source_refs',
  source_refs: 'source_refs',
  source_urls: 'source_refs',
  limitations: 'limitations',
  limitation: 'limitations',
  open_questions: 'open_questions',
  notes: 'open_questions',
  canonical_player_id: 'canonical_player_id',
  player_id: 'canonical_player_id',
  gsis_id: 'canonical_player_id',
};

function isEnumValue(value: string, allowed: readonly string[]): boolean {
  return allowed.includes(value);
}

function normalizeEnumCandidate(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Map pasted text into an editable draft. Faithful by construction:
 * - unknown keys land in `unrecognized_fields`, never dropped;
 * - enum-typed fields keep only recognized values, with the raw value
 *   preserved as unrecognized + warned when it does not match;
 * - nothing missing is filled in (except the documented intake default
 *   status of `candidate_operator_observation` when none was supplied).
 */
export function parseLedgerPaste(text: string): ParsedLedgerPaste {
  const raw = parseRawLedgerText(text);
  const draft = emptyLedgerEntryDraft();
  const warnings = [...raw.warnings];

  const preserve = (key: string, value: RawValue) => {
    draft.unrecognized_fields.push({
      key,
      value: Array.isArray(value) ? value : asScalar(value),
    });
  };

  const takeEnum = (
    field: 'event_type' | 'forecast_pressure' | 'confidence' | 'status',
    key: string,
    value: RawValue,
    allowed: readonly string[],
  ) => {
    const candidate = normalizeEnumCandidate(asScalar(value));
    if (isEnumValue(candidate, allowed)) {
      draft[field] = candidate;
    } else {
      warnings.push(
        `"${key}: ${asScalar(value)}" is not a recognized ${field} value (expected one of: ${allowed.join(', ')}). ` +
          'The raw value was preserved as an unrecognized field; choose a contract value explicitly.',
      );
      preserve(key, value);
    }
  };

  for (const { key, value } of raw.fields) {
    const target = FIELD_ALIASES[key];
    switch (target) {
      case 'display_name':
        draft.display_name = asScalar(value);
        break;
      case 'baseline_run_id':
        draft.baseline_run_id = asScalar(value);
        break;
      case 'observed_at':
        draft.observed_at = asScalar(value);
        break;
      case 'canonical_player_id':
        draft.canonical_player_id = asScalar(value) || null;
        break;
      case 'event_type':
        takeEnum('event_type', key, value, LEDGER_EVENT_TYPES);
        break;
      case 'forecast_pressure':
        takeEnum('forecast_pressure', key, value, FORECAST_PRESSURES);
        break;
      case 'confidence':
        takeEnum('confidence', key, value, CONFIDENCE_LEVELS);
        break;
      case 'status':
        takeEnum('status', key, value, LEDGER_STATUSES);
        break;
      case 'observations':
        draft.observations = [...draft.observations, ...asList(value)];
        break;
      case 'inferences':
        draft.inferences = [...draft.inferences, ...asList(value)];
        break;
      case 'limitations':
        draft.limitations = [...draft.limitations, ...asList(value)];
        break;
      case 'open_questions':
        draft.open_questions = [...draft.open_questions, ...asList(value)];
        break;
      case 'source_refs':
        draft.source_refs = [
          ...draft.source_refs,
          ...asList(value).map((ref) => ({ ref, note: null, verified: false })),
        ];
        break;
      default:
        preserve(key, value);
        break;
    }
  }

  if (!draft.status) {
    draft.status = 'candidate_operator_observation';
  }
  if (draft.observed_at === '') {
    warnings.push('observed_at was not supplied; enter the observation timestamp before saving.');
  }
  if (!draft.canonical_player_id && draft.display_name) {
    warnings.push(
      `Canonical player identity for "${draft.display_name}" is unresolved. Use player search to attach a canonical ID, or save with identity_status=unresolved.`,
    );
  }

  return { draft, warnings };
}

export interface LedgerValidationResult {
  errors: string[];
  warnings: string[];
}

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function isValidObservedAt(value: string): boolean {
  if (!value) return false;
  if (ISO_DATE_ONLY.test(value)) return true;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed);
}

/** Contract validation. Errors block save; warnings inform the operator. */
export function validateLedgerDraft(draft: LedgerEntryDraft): LedgerValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!draft.baseline_run_id.trim()) errors.push('baseline_run_id is required — the entry must link to an exact Forecast baseline run.');
  if (!draft.display_name.trim()) errors.push('player display_name is required.');
  if (!isValidObservedAt(draft.observed_at)) errors.push('observed_at is required and must be a valid date/timestamp.');
  if (!isEnumValue(draft.event_type, LEDGER_EVENT_TYPES)) {
    errors.push(`event_type must be one of: ${LEDGER_EVENT_TYPES.join(', ')}.`);
  }
  if (draft.observations.filter((o) => o.trim() !== '').length === 0) {
    errors.push('observations must be a non-empty list.');
  }
  if (!isEnumValue(draft.forecast_pressure, FORECAST_PRESSURES)) {
    errors.push(`forecast_pressure must be one of: ${FORECAST_PRESSURES.join(', ')}.`);
  }
  if (!isEnumValue(draft.confidence, CONFIDENCE_LEVELS)) {
    errors.push(`confidence must be one of: ${CONFIDENCE_LEVELS.join(', ')}.`);
  }
  if (!isEnumValue(draft.status, LEDGER_STATUSES)) {
    errors.push(`status must be one of: ${LEDGER_STATUSES.join(', ')}.`);
  }
  if (!isEnumValue(draft.rookies_profile_status, ROOKIES_PROFILE_STATUSES)) {
    errors.push(`rookies_profile_status must be one of: ${ROOKIES_PROFILE_STATUSES.join(', ')}.`);
  }

  if (draft.source_refs.length === 0) {
    warnings.push('No source references attached — the entry will be recorded as an uncorroborated operator observation.');
  }
  if (draft.source_refs.some((ref) => ref.verified)) {
    warnings.push('Source refs are recorded as unverified at intake; verification is a separate corroboration step.');
  }
  if (draft.confidence === 'high' && draft.source_refs.length <= 1 && draft.status === 'candidate_operator_observation') {
    warnings.push('High confidence with at most one source — isolated highlights and coach speak should default to low confidence / corroboration_pending.');
  }

  return { errors, warnings };
}

/** Build the immutable entry payload from a validated draft. */
export function draftToEntry(draft: LedgerEntryDraft): LedgerEntry {
  const canonical = draft.canonical_player_id?.trim() || null;
  return {
    baseline_run_id: draft.baseline_run_id.trim(),
    player_ref: {
      canonical_player_id: canonical,
      display_name: draft.display_name.trim(),
      identity_status: canonical ? 'resolved' : 'unresolved',
    },
    observed_at: draft.observed_at.trim(),
    event_type: draft.event_type as LedgerEventType,
    observations: draft.observations.map((o) => o.trim()).filter(Boolean),
    inferences: draft.inferences.map((o) => o.trim()).filter(Boolean),
    forecast_pressure: draft.forecast_pressure as ForecastPressure,
    confidence: draft.confidence as ConfidenceLevel,
    status: draft.status as LedgerStatus,
    // Intake never marks a source as verified, whatever the draft claims.
    source_refs: draft.source_refs
      .filter((ref) => ref.ref.trim() !== '')
      .map((ref) => ({ ref: ref.ref.trim(), note: ref.note, verified: false })),
    linked_artifacts: {
      forecast_player_row_ref: draft.forecast_player_row_ref?.trim() || null,
      rookies_profile_ref: draft.rookies_profile_ref?.trim() || null,
      rookies_profile_status: draft.rookies_profile_status as RookiesProfileStatus,
    },
    limitations: draft.limitations.map((o) => o.trim()).filter(Boolean),
    open_questions: draft.open_questions.map((o) => o.trim()).filter(Boolean),
    unrecognized_fields: draft.unrecognized_fields,
  };
}

/** Convert a saved entry back into an editable draft (for revisions). */
export function entryToDraft(entry: LedgerEntry): LedgerEntryDraft {
  return {
    baseline_run_id: entry.baseline_run_id,
    canonical_player_id: entry.player_ref.canonical_player_id,
    display_name: entry.player_ref.display_name,
    observed_at: entry.observed_at,
    event_type: entry.event_type,
    observations: [...entry.observations],
    inferences: [...entry.inferences],
    forecast_pressure: entry.forecast_pressure,
    confidence: entry.confidence,
    status: entry.status,
    source_refs: entry.source_refs.map((ref) => ({ ...ref })),
    forecast_player_row_ref: entry.linked_artifacts.forecast_player_row_ref,
    rookies_profile_ref: entry.linked_artifacts.rookies_profile_ref,
    rookies_profile_status: entry.linked_artifacts.rookies_profile_status,
    limitations: [...entry.limitations],
    open_questions: [...entry.open_questions],
    unrecognized_fields: entry.unrecognized_fields.map((field) => ({ ...field })),
  };
}
