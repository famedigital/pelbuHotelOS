# eZee FO parity — plan status (2026-08-11 close)

**Cursor plan:** `C:\Users\rajiv\.cursor\plans\ezee_res_gaps_8b5b7d45.plan.md`  
**Inventory:** [docs/competitive/ezee-screenshot-inventory.md](../competitive/ezee-screenshot-inventory.md) · [ezee-controls.csv](../competitive/ezee-controls.csv)

---

## Scoreboard

| Phase | Status |
|-------|--------|
| A–B research inventory | **Done** |
| Product **P0** (desk list / book / print / tax / clean unit) | **Done** (commission plan matrix = partial by design) |
| Product **P1** residual reports + CRM + sharers list | **Done** |
| Product **P2** practical (wake-up / follow-up / message on StayHub) | **Done** (via `inhouse_tasks`) |
| Operator §15 capture + re-ingest | **Ops** (not code) |
| Explicitly **not built** (defer forever-or-later) | Auto-release cron · FC currency folio · full 112 eZee report tree · 3-step wizards · Centrix/Mint |

---

## Phase A–B — Research (done)

| ID | Status |
|----|--------|
| shot-register · control/report/format matrices · capture checklist · pelbu map · ship docs | **Done** |

---

## Product P0 — **Done**

| # | Item | Status |
|---|------|--------|
| 1 | Res list density | Done |
| 2 | Per-night rate/tax grid | Done (read-only) |
| 3 | Book tax mode/exempt | Done |
| 4 | Release fields + deposit-due worklist | Done (no auto-release worker) |
| 5 | Stay print pack | Done |
| 6 | Clean unit pick | Done |
| 7 | Commission / source matrix | Partial (tier + %) |
| 8 | Res list print + CSV | Done |

---

## Product P1 — **Done**

| Item | Status | Where |
|------|--------|--------|
| Transport / visa lite | Done | StayHub More |
| DNR / house use | Done | StayHub More |
| Audit strip + next-res | Done | StayHub |
| Deposit-due + cancellations | Done | reports |
| Meal count | Done | `/erp/reports/meal-count` |
| FO occupancy | Done | `/erp/reports/fo-occupancy` |
| Room move audit | Done | `/erp/reports/room-moves` |
| Guest AR aging slabs | Done | `/erp/reports/guest-ar-aging` |
| Multi-guest names on stay | Done | StayHub Guest list |
| Guest CRM advanced filters | Done | `/erp/guests` origin/status/flag/dates |
| CSV + Print on reports | Done | export + Print button |
| Settlement Cash/Credit | Partial pre-existing StayHub Collect/AR | |

---

## Product P2 practical — **Done**

| Item | Status | Notes |
|------|--------|-------|
| Wake-up | Done | `inhouse_tasks` + StayHub More + `/erp/in-house` |
| Follow-up | Done | task kind |
| Guest message | Done | task kind |
| Guest Message center / phone directory / Live Support / FC / M-Pesa / condo | **Defer** | not boutique day-1 |

---

## Liberally deferred (do not block launch)

- Auto free inventory by release %/day (needs policy + NA safety)
- Foreign-currency folio prints
- Full eZee report name parity (~112)
- Operator still fills `Eze Screens/capture/` §15 for modules never photographed

---

## Do not clone

3-step walk-in · eZee chrome · 100-report checklist as v1.
