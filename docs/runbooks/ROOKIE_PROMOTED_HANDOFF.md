# Promoted Rookie Model Handoff (TIBER-Rookies → TIBER-Fantasy)

## Purpose

Wire the validated promoted rookie artifact from **TIBER-Rookies** into the TIBER-Fantasy product surface without runtime coupling to TIBER-Rookies routes.

## Artifact contract (consumer-side assumptions)

TIBER-Fantasy expects a JSON artifact with:

- `meta.season` (required)
- `players[]` (required, non-empty)
- each row has at minimum a player name + position (e.g. `name`/`player_name`, `pos`/`position`)

Optional promoted fields are consumed when present:

- `profile_summary`
- `identity_note`
- `board_summary`
- `player_id`, `rookie_rank`, `rookie_tier`, `tiber_rookie_alpha`, `tiber_ras_v2`, etc.

## Configuration

Set the artifact path in environment:

```env
ROOKIE_PROMOTED_ARTIFACT_PATH=./data/rookies/2026_rookie_grades_v2.json
ROOKIE_PROMOTED_MODEL_ENABLED=1
```

If omitted, TIBER-Fantasy defaults to `./data/rookies/2026_rookie_grades_v2.json`.

## Runtime read path

- Loader: `server/modules/externalModels/rookies/rookieArtifactClient.ts`
- Mapper/validator: `server/modules/externalModels/rookies/rookieArtifactAdapter.ts`
- Service orchestration: `server/modules/externalModels/rookies/rookieArtifactService.ts`
- Product API route: `GET /api/rookies/:season`
- Product page: `/rookies`

## Missing/invalid artifact behavior

- Missing artifact: `404` with `code: "not_found"` + guidance about `ROOKIE_PROMOTED_ARTIFACT_PATH`
- Invalid JSON/contract: `502` with `code: "invalid_payload"`
- Disabled integration: `503` with `code: "config_error"`

The UI at `/rookies` renders a clear unavailable state instead of crashing or fabricating players.

## Next expansion path

- Add `player_id` link-outs from `/rookies` into deeper player research views when promoted identity coverage is complete.
- Add optional tier-grouped board sections if a single-table layout is no longer sufficient.
