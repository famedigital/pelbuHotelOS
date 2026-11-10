# Hotel OS v2 — Module catalogue (31 modules)

> **Canonical product source.** Build from this + [SOURCE-MAP.md](./SOURCE-MAP.md) + [DESIGN-SYSTEM.md](./DESIGN-SYSTEM.md).
> Transcribed from Claude plan `room-list-show-in-whimsical-mochi.md` §§3–6.
> **Thin-page ban:** a module is incomplete until the 8-point done gate in [IMPLEMENTATION.md](./IMPLEMENTATION.md).

## Shared core records (owned by one module, used by all)

| Record | Owner module | Used by |
|---|---|---|
| Property, business date, tax config, numbering | Settings / Night Audit | All |
| Room type, Room (+ HK status) | Settings (definition) / Housekeeping (status) | Desk, StayView, Reservations, Channel, Rates, Agents portal |
| Rate plan, Rate (net) | Rates | Reservations, Agents, Channel, Groups, POS (meal plans) |
| Guest (+ documents) | Guests | Reservations, Desk, Compliance, Loyalty, POS, Laundry |
| Booking → Booking line → Room assignment | Reservations (booking) / StayView (assignment) | Desk, Groups, Agents, HK, Night Audit, Channel, Finance |
| Group | Groups | Reservations, Agents, Finance |
| Folio (per payer) → Folio line → Payment | Finance (ledger rules), written by StayHub / POS / Laundry / Night Audit | Reports, Agents, Owner, Compliance |
| Fiscal document (PSBN / INV) | Finance | POS, StayHub, Agents portal, Compliance |
| Agent (+ users, MoU, credit, AR ledger) | Agents | Reservations, Groups, Finance, Rates, portal |
| Guide, Driver, Vehicle, Vendor | Registry | Reservations, Groups, Purchases, Compliance |
| Staff, Role, Permission, PIN | HR | Every module (auth), Staff Portal, Finance (tips) |
| Menu item, Recipe, Stock item | Settings (menu) / Purchases (stock) | POS, KDS, Reports |
| Event, Audit log | Platform | All |

## 3. Module catalogue: 31 modules in 10 groups

Each module lists:
- **Purpose**
- **Screens**
- **Owns** (tables)
- **Key actions** (commands)
- **States**
- **Emits →** events and who consumes them
- **Listens ←**
- **Roles**
- **Mobile**

### A. FRONT OFFICE

**1 · Desk (Today) `/desk`**: the front-desk home and the starting point for every guest interaction.
- **Screens:** Today board (tabs Arrivals · In-house · Departures · Tomorrow), group/agent grouped rows, KPI strip (occupancy, arrivals left, departures left, dirty rooms, open balances), alerts rail (unassigned arrivals, unpaid departures, expiring holds, change requests), StayHub drawer, command palette.
- **Owns:** nothing. It is a view across bookings, rooms and folios.
- **Actions:** check in (opens the StayHub check-in step), check out (StayHub), bulk check-in for a group, print registration card, call/WhatsApp guest.
- **Listens ←** booking.*, room.status_changed, folio.balance_changed, change_request.created, hold.expiring.
- **Roles:** FO Agent, FO Manager. **Mobile:** agenda cards + bottom-sheet StayHub.

