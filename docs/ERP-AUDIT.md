# ERP audit — international PMS / ERP fault register

**Audience:** hotel operators + software engineers reviewing Pelbu OS.  
**Lens:** Opera / OHIP / Mews / Protel / Micros class processes, plus IFRS-style posting hygiene.  
**Date:** 2026-07-31.  
**Method:** code review of money / laundry / desk paths, Supabase advisor pass, HTTP crawl of static `/erp` routes with a desk session, and the desk UX fixes shipped the same day.

This is not a marketing checklist. It is the register you hand another engineer so they can say “we know the gaps and the fix order,” instead of “this was vibe-coded for one hotel.”

---

## 1. What “international benchmark” means here

| Domain | Benchmark expectation | Pelbu today (short) |
|--------|----------------------|---------------------|
| Front office | Arrival → assign → docs → check-in → open folio → room-night post → F&B/laundry charge → settle → check-out → HK dirty | Flow exists; **room-night auto-post missing**; check-out now dedicated |
| Folio | Immutable posted lines; corrections via reversing entries; clear balance | Lines post; empty folio after check-in is confusing; reversal discipline uneven |
| Night audit | Scheduled roll: room rent, no-shows, rate variance, date roll, audit report | UI exists; **no cron**; completeness unclear |
| Double-entry | Every guest charge/payment → balanced journal in open period | Posting helpers exist; not every money path proven end-to-end |
| Tax (Bhutan GST) | Inclusive/exclusive rule documented; invoice sequences gapless per property | GST screens exist; sequence / lock gaps remain |
| Inventory / POS | KOT → settle → stock deduction; voids with reason + audit | Modern POS shipped; open-ticket detail fixed 2026-07-31 |
| Laundry | Priced catalog → bag CoC → folio charge → reverse on cancel | Catalog tables exist; seed / reverse / UX gaps |
| Multi-property | Property isolation by RLS **and** app authZ | `property_id` everywhere; desk uses service role heavily |
| Multi-tenant SaaS | Host routing, tenant billing, isolated logins | Not yet — see MULTI-TENANT-WHITELABEL.md |

---

## 2. Severity legend

| Sev | Meaning |
|-----|---------|
| **P0** | Money, inventory, or guest legal data can be wrong or duplicated |
| **P1** | Blocks a real desk shift or fails a third-party ERP review |
| **P2** | UX / consistency; staff can work around |
| **P3** | Polish |

---

## 3. Fault register

### 3.1 Front office & folio

| ID | Sev | Finding | Evidence | Correction (benchmark) |
|----|-----|---------|----------|------------------------|
| FO-01 | **P0** | Room rent is **not** auto-posted to the folio at check-in or on night roll. Desk sees “Balance Nu 0 / No lines yet” after check-in and thinks the link is broken. | Folio page empty-state copy; `ensureOpenFolio` creates shell only; no room-night cron in `web/vercel.json` (only `expire-holds`) | Night audit posts one `folio_line` per occupied room-night (source `room` / `night_audit`), GST split per property rule; idempotent unique `(folio_id, business_date, room_unit_id)` |
| FO-02 | **P1** | Check-out lived as a stub on the check-in screen (no folio review). | Fixed 2026-07-31: `/erp/check-out` + redirect from check-in for `checked_in` | Keep settlement screen; require zero balance **or** explicit override with audit reason before confirm |
| FO-03 | **P1** | Guest documents regressed to stacked cards (hard to scan for groups). | Fixed 2026-07-31: dense table in `CheckInForm` | Keep table; print/export guest list for immigration if needed |
| FO-04 | **P1** | Folio payment “Reference / Txn / slip no” had no operator-facing explanation. | `FolioPaymentForm` placeholder | Label: “Bank slip / Pay.bt txn / card auth — leave blank for cash” + help text on folio |
| FO-05 | **P2** | Arrivals / in-house / departures had a second tab strip (`BoardTabs`) beside the new module tabs. | Removed 2026-07-31 in favour of `ModuleTabs` | Done |

### 3.2 Night audit & period control

