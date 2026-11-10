# Final review — Desk Neo-Glass (Approach A)

**Branch:** `cursor/desk-neo-glass` (uncommitted working tree vs HEAD)  
**Spec:** `docs/superpowers/specs/2026-11-02-desk-neo-glass-design.md`  
**Plan:** `docs/superpowers/plans/2026-11-02-desk-neo-glass.md`  
**Package:** `.superpowers/sdd/briefs/final-review-pkg.md` (8 files, +166 / −18)  
**Date:** 2026-11-02  
**Mode:** Read-only. Tree not modified except this review.

## Verdict

**Hold merge.** Tasks 1–4 are implemented and match the plan’s CSS and gauge snippets. Default Dzong desk chrome, ghost/link exclusion, and rack-cell opacity are in good shape. Do not merge until Himalayan Dusk contrast is fixed and flat/print cards can actually opt out of the unlayered remap. No Critical (money, auth, or tenant) defects.

---

## Strengths

- Token block, utilities, card/button remap, and both a11y media extensions match the plan’s CSS, including placement inside the existing `prefers-reduced-transparency` and `prefers-reduced-motion` blocks.
- `Button` emits `data-variant={variant ?? "default"}`, which lines up with CVA `defaultVariants`, so ghost and link stay out of the extruded rule when nothing overwrites the attribute.
- Gauge call sites match Task 3: FO metrics, Agent cockpit (`warn` → coral, else mint), setup progress (violet, existing `progressbar` name and value), StayHub binary clear/due strip, rack Occ popover thresholds only.
- Room rack timeline cells, calendar day cells, and POS item grids are untouched. `neo-well` on the Occ popover is the 2px footer of the month-stat chip, not a rack cell. Room Day room rows stay opaque `bg-card`.
- StayHub dock and Room Day floor headers add `neo-card` beside existing glass classes. Glass utilities are not deleted.
- Staff shell and desk shell both root at `.erp`, so tokens cover `/erp` and `/staff`. Public `/book` does not receive the remap.
- `.fo-command` is always rendered with `dark` (`FoCommandScope`). Dark neo fills on that shell match the plan. FO metric copy uses explicit `text-white` / `text-slate-400`, not `--neo-text`.
- Setup track keeps `role="progressbar"` and `aria-label`. No schema, folio, or payment code in the diff.
- `data-neo="off"` is a real opt-out in the selectors, even though no call site sets it yet.

---

## Critical

None.

---

## Important

### 1. Himalayan Dusk fails the spec’s contrast rule

`DESK_THEMES` includes `dusk` (“Night desk”). `DeskShell` sets `data-desk-theme="dusk"` on `.erp`. That skin sets `--foreground: #f4efe6` and `--background: #141820`.

Neo fill does not follow it. Dark fills are only on `.dark .erp`, `.erp.dark`, and `.fo-command`. Dusk is none of those, so every remapped card and `.neo-card` keeps the light fill `rgba(255, 255, 255, 0.82)` while `--neo-text` resolves to the light dusk foreground. Light text on a near-white frost fails WCAG AA. The spec requires espresso text at ≥ 4.5:1 on neo surfaces.

`prefers-reduced-transparency` makes this worse: `.neo-card` and the card remap force `background: var(--paper-0, #fff)` with no dusk/dark neo branch. `--paper-0` on `:root` is `#f7fbfd`. A `.dark .glass-happy-card` override exists and is more specific than `.neo-card` alone, but it does not match dusk, and `.erp [data-slot="card"]` (specificity 0,3,0) beats `.dark .glass-happy-card` (0,2,0) when both match.

Dzong, brass, and cedar stay dark-on-light and are fine. FO command pages do not render `data-slot="card"` today, so a second failure mode is latent: `--neo-text` is substituted on the ancestor `.erp` and inherited as a computed espresso color into `.fo-command`, which does set a dark `--neo-fill`. Any future Card inside the command skin would be dark-on-dark until `--neo-text` is rebound on `.fo-command`.

