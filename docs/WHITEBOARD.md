# Whiteboard — Pelbu Suites live system

Last updated: 2026-07-31. This is the single desk-side map of what is live, how it is hosted, and what is next. Detail lives in [FEATURES.md](FEATURES.md), [PLATFORM.md](PLATFORM.md), and the audit docs linked at the bottom.

---

## 1. What is live today

| Surface | URL / entry | Auth | Status |
|---------|-------------|------|--------|
| Public conversion site | Production Vercel (`pelbusuites` / Olakha) | None | Live — homepage, rooms, F&B, spa, meeting, agents, booking wizard |
| Guest laundry | `/laundry` (PWA) | Guest session cookie | Live — bag QR, intake, tracking |
| Desk / Work ERP | `/erp` (Work PWA) | DESK_PIN **or** staff Auth with `can_access_desk` | Live — 9 modules, module tabs |
| Staff portal | `/staff` | Staff Auth | Live — leave, payslips, laundry labels |
| Agent portal | `/agents` | Agent Auth | Live — voucher / book |
| Public pay link | `/pay/[token]` | Token | Live |

### ERP modules (sidebar)

| Module | Landing | Tabs |
|--------|---------|------|
| Dashboard | `/erp` | — |
| Calendar | `/erp/calendar` | Room rack, Day sheet |
| Front desk | `/erp/arrivals` | Arrivals, In-house, Departures, Check-in, **Check-out**, Fast book, Reservations, Guests |
| Rooms | `/erp/rooms` | Rooms, Housekeeping, Maintenance, Laundry |
| POS | `/erp/pos` | Register, Menu, Kitchen TV |
| Money | `/erp/payments` | Payments, Invoices, Night audit, GST, Finance, Reports |
| Channels | `/erp/agents` | Agents, Partners, Allotments, Channel |
| Team & stock | `/erp/hr` | HR, Rota, Attendance, Leave, Payroll, Stock |
| Hotel | `/erp/settings` | Settings, Website CMS, Media, Phone upload, Group, Add hotel |

Deep links such as `/erp/folios/[id]`, `/erp/bookings/[id]`, `/erp/orders/[id]/slip` stay as detail routes (not sidebar tabs).

---

## 2. Hosting stack (as shipped)

| Layer | Provider | Notes |
|-------|----------|-------|
| App | Vercel (Next.js 16 / Turbopack) | Hobby cron: `expire-holds` only |
| Database + Auth + Realtime | Supabase (`umrpibwhxpzsfdyupiuf`) | Service-role used widely from server actions |
| Images / docs | Cloudinary | CMS media + SDF docs + laundry photos |
| Email | Resend | Booking / staff notices |
| WhatsApp | CallMeBot | Ops alerts (not a full WhatsApp Business API) |
| PWA | `work.webmanifest` + public laundry PWA | Installable desk + guest laundry |

**International ERP intent:** the product can later move the data plane to an AWS VM (own Postgres, mail, WhatsApp Business API). That move is **not** required for multi-tenant SaaS on the current stack — see [MULTI-TENANT-WHITELABEL.md](MULTI-TENANT-WHITELABEL.md).

---

## 3. Property model today

- Every ops row is keyed by `property_id`.
- Desk can switch the active property (cookie / context).
- `template_id = 1` is Pelbu Suites Olakha (flagship).
- Group overview and “Add hotel” exist; there is **no** hostname → property router yet (one public site = one brand).

---

## 4. Desk UX shipped this pass (2026-07-31)

| Fix | Route / component | What changed |
|-----|-------------------|--------------|
| Guest docs hybrid | `CheckInForm` | Dense **table** for guests; rooms / guide / driver stay form fieldsets |
| Dedicated check-out | `/erp/check-out` | Folio lines + payment + confirm; in-house stays redirect here from check-in |
| Open tickets load | `OpenTicketsDrawer` | Tap a ticket → detail panel with items + all actions |
| Nav IA | `erp-nav.ts` + `ModuleTabs` | Sidebar collapsed to 9 modules; tabs per module |

Local crawl (desk session cookie): **all static ERP routes returned HTTP 200** (login → 307 to `/erp`). Detail routes for a known in-house stay and folio also 200; check-in of an in-house booking correctly redirects to check-out.

---

## 5. Known process gaps (summary)

Full severity register: [ERP-AUDIT.md](ERP-AUDIT.md).

| Gap | Why engineers will call it “vibe coded” | Target standard |
|-----|------------------------------------------|-----------------|
| Empty folio after check-in | Room nights not auto-posted; balance Nu 0 with 0 lines is normal until charges post | Night-audit room-night posting (OHIP / Opera pattern) |
| Laundry money integrity | GST checkbox never submits; correction voids folio without reversing journal; cancel can orphan charges | Fix GST form post; reverseJournal on correction; block cancel without void |
| Service-role bypass | Most desk writes use admin client; RLS is a second fence, not the primary one | AuthZ at action + RLS for non-admin clients |
| RLS enabled, 0 policies | `booking_guests`, `booking_rooms`, `booking_drivers`, `guides`, `drivers`, `order_items` | Add policies or document admin-only |
| No night-audit cron | Only `expire-holds` is scheduled; night audit is snapshot-only | Nightly room-post job + period lock |
| White-label incomplete | Multi-property DB yes; multi-hostname public + tenant billing no | Host middleware + tenant accounts |

---

## 6. Documentation set

| Doc | Purpose |
|-----|---------|
| [WHITEBOARD.md](WHITEBOARD.md) | This map |
| [ERP-AUDIT.md](ERP-AUDIT.md) | International PMS fault register + correction roadmap |
| [MULTI-TENANT-WHITELABEL.md](MULTI-TENANT-WHITELABEL.md) | SaaS white-label + DNS + Host routing |
| [BTCL-ADAPTATION.md](BTCL-ADAPTATION.md) | Multi-hotel chain (BTCL) adaptation |
| [FEATURES.md](FEATURES.md) | Module shipped vs remaining |
| [PLATFORM.md](PLATFORM.md) | Architecture north star |
| [UAT-CHECKLIST.md](UAT-CHECKLIST.md) | Go-live tests |

---

## 7. Next build order (engineering)

1. **P0 money:** room-night posting on night audit; folio immutability + reversal; period lock.
2. **P0 laundry money:** catalog seed enforcement; folio post + reversing entry on correction.
3. **P1 authZ:** staff-scoped clients for reads; policies on zero-policy tables; leaked-password protection on Auth.
4. **P1 white-label MVP:** `Host` → `property_id` middleware; per-tenant public CMS; tenant login landing.
5. **P2 BTCL:** multi-outlet POS, 200+ staff HR scale, chain reporting — see BTCL doc.
