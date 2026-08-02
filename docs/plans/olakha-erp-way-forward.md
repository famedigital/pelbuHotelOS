# Olakha ERP — way forward (after production-ready wave)

**Status:** **In progress** — wave Phases 0–6 done; post-wave fixups on `main` through `9d3fe3f`; **N+1 tranche** (StayHub / NA / HR / DOT / kitchen events / journals) stabilized below  
**Last reconciled:** 2026-08-03 (review plan: uncommitted wave vs production)  
**Cursor plan:** `rates_meals_nationality_7c9e2c95.plan.md` (50/71 done) · review `review_uncommitted_wave_3f5a1d06`  
**Wave snapshot:** [olakha-production-ready-erp-wave.md](olakha-production-ready-erp-wave.md)  
**Index:** [PLANS.md](../PLANS.md) · [FEATURES.md](../FEATURES.md)

**Counts (original plan todos):** **50 completed** · **21 residual** · **0 cancelled**  
**N+1 tranche:** landed in multi-commit push after quality gate (see §1.3)

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
| **StayHub + FO** | Six-step cycle UI (Reserve → Confirm → Arrival → CI → Stay/Money → CO); StayProgressStrip; FolioActionsPanel; NewReservationLauncher / FastBookDialog; board pages wired to same process |
| **Night audit** | NightAuditDesk + pipeline/list steps; deeper run API; replaces thin NightAuditForm |
| **HR / Team** | Personnel file, Staff dossier/inline add, rota cover templates migration + editor |
| **Kitchen / POS** | Kitchen events (time/menu/ops/bills); POS layout/closing/how-to growth |
| **Finance** | Hotel accountant rules migration; journal-proof / posting / hotel-account depth |
| **DOT** | Full `/erp/dot-assessment` + HCS catalogs (Hotel nav) |

**Maps to residuals:** partial `pr-money-journals`, FO cycle education, partial NA packing, advanced HR/schedule. Does **not** finish Playwright, PDFs, minibar, immigration export, etc.

**Verdict for Olakha:** Wave + post-wave usable live; N+1 deepens FO system-of-record, NA, HR, and money trust. Remaining work is **Playwright smoke**, **FO extras (P1)**, and **week packs (P2)** — not a rebuild.

---

## 2. Money cycle truth (owner version)

```text
Reserve → Confirm → Arrival → Check-in
  → Folio opens + day-1 room (+ meals if priced)
  → Stay/Money: more charges, pay, invoice
  → Night audit: remaining room nights (idempotent)
  → Check-out when balance 0 → room dirty → HK
```

| Moment | What guest sees on folio |
|--------|---------------------------|
| Just checked in | At least **day-1 room** (+ meal if priced). Not “empty Nu 0”. |
| Later nights | **Night audit** — not silent auto every night without close |
| Manual fix | Folio → **Post day-1 room + meals** or **Post room night** |
| Settled | Payment confirmed; tax invoice / receipt when issued |

**Not required for Olakha money:** Channex live, Pay.bt, WhatsApp/SMS API.

StayHub should **encode this cycle everywhere** (calendar modal + reservations accordion + list boards) — not only calendar.

---

## 3. Gaps still open (residual after N+1)

### P0 — money trust & go-live confidence

| Gap | Plan id | Status after N+1 |
|-----|---------|------------------|
| **Balanced journals + reversing voids** | `pr-money-journals` | **Partial** — journal-proof + posting deepened; still need full-path UAT |
| **Playwright critical path** | `pr-playwright-uat` | **Open** — unit tests only |
| **FO money UX** | ops / StayHub | **Much stronger in N+1** — keep coaching + LMS |

### P1 — desk ops

| Gap | Plan id | Notes |
|-----|---------|--------|
| **Branded PDF** guest pack + agent voucher | `branded-pdf-pack`, `pr-branded-pdfs` | Still soft |
| **Guest requests on dossier** | `guest-requests-elevate` | Wake-up exists; expand kinds |
| **Immigration / SDF export** + incomplete badge | `cg-immigration-export` | Open |
| **Early / late fees** | `cg-early-late-fees` | Open |
| **Minibar / amenity folio picker** | `cg-minibar-folio` | Open |
| **Rate override reason + audit** | `cg-rate-override-audit` | Soft |
| **Seasons date-range editor** | `seasons-settings` | Open |
| **Agent commission CSV** | `cg-agent-commission` | Open |
| **Night audit variance PDF** | `cg-na-variance-pack` | **Partial** — pipeline better; PDF pack soft |

### P2 — later when desk asks

Maint stock issue · cost trends · stop-sell rack · rooming list · day-use · guest history · spa lite · loyalty earn · calendar Realtime · full readiness depths.

---

## 4. Recommended next phases (Olakha ops)

Each phase **2–5 days**. Do **not** restart the old 71-todo wave.

### Phase A finish — Money path proof (2–4 days) — **do next**

1. Finish folio/POS/laundry/void → journal balance & reversing voids where still open.
2. **Playwright smoke:** book → check-in (assert day-1 line) → pay → NA → checkout; POS settle; laundry bill.
3. Owner dry-run with LMS + optional Danger wipe on non-prod.

**Exit:** Owner trusts Nu paths; browser pack is the safety net.

### Phase B finish — FO desk friction (3–5 days)

1. Branded PDF guest pack + agent voucher.
2. Dossier **Requests** + kinds.
3. Immigration/SDF export + passport badge.
4. Minibar quick charge; early/late fees.
5. Rate override reason + audit.

### Phase C — Close the week packs (2–4 days)

Seasons editor · agent commission CSV · NA variance PDF · guest stay history.

### Phase D — Ops connective (3–5 days, pull if desk asks)

Maint→stock · cost trends lite · day-use / rooming / stop-sell · loyalty earn / spa lite.

### Phase E — Harden & document (continuous)

LMS / GO-LIVE / FINANCE-UAT · optional Realtime · Channex/Pay.bt only with keys.

---

## 5. Explicitly out of scope

| Item | Why |
|------|-----|
| **Live Channex / OTA** | Not subscribed |
| **Pay.bt** | Bank QR + NEFT proof is the path |
| **WhatsApp / SMS API** | Copy for WhatsApp only |
| **Door locks / kiosk API** | Enterprise class |
| **DRC live e-invoice** | Stub until mandate |
| **Chain HR biometrics** | BTCL scale |
| **Stripe SaaS** | Foundation only |

---

## 6. Immediate next two

1. **Phase A finish** — journals UAT + Playwright.  
2. **Phase B finish** — PDF/export + requests + minibar + fees.

---

## Related

| Doc | Role |
|-----|------|
| [olakha-production-ready-erp-wave.md](olakha-production-ready-erp-wave.md) | Wave 0–6 snapshot |
| [FEATURES.md](../FEATURES.md) | Shipped vs partial |
| [GO-LIVE-TOMORROW.md](../GO-LIVE-TOMORROW.md) | Day-1 shift guide |
| [ERP-AUDIT.md](../ERP-AUDIT.md) | Fault register |
| [FINANCE-UAT.md](../FINANCE-UAT.md) | Finance sign-off |
| Cursor `rates_meals_nationality_7c9e2c95` | Original 71 todos |
