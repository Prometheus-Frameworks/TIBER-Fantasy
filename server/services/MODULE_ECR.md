# ECR (Expert Consensus Rankings)

Loads and compares Expert Consensus Rankings from FantasyPros and other sources against Tiber's internal rankings. Provides the external baseline for edge detection in the Prediction Engine.

## Files

| File | Purpose |
|------|---------|
| `server/services/ecrLoader.ts` | Admin upload/fetch of ECR data. Parses FantasyPros CSV format. In-memory store (weekly + dynasty maps). Creates Express router with 5 endpoints |
| `server/services/ecrService.ts` | ECR comparison and analysis service. Web scraping via cheerio. Static `getECRData(position)` for downstream consumers |
| `server/services/enhancedEcrProvider.ts` | Enhanced ECR provider with additional data sources and aggregation |

## Data Flow

```
[1] Data Ingestion (one of):
    - Admin CSV upload → POST /api/admin/ecr/upload (paste from FantasyPros "Download CSV")
    - URL fetch → POST /api/admin/ecr/fetch (public CSV link)
    - KeepTradeCut scrape (dynasty proxy)
    - Sleeper ADP (redraft proxy)
        ↓
[2] Parse — parseFantasyProsCsv() extracts player, team, pos, ecr_rank, ecr_points
        ↓
[3] Store — in-memory Maps keyed by week:pos:scoring (weekly) or snapshot:pos (dynasty)
        ↓
[4] Consume — Prediction Engine, rankings comparison, edge detection
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/ecr/upload` | Upload CSV content (pos, week, scoring, csv) |
| `POST` | `/api/admin/ecr/fetch` | Fetch CSV from URL (pos, week, scoring, url) |
| `GET` | `/api/ecr/weekly` | Get stored weekly ECR (?week=&pos=&scoring=) |
| `GET` | `/api/ecr/dynasty` | Get stored dynasty ECR (?snapshot=&pos=) |
| `GET` | `/api/admin/ecr/status` | All stored ECR data keys and counts |

## Data Sources

| Source | Type | Method |
|--------|------|--------|
| FantasyPros CSV | Weekly + Dynasty | Manual admin upload or URL fetch |
| KeepTradeCut | Dynasty | HTML scrape (optional proxy) |
| Sleeper ADP | Redraft proxy | API fetch (optional proxy) |

## Used By

| Consumer | Usage |
|----------|-------|
| Prediction Engine | `ECRService.getECRData(pos)` for edge calculation (our rank vs ECR rank) |
| Rankings comparison | ECR vs Tiber internal rankings display |