| ID | Sev | Finding | Evidence | Correction |
|----|-----|---------|----------|------------|
| NA-01 | **P0** | No scheduled night audit. Manual UI only. | `web/vercel.json` crons = expire-holds only | Vercel cron (or AWS scheduler) at property close time → post room nights, mark no-shows, roll business date, write `night_audits` row |
| NA-02 | **P0** | Soft / missing period lock: risk of posting into a closed accounting period. | `accounting_periods` exists; enforce at `postFolioLine` / journal insert | Reject posts when period `status != open`; manager override with audit |
| NA-03 | **P1** | Night audit report completeness (rate variance, open balances, HK dirty count) not proven against Opera-style checklist. | `/erp/night-audit` | Document checklist in UAT; block “close day” until P0 items clear |

### 3.3 Accounting & payments

| ID | Sev | Finding | Evidence | Correction |
|----|-----|---------|----------|------------|
| AC-01 | **P0** | Not every folio charge/payment is proven to create a **balanced** journal with a posting event. | `lib/accounting/posting.ts` + call sites | Single `postFolioLine` / `postPayment` gateway; unit tests for balance; forbid raw inserts of `folio_lines` |
| AC-02 | **P0** | Posted folio lines may be mutable / deletable without a reversing entry pattern. | Inspect mutations on `folio_lines` | Status machine: `posted` → only `voided` via reversing line; store `reverses_line_id`, actor, reason |
| AC-03 | **P1** | Invoice / receipt / journal sequence gapless-ness and concurrency not guaranteed. | Sequence helpers / DB sequences | Property-scoped sequence table with `UPDATE … RETURNING` under row lock |
| AC-04 | **P1** | Idempotency: double-click payment / webhook replay can double-post. | Payment actions / webhooks | Idempotency key unique constraint per property |
| AC-05 | **P2** | GST inclusive vs exclusive + rounding (`roundBtn`) must be one documented rule. | `lib/pricing` | One page in docs + property setting; never invent GST in UI |

### 3.4 POS / F&B

| ID | Sev | Finding | Evidence | Correction |
|----|-----|---------|----------|------------|
| POS-01 | **P1** | Open tickets sidebar: clicking a ticket did not open detail (only action buttons). | Fixed 2026-07-31: `OpenTicketsDrawer` detail view | Done; next: optional “recall into cart” for amend-before-settle |
| POS-02 | **P1** | `order_items` has RLS enabled and **0 policies**. | Supabase advisor / `pg_policies` | Add desk policies or document service-role-only + deny anon |
| POS-03 | **P2** | Stock deduction / recipe consumption must stay atomic with settle. | menu_recipe_items + inventory_movements | Transactional settle; void restores stock |

### 3.5 Laundry

| ID | Sev | Finding | Evidence | Correction |
|----|-----|---------|----------|------------|
| LD-01 | **P0** | Prices must come from `laundry_catalog_items` (seeded per property), never invented in the UI. | Catalog table exists; seed completeness TBD | Seed Pelbu catalog; block order create if catalog empty |
| LD-02 | **P0** | Corrections / cancels must reverse folio + ledger, not delete charged lines. | laundry actions + folio post | Reversing `folio_line` + journal; status `voided` |
| LD-03 | **P1** | Chain-of-custody status skips must be rejected server-side. | laundry status tests exist | Keep DB/action guards; never trust client-only |
| LD-04 | **P2** | Guest vs desk vs staff surfaces must share one status vocabulary. | `/laundry`, `/erp/laundry`, `/staff/laundry` | Shared status enum + copy map |

*(Detailed laundry file:line findings from the dedicated audit pass are appended in §7 when available.)*

### 3.6 Security / multi-property

