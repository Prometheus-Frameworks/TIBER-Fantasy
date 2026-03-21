# Legacy Module Work Rules

These rules make the module classification audit operational.

Primary source of truth: `docs/architecture/TIBER_FANTASY_MODULE_CLASSIFICATION_AUDIT.md`.

## Hard rules

1. **Do not add net-new standalone model logic to modules classified as `LEGACY_CORE_TEMP`, `EXTRACT`, `DEPRECATE_NOW`, `DELETE_AFTER_REPLACEMENT`, or `UNKNOWN`.**
2. **Allowed changes in those modules are limited to bug fixes, compatibility work, contract hardening, validation, migration support, and extraction/replacement prep.**
3. **New model development should happen outside this repo and re-enter through `server/modules/externalModels/` adapters and core orchestrators.**
4. **Do not create new route-level football reasoning surfaces in legacy modules unless the work is required to preserve an existing product contract during migration.**
5. **If a legacy module still powers active product surfaces, stabilize its payloads first. Do not use active dependency as an excuse to keep expanding it.**
6. **If a module is marked `UNKNOWN`, treat it as frozen until runtime ownership and active consumers are confirmed.**

## Practical interpretation by classification

### `LEGACY_CORE_TEMP`
- Still active in core.
- No casual feature growth.
- Focus on stabilization, boundary cleanup, and extraction readiness.

### `EXTRACT`
- Engine-shaped system that should leave core.
- Keep consumer contracts stable.
- Prefer adapter-friendly DTOs and migration notes over new in-repo scope.

### `DEPRECATE_NOW`
- Do not invest in long-term expansion.
- Keep alive only for current consumers and transition work.

### `DELETE_AFTER_REPLACEMENT`
- No new features.
- Remove once the canonical replacement exists and consumers have moved.

### `UNKNOWN`
- No new scope until usage is proven.
- Resolve usage visibility before deciding between extraction and deletion.

## Default decision rule

If you are about to add a new football intelligence engine, recommendation brain, scoring stack, or self-contained model-like subsystem inside `TIBER-Fantasy`, stop and route that work through the external-model adapter pattern instead.
