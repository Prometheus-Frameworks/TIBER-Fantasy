# RAG Chat System

AI-powered fantasy football chat using Google Gemini for embeddings and generation, with optional Grok (via OpenRouter) as an alternative LLM. Includes knowledge base retrieval, 3-layer consciousness system, and memory integration.

## Files

| File | Purpose |
|------|---------|
| `server/services/geminiEmbeddings.ts` | Core service. Embedding generation (Gemini `text-embedding-004`, 768-dim), chat generation (`callGeminiTiber`, `callGrokTiber`, `callTiberChat`), query mode detection (trade/waivers/start_sit/generic), 3-layer consciousness prompt, context sanitization, pressure lexicon guard |
| `server/routes/ragRoutes.ts` | Chat API routes for conversation management |
| `client/src/pages/ChatHomepage.tsx` | Frontend chat page at `/legacy-chat` |
| `knowledge/core/` | Core knowledge base (tiber-brain-os-v1, waiver-wisdom-vorp-context) |
| `knowledge/theory/` | Deep theory modules (pressure, signal, entropy, psychology, ecosystem) |

## Architecture

```
User Query
    ↓
[1] Layer Detection — detectLayer() → tactical / teaching / river
[2] Format Detection — detectFormat() → redraft / dynasty
[3] Mode Detection — detectQueryMode() → trade / waivers / start_sit / generic
    ↓
[4] Embedding — generateEmbedding(query) via Gemini text-embedding-004 (768-dim)
    ↓
[5] Retrieval — BM25 search over chunks table + knowledge base
    ↓
[6] Context Sanitization — remove banned metrics from retrieved context
    ↓
[7] Prompt Assembly — 3-layer consciousness system prompt + Brain OS v1 rules
    ↓
[8] Generation — callTiberChat(systemPrompt, userMessage, provider)
    - provider='gemini': Gemini 2.0 Flash
    - provider='grok': Grok 4 Fast via OpenRouter (auto-fallback to Gemini)
    ↓
[9] Post-processing — pressureLexiconGuard() for teaching/river layers
```

## Knowledge Base

| Directory | Contents |
|-----------|----------|
| `knowledge/core/` | Brain OS v1 commandments, waiver VORP context |
| `knowledge/theory/` | 5 deep theory modules: Pressure, Signal, Entropy, Psychology, Ecosystem |

## DB Tables

| Table | Purpose |
|-------|---------|
| `tiber_conversations` | Conversation sessions |
| `tiber_messages` | Individual messages within conversations |
| `chunks` | Embedded text chunks for RAG retrieval |

## LLM Configuration

- **Embeddings**: Gemini `text-embedding-004` (768 dimensions) — uses `GEMINI_API_KEY`
- **Generation (primary)**: Gemini `gemini-2.0-flash` — uses `GEMINI_API_KEY`
- **Generation (alt)**: Grok 4 Fast via OpenRouter — uses `AI_INTEGRATIONS_OPENROUTER_*` env vars
