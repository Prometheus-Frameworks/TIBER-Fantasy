# TIBER as an Open API Platform — Vision Document

**Last updated:** February 25, 2026  
**Status:** Pre-build — documenting direction before implementation begins

---

## The Shift

TIBER started as a fantasy football dashboard — a React frontend you visit to see player rankings, FORGE scores, and matchup data. That was the right move to prove the concept and build the engine.

The direction going forward is different. TIBER is becoming an **open intelligence layer** — a platform that provides data and scoring through an API, so that anyone (or any AI agent) can build on top of it without visiting a website at all.

The web app doesn't go away. It becomes one client among many — and probably not the most important one.

---

## What TIBER Has Already Built

This isn't a vision that requires rebuilding from scratch. The infrastructure is already there:

| Asset | What It Is |
|---|---|
| **228 API endpoints** | Live, queryable data across players, scoring, matchups, schedules |
| **FORGE Engine** | Core player scoring system — Alpha scores (0–100) for QB/RB/WR/TE |
| **FIRE Pipeline** | Rolling opportunity and role scoring; expected fantasy points vs actual |
| **CATALYST** | Play-level clutch performance metric using EPA and game context |
| **3-tier ELT pipeline** | Bronze → Silver → Gold data processing from multiple NFL sources |
| **131 database tables** | Player identity, game logs, projections, matchups, snap counts, and more |
| **LLM gateway** | 4-provider AI integration (OpenRouter, OpenAI, Anthropic, Gemini) |
| **Knowledge base** | Scoring methodology, evaluation frameworks, dynasty philosophy |

The scoring methodology is real and differentiated. The data is sourced from free, open NFL sources (nflverse, Sleeper). There are no paywalls in the stack.

---

## The API Platform Model

Instead of users visiting tiber-fantasy.com, the model looks like this:

```
Personal AI agent (Claude, GPT, Grok, etc.)
        ↓
  TIBER API call
  (e.g., GET /api/forge/eg/player/00-0036442)
        ↓
  Structured response: Alpha score, pillar breakdown, tier, trajectory
        ↓
  Agent uses data to answer a question, build a report, evaluate a trade
```

The agent doesn't need a pretty chart. It needs accurate, structured data and the methodology to interpret it. TIBER provides both.

A user's personal AI could:
- Pull FORGE scores before waiver wire decisions
- Evaluate a dynasty trade using Alpha scores and trajectory data
- Get start/sit recommendations grounded in matchup data
- Monitor player trends without the user having to check a dashboard

---

## What's Missing Right Now

TIBER's endpoints are currently open — no authentication required. That's fine for a personal dashboard on a private server, but it needs one addition before the platform model works:

**API key authentication.** A simple system where:
- Each user (or agent) gets a unique API key
- All requests to `/api/*` require that key in the request header
- Without a key, the request is rejected

That's the gate between "private tool" and "platform."

Everything else — the data, the scoring, the endpoints — is already built.

---

## Phased Rollout Plan

### Phase 1 — Personal Use (Next)
- Generate one API key for the owner
- Add authentication middleware to all endpoints
- Validate from anywhere: personal AI agent, Cowork plugin, Claude projects, scripts
- No UI changes needed — the web app continues working normally

### Phase 2 — Small Team / Trusted Users
- API key registration (invite-only or manual)
- Basic rate limiting per key
- Simple usage logging (how many requests per key per day)

### Phase 3 — Open Platform
- Self-serve key registration (sign up, get a key)
- Tiered rate limits (free tier vs expanded)
- Public-facing API documentation
- Developer-friendly response contracts with versioning

---

## What Agents Can Build With It

Once the API key layer exists, here's what becomes possible:

**Personal fantasy assistant** — An AI that monitors FORGE scores weekly, surfaces buy/sell signals, and drafts waiver wire recommendations without the user having to open a browser.

**Custom dynasty tools** — A developer builds a trade analyzer that pulls FORGE Alpha in dynasty mode, compares both sides, and gives a recommendation — all powered by TIBER's data.

**League-integrated alerts** — An agent that syncs a Sleeper league, watches for injury news or snap count changes, and proactively messages the owner with relevant FORGE data.

**Research tools** — Custom dashboards, historical analysis, position breakdowns — built by anyone using the API, not just by the TIBER team.

The platform provides the intelligence. The interface is up to whoever is building.

---

## The Cowork Plugin Connection

The Claude Cowork plugin (`tiber-cowork-plugin/`) that was built alongside this vision is the first distribution channel for this model. It installs TIBER's scoring methodology and slash commands directly into Claude, so that any Cowork session can:

- Call `/tiber:player-eval` to get a FORGE evaluation
- Call `/tiber:forge-batch` for position-group rankings
- Use TIBER's dynasty and philosophy frameworks in any conversation

When the API key layer is live, the plugin can make real API calls to the live TIBER backend instead of relying purely on the embedded knowledge. The plugin becomes a live interface to the data, not just a documentation layer.

---

## Core Principles (Non-Negotiable)

- **No paywalls.** The API is free to use. Revenue models, if any, come from services built on top — never from gating the data itself.
- **Open methodology.** FORGE's scoring logic is documented and explainable. No black boxes.
- **Teach, don't just deliver.** The API returns structured data with enough context that an agent can explain its reasoning to a user, not just spit out a number.
- **Skill positions only.** QB, RB, WR, TE. No kickers, no IDP (the IDP module exists as a research layer, not a platform feature).

---

## Summary

TIBER has already built the hard part — the data pipeline, the scoring engines, the methodology. The next step is a small authentication layer that turns a private tool into a platform. After that, the surface area for distribution expands significantly: personal agents, Cowork plugins, developer tools, and anything else that wants to consume structured NFL intelligence.

The website is one client. The API is the product.
