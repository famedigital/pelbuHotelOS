# Task 2 Report: Button variant attribute for Neo-Glass opt-out

**Date:** 2026-11-02  
**Branch:** `cursor/desk-neo-glass`  
**File modified:** `web/src/components/ui/button.tsx`  
**Commits:** none (per user rule)

## Summary

Added `data-variant={variant ?? "default"}` to the shared `Button` component so Task 1 Neo-Glass CSS can exclude `ghost` and `link` variants from extruded shadow/remap while primary and default buttons receive the raised neo treatment under `.erp`.

## Changes

### Step 1 — Set `data-variant` on Button

Updated the render block in `web/src/components/ui/button.tsx` to match `task-2-brief.md` verbatim:

```tsx
  return (
    <Comp
      data-slot="button"
      data-variant={variant ?? "default"}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
```

- **Behavior:** When `variant` is omitted, CVA already defaults to `"default"`; the attribute mirrors that for CSS attribute selectors.
- **`asChild`:** `data-variant` is set on `Comp` (Slot or `button`), so slotted child elements receive the attribute when `asChild` is true — consistent with existing `data-slot="button"` pattern.

## Verification

### Grep

| Target | Location | Result |
|--------|----------|--------|
| `data-variant={variant ?? "default"}` | `web/src/components/ui/button.tsx:58` | Present |
| CSS consumers | `web/src/app/globals.css` (~1905, ~1915, ~2030, ~2034) | Selectors use `[data-variant="ghost"]` / `[data-variant="link"]` |

Other components (`sidebar`, `dropdown-menu`, etc.) already used `data-variant` for their own purposes; no conflict with Button.

### Typecheck

- `corepack pnpm --dir web run typecheck` — **exit 0** (pnpm install warned about symlink lock; `tsc --noEmit` completed successfully).

### Runtime (optional)

- Not re-verified in browser this session. Task 1 report noted `/erp/day` was reachable; visual check (ghost flat vs primary raised) remains manual QA on desk.

## Self-review

| Check | Result |
|-------|--------|
| Matches brief verbatim | Pass |
| Task 1 CSS can filter ghost/link | Pass — attribute now emitted on all Buttons |
| `defaultVariants.variant: "default"` aligned with `?? "default"` | Pass |
| No new `any`, no TODOs | Pass |
| Linter on modified file | Pass (no diagnostics) |
| No commit | Pass |

### Notes

- Deprecated variants (`gold`, `brass`, `citrus`, `mint`) still pass through as their variant string; they are **not** excluded by Task 1 CSS and will get neo remap (intended for solid/action buttons).
- If a consumer passes `data-variant` via `{...props}` after our explicit prop, React merge order puts explicit `data-variant` first — our value wins (correct).

## Concerns

- **Low:** `asChild` + custom child that is not a single element may behave as today for `data-slot`; no change in Task 2 scope.
- **QA:** Confirm Day toolbar ghost/icon buttons and link-style actions render without neo shadow; primary CTAs show extrusion — best done once on a running dev server.

## Status

**DONE**
