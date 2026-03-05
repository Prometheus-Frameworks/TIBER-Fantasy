/**
 * TIBER Canonical Intelligence Contract
 * ======================================
 * This is the single source of truth for all intelligence response shapes.
 *
 * All agent integrations, voice adapters, comparison routes, and trade routes
 * must converge toward these types. Voice and UI layers adapt from this contract
 * at their boundary — they do not define their own competing contracts.
 *
 * See INTELLIGENCE_API.md at the repo root for full design principles,
 * migration rules, and legacy surface map.
 */

// ─── Intent ─────────────────────────────────────────────────────────────────

/**
 * Canonical intent identifiers (lowercase snake_case).
 * NOTE: server/voice/types.ts uses SCREAMING_SNAKE variants for voice-scoped
 * routing. Those are adapter-layer values — this enum is the canonical form.
 */
export type TiberIntent =
  | "player_eval"
  | "comparison"
  | "trade_analysis"
  | "waiver_eval"
  | "start_sit";

// ─── Verdict Primitives ──────────────────────────────────────────────────────

/**
 * Who wins the verdict.
 * - "subject"  → single-player eval; the subject player is the answer
 * - "side_a"   → comparison/trade; side A holds the edge
 * - "side_b"   → comparison/trade; side B holds the edge
 * - "even"     → no meaningful edge either way
 * - "unknown"  → insufficient data to render a verdict
 */
export type VerdictWinner =
  | "subject"
  | "side_a"
  | "side_b"
  | "even"
  | "unknown";

/**
 * How decisive the edge is.
 * - "strong"        → clear, high-confidence differentiation
 * - "moderate"      → meaningful edge, some uncertainty
 * - "slight"        → lean only; not a strong action signal
 * - "indeterminate" → data insufficient to characterize edge strength
 */
export type EdgeStrength =
  | "strong"
  | "moderate"
  | "slight"
  | "indeterminate";

/**
 * What the consumer should do with this verdict.
 * - "act_now"             → confidence is high enough to act
 * - "lean_only"           → directional signal, not a firm recommendation
 * - "more_research_needed" → data gaps exist; hold before acting
 */
export type Actionability =
  | "act_now"
  | "lean_only"
  | "more_research_needed";

// ─── Confidence ──────────────────────────────────────────────────────────────

/**
 * Qualitative confidence band derived from the normalized score.
 * - "high"   → score >= 0.70
 * - "medium" → score >= 0.40
 * - "low"    → score < 0.40
 */
export type ConfidenceBand = "high" | "medium" | "low";

// ─── Pillar Names ────────────────────────────────────────────────────────────

/**
 * Canonical FORGE pillar names. Do not rename these in engine-facing contexts.
 * UI/voice layers may display them differently but must map back to these strings.
 */
export type CanonicalPillarName =
  | "volume"
  | "efficiency"
  | "team_context"
  | "stability";

// ─── Meta ────────────────────────────────────────────────────────────────────

export interface RequestMeta {
  /** Semver string of the intelligence contract (e.g. "1.0.0"). */
  version: string;
  intent: TiberIntent;
  generated_at: string; // ISO 8601
  season?: number;
  week?: number | null;
  league_type?: "redraft" | "dynasty" | "best_ball";
  scoring_format?: "PPR" | "Half" | "Standard";
  /** Caller-supplied trace identifier for log correlation. */
  trace_id?: string;
  /** Originating surface (e.g. "voice", "api_v1", "agent"). */
  source?: string;
}

// ─── Subject ─────────────────────────────────────────────────────────────────

/** A reference to one participant in a comparison or trade package. */
export interface SubjectRef {
  label: string;
  id?: string;
}

/** Describes what is being evaluated. */
export interface SubjectDescriptor {
  type: "player" | "comparison" | "trade_package";
  label: string;
  id?: string;
  /** Only present when type === "comparison" or "trade_package". */
  side_a?: SubjectRef;
  /** Only present when type === "comparison" or "trade_package". */
  side_b?: SubjectRef;
  /** Optional list of individual assets in a trade package. */
  assets?: SubjectRef[];
}

