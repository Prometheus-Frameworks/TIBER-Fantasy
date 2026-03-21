# CATALYST Module Notice

> [!WARNING]
> **Classification:** `EXTRACT`.
> **Work status:** Do not add net-new standalone model logic, new scoring dimensions, or new product scope inside CATALYST.
> **Allowed changes:** Bug fixes, data/compute reliability work, compatibility updates, contract documentation, and migration prep only.
> **Long-term destination:** Externalize the compute/runtime behind the `server/modules/externalModels/` adapter pattern after the contract is frozen.
> **Dependency caveat:** CATALYST still powers active product surfaces and stored score outputs, so it cannot be removed yet.
> **Repo-wide doctrine:** See `docs/architecture/TIBER_FANTASY_MODULE_CLASSIFICATION_AUDIT.md` and `docs/architecture/LEGACY_MODULE_WORK_RULES.md`.

## Scope

CATALYST is a standalone clutch/leverage scoring engine with its own batch/player routes and compute lifecycle.

## Visible entry points

- `server/modules/catalyst/catalystRoutes.ts`
- `server/modules/catalyst/catalystCalculator.py`

## Operational rule

Use this module only for compatibility, score regeneration, and extraction prep until an external replacement exists.
