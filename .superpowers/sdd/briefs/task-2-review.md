# Task 2 Review — Button `data-variant` (Neo-Glass opt-out)

**Spec:** ✅ — Diff matches `task-2-brief.md` verbatim: `data-variant={variant ?? "default"}` on `Comp` with `data-slot="button"`, aligned with CVA `defaultVariants.variant`.

**Quality:** Approved (minor doc nit)

**Findings**
- Task 1 wiring confirmed: `.erp [data-slot="button"]:not([data-variant="ghost"]):not([data-variant="link"])` in `globals.css` (~1905–2034); desk-scoped Neo-Glass only.
- `variant ?? "default"` mirrors omitted variant; deprecated solids (`gold`, `citrus`, etc.) emit correct strings for CSS inclusion.
- `asChild` follows existing `data-slot` pattern; no repo usage of `<Button data-variant=…>` override.
- Brief Step 2 (Day toolbar visual QA) not run this session — attribute/CSS path is sufficient; manual check on `/erp/day` still recommended.
- Report self-review claim that explicit `data-variant` wins over `{...props}` is **incorrect** (`{...props}` is last and would override); harmless today, no callers override.

**Verdict:** Ship Task 2 as-is; optional follow-up: fix report note or move `data-variant` after spread if override hardening is desired.
