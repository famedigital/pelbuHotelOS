# Task 4 Review — Spec + Quality

**Spec:** ❌ (partial)  
**Quality:** Changes requested

## Findings

1. **Brief met:** `neo-card` added on StayHub cashier dock shell and RoomDayBoard floor KPI `glass-card` header; toast class left alone; no commit; typecheck exit 0 via `npm --prefix web run typecheck` (pnpm missing — acceptable fallback).
2. **Brief exceeded:** `StayHubCashierDock` adds a `neo-well` / track-gradient strip not listed in the brief; **report omits this** — doc drift.
3. **Dock bar logic:** Progress fill uses `width: "100%"` for both clear and due — color-only indicator, not balance proportion; reads as decorative or unfinished.
4. **Neo-Glass / rack:** Room row cells unchanged (`glass-badge-*` only); no `neo-card` on rack cells — **no blur on rack cells** ✅.
5. **KPI shell:** Floor-group header is elevated chrome (not rack grid) — stacking `glass-card` + `neo-card` matches soft-migration intent; accept double-blur risk on that shell only.
6. **Verify:** Browser visual regression still unverified (report acknowledges).

## Required before approve

- Either remove the undeclared `neo-well` block **or** document it in the report and wire width from `guestDue` / settlement state (not constant 100%).
- Align report with actual diff.
