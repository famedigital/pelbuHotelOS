# Pelbu Suites — UAT checklist (go-live)

Use before cutting over from Excel. Desk PIN: `DESK_PIN`. Property slug: `pelbu-suites-olakha`.

## Public site
- [ ] Home / rooms / dine / spa / meeting / FAQ / Olakha guide / agents / contact load at 375px and 1440px
- [ ] Only the homepage has a cinematic hero; task routes open directly on their engine
- [ ] `/rates` shows public rack rates only without login; Inc./Excl. GST+SC badge matches Settings
- [ ] `/rates` partner section requires email + WhatsApp; agent/MoU amounts appear only after gate; row lands in `rate_card_access_log`
- [ ] Book dates/nights, room, and meal plan produce the correct live quote
- [ ] Book request creates a live `held` booking with the configured hold expiry
- [ ] Cafe/restaurant order creates KOT ticket on `/erp`
- [ ] Order search/category filters, mobile cart, pickup, and Thimphu taxi fields work
- [ ] Order totals are recomputed from live DB prices; altered client totals are ignored
- [ ] Spa and meeting choices come from active `service_offerings`
- [ ] Spa/meeting request respects offering capacity and creates a pending request
- [ ] Menu images + room blurbs resolve (Cloudinary)
- [ ] Public PWA installs; offline fallback loads; footer nav does not overlap cart/actions
- [ ] `/sitemap.xml`, `/robots.txt`, `/llms.txt`, FAQ/room/restaurant JSON-LD validate

## Desk — rooms
- [ ] `/erp/fast-book` overbooking guard (qty vs overlapping confirmed/checked_in)
- [ ] Guide number required for **international** `guest_origin` only; regional/official/local can skip
- [ ] Check-in assigns guest + guide/driver beds; partner pickers link master rows
- [ ] Check-in **Room allocation** shows physical units + HK readiness; blocks dirty/OOO guest rooms unless override
- [ ] Multi-guest rooming list maps each guest to an assigned room; guide/driver occupants saved
- [ ] Arrivals board: Check in CTA + badges (rooms / HK / guide / SDF / deposit / credit)
- [ ] Checkout shows folio balance + rooms; vacated units become `dirty` for HK
- [ ] Day sheet prints room numbers, occupants, guide/driver, payment, arrival blockers
- [ ] Cancel / no-show frees inventory (`room_assignments`); ARI queued if channel mapped
- [ ] `/erp/rooms` HK status toggles (active property, live refresh)
- [ ] `/erp/settings` Rooms tab: add category + rename unit labels

## Desk — calendar (`/erp/calendar`)
- [ ] Full-bleed rack: scroll rooms + dates; sticky room column + day header
- [ ] Drag-select multi-room × multi-night (e.g. rooms 4–6 × Aug 2–4) opens reservation modal
- [ ] Single-row selection → one booking; multi-row → group + children
- [ ] Mixed category selection shows badges + requires acknowledgement
- [ ] Occupied / blocked cells refuse selection with clear conflict
- [ ] HoverCard on stay bar; click opens edit modal (save details, resize dates, split, lock)
- [ ] Same-type drag-move + 60s undo; cross-type move prompts Continue / Override
- [ ] Unassigned pool → click compatible empty cell to assign
- [ ] Room label click → create OOO/OOS/hold block; release from UI
- [ ] Search guest/phone/guide → scroll + flash; Arrivals / In-house / Departures filters
- [ ] Monthly occupancy cards + Today rooms update; Live badge refreshes on change
- [ ] Day sheet print: `/erp/calendar/day-sheet`

## Desk — StayHub walk-in FO (2026-08-06)
- [ ] Click free room for **today** → create with **guest name only** + **Phone later** (phone blank) → saves without multi-second freeze
- [ ] After single-room create, StayHub opens on **Check-in** with room # visible
- [ ] Sticky footer shows **Confirm check-in** (no need to scroll the long form)
- [ ] Guest docs start with **1** row when adults=1; change adults on Reserve → docs rows match
- [ ] From Check-in step: **No-show** and **Cancel booking** without going back to Reserve
- [ ] Accidental check-in: **Undo check-in** returns status to **confirmed**, room still assigned (simple folio only)
- [ ] Undo blocked with clear message when payments or laundry/F&B (non day-1) charges exist
- [ ] Typing guest name/phone in StayHub auto-saves without remounting the whole calendar rack

