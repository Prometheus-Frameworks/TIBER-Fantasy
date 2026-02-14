# X Intelligence Scanner

Scans X/Twitter via Grok LLM for fantasy-relevant NFL intel (injuries, trends, breakouts, consensus shifts). Returns structured entries stored in a local JSON file.

## Files

| File | Purpose |
|------|---------|
| `server/services/xIntelligenceScanner.ts` | Core scanner logic, LLM prompt building, response parsing, file I/O |
| `server/routes.ts` | Registers endpoints under `/api/intel/` |
| `client/src/pages/XIntelligence.tsx` | Frontend display for intel feed |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/intel/x-scan` | Trigger a scan. Body: `{ scanType, focusPlayers?, positions?, priority? }` |
| GET | `/api/intel/x-feed` | Read current intel entries. Query: `player`, `position`, `category`, `signal`, `limit` |
| DELETE | `/api/intel/x-feed` | Clear all Grok-sourced intel entries |

## Data Flow

1. Client calls POST `/api/intel/x-scan` with scan options
2. `scanXIntelligence()` builds a position/type-specific prompt
3. `callLLM()` sends prompt with `taskType: "x_intelligence"` → routes to Grok models via OpenRouter
4. Response parsed from JSON array, validated against known categories/signals
5. Each entry gets a unique `id` (`xscan_{timestamp}_{index}`) and `scanned_by: "grok-x-scanner"` tag
6. `saveIntelEntries()` merges new entries into `data/current_intel.json`
7. GET endpoint reads and filters from the same file

## LLM Integration

- **Task type**: `x_intelligence`
- **Model cascade**: grok-4.1-fast → grok-4-fast → grok-4 → grok-3 (via OpenRouter)
- **Temperature**: 0.4
- **Max tokens**: 4000
- **Timeout**: 60s
- **Priority options**: `speed`, `balanced`, `accuracy`

## Scan Types

| Type | What it looks for |
|------|-------------------|
| `trending` | Volume spikes, beat reporter consensus shifts |
| `injuries` | Practice reports, return-to-play timelines |
| `breakouts` | Usage/target share shifts, role changes |
| `consensus` | Expert convergence on starts/sits/waivers |
| `full` | All of the above combined |

## Key Types

```typescript
type IntelSignal = "strong" | "moderate" | "speculative";
type IntelCategory = "injury" | "trend" | "breakout" | "consensus" | "usage" | "trade" | "depth_chart";

interface XIntelEntry {
  id, player, position, team, category, signal,
  headline, detail, source_context, fantasy_impact,
  dynasty_relevance, timestamp, scanned_by
}
```

## Storage

File-based at `data/current_intel.json`. Entries accumulate; `clearGrokIntel()` removes only entries with `scanned_by === "grok-x-scanner"`.

## Common Tasks

- **Add a new scan type**: Add entry to `scanInstructions` record in `buildScanPrompt()`
- **Change LLM model**: Update the model cascade in `server/llm/index.ts` for `x_intelligence` task type
- **Add a new output field**: Update `XIntelEntry` interface, `parseGrokResponse()` mapper, and the prompt template
- **Filter entries**: Use query params on GET `/api/intel/x-feed` or call `getIntelEntries()` directly
