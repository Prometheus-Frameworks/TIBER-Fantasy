# Claude Code Task: Frontend Reliability Hardening

## Context
This task addresses the **Friday** section of the PR #26 security audit (`docs/WEEKLY_ROADMAP_2026-02-23.md`). These are frontend bugs that users can hit today. The codebase is a React 18 + TypeScript + Vite app. All frontend source is under `client/src/`.

---

## Task 1 — P0: Replace Hardcoded `2025` Season Values

A `useCurrentNFLWeek()` hook already exists at `client/src/hooks/useCurrentNFLWeek.ts`. It calls `/api/system/current-week` and returns `{ currentWeek, currentSeason, upcomingWeek, isLoading }`.

Replace **every** hardcoded `2025` season reference across frontend pages with the hook's `currentSeason` value. Handle the loading state gracefully (show existing value or skeleton while loading).

**Files and lines to fix (all confirmed):**

| File | Line(s) | Pattern |
|------|---------|---------|
| `client/src/pages/TiberTiers.tsx` | 75 | `const season = 2025;` |
| `client/src/pages/RankingsHub.tsx` | 484, 494 | Hardcoded in fetch URLs |
| `client/src/pages/QBLab.tsx` | 76, 201 | `useState('2025')` + `<SelectItem>` |
| `client/src/pages/RushingLab.tsx` | 76, 209 | `useState('2025')` + `<SelectItem>` |
| `client/src/pages/ReceivingLab.tsx` | 92, 236 | `useState('2025')` + `<SelectItem>` |
| `client/src/pages/SituationalLab.tsx` | 69, 253 | `useState('2025')` + `<SelectItem>` |
| `client/src/pages/ForgeLabEquationSandbox.tsx` | 234, 306 | `useState('2025')` + `<SelectItem>` |
| `client/src/pages/MatchupsPage.tsx` | 235 | `useState(2025)` |
| `client/src/pages/RBRankings.tsx` | 62 | `useState(2025)` |
| `client/src/pages/WRRankings.tsx` | 64 | `useState(2025)` |
| `client/src/pages/PlayerPage.tsx` | 215 | `useState(2025)` |
| `client/src/pages/SchedulePage.tsx` | 63-64, 396-397 | Hardcoded in fetch URLs and queryKeys |
| `client/src/pages/ForgeTransparency.tsx` | 161 | Hardcoded in fetch URL |
| `client/src/pages/PersonnelUsage.tsx` | 183 | Hardcoded in fetch URL |
| `client/src/pages/admin/HomepageRedesign.tsx` | 428 | Hardcoded in fetch URL |
| `client/src/pages/admin/ForgeSimulation.tsx` | 165 | `useState(2025)` |
| `client/src/pages/TeamReportsPage.tsx` | 53, 58 | Hardcoded in queryKey and fallback |
| `client/src/pages/SentinelDashboard.tsx` | 130, 138 | Hardcoded in mock/fallback data |

**Approach:**
- For pages that already import `useCurrentNFLWeek`, use the existing import.
- For pages that don't, add the import: `import { useCurrentNFLWeek } from '@/hooks/useCurrentNFLWeek';`
- For `useState` initializers, initialize with `currentSeason` from the hook (use a `useEffect` to update when it loads, or initialize to current year with `new Date().getFullYear()` as default).
- For `<SelectItem value="2025">` elements, keep them as options but ensure the default selected value comes from the hook.
- Do NOT remove 2025 as a selectable option — users may want to view historical data. Just change the default.

---

## Task 2 — P0: Fix Stale Closure in PlayerPage

**File:** `client/src/pages/PlayerPage.tsx`, lines 257-265

```typescript
const scrollToSection = useCallback((sectionId: SectionId) => {
    const el = sectionRefs.current[sectionId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (collapsedSections[sectionId]) {
        setCollapsedSections(prev => ({ ...prev, [sectionId]: false }));
      }
    }
  }, [collapsedSections]);  // <-- this dependency is WRONG
```

**Problem:** `collapsedSections` in the dependency array causes `scrollToSection` to be recreated on every collapse toggle, AND the closure still captures a stale snapshot when called from event handlers bound before the last state change.

**Fix:** Remove `collapsedSections` from deps. Use the functional updater form so the callback doesn't need the current state at all:

