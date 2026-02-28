# TIBER OpenClaw Connector

This directory contains the OpenClaw agent skill for live TIBER data access.

## Quick Start

```bash
# 1. Copy and fill in config
cp config.example.json config.json
# edit config.json with your api_base_url and api_key

# 2. Make tools executable
chmod +x tools/*.sh

# 3. Test it
./tools/search-player.sh "Ja'Marr Chase"
```

## Files

| File | Purpose |
|------|---------|
| `SKILL.md` | OpenClaw skill entrypoint — agent reads this to understand capabilities |
| `config.example.json` | Config template — copy to `config.json` and fill in |
| `config.json` | Your local config (gitignored — contains API key) |
| `tools/search-player.sh` | Search player by name → get GSIS ID |
| `tools/forge-player.sh` | Full FORGE breakdown for one player |
| `tools/forge-batch.sh` | Ranked FORGE scores for a position group |
| `tools/fire-player.sh` | QB FIRE data (xFP, opportunity delta) |
| `tools/data-lab.sh` | Raw Data Lab metrics (117 fields/player) |

## Requirements

- `curl` — for API calls
- `jq` — for JSON formatting
- `python3` — for URL encoding (search-player only)

## Generating an API Key

Run in Replit shell:
```bash
node scripts/generate-api-key.js "your-agent-name"
```

Then insert the output SQL into your Neon DB (via Drizzle Studio or psql).

## Notes

- `config.json` is gitignored — never commit your API key
- The `data-lab.sh` tool hits `/api/data-lab/lab-agg` directly (no v1 auth wrapper needed for this endpoint — check your instance config)
- All tools output raw JSON — the agent interprets and presents the data
