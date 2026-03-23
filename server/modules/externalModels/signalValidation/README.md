# Signal Validation external adapter

This adapter powers the read-only WR Breakout Lab in TIBER Data Lab.

## Inputs

- `wr_player_signal_cards_{season}.csv`
- `wr_best_recipe_summary.json`

By default the adapter reads from `./data/signal-validation`, or from `SIGNAL_VALIDATION_EXPORTS_DIR` when set.

## Contract

- Client: filesystem/export discovery and read errors
- Adapter: CSV + JSON validation/normalization into stable TIBER-facing types
- Service: stable `getWrBreakoutLab()` interface for routes
- Route: `GET /api/data-lab/breakout-signals[?season=<year>]`

## Product behavior

- Read-only only; no rescoring or mutation
- Empty, malformed, and missing-export states are surfaced explicitly with operator-facing hints
- The WR Breakout Lab adds client-side sort/search/filter controls plus grouped read-only detail sections for exported signal cards
- TIBER-Fantasy displays promoted Signal-Validation-Model outputs and does not recompute breakout logic
