# Whiteboard — Pelbu Suites live system

Last updated: 2026-08-01 (**v1.0**). This is the single desk-side map of what is live, how it is hosted, and what is next. Release package: [RELEASE-v1.md](RELEASE-v1.md). Detail: [FEATURES.md](FEATURES.md), [PLATFORM.md](PLATFORM.md), audit docs below.

---

## 1. What is live today

| Surface | URL / entry | Auth | Status |
|---------|-------------|------|--------|
| Public conversion site | Production Vercel (`pelbusuites` / Olakha) | None | Live — homepage, rooms, F&B, spa, meeting, agents, booking wizard |
| Guest laundry | `/laundry` (PWA) | Guest session cookie | Live — bag QR, intake, tracking |
| Desk / Work ERP | `/erp` (Work PWA) | DESK_PIN **or** staff Auth with `can_access_desk` | Live — 9 modules; calendar uses header tabs |
| Staff portal | `/staff` | Staff Auth | Live — leave, payslips, laundry labels |
| Agent portal | `/agents` | Agent Auth | Live — voucher / book |
| Public pay link | `/pay/[token]` | Token | Live |

### ERP modules (sidebar)

| Module | Landing | Tabs |
|--------|---------|------|
| Dashboard | `/erp` | — |
| Calendar | `/erp/calendar` | Room rack, Day sheet |
| Front desk | `/erp/arrivals` | Arrivals, In-house, Departures, Check-in, **Check-out**, Fast book, Reservations, Guests, **Groups**, **Loyalty** |
| Rooms | `/erp/rooms` | Rooms, Housekeeping, Maintenance, Laundry |
| POS | `/erp/pos` | Register, Menu, Kitchen TV |
| Money | `/erp/payments` | Payments, Invoices, Night audit, GST, Finance, **Reports** |
| Channels | `/erp/agents` | Agents (**dossier** `/erp/agents/[id]`), Partners, Allotments, Channel |
| Team & stock | `/erp/hr` | HR, Rota, Attendance, Leave, Payroll, Stock |
| Hotel | `/erp/settings` | Settings, Website CMS, Media, Phone upload, Add hotel |

Deep links such as `/erp/folios/[id]`, `/erp/bookings/[id]`, `/erp/orders/[id]/slip` stay as detail routes (not sidebar tabs).

---

## 2. Hosting stack (as shipped)

| Layer | Provider | Notes |
|-------|----------|-------|
| App | Vercel (Next.js 16 / Turbopack) | Crons: `expire-holds`, staff notification drain, **night-audit** (`0 18 * * *` UTC ≈ midnight Thimphu). Set `CRON_SECRET` in production. |
| CI | GitHub Actions | `.github/workflows/web-ci.yml` — lint + unit tests + typecheck on `web/` |
| Observability | Sentry (optional) | Set `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`; no-op when unset |
| Rate limits | In-memory (+ optional Upstash) | Login, pay links, book/order, webhooks |
| Staging | Documented | Preview/staging must use a **non-prod** Supabase project or branch — see §2.1 |
| Database + Auth + Realtime | Supabase (`umrpibwhxpzsfdyupiuf`) | Service-role used widely from server actions |
| Images / docs | Cloudinary | CMS media + SDF docs + laundry photos |
| Email | Resend | Booking / staff notices |
| WhatsApp | CallMeBot | Ops alerts (not a full WhatsApp Business API) |
| PWA | `work.webmanifest` + public laundry PWA | Installable desk + guest laundry |

**International ERP intent:** the product can later move the data plane to an AWS VM (own Postgres, mail, WhatsApp Business API). That move is **not** required for multi-tenant SaaS on the current stack — see [MULTI-TENANT-WHITELABEL.md](MULTI-TENANT-WHITELABEL.md).

### 2.1 Staging (required before risky money deploys)