**Fix:** Drive `--neo-fill` / shadows / `--neo-text` from the same skins as the desk (`data-desk-theme="dusk"`, `.fo-command`, and reduced-transparency). Rebind `--neo-text: var(--foreground)` on those nodes so it is not a computed color inherited from a light ancestor. Give reduced-transparency a dark paper fallback for dusk and `.dark`.

### 2. Unlayered remap beats Tailwind opt-outs, including print and flush chrome

`globals.css` is unlayered after `@import "tailwindcss"`. `.neo-card`, `.neo-well`, and `.erp [data-slot="card"]` therefore beat utility classes on the same properties.

Consequences already in the tree:

- `StayHubChrome` mobile header is a `Card` with `shadow-none`, `border-x-0`, `border-t-0`. Inside `.erp` it gains neo fill, a full rim, extruded shadow, and `backdrop-filter`. There is no `data-neo="off"` anywhere in `web/src`.
- Print cards lose author utilities. `web/src/app/erp/kitchen/day-pack/page.tsx` uses `print:border-black` on a `Card`. Print CSS does not reset `.neo-card` or the card remap, so kitchen day-pack, menu print, and report cards can print frost, blur, and shadow.
- Occ popover `rounded-none` on `.neo-well` does not apply. `.neo-well { border-radius: 9999px }` wins, so the 2px strip stays a pill. The plan snippet expected a square footer.
- Day floor headers combine `glass-card` and `neo-card`. `.glass-card:hover` (0,2,0) overrides `.neo-card` (0,1,0), so hover jumps back to the blue glass shadow.

The remap is what the plan specified, and rack/POS/table rows still do not use `data-slot="card"` (checked: no `Card` in `RoomRackGrid`, `web/src/components/erp/calendar`, or `web/src/components/erp/pos`). The hole is that the documented opt-out is unused, so flush chrome and print cannot stay flat.

**Fix:** Set `data-neo="off"` on flush headers, print cards, and any other card that must stay opaque. Add a `@media print` reset that drops neo blur and shadow. If the Occ footer must be square, set `border-radius` in a selector that wins over `.neo-well` (not a layered `rounded-*` utility).

---

## Minor

### Button spreads `{...props}` after `data-variant` (carry-forward)

```55:61:web/src/components/ui/button.tsx
  return (
    <Comp
      data-slot="button"
      data-variant={variant ?? "default"}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
```

A caller `data-variant` (or a forwarded prop bag) replaces the variant the CSS filter trusts. No current `<Button data-variant=…>` call site. `asChild` still works when the child does not set the attribute. Spread props first, then set `data-slot` and `data-variant`.

### StayHub due strip is `aria-hidden` (carry-forward)

`StayHubCashierDock` uses the plan’s binary strip: full mint when `|guestDue| ≤ 0.5`, else full coral, `width` always `"100%"` (`clear ? "100%" : "100%"`). `aria-hidden` is valid in JSX and matches the plan. Guest-stream text still says “clear” or the amount, so color is not the only cue. It is a weaker pattern than setup’s `progressbar`. Optional: `role="img"` plus a label, or drop the dead ternary. Do not treat the constant width as a bug; the plan calls the binary track intentional.

### Candy glow is clipped

`.track-gradient-*` sets `box-shadow: 0 0 10px …` on the fill. `.neo-well` is `overflow: hidden`, so the glow cannot paint outside the channel. The gradient still shows. Task 3’s “wells glow” check will only see the gradient.

### `.neo-btn` is never applied

Pressed sink and `border-color: color-mix(...)` live on `.neo-btn` / `[data-pressed="true"]`. Desk buttons only get the attribute remap, which has `:active` but not `[data-pressed="true"]` and no border mix. Toggle buttons that stay pressed will not stay inset. Outline and icon buttons that are not ghost/link will extrude, which the spec allows and which will thicken the Day toolbar (`variant="outline"`).

