/**
 * Observatory take-triage heuristics (internal/legacy name: "stressLab").
 *
 * v0 client-side scaffold: deterministic regex/keyword heuristics only. It makes
 * NO backend, DB, artifact, LLM, RAG, or external API calls. It produces an
 * `operator_signal_note_v0` artifact and *suggested* repo handoffs; it does not
 * read live TIBER signals or verify claims against real sources. See
 * client/src/pages/StressLab.tsx for the Observatory naming-boundary note (PR A, #264).
 */
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

export type TiberHandoffClaimClassification =
  | "truth_claim"
  | "team_interpretation"
  | "fantasy_implication"
  | "usage_role_signal"
  | "rookie_model_implication"
  | "operator_hypothesis";

export type SuggestedTiberHandoff = {
  repo: string;
  domain: string;
  reason: string;
  status: "suggested only";
  next_check: string;
  required_artifact_types: string[];
  claim_classification: TiberHandoffClaimClassification;
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

const TIBER_DATA_REQUIRED_ARTIFACT_TYPES = [
  "roster_snapshot_v0",
  "transaction_source_ref_v0",
  "canonical_player_identity_v0",
  "canonical_team_identity_v0",
];

const TIBER_TEAMSTATE_REQUIRED_ARTIFACT_TYPES = [
  "team_environment_snapshot_v0",
  "team_efficiency_context_v0",
  "offensive_environment_snapshot_v0",
  "roster_continuity_signal_v0",
  "qb_transition_context_v0",
  "regime_volatility_context_v0",
  "coaching_tendency_context_v0",
  "team_backfield_context_v0",
];

const TIBER_FORGE_REQUIRED_ARTIFACT_TYPES = [
  "player_fantasy_signal_snapshot_v0",
  "insulation_adjustment_signal_v0",
  "offensive_environment_adjustment_v0",
  "rb_insulation_risk_signal_v0",
  "dynasty_market_delta_context_v0",
];

const ROLE_OPPORTUNITY_REQUIRED_ARTIFACT_TYPES = [
  "role_opportunity_snapshot_v0",
  "route_participation_signal_v0",
  "target_quality_context_v0",
  "red_zone_usage_context_v0",
  "rb_receiving_role_snapshot_v0",
  "third_down_usage_context_v0",
  "backfield_committee_context_v0",
];

const TIBER_FANTASY_REQUIRED_ARTIFACT_TYPES = [
  "operator_signal_note_v0",
  "stress_lab_review_export_v0",
  "player_on_off_split_snapshot_v0",
];

const TIBER_ROOKIES_REQUIRED_ARTIFACT_TYPES = [
  "rookie_alpha_snapshot_v0",
  "rookie_prospect_profile_v0",
  "rookie_draft_capital_context_v0",
  "rookie_production_profile_v0",
  "rookie_landing_spot_context_v0",
];

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
    pattern: /\bADP\b/i,
    metric: "adp_market_context",
    matchedText: "ADP",
    context:
      "Operator note mentions ADP market context; no ADP value or source is parsed in v0.",
    tag: "adp_market_signal",
  },
  {
    pattern: /market\s+price|dynasty\s+market/i,
    metric: "dynasty_market_price",
    matchedText: "market price / dynasty market",
    context:
      "Operator note mentions dynasty market price context; no market value or source is parsed in v0.",
    tag: "dynasty_market_price_context",
  },
  {
    pattern: /\bdynasty\b/i,
    metric: "dynasty_market_price",
    matchedText: "dynasty",
    context:
      "Operator note mentions dynasty context; no dynasty market value is parsed or applied in v0.",
    tag: "dynasty_context",
  },
  {
    pattern: /receiving\s+(?:work|usage)/i,
    metric: "receiving_usage",
    matchedText: "receiving work / receiving usage",
    context:
      "Operator note mentions RB receiving usage context; no usage value is parsed in v0.",
    tag: "receiving_usage_signal",
  },
  {
    pattern: /receiving\s+(?:role|work|usage)/i,
    metric: "receiving_usage",
    matchedText: "receiving role / work / usage",
    context:
      "Operator note mentions receiving role context; no role value is parsed in v0.",
    tag: "receiving_role_context",
  },
  {
    pattern: /pass\s+protection/i,
    metric: "pass_protection",
    matchedText: "pass protection",
    context:
      "Operator note mentions pass protection risk; no pass-protection grade is parsed in v0.",
    tag: "pass_protection_risk",
  },
  {
    pattern: /explosive\s+traits/i,
    metric: "explosive_traits",
    matchedText: "explosive traits",
    context:
      "Operator note mentions explosive traits; no trait score is parsed in v0.",
    tag: "explosive_traits_signal",
  },
  {
    pattern: /role\s+stability/i,
    metric: "role_stability",
    matchedText: "role stability",
    context:
      "Operator note mentions role stability risk; no stability value is parsed in v0.",
    tag: "role_stability_risk",
  },
  {
    pattern: /third[-\s]?downs?|3rd\s+downs?/i,
    metric: "third_down_role",
    matchedText: "third downs / third-downs / 3rd downs",
    context:
      "Operator note mentions third-down role context; no usage value is parsed in v0.",
    tag: "third_down_role_context",
  },
  {
    pattern: /committee\s+(?:RB|back)|RB\s+room|backfield|committee/i,
    metric: "committee_context",
    matchedText: "committee RB / RB room / backfield / committee",
    context:
      "Operator note mentions RB role competition or committee context; no depth-chart value is parsed in v0.",
    tag: "committee_rb_context",
  },
  {
    pattern: /committee\s+(?:RB|back)|RB\s+room|backfield|committee/i,
    metric: "rb_role_competition",
    matchedText: "committee RB / RB room / backfield / committee",
    context:
      "Operator note mentions RB role competition context; no role-share value is parsed in v0.",
    tag: "rb_role_competition_context",
  },
  {
    pattern: /\bFORGE\b/i,
    metric: "forge_model_context",
    matchedText: "FORGE",
    context:
      "Operator note references FORGE model context; no FORGE output is queried or parsed in v0.",
    tag: "forge_model_reference",
  },
  {
    pattern: /Sean\s+Payton|\bcoach\b|trust/i,
    metric: "coaching_trust",
    matchedText: "Sean Payton / coach / trust",
    context:
      "Operator note mentions coaching trust context; no coach entity or trust value is emitted in v0.",
    tag: "coaching_trust_context",
  },
  {
    pattern: /\brookie\b/i,
    metric: "rookie_model_context",
    matchedText: "rookie",
    context:
      "Operator note mentions rookie context; no rookie model value is parsed in v0.",
    tag: "rookie_context",
  },
  {
    pattern: /prospect\s+capital|draft\s+capital/i,
    metric: "prospect_capital",
    matchedText: "prospect capital / draft capital",
    context:
      "Operator note mentions prospect or draft capital context; no capital value is parsed in v0.",
    tag: "prospect_capital_signal",
  },
  {
    pattern: /production\s+profile/i,
    metric: "production_profile",
    matchedText: "production profile",
    context:
      "Operator note mentions production profile context; no production value is parsed in v0.",
    tag: "production_profile_signal",
  },
  {
    pattern: /landing\s+spot/i,
    metric: "landing_spot_context",
    matchedText: "landing spot",
    context:
      "Operator note mentions landing spot context; no landing spot value is parsed in v0.",
    tag: "landing_spot_context",
  },
  {
    pattern: /early\s+role|role\s+opportunity/i,
    metric: "early_role_opportunity",
    matchedText: "early role / role opportunity",
    context:
      "Operator note mentions early role opportunity context; no role value is parsed in v0.",
    tag: "early_role_opportunity_signal",
  },
  {
    pattern: /dynasty\s+ranking/i,
    metric: "dynasty_ranking_context",
    matchedText: "dynasty ranking",
    context:
      "Operator note mentions dynasty ranking context; no ranking movement is parsed or applied in v0.",
    tag: "dynasty_ranking_movement_request",
  },
  {
    pattern: /rookie\s+model/i,
    metric: "rookie_model_context",
    matchedText: "rookie model",
    context:
      "Operator note references the rookie model; no model output is queried or parsed in v0.",
    tag: "rookie_model_reference",
  },
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
    pattern: /\bw\/?\s+[^\n:]+\s+on\s+the\s+field\s*:\s*[-+]?\d*\.?\d+\s+EPA\s*\/\s*Play/i,
    metric: "on_field_epa_per_play",
    matchedText: "with player on the field EPA/Play",
    context:
      "Operator note mentions on-field EPA/Play in an on/off split; no numeric value is parsed in v0.",
    tag: "player_on_field_context",
  },
  {
    pattern: /\bw\/?out\s+[^\n:]+\s*:\s*[-+]?\d*\.?\d+/i,
    metric: "off_field_epa_per_play",
    matchedText: "without player EPA/Play",
    context:
      "Operator note mentions off-field EPA/Play in an on/off split; no numeric value is parsed in v0.",
    tag: "player_off_field_context",
  },
  {
    pattern: /\bDelta\s*:\s*[-+]?\d+(?:\.\d+)?%/i,
    metric: "efficiency_delta_percentage",
    matchedText: "Delta percentage",
    context:
      "Operator note mentions an on/off efficiency delta percentage; no numeric value is parsed in v0.",
    tag: "efficiency_delta_signal",
  },
  {
    pattern: /\bon\/?off\b|\bw\/?\s+[^\n:]+\s+on\s+the\s+field|\bw\/?out\s+[^\n:]+/i,
    metric: "on_off_split_context",
    matchedText: "on/off split context",
    context:
      "Operator note appears to describe a player/team on-off efficiency split; no split value is parsed in v0.",
    tag: "on_off_split_context",
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
  { pattern: /team\s+environment/i, tag: "team_environment_signal" },
  {
    pattern: /defensive\s+talent\s+teardown|\bteardown\b/i,
    tag: "defensive_teardown_risk",
  },
  {
    pattern: /\bDelta\s*:\s*-|worse\s+with\s+[^.\n]+\s+on\s+the\s+field|worse\s+when\s+[^.\n]+\s+(?:is\s+)?on/i,
    tag: "counterintuitive_split_context",
  },
  {
    pattern: /EPA\s*\/\s*Play[\s\S]*(?:\bw\/?\s+[^\n:]+\s+on\s+the\s+field|\bw\/?out\s+[^\n:]+|\bDelta\s*:)|(?:\bw\/?\s+[^\n:]+\s+on\s+the\s+field|\bw\/?out\s+[^\n:]+|\bDelta\s*:)[\s\S]*EPA\s*\/\s*Play/i,
    tag: "team_efficiency_context",
  },
  {
    pattern: /EPA\s*\/\s*Play[\s\S]*(?:\bw\/?\s+[^\n:]+\s+on\s+the\s+field|\bw\/?out\s+[^\n:]+|\bDelta\s*:)|(?:\bw\/?\s+[^\n:]+\s+on\s+the\s+field|\bw\/?out\s+[^\n:]+|\bDelta\s*:)[\s\S]*EPA\s*\/\s*Play/i,
    tag: "epa_on_off_signal",
  },

  {
    pattern: /\bw\/?\s+[^\n:]+\s+on\s+the\s+field/i,
    tag: "player_on_field_context",
  },
  {
    pattern: /\bw\/?out\s+[^\n:]+/i,
    tag: "player_off_field_context",
  },
  {
    pattern: /\bDelta\s*:/i,
    tag: "efficiency_delta_signal",
  },
];

