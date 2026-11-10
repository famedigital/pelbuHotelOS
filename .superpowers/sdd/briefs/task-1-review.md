# Task 1 Review — Neo-Glass CSS tokens and utilities

**Reviewer:** task-scoped gate  
**Date:** 2026-11-02  
**Diff:** uncommitted `web/src/app/globals.css` (+128 / −4, incl. unrelated dock hunk)

## Spec compliance: ✅

| Category | Notes |
|----------|--------|
| **Delivered** | `--neo-*` on `.erp`; dark / `.fo-command` overrides; `.neo-card`, `.neo-btn`, `.neo-well`; three track gradients; soft remap for `[data-slot="card"]` / `[data-slot="button"]`; a11y extensions in existing `@media` blocks; no commit. |
| **Missing** | None for Task 1 scope (runtime DevTools check claimed in report; not re-run here). |
| **Extra** | `.pb-safe-dock` scoped to `@media (max-width: 767px)` — sensible fix, not in brief; does not conflict with Neo-Glass. |
| **Misunderstood** | None — CSS block matches `task-1-brief.md` verbatim. |
| **⚠️** | Card remap applies `backdrop-filter` to every `.erp [data-slot="card"]` unless `data-neo="off"`. Global constraint (no blur on rack/POS/dense rows) is satisfied *only if* those surfaces opt out or never use card slot — validate in Task 2+ wiring, not a Task 1 miss. |
| **⚠️** | `prefers-reduced-transparency` fallback uses `var(--paper-0, #fff)` for neo cards without a `.dark` branch; same as brief; dark + reduced-transparency may flash light panels until tokens inherit `--paper-0` on root. |

**Global constraints:** Desk-scoped (`.erp`); `--neo-text: var(--foreground)`; reduced-transparency / reduced-motion honored per brief; violet track is spec’d gauge accent, not a marketing theme.

## Code quality: **Approved** (changes optional, none blocking)

| Severity | Finding |
|----------|---------|
| **Critical** | None. |
| **Important** | None blocking merge of this CSS slice. Consider documenting `data-neo="off"` for dense/opaque surfaces in the next task brief so remap does not regress calendar/POS perf. |
| **Minor** | Second `.erp { … }` block merges custom properties with existing L~222 `.erp` — correct cascade, slightly scattered token home. |
| **Minor** | Motion fallback selectors omit `:not([data-neo="off"])` on button remap (matches brief); only matters if “off” buttons should keep transitions — unlikely. |
| **Minor** | Unrelated `pb-safe-dock` hunk in same diff — split in a future commit if you want pure Task 1 history. |

## Strengths

- Faithful, copy-paste-accurate implementation of the brief; no scope creep into TSX or `/book`.
- A11y edits extend **existing** media blocks instead of duplicating `@media` wrappers — maintainable.
- Blur limited to `.neo-card` and card slot remap; buttons get shadow/motion only — aligns with perf guardrails for chrome.
- `[data-pressed="true"]` on `.neo-btn` supports non-`:active` pressed states for touch/accessibility patterns later.
- Implementer report is honest about follow-ups (`data-variant` on buttons, opt-out for dense grids).

## Verdict summary

| Gate | Result |
|------|--------|
| Spec compliance | ✅ |
| Code quality | **Approved** |

Task 1 is **complete** for handoff to Card/Button wiring and gauge call sites (rollout steps 2–3 in design spec).
