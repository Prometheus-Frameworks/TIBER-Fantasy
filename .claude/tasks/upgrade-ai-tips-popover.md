# Task: Upgrade AI Tips Popover — Expandable Prompts with Copy-to-Clipboard

**Priority:** Medium (UX enhancement, no backend changes)
**Module:** AI Tips Popover (`client/src/components/AiPromptHints.tsx`)
**Agent Onboarding:** Read `.claude/AGENTS.md` → `replit.md` → `.claude/conventions.md` → this spec.

---

## Tiber Agent Onboarding Context

### Project Architecture Quick Reference
- **Frontend:** React 18, TypeScript, Tailwind CSS, TanStack Query, shadcn/ui
- **Design System:** Light mode, Ember accent (`#e2640d`), three-font system (Instrument Sans for UI, JetBrains Mono for data/code, Newsreader for editorial)
- **Route registration:** `client/src/App.tsx` (wouter router)
- **Component conventions:** Tailwind classes preferred over inline styles, lucide-react for icons

### Files You Must Read First
1. `replit.md` — Full project context, architecture, design system
2. `.claude/conventions.md` — Coding patterns and guardrails
3. `client/src/components/AiPromptHints.tsx` — **Current component being replaced**
4. `client/src/pages/ReceivingLab.tsx` — Primary consumer (lines 245-257 for usage)
5. `client/src/pages/RushingLab.tsx` — Consumer (lines 218-230)
6. `client/src/pages/QBLab.tsx` — Consumer (lines 210-223)
7. `client/src/pages/RedZoneLab.tsx` — Consumer (lines 213-225)
8. `client/src/pages/SituationalLab.tsx` — Consumer (lines 262-274)
9. `client/src/lib/csvExport.ts` — CSV export with `MODULE_SAMPLE_PROMPTS` (related context)

### How to Run / Test
- **Start app:** `npm run dev` (Express + Vite on port 5000)
- **View in browser:** Navigate to `/tiber-data-lab/receiving` (or any lab module)
- **Test interaction:** Click "AI Tips" button → expand a prompt → click "Copy full prompt"

---

## Problem Description

The current `AiPromptHints` component is a simple hover/click popover that shows one-line prompt suggestions as plain text bullets. It has no:

- **Expandable prompt previews** — Users can't see what they'll actually paste
- **Copy-to-clipboard** — Users have to manually select and copy text
- **Category tags** — No visual grouping by prompt type (Efficiency, Breakout, etc.)
- **Rich prompt content** — Current prompts are single-sentence ideas, not fully structured step-by-step prompts ready for AI agents

The upgrade replaces this with a richer popover where each tip has a short label, a category tag, an expandable preview of the full multi-step prompt, and a one-click copy button.

---

## Current State

### Current Component API (`AiPromptHints.tsx`)
```tsx
interface AiPromptHintsProps {
  accentColor: string;    // e.g. "#7c3aed"
  prompts: string[];      // Array of one-line prompt suggestions
}
export function AiPromptHints({ accentColor, prompts }: AiPromptHintsProps)
```

### Current Usage (example from ReceivingLab.tsx, line 248)
```tsx
<AiPromptHints
  accentColor="#7c3aed"
  prompts={[
    "Build a target quality model using aDOT, EPA/target, and YPRR — rank the top 10 most efficient receivers",
    "Cluster these WRs by route profile (deep/intermediate/short splits) and identify which archetype has the highest ceiling",
    "Create a breakout candidate score using WOPR, YAC over expected, and catch rate vs league average",
    "Compare RACR vs YPRR to find receivers who are volume-dependent vs truly efficient",
    "Spot hidden gems: filter for low-volume WRs (<80 targets) with top-20 EPA/target + positive YAC over Expected — who's elite but overlooked?",
  ]}
/>
```

### All 5 Module Accent Colors
| Module | Route | Accent Color |
|--------|-------|-------------|
| Receiving Lab | `/tiber-data-lab/receiving` | `#7c3aed` (violet) |
| Rushing Lab | `/tiber-data-lab/rushing` | `#16a34a` (green) |
| QB Lab | `/tiber-data-lab/qb` | `#9333ea` (purple) |
| Red Zone Lab | `/tiber-data-lab/red-zone` | `#dc2626` (red) |
| Situational Lab | `/tiber-data-lab/situational` | `#ca8a04` (amber) |

---

## Solution: What to Build

### 1. New Component API

Replace the current `AiPromptHints` with a new version that uses structured prompts with labels, tags, and full copy-paste content. The new component should be self-contained — prompt definitions live **inside the component file** organized by module key, not passed as props from each lab page.

