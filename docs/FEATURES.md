# Pelbu Suites — Feature status

Last updated: **2026-07-29**.  
Property #1: `pelbu-suites-olakha` (`template_id` 1). Desk PIN via `DESK_PIN` (no username).

**Verdict:** Core hotel OS modules through go-live hardening are **built and applied on Supabase**, plus the 2026-07-29 UX v2 round (fast-book grid/drawer, StayDatesField, guest_origin, partners master). Not "100% done" — Channex certification, live Pay.bt/QR APIs, offline desk PWA, partner perks, and multi-property switcher polish remain.

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
| **Next z.ai polish briefs** | POS density + agents desk cards — see `.cursor/plans/ui_arch_compact_592f39c6.plan.md` |
| **Push to origin** | Local `main` may be ahead — push when ready |

---

## Desk nav map

Inbox · POS · Fast book · Check-in · Agents · Finance · Partners · Reports · Rooms · Stock · HR · Channel · Audit (night)

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
| P6 | Channex + templates | **Foundation only** (cert + extra templates open) |
| P7 | Night audit, voids/comps, deposits, UAT doc | Done (provider APIs open) |

See also: [PLATFORM.md](PLATFORM.md) · [UAT-CHECKLIST.md](UAT-CHECKLIST.md) · [../AGENTS.md](../AGENTS.md)
