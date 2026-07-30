# Pelbu Suites — Feature status

Last updated: **2026-07-30**.
Property #1: `pelbu-suites-olakha` (`template_id` 1). Work login supports staff Auth with desk access; `DESK_PIN` remains a temporary fallback.

**Verdict:** Core hotel OS modules and the flagship public conversion rebuild are **built**. The public PWA now has task-first room, food, spa, meeting, and agent engines; the Work PWA routes staff, desk, and approved agents to isolated workspaces. Not "100% done" — live Channex certification, live Pay.bt/QR merchant APIs, offline desk money queues, and partner auto-discounts remain externally or product-blocked.

**Palette (FINAL):** **Sky & Citrus** — sky-500 `#0ea5e9` accent + amber-500 `#f59e0b` citrus. Shipped on the desk (`.erp` scope). Pelbu-pink / Bubblegum is **retired**.

Cursor plan mirror: [PLANS.md](PLANS.md) · source folder `C:\Users\rajiv\.cursor\plans\`.

---

## UX direction (locked / as-shipped 2026-07-29)

| Surface | North star | Notes |
|---------|------------|-------|
| `/book` | Airbnb funnel | Dates/nights, meal plans, live room cards, sticky summary, timed hold |
| Public site | Himalayan Dusk conversion system | Homepage owns the cinematic hero; task routes use compact `EngineShell` |
| `/erp` | Cloudbeds / Mews Timeline | **Shipped:** full-bleed `/erp/calendar` room rack |
| Desk nav | **shadcn Sidebar** (icon-collapsible) | `DeskShell` + `app-sidebar.tsx` — **supersedes** long `DeskHeader` wrap; **differs** from early P5.6 hamburger-`Sheet` sketch |
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

### Desk ERP shell (`/erp/*`)

| Feature | Notes |
|---------|--------|
| Layout | `web/src/app/erp/layout.tsx` → authenticated `DeskShell` |
| Sidebar IA | Front desk · Money · Channels · Inventory & people · Group · Settings footer |
| Property switcher | Header; multi-property helpers + wizard exist |
| Settings | `/erp/settings` — 4 tabs: **Identity** (logo upload + brand/legal fields) · **Tax & service** (GST %, service charge %, default-on toggle) · **Documents** (invoice/receipt/voucher presets + branded customizer + live preview) · **Rooms** (add category with unit count, rename/manage room units). Plan `erp_settings_page_41e5deb4` |
| Reskin | **Sky & Citrus (final)** — shadcn primitives + TanStack `DataTable`; sky-500 accent + amber citrus under `.erp`. Plan `erp_shadcn_reskin_d79ac669` (all 13 clusters) |

### Desk ERP modules

| Module | Route | Status |
|--------|-------|--------|
| Inbox + KOT board | `/erp` | Live refresh via `/api/erp/kot-version` |
| **Calendar / Timeline** | `/erp/calendar` | **v1–v2 shipped (2026-07-29)** — see below |
| Calendar day sheet | `/erp/calendar/day-sheet` | Printable arrivals / departures / stayovers / blocks |
| Fast book | `/erp/fast-book` | UX v2 — calendar strip + qty grid + drawer + invoice/voucher split; mixed-category ack; nights always visible |
| Check-in / out | `/erp/check-in` | Physical room allocation (guest + guide/driver); HK readiness; multi-guest rooming; origin-aware SDF/guide; checkout → dirty |
| Arrivals / in-house / departures | `/erp/arrivals` etc. | P8 list boards |
| Reservations / guests | `/erp/reservations`, `/erp/guests` | P8 lists |
| POS | `/erp/pos` | Cafe/bar/restaurant cashier → folio |
| Folio | `/erp/folios/[id]` (+ `/receipt`) | Payments, void, comp, deposit links |
| Invoices / payments | `/erp/invoices`, `/erp/payments` | P8 |
| Agents | `/erp/agents` | Approve, credit, rates matrix, documents, statements |
| Finance + bank recon | `/erp/finance` | **Double-entry ledger + Import Workbench (2026-07-29)** — Overview · Income · Expenses (spreadsheet + receipt PDF extract) · Banking (PDF + approved parsers) · Accounting · GST · Reports · Setup; Settings → Finance imports for parser versions; isolated `services/finance-parser-worker` |
| GST | `/erp/gst` (+ `/erp/finance/gst`) | Returns / summaries + ledger GST input/output |
| Partners | `/erp/partners` | Guides + drivers master, visit counts, search |
| Reports | `/erp/reports` | Occ (sellable vs comp), F&B, GST, agents, audit; CSV export |
| Rooms HK | `/erp/rooms` | Physical units clean/dirty/inspect/occupied/ooo |
| Housekeeping / maintenance | `/erp/housekeeping`, `/erp/maintenance` | P9 |
| Inventory | `/erp/inventory` | SKU stock + movements |
| HR | `/erp/hr` | Basic staff/shifts/leave; **advanced HR plan in progress** |
| Channel | `/erp/channel` | Channex maps, ARI queue, feed pull/ack (**foundation**) |
| Allotments | `/erp/allotments` | P9 |
| Group / properties | `/erp/group`, `/erp/properties/*` | Multi-hotel overview + setup wizard |
| Night audit | `/erp/night-audit` | One run per business date |
| Settings | `/erp/settings` | Identity · Tax & service · Documents · Rooms (see shell table) |

### Calendar / room rack (plan `calendar_drag_booking_64bad6ba`)

| Slice | Status |
|-------|--------|
| **v1** Full-bleed grid, drag-select → modal book/group, HoverCard, agents payload | **Done** |
| **v1.5** Unassigned pool + assign, lock, edit modal, same-type move + 60s undo, OOO/OOS/hold + HK column, search, day filters, source chips | **Done** |
| **v2** Cross-type move rate Continue/Override, split stay, resize via modal, live **poll** refresh (`/api/erp/calendar-version`), group tint, print day sheet, Bhutan badges (guide / on-credit) | **Done with gaps** |
| Monthly occupancy cards + today rooms | **Done** (toolbar) |
| Mixed-category selection ack (modal + Fast Book) | **Done** |
| Multi-cell drag (e.g. rooms 4–6 × Aug 2–4) | **Fixed** — window pointer tracking + geometry fallback (no `setPointerCapture`) |

**Partial** means usable but not the full Cloudbeds-style version. Leftovers:

- Stay-bar **resize handles** (dates editable in modal today)
- Supabase **Realtime** + channel-booking toast (poll only today)
- Stronger **SDF/passport** incomplete badge
- **Allotment overlay** on the rack
- Night-audit **departure-not-checked-out** highlight on rack
- **Right-click** quick actions
- Room-type **colour bands**; day-column **zoom**

**v3+ (not started):** connecting rooms, overbooking buffer, stop-sell markers, rooming-list editor, allotment pickup curves, VIP/repeat-guest intelligence, column virtualization, full keyboard mode — pull only when desk asks.

### Platform / integrations

| Feature | Notes |
|---------|--------|
| Rates + seasons | `room_rates`, peak/lean/off × tiers |
| Agent credit ledger | Limit + charge on credit bookings |
| Guide & driver partners | Master `guides`/`drivers`; `bookings.guide_id` / `driver_id`; visit counts |
| Guest origin | `bookings.guest_origin` drives guide-required rule |
| Room assignments | Locks, moves, undo, cross-type rate decision, resize/split RPCs |
| Room blocks | `room_blocks` OOO/OOS/hold + overlap guard vs assignments |
| Bank recon parsers | `scripts/bank-recon/` — BoB, BNB, TBank, DrukPNB |
| Audit trail | `audit_events` on money/ops actions |
| Booking holds | TTL by source/season; cron `expire-holds` |
| Cancel / no-show | Frees `room_assignments`; queues ARI when channel mapped |
| Accounting CSV | `/api/erp/export?kind=payments\|expenses\|folio_lines` |
| UAT checklist | `docs/UAT-CHECKLIST.md` |
| Brand assets | `design/brand/` + favicons/PWA icons |

---

## Not done / partial

| Item | Status |
|------|--------|
| **Calendar v2 leftovers / v3+** | See calendar section above |
| **Advanced HR** | Plan `advanced_hotel_hr_a72c26d2` — schema foundation started; cockpit/rota/payroll open |
| **Channex certification** | Schema + desk UI + webhook (secret required) + ack-after-import gate; needs staging API key, maps, live flush |
| **Live Pay.bt / bank QR** | Methods + deposit links + HMAC webhook with atomic claim; payment is desk-confirmed until merchant credentials exist |
| **PWA offline desk** | Installable shell; staff attendance offline queue exists; offline book/check-in/POS sync **not** built |
| **Recipe / food cost** | Inventory is SKU-level only |
| **Partner perks** | Master + visit counts increment on check-in; `discount_pct` / POS/spa auto-apply **not** built |
| **Agent voucher PDF/email** | Print + Resend text email shipped; branded PDF attachment still open |
| **Extra templates** | Only flagship `template_id=1` |
| **Mews pricing parity (P8+)** | Guest portal, SMS, BI/RMS, APIs/Key — after public UI + cert |
| **Push to origin** | Local tree may be ahead — push when ready |

---

## Desk nav map (as shipped)

`AppSidebar` groups (`web/src/components/erp/app-sidebar.tsx`):

- **Front desk:** Dashboard · Calendar · Arrivals · In-house · Departures · Reservations · Check-in · Fast book · Guests · Rooms · Housekeeping · Maintenance
- **Money:** Invoices · Payments · POS / Folio board · Finance · GST · Night audit
- **Channels:** Allotments · Channel · Partners · Agents
- **Inventory & people:** Stock · HR
- **Group:** Group overview · Add hotel · Reports
- **Footer:** Settings

Default ops home for room inventory: **`/erp/calendar`**.

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
| P5 | HR, inventory, audit, reports | Done (basic HR); advanced HR plan open |
| P5.5 | Fast-book UX v2 + StayDatesField + guest_origin + partners master | **Done (2026-07-29)** |
| P5.6 | ERP Timeline + shell + settings + **Sky & Citrus** reskin | **ERP core Done** — public rebuild/Airbnb still open; early Sheet-nav sketch → **Sidebar** |
| P6 | Channex + templates | **Foundation only** |
| P7 | Night audit, voids/comps, deposits, UAT doc | Done (provider APIs open) |
| P8+ | Mews pricing parity | Planned |

See also: [PLATFORM.md](PLATFORM.md) · [PLANS.md](PLANS.md) · [UAT-CHECKLIST.md](UAT-CHECKLIST.md) · [../AGENTS.md](../AGENTS.md)
