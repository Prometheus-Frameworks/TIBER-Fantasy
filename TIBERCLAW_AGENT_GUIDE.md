# TiberClaw Agent Guide

TiberClaw is TIBER's external intelligence API. It provides structured, high-confidence football analysis outputs that agents can consume and act on. It does not make decisions for you — it returns verdicts, evidence, and uncertainty signals so your agent can decide what to do next.

All responses from intelligence endpoints conform to the `TiberIntelligenceResponse` contract defined in `shared/types/intelligence.ts`. That contract is frozen at version `1.0.0`.

---

## Auth

Every request requires a valid API key in the `x-tiber-key` header.

```
x-tiber-key: YOUR_API_KEY
```

Keys are provisioned by the platform admin. Revoked keys return `403`. Missing keys return `401`. The `request_meta.trace_id` field is your correlation handle — pass a unique value per request if you need to trace calls in logs.

---

## Step 0: Discover capabilities

Before building any integration, call the capabilities endpoint to see what's available.

```bash
curl -H "x-tiber-key: YOUR_KEY" https://your-host/api/v1/capabilities
```

This returns the list of available endpoints, their parameters, intent types, and rate limiting details. The response updates with the running contract version.

---

## The Agent Workflow

### Step 1: Search for a player

```bash
GET /api/v1/players/search?q=Justin+Jefferson
```

```bash
curl -H "x-tiber-key: YOUR_KEY" \
  "https://your-host/api/v1/players/search?q=Justin+Jefferson"
```

**Response (partial):**
```json
{
  "data": [
    {
      "gsis_id": "00-0036900",
      "player_name": "Justin Jefferson",
      "position": "WR",
      "team": "MIN"
    }
  ]
}
```

Use the `gsis_id` as the `playerId` in all subsequent calls.

---

### Step 2: Resolve identity (optional enrichment)

If you need to check a player's FORGE score before comparing:

```bash
GET /api/v1/forge/player/00-0036900?mode=redraft
```

```bash
curl -H "x-tiber-key: YOUR_KEY" \
  "https://your-host/api/v1/forge/player/00-0036900?mode=redraft"
```

Returns alpha score (0–100), tier, and pillar breakdown (volume, efficiency, team_context, stability). Useful for pre-filtering before running a comparison.

---

### Step 3a: Request a comparison

```bash
POST /api/v1/intelligence/compare
```

```bash
curl -X POST \
  -H "x-tiber-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "player1_id": "00-0036900",
    "player2_id": "00-0038583",
    "week": 14,
    "season": 2025,
    "scoring_format": "PPR"
  }' \
  "https://your-host/api/v1/intelligence/compare"
```

---

### Step 3b: Request a trade analysis

```bash
POST /api/v1/intelligence/trade/analyze
```

```bash
curl -X POST \
  -H "x-tiber-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "side_a": [
      { "id": "00-0036900", "name": "Justin Jefferson", "position": "WR" }
    ],
    "side_b": [
      { "id": "00-0038583", "name": "Puka Nacua", "position": "WR" },
      { "id": "00-0037013", "name": "DeVonta Smith", "position": "WR" }
    ],
    "league_type": "redraft"
  }' \
  "https://your-host/api/v1/intelligence/trade/analyze"
```

---

### Step 4: Consume the canonical verdict object

All intelligence endpoints return a `TiberIntelligenceResponse`. Here is the shape with agent-relevant fields annotated:

```json
{
  "request_meta": {
    "version": "1.0.0",
    "intent": "comparison",
    "generated_at": "2025-12-14T18:00:00Z",
    "season": 2025,
    "week": 14,
    "trace_id": "your-trace-id"
  },
  "subject": {
    "type": "comparison",
    "label": "Justin Jefferson vs Puka Nacua",
    "side_a": { "label": "Justin Jefferson", "id": "00-0036900" },
    "side_b": { "label": "Puka Nacua", "id": "00-0038583" }
  },
  "verdict": {
    "label": "Justin Jefferson",
    "winner": "side_a",
    "edge_strength": "strong",
    "actionability": "act_now"
  },
  "confidence": {
    "score": 0.82,
    "band": "high"
  },
  "summary": "Justin Jefferson is clearly the call over Puka Nacua based on recent usage and matchup data.",
  "evidence": {
    "summary_signal": { ... },
    "pillars": [ ... ],
    "metrics": [ ... ],
    "reasons": [
      "Jefferson leads in target share (28.4% vs 19.1%)",
      "Favorable matchup: DAL allows 0.14 pass EPA/play vs MIN's 0.09"
    ]
  },
  "uncertainty": {
    "could_change_if": [
      "Either player is ruled out or limited in practice this week",
      "Game script changes significantly (blowout, weather, etc.)"
    ],
    "missing_inputs": ["FORGE alpha scores", "Current injury report"],
    "warnings": []
  }
}
```

