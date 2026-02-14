# Enrichment Boxes

Position-specific stat enrichment applied during ETL data processing. Each "box" takes a raw `WeeklyRow` and returns enriched data with derived metrics specific to that position.

## Files

| File | Purpose |
|------|---------|
| `index.ts` | Barrel exports + `enrichByPosition()` router that dispatches to the correct box |
| `qbBox.ts` | QB enrichment: CPOE, dakota, PACR, pressured EPA, play-action EPA |
| `wrBox.ts` | WR enrichment: WOPR, RACR, cushion, xyac_epa, slot rate, contested catch. Also handles TE |
| `rbBox.ts` | RB enrichment: RYOE, opportunity share, elusive rating, stuffed rate |
| `fantasyBox.ts` | Fantasy point calculations: Standard, Half-PPR, PPR scoring |
| `idpBox.ts` | IDP enrichment: tackles, TFL, sacks, QB hits, pressure rate |

## How It Works

```typescript
import { enrichByPosition } from './enrichment';

const result = enrichByPosition(weeklyRow);
// result.player   → enriched player data
// result.enriched → boolean, true if enrichment was applied
// result.enrichments → list of enrichment names applied
```

The router in `index.ts` checks `player.position` and dispatches:
- `QB` → `enrichQBWithMeta()`
- `WR` → `enrichWRWithMeta()`
- `TE` → `enrichWRWithMeta()` (shares WR box with TE-specific fields)
- `RB` → `enrichRBWithMeta()`
- `DL/LB/DB/DE/DT/CB/S` → `enrichIDPWithMeta()`

Each box exports two variants:
- `enrichXX(player)` → returns enriched player directly
- `enrichXXWithMeta(player)` → returns `EnrichmentResult` with metadata

## Adding a New Enrichment Box

1. Create `server/enrichment/newPosBox.ts`
2. Export `enrichNewPos(player: WeeklyRow): EnrichedNewPos` and `enrichNewPosWithMeta(player: WeeklyRow): EnrichmentResult`
3. Define the `EnrichedNewPos` type extending `WeeklyRow` with new fields
4. Add the export to `index.ts` barrel exports
5. Add a case to the `switch` in `enrichByPosition()`
6. The Gold ETL (`goldDatadiveETL.ts`) will automatically pick up the new box via `enrichByPosition()`
