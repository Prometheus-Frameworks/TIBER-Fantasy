# Governance Pack — Validation Gaps

Created: February 17, 2026
Last verified against repository state: August 24, 2026

## OPEN: Lint and repository-wide CI enforcement

**File:** `/manus/MANUS_CONTEXT.md`
**Status:** Open

The earlier record claimed that a `lint` script, `eslint.config.js`, and `@typescript-eslint/parser` had been added on February 17. Those items are not present in the current repository:

- `package.json` has no `lint` script;
- `eslint.config.js` is absent;
- no workflow enforces lint;
- the existing Ratings QA and Sleeper Sync workflows are path-scoped, while Security Audit is advisory-only.

The `Core Build` workflow added with this correction is intentionally narrower and truthful: it runs `npm ci` and the deployment-equivalent `sh build.sh` for every pull request and push to `main`. That build bundles the server, compiles the Vite frontend, and installs the production bootstrap.

## Still unresolved

- repository-wide `npm run test` enforcement;
- repository-wide `npm run typecheck` enforcement;
- an actual lint command and ESLint configuration;
- the direct `window.location` rule and existing violations tracked in issue #287;
- repair or retirement of stale path-scoped workflows whose declared paths or commands no longer match the repository.

Do not describe these items as resolved until the corresponding command exists, is proven against the current baseline, and is mechanically enforced at the claimed boundary.

## Verified local commands

1. `npm run build` (server bundle only)
2. `sh build.sh` (deployment-equivalent server, frontend, and bootstrap build)
3. `npm run typecheck`
4. `npm run test`

`typecheck` and the full test suite remain available local commands; their presence here does not claim that current CI runs or passes them.

## Notes

- `<<AUTO-LIST>>` in `/manus/PR_TEMPLATE.md` is intentional — it is a template placeholder for PR authors to fill in, not a repo reference.
- Validation claims must be checked against current files and workflow behavior rather than inherited from this historical governance pack.