| ID | Sev | Finding | Evidence | Correction |
|----|-----|---------|----------|------------|
| SEC-01 | **P0** | Desk server paths use `createSupabaseAdminClient` broadly (~100+ call sites). RLS does not protect against a buggy action that forgets `property_id`. | Grep of admin client | Prefer staff-scoped client for reads; keep admin for privileged writes behind explicit `assertDeskProperty(id)` |
| SEC-02 | **P1** | RLS on, **no policies**: `booking_guests`, `booking_rooms`, `booking_drivers`, `guides`, `drivers`, `order_items`. | Advisor + SQL | Policies matching sibling tables, or revoke grants to `anon`/`authenticated` |
| SEC-03 | **P1** | Auth leaked-password protection disabled. | Supabase Auth advisor | Enable HaveIBeenPwned check |
| SEC-04 | **P2** | Extension `btree_gist` in `public` schema. | Advisor | Move to `extensions` schema |

### 3.7 Platform / white-label

| ID | Sev | Finding | Evidence | Correction |
|----|-----|---------|----------|------------|
| PL-01 | **P1** | No `Host` → property middleware; cannot sell white-label public sites on custom domains yet. | Next middleware | See MULTI-TENANT-WHITELABEL.md |
| PL-02 | **P2** | CallMeBot is fine for Pelbu ops alerts; not acceptable as the only WhatsApp channel for a chain SaaS. | Integrations | WhatsApp Business API (Cloud or AWS-hosted) for tenant messaging |
| PL-03 | **P3** | Willing AWS VM path (own DB/mail/WA) is optional hardening, not a substitute for process fixes above. | — | Keep Supabase until P0 money is solid; then evaluate |

---

## 4. Crawl smoke (2026-07-31)

Desk session against `localhost:3000`:

- Static module routes under `/erp/**` → **HTTP 200**
- `/erp/login` → **307** `/erp` when already authed
- `/erp/check-in?id=<checked_in>` → **307** `/erp/check-out?id=…`
- `/erp/check-out?id=<in-house>` → **200**
- Sample folio → **200**

This proves routes compile and auth gates work. It does **not** prove money correctness — that is the P0 list above.

Playwright MCP is configured in `.cursor/mcp.json` (`npx @playwright/mcp` + Chromium installed). Enable the server in Cursor MCP settings and re-run an interactive click-through for forms/buttons.

---

## 5. Correction roadmap (engineer-facing)

### Phase A — Stop the bleeding (1–2 sprints)

1. Night-audit room-night posting + idempotent unique key (FO-01, NA-01).  
2. Folio line immutability + reversing entry API (AC-02).  
3. Period open check on every post (NA-02).  
4. Laundry catalog seed + reverse on void (LD-01, LD-02).  
5. Policies on zero-policy tables (SEC-02).

### Phase B — Earn “real ERP” (next)

1. Single posting gateway + balance tests (AC-01).  
2. Sequences + payment idempotency (AC-03, AC-04).  
3. Staff-scoped reads; shrink admin surface (SEC-01).  
4. Documented GST/rounding (AC-05).  
5. White-label Host routing MVP (PL-01).

### Phase C — Chain / SaaS

1. Tenant accounts, billing, custom domains — MULTI-TENANT-WHITELABEL.md.  
2. BTCL multi-hotel / multi-outlet — BTCL-ADAPTATION.md.  
3. Optional AWS data plane.

---

## 6. How to talk about this with other engineers

**Do say:**  
“Property-scoped PMS with real folio, journals, night-audit tables, and Bhutan GST screens. Known gaps are room-night auto-post, period lock enforcement, and service-role-heavy authZ. Roadmap is Phase A–C in ERP-AUDIT.md.”

**Do not say:**  
“It works for our hotel” without the fault register. That is what reads as vibe-coded.

---

## 7. Appendices — deep-dive passes (2026-07-31)

### 7.1 Laundry module

**Data model:** `laundry_catalog_items` → `laundry_order_items` under `laundry_orders` (optional `folio_id` / unique `folio_line_id`). Maid `laundry_confirm_receipt` prices from catalog, posts one `folio_lines` row (`source_type=guest_service`). Custody: `laundry_order_bags` + `laundry_bag_items` + `laundry_bag_events`. Audit: `laundry_order_events`. Guest access: hashed `laundry_guest_sessions` + `laundry_access_attempts`.

