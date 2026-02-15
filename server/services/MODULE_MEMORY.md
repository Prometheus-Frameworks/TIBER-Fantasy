# Tiber Memory System

Dual memory pools (FANTASY vs GENERAL) for AI context persistence. Stores observations, insights, and learned patterns that Tiber's chat system retrieves to provide contextually aware responses.

## Files

| File | Purpose |
|------|---------|
| `server/routes/tiberMemoryRoutes.ts` | Express router with CRUD endpoints for memories. Mounted at `/api/tiber/memory` |

## Memory Pools

| Pool | Category | Purpose |
|------|----------|---------|
| FANTASY | `fantasy` | Player observations, matchup insights, trade analysis patterns, waiver intelligence |
| GENERAL | `general` | System learnings, user preferences, conversation context |

Memories include: `title`, `content`, `insights[]`, `tags[]`, `source`, `confidence` (0-1), `lastAccessed` timestamp.

## DB Tables

| Table | Purpose |
|-------|---------|
| `tiber_memory` | Core memory store: category, title, content, insights (text[]), tags (text[]), source, confidence, timestamps |
| `tiber_conversations` | Chat conversation sessions |
| `tiber_messages` | Individual messages within conversations |
| `tiber_memory_snapshots` | Point-in-time memory snapshots |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/tiber/memory` | Retrieve memories (?category=&search=&limit=) |
| `POST` | `/api/tiber/memory` | Store new memory (category, title, content, insights, tags, source, confidence) |
| `PUT` | `/api/tiber/memory/:id/access` | Update last accessed timestamp |
| `GET` | `/api/tiber/memory/categories` | List all categories with counts |
| `GET` | `/api/tiber/memory/search/:query` | Smart search across title, content, tags, insights with relevance scoring |

## Used By

| Consumer | Usage |
|----------|-------|
| RAG Chat (`geminiEmbeddings.ts`) | Retrieves relevant memories for context-grounded responses |
| TiberPromptBuilder | Injects memory context into system prompts |