// ─── Verdict ─────────────────────────────────────────────────────────────────

export interface VerdictBlock {
  /** Human-readable verdict string (e.g. "Start", "Trade Away", "Side A wins"). */
  label: string;
  winner: VerdictWinner;
  edge_strength: EdgeStrength;
  actionability: Actionability;
}

// ─── Confidence ──────────────────────────────────────────────────────────────

export interface ConfidenceBlock {
  /**
   * Normalized confidence score in the range 0..1.
   * IMPORTANT: Voice and UI layers that need 0..100 must convert at their boundary.
   * Do not store or transmit 0..100 values in canonical intelligence responses.
   */
  score: number;
  band: ConfidenceBand;
}

// ─── Evidence ────────────────────────────────────────────────────────────────

/** High-level numeric summary for quick machine consumption. */
export interface SummarySignal {
  alpha?: number;
  tier?: string;
  rank_context?: string;
  package_value?: number;
  market_delta?: number;
  [key: string]: unknown;
}

/** Per-pillar breakdown of the evidence. */
export interface PillarEvidence {
  /** Use CanonicalPillarName for FORGE pillars; string for extended pillars. */
  name: CanonicalPillarName | string;
  score?: number;
  delta?: number | null;
  direction?: VerdictWinner;
  notes?: string[];
}

/** A single measurable data point supporting the verdict. */
export interface MetricEvidence {
  name: string;
  value: string | number | boolean | null;
  unit?: string;
  context?: string;
  source?: string;
}

export interface EvidenceBlock {
  summary_signal: SummarySignal;
  pillars: PillarEvidence[];
  metrics: MetricEvidence[];
  /** Plain-English bullet reasons for the verdict. */
  reasons: string[];
}

// ─── Uncertainty ─────────────────────────────────────────────────────────────

export interface UncertaintyBlock {
  /**
   * Conditions that would change this verdict.
   * REQUIRED — must always be present, even as an empty array.
   * Omitting this field is a contract violation.
   */
  could_change_if: string[];
  /** Inputs that were absent and would improve confidence if present. */
  missing_inputs?: string[];
  /** Non-blocking warnings the consumer should be aware of. */
  warnings?: string[];
}

// ─── Canonical Response ──────────────────────────────────────────────────────

/**
 * The canonical TIBER intelligence response.
 * All surfaces (voice, API v1, agent integrations) must produce or be able to
 * map to this shape. Extend via the intent-specific interfaces below.
 */
export interface TiberIntelligenceResponse {
  request_meta: RequestMeta;
  subject: SubjectDescriptor;
  verdict: VerdictBlock;
  confidence: ConfidenceBlock;
  /** One-sentence plain-English summary of the verdict and primary reason. */
  summary: string;
  evidence: EvidenceBlock;
  uncertainty: UncertaintyBlock;
}

// ─── Intent-Specific Specializations ────────────────────────────────────────

/** Single-player evaluation (FORGE + Doctrine). */
export interface PlayerEvalResponse extends TiberIntelligenceResponse {
  request_meta: RequestMeta & { intent: "player_eval" };
  subject: SubjectDescriptor & { type: "player" };
}

/** Head-to-head player comparison. */
export interface ComparisonResponse extends TiberIntelligenceResponse {
  request_meta: RequestMeta & { intent: "comparison" };
  subject: SubjectDescriptor & {
    type: "comparison";
    side_a: SubjectRef;
    side_b: SubjectRef;
  };
}

/** Multi-asset trade package analysis. */
export interface TradeAnalysisResponse extends TiberIntelligenceResponse {
  request_meta: RequestMeta & { intent: "trade_analysis" };
  subject: SubjectDescriptor & {
    type: "trade_package";
    side_a: SubjectRef;
    side_b: SubjectRef;
    assets?: SubjectRef[];
  };
}
