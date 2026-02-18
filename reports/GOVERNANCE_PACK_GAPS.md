# Governance Pack — Unresolved References

Created: February 17, 2026

## RESOLVED: Lint Script

**File:** `/manus/MANUS_CONTEXT.md`
**Status:** Resolved on February 17, 2026
**Resolution:** Added `"lint": "npx eslint ."` to `package.json`. Migrated `.eslintrc.json` to flat config format (`eslint.config.js`) for ESLint v10 compatibility. Installed `@typescript-eslint/parser` for TypeScript support.

**CI command order:**
1. `npm run typecheck`
2. `npm run test`
3. `npm run lint`

## Notes

- `<<AUTO-LIST>>` in `/manus/PR_TEMPLATE.md` is intentional — it's a template placeholder for PR authors to fill in, not a repo reference.
- All `<<VERIFY>>` and `<<FILL_FROM_REPO>>` placeholders have been resolved with verified paths and commands from the actual repo.
- No unresolved references remain.