| Env | App | Database |
|-----|-----|----------|
| Production | Vercel production | Supabase project `umrpibwhxpzsfdyupiuf` |
| Staging / Preview | Vercel Preview **or** second Vercel project `pelbusuites-staging` | Separate Supabase project **or** Supabase branch — never point Preview at prod DB |
| Local | `npm run dev` | Same as staging preferred; `.env.local` |

**White-label foundation (2026-08-02):** `properties.public_host` / `desk_host` + middleware `x-pelbu-property-*` headers via `resolvePropertyIdFromHost`. Tenant billing email + seats_used + DNS TXT verify / cert status UI shipped (invoice-first; no Stripe). See [MULTI-TENANT-WHITELABEL.md](MULTI-TENANT-WHITELABEL.md).

**Competitive gap close (2026-08-02):** connecting rooms + rack virtualization; night-audit `close_time`; group AR statement print; loyalty portal lite; offline IndexedDB drafts; DRC e-invoice stub; recipe-cost rollup; edge journal proof tests. Residuals below are **ops / business**, not missing desk code.

Launch cutover: [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) · Finance pack: [FINANCE-UAT.md](FINANCE-UAT.md).

---

## 3. Property model today

- Every ops row is keyed by `property_id`.
- Desk can switch the active property (cookie / context).
- `template_id = 1` is Pelbu Suites Olakha (flagship).
- Group overview and “Add hotel” exist; Host → property middleware + Settings hostnames shipped.
- Tenants foundation (`tenants` / `tenant_members` / billing email / seats / cert status) shipped; **Stripe self-serve** still open.

---

## 4. Desk UX shipped (recent passes)

### 2026-08-01 — Calendar density + sidebar identity

| Fix | Route / component | What changed |
|-----|-------------------|--------------|
| Category-grouped rack | `RoomRackGrid` | Floor groups → **category** groups; color acronym chips; Categories legend popover |
| Slim left pane | `RoomRackGrid` | 108px desktop / 72px mobile room column |
| Sticky scroll containment | `RoomRackGrid` + `DeskShell` | Room column stays pinned; no slide-over nav on horizontal scroll |
| Header calendar tabs | `CalendarHeaderTabs` + `DeskShell` | Room rack / Day sheet in sticky header; `ModuleTabs` suppressed on calendar |
| Occupancy + go-to-date | `RoomRackGrid` toolbar | Occupancy popover; date input + window paging for far-future |
| Icon-collapsed sidebar | `sidebar.tsx` + `DeskShell` | Default collapsed; 13rem expanded; hover peek; cookie `sidebar_state_v2` |
| Property logo in nav | `AppSidebar` + Settings Identity | Cloudinary logo from `/erp/settings` |

### 2026-07-31 — Front desk process UX

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

| Gap | Why engineers will call it “vibe coded” | Target standard | Status |
|-----|------------------------------------------|-----------------|--------|
| Empty folio after check-in | Room nights post on night-audit cron, not at check-in; balance Nu 0 with 0 lines until roll | Clear copy + optional same-day post | **Partial** — cron + posting + copy shipped; optional day-one post still open |
| Laundry money integrity | GST / reversal / cancel paths | Fix GST form post; reverseJournal on correction; block cancel without void | **Largely fixed 2026-08-01** — see ERP-AUDIT §7.1 |
| Service-role bypass | Most desk writes use admin client; RLS is a second fence, not the primary one | AuthZ at action + RLS for non-admin clients | **Partial** — Wave 2 money gates + `assertDeskProperty`; staff-scoped client rewrite open |
| RLS enabled, 0 policies | Several booking/order tables | Add policies or document admin-only | **Fixed 2026-08-01** — service_role policies migration |
| No night-audit cron | Only `expire-holds` was scheduled | Cron + room-night posting | **Fixed 2026-08-01** — cron + blockers + `close_time` (2026-08-02) |
| White-label incomplete | Multi-property DB yes; multi-hostname public + tenant billing no | Host middleware + tenant accounts | **Partial** — Host + tenants foundation + billing/seats/cert UI; Stripe open |
| Calendar Realtime | Poll-only refresh on rack | Supabase Realtime + channel toasts | **Partial** — poll + toast on fingerprint change (no browser Realtime by design) |
| Crawl waves A–G | Authenticated HTTP matrix in ERP-AUDIT §4; Playwright MCP pending user enable | Interactive button pass after MCP green | **Partial** — routes 200; click-through pending |