**StayHub drawer** (shared component, not a module): the **only** stay editor.
- **Tabs:** Overview · Rooms · Guests & Docs · Folio (guest / agent) · Payments · Requests · History.
- **Actions** (each calls the owning module's command): assign/move room → StayView; post charge/payment → Finance; edit guests → Guests; change rate → Reservations (manager PIN beyond a threshold); check in/out.
- **Evolution (v2 UX):** product language moves StayHub → **Stay** (Adaptive Stay Stage: dock + dossier, Fast Book as `create`, fiscal INV print studio). Spec: [`docs/superpowers/specs/2026-11-08-adaptive-stay-stage-design.md`](../superpowers/specs/2026-11-08-adaptive-stay-stage-design.md). Single-editor invariant unchanged.

**2 · Reservations `/reservations`**: the booking lifecycle.
- **Screens:** list (grouped by group → agent+arrival → FIT; or flat), filters (status, dates, source, agent, payment, unassigned), Fast Book modal (multi-line), booking detail (opens StayHub), change-request queue, holds board, waitlist.
- **Owns:** bookings, booking_lines, change_requests, holds.
- **Actions:** createReservation (all channels use this one command), modify (dates/lines/meal/rate), cancel (fee from the policy), no-show, confirm hold, approve/reject change request, split/merge bookings, send confirmation (PS-).
- **States:** `held → confirmed → checked_in → checked_out`; `cancelled | no_show | expired`.
- **Emits →**
  - **booking.created / confirmed:** StayView (unassigned lane), Channel (availability push), Agents (ledger forecast), Desk.
  - **booking.cancelled / no_show / expired:** StayView (release rooms), Finance (cancellation fee line), Channel.
  - **booking.modified:** StayView, Finance (re-quote), Channel.
  - **change_request.decided:** Agent portal.
- **Listens ←** agent.booking_requested (portal), channel.booking_received (OTA), group.rooms_added, rate.changed (re-quote unconfirmed holds only).
- **Roles:** Reservations Agent, FO Manager. **Mobile:** list cards + Fast Book sheet.

**3 · StayView (Rack) `/stayview`**: physical room inventory over time.
- **Screens:** rack (rooms × dates, rows grouped by room type), **unassigned lane per type**, drag to assign/move/extend, out-of-order (OOO) blocks, room-type availability row, group colour chips, filters (floor, type, status).
- **Owns:** room_assignments, room_blocks (OOO / maintenance holds).
- **Actions:** assignRooms (per line, future dates allowed), moveRoom (transactional), extend/shorten (re-quotes through Reservations), upgrade (keeps the rate, audit-logged), block/unblock room, auto-assign (by preference, floor, group adjacency).
- **Emits →** room.assigned / moved: Desk, HK (prep list), Agent portal (masked), Guests (room on profile). room.blocked: Channel, Reservations (availability).
- **Listens ←** booking.* (show/release bars), room.status_changed (cell colour), stay.checked_out (bar ends).
- **Roles:** FO Agent, FO Manager. **Mobile/tablet:** 7-day rack on tablet; agenda on phone.

**4 · Groups `/groups`**: a group is a container of bookings with one leader, agent, guide and bill.
- **Screens:** group list, group detail (blocks by type, rooming list, guide/driver, itinerary dates, master bill vs individual folios), pickup vs block chart, bulk actions.
- **Owns:** groups, group_blocks (allotments with a release date).
- **Actions:** create group + block, add/remove bookings, rooming list import (XLSX), check in all / check out all, set billing rule (agency pays room + meal plan; guests pay extras), release unused block.
- **Emits →** group.block_created: Reservations/StayView (hold inventory). group.block_released: Channel, StayView. group.billing_rule_changed: Finance (folio payer routing).
- **Listens ←** booking.* of member bookings (pickup count), agent.updated.
- **Roles:** Reservations, FO Manager, Sales. **Mobile:** group card + rooming list.

**5 · Guests `/guests`**: one profile per real person.
- **Screens:** search, profile (contacts, nationality, documents, preferences, stay history, spend, loyalty tier, notes, VIP flag), duplicate-merge tool, document vault.
- **Owns:** guests, guest_documents (passport, CID, visa, permit), preferences.
- **Actions:** create/update, upload document (from staff or agent portal), verify document, merge duplicates, mark VIP / blacklist.
- **Emits →** guest.document_added: Compliance (immigration list), Agent portal. guest.vip_flagged: Desk, HK (amenities), POS.
- **Listens ←** booking.created (link/create profile), stay.checked_out (history, spend), loyalty.tier_changed.
- **Roles:** FO, Reservations; documents visible only to FO Manager + Compliance. **Mobile:** document capture by camera.

**6 · Night Audit `/night-audit`**: closes the business day.
- **Screens:** pre-audit checklist (unposted POS bills, open shifts, arrivals not checked in, departures not out, room-status mismatches), run, results, audit pack (PDF/XLSX).
- **Owns:** business_dates, audit_runs.
- **Actions** (in order, idempotent per date):
  1. Post room nights + meal plans per folio payer (with tax via `packages/domain`).
  2. Mark no-shows.
  3. Expire holds.
  4. Close cashier shifts.
  5. Snapshot statistics (occupancy, ADR, RevPAR).
  6. Roll the business date.
- **Emits →** audit.room_night_posted: Finance. audit.no_show: Reservations. audit.day_closed: Reports (daily stats), Owner, Compliance (daily returns), HR (attendance day close), Purchases (daily consumption).
- **Listens ←** —
- **Roles:** Night Auditor, FO Manager. **Mobile:** run + status only.

### B. ROOMS DIVISION

**7 · Housekeeping `/housekeeping`**
- **Screens:** room board (status grid by floor), task list per attendant, inspection checklist, OOO/maintenance tickets, lost & found, minibar count, linen par per room.
- **Owns:** room HK status, hk_tasks, inspections, maintenance_tickets, lost_found.
- **States:** `dirty → cleaning → clean → inspected`; `ooo` / `oos`; `occupied` is derived from the stay.
- **Actions:** auto-generate tasks (departures, stayovers), assign attendant, start/finish cleaning, inspect (pass/fail), raise maintenance ticket (→ room block), log lost item, post minibar consumption.
- **Emits →** room.status_changed: StayView, Desk, Channel (sellable count). minibar.consumed: Finance (guest folio line). maintenance.opened/closed: StayView (block/unblock). linen.used: Laundry (house linen count).
- **Listens ←** stay.checked_out (→ dirty + task), stay.checked_in (→ occupied), room.assigned (arrival prep, VIP amenity task), guest.vip_flagged.
- **Roles:** HK Supervisor, Room Attendant. **Mobile-first:** attendant sees "my rooms" with one-tap status.

**8 · Laundry `/laundry`**
- **Screens:** guest orders (intake → washing → ready → delivered), price list, house linen (par, soiled in, clean out, losses), vendor laundry batches.
- **Owns:** laundry_orders, laundry_items, linen_stock.
- **Actions:** guest intake (items + price from the price list), mark ready, deliver, **post to folio on delivery**, house-linen in/out, send to external vendor.
- **Emits →** laundry.delivered: Finance (guest folio line, property tax). linen.shortage: Purchases (reorder). vendor_batch.sent: Purchases (vendor bill).
- **Listens ←** linen.used (HK), stay.checked_out (block new orders, warn on undelivered items).
- **Roles:** Laundry staff, HK Supervisor. **Mobile-first.**

### C. FOOD & BEVERAGE

> **v2 UX program:** sell path (Phase 2) then kitchen ops (Phase 3) — spec [`docs/superpowers/specs/2026-11-08-pos-fnb-dept-design.md`](../superpowers/specs/2026-11-08-pos-fnb-dept-design.md). Server prices + recipe stock REINVENT; KDS MERGE. POS opens Stay for folio depth only.

**9 · POS `/pos`**
- **Screens:** outlet picker, table map, order pad (menu by category, modifiers, notes, seat/course), bill (split by item/seat/amount), payment, room-charge lookup (room no. → in-house guest), agent open-item, shift open/close.
- **Owns:** pos_orders, pos_items, pos_bills, pos_payments, tables, pos_shifts.
- **Actions:** open table, add items (**price from the menu on the server**), fire to kitchen, void (manager PIN + reason), discount (permission), split, settle (cash / card / mBoB QR / room charge / agent), reprint.
- **States:** order `open → fired → served → billed → settled | void`.
- **Emits →**
  - pos.fired: KDS.
  - pos.room_charged: Finance (guest folio line; **no INV**).
  - pos.settled: Finance (**INV-** issued, payment).
  - pos.items_sold: Purchases (stock depletion by recipe), Reports.
  - pos.void: Finance (audit), Reports.
- **Listens ←** kot.ready (notify the waiter), stay.checked_out (block room charge), menu.updated, guest.vip_flagged.
- **Roles:** Waiter/Captain, Cashier, F&B Manager. **Tablet-first.**

**10 · KDS `/kds`**
- **Screens:** station boards (kitchen, bar, bakery), ticket cards with timers, all-day counts, recall, expo/pass view.
- **Owns:** kot_tickets, kot_items.
- **Actions:** start, bump item, bump ticket, recall, mark 86 (sold out).
- **Emits →** kot.ready: POS (waiter alert). item.86: POS (hide the item). kot.timing: Reports (prep times).
- **Listens ←** pos.fired, pos.void (strike-through), meal_plan.covers (from Night Audit/Desk: breakfast counts).
- **Roles:** Chef, Bartender. **Wall screen, always dark, no glass.**

### D. SALES & DISTRIBUTION

**11 · Rates `/rates`**
- **Screens:** rate plans (BAR, agent tiers, packages, meal plans), seasons calendar, rate grid (type × date), **rate entry with the 3 modes** (net / incl. SC / all-in) with live Net·SC·GST·Total, restrictions (min stay, closed to arrival, closed to departure), approvals queue (agreed rates below floor).
- **Owns:** rate_plans, rates (net), seasons, restrictions, rate_approvals.
- **Actions:** create plan, bulk update by date range, copy season, approve/reject agreed rate, publish.
- **Emits →** rate.changed: Channel (rates push), Agents portal (rate card), Reservations (re-quote holds). rate.approved: Reservations/StayHub.
- **Listens ←** settings.tax_changed (re-display only; nets don't change).
- **Roles:** Revenue/GM, FO Manager (view).

**12 · Agents `/agents`**: tour operators (B2B).
- **Screens:** agent list (balance, credit used, open rooms), agent dossier (profile, MoU, rate tier, credit limit, portal users, bookings, groups, accounts-receivable ledger + aging, statements, payment proofs to verify, communication log).
- **Owns:** agents, agent_users, mous, agent_ledger.
- **Actions:** create agent + portal user (code + PIN), set tier/credit/MoU, verify payment proof → post payment, issue statement, credit hold (block new bookings), approve change requests (shortcut into Reservations).
- **Emits →** agent.credit_hold: Reservations (block create), portal. agent.payment_verified: Finance (payment against agent folio), portal. agent.updated: Groups, Reservations.
- **Listens ←** fiscal_doc.issued (agency PSBN → ledger debit), payment.received (credit), booking.* where agent_id (forecast), agent.payment_proof_uploaded (portal).
- **Roles:** Sales, Accountant, FO Manager.
- **Agent portal (`/partner/*`)** is this module's external face: Calendar (masked) · Inventory table · Rates · Book · My bookings (multi-select → reports) · Booking detail (guests, documents, guide, driver; edit) · Change requests · Money (invoices, payments, proofs).

**13 · Channel `/channel`**
- **Screens:** connections, room/rate mapping, availability-and-rates (ARI) push log + retry queue, OTA bookings inbox, parity check.
- **Owns:** channel_connections, mappings, ari_queue, channel_bookings.
- **Actions:** map, push full sync, retry failed, accept OTA booking (→ Reservations).
- **Emits →** channel.booking_received: Reservations.
- **Listens ←** booking.*, room.blocked, room.status_changed (OOO), rate.changed, group.block_* (availability deltas).
- **Roles:** Revenue/GM.

**14 · Loyalty `/loyalty`**
- **Screens:** members, tiers, earn rules (per Nu. spent on room/F&B), rewards catalogue, redemption.
- **Owns:** loyalty_accounts, points_ledger, tiers.
- **Actions:** enrol, adjust, redeem (posts a **negative folio line** via Finance).
- **Emits →** loyalty.redeemed: Finance. loyalty.tier_changed: Guests, Desk.
- **Listens ←** stay.checked_out + fiscal_doc.issued (earn on paid spend), pos.settled.
- **Roles:** FO Manager, Marketing.

**15 · Registry `/registry`**: master data for outside parties.
- **Screens:** guides (CID, DOT licence, languages, agencies), drivers (licence), vehicles (plate, seats), vendors (supplier info, tax no.).
- **Owns:** guides, drivers, vehicles, vendors.
- **Actions:** create/update, verify licence, deactivate.
- **Emits →** guide/driver.updated: Reservations/Groups (party picker), Compliance. vendor.updated: Purchases.
- **Listens ←** —
- **Roles:** FO Manager, Accountant. Agents can **propose** guides/drivers from the portal; the desk approves.

### E. FINANCE & CONTROL

**16 · Finance `/finance`**: the ledger. Every Nu. passes through here.
- **Screens:** cashier (open/close shift, float, cash count, variance), folios explorer, payments, **fiscal documents register** (PSBN / INV, void/reissue), accounts receivable (agents, city ledger) + aging, deposits & advance payments, refunds, expenses (petty cash from the till), bank reconciliation, chart of accounts + journals, period lock.
- **Owns:** folios, folio_lines, payments, fiscal_docs, cashier_shifts, expenses, journals, accounts.
- **Actions:** postCharge, postPayment, refund, transfer line between folios (guest ↔ agent), issue PSBN at checkout/final bill, issue INV at POS settle, void + reissue (reason + PIN), close shift, lock period. All are atomic and idempotent.
- **Emits →** folio.balance_changed: Desk, StayHub, portal. fiscal_doc.issued: Agents (AR), Compliance (sales register), Loyalty. payment.received: Agents, Reports. shift.closed: Reports, HR (cashier variance). sc.pooled (service charge collected): HR (tip pool for payroll).
- **Listens ←** audit.room_night_posted, pos.room_charged, pos.settled, laundry.delivered, minibar.consumed, loyalty.redeemed, booking.cancelled (fee), agent.payment_verified, purchase.bill_approved (payable), payroll.posted.
- **Roles:** Cashier, Accountant, GM.

**17 · Purchases `/purchases`**: procurement + stock.
- **Screens:** purchase requisitions, purchase orders, goods receipt (GRN), stock levels by store (kitchen, bar, HK, laundry), issues/transfers, recipes (menu item → ingredients), reorder alerts, supplier bills.
- **Owns:** requisitions, purchase_orders, grns, stock_items, stock_moves, recipes.
- **Actions:** raise request → approve → PO → receive → bill; issue to department; stock count; set par levels.
- **Emits →** stock.low: Purchases (reorder suggestion), F&B Manager. purchase.bill_approved: Finance (payable). stock.costed: Reports (food cost %).
- **Listens ←** pos.items_sold (deplete by recipe), linen.shortage, vendor_batch.sent, audit.day_closed (daily consumption).
- **Roles:** Storekeeper, F&B Manager, Accountant.

**18 · Compliance `/compliance`**
- **Screens:** GST/RRCO returns (sales register from fiscal docs), immigration report (foreign guests: passport, visa, guide, vehicle) for DOT/RBP, SDF tracking (sustainable development fee per foreign guest-night), document completeness checker, statutory exports.
- **Owns:** compliance_filings, sdf_ledger.
- **Actions:** generate return for period, mark filed, export.
- **Emits →** compliance.missing_docs: Desk / Guests / Agent portal (asks the agent to upload).
- **Listens ←** fiscal_doc.issued, guest.document_added, stay.checked_in (immigration list), audit.day_closed.
- **Roles:** Accountant, GM.

### F. PEOPLE

**19 · HR `/hr`**
- **Screens:** staff directory, roles & permissions matrix, PIN reset, departments, shift roster, attendance (clock in/out), leave, payroll (salary + allowances + **service-charge tip pool** + deductions), payslips, documents.
- **Owns:** staff, roles, permissions, shifts, attendance, leave, payroll_runs.
- **Actions:** hire/exit, assign role, roster, approve leave, run payroll (posts a journal to Finance), distribute the SC pool.
- **Emits →** staff.role_changed: Platform auth (live permission refresh). payroll.posted: Finance. shift.published: Staff Portal.
- **Listens ←** sc.pooled (Finance), shift.closed (cash variance), audit.day_closed (attendance close), staff.clocked_in (Staff Portal).
- **Roles:** HR, GM.

**20 · Staff Portal `/staff-portal`**: mobile self-service for every employee.
- **Screens:** my shifts, clock in/out (PIN + location optional), leave request, payslips, announcements, my tasks (deep-links into HK/KDS/POS per role).
- **Owns:** nothing beyond requests; writes through HR commands.
- **Emits →** staff.clocked_in, leave.requested: HR.
- **Listens ←** shift.published, payroll.posted, announcements.
- **Roles:** all staff. **Phone-only design.**

### G. INSIGHTS

**21 · Reports `/reports`**
- **Catalogue** (each report filterable, XLSX/PDF export, schedulable):
  - **FO:** arrivals, departures, in-house, occupancy forecast, room-status discrepancy, no-shows/cancellations.
  - **Revenue:** daily revenue by department, ADR/RevPAR, rate-plan mix, source/agent production.
  - **Finance:** cashier report, payments by method, fiscal register, accounts-receivable aging, outstanding folios.
  - **F&B:** item sales, voids, food cost %, prep times.
  - **HK:** productivity, OOO.
  - **Laundry:** revenue, linen loss.
  - **Agents:** statement, production.
  - **HR:** attendance, payroll summary.
  - **Compliance:** returns, immigration, SDF.
- **Owns:** report_definitions, schedules, daily_stats (from audit.day_closed).
- **Listens ←** audit.day_closed (freeze daily stats), all events for live "today" figures.
- **Roles:** per report via permission.

**22 · Owner `/owner`**: the read-only executive view.
- **Screens:** today live (occupancy, in-house, revenue so far, cash in till), month to date vs target and last year, pickup pace (next 30/60/90 days), top agents, accounts-receivable risk, alerts (big voids, discounts, cash variance, rate overrides). Every tile drills into a Reports report.
- **Owns:** targets. **Listens ←** all money/booking events (live tiles). **Roles:** Owner, GM. **Phone-first.**

### H. PLATFORM

**23 · Settings `/settings`**
- **Screens:** property profile, rooms & types, floors, outlets & tables, menu (items, modifiers, recipe link, tax class), taxes (SC 10% → GST 5%, order, exemptions), numbering series (PS / PSBN / INV), policies (cancellation, deposit, check-in/out time, early/late fees), printers & devices, templates (registration card, invoice, voucher, confirmation), integrations.
- **Owns:** properties, room_types, rooms (definition), outlets, menu, tax_config, sequences, policies, devices, templates.
- **Emits →** settings.tax_changed: Rates/POS/Finance (applies to new postings only). menu.updated: POS/KDS. room.created: StayView/Channel.
- **Roles:** GM, Admin.

**24 · PIN Gateway `/`**
- **Screens:** staff picker by department, PIN pad, quick switch user (keeps the device, swaps the user), lock screen after idle.
- **Owns:** sessions, devices.
- **Actions:** login → **role landing** (FO → Desk, HK → Housekeeping, Waiter → POS, Chef → KDS, Accountant → Finance, Owner → Owner), manager-PIN override popover (used by every module for void/discount/rate override).
- **Emits →** session.started: Staff Portal attendance (optional auto clock-in).

**25 · Super-admin `/superadmin`**: the platform owner only, hidden from hotels.
- **Screens:** tenants, onboarding wizard (clone template → property), licences/plans, billing, support access (time-boxed, audited), system health (event lag, WS clients, failed handlers).
- **Owns:** tenants, licences, support_grants.
- **Emits →** licence.changed: all modules (feature gating; read-only mode after grace).

### I. GUEST & GROWTH (modules 26–29, added by owner decision)

**26 · Website & Booking Engine** (`v2/apps/web`, per tenant by domain): the hotel's own public site.
- **Screens:** home, rooms (gallery, amenities, 3D/building map), offers, dining, experiences, contact. Booking flow: dates → room/rate (live availability + all-in price) → guest details → deposit (mBoB QR / card) → confirmation (PS-) → manage-my-booking (view, documents, cancel per policy). Guest in-stay page: room-service order, laundry request, folio view.
- **Owns:** web_sessions, carts, promo redemptions.
- **Actions:** search availability (cached, revalidated by events), book (→ Reservations `createReservation`, source `web`), pay deposit (→ Finance payment), guest cancel (→ Reservations, with policy fee), in-stay order (→ POS order / Laundry intake).
- **Emits →** web.booking_created (via Reservations), web.deposit_paid (via Finance).
- **Listens ←** rate.changed, booking.*, room.blocked (availability cache), cms.published (rebuild pages).
- **Roles:** public, guest (Supabase Auth by phone/email OTP). **Mobile-first.**

**27 · CMS `/cms`**
- **Screens:** pages and sections editor, room-type content, gallery/media library, offers/packages content, blog/news, menus (public view of the POS menu), translations (English/Dzongkha), theme/template picker, preview, publish.
- **Owns:** cms_pages, cms_blocks, media, offers_content, translations, site_settings.
- **Actions:** edit draft → preview → publish (versioned, rollback).
- **Emits →** cms.published: Website (revalidate). offer.published: Marketing, Rates (links to the package rate plan).
- **Listens ←** room.created, menu.updated (sync names/prices for display).
- **Roles:** Marketing, GM.

**28 · Marketing `/marketing`**
- **Screens:** campaigns (email / WhatsApp / SMS), templates (pre-arrival, confirmation, thank-you, review request, birthday), segments (from Guests + Loyalty), promo codes, review collection + replies, SEO settings, social share assets, results; **Social Clips** studio (Phase 1).
- **Owns:** campaigns, message_templates, segments, promo_codes, reviews, message_log.
- **Actions:** build segment, schedule campaign, send transactional message (booking confirmed, pre-arrival with document-upload link, post-stay review), create promo code (→ Rates discount rule).
- **Social Clips (Phase 1 — WASM):** On-device FFmpeg toolkit under Marketing → Social Clips (trim, convert, aspect 9:16/16:9/1:1/4:5, audio extract, captions SRT/burn, compress, thumbnail, metadata, GIF). No upload; manual download. **REINVENT** social share assets (AutoClipr free-tools inspired). Phase 2: AI clip suggestions + `v2-media`. Phase 3: per-tenant OAuth publish to Shorts/Reels.
- **Emits →** promo.created: Rates/Website. review.received: Owner, Guests.
- **Listens ←** booking.confirmed (confirmation message), D-2 arrival (pre-arrival + document link), stay.checked_out (thank-you + review), loyalty.tier_changed, compliance.missing_docs (reminder to guest/agent).
- **Roles:** Marketing, GM.

**29 · Innora AI** (assistant panel in desk + guest chat on website)
- **Desk:** ask anything ("who arrives today from Soul Trips?", "occupancy next week", "draft agent statement"). Do things by voice/text: it calls **v2 commands** with the signed-in user's permissions and shows a confirm card before any write. Money actions also need the PIN. Summaries: night audit, shift handover, agent dossier.
- **Website:** guest chat for availability, prices, policies and booking handoff (creates a `held` web booking, never a confirmed paid one).
- **Owns:** ai_conversations, ai_actions_log, ai_keys (encrypted).
- **Emits →** ai.action_proposed / ai.action_confirmed: audit_log.
- **Listens ←** reads through the same permission-checked queries as the UI.
- **Roles:** per user permission; AI never exceeds the user.

### J. EXPERIENCES & EVENTS (modules 30–31, added in the gap sweep §13)

**30 · Events & Banquets `/events`**: conferences, weddings, government meetings, group dinners.
- **Screens:** venue calendar (halls, lawn, restaurant buyouts), enquiry → proposal → contract → event order (BEO: menu, set-up, AV, timings, headcount), deposits schedule, final headcount, event folio.
- **Owns:** venues, events, event_orders, event_deposits.
- **Emits →** event.confirmed: KDS (production list), Purchases (requisition), Housekeeping (set-up task), Finance (deposit schedule, event folio). event.headcount_changed: KDS, Purchases.
- **Listens ←** group.* (a conference group's room block links to its event).
- **Roles:** Sales, Banquet Manager, F&B Manager.

**31 · Services & Activities `/services`**: everything bookable that isn't a room or a meal.
- **Scope:** airport transfers (Paro), hot-stone bath, spa, excursions, guided hikes, cultural shows, bicycle hire.
- **Screens:** service catalogue (price, duration, capacity, resource: vehicle/driver/therapist), schedule board, booking from StayHub / Website / Agent portal, driver run sheet.
- **Owns:** services, service_resources, service_bookings.
- **Emits →** service.booked: Registry (driver/vehicle allocation), Staff Portal (therapist/driver task). service.completed: Finance (folio line).
- **Listens ←** booking.confirmed (offer transfer), stay.checked_in.
- **Roles:** FO, Concierge, Spa staff, Drivers (mobile run sheet).

---

## 4. Event map (how modules affect each other)

| Event | Emitted by | Consumed by |
|---|---|---|
| booking.created / confirmed / modified | Reservations | StayView, Desk, Channel, Agents, Guests, Groups |
| booking.cancelled / no_show / expired | Reservations, Night Audit | StayView (release), Finance (fee), Channel, Agents |
| room.assigned / moved | StayView | Desk, Housekeeping, Agent portal, Guests |
| stay.checked_in | StayHub → Reservations | Housekeeping (occupied), Compliance (immigration), Desk, POS (room charge allowed) |
| stay.checked_out | StayHub → Reservations | Housekeeping (dirty + task), POS (block room charge), Laundry, Guests (history), Loyalty, StayView |
| room.status_changed | Housekeeping | StayView, Desk, Channel |
| audit.room_night_posted | Night Audit | Finance |
| audit.day_closed | Night Audit | Reports, Owner, Compliance, HR, Purchases |
| pos.fired / void | POS | KDS |
| kot.ready / item.86 | KDS | POS |
| pos.room_charged | POS | Finance (guest folio) |
| pos.settled / items_sold | POS | Finance (INV), Purchases (stock), Loyalty, Reports |
| laundry.delivered | Laundry | Finance (guest folio) |
| minibar.consumed | Housekeeping | Finance |
| folio.balance_changed | Finance | Desk, StayHub, Agent portal, Owner |
| fiscal_doc.issued | Finance | Agents (AR), Compliance, Loyalty, Agent portal |
| payment.received / agent.payment_verified | Finance / Agents | Agents, Reports, portal |
| sc.pooled / payroll.posted | Finance / HR | HR / Finance |
| rate.changed / approved | Rates | Channel, Reservations, Agent portal |
| group.block_created / released / billing_rule_changed | Groups | StayView, Channel, Finance |
| change_request.created / decided | Agent portal / Reservations | Desk, Reservations / Agent portal |
| guest.document_added / compliance.missing_docs | Guests / Compliance | Compliance / Desk, Agent portal |
| stock.low / purchase.bill_approved | Purchases | F&B Mgr / Finance |
| settings.tax_changed / menu.updated | Settings | Rates, POS, KDS, Finance |
| staff.role_changed / licence.changed | HR / Super-admin | All (auth, feature gating) |
| web booking / deposit (via createReservation, postPayment) | Website | Reservations, Finance, StayView, Agent portal (masked), Marketing (confirmation) |
| guest in-stay order | Website | POS (order), Laundry (intake) |
| cms.published / offer.published | CMS | Website (revalidate), Marketing, Rates |
| promo.created | Marketing | Rates, Website |
| review.received | Marketing | Owner, Guests |
| booking.confirmed / D-2 / stay.checked_out / compliance.missing_docs | Reservations / scheduler / StayHub / Compliance | Marketing (transactional messages, document-upload link) |
| ai.action_proposed / confirmed | Innora AI | Audit log; the target module's own command |

---

## 5. End-to-end journeys (acceptance scenarios)

1. **Agent group, Paro, 6 rooms, MAP**
   - Agent books in the portal → `held`. The desk confirms, so the rack shows 6 rows in the unassigned lane and the agent calendar turns them to "Mine".
   - The desk assigns rooms; the agent uploads passports and the guide → Compliance shows complete.
   - Check in all (Groups).
   - Night Audit posts room + MAP to the **agent folio** and SC+GST to the guest folio for extras.
   - Dinner drinks are charged to the room from the POS → **guest folio**.
   - Check out all:
     - guest folios paid → PSBN (guest)
     - agent folio → PSBN (agency) → Agents accounts receivable
     - rooms dirty → HK tasks
     - portal shows the invoice
     - agent uploads a payment proof → Agents verifies → ledger cleared live.
2. **Walk-in guest (FIT):** Fast Book → assign → check in (document scan) → Night Audit nights → laundry delivered → folio → checkout pays by mBoB → PSBN → room dirty → inspected → sellable on the rack and Channel.
3. **Restaurant walk-in:** POS table → fire → KDS bump → bill → settle cash → INV → stock depleted by recipe → shift close → cashier report.
4. **Cancellation:** agent requests a cancel → desk approves → booking cancelled → rooms released (rack + portal live) → policy fee posted to the agent folio → PSBN on the final bill → AR.
5. **Day close:** pre-audit checklist flags 1 unsettled POS bill and 2 dirty-but-vacant mismatches → fixed → audit runs → daily stats → Owner and Reports update → GST register ready in Compliance.
6. **Payroll:** a month of `sc.pooled` → HR distributes the tip pool by points → payroll.posted → Finance journal → payslips in the Staff Portal.

---

## 6. Roles (permission matrix summary)

| Role | Main modules (operate) | View-only |
|---|---|---|
| Owner | Owner, Reports | All |
| GM | All except Super-admin | — |
| FO Manager | Desk, Reservations, StayView, Groups, Guests, Night Audit, Agents (verify), Rates (approve) | Finance, Reports |
| FO Agent | Desk, Reservations, StayView, Guests | Groups |
| Night Auditor | Night Audit, Finance (cashier) | Desk |
| Cashier | Finance (cashier, payments) | Folios |
| HK Supervisor / Attendant | Housekeeping, Laundry / own tasks | StayView |
| F&B Manager / Waiter / Chef | POS, KDS, Purchases (F&B) / POS / KDS | Reports (F&B) |
| Storekeeper | Purchases | — |
| Accountant | Finance, Compliance, Purchases (bills), Agents (AR) | Reports |
| HR | HR | Staff Portal |
| Agent (external) | Partner portal (own data only) | Calendar (masked) |
| Platform admin | Super-admin | — |

Sensitive actions always need the manager-PIN popover:
- void
- discount above the threshold
- rate below the floor
- reopen a folio
- reissue a fiscal document
- leave a balance at checkout

---


