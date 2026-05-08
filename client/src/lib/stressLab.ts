export type OperatorSignalNoteEntity = {
  label: string;
  entity_type: 'player' | 'team' | 'division' | 'season';
};

export type OperatorSignalNoteMetric = {
  metric: string;
  value: number | string | null;
  unit: string | null;
  context: string;
  confidence: 'heuristic';
  sample_filter: string;
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
  metric: string;
  matchedText: string;
  context: string;
  tag: string;
}> = [
  {
    pattern: /EPA\s*\/\s*Play/i,
    metric: 'epa_per_play',
    matchedText: 'EPA/Play',
    context: 'Operator note mentions EPA/Play; no numeric value is parsed in v0.',
    tag: 'epa_context_signal',
  },
  {
    pattern: /Catchable\s+Target|catchable/i,
    metric: 'catchable_target_rate',
    matchedText: 'catchable target',
    context: 'Operator note mentions catchable target context; no rate value is parsed in v0.',
    tag: 'target_quality_signal',
  },
  {
    pattern: /\broute\b/i,
    metric: 'route_participation',
    matchedText: 'route',
    context: 'Operator note mentions route context; no route participation value is parsed in v0.',
    tag: 'route_role_signal',
  },
  {
    pattern: /target\s+share/i,
    metric: 'target_share',
    matchedText: 'target share',
    context: 'Operator note mentions target share; no share value is parsed in v0.',
    tag: 'usage_signal',
  },
];

const TAG_HEURISTICS: Array<{
  pattern: RegExp;
  tag: string;
}> = [
  { pattern: /Red\s+Zone/i, tag: 'red_zone_context' },
  { pattern: /\bdivision\b|\b[AN]FC\s+North\b/i, tag: 'division_strength_context' },
];

const DIVISION_PATTERNS = [/\bNFC\s+North\b/i, /\bAFC\s+North\b/i];
const SEASON_PATTERN = /\b20\d{2}\b/;

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
      });
    }
  }

  const seasonMatch = note.match(SEASON_PATTERN);
  if (seasonMatch?.[0]) {
    entities.push({
      label: seasonMatch[0],
      entity_type: 'season',
    });
  }

  return entities;
}

function buildUncertainty(note: string, entities: OperatorSignalNoteEntity[]): string[] {
  const uncertainty = [...DEFAULT_UNCERTAINTY];

  if (/\bdivision\b/i.test(note) && !entities.some((entity) => entity.entity_type === 'division')) {
    uncertainty.push('Division context was mentioned, but no contract-supported division entity was resolved by v0 heuristics.');
  }

  return uncertainty;
}

export function buildMockOperatorSignalNoteArtifact(rawNote: string): OperatorSignalNoteV0 {
  const normalizedNote = rawNote.trim();
  const noteForHash = normalizedNote || 'empty-operator-note';
  const noteHash = stableHash(noteForHash);
  const matchedMetricHeuristics = METRIC_HEURISTICS.filter((heuristic) => heuristic.pattern.test(normalizedNote));
  const detectedMetrics = matchedMetricHeuristics.map((heuristic) => ({
    metric: heuristic.metric,
    value: null,
    unit: null,
    context: `${heuristic.context} Matched cue: ${heuristic.matchedText}.`,
    confidence: 'heuristic' as const,
    sample_filter: 'operator_note_keyword_match',
  }));
  const signalTags = uniqueValues([
    ...matchedMetricHeuristics.map((heuristic) => heuristic.tag),
    ...TAG_HEURISTICS.filter((heuristic) => heuristic.pattern.test(normalizedNote)).map((heuristic) => heuristic.tag),
    normalizedNote ? 'operator_hypothesis' : 'empty_note',
  ]);
  const entities = detectEntities(normalizedNote);

  const interpretationSummary = normalizedNote
    ? `Mock v0 artifact: TIBER can preserve the raw note and flag ${detectedMetrics.length} conservative metric cue${detectedMetrics.length === 1 ? '' : 's'} plus ${signalTags.length} signal tag${signalTags.length === 1 ? '' : 's'}. This is hypothesis scaffolding only and still requires source verification.`
    : 'Mock v0 artifact: no operator note text was provided. TIBER can only emit guardrails, uncertainty, and follow-up requirements.';

  return {
    note_id: `operator_signal_note_v0_${noteHash.toString(16).padStart(8, '0')}`,
    source_type: 'operator_entered_note',
    raw_note: normalizedNote,
    created_at: stableCreatedAt(noteHash),
    entities,
    detected_metrics: detectedMetrics,
    signal_tags: signalTags,
    reasoning_status: 'requires_followup',
    required_followups: DEFAULT_FOLLOWUPS,
    do_not_apply: DEFAULT_DO_NOT_APPLY,
    uncertainty: buildUncertainty(normalizedNote, entities),
    interpretation_summary: interpretationSummary,
  };
}
