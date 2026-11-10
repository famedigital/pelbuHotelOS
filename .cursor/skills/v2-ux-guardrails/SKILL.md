---
name: v2-ux-guardrails
description: >-
  Lazy-proof / fool-proof UX rules for Hotel OS clean v2/ desk and web.
  Use when editing v2/apps/desk, v2/apps/web, or v2/packages/ui.
---

# v2 UX guardrails

Full text: `docs/v2/UX-GUARDRAILS.md`. Visual: `docs/v2/DESIGN-SYSTEM.md` (Glacier Glass v2.1).

## Must

- Fewest taps; system auto-assigns, auto-tasks, smart prefill where MODULES says so
- Command bar (`Ctrl+K`) with confirm before save
- Impossible actions disabled **with reason + fix button**
- Undo toast (10s) for non-money; money = confirm card + PIN when required + never optimistic
- Every empty state has one primary action
- One table kit: search, filters, saved views, group-by, multi-select, export
- Glass chrome only; **opaque** data cells; AA contrast; reduced-motion/transparency

## Ban

- Thin pages (route + mock table)
- Mock/hardcoded production rows
- Optimistic money success
- Purple brand / brass as only CTA (blue is primary in Glacier)
