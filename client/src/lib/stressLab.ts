export type OperatorSignalNoteEntity = {
  label: string;
  entity_type: "player" | "team" | "division" | "season";
};

export type OperatorSignalNoteMetric = {
  metric: string;
  value: number | string | null;
  unit: string | null;
  context: string;
  confidence: "heuristic";
  sample_filter: string;
};

export type SuggestedTiberHandoff = {
  repo: string;
  domain: string;
  reason: string;
  status: "suggested only";
  next_check: string;
};

export type OperatorSignalNoteV0 = {
  note_id: string;
  source_type: "operator_entered_note";
  raw_note: string;
  created_at: string;
  entities: OperatorSignalNoteEntity[];
  detected_metrics: OperatorSignalNoteMetric[];
  signal_tags: string[];
  reasoning_status: "requires_followup";
  required_followups: string[];
  do_not_apply: string[];
  uncertainty: string[];
  interpretation_summary: string;
};

const DEFAULT_DO_NOT_APPLY = [
  "Do not mutate rankings from this note alone.",
  "Do not treat operator notes as verified source truth.",
  "Do not fabricate missing context.",
];

const DEFAULT_UNCERTAINTY = [
  "Automated parsing is not implemented in v0.",
  "Source verification is required before downstream application.",
];

const DEFAULT_FOLLOWUPS = [
  "Resolve player, team, and game context against canonical TIBER-Data identifiers.",
  "Verify claimed observations against governed source metadata before downstream use.",
  "Decide whether any extracted hypothesis belongs in a future promoted artifact lane.",
];

const METRIC_HEURISTICS: Array<{
  pattern: RegExp;
  metric: string;
  matchedText: string;
  context: string;
  tag: string;
}> = [
  {
    pattern: /\bteamstate\b/i,
    metric: "teamstate_context",
    matchedText: "teamstate",
    context:
      "Operator note mentions teamstate context; no teamstate value is parsed in v0.",
    tag: "teamstate_context",
  },
  {
    pattern: /offensive\s+environment/i,
    metric: "offensive_environment",
    matchedText: "offensive environment",
    context:
      "Operator note mentions offensive environment context; no environment score is parsed in v0.",
    tag: "offensive_environment_signal",
  },
  {
    pattern: /draft\s+capital|first\s+round|premium\s+picks/i,
    metric: "draft_capital_context",
    matchedText: "draft capital / first round / premium picks",
    context:
      "Operator note mentions draft capital context; no draft asset value is parsed in v0.",
    tag: "draft_capital_signal",
  },
  {
    pattern: /\binsulation\b/i,
    metric: "player_insulation",
    matchedText: "insulation",
    context:
      "Operator note mentions player insulation context; no protection value is parsed in v0.",
    tag: "player_insulation_signal",
  },
  {
    pattern: /regime\s+volatility/i,
    metric: "regime_volatility",
    matchedText: "regime volatility",
    context:
      "Operator note mentions regime volatility; no risk value is parsed in v0.",
    tag: "regime_volatility_risk",
  },
  {
    pattern: /unknown\s+offensive\s+efficiency|offensive\s+efficiency/i,
    metric: "offensive_efficiency",
    matchedText: "unknown offensive efficiency",
    context:
      "Operator note mentions offensive efficiency uncertainty; no efficiency value is parsed in v0.",
    tag: "offensive_efficiency_uncertainty",
  },
  {
    pattern: /EPA\s*\/\s*Play/i,
    metric: "epa_per_play",
    matchedText: "EPA/Play",
    context:
      "Operator note mentions EPA/Play; no numeric value is parsed in v0.",
    tag: "epa_context_signal",
  },
  {
    pattern: /Catchable\s+Target|catchable/i,
    metric: "catchable_target_rate",
    matchedText: "catchable target",
    context:
      "Operator note mentions catchable target context; no rate value is parsed in v0.",
    tag: "target_quality_signal",
  },
  {
    pattern: /\broute\b/i,
    metric: "route_participation",
    matchedText: "route",
    context:
      "Operator note mentions route context; no route participation value is parsed in v0.",
    tag: "route_role_signal",
  },
  {
    pattern: /target\s+share/i,
    metric: "target_share",
    matchedText: "target share",
    context:
      "Operator note mentions target share; no share value is parsed in v0.",
    tag: "usage_signal",
  },
];

