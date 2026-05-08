export type OperatorSignalNoteEntity = {
  label: string;
  entity_type: 'division' | 'team_or_context' | 'unresolved_context';
  extraction_confidence: 'heuristic';
};

export type OperatorSignalNoteMetric = {
  metric_id: string;
  matched_text: string;
  extraction_confidence: 'heuristic';
};

export type OperatorSignalNoteV0 = {
  note_id: string;
  source_type: 'operator_entered_note';
  raw_note: string;
  created_at: string;
  entities: OperatorSignalNoteEntity[];
  detected_metrics: OperatorSignalNoteMetric[];
  signal_tags: string[];
  reasoning_status: 'requires_followup';
  required_followups: string[];
  do_not_apply: string[];
  uncertainty: string[];
  interpretation_summary: string;
};

const DEFAULT_DO_NOT_APPLY = [
  'Do not mutate rankings from this note alone.',
  'Do not treat operator notes as verified source truth.',
  'Do not fabricate missing context.',
];

const DEFAULT_UNCERTAINTY = [
  'Automated parsing is not implemented in v0.',
  'Source verification is required before downstream application.',
];

const DEFAULT_FOLLOWUPS = [
  'Resolve player, team, and game context against canonical TIBER-Data identifiers.',
  'Verify claimed observations against governed source metadata before downstream use.',
  'Decide whether any extracted hypothesis belongs in a future promoted artifact lane.',
];

const METRIC_HEURISTICS: Array<{
  pattern: RegExp;
  metric_id: string;
  matched_text: string;
  tag: string;
}> = [
  { pattern: /EPA\s*\/\s*Play/i, metric_id: 'epa_per_play', matched_text: 'EPA/Play', tag: 'epa_context_signal' },
  { pattern: /Catchable\s+Target|catchable/i, metric_id: 'catchable_target_rate', matched_text: 'catchable target', tag: 'target_quality_signal' },
  { pattern: /\broute\b/i, metric_id: 'route_participation', matched_text: 'route', tag: 'route_role_signal' },
  { pattern: /target\s+share/i, metric_id: 'target_share', matched_text: 'target share', tag: 'usage_signal' },
];

const TAG_HEURISTICS: Array<{
  pattern: RegExp;
  tag: string;
}> = [
  { pattern: /Red\s+Zone/i, tag: 'red_zone_context' },
  { pattern: /\bdivision\b|\b[AN]FC\s+North\b/i, tag: 'division_strength_context' },
];

const DIVISION_PATTERNS = [/\bNFC\s+North\b/i, /\bAFC\s+North\b/i];

function stableHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function stableCreatedAt(noteHash: number): string {
  const base = Date.UTC(2026, 0, 1, 0, 0, 0, 0);
  const secondsInYear = 366 * 24 * 60 * 60;
  return new Date(base + (noteHash % secondsInYear) * 1000).toISOString();
}

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values));
}

function detectEntities(note: string): OperatorSignalNoteEntity[] {
  const entities: OperatorSignalNoteEntity[] = [];

  for (const pattern of DIVISION_PATTERNS) {
    const match = note.match(pattern);
    if (match?.[0]) {
      entities.push({
        label: match[0],
        entity_type: 'division',
        extraction_confidence: 'heuristic',
      });
    }
  }

  if (/\bdivision\b/i.test(note) && entities.length === 0) {
    entities.push({
      label: 'division context',
      entity_type: 'unresolved_context',
      extraction_confidence: 'heuristic',
    });
  }

  return entities;
}

export function buildMockOperatorSignalNoteArtifact(rawNote: string): OperatorSignalNoteV0 {
  const normalizedNote = rawNote.trim();
  const noteForHash = normalizedNote || 'empty-operator-note';
  const noteHash = stableHash(noteForHash);
  const detectedMetrics = METRIC_HEURISTICS.filter((heuristic) => heuristic.pattern.test(normalizedNote)).map((heuristic) => ({
    metric_id: heuristic.metric_id,
    matched_text: heuristic.matched_text,
    extraction_confidence: 'heuristic' as const,
  }));
  const signalTags = uniqueValues([
    ...METRIC_HEURISTICS.filter((heuristic) => heuristic.pattern.test(normalizedNote)).map((heuristic) => heuristic.tag),
    ...TAG_HEURISTICS.filter((heuristic) => heuristic.pattern.test(normalizedNote)).map((heuristic) => heuristic.tag),
    normalizedNote ? 'operator_hypothesis' : 'empty_note',
  ]);

  const interpretationSummary = normalizedNote
    ? `Mock v0 artifact: TIBER can preserve the raw note and flag ${detectedMetrics.length} conservative metric cue${detectedMetrics.length === 1 ? '' : 's'} plus ${signalTags.length} signal tag${signalTags.length === 1 ? '' : 's'}. This is hypothesis scaffolding only and still requires source verification.`
    : 'Mock v0 artifact: no operator note text was provided. TIBER can only emit guardrails, uncertainty, and follow-up requirements.';

  return {
    note_id: `operator_signal_note_v0_${noteHash.toString(16).padStart(8, '0')}`,
    source_type: 'operator_entered_note',
    raw_note: normalizedNote,
    created_at: stableCreatedAt(noteHash),
    entities: detectEntities(normalizedNote),
    detected_metrics: detectedMetrics,
    signal_tags: signalTags,
    reasoning_status: 'requires_followup',
    required_followups: DEFAULT_FOLLOWUPS,
    do_not_apply: DEFAULT_DO_NOT_APPLY,
    uncertainty: DEFAULT_UNCERTAINTY,
    interpretation_summary: interpretationSummary,
  };
}