---

## 6. Documentation set

| Doc | Purpose |
|-----|---------|
| [WHITEBOARD.md](WHITEBOARD.md) | This map |
| [RELEASE-v1.md](RELEASE-v1.md) | Combined v1.0 release (plans → outcome) |
| [ERP-AUDIT.md](ERP-AUDIT.md) | International PMS fault register + correction roadmap |
| [FEATURES.md](FEATURES.md) | Module shipped vs remaining |
| [PLANS.md](PLANS.md) | Cursor plans status mirror |
| [MULTI-TENANT-WHITELABEL.md](MULTI-TENANT-WHITELABEL.md) | SaaS white-label + DNS + Host routing |
| [BTCL-ADAPTATION.md](BTCL-ADAPTATION.md) | Multi-hotel chain (BTCL) adaptation |
| [PLATFORM.md](PLATFORM.md) | Architecture north star |
| [UAT-CHECKLIST.md](UAT-CHECKLIST.md) | Go-live desk smoke tests |
| [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) | Launch-day env + smoke |
| [FINANCE-UAT.md](FINANCE-UAT.md) | Period close / GST / bank recon / edge journals |
| [OPS-RUNBOOK.md](OPS-RUNBOOK.md) | Night audit / payments / hosts / channel ops |
| [CHANNEX-CERT.md](CHANNEX-CERT.md) | Live Channel cert after desk ARI is ready |
| [GST-EINVOICE.md](GST-EINVOICE.md) | Bhutan DRC e-invoice stub vs live mandate |

---

## 7. Beat eZee / IDS waves — shipped (2026-08-02)

| Wave | Scope | Status |
|------|--------|--------|
| **0** | Docs / UAT honesty (no invented initials) | **Shipped** |
| **1** | Channel desk + ARI (active property, rates/restrictions, flush/retry) | **Code shipped** — live cert needs human `CHANNEX_*` |
| **2** | AuthZ purge (`desk_role`, money gates, `assertDeskProperty`, prod PIN retire) | **Shipped** — staff-scoped client rewrite still residual |
| **3** | FO / cashiering parity (blockers, transfer, laundry gateway, CN print, AR statement, …) | **Shipped** |
| **4** | SaaS tenants foundation (Host, billing email/seats, cert verify UI) | **Shipped** — Stripe / domain automation open |
| Competitive gap close | Connecting rooms, `close_time`, loyalty lite, offline drafts, recipe cost, DRC stub | **Shipped** |

### Residual ops for the owner (not engineering build order)

1. Run [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) + [FINANCE-UAT.md](FINANCE-UAT.md) — **real initials only**.
2. Supabase Auth → enable **HaveIBeenPwned** leaked-password protection.
3. Set Preview then prod `CHANNEX_API_KEY` / `CHANNEX_WEBHOOK_SECRET`; complete [CHANNEX-CERT.md](CHANNEX-CERT.md).
4. Remove `ALLOW_DESK_PIN_IN_PROD` once staff Auth + `desk_role` covers the desk.
5. Optional: live Pay.bt merchant credentials; `SENTRY_DSN`; Upstash Redis for multi-instance rate limits.
6. Business residuals (not code): Stripe self-serve, 24/7 support staffing, full RMS / theoretical vs actual, P3 locks / public API.

### Still engineering (deal-triggered / optional)

- **P2 BTCL (Wave 5):** multi-outlet POS at scale, 200+ staff HR, chain reporting — [BTCL-ADAPTATION.md](BTCL-ADAPTATION.md).
- **P3:** door locks, kiosk, public API / webhooks — Mews Enterprise catalog; not scoped for Olakha go-live.
- Ops day-to-day: [OPS-RUNBOOK.md](OPS-RUNBOOK.md).