**New API:**
```tsx
interface AiPromptHintsProps {
  accentColor: string;
  module: string;  // key into PROMPTS_BY_MODULE (e.g., "wr_receiving", "rb_rushing", etc.)
}
```

### 2. Prompt Data Structure

Each prompt should have:
```tsx
interface PromptDef {
  label: string;   // Short text shown in the popover (1 line)
  tag: string;     // Category badge (e.g., "Efficiency", "Breakout", "Route Analysis")
  prompt: string;  // Full multi-paragraph copy-paste prompt with steps
}
```

### 3. WR Receiving Prompts (provided — use these exactly)

The reference file at `attached_assets/Pasted-import-useState-useRef-useEffect-from-react-TIBER-Data-_1771262385057.txt` contains the exact `wr_receiving` prompts to use. There are 4 prompts:

1. **"Rank the top 10 most efficient receivers using a target quality model"** (tag: Efficiency)
   - Uses aDOT, EPA/target, YPRR with weighted composite scoring
2. **"Cluster WRs by route profile and find which archetype produces the highest EPA"** (tag: Route Analysis)
   - Deep/Intermediate/Short archetype classification
3. **"Score breakout candidates using WOPR, YAC over Expected, and Catch Rate"** (tag: Breakout)
   - Composite breakout score formula
4. **"Compare RACR vs YPRR to separate volume-dependent from truly efficient WRs"** (tag: Efficiency)
   - Four-quadrant classification system

### 4. Other Module Prompts — Claude Code Should Write These

Write equivalent structured prompts for the other 4 modules following the same quality bar. Each module should have 4 prompts. Use the existing one-line prompts (listed below) as starting inspiration, but expand them into full multi-step prompts like the WR examples:

**Rushing Lab (module key: `rb_rushing`)** — Current one-liners:
- Build a rushing efficiency model using YPC, rush EPA, and stuff rate
- Analyze gap distribution (left/middle/right) vs success rate
- Create a workload sustainability score using rush attempts, snap count, and receiving involvement
- Flag RBs whose inside success rate diverges from outside

**QB Lab (module key: `qb_lab`)** — Current one-liners:
- Build a QB process score using CPOE, EPA/play, and success rate
- Correlate shotgun rate and no-huddle rate with efficiency
- Create a pressure-adjusted model using sack rate, QB hit rate, and scramble production
- Rank QBs by deep pass rate vs aDOT

**Red Zone Lab (module key: `rz_redzone`)** — Current one-liners:
- Build a TD equity model using RZ snap rate, RZ target share, and RZ success rate
- Identify TD regression candidates by comparing RZ opportunities vs actual TDs
- Cross-reference RZ rush attempts with RZ receiving TDs
- Create a scoring upside tier list by weighting RZ snap rate and TD conversion efficiency

**Situational Lab (module key: `sit_situational`)** — Current one-liners:
- Build a clutch performer index using 3rd down conversion rate, 2-minute success rate, and hurry-up production
- Identify game-script-proof players whose early-down and late-down success rates are both above average
- Create a closer score for WR/TEs using 2-minute targets and receptions
- Compare short yardage conversion rate vs overall success rate

### 5. UX Behavior

- **Trigger:** Click "AI Tips" button to open popover (not hover)
- **Close:** Click outside the popover, or click the trigger again
- **Expand:** Click a prompt label row to expand and show the preview + copy button
- **Copy:** Click "Copy full prompt" → copies the full prompt text → button shows checkmark + "Copied!" for ~1.8 seconds
- **Collapse:** Click the same label row again to collapse, or expand a different one

### 6. Styling Requirements

- **Must use Tailwind CSS classes** (not inline style objects). The reference file uses inline styles — convert these to Tailwind equivalents.
- **Accent color** should come from the `accentColor` prop, applied via inline `style` only where Tailwind can't handle dynamic colors (e.g., `style={{ color: accentColor }}`).
- **Font family** should follow the Tiber design system: use existing Tailwind font classes. The monospace preview uses `font-mono` (JetBrains Mono).
- **Popover width:** ~420px (`w-[420px]`)
- **Tag badges** use the accent color with a light background tint
- **Close on outside click** using a `useEffect` with `mousedown` listener

### 7. Update Lab Pages

After building the new component, update all 5 lab pages to use the new API:

**Before (each lab page):**
```tsx
import { AiPromptHints } from '@/components/AiPromptHints';
// ...
<AiPromptHints
  accentColor="#7c3aed"
  prompts={["one-liner 1", "one-liner 2", ...]}
/>
```

**After (each lab page):**
```tsx
import { AiPromptHints } from '@/components/AiPromptHints';
// ...
<AiPromptHints
  accentColor="#7c3aed"
  module="wr_receiving"
/>
```

