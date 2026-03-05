# TIBER Intelligence API — Canonical Contract

## 1. Purpose

This document defines the single canonical intelligence response contract for the TIBER platform. All surfaces that produce player evaluation, comparison, or trade analysis output — voice adapters, REST API routes, agent integrations — must produce or be mappable to this contract.

The canonical TypeScript types live in:

```
shared/types/intelligence.ts
```

No other file is the authoritative source for intelligence response shapes.

---

## 2. Design Principles

| Principle | Rule |
|---|---|
| Single source of truth | `shared/types/intelligence.ts` owns all intelligence types. Voice, UI, and plugin layers adapt from it. |
| Adapters, not owners | Voice (`server/voice/types.ts`) and frontend (`shared/types/tiber.ts`) are adapter layers. They translate to/from the canonical contract at their boundary. |
| Confidence normalization | Canonical confidence is always **0..1** (decimal). Voice or UI layers that need 0..100 must convert at their own boundary — never store a 0..100 value in a canonical response. |
| Pillar names are locked | FORGE pillar names (`volume`, `efficiency`, `team_context`, `stability`) must not be renamed in engine-facing contexts. Display aliases are allowed in UI only. |
| Uncertainty is required | Every `TiberIntelligenceResponse` must include `uncertainty.could_change_if`. An empty array is valid; omitting the field is a contract violation. |
| No parallel schemas | Do not create new response schemas for new surfaces. Extend `TiberIntelligenceResponse` or use one of the intent-specific specializations. |

---

## 3. Canonical Response Shape

Full types are in `shared/types/intelligence.ts`. Summary:

```ts
interface TiberIntelligenceResponse {
  request_meta: RequestMeta;      // intent, version, generated_at, season, week, league_type
  subject: SubjectDescriptor;     // what is being evaluated (player / comparison / trade_package)
  verdict: VerdictBlock;          // label, winner, edge_strength, actionability
  confidence: ConfidenceBlock;    // score (0..1), band (high/medium/low)
  summary: string;                // one-sentence plain-English verdict + primary reason
  evidence: EvidenceBlock;        // summary_signal, pillars, metrics, reasons[]
  uncertainty: UncertaintyBlock;  // could_change_if[], missing_inputs?, warnings?
}
```

Intent-specific specializations narrow the types further:

| Interface | Intent value | Subject type |
|---|---|---|
| `PlayerEvalResponse` | `"player_eval"` | `"player"` |
| `ComparisonResponse` | `"comparison"` | `"comparison"` with `side_a` + `side_b` |
| `TradeAnalysisResponse` | `"trade_analysis"` | `"trade_package"` with `side_a` + `side_b` + optional `assets` |

---

## 4. Verdict Enums

### VerdictWinner
| Value | Meaning |
|---|---|
| `"subject"` | Single-player eval — the player is the focus of the verdict |
| `"side_a"` | Comparison or trade — side A holds the edge |
| `"side_b"` | Comparison or trade — side B holds the edge |
| `"even"` | No meaningful edge; roughly equivalent value |
| `"unknown"` | Insufficient data to render a verdict |

### EdgeStrength
| Value | Meaning |
|---|---|
| `"strong"` | Clear, high-confidence differentiation — act accordingly |
| `"moderate"` | Meaningful edge with some residual uncertainty |
| `"slight"` | Lean only — not a firm action signal |
| `"indeterminate"` | Data insufficient to characterize the edge |

### Actionability
| Value | Meaning |
|---|---|
| `"act_now"` | Confidence is high enough to act on the verdict |
| `"lean_only"` | Directional signal; not a firm recommendation |
| `"more_research_needed"` | Data gaps exist; hold before acting |

---

## 5. Evidence Rules

- `evidence.pillars` must use `CanonicalPillarName` for FORGE pillars: `"volume"`, `"efficiency"`, `"team_context"`, `"stability"`.
- Non-FORGE evidence pillars may use arbitrary strings (e.g. `"age_curve"`, `"market_position"`).
- `evidence.reasons` should be short, factual, plain-English bullets — one claim per bullet.
- `evidence.metrics` entries must include `name` and `value`. `source` is strongly recommended for agent consumers.
- `evidence.summary_signal.alpha` should carry the FORGE alpha score (0–100) when available.

---

## 6. Uncertainty Rules

Every `TiberIntelligenceResponse` **must** include:

```ts
uncertainty: {
  could_change_if: string[];  // REQUIRED — empty array is valid, omission is not
  missing_inputs?: string[];  // recommended when data gaps affected confidence
  warnings?: string[];        // non-blocking caveats
}
```

Examples of valid `could_change_if` entries:
- `"injury status changes before game time"`
- `"target share shifts after OBJ returns"`
- `"dynasty league type — redraft weight would change verdict"`

---

## 7. Intent-Specific Specializations