```typescript
const scrollToSection = useCallback((sectionId: SectionId) => {
    const el = sectionRefs.current[sectionId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setCollapsedSections(prev => ({ ...prev, [sectionId]: false }));
    }
  }, []);
```

This always expands the section (which is the correct UX when navigating to it) and avoids the stale closure entirely.

---

## Task 3 — P1: Fix Cache Invalidation

### 3a. Global `staleTime: Infinity`

**File:** `client/src/lib/queryClient.ts`, around line 50

```typescript
staleTime: Infinity,
```

Change to a 5-minute default:

```typescript
staleTime: 5 * 60 * 1000, // 5 minutes default; specific queries can override
```

This ensures data refreshes naturally without breaking queries that explicitly set their own `staleTime`.

### 3b. PlayerPage similar-players cache

**File:** `client/src/pages/PlayerPage.tsx`, around line 368

The 4-hour staleTime is fine for similar players, but verify the `queryKey` includes `playerId` (or the equivalent identifier) so switching between players invalidates the cache. If it doesn't, add it. The queryKey should look like:

```typescript
queryKey: ['/api/some-endpoint', playerId, effectiveWeek],
```

---

## Task 4 — P1: Remove Production Console Logging

**File:** `client/src/App.tsx`, line 100

```typescript
console.log(JSON.stringify({ src:'router', path: location, ts: Date.now() }));
```

Wrap in dev-only guard:

```typescript
if (import.meta.env.DEV) {
  console.log(JSON.stringify({ src:'router', path: location, ts: Date.now() }));
}
```

Also do a sweep: `grep -rn "console\.log" client/src/pages/ client/src/components/` and wrap any non-error console statements that fire in production paths (not in catch blocks) with `import.meta.env.DEV` guards. Leave `console.error` and `console.warn` in catch blocks untouched — those are useful in production.

---

## Task 5 — P2: Accessibility Quick Wins

### 5a. RankingsHub Hidden Gem Card

**File:** `client/src/pages/RankingsHub.tsx`, around lines 374-393

Replace `<div onClick={...}>` with `<button>` for the "Hidden Gem" clickable card. Add appropriate styling to remove default button chrome:

```typescript
<button onClick={...} className="text-left w-full ...existing classes...">
```

### 5b. Icon-Only Button Labels

**File:** `client/src/pages/PlayerPage.tsx`

Search for `<TrendingUp`, `<TrendingDown`, `<AlertTriangle` (and similar lucide-react icons) that are used as clickable elements without text labels. Add `aria-label` props to their parent interactive elements. For example:

```typescript
<button aria-label="View trending up players" ...>
  <TrendingUp />
</button>
```

---

## Task 6 — P2: Component Decomposition

### 6a. Extract CompareDrawerContent from PlayerPage

**File:** `client/src/pages/PlayerPage.tsx`, lines ~1581-1832

Extract the `CompareDrawerContent` component (and any types/interfaces it uses) into a new file: `client/src/components/player/CompareDrawerContent.tsx`

Import it back into `PlayerPage.tsx`. This alone cuts ~250 lines.

### 6b. Extract from WRRankingsSandbox

**File:** `client/src/pages/WRRankingsSandbox.tsx` (2672 lines)

Identify the 2-3 largest inline subcomponents or helper function blocks and extract them:
- Look for components defined inside the main function body
- Look for large `const renderXxx = () => (...)` blocks
- Extract them to `client/src/components/rankings/` as separate files

---

## General Rules

1. **Do NOT modify backend files** — this task is frontend-only.
2. **Do NOT modify `vite.config.ts` or `package.json`.**
3. **Preserve all existing functionality** — these are refactors and bug fixes, not feature changes.
4. **Run `npx tsc --noEmit` after all changes** to verify no type errors were introduced.
5. **Use existing patterns** — follow the import style, naming conventions, and component patterns already in the codebase.
6. **Commit message format:** `fix(frontend): reliability hardening — season values, stale closures, a11y, decomposition`

---

## Verification

After completing all tasks, confirm:
- [ ] `npx tsc --noEmit` passes with no new errors
- [ ] `grep -rn "= 2025" client/src/pages/` returns zero matches (except inside `<SelectItem>` options for historical data)
- [ ] `grep -rn "season=2025" client/src/pages/` returns zero matches
- [ ] The app loads without console errors in the browser
- [ ] Navigating between pages shows no runtime crashes