const TAG_HEURISTICS: Array<{
  pattern: RegExp;
  tag: string;
}> = [
  { pattern: /Red\s+Zone/i, tag: "red_zone_context" },
  {
    pattern: /\bdivision\b|\b[AN]FC\s+North\b/i,
    tag: "division_strength_context",
  },
  { pattern: /extended|extension/i, tag: "contract_extension_signal" },
  { pattern: /\bsigned\b/i, tag: "free_agent_or_qb_change_signal" },
  { pattern: /traded|\btrade\b/i, tag: "trade_context_signal" },
  {
    pattern: /organizational\s+coherence/i,
    tag: "organizational_coherence_signal",
  },
  { pattern: /environment\s+rebound/i, tag: "environment_rebound_candidate" },
  {
    pattern: /defensive\s+talent\s+teardown|\bteardown\b/i,
    tag: "defensive_teardown_risk",
  },
];

const DIVISION_PATTERNS = [/\bNFC\s+North\b/i, /\bAFC\s+North\b/i];
const SEASON_PATTERN = /\b20\d{2}\b/;
const TEAM_PATTERNS = [/\bNew\s+York\s+Jets\b/i, /\bJets\b/i];
const PLAYER_PATTERNS = [
  /\bBreece\s+Hall\b/i,
  /\bGarrett\s+Wilson\b/i,
  /\bGeno\s+Smith\b/i,
  /\bT[’']?Vondre\s+Sweat\b/i,
  /\bSauce\s+Gardner\b/i,
  /\bQuinnen\s+Williams\b/i,
];
const TRANSACTION_OR_TEAMSTATE_PATTERN =
  /extended|extension|\bsigned\b|traded|\btrade\b|draft\s+capital|first\s+round|premium\s+picks|\bteamstate\b/i;

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

function addEntity(
  entities: OperatorSignalNoteEntity[],
  label: string,
  entityType: OperatorSignalNoteEntity["entity_type"],
): void {
  if (
    !entities.some(
      (entity) =>
        entity.entity_type === entityType &&
        entity.label.toLocaleLowerCase() === label.toLocaleLowerCase(),
    )
  ) {
    entities.push({
      label,
      entity_type: entityType,
    });
  }
}

function detectEntities(note: string): OperatorSignalNoteEntity[] {
  const entities: OperatorSignalNoteEntity[] = [];

  for (const pattern of TEAM_PATTERNS) {
    const match = note.match(pattern);
    if (match?.[0]) {
      addEntity(entities, match[0], "team");
    }
  }

  for (const pattern of PLAYER_PATTERNS) {
    const match = note.match(pattern);
    if (match?.[0]) {
      addEntity(entities, match[0], "player");
    }
  }

  for (const pattern of DIVISION_PATTERNS) {
    const match = note.match(pattern);
    if (match?.[0]) {
      addEntity(entities, match[0], "division");
    }
  }

  const seasonMatch = note.match(SEASON_PATTERN);
  if (seasonMatch?.[0]) {
    addEntity(entities, seasonMatch[0], "season");
  }

  return entities;
}

function buildRequiredFollowups(note: string): string[] {
  const followups = [...DEFAULT_FOLLOWUPS];

  if (TRANSACTION_OR_TEAMSTATE_PATTERN.test(note)) {
    followups.push(
      "Verify transactions against governed source metadata.",
      "Check whether Teamstate has current offensive environment data for the referenced team.",
      "Check whether downstream fantasy modules already represent QB/environment changes.",
      "Preserve this as hypothesis scaffolding until source truth and season window are verified.",
    );
  }

  return followups;
}

const TIBER_DATA_SIGNAL_TAGS = new Set([
  "contract_extension_signal",
  "free_agent_or_qb_change_signal",
  "trade_context_signal",
  "draft_capital_signal",
]);

const TIBER_TEAMSTATE_SIGNAL_TAGS = new Set([
  "teamstate_context",
  "offensive_environment_signal",
  "regime_volatility_risk",
  "defensive_teardown_risk",
  "organizational_coherence_signal",
]);

const TIBER_FORGE_SIGNAL_TAGS = new Set([
  "player_insulation_signal",
  "offensive_environment_signal",
  "environment_rebound_candidate",
  "offensive_efficiency_uncertainty",
]);

const ROLE_OPPORTUNITY_SIGNAL_TAGS = new Set([
  "route_role_signal",
  "usage_signal",
  "target_quality_signal",
  "red_zone_context",
]);

function hasAnySignalTag(
  artifact: OperatorSignalNoteV0,
  signalTags: Set<string>,
): boolean {
  return artifact.signal_tags.some((tag) => signalTags.has(tag));
}

function buildUncertainty(
  note: string,
  entities: OperatorSignalNoteEntity[],
): string[] {
  const uncertainty = [...DEFAULT_UNCERTAINTY];

  if (
    /\bdivision\b/i.test(note) &&
    !entities.some((entity) => entity.entity_type === "division")
  ) {
    uncertainty.push(
      "Division context was mentioned, but no contract-supported division entity was resolved by v0 heuristics.",
    );
  }

  if (entities.some((entity) => entity.entity_type === "player")) {
    uncertainty.push(
      "Player names were detected heuristically but canonical IDs were not resolved in v0.",
    );
  }

  if (entities.some((entity) => entity.entity_type === "team")) {
    uncertainty.push(
      "Team was detected heuristically; canonical team ID resolution is not implemented in v0.",
    );
  }

  if (TRANSACTION_OR_TEAMSTATE_PATTERN.test(note)) {
    uncertainty.push(
      "Transaction claims require source verification before downstream use.",
    );
  }

  return uncertainty;
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

function flattenValues(values: string[]): string {
  return values.join("|");
}

export function buildSuggestedTiberHandoffs(
  artifact: OperatorSignalNoteV0,
): SuggestedTiberHandoff[] {
  const handoffs: SuggestedTiberHandoff[] = [];
  const addHandoff = (handoff: Omit<SuggestedTiberHandoff, "status">) => {
    handoffs.push({
      ...handoff,
      status: "suggested only",
    });
  };

  if (
    artifact.entities.some((entity) =>
      ["player", "team", "season"].includes(entity.entity_type),
    ) ||
    hasAnySignalTag(artifact, TIBER_DATA_SIGNAL_TAGS) ||
    /source verification|source metadata|roster|identity/i.test(
      artifact.raw_note,
    )
  ) {
    addHandoff({
      repo: "TIBER-Data",
      domain: "truth/contracts",
      reason:
        "Canonical player/team IDs, roster truth, transaction source refs, temporal validity, and contract verification.",
      next_check:
        "Verify entities and transactions against governed TIBER-Data artifacts before downstream interpretation.",
    });
  }

  if (hasAnySignalTag(artifact, TIBER_TEAMSTATE_SIGNAL_TAGS)) {
    addHandoff({
      repo: "TIBER-Teamstate",
      domain: "team interpretation",
      reason:
        "Team-environment interpretation from source-backed TIBER-Data roster/transaction truth.",
      next_check:
        "Inspect whether Teamstate has current environment context for the referenced team and season window.",
    });
  }

  if (hasAnySignalTag(artifact, TIBER_FORGE_SIGNAL_TAGS)) {
    addHandoff({
      repo: "TIBER-FORGE",
      domain: "fantasy signal/scoring",
      reason:
        "Fantasy signal/scoring impact once source truth and team context are verified.",
      next_check:
        "Inspect whether FORGE already accounts for the relevant environment or insulation signal before changing any score.",
    });
  }

  if (hasAnySignalTag(artifact, ROLE_OPPORTUNITY_SIGNAL_TAGS)) {
    addHandoff({
      repo: "Role & Opportunity",
      domain: "usage/role signal",
      reason:
        "Player usage, role, route, target quality, and opportunity-context evaluation.",
      next_check:
        "Inspect whether role/opportunity artifacts contain matching player-season usage context.",
    });
  }

  if (
    artifact.signal_tags.includes("operator_hypothesis") ||
    artifact.note_id
  ) {
    addHandoff({
      repo: "TIBER-Fantasy / Stress Lab",
      domain: "user-facing inspection/synthesis",
      reason:
        "Preserve hypothesis, uncertainty, guardrails, and operator-facing review/export loop.",
      next_check:
        "Export artifact for review and decide whether a follow-up contract or promoted lane is needed.",
    });
  }

  return handoffs;
}

export function serializeOperatorSignalNoteArtifactToCsv(
  artifact: OperatorSignalNoteV0,
): string {
  const columns = [
    "note_id",
    "created_at",
    "source_type",
    "reasoning_status",
    "raw_note",
    "interpretation_summary",
    "entities",
    "detected_metrics",
    "signal_tags",
    "required_followups",
    "uncertainty",
    "do_not_apply",
  ];
  const entities = artifact.entities.map(
    (entity) => `${entity.label}:${entity.entity_type}`,
  );
  const detectedMetrics = artifact.detected_metrics.map((metric) => {
    const value = metric.value ?? "";
    const unit = metric.unit ?? "";
    return `${metric.metric}:${metric.confidence}:${value}:${unit}:${metric.context}:sample_filter=${metric.sample_filter}`;
  });
  const row = [
    artifact.note_id,
    artifact.created_at,
    artifact.source_type,
    artifact.reasoning_status,
    artifact.raw_note,
    artifact.interpretation_summary,
    flattenValues(entities),
    flattenValues(detectedMetrics),
    flattenValues(artifact.signal_tags),
    flattenValues(artifact.required_followups),
    flattenValues(artifact.uncertainty),
    flattenValues(artifact.do_not_apply),
  ];

  return `${columns.join(",")}\n${row.map(csvEscape).join(",")}\n`;
}

export function buildMockOperatorSignalNoteArtifact(
  rawNote: string,
): OperatorSignalNoteV0 {
  const normalizedNote = rawNote.trim();
  const noteForHash = normalizedNote || "empty-operator-note";
  const noteHash = stableHash(noteForHash);
  const matchedMetricHeuristics = METRIC_HEURISTICS.filter((heuristic) =>
    heuristic.pattern.test(normalizedNote),
  );
  const detectedMetrics = Array.from(
    new Map(
      matchedMetricHeuristics.map((heuristic) => [
        heuristic.metric,
        {
          metric: heuristic.metric,
          value: null,
          unit: null,
          context: `${heuristic.context} Matched cue: ${heuristic.matchedText}.`,
          confidence: "heuristic" as const,
          sample_filter: "operator_note_keyword_match",
        },
      ]),
    ).values(),
  );
  const signalTags = uniqueValues([
    ...matchedMetricHeuristics.map((heuristic) => heuristic.tag),
    ...TAG_HEURISTICS.filter((heuristic) =>
      heuristic.pattern.test(normalizedNote),
    ).map((heuristic) => heuristic.tag),
    normalizedNote ? "operator_hypothesis" : "empty_note",
  ]);
  const entities = detectEntities(normalizedNote);

  const interpretationSummary = normalizedNote
    ? `Mock v0 artifact: TIBER can preserve the raw note and flag ${detectedMetrics.length} conservative metric cue${detectedMetrics.length === 1 ? "" : "s"} plus ${signalTags.length} signal tag${signalTags.length === 1 ? "" : "s"}. This is hypothesis scaffolding only and still requires source verification.`
    : "Mock v0 artifact: no operator note text was provided. TIBER can only emit guardrails, uncertainty, and follow-up requirements.";

  return {
    note_id: `operator_signal_note_v0_${noteHash.toString(16).padStart(8, "0")}`,
    source_type: "operator_entered_note",
    raw_note: normalizedNote,
    created_at: stableCreatedAt(noteHash),
    entities,
    detected_metrics: detectedMetrics,
    signal_tags: signalTags,
    reasoning_status: "requires_followup",
    required_followups: buildRequiredFollowups(normalizedNote),
    do_not_apply: DEFAULT_DO_NOT_APPLY,
    uncertainty: buildUncertainty(normalizedNote, entities),
    interpretation_summary: interpretationSummary,
  };
}