**How to consume the verdict:**

| Field | What it tells you |
|---|---|
| `verdict.winner` | `side_a`, `side_b`, `even`, or `unknown` |
| `verdict.edge_strength` | `strong`, `moderate`, `slight`, or `indeterminate` |
| `verdict.actionability` | `act_now`, `lean_only`, or `more_research_needed` |
| `confidence.band` | `high`, `medium`, or `low` |
| `uncertainty.could_change_if` | Conditions that would flip the verdict |
| `uncertainty.warnings` | Non-blocking data quality flags |

---

### Step 5: Decide whether to ask a follow-up question

**Act on the verdict directly when:**
- `verdict.actionability === "act_now"` AND `confidence.band === "high"` AND `uncertainty.could_change_if` contains no conditions that apply to the current situation.

**Treat as a lean only when:**
- `verdict.actionability === "lean_only"` OR `confidence.band === "medium"`.
- Suitable for presenting as a directional signal, not a firm recommendation.

**Pause and gather more context when:**
- `verdict.actionability === "more_research_needed"` OR `confidence.band === "low"`.
- Check `uncertainty.missing_inputs` to see what data would improve confidence.
- Check `uncertainty.warnings` for data freshness or coverage issues.

---

## Response Schema Reference

All intelligence endpoints emit `TiberIntelligenceResponse`. Full types live in `shared/types/intelligence.ts`.

| Block | Purpose |
|---|---|
| `request_meta` | Versioning, intent, timing, trace correlation |
| `subject` | What is being evaluated (player, comparison, trade package) |
| `verdict` | The actionable output: who wins, how decisively, what to do |
| `confidence` | Normalized 0–1 score and qualitative band |
| `summary` | One-sentence plain-English verdict for display or logging |
| `evidence.summary_signal` | Quick numeric primitives for machine consumption |
| `evidence.pillars` | Per-dimension breakdown (volume, efficiency, team_context, stability) |
| `evidence.metrics` | Raw supporting data points with sources |
| `evidence.reasons` | Bullet-point reasons for the verdict |
| `uncertainty.could_change_if` | **Required.** Conditions that flip the verdict. Always check this. |
| `uncertainty.missing_inputs` | Inputs absent that would improve confidence |
| `uncertainty.warnings` | Non-blocking flags about data quality or freshness |

---

## What TiberClaw Does NOT Do

- It does not make lineup decisions for you. It provides intelligence for your agent to act on.
- It does not integrate directly with fantasy platforms. You handle the action layer.
- It does not guarantee outcomes. Verdicts are confidence-weighted signals, not predictions.
- It does not have real-time injury status built in. Check `uncertainty.warnings` and enrich with a separate injury source if needed.

---

## Rate Limits and Errors

Rate limiting uses a per-key token bucket. Default is 60 requests/minute. If exceeded, you receive a `429` response.

| HTTP Status | Meaning |
|---|---|
| `401` | Missing `x-tiber-key` header |
| `403` | Key is valid but revoked |
| `404` | Player ID not found |
| `422` | Request body failed validation |
| `429` | Rate limit exceeded |
| `500` | Internal error — check `X-Request-Id` for correlation |

All error responses include:
```json
{
  "ok": false,
  "error": {
    "code": "AUTH_MISSING_KEY",
    "message": "Missing x-tiber-key header"
  }
}
```

---

## Deprecated Surfaces

The following routes still exist but are deprecated. They emit ad-hoc response shapes that are not machine-portable and are not maintained for agent use. All responses include `X-Tiber-Deprecated: true`.

| Deprecated route | Canonical replacement |
|---|---|
| `/api/tiber/compare` | `POST /api/v1/intelligence/compare` |
| `/api/tiber/rankings` | `GET /api/v1/forge/batch` |
| `/api/tiber/score/:id` | `GET /api/v1/forge/player/:playerId` |
| `/api/player-compare-pilot/*` | `POST /api/v1/intelligence/compare` |
| `/api/trade-compare/*` | `POST /api/v1/intelligence/trade/analyze` |

These routes sunset on **2026-09-01**. Do not build new integrations against them.
