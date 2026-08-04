# Pelbu Suites — Feature status

Last updated: **2026-08-04** (**v1.0 + Sales & Marketing residual close**).
Property #1: `pelbu-suites-olakha` (`template_id` 1). Work login supports staff Auth with desk access; `DESK_PIN` remains a temporary single-hotel fallback — **never share across hotels**.

**Verdict:** **v1.0 ready** for single-hotel Pelbu Olakha — see **[RELEASE-v1.md](RELEASE-v1.md)**. Core desk OS + public conversion PWA are **built**. Residual FO/money pack (journals proof, Playwright smoke, minibar, immigration SDF CSV, seasons editor, guest history) landed after N+1. Day-1 ops: **[GO-LIVE-TOMORROW.md](GO-LIVE-TOMORROW.md)**; cutover: **[LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md)** (real initials). Not chain-SaaS complete — Stripe self-serve, full SEC-01 admin purge, and **live** Channex certification remain post-v1.

**Palette (FINAL):** **Sky & Citrus** — sky-500 `#0ea5e9` accent + amber-500 `#f59e0b` citrus. Shipped on the desk (`.erp` scope). Pelbu-pink / Bubblegum is **retired**.

Cursor plan mirror: [PLANS.md](PLANS.md) · source folder `C:\Users\rajiv\.cursor\plans\`.

---

## UX direction (locked / as-shipped 2026-07-29)

| Surface | North star | Notes |
|---------|------------|-------|
| `/book` | Airbnb funnel | Dates/nights, meal plans, live room cards, sticky summary, timed hold |
| Public site | Himalayan Dusk conversion system | Homepage owns the cinematic hero; task routes use compact `EngineShell` |
| `/erp` | Cloudbeds / Mews Timeline | **Shipped:** full-bleed `/erp/calendar` room rack |
| Desk nav | **shadcn Sidebar** (icon-collapsible) | `DeskShell` + `app-sidebar.tsx` — default **icon-collapsed**, **13rem** expanded, hover peek, cookie `sidebar_state_v2`; logo from Settings → Identity |
| Palette | **Sky & Citrus — FINAL** | sky-500 `#0ea5e9` + amber-500 `#f59e0b`; Pelbu-pink retired |
| Kit | Tailwind + shadcn + Framer Motion | Sky + citrus tokens under `.erp` |

