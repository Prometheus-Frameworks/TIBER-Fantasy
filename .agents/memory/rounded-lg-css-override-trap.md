---
name: rounded-lg CSS override trap in tiber-main
description: A broad CSS rule in index.css nukes bg-* on any rounded-lg element that also has a border class, forcing it to white (--bg-primary). Always use rounded-xl for custom dark cards inside TiberLayout.
---

## Rule

`client/src/index.css` contains this shadcn Card override:

```css
.tiber-main .rounded-lg[class*="border"][class*="bg-"] {
  background: var(--bg-primary) !important;  /* = #ffffff */
  border-color: var(--border) !important;
  color: var(--text-primary) !important;
}
```

Any element rendered inside `.tiber-main` that has **all three**:
- `rounded-lg` (exact class name match)
- any class containing `border`
- any class containing `bg-`

…gets its background forced to white, regardless of what Tailwind dark color you applied.

**Why:** The rule was added to normalize shadcn `<Card>` components (which use `rounded-lg`) to the dark theme. It is too broad and catches custom non-Card dark panels.

**How to apply:** Always use `rounded-xl`, `rounded-2xl`, or `rounded-3xl` for custom dark data cards/panels inside TiberLayout. Never use `rounded-lg` on a div that also has `border-*` and `bg-*` Tailwind classes. This affected: SummaryStat cards, Rookies "Generated" meta bar, and TiberTiers "Alpha" sort button.
