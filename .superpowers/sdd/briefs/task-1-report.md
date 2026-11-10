# Task 1 Report: Neo-Glass CSS tokens and utilities

**Date:** 2026-11-02  
**Branch:** `cursor/desk-neo-glass`  
**File modified:** `web/src/app/globals.css`  
**Commits:** none (per user rule)

## Summary

Implemented Desk Neo-Glass CSS tokens, utility classes, soft remap selectors for `[data-slot="card"]` and `[data-slot="button"]`, gauge track gradients, and accessibility fallbacks for `prefers-reduced-transparency` and `prefers-reduced-motion` exactly as specified in `task-1-brief.md`.

## Changes

### Step 1 — Neo-Glass token block

Inserted after the status stripe utilities (`.stripe-violet`) and before `.glass-dock-mobile` (~line 1815).

- **Tokens on `.erp`:** `--neo-fill`, `--neo-rim`, `--neo-text`, `--neo-shadow-out`, `--neo-shadow-in`, `--neo-specular`, `--neo-blur`
- **Dark / FO overrides:** `.dark .erp`, `.erp.dark`, `.fo-command` with dark neo token values
- **Utilities:** `.neo-card`, `.neo-btn` (+ `:active` / `[data-pressed="true"]`), `.neo-well`
- **Track gradients:** `.track-gradient-coral`, `.track-gradient-mint`, `.track-gradient-violet`
- **Soft remap:** `.erp [data-slot="card"]:not([data-neo="off"])` and button selectors excluding ghost/link and `[data-neo="off"]`

All CSS values match the brief verbatim.

### Step 2 — a11y fallbacks

Extended **existing** media query blocks (did not duplicate `@media` wrappers):

1. `@media (prefers-reduced-transparency: reduce)` — added `.neo-card` and `.erp [data-slot="card"]:not([data-neo="off"])` with opaque `var(--paper-0, #fff)` and no backdrop-filter.
2. `@media (prefers-reduced-motion: reduce)` — added `.neo-btn` and button remap selectors with `transition: none` and `transform: none` on active states.

## Verification

### Grep (globals.css)

| Target | Present |
|--------|---------|
| `.neo-card` | Yes (~1844, ~2007 in a11y) |
| `.neo-btn` | Yes (~1856, ~2029 in a11y) |
| `.neo-well` | Yes (~1871) |
| `.track-gradient-coral` | Yes (~1879) |
| `.track-gradient-mint` | Yes (~1884) |
| `.track-gradient-violet` | Yes (~1889) |
| `--neo-fill` | Yes (~1817, ~1833, usages) |
| a11y card selectors | Yes (~2007–2012) |
| a11y button motion | Yes (~2029–2036) |

### Runtime (optional)

- Dev server: `http://localhost:3000/erp/day` returned HTTP 200.
- CDP on `.erp`: `--neo-fill` resolves to non-empty `#ffffffd1` (browser-normalized equivalent of `rgba(255, 255, 255, 0.82)`).

## Self-review

| Check | Result |
|-------|--------|
| Desk-only scope (tokens under `.erp`, remap scoped to `.erp`) | Pass |
| No blur added to rack cells / POS grids / dense tables | Pass — only card utilities and card slot remap use blur |
| `prefers-reduced-transparency` honored for neo cards | Pass |
| `prefers-reduced-motion` honored for neo buttons | Pass |
| Verbatim values from brief | Pass |
| No commit | Pass |
| Second `.erp` block for tokens (existing `.erp` at L222 unchanged) | Intentional per brief; cascade merges custom properties |

### Notes for later tasks

- Button remap uses `[data-variant="ghost"]` / `[data-variant="link"]` — Task brief for Button `data-variant` wiring will need components to expose those attributes for remap to apply correctly.
- `.neo-well` and track gradients are defined but not yet used in TSX (expected in later gauge/KPI tasks).
- Card soft remap will affect all `[data-slot="card"]` under `.erp` unless `data-neo="off"` — verify dense/opaque surfaces opt out in follow-up tasks if needed.

## Concerns

- **Minor:** Live DevTools serialized `--neo-fill` as hex, not `rgba(...)` string; behavior is correct.
- **Follow-up:** Confirm calendar rack cells and POS grids either omit `[data-slot="card"]` or set `data-neo="off"` so blur is not applied to high-density grids (global constraint; not in Task 1 scope but worth validating in Task 2+).

## Status

**DONE**
