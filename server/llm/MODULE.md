# LLM Gateway

Provider-agnostic AI routing system with automatic fallback. Send a request with a `taskType` and `priority`; the gateway picks the best available model and falls back through alternatives on failure.

## Architecture

```
Consumer (xIntelligenceScanner, ragRoutes, voice, …)
    │
    ▼
callLLM(req)                          ← index.ts
    │
    ▼
callWithFallback(req)                 ← fallback.ts
    │
    ├─ 1. Direct override?  ──────────────► callProvider(req.provider, req.model)
    │      (req.provider + req.model set)
    │
    ├─ 2. Lookup routing table            ← config.ts :: routingTable()
    │      key = req.taskType + req.priority
    │      returns ordered ProviderModel[]
    │
    ├─ 3. Filter by availability          ← config.ts :: providerAvailability()
    │      checks env vars at runtime
    │
    └─ 4. Walk candidates in order
           ├─ provider unavailable? → skip, log, next
           ├─ timeout / rate-limit? → retry (up to maxRetries), then next
           ├─ success              → return LLMResponse
           └─ all exhausted        → throw LLMError

                  callProvider dispatches to:
          ┌────────────┬────────────┬─────────────┐
          ▼            ▼            ▼             ▼
     openrouter    openai     anthropic       gemini
   providers/*.ts  providers/*.ts             providers/*.ts
```

## File Index

| File | Purpose | Key Exports |
|---|---|---|
| `index.ts` | Entry point | `callLLM(req): Promise<LLMResponse>`, `logProviderStatus()`, re-exports `types` |
| `types.ts` | All type definitions | `LLMProvider`, `LLMTaskType`, `LLMPriority`, `LLMRole`, `LLMMessage`, `LLMRequest`, `LLMResponse`, `LLMError`, `LLMErrorType` |
| `config.ts` | Provider availability + routing table | `providerAvailability()`, `logProviderStatus()`, `routingTable()` |
| `fallback.ts` | Core fallback chain logic | `callWithFallback(req)` |
| `logger.ts` | Structured JSON logging | `llmLog(level, event, data)` |
| `providers/openrouter.ts` | OpenRouter wrapper (OpenAI SDK pointed at OpenRouter) | `callOpenRouter(opts)` |
| `providers/openai.ts` | OpenAI wrapper | `callOpenAI(opts)` |
| `providers/anthropic.ts` | Anthropic wrapper | `callAnthropic(opts)` |
| `providers/gemini.ts` | Google Gemini wrapper | `callGemini(opts)` |

## Task Types & Routing

Each task type maps to three priority tiers (`speed`, `balanced`, `accuracy`), each containing an ordered list of provider+model candidates.

| Task Type | Description | Speed Tier (first pick) | Accuracy Tier (first pick) |
|---|---|---|---|
| `router_intent` | Intent classification / routing | Llama 3.3 70B (OpenRouter) | GPT-5.2 (OpenAI) |
| `code_patch` | Code generation and patches | Claude Sonnet 4.5 (Anthropic) | Claude Opus 4.5 (Anthropic) |
| `code_review` | Code review and analysis | GPT-5 Mini (OpenAI) | Claude Opus 4.5 (Anthropic) |
| `research` | Research and information gathering | Llama 3.3 70B (OpenRouter) | GPT-5.2 (OpenAI) |
| `data_qa` | Data querying and QA | DeepSeek Chat (OpenRouter) | GPT-5.1 (OpenAI) |
| `player_analysis` | Fantasy player analysis | Llama 3.3 70B (OpenRouter) | GPT-5.2 (OpenAI) |
| `summarize` | Text summarization | DeepSeek Chat (OpenRouter) | GPT-5.1 (OpenAI) |
| `general` | General-purpose fallback | DeepSeek Chat (OpenRouter) | GPT-5.2 (OpenAI) |
| `x_intelligence` | X/Twitter intelligence scanning | Grok 4.1 Fast (OpenRouter) | Grok 4 (OpenRouter) |

## Provider Setup

| Provider | Env Vars Required | Source |
|---|---|---|
| OpenRouter | `AI_INTEGRATIONS_OPENROUTER_API_KEY`, `AI_INTEGRATIONS_OPENROUTER_BASE_URL` | Replit AI Integration |
| OpenAI | `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL` | Replit AI Integration |
| Anthropic | `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | Replit AI Integration |
| Gemini | `GEMINI_API_KEY` | User-provided secret |

Availability is checked at runtime via `providerAvailability()`. If a provider's env vars are missing or empty, it is skipped in the fallback chain.

## Adding a New Provider

1. **Create wrapper** — Add `providers/<name>.ts` exporting a `call<Name>(opts)` function matching the signature used by other providers (accepts `requestId`, `model`, `messages`, `maxTokens`, `temperature`, `timeoutMs`; returns `Promise<LLMResponse>`).
2. **Register in types** — Add the provider name to the `LLMProvider` union in `types.ts`.
3. **Add availability check** — Add an entry to `providerAvailability()` in `config.ts` checking the relevant env vars.
4. **Wire into dispatcher** — Add a `case` in the `callProvider` switch in `fallback.ts`.
5. **Add to routing table** — Insert the provider+model into relevant task type tiers in `routingTable()` in `config.ts`.

## Adding a New Task Type

1. **Register in types** — Add the task type string to the `LLMTaskType` union in `types.ts`.
2. **Define routing profile** — Add an entry in `routingTable()` in `config.ts` with `speed`, `balanced`, and `accuracy` tiers, each listing ordered `{ provider, model }` candidates.
3. **Use it** — Pass the new task type as `taskType` in your `LLMRequest` when calling `callLLM()`.

## Consumers

| Module | File | Task Type Used |
|---|---|---|
| X Intelligence Scanner | `server/services/xIntelligenceScanner.ts` | `x_intelligence` |
| Server bootstrap | `server/index.ts` | Calls `logProviderStatus()` on startup |
