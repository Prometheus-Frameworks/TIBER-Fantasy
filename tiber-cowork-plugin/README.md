# TIBER Fantasy — Claude Cowork Plugin

A Cowork plugin that turns Claude into a fantasy football analytics specialist powered by TIBER's FORGE engine.

## What This Plugin Does

Installs TIBER's domain knowledge, scoring methodology, and slash commands into Claude Cowork so that Claude can:

- Evaluate NFL players using FORGE's 4-pillar Alpha scoring system
- Identify buy-low/sell-high opportunities using trajectory analysis
- Provide start/sit recommendations grounded in matchup data
- Sync your Sleeper league for personalized analysis
- Explain the *why* behind every recommendation (teach, don't just tell)

## Installation

### From Cowork UI
1. Open Cowork
2. Go to Plugins → Install
3. Select this plugin or upload the folder

### From CLI (Claude Code compatible)
```bash
# If using the plugin marketplace
claude plugin marketplace add Prometheus-Frameworks/tiber-cowork-plugin
claude plugin install tiber-fantasy@tiber-cowork-plugin

# Or install directly from local path
claude plugin install ./tiber-cowork-plugin
```

## Slash Commands

| Command | What It Does |
|---------|-------------|
| `/tiber:player-eval <name>` | Full FORGE evaluation of a player |
| `/tiber:forge-batch <position>` | Tiered rankings for a position group |
| `/tiber:start-sit` | Weekly start/sit recommendations |
| `/tiber:buy-sell` | Buy-low and sell-high candidates |
| `/tiber:league-sync <id>` | Connect your Sleeper league |

All commands support `--mode redraft|dynasty|bestball` for league-type-specific analysis.

## Skills (Auto-Activated)

These fire automatically when relevant topics come up:

- **forge-engine** — FORGE scoring methodology, pillar system, tier mapping
- **fire-pipeline** — QB expected fantasy points and opportunity modeling
- **data-architecture** — ELT pipeline, data sources, identity resolution
- **dynasty-evaluation** — Trade analysis, buy/sell frameworks, rookie evaluation
- **tiber-philosophy** — The "serve not take" approach, epistemic humility, voice guidelines

## Customization

### Add Your League Context
Edit `skills/dynasty-evaluation.md` to add your league's specific settings:
- Scoring format (PPR, half, standard)
- Roster requirements (superflex, TE premium, etc.)
- Number of teams
- Your team's competitive window (contending vs rebuilding)

### Add Custom Evaluation Criteria
Create new skill files in `skills/` for domain-specific knowledge:
- `skills/auction-values.md` — if your league uses auction drafts
- `skills/te-premium.md` — adjusted TE evaluation for TE-premium leagues
- `skills/superflex.md` — QB valuation adjustments for superflex

### Connect Additional Data
Update `.mcp.json` to add MCP server connections as they become available for fantasy data sources.

## Architecture

```
tiber-cowork-plugin/
├── .claude-plugin/
│   └── plugin.json          # Manifest
├── .mcp.json                # Data source connections
├── commands/                # Slash commands (user-invoked)
│   ├── player-eval.md
│   ├── forge-batch.md
│   ├── start-sit.md
│   ├── buy-sell.md
│   └── league-sync.md
├── skills/                  # Domain knowledge (auto-activated)
│   ├── forge-engine.md
│   ├── fire-pipeline.md
│   ├── data-architecture.md
│   ├── dynasty-evaluation.md
│   └── tiber-philosophy.md
└── README.md
```

## Philosophy

This plugin embodies TIBER's core principles:
- **No paywalls** — everything is open source
- **Teach pattern recognition** — explain the why, not just the what
- **Epistemic humility** — probabilities, not certainties
- **Serve, not take** — help users think better, don't create dependency

## Contributing

Issues and PRs welcome at [Prometheus-Frameworks/TIBER-Fantasy](https://github.com/Prometheus-Frameworks/TIBER-Fantasy).

## License

MIT
