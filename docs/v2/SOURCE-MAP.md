# Hotel OS v2 — Source map (Merge · Copy · Reinvent · Leave out · Migrate)

> **Canonical build bible.** Every wave PR must cite a row here.
> Source: Claude plan `room-list-show-in-whimsical-mochi.md` §7.
> Rule: nothing is imported at runtime from Innora `web/` or root `apps/*` / `packages/*`. **Copy** = re-type into `v2/` with the v1 file open.

## Doctrine

| Verb | Meaning |
|---|---|
| **MERGE** | Many v1 versions of one job → **one** v2 module (best of each). |
| **COPY** | Proven self-contained logic/tests/layouts → re-type into `v2/packages/*` (+ tests). |
| **REINVENT** | v1/Wave design caused bugs or doesn't fit event-driven `v2` schema → new design. |
| **INCLUDED** | Owner kept Website/CMS/Marketing/AI/Supabase plumbing (mix of Copy + Reinvent). |
| **LEAVE OUT** | Stays in v1 or dies with Waves. |
| **MIGRATE** | Data at cutover, not code. |

**Thin-page ban:** a route + title + mock table is not a module. See module-done gate in [`IMPLEMENTATION.md`](./IMPLEMENTATION.md).

---

## 7.1 MERGE (many v1 versions → one v2 module)

| v2 module | v1 pieces merged | Keep from each |
|---|---|---|
| **Reservations: `createReservation` + `quote`** | `web/src/lib/fast-book.ts`, `bookings.ts`, `erp-calendar.ts` (single + group create), `agent-book.ts`, `desk-book-preview.ts`, `erp-holds.ts` | Fast Book speed/preview; calendar group create; agent hold + expiry; holds board |
| **Desk** | `/erp/day` (DayDesk), `/erp/today`, `/arrivals`, `/in-house`, `/departures`, `/stays`, `/bookings`, `/check-in`, `/check-out` | DayDesk tabs + guide/agent columns; one-tap check-in |
| **StayView: `assignRooms` / `moveRoom`** | `lib/room-assignments.ts`, `assignBookingRoomUnit` (party), `stay-room-assign.ts`, `erp-room-shift.ts`, `erp-vacancies.ts`, `erp-room-map.ts` | Auto-fill; room-shift reasons; vacancy finder |
| **Checkout: `settleCheckout`** | `confirmCheckOut` (`erp-checkin.ts`), `checkoutStayAtomic` (`folio-cashier.ts`), `packages/core` `settleStayCheckout` | Guide gate + early/late fees; StayHub UX |
| **Finance: fiscal docs** | `stayhub_checkout_atomic`, `issueFolioInvoice`, `issueRoomTaxInvoiceAndReceipt`, POS agent tender | One service: PSBN per folio, INV per POS bill |
| **Finance screens** | `/bills`, `/pos/bills`, `/invoices`, `/unpaid-bills`, `/folios`, `/payments`, `/finance`, `erp-accounting.ts`, `erp-settlement-pack.ts`, `scripts/bank-recon/` | Settlement pack; bank-recon matching rules |
| **KDS** | `/kds`, `/kds/pass`, `/kds/bar`, `/kitchen/board`, `/kitchen` (meal covers) | One board + station filter + covers tab |
| **Laundry** | `erp-laundry.ts`, `erp-laundry-slip.ts`, `laundry.ts`, `staff-laundry.ts`, `laundry-bags.ts` | Bag workflow + issue labels; **one** folio posting with property tax |
| **Housekeeping** | `/housekeeping`, `/hk`, `/maintenance`, `/lost-found`, `/rooms`; `erp-ops.ts` + `erp-hk.ts` | Checklist, quick-clean, bulk tasks |
| **Rates** | `/rates`, `/rate-plans`, `/rate-approvals`, `erp-rate-sheets.ts`, `rate-packages.ts`, `child-packages.ts` | Packages and child rules; approvals |
| **Agents + `/partner` portal** | `/erp/agents` (+ dossier, statement, call-tasks, confirmed, rate-downloads), `/erp/partners`, `/erp/allotments`, `/agents/app`, `/agents/portal`, marketplace `/agents` | Stays columns/filters, XLSX, statements, voucher, call tasks; allotments → Groups |
| **Groups** | `/erp/group`, `erp-reservations-party.ts`, `erp-party-master-bill.ts`, `ReservationsPartyBoard` | Party grouping, rooming list, master bill |
| **Settings** | `/settings`, `/properties`, `/menu`, `/rooms`, `erp-building-layout.ts`, `erp-property-media.ts` | Building/room map; menu admin |
| **HR** | `/hr`, `erp-hr.ts`, `erp-rota.ts`, `erp-payroll.ts`, `staff-leave.ts`, `attendance.ts`, `zk-adms*` | Rota, leave, payroll sheet, biometric |
| **Compliance** | `/compliance`, `/gst`, `/dot-assessment`, `lib/compliance-pack`, `lib/gst`, RRCO files | Report formats and DOT checklist |

