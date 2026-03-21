# tiberMatrix Module Notice

> [!WARNING]
> **Classification:** `UNKNOWN`.
> **Work status:** Freeze expansion now. Do not add net-new role heuristics, feature logic, or additional consumers until live runtime usage is confirmed.
> **Allowed changes:** Bug fixes, validation, usage tracing, deprecation prep, and narrowly scoped migration support.
> **Long-term destination:** If active consumers are confirmed, plan extraction behind an adapter boundary. If no active consumers remain, deprecate and delete later.
> **Dependency caveat:** The audit found tests and calibration utilities here, but did not confirm strong live runtime wiring.
> **Repo-wide doctrine:** See `docs/architecture/TIBER_FANTASY_MODULE_CLASSIFICATION_AUDIT.md` and `docs/architecture/LEGACY_MODULE_WORK_RULES.md`.

## Scope

tiberMatrix contains offensive role-assignment heuristics and calibration utilities.

## Visible entry points

- `server/modules/tiberMatrix/batchAssignRoles.ts`
- `server/modules/tiberMatrix/calibrationReport.ts`

## Operational rule

Do not treat this directory as an approved place for new in-repo model work.