Module key mapping for each page:
| Page | module prop |
|------|------------|
| `ReceivingLab.tsx` | `"wr_receiving"` |
| `RushingLab.tsx` | `"rb_rushing"` |
| `QBLab.tsx` | `"qb_lab"` |
| `RedZoneLab.tsx` | `"rz_redzone"` |
| `SituationalLab.tsx` | `"sit_situational"` |

---

## CSV Column Reference

When writing prompts, reference the actual column names from the CSV exports so the AI agent can find them. Here are the key columns per module:

**Receiving Lab (45 columns):** Player, Team, Position, Games Played, Snaps, Snap Share %, Targets, Target Share %, Receptions, Rec Yards, Rec TDs, Rec First Downs, aDOT, EPA/Target, Catch Rate %, Yards/Target, YPRR, TPRR, FP/Route, 1st Downs/Route, WOPR, RACR, xYAC, YAC over Expected, xYAC Success %, YAC/Rec, Deep Target %, Intermediate Target %, Short Target %, Left Target %, Middle Target %, Right Target %, Slot Rate %, Inline Rate %, Routes Run, Route Rate %, Air Yards, YAC, Air EPA, Comp Air EPA, Success Rate %, EPA/Play, Fantasy Points (Std), Fantasy Points (Half), Fantasy Points (PPR)

**Rushing Lab (34 columns):** Player, Team, Position, Games Played, Snaps, Snap Share %, Rush Attempts, Rush Yards, Rush TDs, YPC, Rush EPA, Stuff Rate %, Stuffed, Rush First Downs, Rush 1st Down Rate %, Inside Run %, Outside Run %, Inside Success %, Outside Success %, Left Run %, Middle Run %, Right Run %, Targets, Receptions, Rec Yards, Rec TDs, Catch Rate %, YAC/Rec, Success Rate %, EPA/Play, Fantasy Points (Std), Fantasy Points (Half), Fantasy Points (PPR)

**QB Lab (33 columns):** Player, Team, Games Played, Dropbacks, CPOE, ANY/A, FP/Dropback, EPA/Play, Success Rate %, Sacks, Sack Rate %, Sack Yards, QB Hits, QB Hit Rate %, Deep Pass Attempts, Deep Pass %, aDOT, Shotgun %, No Huddle %, Shotgun Success %, Under Center Success %, Pass First Downs, Pass 1st Down Rate %, Scrambles, Scramble Yards, Scramble TDs, Rush Attempts, Rush Yards, Rush TDs, Rush EPA, Fantasy Points (Std), Fantasy Points (Half), Fantasy Points (PPR)

**Red Zone Lab (25 columns):** Player, Team, Position, Games Played, Total Snaps, RZ Snaps, RZ Snap Rate %, RZ Success Rate %, RZ Targets, RZ Receptions, RZ Receiving TDs, RZ Target Share %, RZ Catch Rate %, RZ Rush Attempts, RZ Rush TDs, RZ Rush TD Rate %, RZ Pass Attempts, RZ Pass TDs, RZ TD Rate %, RZ Interceptions, Total Rec TDs, Total Rush TDs, Fantasy Points (Std), Fantasy Points (Half), Fantasy Points (PPR)

**Situational Lab (29 columns):** Player, Team, Position, Games Played, Total Snaps, 3rd Down Snaps, 3rd Down Conversions, 3rd Down Conv %, Early Down Success %, Late Down Success %, Short Yardage Attempts, Short Yardage Conversions, Short Yardage Rate %, 3rd Down Targets, 3rd Down Receptions, 3rd Down Rec Conversions, 2-Min Snaps, 2-Min Successful, 2-Min Success %, 2-Min Targets, 2-Min Receptions, Hurry-Up Snaps, Hurry-Up Successful, Hurry-Up Success %, Overall Success %, Fantasy Points (Std), Fantasy Points (Half), Fantasy Points (PPR)

---

## Validation Criteria

1. **Component renders** — "AI Tips" button appears on all 5 lab pages in the toolbar area
2. **Popover opens/closes** — Click to open, click outside or click again to close
3. **Prompts display** — Each module shows 4 prompts with labels and category tags
4. **Expand/collapse** — Clicking a prompt row shows a code-style preview of the full prompt
5. **Copy works** — "Copy full prompt" copies the entire prompt text, shows "Copied!" feedback
6. **Accent colors** — Each module's tags and bullets use its accent color
7. **Tailwind styling** — No inline style objects except for dynamic accent color application
8. **TypeScript** — Component is properly typed (no `any`, no `// @ts-ignore`)
9. **No regressions** — CSV export buttons still work, lab tables still render

---

## Resolution

*(To be filled in by the completing agent)*

- **Agent:**
- **Date:**
- **What was done:**
- **Files modified:**
- **Validation results:**
