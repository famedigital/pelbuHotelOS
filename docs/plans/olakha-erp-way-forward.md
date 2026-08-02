# Olakha ERP — way forward (after production-ready wave)

**Status:** **Phases A–C residual pack landed** (journals + Playwright smoke, FO friction, week packs) on `main` after N+1  
**Last reconciled:** 2026-08-02 residual finish  
**Cursor plan:** `rates_meals_nationality_7c9e2c95.plan.md` (50/71 done) · review `review_uncommitted_wave_3f5a1d06`  
**Wave snapshot:** [olakha-production-ready-erp-wave.md](olakha-production-ready-erp-wave.md)  
**Index:** [PLANS.md](../PLANS.md) · [FEATURES.md](../FEATURES.md)

**Counts (original plan todos):** **50 completed** · residual A–C largely **implemented** · **0 cancelled**  
**N+1 tranche:** landed earlier · **A/B/C residual pack** follows (this doc §1.4)

---

## 1. Where we are

### 1.1 Production-ready wave (Phases 0–6 @ `3108336`)

Boutique desk OS: commercial meals + nationality, FO booking + fast book, policies/damage/guest pack, inventory multi-location OS, HK amenities + checklist + service flow, lost & found, finance vendors/TPN + BITS A–E + bank proof queue + compliance/lease rent, kitchen board + food cost COGS, owner targets/P&L + readiness tiles, HR Form|Sheet + rota, LMS (`/erp/training`), Danger zone wipe, loading progress, desk row actions, staff bulletin Copy-for-WhatsApp.

### 1.2 Post-wave fixups (through `9d3fe3f` on `main`)

| Area | What shipped |
|------|----------------|
| **Laundry** | Public walk-in URLs, desk walk-in intake, production path fixes |
| **Reservations** | Accordion as primary FO booking surface |
| **Agents** | Accordion table + clearer channel nav |
| **Inventory** | Standalone sidebar module; table-first items + Assessment tab |
| **Room rates** | Hotel → Room rates sheet (matrix drives quotes + day-1 post) |
| **POS** | Shift close manager PIN accepts staff Auth PINs |
| **Kitchen** | Prominent meal covers + F&B staff; service feed to FO/POS |
| **HK** | Actionable rooms only; category filters honored |
| **Folio FO-01** | Day-1 room rent at check-in (Settings toggle) + backfill on folio; stay money process strip |
| **GST** | BITS pack client/server split for stable UI |

### 1.3 N+1 tranche (StayHub / NA / HR / DOT / kitchen events / journals)

**Named tranche** after review of ~145 dirty paths vs `9d3fe3f`. Shipped as multi-area commits (FO · Night audit · HR · Finance · Kitchen · DOT/docs) — not a greenfield rebuild of the 71-todo wave.

| Area | What N+1 adds |
|------|----------------|
| **StayHub + FO** | Six-step cycle UI; StayProgressStrip; FolioActionsPanel; boards wired to same process |
| **Night audit** | NightAuditDesk + pipeline; deeper run API |
| **HR / Team** | Personnel file, rota cover templates |
| **Kitchen / POS** | Kitchen events; POS layout/closing growth |
| **Finance** | Hotel accountant rules; journal-proof / posting depth |
| **DOT** | Full `/erp/dot-assessment` + HCS catalogs |

### 1.4 Residual Phases A–C (this finish)

| Phase | What landed |
|-------|-------------|
| **A** | Journal-proof GST shapes + void reverse net-to-zero tests; Playwright smoke pack (`web/e2e`, `npm run test:e2e`) skips cleanly without secrets; build green |
| **B** | Branded guest-pack print CSS; agent voucher print path; guest request kinds + panel; immigration/SDF CSV + incomplete badge; early/late fee policy → checkout; minibar folio picker; rate override reason + `rate.override` audit |
| **C** | Seasons date-range editor on Room rates; agent commission CSV/production columns; NA print shift variance table; guest profile stay history `/erp/guests/[id]` |

**Migration:** `supabase/migrations/20260810090000_phase_abc_residuals.sql` (applied to linked Supabase project).

**Verdict for Olakha:** Wave + N+1 + A/B/C residuals = ops go-live thickness for FO money + desk friction. Still soft/out of scope: Channex live, Pay.bt, WhatsApp API, spa enterprise, agent commission % form editor (column + CSV done).

---

## 2. Money cycle truth (owner version)

```text
Reserve → Confirm → Arrival → Check-in
  → Folio opens + day-1 room (+ meals if priced)
  → Stay/Money: more charges, pay, invoice
  → Night audit: remaining room nights (idempotent)
  → Check-out when balance 0 → room dirty → HK
```

---

## 3. Gaps still open (after A–C)

| Gap | Status |
|-----|--------|
| Journals + reverse voids | **Shipped (proof)** — desk UAT initials still in FINANCE-UAT |
| Playwright critical path | **Smoke shipped** — needs secrets for full run |
| Branded PDF engine | Print improved; PDF attachment soft |
| Guest requests | **Shipped** |
| Immigration / SDF | **Shipped** |
| Early / late fees | **Shipped** |
| Minibar picker | **Shipped** |
| Rate override audit | **Shipped** |
| Seasons editor | **Shipped** |
| Agent commission CSV | **Shipped** (set % on agent row) |
| NA variance pack | Print pack improved |
| Guest stay history | **Shipped** on profile |

### P2 / Phase D — pull if desk asks

Maint stock · cost trends · stop-sell · rooming list · day-use · spa lite · loyalty earn · commission % editor UI.

---

## 4. Explicitly out of scope

Live Channex · Pay.bt · WhatsApp API · door locks · DRC live e-invoice · chain HR biometrics · Stripe SaaS.

---

## Related

| Doc | Role |
|-----|------|
| [FEATURES.md](../FEATURES.md) | Shipped vs partial |
| [GO-LIVE-TOMORROW.md](../GO-LIVE-TOMORROW.md) | Day-1 shift guide |
| [FINANCE-UAT.md](../FINANCE-UAT.md) | Finance sign-off |
