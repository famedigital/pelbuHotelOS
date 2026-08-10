# Pelbu Suites — Feature status

Last updated: **2026-08-10** (docs full re-sync after **`fc23144`**).  
Last full multi-file documentation commit before this: **`fc23144`** (2026-08-06 — StayHub walk-in FO).  
Product HEAD at docs write: `main` including uncommitted desk FO (agent commerce, POS folio strip, **PS** confirmation codes).

Property #1: `pelbu-suites-olakha` (`template_id` 1). Work login supports staff Auth with desk access; `DESK_PIN` remains a temporary single-hotel fallback — **never share across hotels**.

**Verdict:** **v1.0 ready** for single-hotel Pelbu Olakha — see **[RELEASE-v1.md](RELEASE-v1.md)**. Core desk OS + public conversion PWA are **built**. **2026-08-06:** StayHub walk-in. **2026-08-06→10:** bar packs · desk Ctrl+K search · party reservations · agreed rates · folio POS serve/void · guest Nu 0/5 · one book modal · public menu immerse · agent commerce (guide evidence, room cap, AR labels) · stay confirmation **`PS-YYYY-#####`**. Day-1 ops: **[GO-LIVE-TOMORROW.md](GO-LIVE-TOMORROW.md)**; agent FO: **[FO-AGENT-COMMERCE-CHECKLIST.md](FO-AGENT-COMMERCE-CHECKLIST.md)**; cutover: **[LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md)**. Residuals: live Channex cert, Stripe self-serve, SEC-01 admin client purge.

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
| Public menu UX (2026-08) | Immersive mobile chrome; compact desktop filters; menu GST from property rate; guest totals rounded hotel-side to Nu **0 or 5** |
| Header logo | Public header logo no longer clipped below the bar |
| Mobile home / book / POS | Photo-first home hero; mobile POS cart + tickets; public book polish |
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
| **Desk search** | Header **Search** · **Ctrl+K** command palette → modules + guests / rooms / bookings (**PS conf #**) / invoices / agents (`/api/erp/desk-search`) |
| Free-tier / resilience | Flagship middleware skips Supabase when possible; slower desk polls; KOT SSE pauses when tab hidden; middleware fail-open if Auth down |
| Reskin | **Sky & Citrus (final)** — shadcn primitives + TanStack `DataTable`; sky-500 accent + amber citrus under `.erp`. Plan `erp_shadcn_reskin_d79ac669` (all 13 clusters) |

### Desk ERP modules

| Module | Route | Status |
|--------|-------|--------|
| **Dashboard** (role home) | `/erp` (+ role lands: FO → arrivals, kitchen → kitchen, cashier/F&B → POS) | **Per desk role:** tab-level defaults via `desk_module_keys` NULL (cashier: POS+payments+folios; kitchen: kitchen+KDS; FO: arrivals…night-audit without sales/loyalty/group). Owner/GM full catalog. Login redirects to role home. |
| **Calendar / Timeline** | `/erp/calendar` | **v1–v2 shipped (2026-07-29)** — see below |
| Calendar day sheet | `/erp/calendar/day-sheet` | Printable arrivals / departures / stayovers / blocks |
| Fast book | Modal on `/erp/reservations?new=1` (deeplink `/erp/fast-book` redirects) | **DeskBook re-engineer (2026-08-10):** StayHub-style left price rail + dense form — guest origin vs bill-to-agent, meal/children/extra, multi-category rooms, **guide/driver comps**, live **remaining inventory**, package bill break (rooms/meal/extra), walk-in **rate tier** (public/friends/family/mutual), promo + notes + email, preferred rack unit chip, agent **room-cap soft warn**. Classic FastBook path retired. Confirm pack or **same-day → StayHub Check-in** (footer Confirm check-in). |
| **Stay confirmation #** | `bookings.confirmation_code` | **`PS-YYYY-#####`** gapless per property (Thimphu year); trigger on insert + backfill. Searchable. **Not** a tax invoice. Tax = **`INV-YYYY-####`** from folio fiscal issue only. |
| **StayHub (FO hub)** | Modal from calendar / boards / reservations | One surface: Details → Check-in → **Folio** → Checkout. In-house **opens Folio** (not Checkout). **Details footer Continue to check-in** when confirmed; Confirm token refreshes + advances CI. Dense origin-aware CI/guest (local hides guide/driver/SDF). Rail + URL `?step=` in sync. Folio tools: **Bill · Collect · Advanced**; tabs **All · Room · POS**; POS strip + **Guest pays F&B** / **Charge agent AR** / **Put F&B on agent tab**. Settle labels: cash = Collect; agent = **Charge agent AR**. **Confirm #** on header/boards. Agent leave: print pack → guide ink → camera/file → leave when photo/waived. `/erp/bookings/[id]/settlement-pack`. **Open-room cap** on CI. Soft confirm_mode / advance badges. See [FO-AGENT-COMMERCE-CHECKLIST.md](FO-AGENT-COMMERCE-CHECKLIST.md). |
| Check-in / out | StayHub panels + `/erp/check-in` | Compact origin-aware form (local CID; intl/regional passport/SDF/guide); driver only when comps/tours; business-date gate; sticky Confirm CI; **post-CI guest registration print + signed-card camera/file upload** (`bookings.reg_card_photo_public_id`); re-upload on Guest while in-house; Undo CI when folio simple; CO → dirty; agent CO gated on guide evidence |
| Arrivals / in-house / departures | `/erp/arrivals` etc. | Boards open StayHub (CI / Stay-Money / CO); show **PS** conf #; today’s worklists only for A/D |
| Reservations / guests | `/erp/reservations`, `/erp/guests` | **Party board** (groups + suggested multi-room); rooming list; filters room/dates/sort; search guest/phone/agent/room/**PS conf #**; Ctrl+K globally |
| **POS / F&B** | `/erp/pos` (+ tabs) | Register · Menu · Recipe cost · Kitchen board · Food cost · Kitchen TV. Open tickets + Closed today; floor plan; shifts. Room-charge → folio with item serve/void on StayHub POS. Guest Nu 0/5 on F&B bills. **Bar packs** |
| **Menu (catalog + bar)** | `/erp/menu` | Catalog · **Bar packs** (spirit pek+bottle, beer case, waste) · Stock & recipes · Categories. Spirits in **ml**; default 30 ml pek |
| **Laundry** | `/erp/laundry` · guest `/laundry` · staff `/staff/laundry` | Bag QR; scan/login hardened; reprint without invalidating stickers; maid board → folio post |
| Folio | `/erp/folios/[id]` (+ `/receipt`) | Payments (cash vs agent AR), void, comp, minibar/damage; INV/RCP issue; day-1 post; POS serve/void; whole-Nu hotel rate adj (room/F&B); Group/master Advanced |
| **Kitchen board** | `/erp/kitchen` (+ `/food-cost`) | Covers · meal services → POS · food cost · events & groups (banquet) — chef/F&B home not FO Dashboard |
| Invoices / payments | `/erp/invoices`, `/erp/payments` | Fiscal **INV-YYYY-####** issued only; not POS tickets. Closed-today tickets under POS |
| Agents | `/erp/agents` (+ dossier) | Approve, credit, rates; dossier Money: open rooms vs **open_room_cap**, owes, settlement packs; TCB directory; **Credit promote**; desk credit path polished |
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
| Room rates | `/erp/rates` | **Public package card** primary; market tiers; seasons; meal strip → Settings; **manager-PIN agreed nightly rate** on stay for specials |
| Settings | `/erp/settings` | Hub + dual mode · staff group nav · `?tab=` deep links (Identity, Tax, Rooms, etc.); floor/map ops assets |
| **DOT assessment** | `/erp/dot-assessment` | HCS 2024 3★/4★ digital checklist (Trade · BFDA · DOT), entry gate, M/Q/P scores, photos, print pack |

### Shipped since full docs (`fc23144` · 2026-08-06 → 2026-08-10)

| Area | What landed | Key commits / notes |
|------|-------------|---------------------|
| **Bar packs + resilience** | Pour packs; Ctrl+K desk search; folio stale check; free-tier middleware / poll / KOT pause | `b29031d`, `85f788e`, `2a8bbce` |
| **Laundry bag QR** | Scan/login fix; sticker reprint safe | `9f63c25` |
| **Party reservations** | Party board, rooming list, mobile polish | `ae5bf73` |
| **Agreed nightly rate** | Manager PIN override on stay | `9e089be` |
| **Folio money ops** | POS serve-by + item void audit; hotel whole-Nu rate adj; GL adj fixes | `bf05801`…`51ba8cd` |
| **Desk book unify** | One book modal; tabbed Folio Bill/Collect/Advanced | `a43c41a` |
| **Public menu + logo** | Immersive menu, GST sync, Nu 0/5 guest, logo clip fix | `b818fe8`…`54aff19` |
| **Credit promote / rates / print** | Directory→credit promote; public rates; print assets; floor/map | `58ced1f` |
| **Agent commerce (uncommitted @ docs)** | Guide photo/waive CO gate; seal + Resend pack; open_room_cap; agent AR CTAs; settlement packs page | mig `20260809200000_*`; checklist |
| **Stay conf numbers (uncommitted @ docs)** | `PS-YYYY-#####` on booking; search RES + Ctrl+K; pack docs | mig `20260810010000_*` |
| **Business date** | `properties.current_business_date` + CI gate | mig `20260809140000_*` |
| **Folio POS payor** | Always show POS; guest pay / charge AR / put on agent tab | StayHub DeskSettle |

**Migrations to apply if not production yet:** `20260809140000_property_current_business_date` · `20260809200000_agent_settlement_guide_sign_room_cap` · `20260810010000_booking_confirmation_code` (remote may already have backfill).

### Calendar / room rack (plan `calendar_drag_booking_64bad6ba`)

| Slice | Status |
|-------|--------|
| **v1** Full-bleed grid, drag-select → modal book/group, HoverCard, agents payload | **Done** |
| **v1.5** Unassigned pool + assign, lock, edit modal, same-type move + 60s undo, OOO/OOS/hold + HK column, search, day filters, source chips | **Done** |
| **v2** Cross-type move rate Continue/Override, split stay, resize via modal, live **poll** refresh (`/api/erp/calendar-version`), group tint, print day sheet, Bhutan badges (guide / on-credit) | **Done with gaps** |
| Monthly occupancy cards + today rooms | **Done** (Occupancy popover in toolbar) |
| **Walk-in FO path (2026-08-06)** | **Done** — single-room create → StayHub **Check-in**; phone later; no auto-save cache thrash; adults default 1 — plan `stayhub_walk-in_ux_4eb64b91` |
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

**v3+ still open (optional):** overbooking buffer, stop-sell markers on rack, allotment pickup curves, VIP/repeat-guest intelligence, full keyboard mode — pull only when desk asks. **Party board + rooming list shipped.**

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
| Cancel / no-show | Frees `room_assignments`; queues ARI when channel mapped; visible on StayHub **Check-in** step (not only Reserve) |
| **Undo check-in** | `undoCheckIn` — status → `confirmed`, keep room assignment; voids day-1 room/meal/extra_bed only; **blocks** if payments or other charges posted; audit `checkin.undo` |
| **Booking confirmation #** | `bookings.confirmation_code` → `PS-YYYY-#####` (unique per property); RES `?q=` + Ctrl+K |
| **Agent settlement** | Guide sign photo/waive · settlement packs · `open_room_cap` · seal/email (Resend) |
| **Agreed nightly rate** | Manager PIN special rate on booking |
| Accounting CSV | `/api/erp/export?kind=payments\|expenses\|folio_lines\|immigration\|agent-production\|agent-commission` |
| Playwright desk smoke | `web/e2e/money-path.spec.ts` — skips without `PLAYWRIGHT_*` secrets |
| UAT | `docs/UAT-CHECKLIST.md` · [FO-AGENT-COMMERCE-CHECKLIST.md](FO-AGENT-COMMERCE-CHECKLIST.md) |
| Brand assets | `design/brand/` + favicons/PWA icons |

### StayHub walk-in FO (plan `stayhub_walk-in_ux_4eb64b91` · **shipped 2026-08-06**)

Target desk path: **click room today → name (phone optional) → StayHub Check-in → Confirm check-in in footer**.

| Slice | Status | Notes |
|-------|--------|--------|
| **Phone later** | **Done** | Empty / deferred phone on calendar create + StayHub auto-save + Fast Book; filled numbers still `assertPhone`. Soft banner on CI when phone missing (no hard block). |
| **Fast identity save** | **Done** | `updateCalendarReservationDetails` does **not** call heavy multi-path `revalidatePath`; client drops per-keystroke `router.refresh()` — refresh on hub close / create / CI / undo. Create still uses `revalidateCalendarHeavy` once; notify/ARI fire-and-forget. |
| **Sticky Confirm check-in** | **Done** | Footer submits `form="stay-hub-checkin-form"`; embedded form `id` on `CheckInForm`; body submit hidden when embedded; loading CTA while payload pending. |
| **Open on Check-in** | **Done** | Single-room rack create opens StayHub `step: "check_in"` (group → Reserve). |
| **Adults default 1** | **Done** | Single / multi unit: adults = unit count (min 1); Fast Book default 1; CI guest rows follow adults (remount key). |
| **Cancel / no-show on CI** | **Done** | `BookingLifecycleActions` on arrival/check-in panels. |
| **Undo check-in** | **Done** | Footer on post-CI Check-in + Stay/Money; `web/src/lib/checkin-undo.ts` guards + tests. |
| **Prefetch CI form** | **Done** | `fetchStayHubCheckIn` when hub opens for pending/confirmed. |

**Key files:** `erp-calendar.ts`, `erp-checkin.ts`, `StayHubDialog.tsx`, `CheckInForm.tsx`, `CalendarReservationDialog.tsx`, `FastBookForm` / `FastBookDrawer`, `checkin-undo.ts`.

**Known residual (not this pass):** create still has multiple serial Supabase writes + one heavy revalidate (expect ~1s+, not 4–5s freeze from remount thrash). Full Opera worklist redesign / multi-property out of scope.

### Desk polish bundled same push (`8ba9342`)

| Item | Status | Notes |
|------|--------|--------|
| **Menu editor no full remount** | **Done** | Item save/toggle skips `revalidatePath("/erp/menu")`; grid keeps local catalog + `onSaved` |
| **Reservations list filters** | **Done** | Room fit / date range / sort + room column (`booking-room-fit.ts`) |
| **Building layout (rooms map)** | **Done / improved** | Migration `building_layout`; Plan = 2D editor; **Building = WebGL (R3F) SketchUp-style orbit/pan/zoom**, floor tabs, room click dossier — [`BuildingScene3D.tsx`](web/src/components/erp/building/BuildingScene3D.tsx). Not BIM / CAD modeler. |

### Bar pour packs (2026-08-06)

Spirits / beer share **one inventory ledger** across multiple sell sizes. Checkout still uses existing `pos_apply_order_stock` (`qty_per_sale` only).

| Setting | Old Monk worked example |
|---------|-------------------------|
| Pour (pek) | 30 ml (property `bar_standard_pour_ml`, default 30) |
| Bottle | 300 ml |
| Auto | **10 peks / bottle** (`peksPerBottle`) |
| Receive 2 bottles | +600 ml on hand |
| Sell 3 peks | −90 ml → 510 ml left (~17 peks / 1 full bottle + 210 ml) |
| Sell 1 bottle | −300 ml |

**Acceptance matrix (manual desk check)**

- [ ] Create Old Monk 300 ml → Pek + Bottle rows; UI shows 10 peks/bottle
- [ ] Receive 1 bottle → POS: 10 peks / 1 bottle left on paired tiles
- [ ] Sell pek then bottle; both drain the same ml balance (no double stock)
- [ ] Beer: receive 1×24 case → 24 bottle availability
- [ ] Waste 2 peks reduces pek count without a sale
- [ ] Categories tab: add “House pours”, assign on item form

**Key files:** migration `20260806230000_bar_pour_packs.sql`; `web/src/lib/bar-packaging.ts`; actions in `erp-menu.ts`; UI `BarPackPanel`, `MenuCategoryManager`; POS labels via `formatMenuStockLabel` / `stock_label`.

---

## Competitive intel (eZee Absolute)

- Full external product map: [competitive/ezee-absolute-full-map.md](competitive/ezee-absolute-full-map.md)
- Desk hang-card (eZee → Pelbu clicks): [ops/fo-ezee-to-pelbu-hang-card.md](ops/fo-ezee-to-pelbu-hang-card.md)
- Local pay-at-end + agent room-cap UAT: [ops/fo-pay-at-end-and-room-cap-uat.md](ops/fo-pay-at-end-and-room-cap-uat.md)
- FO-parity pass 2026-08-10: header **Biz date**, StayHub soft multi-tab lock, rack context Folio/CI/CO, Ctrl+K folio search
- Beat eZee non-channel 2026-08-10: StayHub **bill split / extras folio / master** (Advanced); party **bulk CI + collect**; agent dossier → production/commission reports; **DB stay lease**; NA FO flash email; guest WA templates; CI **ID photo**; agent AR void; Wave A drills + Wave D trust docs. Channel still deferred.

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
| **Calendar v3+ leftover polish** | Party/rooming **shipped**; optional leftovers (overbooking buffer, stop-sell markers, VIP intel, full keyboard) — pull only when desk asks |
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

See also: [RELEASE-v1.md](RELEASE-v1.md) · [WHITEBOARD.md](WHITEBOARD.md) · [ERP-AUDIT.md](ERP-AUDIT.md) · [PLATFORM.md](PLATFORM.md) · [PLANS.md](PLANS.md) · [UAT-CHECKLIST.md](UAT-CHECKLIST.md) · [FO-AGENT-COMMERCE-CHECKLIST.md](FO-AGENT-COMMERCE-CHECKLIST.md) · [LAUNCH-CHECKLIST.md](LAUNCH-CHECKLIST.md) · [FINANCE-UAT.md](FINANCE-UAT.md) · [OPS-RUNBOOK.md](OPS-RUNBOOK.md) · [../AGENTS.md](../AGENTS.md)

---

## Front-desk stay money cycle (FO)

1. **Book / assign rates** — calendar (walk-in: room → create), Fast book modal, or public `/book`. Capture **`PS-…` confirmation** shown on save/pack. Phone later allowed. Manager-PIN agreed rate when special.
2. **StayHub** — rack walk-in lands **Check-in**; future holds use confirmation pack then StayHub when ready.
3. **Check-in** — business-date gate if needed; opens folio; day-1 room (+ meal if priced). Room-cap check for agent stays (override audited). Undo if folio still simple.
4. **In-house / Folio** — **Bill** (All · Room · **POS** — what guest ordered). F&B default **guest pays**; **Charge agent AR** or **Put F&B on agent tab** when agent asks. Room package often agent bill_to on credit.
5. **Collect** — cash/QR/bank = Collect payment; agent tender = **Charge agent AR** (agent book ↑, guest folio ↓).
6. **Invoice** — optional fiscal **INV-…** from folio (not auto). Stay conf **PS-…** for ops/search is separate.
7. **Checkout** — local: pay then leave. Agent: print/sign/upload guide evidence → leave → FO seal/email pack later.

Kitchen meal services from `/erp/kitchen` → POS feed.

