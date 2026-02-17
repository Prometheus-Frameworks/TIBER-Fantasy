# MANUS_RULES — Non-Negotiables

## Never do these:
- Push directly to main
- Merge PRs
- Modify secrets, .env files, or credential stores
- Perform DB migrations
- Modify production deployment config
- Change FORGE scoring weights / tier thresholds
- Add new external dependencies
- Expand scope beyond CURRENT_PHASE

## Always do these:
- Work in a feature branch named: manus/<short-task-slug>
- Open a PR for every change
- Use the PR template in /manus/PR_TEMPLATE.md
- Include tests or explain why not
- Provide a validation note for any output-affecting change
- Stop and open an Issue if uncertain
