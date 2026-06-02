# Promoted Rookie Model Handoff (TIBER-Rookies → TIBER-Fantasy)

## Purpose

Wire the validated promoted rookie artifact from **TIBER-Rookies** into the TIBER-Fantasy product surface without runtime coupling to TIBER-Rookies routes.

## Artifact contract (consumer-side assumptions)

TIBER-Fantasy expects a JSON artifact with:

- `meta.season` (required)
- `{season}_rookie_alpha_predraft_v0.json` containing `players[]` (required, non-empty)
- each row has at minimum a player name + position (e.g. `name`/`player_name`, `pos`/`position`)

Optional promoted fields are consumed when present:

- `profile_summary`
- `identity_note`
- `board_summary`
- `player_id`, `rookie_rank`, `rookie_tier`, `tiber_rookie_alpha`, `tiber_ras_v2`, etc.

## Configuration

Set the promoted artifact directory in environment:

```env
ROOKIE_ALPHA_PROMOTED_DIR=../TIBER-Rookies/exports/promoted/rookie-alpha
ROOKIE_PROMOTED_MODEL_ENABLED=1
```

If omitted, TIBER-Fantasy defaults to `../TIBER-Rookies/exports/promoted/rookie-alpha` and resolves `{season}_rookie_alpha_predraft_v0.json`. `ROOKIE_PROMOTED_ARTIFACT_PATH` remains supported as an explicit single-file compatibility override.

## Promoted lane boundary

Consume only the TIBER-Rookies promoted lane:

```text
exports/promoted/rookie-alpha/
  {season}_rookie_alpha_predraft_v0.json
  {season}_rookie_alpha_predraft_v0.csv
  {season}_manifest.json
```

TIBER-Fantasy reads the JSON artifact only. The CSV and manifest remain operator-visible promotion companions. Do not consume `/cards/rookies/*` or a TIBER-Rookies runtime route.

## Runtime read path

- Loader: `server/modules/externalModels/rookies/rookieArtifactClient.ts`
- Mapper/validator: `server/modules/externalModels/rookies/rookieArtifactAdapter.ts`
- Service orchestration: `server/modules/externalModels/rookies/rookieArtifactService.ts`
- Product API route: `GET /api/rookies/:season`
- Product page: `/rookies`
- Management roster fallback: `server/services/leagueDashboardService.ts` attaches additive `rookieAsset` context only when FORGE remains unavailable. Team Direction counts the promoted match as Management evidence coverage without blending Rookie Alpha into FORGE roster strength. Classification still requires sufficient FORGE scoring coverage; Rookie Alpha cannot satisfy the strength-classification gate.

## Missing/invalid artifact behavior

- Missing artifact: `404` with `code: "not_found"` + guidance about `ROOKIE_ALPHA_PROMOTED_DIR`
- Invalid JSON/contract: `502` with `code: "invalid_payload"`
- Disabled integration: `503` with `code: "config_error"`
- Unexpected read failure: `503` with `code: "upstream_unavailable"`

The UI at `/rookies` renders a clear unavailable state instead of crashing or fabricating players.

## Consumer-side verification checklist (TIBER-Fantasy)

Use this before draft-week promotion windows.

### 1) Confirm env wiring

- `ROOKIE_PROMOTED_MODEL_ENABLED=1`
- `ROOKIE_ALPHA_PROMOTED_DIR` points to the promoted Rookie Alpha artifact directory for the current season (2026 during pre-draft).

### 2) Verify product API shape

Run:

```bash
curl -sS http://localhost:3000/api/rookies/2026 | jq '{season, count, promoted_artifact_backed, model, sample: .players[0]}'
```

Healthy expectations:

- `season` is `2026`
- `promoted_artifact_backed` is `true`
- `count` is non-zero
- sample row includes promoted fields when available (`rookie_alpha`, `rookie_tier`, `rookie_rank`, summaries/context)

### 3) Verify API failure states are operator-readable

Temporarily point `ROOKIE_PROMOTED_ARTIFACT_PATH` to a missing file and restart server, then:

```bash
curl -sS http://localhost:3000/api/rookies/2026 | jq
```

Healthy expectations:

- non-200 response (`404`/`502`/`503`)
- stable error `code`
- clear `guidance` string for operator remediation

### 4) Verify `/rookies` public surface

- Page loads without console/runtime crash.
- Header clearly states artifact-backed provenance + season + model metadata.
- Table shows:
  - sort rank (`#`)
  - model-provided rank (`M#`, when available)
  - rookie alpha/composite, rookie tier, and summary/context snippets where present.
- When artifact is unavailable/invalid/disabled/season-mismatched, UI shows unavailable panel with code/guidance context (no fake players, no blank table confusion).

## “Healthy enough before April 23, 2026” consumer bar

For TIBER-Fantasy `/rookies`, healthy-enough means all of the following are true on **or before April 23, 2026**:

1. API at `/api/rookies/2026` returns `200` with `promoted_artifact_backed=true` and non-zero rows from the promoted artifact.
2. `/rookies` renders promoted alpha/tier/rank fields without null-heavy visual glitches.
3. `/rookies` shows honest provenance metadata (artifact-backed + season + model/promotion timestamps when present).
4. Artifact failure states produce explicit operator-friendly messages with no crash and no fabricated player content.

## Next expansion path

- Add `player_id` link-outs from `/rookies` into deeper player research views when promoted identity coverage is complete.
- Add optional tier-grouped board sections if a single-table layout is no longer sufficient.
