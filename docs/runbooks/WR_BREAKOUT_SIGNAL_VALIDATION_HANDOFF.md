# WR Breakout Lab promoted artifact handoff (Signal-Validation-Model → TIBER-Fantasy)

This runbook is the **safest short-term production path** for getting WR Breakout Lab out of `missing_export_artifact` / `unavailable` and into `ready`.

## Scope and posture

- WR Breakout Lab in TIBER-Fantasy is **read-only**.
- TIBER-Fantasy does **not** recompute Signal-Validation logic.
- Integration contract is artifact-based via filesystem exports.

## TIBER-Fantasy artifact contract (exact)

Default export directory (overridable):

- `SIGNAL_VALIDATION_EXPORTS_DIR=./data/signal-validation`

Minimum required files:

1. `wr_player_signal_cards_{season}.csv`
2. `wr_best_recipe_summary.json`

Example for a `season=2025` breakout query:

- `data/signal-validation/wr_player_signal_cards_2025.csv`
- `data/signal-validation/wr_best_recipe_summary.json`

## Signal-Validation-Model export command

Run the existing downstream export workflow in Signal-Validation-Model:

```bash
signal-validation export-wr-results \
  --feature-season 2025 \
  --output-dir ./exports/signal-validation
```

Expected generated artifacts include:

- `wr_player_signal_cards_{feature_season}.csv`
- `wr_best_recipe_summary.json`
- additional companion files (optional for TIBER-Fantasy WR Breakout Lab)

## Season naming and query alignment

Important: the WR CSV filename token is treated as the season key by TIBER-Fantasy.

- If TIBER-Fantasy requests `season=2025`, it looks for `wr_player_signal_cards_2025.csv`.
- If you export with `--feature-season 2024`, the file will be named `wr_player_signal_cards_2024.csv` and a `season=2025` query will not find it.

To avoid mismatch:

- either export with the same season token TIBER-Fantasy will query,
- or query TIBER-Fantasy with the matching export season.

## Copy/move step into TIBER-Fantasy

From Signal-Validation-Model output directory into TIBER-Fantasy:

```bash
mkdir -p /path/to/TIBER-Fantasy/data/signal-validation
cp /path/to/signal-validation-exports/wr_player_signal_cards_2025.csv /path/to/TIBER-Fantasy/data/signal-validation/
cp /path/to/signal-validation-exports/wr_best_recipe_summary.json /path/to/TIBER-Fantasy/data/signal-validation/
```

Or configure a custom mount/path:

```bash
export SIGNAL_VALIDATION_EXPORTS_DIR=/mounted/path/signal-validation
```

## Verify readiness

1. API-level validation:

```bash
curl -sS "http://localhost:5000/api/data-lab/breakout-signals?season=2025" | jq
curl -sS "http://localhost:5000/api/data-lab/promoted-status?season=2025" | jq
```

2. UI validation:

- Open `/tiber-data-lab/command-center`
- Confirm WR Breakout Lab no longer shows unavailable/missing artifact.

## Railway deployment note

For production stability, artifacts must be available at runtime (container filesystem path or mounted volume).

- **Preferred short-term path:** provide artifacts through deployment-mounted storage or a build/deploy step that copies fresh exports into `data/signal-validation` before runtime.
- **Only if no mount/build pipeline exists:** commit artifacts into repo as a temporary operational bridge, understanding they can become stale.

