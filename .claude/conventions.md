# Tiber Fantasy — Coding Conventions

These are the rules and patterns every agent must follow. Extracted from `replit.md` and established through project history.

---

## Backend Conventions

### Module Structure
New backend features go in `server/modules/<name>/`:
```
server/modules/<name>/
  ├── <name>Service.ts    — Core business logic and DB queries
  ├── <name>Classifier.ts — Classification/grading logic (if applicable)
  └── MODULE.md           — Purpose, inputs, outputs, notes
```
Routes go in `server/routes/<name>Routes.ts` and register in `server/routes.ts`.

### SQL Style
- Use raw SQL via `db.execute(sql.raw(...))` for complex aggregations (CTEs, window functions, etc.)
- Use Drizzle ORM query builder for simple CRUD
- Never write manual SQL migrations — use `npm run db:push` (or `npm run db:push --force` if data-loss warning)

### API Validation
- Use Zod schemas for request validation (see `server/routes/personnelRoutes.ts` for example)
- Return consistent JSON error shapes: `{ error: string, details?: any }`

### Player Identity
- Always use GSIS format for player IDs: `00-XXXXXXX`
- Resolve player names/positions via `player_identity_map` table
- Never hardcode player names — always JOIN from identity table

### Database Schema
- All models defined in `shared/schema.ts`
- Use `createInsertSchema` from `drizzle-zod` for insert validation
- Array columns: use `.array()` method (e.g., `text().array()`) not wrapper function

## Frontend Conventions

### Routing
- Use `wouter` for client-side routing
- Pages go in `client/src/pages/`
- Register routes in `client/src/App.tsx`
- Navigation entries in `client/src/components/TiberLayout.tsx`

### Data Fetching
- Use `@tanstack/react-query` (v5, object form only)
- Default fetcher is pre-configured — don't define custom `queryFn` for GET requests
- Mutations use `apiRequest` from `@lib/queryClient`
- Always invalidate cache after mutations

### Styling
- Light mode design system (no dark mode)
- Colors: white bg `#ffffff`, secondary `#fafafa`, tertiary `#f4f4f4`, ember accent `#e2640d`
- Three fonts: Instrument Sans (UI), JetBrains Mono (data/code), Newsreader (editorial)
- Use CSS custom properties from `:root` in `index.css`
- Page-specific styles use prefixed class names (e.g., `pu-*` for Personnel Usage)
- Use shadcn + Tailwind CSS for components

### Component Patterns
- Forms: use shadcn's `useForm` hook with `zodResolver`
- Icons: `lucide-react` for actions, `react-icons/si` for company logos
- Show loading/skeleton states while queries are pending
- Toast notifications via `useToast` from `@/hooks/use-toast`

## Naming Conventions

| Thing | Pattern | Example |
|-------|---------|---------|
| DB tables | `snake_case` | `bronze_nflfastr_plays` |
| TS interfaces | `PascalCase` | `PlayerPersonnelProfile` |
| API routes | `/api/<module>/<action>` | `/api/personnel/profile` |
| CSS class prefix | `<2-3 letter page abbrev>-` | `pu-card`, `fw-panel` |
| Module folders | `camelCase` | `server/modules/personnel/` |
| Task specs | `kebab-case.md` | `.claude/tasks/fix-personnel-undercounting.md` |

## Guardrails

- **Never modify** `vite.config.ts`, `server/vite.ts`, or `drizzle.config.ts`
- **Never edit** `package.json` scripts without explicit approval
- **Never expose** secrets or API keys in code or logs
- **Never break** existing features — FORGE, Tiers, Data Lab, etc. are independent modules
- **Never use** Docker, virtual environments, or containerization (Nix environment)
- **Always bind** frontend servers to `0.0.0.0:5000`
- **Always test** API endpoints via curl before marking tasks complete
- **Position scope:** Skill positions only — QB, RB, WR, TE. No kickers, defense, or linemen.