const DIVISION_PATTERNS = [/\bNFC\s+North\b/i, /\bAFC\s+North\b/i];
const SEASON_PATTERN = /\b20\d{2}\b/;
const TEAM_PATTERNS = [
  /\bDenver\b/i,
  /\bNew\s+York\s+Jets\b/i,
  /\bJets\b/i,
  /\bSan\s+Francisco\s+49ers\b/i,
  /\b49ers\b/i,
  /\bMinnesota\s+Vikings\b/i,
  /\bVikings\b/i,
];
const PLAYER_PATTERNS = [
  /\bRJ\s+Harvey\b/i,
  /\bBreece\s+Hall\b/i,
  /\bGarrett\s+Wilson\b/i,
  /\bGeno\s+Smith\b/i,
  /\bCMC\b/i,
  /\bChristian\s+McCaffrey\b/i,
  /\bJustin\s+Jefferson\b/i,
  /\bTetairoa\s+McMillan\b/i,
  /\bLuther\s+Burden\b/i,
  /\bTravis\s+Hunter\b/i,
  /\bT[’']?Vondre\s+Sweat\b/i,
  /\bSauce\s+Gardner\b/i,
  /\bQuinnen\s+Williams\b/i,
];
const TRANSACTION_CUE_PATTERN =
  /\btraded\b|\btrade\b|\bsigned\b|\bextension\b|\bextended\b|\bacquired\b|free\s+agent/i;

const TEAMSTATE_ENVIRONMENT_PATTERN =
  /offensive\s+environment|\bteamstate\b|regime\s+volatility|organizational\s+coherence|defensive(?:\s+talent)?\s+teardown|qb\s+change|environment\s+rebound|Sean\s+Payton|\bcoach\b|coaching|backfield|RB\s+room|EPA\s*\/\s*Play|on\/?off|\bw\/?\s+[^\n:]+\s+on\s+the\s+field|\bw\/?out\s+[^\n:]+|\bDelta\s*:/i;

const ON_OFF_SPLIT_PATTERN =
  /on\/?off|\bw\/?\s+[^\n:]+\s+on\s+the\s+field|\bw\/?out\s+[^\n:]+|\bDelta\s*:/i;

const COUNTERINTUITIVE_SPLIT_PATTERN =
  /\bDelta\s*:\s*-|worse\s+with\s+[^.\n]+\s+on\s+the\s+field|worse\s+when\s+[^.\n]+\s+(?:is\s+)?on/i;

const ROOKIE_CUE_PATTERN =
  /\brookie\b|prospect\s+capital|production\s+profile|landing\s+spot|team\s+environment|early\s+role|role\s+opportunity|dynasty\s+ranking|rookie\s+model/i;

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

  if (TRANSACTION_CUE_PATTERN.test(note)) {
    followups.push("Verify transactions against governed source metadata.");
  }

  if (TEAMSTATE_ENVIRONMENT_PATTERN.test(note)) {
    followups.push(
      "Check whether Teamstate has current offensive environment data for the referenced team.",
      "Check whether downstream fantasy modules already represent QB/environment changes.",
    );
  }

  if (/receiving\s+(?:work|usage|role)|third[-\s]?downs?|3rd\s+downs?|committee\s+(?:RB|back)|RB\s+room|backfield|role\s+opportunity/i.test(note)) {
    followups.push(
      "Check Role & Opportunity for receiving usage and third-down role.",
      "Preserve RB role claims as hypotheses until role/opportunity artifacts verify them.",
    );
  }

  if (/\bADP\b|market\s+price|dynasty\s+market|pass\s+protection|Sean\s+Payton|\bcoach\b|trust/i.test(note)) {
    followups.push(
      "Check FORGE for insulation risk and dynasty market delta.",
      "Preserve ADP/market notes as market context, not source truth.",
    );
  }

  if (ON_OFF_SPLIT_PATTERN.test(note)) {
    followups.push(
      "Verify on/off split source and sample window.",
      "Resolve player/team IDs through TIBER-Data.",
      "Check whether Teamstate has team efficiency context for the referenced season.",
      "Check whether FORGE already accounts for player environment dependency.",
      "Preserve counterintuitive splits as context-required, not automatic player blame.",
    );
  }

  if (
    TRANSACTION_CUE_PATTERN.test(note) ||
    TEAMSTATE_ENVIRONMENT_PATTERN.test(note)
  ) {
    followups.push(
      "Preserve this as hypothesis scaffolding until source truth and season window are verified.",
    );
  }

  if (ROOKIE_CUE_PATTERN.test(note)) {
    followups.push(
      "Check TIBER-Rookies for source-backed rookie model outputs.",
      "Resolve rookie player identities through TIBER-Data before comparison.",
      "Treat dynasty ranking movement as downstream interpretation, not raw rookie truth.",
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
  "coaching_trust_context",
  "rb_role_competition_context",
  "committee_rb_context",
  "regime_volatility_risk",
  "defensive_teardown_risk",
  "organizational_coherence_signal",
  "team_efficiency_context",
  "epa_on_off_signal",
  "on_off_split_context",
]);

const TIBER_FORGE_SIGNAL_TAGS = new Set([
  "player_insulation_signal",
  "offensive_environment_signal",
  "adp_market_signal",
  "dynasty_market_price_context",
  "dynasty_context",
  "pass_protection_risk",
  "role_stability_risk",
  "forge_model_reference",
  "rb_role_competition_context",
  "environment_rebound_candidate",
  "offensive_efficiency_uncertainty",
  "epa_on_off_signal",
  "efficiency_delta_signal",
  "counterintuitive_split_context",
  "team_efficiency_context",
]);

const ROLE_OPPORTUNITY_SIGNAL_TAGS = new Set([
  "route_role_signal",
  "usage_signal",
  "receiving_usage_signal",
  "receiving_role_context",
  "third_down_role_context",
  "committee_rb_context",
  "rb_role_competition_context",
  "target_quality_signal",
  "red_zone_context",
]);

const TIBER_ROOKIES_SIGNAL_TAGS = new Set([
  "rookie_context",
  "prospect_capital_signal",
  "production_profile_signal",
  "landing_spot_context",
  "team_environment_signal",
  "early_role_opportunity_signal",
  "dynasty_ranking_movement_request",
  "rookie_model_reference",
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

  if (
    ROOKIE_CUE_PATTERN.test(note) &&
    entities.some((entity) => entity.entity_type === "player")
  ) {
    uncertainty.push(
      "Rookie player names were detected heuristically but canonical IDs/model artifact links were not resolved in v0.",
    );
  }

  if (entities.some((entity) => entity.entity_type === "team")) {
    uncertainty.push(
      "Team was detected heuristically; canonical team ID resolution is not implemented in v0.",
    );
  }

  if (ON_OFF_SPLIT_PATTERN.test(note)) {
    uncertainty.push(
      "On/off splits may be sample-size sensitive and require source-window verification.",
    );
  }

  if (COUNTERINTUITIVE_SPLIT_PATTERN.test(note)) {
    uncertainty.push(
      "Negative on/off deltas require context before interpretation and are not automatic player blame.",
    );
  }

  if (/\bCMC\b/i.test(note)) {
    uncertainty.push(
      "CMC alias detected heuristically; canonical player ID is not resolved in v0.",
    );
  }

  if (TRANSACTION_CUE_PATTERN.test(note)) {
    uncertainty.push(
      "Transaction claims require source verification before downstream use.",
    );
  }

  if (/\bADP\b|market\s+price|dynasty\s+market/i.test(note)) {
    uncertainty.push(
      "ADP/market price can be source-sensitive and time-sensitive.",
    );
  }

  if (/receiving\s+(?:work|usage|role)|third[-\s]?downs?|3rd\s+downs?/i.test(note)) {
    uncertainty.push(
      "Receiving role claims require role/opportunity artifact verification.",
    );
  }

  if (/pass\s+protection|Sean\s+Payton|\bcoach\b|trust/i.test(note)) {
    uncertainty.push(
      "Pass protection and coaching trust are context-heavy and are not inferred from the note alone.",
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
      claim_classification: "truth_claim",
      required_artifact_types: TIBER_DATA_REQUIRED_ARTIFACT_TYPES,
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
      claim_classification: "team_interpretation",
      required_artifact_types: TIBER_TEAMSTATE_REQUIRED_ARTIFACT_TYPES,
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
      claim_classification: "fantasy_implication",
      required_artifact_types: TIBER_FORGE_REQUIRED_ARTIFACT_TYPES,
      reason:
        "Fantasy signal/scoring impact once source truth and team context are verified.",
      next_check:
        "Inspect whether FORGE already accounts for the relevant environment or insulation signal before changing any score.",
    });
  }

  if (hasAnySignalTag(artifact, TIBER_ROOKIES_SIGNAL_TAGS)) {
    addHandoff({
      repo: "TIBER-Rookies",
      domain: "rookie/prospect evaluation",
      claim_classification: "rookie_model_implication",
      required_artifact_types: TIBER_ROOKIES_REQUIRED_ARTIFACT_TYPES,
      reason:
        "Rookie prospect evaluation, draft capital, production profile, landing spot, and model comparison belong in TIBER-Rookies before downstream dynasty interpretation.",
      next_check:
        "Inspect whether TIBER-Rookies has source-backed prospect/model artifacts for the referenced players before any dynasty ranking movement.",
    });
  }

  if (hasAnySignalTag(artifact, ROLE_OPPORTUNITY_SIGNAL_TAGS)) {
    addHandoff({
      repo: "Role & Opportunity",
      domain: "usage/role signal",
      claim_classification: "usage_role_signal",
      required_artifact_types: ROLE_OPPORTUNITY_REQUIRED_ARTIFACT_TYPES,
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
      repo: "TIBER-Fantasy / Observatory",
      domain: "user-facing inspection/synthesis",
      claim_classification: "operator_hypothesis",
      required_artifact_types: TIBER_FANTASY_REQUIRED_ARTIFACT_TYPES,
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