See [PLATFORM.md — UX north stars](PLATFORM.md#ux-north-stars-2026-07-29).  
Plans: `calendar_drag_booking_64bad6ba` · `erp_shadcn_reskin_d79ac669` · `erp_settings_page_41e5deb4` · `stripe_ace_shadcn_ui_24b7e356` (partially superseded).

---

## Shipped

### Public PWA (`web/`)

| Feature | Route / notes |
|---------|----------------|
| Flagship conversion pages | `/`, rooms, cafe, restaurant, bar, dine, spa, meeting, book, order, contact, agents |
| Public room rates | `/rates` — **package card** (room only + BB/MAP totals at double occupancy) from `room_rates` + `meal_plans`; same math as desk; trade tiers only after email+WhatsApp soft gate (audit `rate_card_access_log` + httpOnly cookie); GST/SC inclusive badge; child package footnotes (0–6 free, 6–12 meal @ 50%) |
| CMS galleries + menus | Supabase `cms_*` / `menu_items` + Cloudinary `image_public_id` |
| Direct book | Creates booking; overbooking guard; hold TTL + deposit payment URL; uses `StayDatesField` (Dates mode default) |
| F&B order | Cafe/pastry/restaurant → separate KOT tickets; mixed carts rejected |
| Agent apply | Markets BT / Jaigaon / India; pending → owner approve |
| Agent portal | `/agents/portal?token=…` (documents + hardened RLS) |
| Agent Work app | `/agents/login` → `/agents/app`; own-rate booking, own bookings, anonymous occupancy only |
| Public/Work PWA | Separate manifests/service workers, install prompts, footer-tab mobile navigation |
| Food engine | Searchable/category menu cards, Cloudinary images, mobile cart, server-priced checkout |
| Spa/meeting engines | CMS-backed `service_offerings`; selectable treatments/layouts and confirmed enquiries |
| Charge-to-room guard | Spa folio requests verify in-house booking + matching phone before accepting |
| Ops mobile cards | Arrivals/in-house/departures/reservations/guests/payments/invoices/GST render cards below `md`; `DataTable` defaults to labelled cards |
| Room detail + guides | `/rooms/[slug]`, `/guide`, `/guide/[slug]` with Article/HotelRoom JSON-LD + dynamic sitemap |
| Search foundation | sitemap, robots, canonicals, Hotel/HotelRoom/Restaurant/FAQ/Breadcrumb/Article JSON-LD, `llms.txt` |
| Answer content | `/faq`, `/stay/olakha-thimphu`, and CMS `cms_posts` guides |
| Deposit pay page | `/pay/{token}` — guest sees amount; desk marks paid |
| Agent voucher email | Fast-book print + Resend email to agent contact (no rates on voucher) |
| Guest laundry | `/laundry` — room + name validation (in-house only, no guest list), photo intake, request tracking |

### Desk ERP shell (`/erp/*`)

| Feature | Notes |
|---------|--------|
| Layout | `web/src/app/erp/layout.tsx` → authenticated `DeskShell` |
| Sidebar IA | Dashboard · Calendar · Front desk · Rooms · **POS** (F&B live here — not a separate module) · Money · Channels · **Team** · **Inventory** · Hotel (Settings footer) |
| Desk shift gate | **Default OFF** — any staff with `can_login` + `can_access_desk` may open `/erp` any time. Optional Settings → Identity → **Restrict hotel desk to scheduled shifts** limits non-management staff to a covering published `staff_shifts` (Thimphu); Owner/GM/manager + DESK_PIN bypass. Not POS cashier shifts. |
| **F&B IA (fixed)** | **No standalone F&B sidebar.** Sell/settle = POS register + menu + KDS; daily ops = **Kitchen board** `/erp/kitchen` (F&B ops home); property FO/GM home = Dashboard `/erp`. Do not merge kitchen into `/erp` or add a duplicate F&B root. |
| Property switcher | Header; multi-property helpers + wizard exist |
| Settings | `/erp/settings` — **Hub** (dual mode: setup readiness vs mature directory) · Finance-style top grouped nav (Hotel profile, Inventory, Tax, Meals, Policies, Documents, Compliance, Finance imports, owner Danger). Deep links `?tab=` keys preserved (`identity`, `commercial`, `policies`, `tax`, `documents`, `rooms`, `compliance`, `finance-imports`, `danger`; default/no tab = overview). Plans `erp_settings_page_41e5deb4` · settings hub redesign |
| **Training LMS** | `/erp/training` — role-filtered manuals + checklist (local progress) |
| **DOT assessment** | `/erp/dot-assessment` — HCS 2024 3★/4★ digital checklist (Trade · BFDA · DOT), entry gate, M/Q/P scoring, photos, print pack |
| Loading UX | Top **NavigationProgress** on desk nav · `usePendingFeedback` + sonner on mutating actions (rota publish, danger wipe) |
| Reskin | **Sky & Citrus (final)** — shadcn primitives + TanStack `DataTable`; sky-500 accent + amber citrus under `.erp`. Plan `erp_shadcn_reskin_d79ac669` (all 13 clusters) |

### Desk ERP modules

| Module | Route | Status |
|--------|-------|--------|
| **Dashboard** (role home) | `/erp` | **Per desk role:** Owner · Manager · Front desk · F&B · Kitchen (**BF/L/D pax** + event pax) · HK · Laundry · Cashier — each board shows **weekly + monthly guest forecast** (arr/dep/rooms/guests from bookings). Owner/GM can preview all via `?view=`. Assign role on Staff → Access. |
| **Calendar / Timeline** | `/erp/calendar` | **v1–v2 shipped (2026-07-29)** — see below |
| Calendar day sheet | `/erp/calendar/day-sheet` | Printable arrivals / departures / stayovers / blocks |
| Fast book | Modal on `/erp/reservations?new=1` (deeplink `/erp/fast-book` redirects) | Create path is modal → StayHub at Reserve; form still has qty grid + drawer |
| Check-in / out | StayHub panels + `/erp/check-in` | Physical room allocation; after check-in StayHub lands Stay/Money; checkout → dirty |
| Arrivals / in-house / departures | `/erp/arrivals` etc. | Boards open StayHub (CI / Stay-Money / CO); today’s worklists only for A/D |
| Reservations / guests | `/erp/reservations`, `/erp/guests` | **New reservation** CTA → Fast Book modal; list all bookings |
| **POS / F&B** | `/erp/pos` (+ tabs) | **F&B product surface** (sidebar title remains POS): Register · Menu · Recipe cost · **Kitchen board** · Food cost · Kitchen TV. Cashier → folio; floor plan; shifts; **Open tickets + Closed today** |
| **Laundry** | `/erp/laundry` (+ `/qr`, `/orders/[id]/labels`) · guest `/laundry` · staff `/staff/laundry` (+ bag scan/labels) | Guest QR room+name intake · reception photo intake · maid mobile board · **Amazon-style bag QR labels** (1–N bags, per-bag garments, staff-secured scan) · maid-confirmed counts → atomic folio post · printable room + bag stickers |
| Folio | `/erp/folios/[id]` (+ `/receipt`) | Payments, void, comp, deposit links; **tax invoice + fiscal receipt issue**; **day-1 room post at check-in** + manual Post room night / day-1 charges; **stay money process strip** |
| **Kitchen board** (F&B ops dashboard) | `/erp/kitchen` (+ `/food-cost`) | Covers · staff on shift · publish BF/lunch/dinner to FO/POS (`kitchen_meal_services`) · gas/stock/expiry · food cost COGS · **Events & groups** (banquet cards: menu, time window, pax, venue, package rate/deposit/balance, link/post to folio) — **chef/F&B supervisor home**, not FO Dashboard |
| Invoices / payments | `/erp/invoices`, `/erp/payments` | **Invoices:** issued fiscal tax invoice list (INV-YYYY-####) only — not POS tickets. Settle/paid/on-room under **POS → Closed today** |
| Agents | `/erp/agents` (+ `/erp/agents/[id]` dossier) | Approve, credit, rates matrix, documents; **click agent → 360° dossier**; **TCB directory** import (`status=directory`, no credit/portal) via `web/scripts/import-tcb-tour-operators.mjs` — searchable on FO pickers A–Z; filter tabs Trade / Pending / Directory |
| Finance + bank recon | `/erp/finance` | **Hotel accountant** — Vault (cash/bank/holdings) · Money in · Money out (expenses + AP bills + payroll link) · Banking · GST · Journals · Reports · Setup & month close; walk-in POS + payroll payout journals; bank create-from-line; Settings → Finance imports |
| GST | `/erp/gst` (+ `/erp/finance/gst`) | Returns / summaries + ledger GST input/output |
| Partners | `/erp/partners` | Guides + drivers master, visit counts, search |
| Reports | `/erp/reports` (+ `/erp/reports/[slug]`) | Manager flash + **named catalog** (agent production, agent AR/habit, staff attendance, inventory movements) + CSV; not a free-form query builder |
| Rooms HK | `/erp/rooms` | Physical units clean/dirty/inspect/occupied/ooo |
| Housekeeping / maintenance | `/erp/housekeeping`, `/erp/maintenance` | P9 |
| Inventory | `/erp/inventory` (+ tabs: Items · Locations · Moves · **Assessment** · POs · Assets) | **Independent sidebar module** — table-first SKU catalog, staff categories, receive/damage/transfer; Assessment = stocktake at `/erp/inventory/audits` |
| HR | `/erp/hr` (+ `/access`, `/positions`, `/vacancies`, `/recruitment`, print) | Staff **Form\|Sheet** · **Module access** · **Positions** (TOR + template PDFs) · **Vacancies** (open headcount, inbox) · public `/careers` · Recruitment (provision → hire/terminate + print) · rota · leave · payroll |
| Channel | `/erp/channel` | Active-property Channex maps, ARI queue (availability + rates + min-stay/stop-sell), flush/retry, feed pull/ack — **live cert still open** ([CHANNEX-CERT.md](CHANNEX-CERT.md)) |
| **Sales & Marketing** | `/erp/marketing` | Campaigns/coupons/NC (edit + status) · **CRM contacts** (type/tags/search, optional agent link) · **email broadcast** one-shot via Resend (owner/GM, max 50/session, `marketing_email_sends`) · **Share/Meta hub** (FB sharer, copy IG caption, catalogue crops; optional Graph post only if `FACEBOOK_PAGE_*` tokens) · campaign `meta_post_url` / `ig_handle` ROI fields · catalogues · room NC · ROI lite · public book + POS + Fast Book promo with **full stay-level reprice** (`promo_discount_pct` cascades room nights, meals, laundry; fixed promos amortized to %) |
| Loyalty | `/erp/loyalty` (+ `/guest/loyalty`) | Points ledger + guest portal lite |
| Recipe cost | `/erp/pos/recipe-cost` | Multi-outlet margin rollup; full RMS open |
| Allotments | `/erp/allotments` | P9 |
| Group / properties | `/erp/group`, `/erp/properties/*` | Multi-hotel overview + **setup wizard** (identity → rooms/units → rates → outlets/deposits → team/banks) |
| Night audit | `/erp/night-audit` | Close-day checklist + room-night posting; cron midnight Thimphu; printable pack with POS cash variance table |
| Guests | `/erp/guests`, `/erp/guests/[id]` | Directory + **profile stay history**; SDF incomplete badge; immigration CSV export |
| Room rates | `/erp/rates` | **Public package card** (room + meal packages) primary; public room Nu edit + advanced market tiers; season date-range editor; meal plan strip → Settings |
| Folio | `/erp/folios/[id]` | Payments, void, comp, minibar/amenity quick charge, damage; day-1 post; stay money strip |
| Settings | `/erp/settings` | Hub + dual mode · staff group nav · `?tab=` deep links (Identity, Tax, Rooms, etc.) |
| **DOT assessment** | `/erp/dot-assessment` | HCS 2024 3★/4★ digital checklist (Trade · BFDA · DOT), entry gate, M/Q/P scores, photos, print pack |

### Calendar / room rack (plan `calendar_drag_booking_64bad6ba`)

| Slice | Status |
|-------|--------|
| **v1** Full-bleed grid, drag-select → modal book/group, HoverCard, agents payload | **Done** |
| **v1.5** Unassigned pool + assign, lock, edit modal, same-type move + 60s undo, OOO/OOS/hold + HK column, search, day filters, source chips | **Done** |
| **v2** Cross-type move rate Continue/Override, split stay, resize via modal, live **poll** refresh (`/api/erp/calendar-version`), group tint, print day sheet, Bhutan badges (guide / on-credit) | **Done with gaps** |
| Monthly occupancy cards + today rooms | **Done** (Occupancy popover in toolbar) |
| Mixed-category selection ack (modal + Fast Book) | **Done** |
| Multi-cell drag (e.g. rooms 4–6 × Aug 2–4) | **Fixed** — window pointer tracking + geometry fallback (no `setPointerCapture`) |
| Slim left room column + **category** group headers | **Done** (2026-08 density pass; floor groups retired) |
| Dense room identity (door / type / floor·view·balcony) | **Done** (`view_label`, `has_balcony`; Settings → Rooms) |
| Stay-bar ops colors + two-line guest/flags + hover CTAs | **Done** |
| Reservation edit journey (Guest / Stay / Money / Ops) | **Done** (`CalendarReservationEditDialog`) |
| Category colour acronym chips + Categories legend popover | **Done** |
| Sticky horizontal scroll (Room column does not slide over nav) | **Done** |
| Room rack / Day sheet in sticky header | **Done** (`CalendarHeaderTabs`; `ModuleTabs` suppressed on calendar) |
| Go-to-date jump for far-future windows | **Done** (`?start=` date input + window paging) |

**Partial** means usable but not the full Cloudbeds-style version.

**v2 leftovers — shipped 2026-08-02:** stay-bar resize handles; allotment overlay; departure-not-checked-out highlight; right-click quick actions; day-column zoom; Occupancy popover; poll refresh + toast (no browser Realtime by design).

**v3+ shipped (2026-08-02 competitive wave):** connecting rooms (`room_units.connecting_room_unit_id` + rack badge + edit dialog); row virtualization when rack &gt; 40 rows.

**Still soft / polish:** stronger SDF/passport incomplete badge.

**v3+ still open (optional):** overbooking buffer, stop-sell markers on rack, rooming-list editor, allotment pickup curves, VIP/repeat-guest intelligence, full keyboard mode — pull only when desk asks.

### Platform / integrations

| Feature | Notes |
|---------|--------|
| Rates + seasons | `room_rates`, peak/lean/off × tiers; **Inc./Excl. GST+SC** via `property_policies.rates_inclusive_of_gst_sc` (Settings → Rates & meals; folio + public/agent quote) |
| Agent credit ledger | Limit + charge on credit bookings |
| Guide & driver partners | Master `guides`/`drivers`; `bookings.guide_id` / `driver_id`; visit counts |
| Guest origin | `bookings.guest_origin` drives guide-required rule |
| Room assignments | Locks, moves, undo, cross-type rate decision, resize/split RPCs |
| Room blocks | `room_blocks` OOO/OOS/hold + overlap guard vs assignments |
| Bank recon parsers | `scripts/bank-recon/` — BoB, BNB, TBank, DrukPNB |
| Audit trail | `audit_events` on money/ops actions |
| Booking holds | TTL by source/season; cron `expire-holds` |
| Cancel / no-show | Frees `room_assignments`; queues ARI when channel mapped |
| Accounting CSV | `/api/erp/export?kind=payments\|expenses\|folio_lines\|immigration\|agent-production\|agent-commission` |
| Playwright desk smoke | `web/e2e/money-path.spec.ts` — skips without `PLAYWRIGHT_*` secrets |
| UAT checklist | `docs/UAT-CHECKLIST.md` |
| Brand assets | `design/brand/` + favicons/PWA icons |

---

## Competitive gap close (shipped 2026-08-02)

| Item | Where |
|------|--------|
| Connecting rooms + rack virtualization | `room_units.connecting_room_unit_id`; calendar badge + edit; virtualize when &gt; 40 rows |
| Night-audit `close_time` | `properties.night_audit_close_time` + Settings + cron gate |
| Group AR statement | `/erp/folios/[id]/statement` |
| Loyalty portal lite | Points ledger + `/erp/loyalty` + `/guest/loyalty` |
| Offline IndexedDB drafts | Hold/book drafts + POS park (`DeskOfflineQueueStrip`); folio money stays online-only |
| Recipe / food cost rollup | `/erp/pos/recipe-cost` (multi-outlet margin); full RMS still open |
| DRC e-invoice stub | `drc-einvoice.ts` + [GST-EINVOICE.md](GST-EINVOICE.md) |
| Tenants SaaS foundation | `tenants` / seats / billing email / Host cert UI — [MULTI-TENANT-WHITELABEL.md](MULTI-TENANT-WHITELABEL.md) |

---

## Not done / partial

| Item | Status |
|------|--------|
| **Calendar v3+ leftover polish** | Connecting rooms + virtualization **shipped**; optional leftovers (overbooking buffer, stop-sell markers, rooming-list editor, VIP intel, full keyboard) — pull only when desk asks |
| **Advanced HR at chain scale** | Weekly rota + publish + overlap conflict **shipped**; biometrics / 200-staff payroll = business residual |
| **Channex live certification** | Wave 1 desk ARI **shipped**; **ops residual** needs human `CHANNEX_*` — [CHANNEX-CERT.md](CHANNEX-CERT.md) |
| **Live Pay.bt / bank QR** | Methods + deposit links + HMAC webhook with atomic claim; payment is desk-confirmed until merchant credentials exist |
| **PWA offline desk (money)** | Drafts/park **shipped**; **folio charges / payments / night audit not queued** (by design) |
| **Full RMS / theoretical vs actual** | Recipe-cost rollup **shipped**; theoretical vs actual / full RMS still open |
| **Loyalty earn-at-checkout** | Portal lite + ledger **shipped**; auto-earn wiring at checkout still soft |
| **Bhutan live e-invoice** | Stub **shipped** — live API only when DRC mandates ([GST-EINVOICE.md](GST-EINVOICE.md)) |
| **Tenants Stripe / domain automation** | Foundation + billing/seats/cert UI **shipped**; Stripe self-serve + Vercel domains API still open |
| **SEC-01 staff-scoped client** | Wave 2 money gates **shipped**; full admin-client rewrite still residual — [ERP-AUDIT.md](ERP-AUDIT.md) |
| **Purchase cost trends (Phase C)** | **Not started** — MoM item price / gas-grocery analytics need `unit_cost_btn` written on every inventory **receive** (movement value is partial today). Do not fake trends from a single `inventory_items.unit_cost_btn` |
| **Partner perks** | Discount % auto-applied on public book quote (guide_number → guide) + calendar on-credit + POS; spa auto-apply still open |
| **Agent voucher PDF/email** | Print + Resend text email shipped; high-quality print CSS improved; native PDF attachment still soft |
| **Extra templates** | Only flagship `template_id=1` |
| **Mews Enterprise catalog (P3)** | Door locks, kiosk, public API / webhooks — not scoped for Olakha go-live |
| **24/7 support staffing** | Business residual — [OPS-RUNBOOK.md](OPS-RUNBOOK.md) |
| **Playwright against staging** | Smoke shipped; full book→CI→pay→NA→CO needs secrets + seed property |

---

## Desk nav map (as shipped)

`AppSidebar` / `erp-nav.ts` groups:

- **Front desk:** Dashboard · Calendar · Arrivals · In-house · Departures · Reservations (**New reservation** → Fast Book modal → StayHub) · Guests · **Groups** · Rooms · Housekeeping · Maintenance · Laundry
- **Money:** Invoices · Payments · POS · Finance · GST · Night audit · Reports
- **Channels:** Allotments · Channel · Partners · Agents
- **Inventory & people:** Stock · HR
- **Footer:** Settings · Add hotel (property wizard)

Default ops home for room inventory: **`/erp/calendar`**. Agent click → **`/erp/agents/[id]`** dossier.

---

## Env (desk / channel)

| Var | Purpose |
|-----|---------|
| `DESK_PIN` | Desk login |
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON` + `SUPABASE_SERVICE_ROLE_KEY` | DB |
| `CHANNEX_API_KEY` | Optional — ARI flush / booking feed |
| `CHANNEX_WEBHOOK_SECRET` | Optional — webhook auth |
| Cloudinary / Resend / CallMeBot | Media + alerts |

Never commit `.env*`.

---

## Phase checklist (PLATFORM.md)

| Phase | Scope | Status |
|-------|--------|--------|
| P0 | Skills, rules, MCP, scaffold, mockups | Done |
| P1 | Flagship PWA + CMS + F&B + fast book + guide/driver | Done |
| P2 | Check-in, POS/KOT, folio, GST, payments | Done |
| P3 | Agents, credit, rates | Done |
| P4 | Finance + bank recon | Done |
| P5 | HR, inventory, audit, reports | Done (rota + conflict); chain-scale HR residual |
| P5.5 | Fast-book UX v2 + StayDatesField + guest_origin + partners master | **Done (2026-07-29)** |
| P5.6 | ERP Timeline + shell + settings + **Sky & Citrus** reskin | **ERP core Done** — public rebuild/Airbnb still open; early Sheet-nav sketch → **Sidebar** |
| P6 | Channex + templates | **Wave 1 desk shipped**; live cert open — [CHANNEX-CERT.md](CHANNEX-CERT.md) |
| P7 | Night audit, voids/comps, deposits, UAT doc | Done (`close_time` + blockers); provider APIs open |
| P8+ | Mews pricing parity / Enterprise catalog | Guest loyalty lite shipped; locks/API/SMS/BI residual |

See also: [RELEASE-v1.md](RELEASE-v1.md) · [WHITEBOARD.md](WHITEBOARD.md) · [ERP-AUDIT.md](ERP-AUDIT.md) · [PLATFORM.md](PLATFORM.md) · [PLANS.md](PLANS.md) · [UAT-CHECKLIST.md](UAT-CHECKLIST.md) · [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) · [FINANCE-UAT.md](FINANCE-UAT.md) · [OPS-RUNBOOK.md](OPS-RUNBOOK.md) · [../AGENTS.md](../AGENTS.md)

---

## Front-desk stay money cycle (FO)

1. **Book / assign rates** — calendar, fast book, or public `/book`. Room Nu from `room_rates` (`/erp/rates`); meal plan snapshot on booking.
2. **Check-in** — opens guest folio; by default posts **day-1 room rent** (toggle: Settings → Tax → *Post day-1 room rent at check-in*) and **meal plan** when `meal_plan_amount_btn > 0`.
3. **Post charges** — further nights via **night audit** (cron midnight Thimphu or `/erp/night-audit`). Manual: folio → **Post day-1 room + meals** / **Post room night**.
4. **Invoice / pay** — collect payment, deposit link, issue tax invoice.
5. **Checkout** when balance is zero (`/erp/check-out`).

Empty Nu 0 after check-in historically meant no day-1 post + night audit not yet run (FO-01). Fixed 2026-08-02.

Kitchen publishes BF/lunch/dinner covers + menu notes from `/erp/kitchen` → visible on POS as **Kitchen service feed**.