### PlayerEvalResponse
- `subject.type` must be `"player"`
- `subject.id` should be the `gsis_id` (FORGE canonical identifier)
- `verdict.winner` should be `"subject"` (player evals don't compare sides)
- `evidence.summary_signal.alpha` = FORGE alpha score
- `evidence.summary_signal.tier` = Tiber Tier string (e.g. `"T1"`)

### ComparisonResponse
- `subject.type` must be `"comparison"`
- `subject.side_a` and `subject.side_b` must both be present
- `verdict.winner` is `"side_a"`, `"side_b"`, or `"even"`
- `evidence.pillars` should include per-pillar `direction` values (`"side_a"` | `"side_b"` | `"even"`)

### TradeAnalysisResponse
- `subject.type` must be `"trade_package"`
- `subject.side_a` = the team giving up assets; `subject.side_b` = the team receiving
- `subject.assets` = optional flat list of all players involved
- `verdict.winner` = `"side_a"` (seller wins), `"side_b"` (buyer wins), or `"even"`
- `evidence.summary_signal.package_value` = aggregate package value (if computable)
- `evidence.summary_signal.market_delta` = value gap between sides

---

## 8. Legacy / Transitional Surface Map

| File | Status | Current Shape | Convergence Target | Next Pass Action |
|---|---|---|---|---|
| `server/routes/playerComparePilotRoutes.ts` | **Legacy** | `PlayerComparisonData` (ad-hoc) | `ComparisonResponse` | Deprecate once `playerComparisonRoutes.ts` is promoted |
| `server/routes/playerComparisonRoutes.ts` | **Transitional** | `comparePlayers()` output (loose) | `ComparisonResponse` | Wrap `comparePlayers()` in `EvidenceBlock + VerdictBlock`; surface via `/api/v1/intelligence/compare` |
| `server/routes/tradeAnalyzerRoutes.ts` | **Transitional** | Local `TradeAnalysisResponse` (Compass-based) | `TradeAnalysisResponse` (canonical) | Replace Compass scores with `forge_alpha`; align to `EvidenceBlock + VerdictBlock` |
| `server/services/trade/tradeLogic.ts` | **Transitional** | `TradeEvaluationResult` (prometheusScore) | `TiberIntelligenceResponse` | Replace `prometheusScore` with `forge_alpha`; align result to canonical shape |
| `server/api/trade-eval/index.ts` | **Transitional** | prometheusScore-backed (loose) | `TradeAnalysisResponse` | Depends on tradeLogic.ts convergence |
| `server/voice/deciders/trade.ts` | **Voice Adapter** | `DecisionResult` (voice-scoped) | Voice adapter of `TradeAnalysisResponse` | Not a canonical engine; stays voice-scoped |
| `server/voice/types.ts` | **Voice Adapter** | `TiberAnswer` (0..100 confidence) | Adapter to `TiberIntelligenceResponse` | Convert confidence to 0..1 at voice boundary |
| `shared/types/tiber.ts` | **Frontend Adapter** | `TiberResponse` (loose) | Adapter to `TiberIntelligenceResponse` | Frontend display layer; not a canonical contract |
| `server/api/v1/routes.ts` (dynasty endpoints) | **Canonical-adjacent** | Doctrine `DoctrineEvaluation` | `PlayerEvalResponse` | Doctrine evaluation shape is a close fit; wrap in canonical envelope in v2 |

---

## 9. Migration Rules

1. **New agent integrations must target the canonical contract.** Do not consume `TiberAnswer`, `PlayerComparisonData`, or local `TradeAnalysisResponse` shapes from new code. Always use `TiberIntelligenceResponse` or a specialization.

2. **Voice and UI layers convert confidence at their boundary.** Canonical `confidence.score` is `0..1`. If voice or UI needs 0..100, multiply by 100 in the adapter — never in the engine.

3. **No new parallel schemas.** If a new intent or surface type is needed, add a new intent value to `TiberIntent` in `shared/types/intelligence.ts` and a new specialization interface. Do not create a separate type file.

4. **FORGE pillar names are immutable in engine-facing contexts.** Display aliases (e.g. "Usage" for `volume`) are allowed only in UI rendering layers.

5. **`uncertainty.could_change_if` is always required.** Responses that omit this field are non-compliant and will be treated as bugs in code review.

6. **Legacy-compatible routes remain unchanged in this pass.** Existing endpoints that return transitional shapes continue to function. The migration is additive — new v1 endpoints built in the next pass will produce canonical shapes alongside the existing transitional endpoints.

---

## 10. Definition of Done

This intelligence contract unification task is complete when:

- [x] `INTELLIGENCE_API.md` exists and is coherent
- [x] `shared/types/intelligence.ts` exports all canonical types
- [x] `server/voice/types.ts` is annotated as an adapter layer with mapping comments
- [x] `shared/types/tiber.ts` is annotated as a frontend adapter layer
- [x] No existing behavior is broken by the change
- [x] All comparison/trade convergence points are identified with TODO annotations
- [x] The repo has a clear source-of-truth contract for future agent integrations

---

## 11. Recommended Next Pass — Comparison / Trade Consolidation

Priority order for the next consolidation pass:

1. **Promote `playerComparisonRoutes.ts`** → wrap `comparePlayers()` output in `ComparisonResponse` canonical shape; expose via `/api/v1/intelligence/compare`
2. **Deprecate `playerComparePilotRoutes.ts`** → once step 1 is verified
3. **Wire `tradeLogic.ts` to FORGE** → replace `prometheusScore` with `forge_alpha` from `/api/v1/forge/player/:gsis_id`
4. **Align `tradeAnalyzerRoutes.ts`** → replace Compass-score verdict with `EvidenceBlock + VerdictBlock`
5. **Expose `/api/v1/intelligence/trade`** → new canonical trade endpoint returning `TradeAnalysisResponse`