---

## 7.2 COPY (re-type into `v2/`)

| What | v1 source | Destination under `v2/` |
|---|---|---|
| SC → GST compound math, rounding | `packages/core/src/pricing.ts` `calculateRoomNightTax` (**fix**: GST from property = 5%, 3 entry modes) | `packages/domain/src/tax` |
| Meal-plan pricing (EP/CP/MAP/AP, child rules) | `web/src/lib/meal-plans-calc.ts` (+test), `child-packages.ts` | `packages/domain/src/rates` |
| Business date, stay dates | `web/src/lib/business-date.ts`, `stay-dates.ts` | `packages/domain/src/dates` |
| Document numbers, booking refs, guide numbers | `hotel-doc-no.ts`, `booking-ref.ts`, `guide-number.ts`, `order-ref.ts` (+tests) | `packages/domain/src/numbering` |
| Check-in rules + undo window | `checkin-rules.ts`, `checkin-undo.ts` (+tests) | `packages/domain/src/stay` |
| Cancellation/no-show fee policy | `lib/folio/policy-fee.ts` | `packages/domain/src/policy` |
| Party grouping key | `lib/erp/reservation-party.ts` | `packages/domain/src/groups` |
| Manager PIN core | `web/src/lib/manager-pin-core.ts` (+test) | `packages/domain/src/auth` |
| POS rules | `pos-tenders.ts`, `pos-void-reasons.ts`, `pos-ticket.ts`, `kot-visibility.ts`, `pos-receipt-message.ts`, `pos-training.ts` (+tests) | `packages/domain/src/pos` |
| Laundry pricing, bag states, issue labels | `laundry.ts`, `laundry-issue-labels.ts` (+test) | `packages/domain/src/laundry` |
| Payroll (salary, allowances, deductions, SC tip pool) | `lib/payroll/*`, `erp-payroll.ts` | `packages/domain/src/payroll` |
| mBoB / bank QR | `lib/bank-qr/*` | `packages/domain/src/payments` |
| Biometric ZK ADMS | `zk-adms.ts`, `zk-adms-server.ts` (+test) | `apps/api/src/integrations/zk` |
| Thermal + A4 print templates | `lib/print/*`, `desk-print.ts`, `agent-rate-pdf.ts`, `menu-print-templates.ts`, root `packages/hardware` | `packages/hardware` + `apps/api/src/print` |
| Report definitions | `lib/reports/*`, compliance-pack, settlement pack | `apps/api/src/modules/reports` (queries rewritten for schema `v2`) |
| Agent portal table/filters/XLSX/statement | `AgentStaysTable.tsx`, `AgentStaysFilterToolbar.tsx`, `api/agents/stays/export` | `apps/desk` `/partner` UI |
| Countries, validation, Dzongkha/English | `countries.ts`, `validation.ts` | `packages/domain/src/ref` |
| Cloudinary signed upload | `cloudinary-direct-upload.ts`, `cloudinary-upload.ts` | `apps/api/src/storage` |
| **From today's Waves (UI shells only — not money/sync)** | `packages/ui/*` tokens/PIN/palette/TactileButton/Odometer/FastBook/StayHub/POS layout; `packages/engine/wal-db.ts` (drafts only); `apps/api/src/auth.ts`; idempotency helper | `packages/ui`, `packages/sync` (drafts **only** — money online-only), `apps/api` auth |
| v1 tests for COPY rows (~40) | matching `*.test.ts` | `packages/domain/**/*.test.ts` |

**Do not COPY:** 15s desk snapshot, RAM money WAL replay, client-sent POS prices, silent empty-catch desk hydration, dual checkout paths.

---

## 7.3 REINVENT