| ID | Sev | Finding |
|----|-----|---------|
| LD-A1 | **P0** | GST checkbox on laundry pricing form does not submit (`Checkbox` without hidden input) → `gst_applicable` always saved off (`LaundryDesk.tsx` / `erp-laundry.ts`) |
| LD-A2 | **P0** | `reopenLaundryCorrection` voids folio line but does **not** reverse the journal posted at confirm → books vs folio diverge |
| LD-A3 | **P0** | Folio void update does not check rows affected; laundry billing fields still reset → re-bill / double-charge risk |
| LD-A4 | **P0** | Order can move to `cancelled` from `received` with **no** folio void — orphan posted charge if status POSTed |
| LD-A5 | **P0** | Staff confirm ignores `postFolioLine` failure — UI success while GL may have failed |
| LD-A6 | **P1** | Catalog never seeded in migrations; live DB had only 1 item (`Inner wear`) — intake unusable until desk prices a full list |
| LD-A7 | **P1** | Bag status advances have **no** transition map — stages skippable; delivered → open allowed |
| LD-A8 | **P1** | Order transition allow-list permits skips (`washing → quality_check`, etc.) |
| LD-A9 | **P1** | Billing correction resets order but does not void bags → allocation vs qty mismatch |
| LD-A10 | **P1** | Desk can prepare bags before maid confirmation; `voidLaundryBag` has no UI; no cancel order UX |
| LD-A11 | **P2** | SSE watches orders only (not bags); guest portal no realtime; a11y gaps on qty buttons; staff folio receipt link may 401 |

**OK notes:** Confirm path is `FOR UPDATE` + early return if `folio_line_id` set (no double-post on confirm). Prices are catalog/snapshot-driven when catalog is filled. ERP + staff nav both link laundry.

### 7.2 Money path

| ID | Sev | Finding |
|----|-----|---------|
| MY-A1 | **P0** | No room-night auto-post; `runNightAudit` is occupancy/snapshot only; check-in opens empty folio |
| MY-A2 | **P0** | Folio void = status flip + reason; **no** GL reversal / credit-note; amounts not DB-immutable |
| MY-A3 | **P0** | Deposits can insert `payments` (and folio deposit lines) **without** `postPayment` journals |
| MY-A4 | **P0** | Comp credits skip journals; negative amounts incompatible with `postSimpleEvent` (amount > 0) |
| MY-A5 | **P0** | Period lock incomplete: `period_id` null bypasses journal guard; folios/payments/expenses have no period lock |
| MY-A6 | **P1** | POS room-charge can stamp `posted_to_folio_at` even if folio insert fails |
| MY-A7 | **P1** | Split room tender may post folio GST as 0 |
| MY-A8 | **P1** | No fiscal invoice/receipt sequence — `/erp/invoices` is folio browser |
| MY-A9 | **P1** | Journal numbers = per-property `count+1` (race / not gapless) |
| MY-A10 | **P1** | Agent credit payments not journaled; weak payment idempotency; `folio_lines (source_type, source_id)` not unique |
| MY-A11 | **P1** | GST exclusive-add in code; no documented inclusive/exclusive + rounding policy |
| MY-A12 | **P2** | `soft_closed` unused; void actor hardcoded `"desk"`; JS float + `roundBtn` over `numeric` |

**Tables involved:** `folios`, `folio_lines`, `payments`, `payment_links`, `orders`, `order_items`, `order_tenders`, `night_audits`, `room_rates`, `accounting_*` (journals, periods, posting_events/rules, …), `expenses`, bank recon, `pos_shifts`, `pos_voids`, `audit_events`. **Absent:** dedicated `invoices` / `credit_notes` / document-sequence tables.

### 7.3 Related docs

- Whiteboard map: [WHITEBOARD.md](WHITEBOARD.md)  
- Features matrix: [FEATURES.md](FEATURES.md)  
- UAT scripts: [UAT-CHECKLIST.md](UAT-CHECKLIST.md)  
- White-label: [MULTI-TENANT-WHITELABEL.md](MULTI-TENANT-WHITELABEL.md)  
- BTCL chain: [BTCL-ADAPTATION.md](BTCL-ADAPTATION.md)