## Desk — shell / settings
- [ ] Sidebar groups navigate; property switcher changes active hotel
- [ ] Mobile footer tabs: Calendar / Book / Stay / POS / More; no top hamburger
- [ ] More sheet reaches every ERP module and sign-out
- [ ] Legacy wide tables scroll with a sticky first column on mobile
- [ ] `/erp/settings` identity + logo, GST/service defaults, document presets + preview

## Desk — money
- [ ] POS order → KOT board live refresh
- [ ] Post order / guest service to folio
- [ ] Folio payment (cash/bank/QR/Pay.bt/credit)
- [ ] Void charge line with reason (audit_events)
- [ ] Comp credit with reason
- [ ] Deposit link `/pay/{token}` + mark paid
- [ ] Night audit one run per business date
- [ ] `/erp/finance` expense + bank JSON import + match
- [ ] Reports CSV export (payments / expenses / folio lines)
- [ ] Finance workspace: Overview KPIs, Income, Expenses, Banking, Accounting journals
- [ ] Opening balances draft → approve & post
- [ ] Period close checklist → lock period
- [ ] Expenses workbench: spreadsheet edit, camera/upload receipt, Save & post
- [ ] Receipt PDF import → staged review → commit (GST not invented from TPN)
- [ ] Banking PDF import with approved parser → commit → unmatched queue
- [ ] Settings → Finance imports: upload/test/approve parser; Gemini status without key
- [ ] Finance Excel exports: P&L, trial balance, balance sheet, GST, month-end pack
- [ ] Manual journal posts and appears on trial balance

## Agents
- [ ] Apply → approve → issue agent code/PIN → `/agents/login`
- [ ] Agent lands on `/agents/app` with Book / Calendar / Account footer tabs
- [ ] Agent sees only own bookings plus anonymous room availability
- [ ] Agent booking uses own `agent_id` and rate tier; desk confirms credit
- [ ] Invalid, disabled, pending, or suspended agent cannot open the app
- [ ] Legacy portal token still works during migration
- [ ] Credit limit blocks over-limit on-credit book
- [ ] Agent voucher has **no** rates

## Channel (staging only)
- [ ] Map sellable room types to Channex IDs
- [ ] Set `CHANNEX_API_KEY` + external property id
- [ ] Queue 90d ARI → flush in staging
- [ ] Pull booking feed → ack after import

## Desk — Sales & Marketing (`/erp/marketing`)
- [ ] Coupons: create TIKTOK50 (e.g. 50% · max 100 · channels include `public_book` + `desk_folio`) → list shows redeemed/max, ends, channels
- [ ] Coupon row Edit prefills form; Deactivate/Activate updates `active`
- [ ] Campaign: create → edit status (active/paused/ended) + budget; coupon can link to campaign; Meta post URL / IG handle save
- [ ] Public book: apply TIKTOK50 at checkout → redemption appears on dashboard / ROI
- [ ] Fast Book: optional promo code field redeems on `desk_folio` / rooms (coupon must allow that channel)
- [ ] **Desk promo reprice:** after Fast Book with room promo, booking has `promo_discount_pct` (fixed_btn → amortized %); check-in day-1 room night line shows promo note and reduced rate; meal plan post inherits same %
- [ ] Fixed Nu coupon (e.g. Nu 500 off stay) still sets non-null `promo_discount_pct` so nightly posts discount (not quote-only)
- [ ] POS: promo + line NC with manager PIN still works
- [ ] NC policies: edit reason + deactivate; room domain reasons available
- [ ] StayHub (Reserve or Stay/Money with assigned room): Mark room NC + reason + manager PIN → ledger list value > 0 when rates exist; Clear NC restores chargeable
- [ ] Catalogues: create/publish → open `/c/{slug}`; edit title/status; archive; social pack open increments download count
- [ ] **Contacts:** create influencer contact with email + tags → search/edit; optional campaign + agent link
- [ ] **Email:** owner/GM only; select ≤50 contacts (or tag filter) → send; rows in send log; missing `RESEND_API_KEY` shows clear error
- [ ] **Share / Meta:** compose caption → Facebook sharer opens; copy IG caption works; Graph post button only when tokens set (else honest copy, no dead tab)
- [ ] Minibar folio form: optional promo code redeems on `desk_folio` / pos
- [ ] Laundry confirm: inherits stay promo %; optional promo code field on staff board
- [ ] Guest service: Spa kind posts with spa promo domain
- [ ] ROI tab: 30/90/180d totals for promo discount burn + NC list value; campaign vs budget; Export CSV

## Sign-off
| Role | Name | Date |
|------|------|------|
| Owner | | |
| Front desk | | |
| F&B | | |
