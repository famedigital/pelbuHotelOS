# Task 3 Report: Wire candy-track wells on desk gauges

**Branch:** `cursor/desk-neo-glass`  
**Date:** 2026-11-02  
**Commit:** None (per instructions)

## Summary

Wired `.neo-well` recess tracks and candy gradients (`.track-gradient-mint|coral|violet`) onto five existing desk gauge surfaces per `task-3-brief.md`. Rack timeline cells were not touched; only the month-stat occupancy popover bottom strip uses neo-well.

## Files changed

| File | Change |
|------|--------|
| `web/src/components/erp/FoCommandDesk.tsx` | `FoMetricCard` track → `neo-well` + default `track-gradient-mint`; caller `barClassName` mapped from `bg-*` to coral/mint |
| `web/src/components/erp/AgentCockpitBoard.tsx` | Figure bars → `neo-well` + warn/coral vs mint |
| `web/src/components/erp/setup/PropertySetupModalShell.tsx` | Setup progress → `neo-well` + `track-gradient-violet` (width from existing `pct`) |
| `web/src/components/erp/stay-hub/StayHubCashierDock.tsx` | Binary folio due status strip above guest-stream row |
| `web/src/components/erp/RoomRackGrid.tsx` | Occ popover fill only: threshold-based coral/violet/mint |

## FoCommandDesk caller mapping

| Metric | `barClassName` |
|--------|----------------|
| Expected arrivals | (default mint) |
| Occupancy | `track-gradient-mint` |
| Clean rooms | `track-gradient-mint` (healthy/clean) |
| Departures | `track-gradient-coral` |
| Tomorrow checkout | `track-gradient-coral` |

## Verification (grep)

```
neo-well in erp components: FoCommandDesk, AgentCockpitBoard, PropertySetupModalShell, StayHubCashierDock, RoomRackGrid (popover strip only)
track-gradient-*: present in all five targets
RoomRackGrid: neo-well only at ~2207; no neo-card or backdrop-filter added in this file
FoCommandDesk: no bg-sky/emerald/amber on metric bars (pills/dots unchanged)
```

## Typecheck / visual

- `pnpm --dir web run typecheck`: not run — `pnpm` unavailable in agent shell PATH.
- Browser visual verify (`/erp/day`, StayHub, FO home, agent cockpit): not run in this session; recommend manual spot-check for well glow and flat rack cells.

## Self-review

- Brief snippets followed verbatim; `PropertySetupModalShell` uses existing `pct` variable.
- StayHub strip is full-width binary mint/coral (intentional per brief).
- `occupancyTone().bar` still used on rack grid cells (~660); popover strip no longer uses `tone.bar` — threshold gradients instead.
- No commits, no rack cell glass/blur regression introduced in diff scope.

## Concerns / follow-ups

- Low: unused `tone.bar` for popover cards only — harmless; tone still used for `card`/`value` classes.
- Run typecheck locally before merge if CI depends on it.

## Review fix (Important)

- **Finding:** Clean rooms used `track-gradient-coral`; coral is reserved for warn/unpaid/dirty stress metrics.
- **Fix:** `FoCommandDesk.tsx` — Clean rooms `FoMetricCard` → `barClassName="track-gradient-mint"`. Departures and Tomorrow checkout remain coral.

**Grep proof (Clean rooms mint; departures/tomorrow coral):**

```
130:        barClassName="track-gradient-mint"   (Clean rooms)
138:        barClassName="track-gradient-coral"  (Departures)
146:        barClassName="track-gradient-coral"  (Tomorrow checkout)
```
