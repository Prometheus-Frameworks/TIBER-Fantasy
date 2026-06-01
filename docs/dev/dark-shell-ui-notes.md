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