| Area | Why v1/Waves can't be copied | v2 design |
|---|---|---|
| Data model | 214 migrations; one folio both payers; gross/net ambiguity; assignments never released | Clean Drizzle in schema `v2`; folio per payer; net-only rates; `active` assignments; `version` |
| Rate entry | Incoherent GST-only mode; toggles re-read same number | 3 entry modes; toggles = applicability; one `quote()` |
| Room assignment | Delete-then-insert; day-before rule; 4 paths | Transactional per-line assign/move; future allowed; unassigned lane |
| Fiscal numbering | 2 series; stale mid-stay invoices | PSBN per folio at checkout; INV per POS bill; proforma mid-stay; void+reissue |
| Checkout | 2 paths; gate skipped in one | One `settleCheckout` |
| Live sync | SSE + polling + 15s snapshot | Outbox + LISTEN/NOTIFY → WS; masked agent channel; version conflicts |
| Auth | Cookies + service-role agent portal | API JWT; role×permission; manager-PIN; agent-scoped queries |
| Module cooperation | Cross-module writes from many files | Commands + events + idempotent handlers |
| POS pricing & stock | Client price; no recipe depletion | Server menu price; recipe stock moves |
| Agent portal | Read-mostly; no masking | Masked calendar; multi-line book; change requests; documents |
| Night audit | Several RPCs + XLSX side effects | Idempotent pipeline per business date |
| Multi-tenant | `platform-admin.ts` on v1 | Org → properties + licence gating |
| Mobile | Ad-hoc | DESIGN-SYSTEM breakpoints |
| Offline | RAM engine money replay | Drafts only (book, POS ticket); **money online-only** |

---

## 7.4 INCLUDED (owner kept)

| Area | v1 sources | Treatment |
|---|---|---|
| **26 Website & Booking** | `web/src/app/(public)`, `home-content.ts`, `public-*`, `website-book.ts`, `templates/*` | **Copy** layouts/templates/map. **Reinvent** booking → v2 `quote()` + `createReservation` (source `web`) + deposits |
| **27 CMS** | `cms.ts`, `cms-admin.ts`, `cms-media-admin.ts`, `property-media*` | **Copy** content model + editor UX → `v2.cms_*` + `v2-media` |
| **28 Marketing** | `erp-marketing.ts`, `guest-wa-templates.ts`, `seo.ts`, og-share | **Copy** templates/SEO. **Merge** WA/email into one messaging service |
| **29 Innora AI** | `erp-innora-chat.ts`, `lib/ai/*`, Wave `desk-copilot.ts`, `secret-crypto.ts` | **Copy** prompts/fast-route/key crypto. **Reinvent** tools → v2 commands + confirm + PIN for money |
| **Supabase plumbing** | `lib/supabase/*`, cookies, SSE | **Copy** client/cookies for `apps/web`. **Reinvent** Realtime on `v2.*`; **drop** SSE/polling |

---

## 7.5 LEAVE OUT

- `/erp/today` lab, `web/src/app/v2`, `web/src/lib/engine`, `web/src/lib/v2` (superseded)
- Thin Wave module shells that are read-only placeholders
- **Decide later:** `/erp/sales-claims`; POS training mode (copy if still used)

---

## 7.6 MIGRATE (cutover data — not code)

| Data | Note |
|---|---|
| Property, room types, rooms, outlets, tables, menu + recipes | Direct |
| Rates and seasons | Convert stored amounts to **net** via v1 `rates_inclusive_of_gst_sc` |
| Agents, MoUs, credit, AR | AR as opening balance per agent |
| Agent portal users / staff PINs | **PIN reset** at first v2 login |
| Guides, drivers, vehicles, vendors | Direct |
| Guests + documents | Reuse Cloudinary URLs |
| Future bookings + assignments | Re-quote into net; flag mismatches |
| Open in-house folios | Close in v1 first, or opening-balance lines |
| Fiscal counters | **Continue** PSBN/INV from v1 last numbers (gapless) |
| Stock, staff, salary structures | Direct |

---

## Wave → SOURCE-MAP usage

| Wave | Primary rows |
|---|---|
| Phase 2 spine | COPY tax/dates/numbering/PIN; REINVENT schema/sync/outbox/auth |
| A | MERGE Settings, HR, Rates + COPY rates/meal-plan |
| B | MERGE Reservations/Desk/StayView/Groups/Checkout + COPY stay/policy/groups |
| C | MERGE Finance/Compliance + REINVENT fiscal |
| D | MERGE POS/KDS/HK/Laundry + COPY pos/laundry |
| E | MERGE Agents/portal + REINVENT masking |
| F | MERGE Purchases/HR payroll + COPY payroll |
| G | INCLUDED 26–29 |
| H | Events/Services + MIGRATE + cutover |
