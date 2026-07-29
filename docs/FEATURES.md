# Pelbu Suites — Feature status

Last updated: **2026-07-29**.  
Property #1: `pelbu-suites-olakha` (`template_id` 1). Desk PIN via `DESK_PIN` (no username).

**Verdict:** Core hotel OS modules through go-live hardening are **built and applied on Supabase**, plus the 2026-07-29 UX v2 round (fast-book grid/drawer, StayDatesField, guest_origin, partners master). **P5.6 in progress:** Pelbu-pink marketing + Airbnb `/book` + Mews Timeline desk (hamburger `Sheet` nav). Not "100% done" — Channex certification, live Pay.bt/QR APIs, offline desk PWA, partner perks, and Mews pricing parity backlog remain.

---

## UX direction (locked 2026-07-29)

| Surface | North star | Notes |
|---------|------------|-------|
| `/book` | Airbnb funnel | Sticky summary; same booking actions |
| Public site | Mews craft + Pelbu-pink (`#ff83da`) | Mega-menu, Framer Motion, pill CTA |
| `/erp` | Mews Timeline | Default home `/erp/calendar`; Smart Detail |
| Desk nav | Hamburger → left **Sheet** (grouped) | Replaces long `DeskHeader` wrap; **not** shadcn Sidebar |
| Kit | Tailwind + shadcn + Framer Motion | |

