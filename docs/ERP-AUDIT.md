# ERP audit — international PMS / ERP fault register

**Audience:** hotel operators + software engineers reviewing Pelbu OS.  
**Lens:** Opera / OHIP / Mews / Protel / Micros class processes, plus IFRS-style posting hygiene.  
**Date:** 2026-08-01.  
**Method:** code review of money / laundry / desk paths, Supabase advisor pass, HTTP crawl of static `/erp` routes with a desk session, Phase A money-path verification (2026-08-01), and calendar density + sidebar identity pass (2026-08-01).

This is not a marketing checklist. It is the register you hand another engineer so they can say “we know the gaps and the fix order,” instead of “this was vibe-coded for one hotel.”

---

## 0. Maturity snapshot (2026-08-01)

Honest module-level status — **Shipped** = desk can run a shift; **Partial** = usable with known process gaps; **Not started** = schema or stub only.

| Area | Status | Highlight |
|------|--------|-----------|
| **Overall ERP** | **Partial — production-usable for Pelbu Olakha** | Real folio, journals, night-audit cron, POS, laundry CoC; not chain-SaaS or Opera-parity |
| **Front desk / calendar** | **Shipped v2 — Partial vs Cloudbeds** | Category-grouped rack, density pass, sticky scroll containment, occupancy popover, go-to-date; poll refresh only |
| **Folio / money** | **Partial — Phase B + Wave 2 + AR statement** | Gateways, void/reversal, period lock, fiscal INV/RCP/CN + print PDF, laundry via `postFolioCharge`, line transfer, **group AR statement** at `/erp/folios/[id]/statement`; Bhutan live e-invoice API still open (stub + doc shipped) |
| **Finance / GST** | **Partial** | Double-entry ledger + bank recon; edge journal proof tests + FINANCE-UAT checklist; `/erp/invoices` lists issued fiscal tax invoices (INV-YYYY-####) |
| **HR** | **Partial — rota usable** | Staff, shifts, leave, kiosk attendance; weekly rota + **overlap conflict** detection; biometrics / 200-staff payroll residual |
| **Channel / SaaS** | **Partial — foundation + desk ARI + tenant deepen** | Active-property Channel desk; ARI flush UX; Host + **billing email / seats / cert verify**; live Channex cert still open |

**Front desk / calendar (detail):** `/erp/calendar` is the primary ops home. Left pane slimmed (108px desktop / 72px mobile). Rooms grouped by **category** (floor groups retired). Color acronym chips + Categories legend popover. Sticky horizontal scroll keeps the Room column from sliding over nav. Room rack / Day sheet tabs live in the sticky header (`CalendarHeaderTabs`; `ModuleTabs` suppressed on calendar). Occupancy popover + go-to-date for far-future windows shipped.

**Shell / identity:** Sidebar defaults **icon-collapsed**, expands to **13rem**, hover peek on icon rail, persistence via cookie `sidebar_state_v2` (ignores legacy `sidebar_state`). Settings → Identity tab supplies logo + brand fields to `AppSidebar`.

---

## 1. What “international benchmark” means here

| Domain | Benchmark expectation | Pelbu today (short) |
|--------|----------------------|---------------------|
| Front office | Arrival → assign → docs → check-in → open folio → room-night post → F&B/laundry charge → settle → check-out → HK dirty | Flow exists; room-night posts on **night-audit cron** (empty folio until roll is expected); dedicated check-out |
| Folio | Immutable posted lines; corrections via reversing entries; clear balance | Posting gateways + `voidFolioLineWithReversal`; not every path uses reversal; balance via `netFolioBalance` |
| Night audit | Scheduled roll: room rent, no-shows, rate variance, date roll, audit report | **Cron shipped** + per-property `night_audit_close_time` gate; room-night posting idempotent; no-shows + close-day blockers; desk hard-blocks unless force-close |
| Double-entry | Every guest charge/payment → balanced journal in open period | Posting helpers exist; not every money path proven end-to-end |
| Tax (Bhutan GST) | Inclusive/exclusive rule documented; invoice sequences gapless per property | GST screens exist; sequence / lock gaps remain |
| Inventory / POS | KOT → settle → stock deduction; voids with reason + audit | Modern POS shipped; open-ticket detail fixed 2026-07-31 |
| Laundry | Priced catalog → bag CoC → folio charge → reverse on cancel | Catalog seed + bag CoC + gateway billing via `postFolioCharge` shipped; reverse on cancel/correction largely fixed |
| Multi-property | Property isolation by RLS **and** app authZ | `property_id` everywhere; desk uses service role heavily; `assertDeskProperty` pilot |
| Multi-tenant SaaS | Host routing, tenant billing, isolated logins | Host + tenant billing email/seats/cert verify UI; Stripe self-serve still open — MULTI-TENANT-WHITELABEL.md |

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
| FO-01 | **P1** | Room rent is **not** posted at check-in; posts on night-audit roll only. Desk may still see “Balance Nu 0 / No lines yet” until the cron runs — expected, but needs clearer copy or optional same-day post. | **Partial fix 2026-08-01:** `postRoomNightsForDate` + cron. **Fixed 2026-08-02 (copy):** folio empty-state + night-audit checklist explain expected behaviour | Optional check-in day-one post; keep idempotent night roll |
| FO-02 | **P1** | Check-out lived as a stub on the check-in screen (no folio review). | Fixed 2026-07-31: `/erp/check-out` + redirect from check-in for `checked_in` | Keep settlement screen; require zero balance **or** explicit override with audit reason before confirm |
| FO-03 | **P1** | Guest documents regressed to stacked cards (hard to scan for groups). | Fixed 2026-07-31: dense table in `CheckInForm` | Keep table; print/export guest list for immigration if needed |
| FO-04 | **P2** | Folio payment “Reference / Txn / slip no” had no operator-facing explanation. | **Fixed 2026-07-31:** label + hint on `FolioPaymentForm` (confirmed live on sample folio) | Keep help text; add same pattern on POS settle |
| FO-05 | **P2** | Arrivals / in-house / departures had a second tab strip (`BoardTabs`) beside the new module tabs. | Removed 2026-07-31 in favour of `ModuleTabs` | Done |

### 3.2 Night audit & period control

| ID | Sev | Finding | Evidence | Correction |
|----|-----|---------|----------|------------|
| NA-01 | **P0** | No scheduled night audit. Manual UI only. | Was: expire-holds only | **Shipped 2026-08-01:** `/api/cron/night-audit` + `0 18 * * *` UTC; desk UI still available |
| NA-02 | **P0** | Soft / missing period lock: risk of posting into a closed accounting period. | `accounting_periods` + gateways | **Shipped 2026-08-01/02:** `assertOpenPeriodForDate` on folio/payment/void/expense/fiscal; manager PIN override with audit |
| NA-03 | **P1** | Night audit report completeness (rate variance, open balances, HK dirty count) not proven against Opera-style checklist. | `/erp/night-audit` + `executeNightAudit` | **Shipped 2026-08-02:** desk checklist + blockers for dirty HK, open folio balances, room-night errors, departures not checked out, rate variance; desk hard-blocks unless force-close; cron records blockers (optional `NIGHT_AUDIT_CRON_STRICT=1`). **Still open:** per-property close_time; richer Opera variance report packaging |

### 3.3 Accounting & payments

| ID | Sev | Finding | Evidence | Correction |
|----|-----|---------|----------|------------|
| AC-01 | **P0** | Not every folio charge/payment is proven to create a **balanced** journal with a posting event. | `lib/accounting/posting.ts` + call sites | Single `postFolioLine` / `postPayment` gateway; unit tests for balance; forbid raw inserts of `folio_lines` |
| AC-02 | **P0** | Posted folio lines may be mutable / deletable without a reversing entry pattern. | Inspect mutations on `folio_lines` | Status machine: `posted` → only `voided` via reversing line; store `reverses_line_id`, actor, reason |
| AC-03 | **P1** | Invoice / receipt / journal sequence gapless-ness and concurrency not guaranteed. | Sequence helpers / DB sequences | **Shipped 2026-08-01:** `property_sequences` + `next_property_sequence` RPC; `allocateJournalNo` / `allocateFiscalDocNo` use row-locked upsert. **Still open:** journal numbers gapless but not legally immutable; credit notes |
| AC-04 | **P1** | Idempotency: double-click payment / webhook replay can double-post. | Payment actions / webhooks | **Shipped 2026-08-01:** `payments (property_id, idempotency_key)` unique partial index; gateway webhook + deposit link + folio desk + POS tender + agent credit keys; desk deposit link `open→processing` claim |
| AC-05 | **P2** | GST inclusive vs exclusive + rounding (`roundBtn`) must be one documented rule. | `lib/pricing` | **Documented 2026-08-01:** see §5.1 — exclusive-add GST, `roundBtn` on every BTN total; property `gst_rate` from seed |

### 3.4 POS / F&B

| ID | Sev | Finding | Evidence | Correction |
|----|-----|---------|----------|------------|
| POS-01 | **P1** | Open tickets sidebar: clicking a ticket did not open detail (only action buttons). | Fixed 2026-07-31: `OpenTicketsDrawer` detail view | Done; next: optional “recall into cart” for amend-before-settle |
| POS-02 | **P1** | `order_items` has RLS enabled and **0 policies**. | Supabase advisor / `pg_policies` | Add desk policies or document service-role-only + deny anon |
| POS-03 | **P2** | Stock deduction / recipe consumption must stay atomic with settle. | menu_recipe_items + inventory_movements | Transactional settle; void restores stock |

### 3.5 Laundry

| ID | Sev | Finding | Evidence | Correction |
|----|-----|---------|----------|------------|
| LD-01 | **P0** | Prices must come from `laundry_catalog_items` (seeded per property), never invented in the UI. | Catalog seeded; confirm RPC quotes from catalog | **Addressed** — seed + empty-catalog guidance; gateway billing posts via `postFolioCharge` |
| LD-02 | **P0** | Corrections / cancels must reverse folio + ledger, not delete charged lines. | laundry actions + folio post | Reversing `folio_line` + journal; status `voided` |
| LD-03 | **P1** | Chain-of-custody status skips must be rejected server-side. | laundry status tests exist | Keep DB/action guards; never trust client-only |
| LD-04 | **P2** | Guest vs desk vs staff surfaces must share one status vocabulary. | `/laundry`, `/erp/laundry`, `/staff/laundry` | Shared status enum + copy map |

*(Detailed laundry file:line findings from the dedicated audit pass are appended in §7 when available.)*

### 3.6 Security / multi-property

| ID | Sev | Finding | Evidence | Correction |
|----|-----|---------|----------|------------|
| SEC-01 | **P1** (was P0) | Desk server paths use `createSupabaseAdminClient` broadly. RLS does not protect against a buggy action that forgets `property_id`. | Grep of admin client + Wave 2 AuthZ purge 2026-08-01 | **Partial — Wave 2 AuthZ purge:** money/privileged writes gated with `requireMoneyDesk` / `requireDeskRole`; id-based loads fenced with `assertDeskProperty`. Full staff-scoped client rewrite still open (see §5 Phase B item 5 + §7.4) |
| SEC-02 | **P1** | RLS on, **no policies**: `booking_guests`, `booking_rooms`, `booking_drivers`, `guides`, `drivers`, `order_items`. | Advisor + SQL | Policies matching sibling tables, or revoke grants to `anon`/`authenticated` |
| SEC-03 | **P1** | Auth leaked-password protection disabled. | Supabase Auth advisor | Enable HaveIBeenPwned check |
| SEC-04 | **P2** | Extension `btree_gist` in `public` schema. | Advisor | Move to `extensions` schema |

### 3.7 Platform / white-label

| ID | Sev | Finding | Evidence | Correction |
|----|-----|---------|----------|------------|
| PL-01 | **P1** | No `Host` → property middleware; public site always resolves flagship (`pelbu-suites-olakha`). | Was: slug-only | **Partial 2026-08-02 / Wave 4:** Host columns + middleware; `tenants` / `tenant_members` / `properties.tenant_id` + Settings org/seats stub; public CMS prefers Host then flagship. **Still open:** Stripe, domain verify automation, CMS always Host-bound on every public route — see MULTI-TENANT-WHITELABEL.md |
| PL-02 | **P2** | CallMeBot is fine for Pelbu ops alerts; not acceptable as the only WhatsApp channel for a chain SaaS. | Integrations | WhatsApp Business API (Cloud or AWS-hosted) for tenant messaging |
| PL-03 | **P3** | Willing AWS VM path (own DB/mail/WA) is optional hardening, not a substitute for process fixes above. | — | Keep Supabase until P0 money is solid; then evaluate |

### 3.8 Desk UX — calendar density & shell (2026-08-01)

| ID | Sev | Finding | Evidence | Status |
|----|-----|---------|----------|--------|
| UX-01 | **P3** | Calendar left pane too wide; floor groups wasted vertical space | `RoomRackGrid`: `LEFT_DESKTOP=108`, `LEFT_MOBILE=72`; `buildRackRows` uses category groups | **Fixed** — category groups replace floor groups |
| UX-02 | **P2** | ROOM column slid over sidebar/nav on horizontal scroll | Sticky `left-0` + z-index in scroll container; `DeskShell` `overflow-x-hidden` on content | **Fixed** |
| UX-03 | **P2** | Duplicate tab strip below header on calendar | `CalendarHeaderTabs` in sticky header; `ModuleTabs` returns null when `module.key === "calendar"` | **Fixed** |
| UX-04 | **P3** | No occupancy summary without scrolling the rack | Occupancy popover + today rooms card in toolbar | **Fixed** |
| UX-05 | **P3** | Far-future windows (90d+) hard to reach | Go-to-date `<input type="date">` + window paging links (`?start=`) | **Fixed** |
| UX-06 | **P2** | Sidebar always expanded wasted horizontal space on calendar | `SidebarProvider defaultOpen={false}`; `sidebar.tsx`: 13rem width, icon-collapsed default, hover peek | **Fixed** — cookie `sidebar_state_v2` |
| UX-07 | **P3** | Category colour legend not visible at a glance | Categories popover + color acronym chips on category header rows | **Fixed** |

**Calendar v2 leftovers (2026-08-02):** resize handles, allotment overlay, departure-not-checked-out highlight, right-click quick actions, and column zoom are **shipped**. Desk keeps **poll** refresh (no browser Realtime by design). **v3+ open:** connecting rooms, stop-sell markers on rack, rooming-list editor, VIP intelligence — see [FEATURES.md](FEATURES.md).

---

## 4. Crawl matrix (2026-08-01)

**Method:** authenticated HTTP crawl (`pelbu_desk_session`) against `localhost:3000` + content probes. Playwright MCP is in [`.cursor/mcp.json`](../.cursor/mcp.json) but was **not enabled** in Cursor Settings during this pass — interactive click-through of every button remains a follow-up once MCP is green. Artifact: `.tmp/erp-crawl-waves.json`.

| Wave | Routes hit | Result | Process findings seeded |
|------|------------|--------|-------------------------|
| **A Front desk** | `/erp`, calendar, day-sheet, arrivals, in-house, departures, check-in, check-out, fast-book, reservations, guests, rooms, HK, sample folio, in-house check-out | All **200**; check-in of in-house → **307** check-out | Calendar density pass live: category groups, Categories/Occupancy popovers, go-to-date, sticky Room column; header tabs Room rack / Day sheet; sidebar icon-collapsed by default. Folio may show “No lines yet” until night audit (FO-01 partial) |
| **B Laundry** | `/erp/laundry`, `/erp/laundry/qr`, `/laundry`, `/staff/laundry` | Desk/QR **200**; guest laundry **200** (access gate); staff laundry **307** → `/staff/login` | Thin catalog (**Inner wear** only on desk); guest surface is access-gated (no open bag list without session); staff board requires staff Auth — see §7.1 P0/P1 |
| **C F&B / POS** | `/erp/pos`, `/erp/menu`, `/erp/kds` | All **200**; POS shows “Open tickets” | Open-ticket detail fix shipped; room-charge / GST split gaps remain code-level (§7.2) |
| Wave **D Money** | payments, invoices, night-audit, gst, finance/*, reports | All **200** | Night audit UI + checklist (NA-03); invoices = issued fiscal tax invoices (`INV-YYYY-####`) |
| **E Partners** | agents, partners, allotments, channel | All **200** | Agent **dossier** `/erp/agents/[id]` + statement redirect to Money tab; credit / multi-property agent hardening still Phase B |
| **F Back office** | inventory, HR/*, maintenance, settings, group, properties/new, front-public | All **200** | Reports **catalog** runners under `/erp/reports/[slug]`; Roles/ACL = DESK_PIN or staff desk flag; property switcher unrestricted (PL / SEC) |
| **G Public + staff** | `/`, `/book`, `/rooms`, `/order`, `/agents`, `/staff`, `/menu` | Public **200**; `/order` → **308** `/menu`; `/staff` → **307** login | Public conversion up; staff gated; order entry lives under `/menu` |

This proves routes compile and auth gates work. It does **not** prove money correctness — that is the P0 list above and §7.

**Your action for interactive browse:** Cursor Settings → MCP → enable `playwright`, reload, then re-run form/button click-through on Wave A–B.

---

## 5. Correction roadmap (engineer-facing)

### Phase A — Stop the bleeding (1–2 sprints)

1. Night-audit room-night posting + idempotent unique key (FO-01, NA-01). **Shipped 2026-08-01:** `postRoomNightsForDate` in night audit; unique index `(folio_id, business_date, room_unit_id)`. **Shipped 2026-08-01 (cron):** `executeNightAudit` + `/api/cron/night-audit` at `0 18 * * *` UTC (midnight Thimphu); `CRON_SECRET` required in production. **Shipped 2026-08-02:** no-show marking + close-day blockers (NA-03). **Still open:** per-property close_time.  
2. Folio line immutability + reversing entry API (AC-02). **Shipped 2026-08-01:** `voidFolioLineWithReversal` (void + reversing folio line + `reverseJournal`); `netFolioBalance` on folio detail.  
3. Period open check on every post (NA-02). **Shipped 2026-08-01:** `createAndPostJournal` rejects missing/closed/soft-closed periods; `period_id` required on insert. **Shipped 2026-08-01 (extend):** `assertOpenPeriodForDate` on folio charge/payment, void, expense create, fiscal issue; manager PIN + reason override with audit. **Shipped 2026-08-02:** laundry confirm no longer inserts `folio_lines` in RPC — app posts via `postFolioCharge` (period guard applies).  
4. Laundry catalog seed + reverse on void (LD-01, LD-02). **Shipped 2026-08-01:** Pelbu catalog seed; GST checkbox fix; reversal on correction; staff confirm fails on GL error. **Shipped 2026-08-02:** laundry gateway billing (`laundry_confirm_receipt` quotes; app posts via `postFolioCharge`); cancel voids folio. See §7.1.  
5. Policies on zero-policy tables (SEC-02). **Shipped 2026-08-01:** `service_role` policies on `booking_guests`, `booking_rooms`, `booking_drivers`, `guides`, `drivers`, `order_items`.

### Phase B — Earn “real ERP” (next)

1. Single posting gateway + balance tests (AC-01). **Shipped 2026-08-01:** `postFolioCharge` / `postFolioPaymentRecord` gateways; POS, folio-ops, agents, room-night, holds wired with GL rollback.
2. Sequences + payment idempotency (AC-03, AC-04). **Shipped 2026-08-01:** `property_sequences` + `next_property_sequence`; `payments.idempotency_key`; webhook/deposit/folio/POS/agent keys; desk `markDepositLinkPaid` uses `open→processing` claim (matches webhook).
3. Agent credit payment journaling (MY-A10). **Shipped 2026-08-01:** `recordAgentCreditPayment` → `postFolioPaymentRecord` + GL rollback on agent/ledger failure; client idempotency key.
4. Night-audit cron (NA-01). **Shipped 2026-08-01:** `executeNightAudit` + `/api/cron/night-audit` at `0 18 * * *` UTC; `CRON_SECRET` in production.
5. Staff-scoped reads; shrink admin surface (SEC-01). **Wave 2 purge 2026-08-01:** `requireMoneyDesk` on folio deposit/fiscal/night-audit, finance expense/bank, accounting journals/opening balances, POS settle/void/shift/payment, laundry billing cancel/correct, agent credit/rates/approve, check-out, booking cancel/no-show, payroll approve/finalize/pay; `requireDeskRole(["gm","owner"])` on period close + tax settings; `assertDeskProperty` on id loads (folios, bookings, orders, laundry, journals, bank txns, channel maps/revisions, receipt/slip pages). Unit coverage: `property-guard.test.ts`, `desk-auth.test.ts`. **Still open:** staff-scoped Supabase client for reads; HK/ops/CMS/menu/settings room edits still `requireDesk` + admin; agents table has no `property_id` (global partners); Playwright money isolation click-through.
6. Documented GST/rounding (AC-05). **Shipped 2026-08-01:** §5.1 below.
7. White-label Host routing MVP (PL-01). **Foundation shipped 2026-08-02** (host columns + middleware + Settings). Tenant billing / multi-tenant accounts still deferred — MULTI-TENANT-WHITELABEL.md.

### §5.1 GST and rounding policy (AC-05)

Pelbu uses **GST exclusive-add** (Bhutan standard for B2B hotel folios):

- **Catalog / rate prices** are stored **exclusive** of GST unless a row explicitly flags `gst_applicable` on a folio line.
- **GST amount** = `roundBtn(net × gst_rate)` where `gst_rate` comes from property seed (default 5%).
- **Line total** = `roundBtn(net + gst)` for GST-applicable charges; laundry/POS/folio gateways call `roundBtn` on every BTN field before insert.
- **Inclusive back-out** (when a total already includes GST): `net = roundBtn(gross / (1 + rate))`, `gst = roundBtn(gross - net)` — used in split-GST helpers only, not desk forms.
- **Never** compute GST in React components; always use server gateways (`postFolioCharge`, laundry confirm RPC, POS settle).

Property setting: `properties.gst_rate` (seeded). Future: per-outlet inclusive menu flag — not shipped.

### Phase C — Chain / SaaS

1. Tenant accounts, billing, custom domains — MULTI-TENANT-WHITELABEL.md.  
2. BTCL multi-hotel / multi-outlet — BTCL-ADAPTATION.md.  
3. Optional AWS data plane.

---

## 6. How to talk about this with other engineers

**Do say:**  
“Property-scoped PMS with real folio, journals, night-audit cron (room-night posting + Opera blockers), posting gateways (including laundry), payment idempotency, property-scoped fiscal/journal sequences, INV/CN print, desk_role RBAC, Host→property middleware foundation, and Bhutan GST policy (§5.1). Calendar v2 has resize/allotment/overdue + poll. Channel desk is active-property + ARI rates/restrictions queue — live Channex cert still open. Known gaps: tenant SaaS billing, service-role-heavy authZ surface, Pay.bt live credentials.”

**Do not say:**  
“It works for our hotel” without the fault register. That is what reads as vibe-coded.

---

## 7. Appendices — deep-dive passes (2026-07-31)

### 7.1 Laundry module

**Data model:** `laundry_catalog_items` → `laundry_order_items` under `laundry_orders` (optional `folio_id` / unique `folio_line_id`). Maid `laundry_confirm_receipt` prices from catalog and ensures folio; **app** posts via `postFolioCharge` (`source_type=guest_service`) then attaches `folio_line_id`. Custody: `laundry_order_bags` + `laundry_bag_items` + `laundry_bag_events`. Audit: `laundry_order_events`. Guest access: hashed `laundry_guest_sessions` + `laundry_access_attempts`.

**2026-08-01 process refresh (shipped):** Desk/guest intake now **auto-prepares one bag** with full garment allocation and surfaces **Print bag QR** immediately (`/erp/laundry/orders/{id}/labels`). Multi-bag split moved to **Advanced** on desk/staff boards. Intake tab has inline **Add cloth type** + empty-catalog guidance. Order/bag status transitions tightened server-side (`LAUNDRY_TRANSITIONS`, `LAUNDRY_BAG_TRANSITIONS`). Desk **Cancel order** voids folio + journal when billed; voids bags. **Void bag** UI on desk board + staff scan view. Billing correction voids stale bags and re-prepares a fresh default bag.

| ID | Sev | Finding | Status (2026-08-01) |
|----|-----|---------|---------------------|
| LD-A1 | **P0** | GST checkbox on laundry pricing form does not submit | **Fixed** — hidden `gst_applicable` synced to Checkbox |
| LD-A2 | **P0** | `reopenLaundryCorrection` voids folio line but does **not** reverse journal | **Fixed** — `voidFolioLineWithReversal` |
| LD-A3 | **P0** | Folio void update does not check rows affected | **Fixed** — void count verified before reset |
| LD-A4 | **P0** | Order can move to `cancelled` from `received` with **no** folio void | **Fixed** — `cancelLaundryOrder` desk action; `cancelled` removed from staff transition map |
| LD-A5 | **P0** | Staff confirm ignores `postFolioLine` failure | **Fixed** — throws on GL failure |
| LD-A6 | **P1** | Catalog never seeded | **Addressed** — `20260801000000_erp_audit_phase_a.sql` seeds 13 Pelbu items when thin |
| LD-A7 | **P1** | Bag status skips allowed | **Fixed** — `LAUNDRY_BAG_TRANSITIONS` + server guard |
| LD-A8 | **P1** | Order transition skips | **Fixed** — linear chain only (no wash→QC skip) |
| LD-A9 | **P1** | Billing correction does not void bags | **Fixed** — voids bags + auto-prepares fresh default bag |
| LD-A10 | **P1** | No void bag / cancel UX; prepare before confirm | **Fixed** — cancel + void UI; auto-bag on create replaces default prepare path |
| LD-A11 | **P2** | SSE orders-only; guest no realtime; staff folio link 401 | **Fixed** — SSE watches orders + bags; guest session on stream + `LaundryLiveRefresh`; staff scan shows folio note (no ERP receipt link) |

**OK notes:** Confirm path is `FOR UPDATE` + early return if `folio_line_id` set (no double-post on confirm). Prices are catalog/snapshot-driven when catalog is filled. ERP + staff nav both link laundry.

### 7.2 Money path

| ID | Sev | Finding |
|----|-----|---------|
| MY-A1 | **P0** | No room-night auto-post; `runNightAudit` is occupancy/snapshot only; check-in opens empty folio | **Fixed 2026-08-01** — `postRoomNightsForDate` in night audit; cron at `/api/cron/night-audit`. Empty folio until night roll (or manual audit) is expected. |
| MY-A2 | **P1** | Folio void paths uneven: `voidFolioLineWithReversal` shipped but not universal; raw status flips may still exist on legacy actions | **Partial fix 2026-08-01** — reversal helper + journal reverse; audit all void call sites |
| MY-A3 | **P0** | Deposits can insert `payments` (and folio deposit lines) **without** `postPayment` journals | **Fixed 2026-08-01** — `applyBookingConfirmation` + `markDepositLinkPaid` call `postPayment`; GL failure rolls back payment/folio line |
| MY-A4 | **P0** | Comp credits skip journals; negative amounts incompatible with `postSimpleEvent` (amount > 0) | **Fixed 2026-08-01** — `postCompCredit` helper + `folio_line.comp` posting rule migration |
| MY-A5 | **P0** | Period lock incomplete: `period_id` null bypasses journal guard; folios/payments/expenses have no period lock | **Fixed 2026-08-02** — gateways + laundry via `postFolioCharge`; manager override with audit |
| MY-A6 | **P1** | POS room-charge can stamp `posted_to_folio_at` even if folio insert fails | **Fixed 2026-08-02:** `createDeskOrder` sets `posted_to_folio_at` only after `postFolioCharge` succeeds; order deleted on folio failure |
| MY-A7 | **P1** | Split room tender may post folio GST as 0 | **Fixed 2026-08-02:** `allocateSplitGst` uses `roundBtn`; split settle sets `gst_applicable` when order has GST; folio post errors fail settle loudly |
| MY-A8 | **P1** | No fiscal invoice/receipt sequence — `/erp/invoices` is folio browser | **Partial fix 2026-08-01** — `fiscal_documents` + `INV-/RCP-YYYY-####`; issue from folio/receipt; invoices desk lists issued docs. **Still open:** branded PDF, credit notes, Bhutan e-invoice API |
| MY-A9 | **P1** | Journal numbers = per-property `count+1` (race / not gapless) | **Fixed 2026-08-01** — `allocateJournalNo` via `next_property_sequence` row lock |
| MY-A10 | **P1** | Agent credit payments not journaled; weak payment idempotency; `folio_lines (source_type, source_id)` not unique | **Fixed 2026-08-01** — agent credit → `postFolioPaymentRecord` + rollback; idempotency keys on all payment gateways; folio line uniqueness still deferred (reversal pattern instead) |
| MY-A11 | **P1** | GST exclusive-add in code; no documented inclusive/exclusive + rounding policy | **Fixed 2026-08-01** — §5.1 GST policy |
| MY-A12 | **P2** | `soft_closed` unused; void actor hardcoded `"desk"`; JS float + `roundBtn` over `numeric` | **Partial fix 2026-08-02:** `assertOpenPeriodForDate` rejects soft-closed (manager PIN override); `resolveDeskActor()` on folio/POS/laundry voids; expense posts accept `period_guard`. **Still open:** full numeric migration |

**Tables involved:** `folios`, `folio_lines`, `payments`, `payment_links`, `orders`, `order_items`, `order_tenders`, `night_audits`, `room_rates`, `accounting_*` (journals, periods, posting_events/rules, …), `expenses`, `fiscal_documents`, bank recon, `pos_shifts`, `pos_voids`, `audit_events`. **Absent:** dedicated `credit_notes` table; Bhutan e-invoice API integration.

### 7.3 SEC-01 AuthZ purge progress (Wave 2 — 2026-08-01)

**Goal:** AuthZ honest enough that SEC-01 is no longer a P0 auditor kill-shot while desk still uses the service-role admin client.

#### Gated with `requireMoneyDesk` (PIN → `gm`, so `ALLOW_DESK_PIN_IN_PROD=1` still works)

| Area | Actions |
|------|---------|
| Folio ops | `voidFolioLine`, `postCompCredit`, `createDepositLink`, `markDepositLinkPaid`, `issueFolioInvoice` / `Receipt` / `CreditNote`, `attachFolioToMaster`, `promoteFolioToMaster`, `transferFolioLine`, `runNightAudit` |
| Finance | `createExpense`, `importBankStatementJson`, `matchBankTxn`, `ignoreBankTxn`, `autoMatchBankTxns` |
| Accounting | `createManualJournal`, `reversePostedJournal`, `saveOpeningBalanceDraft`, `postOpeningBalances`, `toggleCloseChecklistItem` |
| POS | `createDeskOrder`, `postOrderToBookingFolio`, `postGuestServiceCharge`, `postFolioPayment`, `voidOrder`, `voidOrderItem`, `splitSettle`, `openPosShift`, `closePosShift`, `recordOnlineOrderPayment` |
| Laundry | `reopenLaundryCorrection`, `cancelLaundryOrder` |
| Agents / rates | `setAgentCreditLimit`, `recordAgentCreditPayment`, `updateAgentDeskStatus`, `upsertRoomRate`, `approveAgent`, `rejectAgent` |
| FO | `confirmCheckOut`, `cancelBooking`, `markBookingNoShow`, `confirmBookingToken`, `setGuestBlacklist`, `setPartnerDiscount` |
| Payroll | `approvePayrollRun`, `finalizePayrollRun`, `markPayrollItemPaid` |

#### Privileged role gates (`requireDeskRole`)

| Gate | Actions |
|------|---------|
| `gm` / `owner` | `closeAccountingPeriod`, `updatePropertyTaxSettings` |

#### `assertDeskProperty` on id-based loads (actions + pages)

Folio detail / receipt / transfer / void / payment; booking detail + check-in/out; order slip + POS void/settle; laundry order labels + cancel/correct/void bag; bank txn match/ignore; journals + periods; channel room-type map + revision ack + cancel/no-show; payroll run/item; fiscal issue helper.

#### Still admin-heavy / residual gaps

| Gap | Notes |
|-----|-------|
| Admin client for reads | List pages and most desk actions still `createSupabaseAdminClient`; fence is AuthZ + `assertDeskProperty`, not RLS |
| Ops / HK / menu / CMS | Still `requireDesk` only (appropriate for non-money; not money-gated) |
| Calendar / fast-book / inventory | Desk-auth only; property usually from active context on insert |
| Agents without `property_id` | Credit/limit actions cannot assert agent↔property; bookings for agents are property-scoped |
| Settings room/identity edits | Still `requireDesk` (tax settings now gm/owner) |
| Staff-scoped client rewrite | Deferred — prefer expanding fences over rewriting 100+ admin call sites |
| E2E isolation | Unit tests cover guard; Playwright money click-through across two properties still open |

**Service-role allowlist (honest):** keep admin for privileged writes that need bypass (night audit, sequences, fiscal issue, stock RPCs, channel flush). Do not expand admin to new public routes. Prefer `assertDeskProperty` immediately after any `.eq("id", …)` load.

---

### 7.4 Related docs

- Whiteboard map: [WHITEBOARD.md](WHITEBOARD.md)  
- Features matrix: [FEATURES.md](FEATURES.md)  
- UAT scripts: [UAT-CHECKLIST.md](UAT-CHECKLIST.md)  
- **Go-live briefing:** [GO-LIVE-TOMORROW.md](GO-LIVE-TOMORROW.md)  
- White-label: [MULTI-TENANT-WHITELABEL.md](MULTI-TENANT-WHITELABEL.md)  
- BTCL chain: [BTCL-ADAPTATION.md](BTCL-ADAPTATION.md)
