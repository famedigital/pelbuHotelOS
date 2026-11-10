# Final Neo-Glass fix report

**Date:** 2026-11-02  
**Scope:** Important findings §1 (Himalayan Dusk / FO contrast) and §2 (opt-outs, print, Occ well) + minor Button spread order.

## A. Himalayan Dusk / FO neo contrast (`globals.css`)

- Split `.fo-command` out of `.dark .erp, .erp.dark` block; added dedicated `.erp[data-desk-theme="dusk"], .fo-command` token block with dark fills, shadows, and `--neo-text: var(--foreground)`.
- Extended `@media (prefers-reduced-transparency: reduce)` with dusk/dark/`.fo-command .neo-card` opaque `#0f172a` paper fallback (light paper rule unchanged for default desk themes).

## B. Opt-outs + print + square Occ well

- `StayHubChrome.tsx`: mobile header `Card` now has `data-neo="off"`.
- Added `@media print` reset for `.neo-card` and `.erp [data-slot="card"]` (no blur/shadow, white background).
- Added `.neo-well.neo-well-flush { border-radius: 0; }`; `RoomRackGrid.tsx` Occ popover strip uses `neo-well neo-well-flush` (removed losing `rounded-none` utility).

## C. Minor

- `button.tsx`: `{...props}` spread before `data-slot` / `data-variant` so component attributes win.

## Verification grep

| Check | Result |
|-------|--------|
| Dusk neo tokens + `--neo-text` on dusk/fo-command | Present at ~1843–1855 |
| `data-neo="off"` call site | `StayHubChrome.tsx` mobile header |
| `neo-well-flush` | `globals.css` + `RoomRackGrid.tsx` |
| `@media print` neo reset | `globals.css` ~2039 |

## Typecheck

```
npm --prefix web run typecheck
exit code: 0
```

## Files touched

- `web/src/app/globals.css`
- `web/src/components/erp/stay-hub/StayHubChrome.tsx`
- `web/src/components/erp/RoomRackGrid.tsx`
- `web/src/components/ui/button.tsx`

## Remaining concerns (not in this pass)

- Print cards on kitchen day-pack / menu / report pages do not yet set `data-neo="off"` individually; global print reset should flatten them.
- `.dark .erp [data-slot="card"]` under reduced-transparency still uses light `#fff` paper unless `.dark .neo-card` or dusk selectors apply; consider `.dark .erp [data-slot="card"]` dark fallback if QA finds light cards in dark mode + reduced transparency.
- Day floor headers `glass-card` + `neo-card` hover shadow jump (review §2) not addressed.
- Glass dialogs still not `.neo-card` (spec vs plan gap, Minor).

**Commit:** None (per instruction).