See [PLATFORM.md — UX north stars](PLATFORM.md#ux-north-stars-2026-07-29).  
Briefs: `.cursor/commands/zai-handoff-mews-pink-public.md` · plan `stripe_ace_shadcn_ui_24b7e356`.

---

## Shipped

### Public PWA (`web/`)

| Feature | Route / notes |
|---------|----------------|
| Flagship conversion pages | `/`, rooms, cafe, restaurant, bar, dine, spa, meeting, book, order, contact, agents |
| CMS galleries + menus | Supabase `cms_*` / `menu_items` + Cloudinary `image_public_id` |
| Direct book | Creates booking; overbooking guard; hold TTL + deposit payment URL; uses `StayDatesField` (Dates mode default) |
| F&B order | Cafe/pastry/restaurant → KOT on desk |
| Agent apply | Markets BT / Jaigaon / India; pending → owner approve |
| Agent portal | `/agents/portal?token=…` (documents + hardened RLS) |
| Deposit pay page | `/pay/{token}` — guest sees amount; desk marks paid |

### Desk ERP (`/erp/*`)

| Module | Route | Status |
|--------|-------|--------|
| Inbox + KOT board | `/erp` | Live refresh via `/api/erp/kot-version` |
| Fast book | `/erp/fast-book` | **UX v2 (2026-07-29)** — calendar strip + Excel-like qty grid + contextual drawer + post-save split (desk invoice no Nu + agent voucher zero rates, printable). `StayDatesField` defaults to Nights for desk speed. Rates via folio |
| Check-in / out | `/erp/check-in` | **Guide required only for `guest_origin=international`**; partner pickers (guides/drivers) autofill free-text + carry `guide_id`/`driver_id`; SDF docs; guide/driver comp beds; folio |
| POS | `/erp/pos` | Cafe/bar/restaurant cashier → folio |
| Folio | `/erp/folios/[id]` | Payments, void, comp, deposit links |
| Agents | `/erp/agents` | Approve, credit, rates matrix, documents |
| Finance + bank recon | `/erp/finance` | Expenses, import JSON, match/ignore/auto-match |
| Partners | `/erp/partners` | **NEW (2026-07-29)** — guides + drivers master with visit counts, last-seen, search |
| Reports | `/erp/reports` | Occ (sellable vs comp), F&B, GST, agents, audit; CSV export |
| Rooms HK | `/erp/rooms` | Physical units clean/dirty/inspect/occupied/ooo |
| Inventory | `/erp/inventory` | SKU stock + movements |
| HR | `/erp/hr` | Staff, shifts, leave |
| Channel | `/erp/channel` | Channex maps, ARI queue, feed pull/ack (**foundation**) |
| Night audit | `/erp/night-audit` | One run per business date |

### Platform / integrations

| Feature | Notes |
|---------|--------|
| Rates + seasons | `room_rates`, peak/lean/off × tiers |
| Agent credit ledger | Limit + charge on credit bookings |
| Guide & driver partners | Master `guides`/`drivers` tables; `bookings.guide_id` + `bookings.driver_id`; visit counts; backfilled from legacy free-text |
| Guest origin | `bookings.guest_origin` (international/regional/official/local); drives guide-required rule |
| Bank recon parsers | `scripts/bank-recon/` — BoB, BNB, TBank, DrukPNB |
| Audit trail | `audit_events` on money/ops actions |
| Booking holds | TTL by source/season; cron `expire-holds` |
| Cancel / no-show | Frees inventory; queues ARI when channel mapped |
| Accounting CSV | `/api/erp/export?kind=payments\|expenses\|folio_lines` |
| UAT checklist | `docs/UAT-CHECKLIST.md` |
| Brand assets | `design/brand/` + favicons/PWA icons |

---

## Not done / partial

| Item | Status |
|------|--------|
| **Channex certification** | Schema + desk UI + webhook stub; needs staging API key, room/rate maps, live flush/ack |
| **Live Pay.bt / bank QR** | Methods + deposit links exist; payment is **desk-confirmed**, not provider webhook yet |
| **PWA offline desk** | Installable shell; offline book/check-in queue sync **not** built |
| **Multi-property switcher** | Migrations/helpers exist; UI WIP (may be uncommitted) |
| **Recipe / food cost** | Inventory is SKU-level only |
| **Partner perks** | Master data + visit counts exist; `discount_pct`, POS/spa perk application, folio auto-apply **not** built |
| **Agent voucher PDF/email** | Presentational shell shipped (print view); PDF generation + Resend send endpoints **open** |
| **Partner visit_count real-time** | Best-effort update on check-in + derived in reports; RPC increment **not** built |
| **Extra templates** | Only flagship `template_id=1` |
| **Next z.ai polish briefs** | Round 1 Pelbu-pink + Airbnb book — `.cursor/commands/zai-handoff-mews-pink-public.md`; Round 2 Mews Timeline + Sheet nav |
| **P5.6 UI north stars** | Marketing pink + Airbnb book + Timeline + hamburger Sheet — **in progress** |
| **Mews pricing parity (P8+)** | Guest portal, SMS, BI/RMS, APIs/Key — after P5.6 |
| **Push to origin** | Local `main` may be ahead — push when ready |

---

## Desk nav map

**Current (legacy):** Inbox · POS · Fast book · Check-in · … (long `DeskHeader` wrap — being replaced)

**Target (Mews / P5.6):** Top bar hamburger → left **Sheet** groups:

- Front desk: Timeline · Inbox · Arrivals · Check-in · Fast book  
- Money: POS · Folios · Payments · Finance · GST · Night audit  
- Guests & trade: Guests · Reservations · Agents · Partners  
- Property: Rooms/HK · Housekeeping · Maintenance · Inventory · Allotments  
- Insights: Reports · Channel · HR  
- Admin: Group / properties  

Default home: **`/erp/calendar`**.

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
| P5 | HR, inventory, audit, reports | Done |
| P5.5 | Fast-book UX v2 + StayDatesField + guest_origin + partners master | **Done (2026-07-29)** |
| P5.6 | Pelbu-pink + Airbnb book + Mews Timeline + Sheet nav | **In progress** |
| P6 | Channex + templates | **Foundation only** (cert + extra templates open) |
| P7 | Night audit, voids/comps, deposits, UAT doc | Done (provider APIs open) |
| P8+ | Mews pricing parity (guest portal, BI/RMS, APIs) | Planned |

See also: [PLATFORM.md](PLATFORM.md) · [UAT-CHECKLIST.md](UAT-CHECKLIST.md) · [../AGENTS.md](../AGENTS.md)