### Glass dialogs are not `.neo-card`

Spec in-scope item 1 names glass dialogs with the dock and Day KPI shells. Task 4 only adds the class on `StayHubCashierDock` and the Room Day group header. Dialogs stay on `.glass-elevated` / `.glass-happy-modal`. That matches the plan’s file list and misses the broader spec sentence. Approach A said to extend glass, not replace it, so this is incomplete spec coverage, not a plan miss.

### Stale task-3 note

An earlier task review said the clean-rooms bar was always coral. This tree sets `barClassName="track-gradient-mint"` for Clean rooms and Occupancy, and coral for Departures and Tomorrow checkout. That matches the spec (mint = clean / healthy occupancy, coral = stress / departures). Rack Occ still switches coral ≥ 80% and violet ≥ 50%. The two gauges disagree on purpose; both match the plan snippets.

---

## Plan alignment

| Task | Status |
|------|--------|
| 1 — tokens, `.neo-card` / `.neo-btn` / `.neo-well`, tracks, remap, a11y media | Done. CSS matches the plan block. |
| 1 Step 3 — DevTools `--neo-fill` on `/erp/day` | Not evidenced in this package. Not re-run (read-only review). |
| 2 — `data-variant` on Button | Done, with the spread-order minor above. |
| 2 Step 2 — ghost flat, primary sinks | Not visually confirmed here. Selector logic is correct if `data-variant` survives. |
| 3 — five gauge sites, rack cells excluded | Done. Snippets match, including binary StayHub width. |
| 3 Step 6 — browse Day, StayHub, FO, Agent, rack cells flat | Not evidenced. |
| 4 — `neo-card` on dock and Day KPI shell | Done. Room rows not included. |
| 4 Step 2 — typecheck | Task 4 review reported `npm --prefix web run typecheck` exit 0 (`pnpm` missing). Not re-run here. Diff is class names plus one attribute; no new types. |
| Commits | None. Correct per plan and repo rule. |

Out of scope held: no neo blur on rack cells, calendar cells, POS grids, or table body rows. `/book` untouched.

**Ignored hunk:** `.pb-safe-dock` is wrapped in `@media (max-width: 767px)` in the same `globals.css` edit. Braces around the neo block stay balanced. It does not change Neo-Glass. It does change layout: from `md` up, that class no longer adds dock padding. Leave it out of the Neo-Glass judgment; confirm it on its own before a shared commit. No Innora component hunks in this package.

---

## Spec coverage

| Requirement | Result |
|-------------|--------|
| Soft layer under `.erp` / staff, public booking out | Met |
| Tokens, three utilities, coral/mint/violet | Met |
| Card and non-ghost/link button remap | Met, with cascade and dusk gaps |
| Occupancy, folio, setup wells | Met |
| StayHub dock and Day KPI `.neo-card` | Met |
| Glass dialogs → `.neo-card` | Not done (plan did not list those files) |
| Rack, POS, dense rows stay opaque | Met for current markup |
| Reduced transparency / motion | Present; transparency fallback is light-only |
| WCAG AA espresso on neo surfaces | Met on Dzong/brass/cedar. Fails on Dusk |
| No new marketing theme, no money/schema | Met |

---

## Merge readiness

**Not merge-ready.**

Ship after:

1. Dusk (and `.fo-command`) neo fill, shadow, and `--neo-text` stay readable at 4.5:1, including `prefers-reduced-transparency`.
2. `data-neo="off"` on flush and print cards, plus a print reset so day-pack / menu / report cards do not frost.
3. A short visual pass: `/erp/day` (ghost toolbar flat, KPI header raised, room rows flat), StayHub dock on an in-house stay, FO metrics, Agent cockpit, Occ popover, and the same screens with desk theme Dusk.

Then the two minors (Button prop order, StayHub `aria-hidden`) can land in the same patch or as an immediate follow-up. They are not the reason to hold.

No commit was made. This review did not mutate source files.
