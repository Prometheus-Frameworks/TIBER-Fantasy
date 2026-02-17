# Governance Pack — Unresolved References

Created: February 17, 2026

## UNKNOWN: Lint Script

**File:** `/manus/MANUS_CONTEXT.md` line 31
**Issue:** No `lint` script exists in `package.json`. The `scripts` section has `dev`, `build`, `start`, `test`, `typecheck`, `db:push`, `db:studio`, `test:forge`, `db:generate`, `db:migrate`, `seed:metric-matrix`, `audit:metric-matrix`, `qa:gold` — but no `lint` or `eslint` command.

**Action needed:** Either add an ESLint config + lint script to `package.json`, or decide linting is out of scope for this phase. If adding, suggested script:
```json
"lint": "eslint . --ext .ts,.tsx"
```

**GitHub Issue required:** Per AGENT_BOOTSTRAP.md rules, a GitHub Issue should be opened with:
- Title: `chore: missing lint script in package.json`
- Body: No lint script found in package.json. MANUS_CONTEXT.md lists this as UNKNOWN. Either add ESLint config + lint script, or document that linting is out of scope for the Stabilization phase.
- Note: Automated issue creation failed (GITHUB_TOKEN lacks issue-creation scope). Owner should create this issue manually.

## Notes

- `<<AUTO-LIST>>` in `/manus/PR_TEMPLATE.md` is intentional — it's a template placeholder for PR authors to fill in, not a repo reference.
- All other `<<VERIFY>>` and `<<FILL_FROM_REPO>>` placeholders were resolved with verified paths and commands from the actual repo.
