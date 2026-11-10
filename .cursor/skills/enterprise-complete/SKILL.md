---
name: enterprise-complete
description: >-
  Hotel OS complete-delivery bar for "v2 complete", full modules, or
  production-ready ERP work. Bans shallow todo finishes, stubs, and gaps.
  Use when the user wants the whole system/module finished enterprise-grade,
  or calls out loopholes / half-done agent output.
---

# Hotel OS — enterprise-complete

Personal skill `enterprise-complete` also applies. This project copy adds
Hotel OS paths.

## When user says complete / v2 / full module

1. Read `docs/v2/ENTERPRISE-SPEC.md`, `docs/v2/IMPLEMENTATION.md`,
   `docs/v2/V1-VS-V2-GAP.md`, and relevant migrations before coding.
2. Deliver all 4 tiers per `docs/architecture/ZERO-SUPERFICIAL-CODE.md`.
3. Money paths → `atomic-ledger-safety` + `pelbu-hotel-ops`.
4. Desk UI → `pelbu-design-system` + `high-perf-glassmorphism` (opaque rack cells).
5. Verify: `pnpm typecheck:v2` and/or `pnpm --dir web run typecheck`; smoke when
   touching desk flows. Do not claim cutover without `docs/v2/CUTOVER.md`.

## Done means

- Wired DB → contract → API/action → UI with real empty/error/loading states
- No `TODO` stubs, mock production arrays, silent catches, or invented columns
- Honest list of remaining gaps if anything is still blocked
