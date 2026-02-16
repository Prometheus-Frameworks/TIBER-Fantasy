# Tiber Fantasy — Multi-Agent Onboarding

**Read this file first before starting any task.**

---

## What Is This Project?

Tiber Fantasy is a free, open-source NFL fantasy football analytics platform. It provides FORGE-powered player rankings, Data Lab with advanced metrics, Personnel Grouping Intelligence, X Intelligence Scanner, and more. Full architecture details are in `replit.md`.

## Before You Start Any Task

1. **Read `replit.md`** — Full project architecture, schema, conventions, and feature inventory
2. **Read `.claude/conventions.md`** — Coding patterns, naming rules, and guardrails
3. **Check `.claude/context-log.md`** — See what changed recently across all agents
4. **Check your agent log** — Read your own work log in `.claude/agents/` to see your past contributions
5. **Check other agents' logs** — Skim `.claude/agents/` to see what others have done recently
6. **Run `git log --oneline -15`** — Verify the latest state of the codebase

## Agent Work Logs

Each agent platform has its own work log tracking contributions and session history:

| Agent | Work Log | Role |
|-------|----------|------|
| **Replit Agent** | `.claude/agents/replit-agent.md` | Primary feature builder, UI/UX, frontend/backend implementation |
| **Claude Code** | `.claude/agents/claude-code.md` | Shell-based development, bug fixes, data pipeline work |
| **Codex** | `.claude/agents/codex.md` | PR-based contributions via GitHub, audits, refactors |

## After You Complete a Task

Every agent must do these steps after finishing work:

1. **Append to `.claude/context-log.md`** — Add a timestamped entry:
   ```
   ### YYYY-MM-DD — [Agent Name]: Brief title
   - **What changed:** Summary of changes
   - **Files modified:** List of key files
   - **Validation:** How it was tested/verified
   - **Notes:** Anything the next agent should know
   ```

2. **Update your agent work log** — Append the task to your `.claude/agents/<agent>.md`

3. **Update `replit.md`** if you added new features, changed architecture, or modified conventions

4. **Update `.claude/conventions.md`** if you established new patterns other agents should follow

## Task Specs

Detailed task specifications live in `.claude/tasks/`. Each task file contains:
- Problem description with root cause analysis
- Agent onboarding context (files to read, tables involved)
- Solution approach with ranked options
- Validation criteria with concrete numbers
- Resolution section (added after completion)

## Key Project Files

| File | Purpose |
|------|---------|
| `replit.md` | Project architecture, features, and preferences |
| `shared/schema.ts` | All database models (Drizzle ORM) |
| `server/routes.ts` | Main Express route registration |
| `client/src/App.tsx` | Frontend route registration |
| `client/src/components/TiberLayout.tsx` | Sidebar navigation and layout |
| `client/src/index.css` | Design system and page styles |

## Git Conventions

- Codex works via GitHub PRs on branches named `codex/<task-slug>`
- Claude Code and Replit Agent commit directly to `main`
- Commit messages should be clear and descriptive
- Co-author tags are used when applicable (e.g., `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`)
