# Pelbu Suites — Feature status

Last updated: **2026-07-29**.  
Property #1: `pelbu-suites-olakha` (`template_id` 1). Desk PIN via `DESK_PIN` (no username).

**Verdict:** Core hotel OS modules through go-live hardening are **built and applied on Supabase**. Not “100% done” — Channex certification, live Pay.bt/QR APIs, offline desk PWA, and multi-property switcher polish remain.

---

## Shipped

### Public PWA (`web/`)

| Feature | Route / notes |
|---------|----------------|
| Flagship conversion pages | `/`, rooms, cafe, restaurant, bar, dine, spa, meeting, book, order, contact, agents |
| CMS galleries + menus | Supabase `cms_*` / `menu_items` + Cloudinary `image_public_id` |
| Direct book | Creates booking; overbooking guard; hold TTL + deposit payment URL |
| F&B order | Cafe/pastry/restaurant → KOT on desk |
| Agent apply | Markets BT / Jaigaon / India; pending → owner approve |
| Agent portal | `/agents/portal?token=…` (documents + hardened RLS) |
| Deposit pay page | `/pay/{token}` — guest sees amount; desk marks paid |

### Desk ERP (`/erp/*`)

| Module | Route | Status |
|--------|-------|--------|
| Inbox + KOT board | `/erp` | Live refresh via `/api/erp/kot-version` |
| Fast book | `/erp/fast-book` | Overbooking + rates/credit; UI polish via z.ai brief |
| Check-in / out | `/erp/check-in` | Guide #, SDF, guide/driver beds, folio |
| POS | `/erp/pos` | Cafe/bar/restaurant cashier → folio |
| Folio | `/erp/folios/[id]` | Payments, void, comp, deposit links |
| Agents | `/erp/agents` | Approve, credit, rates matrix, documents |
| Finance + bank recon | `/erp/finance` | Expenses, import JSON, match/ignore/auto-match |
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
| **Extra templates** | Only flagship `template_id=1` |
| **z.ai fast-book polish** | Brief ready: `.cursor/commands/zai-handoff-ready.md` |
| **Push to origin** | Local `main` may be ahead — push when ready |

---

## Desk nav map

Inbox · Check-in · POS · Fast book · Agents · Finance · Reports · Rooms · Stock · HR · Channel · Audit (night)

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
| P6 | Channex + templates | **Foundation only** (cert + extra templates open) |
| P7 | Night audit, voids/comps, deposits, UAT doc | Done (provider APIs open) |

See also: [PLATFORM.md](PLATFORM.md) · [UAT-CHECKLIST.md](UAT-CHECKLIST.md) · [../AGENTS.md](../AGENTS.md)
