# Production-ready #1 Pelbu ERP (Olakha wave)

**Status:** **Done (implementation)** — Phase 0–6 complete · post-wave fixups landed · residual → [olakha-erp-way-forward.md](olakha-erp-way-forward.md)

**Phase notes (Aug 2026):**
- **Phase 1:** Meal plans on fast book, calendar, agent book, public quote; cancel/no-show policy folio lines (non-MoU); nationality Combobox on check-in; policies/damage/guest pack wired. Guest standalone edit form deferred (check-in only).
- **Phase 2 (polish done):** Amenity par Settings UI (Rooms tab) · HK inline assign attendant · live refresh on rooms + HK board · prior: SKU seed, FO bulk service, checklist+deduct, table/card multi-select, lost-found, calendar badge.
- **Phase 3 (done):** Locations + balances · receive/damage/transfer · PO draft→approve→receive UI · audit start/count/post (mobile-friendly) · location balances on item rows · lite asset register (`accounting_fixed_assets`).
- **Phase 4 (done):** Vendors master + TPN · expense vendor datalist + bulk `vendor_id` · GST BITS A–E month pack + copy + filed · rent expense category + lease fields · bank QR/NEFT proof → `pending_bank` → confirm queue · pay page proof upload · **compliance vault** (Settings → Compliance: categories, upload, lease package refs).
- **Phase 5 (done):** `/erp/kitchen` board (gas, covers, expiry, events, staff shift, food cost tile) · `/erp/kitchen/food-cost` COGS worksheet · role readiness strip on `/erp` (Owner/FO/HK) · `/erp/reports/performance` targets/income/OpEx/agents/countries · staff bulletin **Copy for WhatsApp** on HR notices.
- **Phase 6 (done):** `/erp/training` role-filtered LMS + local checklist · Settings → **Danger zone** owner WIPE (RPC + audit) · HR staff **Form|Sheet** toggle · rota copy/publish pending UX · ERP **NavigationProgress** + `usePendingFeedback` · `order_items` grant revoke · unit tests (cancel policy, meal folio calc, bank proof flow) · HIBP note in GO-LIVE.
- **Inventory nav (Aug 2026):** **Inventory** is its own sidebar module (Items · Locations · Moves · **Assessment** · POs · Assets). **Team** = HR only. Table-first items + staff-defined categories + hotel-wide seed SKUs. Assessment tab → `/erp/inventory/audits` stocktake workflow.
**Source:** [`rates_meals_nationality_7c9e2c95.plan.md`](file:///C:/Users/rajiv/.cursor/plans/rates_meals_nationality_7c9e2c95.plan.md) (Cursor plan)  
**Registered:** [PLANS.md](../PLANS.md)

---

## Implementation phases

| Phase | Focus | Key deliverables |
|-------|--------|------------------|
| **0 — Foundation** | Unblockers + shared UX | Shift outlet CHECK fix · `DeskRowActions` · loading/progress UX · schema stubs |
| **1 — Commercial + FO** | Money + desk core | Meal plans Settings + EP default + folio lines · nationality Combobox · reservations → dossier · fast book express · policies + damage seed + guest pack · MOU free cancel |
| **2 — HK / Rooms** | Housekeeping OS | Amenities stock · mandatory checklist · FO→HK service · calendar colors · rooms table/card multi-select · lost & found |
| **3 — Inventory OS** | Whole-hotel stock | Locations · receive/damage/replace · POs · transfers · audits · assets |
| **4 — Finance / GST** | Compliance money | Vendors TPN · BITS A–E pack · lease rent expense · bank QR/NEFT proof → pending bank → confirm → receipt · compliance vault |
| **5 — Kitchen / F&B + P&L** | Ops + owner view | Kitchen board (gas, covers, expiry, food cost COGS) · readiness dashboards · targets/insights charts |
| **6 — HR / LMS / Polish** | Go-live hardening | Staff Form\|Sheet · Schedule · LMS · danger zone · unit UAT tests · HIBP/RLS · depreciation runs UI *(deferred)* |

**Phase 0 order (now):** (1) shift outlet CHECK → (2) `DeskRowActions` skeleton → (3) global loading UX if quick → (4) migration stubs for Phase 1 only as needed.

**Phase 1 order:** meal default + Settings commercial → nationality → reservations row → fast book → policies/damage/guest pack → MOU cancel wiring.

---

## North star

**Be the #1 solution for a Bhutan boutique hotel** — beat eZee Absolute + aBit, Cloudbeds, and generic PMS on the full desk: Bhutan ops (SDF, guide/driver, agent credit), GST/BITS, inventory+compliance, public PWA+direct book. Not Opera OHIP enterprise worldwide.

**Production-ready** = money paths safe, desk never feels broken, training + wipe + live, credential gates documented and code-ready.

**Money rule (meals):** amount set → quote + folio; `null` = label-only; EP = Nu 0.

**Payments (Olakha):** bank QR / GPay / NEFT + screenshot proof → **Pending bank** (2–3 days) → desk confirms → share receipt. No Channex / Pay.bt required. No WhatsApp/SMS API — Copy for WhatsApp group only.

---

## Section summaries

### A — Reservations: click to open

Row/card click → `/erp/bookings/[id]`; keep status CTA (Check in/out). Same on arrivals boards.

### B — Fast book vs calendar

Calendar = rack brain. Fast book = 30s walk-in with meal/origin defaults.

### C — Prebuilt policies + damage catalog

Settings → Policies tab. Seed complete Pelbu Olakha defaults. **MOU agents = free cancel anytime.** Full damage catalog (lipstick, bindi, linen, amenity…) with Nu placeholders; folio Post damage picker.

### D — Guest check-in pack

Print + Resend from dossier — rules, do's/don'ts, damage prices, stay summary, desk phone/Wi‑Fi from Identity.

### E — Commercial: rates & meals

Settings tab: meal cards (toggle, Nu, default plan) + rate matrix links. Wire priced meals into quote/folio.

### F — Nationality Combobox

ISO countries helper + Combobox on check-in/edit; pin Bhutan/India/…; required for international/regional.

### G — HR: staff submenu + schedule

Nav: Staff · Add staff (Form\|Sheet) · Schedule. **Fix shift outlet CHECK** (maintenance/security/admin). Advanced schedule: templates, copy week, publish.

### H — Build order (reference)

See **Implementation phases** table above; original §H numbered list preserved in Cursor plan for detail.

### I — Inventory OS

Multi-location, table-first desktop, phone-first audits. Receive (qty × price × receipt photo). Damage → replace (transfer or purchase). POs, transfers, audit history. Room amenities as SKUs.

### J — Danger zone (owner)

After training/UAT: type-to-confirm wipe of operational data; keep rooms, rates, policies, staff, compliance.

### K — Global loading UX

Top route progress bar + pending feedback on server actions (`useActionToast` / `usePendingFeedback`). Desk shell first.

### L — Go-live gates

- **L1:** Bank QR/NEFT proof queue (no Channex/Pay.bt)
- **L2:** TPN, meal Nu, bank details enterable anytime via Settings
- **L3:** Explicitly later: live Channex, Pay.bt, DRC e-invoice API, door locks, WhatsApp API

### M — Compliance document vault

Settings → Compliance: seeded + custom categories. Lease packages (agreement, deposit slip, handover inventory snapshot). Monthly rent expense posting.

### N — Gap features (inventory/HK)

Stock transfer · POs · reorder badges · asset register · HK linen checklist · seasons UI · guest pack PDF · lost & found page · maintenance↔stock · role matrix UI.

### O — ERP LMS / role manuals

In-app `/erp/help` or `/erp/training`; role-filtered guides + optional checklist progress.

### P — Monthly RRCO / BITS GST pack

Compute portal fields **A–E**; expense/income schedules + bank stmt for Step 4 upload; copy totals into BITS; mark Filed + store confirmation in vault.

### Q — Competitive gap register (CG-01…16)

Vendor TPN · immigration export · day-1 rent · NA variance pack · cost trends · cashier shift · early/late fees · blacklist · stop-sell · rooming list · agent commission · day-use · rate override audit · HK assign mobile · HIBP/RLS · minibar folio.

### R — Production hardening (PR-01…13)

Balanced journals · reversing voids · Playwright UAT · advisor clean + RLS · role readiness dashboards · spa lite · loyalty earn · calendar Realtime · branded PDFs · bank proof path · LMS → danger wipe.

### S — Row hover actions (`DeskRowActions`)

Shared ⋯ menu; map actions → existing routes/sheets — do not invent one-off chrome per page.

### T — Guest requests + staff bulletin + dept matrix

Elevate in-house tasks on dossier + FO board. Staff bulletin with Copy for WhatsApp. Every department has ERP home (§T3 matrix).

### U — UX quality bar

One job per screen · shared chrome · mobile where work happens · plain English errors · pending never silent · LMS before live.

### V — Room amenities + HK service flow

Teabag/milk/sugar as inventory SKUs. FO request service → calendar colors → HK assign → mandatory checklist → stock deduct. Rooms table/card + multi-select bulk. `/erp/lost-found`.

### W — Department readiness dashboards

Per-role green/amber/red tiles + upcoming + deep links. Owner all-depts strip + ADR/RevPAR flash.

### X — Kitchen / F&B ops board

Gas cylinders · stock OK · grocery/meat/veg + expiry · covers (BF/lunch/dinner) · events · staff on shift · food cost % (COGS formula) · shopping from recipes × covers.

### Y — Owner targets + P&L

Daily/season/year targets vs achieved · income by stream · OpEx (salary, shopping, bills, tax, rent, marketing) · insights: top agents, countries, charts+tables.

---

## Success criteria

- #1 Bhutan boutique bar on features we control; credential gates honest
- Policies + damage + compliance/lease/rent + seasons + GST BITS A–E pack
- Inventory OS with damage/replace, POs, assets; room amenities; HK checklist + FO→HK service; lost & found
- CG-01…16 admin parity · PR production hardening · role readiness dashboards
- Every data row: shared hover/⋯ actions · guest requests on dossier · staff bulletin Copy-for-WhatsApp
- Owner Performance: targets, income/OpEx, top agents & countries
- Training LMS + Danger wipe path documented
- Meals, nationality, FO, Schedule, loading UX as specified
- **No WhatsApp/SMS API**

---

## Related docs

| Doc | Role |
|-----|------|
| [FEATURES.md](../FEATURES.md) | Shipped vs remaining |
| [ERP-AUDIT.md](../ERP-AUDIT.md) | Fault register |
| [GO-LIVE-TOMORROW.md](../GO-LIVE-TOMORROW.md) | Day-1 shift guide |
| [RELEASE-v1.md](../RELEASE-v1.md) | v1 release roll-up |
