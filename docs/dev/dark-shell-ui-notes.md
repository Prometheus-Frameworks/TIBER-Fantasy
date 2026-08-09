# Dark Shell UI Notes

Developer notes for the unified dark shell (PR #163 and follow-ons).

## CSS Trap: `.tiber-main .rounded-lg[class*="border"][class*="bg-"]`

Located in `client/src/index.css` under `/* shadcn Card overrides */`.

This rule forces `background: var(--bg-primary) !important` on **any element
inside `.tiber-main`** that has all three of:
- a class that is exactly `rounded-lg`
- any class containing the string `border`
- any class containing the string `bg-`

This was added to normalise shadcn `<Card>` components (which use `rounded-lg`)
to the dark theme. The attribute selector is broad enough to catch custom
non-Card panels too.

### Rule

> Always use `rounded-xl` (or larger) for custom dark data cards/panels
> rendered inside TiberLayout. Never combine `rounded-lg` + `border-*` + `bg-*`
> on a plain `<div>`.

### Known past victims

| Element | File | Fix applied |
|---|---|---|
| SummaryStat stat tiles | Data Lab views | `rounded-xl` |
| Rookies "Generated" meta bar | `RookieBoard.tsx` | `rounded-xl` |
| Tiers "Alpha ↓" sort button | `TiberTiers.tsx` | `rounded-xl` |
| PromotedModuleStateCard hints panel | `PromotedModuleStateCard.tsx` | `rounded-xl` |

---

## Outline-button foreground trap (Fantasy #309)

`html, body` set `color: var(--tmd-text, #e2e4e8)` globally, and `--tmd-text` is
never defined, so the fallback always applies. Tailwind Preflight (`@tailwind
base`, v3.4.17) sets `color: inherit` on `button`, so **buttons inherit that
near-white colour** unless something overrides it.

The `outline` variant was the one variant that declared an explicit background
(`bg-background`, white) without declaring a foreground. Result: `#e2e4e8` on
`#ffffff` — **1.27:1**, effectively invisible. That is what the Player Not Found
"Back to Tiers" button looked like.

`outline` now carries `text-foreground` and `border-btn-outline`. `ghost` is
deliberately unchanged: it declares no background, so inheriting the surrounding
surface's colour is correct for it.

### The consequence for call sites

`cn()` uses `twMerge`, so a call site's `bg-*` beats the variant's
`bg-background` while the variant's `text-foreground` survives. **An outline
button placed on a dark surface must therefore set its own `text-*`** — otherwise
it renders near-black text on a dark background.

The same applies to `hover:bg-*`: the variant supplies
`hover:text-accent-foreground` (dark), so a hover that flips to a dark surface
must also override `hover:text-*`.

`client/src/__tests__/outlineButtonSurfaces.test.ts` enforces both rules across
`client/src`, so a new dark-surface outline button that forgets its foreground
fails in CI rather than shipping unreadable.

Sites fixed when the rule was introduced:

| File | What it needed |
|---|---|
| `pages/TiberTiers.tsx` (refresh, retry) | base `text-slate-100` (dark `bg-slate-900/60`) |
| `pages/admin/ApiLexicon.tsx` (×2) | base + hover `text-slate-100` (dark base and hover) |
| `components/tabs/HomeTab.tsx` | `hover:text-white` (light base, dark hover) |
| `pages/ChatHomepage.tsx` | `hover:text-gray-100` |
| `pages/ForgeLabEquationSandbox.tsx` | `hover:text-gray-100` |
| `pages/admin/ForgeSimulation.tsx` (×3) | `hover:text-gray-100` |

The last four were **pre-existing** hover defects — the variant already carried
`hover:text-accent-foreground` before this change — surfaced by the audit.
