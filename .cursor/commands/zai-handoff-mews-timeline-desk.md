# Handoff brief for z.ai — Round 2: Mews Timeline + hamburger Sheet nav

**Do this only after Round 1 is reviewed.**  
Paste into a **new chat** with model **`GLM-5.2`**.  
Attach `@AGENTS.md` and `@.cursor/rules/zai-implementer.mdc`.  
Optional: `@docs/PLATFORM.md` (UX north stars · ERP chrome), `@design/erp-mews/refs/mews-timeline-ops.png`.  
Branch: `zai/mews-timeline-desk` (from branch that has Round 1 merged, or `main`).

You are the **implementer**. Do **not** rewrite this brief. **Do not ask clarifying questions.** Use **Locked defaults**. **Edit allowed files only.**

## Important
- Kit = **Tailwind + shadcn** — **not** Mews design system, **not** shadcn `Sidebar`
- Desk nav = Mews pattern: **hamburger → left `Sheet`** (grouped links)
- Visual ditto target: `design/erp-mews/refs/mews-timeline-ops.png`
- Do not invent schema, RLS, env, or new money/booking server actions

## Task

### 1) Research note
- `design/erp-mews/README.md` — Timeline ditto checklist + upgrade notes (from screenshot + PLATFORM.md)

### 2) Replace `DeskHeader` link farm
Kill the ~25-link `flex-wrap` strip in `DeskHeader.tsx`.

**Mews top bar:**
- Left: Pelbu mark + hamburger → **`Sheet` side=left`** with grouped nav
- Center: wide search input (UI only OK if no search API — placeholder “Search within Pelbu Suites…”)
- Right: logout / settings affordance (keep existing `deskLogout` wiring)

**Sheet groups (links only — same routes as today):**
- Front desk: `/erp/calendar` (label Timeline), `/erp`, `/erp/arrivals`, `/erp/check-in`, `/erp/fast-book`
- Money: `/erp/pos`, `/erp/invoices`, `/erp/payments`, `/erp/finance`, `/erp/gst`, `/erp/night-audit`
- Guests & trade: `/erp/guests`, `/erp/reservations`, `/erp/agents`, `/erp/partners`
- Property: `/erp/rooms`, `/erp/housekeeping`, `/erp/maintenance`, `/erp/inventory`, `/erp/allotments`
- Insights: `/erp/reports`, `/erp/channel`, `/erp/hr`
- Admin: `/erp/group`, `/erp/properties/new`

Active route: Bubblegum underline/bg. Mobile: same Sheet (no wrap row).

### 3) Timeline on `/erp/calendar`
Replace occupancy strip with **Mews-like grid**:
- Y-axis: room units grouped by room type; status dot (green clean / red dirty|occupied from `hk_status`)
- X-axis: day columns (~7–14 days); **today** column tint `#f7e1f7`
- Blocks: white rounded bars for bookings spanning nights (guest name); grey style for OOO if status available
- Toolbar: Today · prev/next · date label (client state OK)
- Click **empty cell** → open existing Fast book UI in a `Sheet` (reuse `FastBookDrawer` / form patterns — **same `createFastBooking` fields**; do not invent actions)
- Click **booking block** → **Smart Detail** panel:
  - Desktop: right pane; Mobile: bottom `Sheet`
  - Show guest name, dates, status badge, links to check-in / folio if ids exist
  - Primary button style **black** (Check in / Open folio) — pink only for active tab/today
  - “Smart tip” card: static placeholder text OK (no AI)

Page may stay a server component that loads units/bookings; put interactive grid in a client child.

### 4) Tokens
Ensure `.erp` uses Pelbu-pink accent `#ff83da`, white/grey canvas, black primary actions — align with Round 1 `globals.css` if already present.

## Locked defaults
- Default desk home link target for logo: `/erp/calendar`
- No drag-and-drop room moves (v2 later)
- No Realtime invent — keep existing patterns if already on page; don’t block on new Realtime
- PropertySwitcher stays if already in header
- Do not hardcode rates/menus

## Allowed files
- `design/erp-mews/README.md` (new)
- `web/src/components/erp/DeskHeader.tsx`
- `web/src/components/erp/DeskNavSheet.tsx` (new)
- `web/src/components/erp/DeskTopBar.tsx` (new if split)
- `web/src/components/erp/TimelineGrid.tsx` (new)
- `web/src/components/erp/TimelineSmartDetail.tsx` (new)
- `web/src/components/erp/FastBookDrawer.tsx` (wire open from Timeline only — no contract change)
- `web/src/components/erp/FastBookForm.tsx` (layout polish only if needed for Sheet)
- `web/src/app/erp/calendar/page.tsx`
- `web/src/app/globals.css` (`.erp` tokens only if Round 1 missed)
- `web/src/components/ui/**` (Sheet/Badge/Tabs/Avatar/ScrollArea only as needed)
- Optional: redirect `/erp` logo home only via DeskHeader links — do **not** change login/auth

## Do not touch
- `web/src/app/actions/**` (except zero edits — reuse imports only)
- `supabase/**`, middleware, `.env*`
- Finance / channel / HR / inventory **page logic** (nav links only)
- Public site / Round 1 marketing files (unless fixing a conflict)
- Do not add shadcn `Sidebar` component

## Contracts
- Fast book: same fields as today (`check_in`, `check_out`, `adults`, `qty_*`, contact, agent, guide, source, payment_mode, notes)
- Calendar data: keep loading `room_units` + `bookings` from Supabase as the page already does (adjust select fields only if needed for labels/status)

## Acceptance
- [ ] `npm run build` in `web/` passes
- [ ] No long wrap link strip on desk pages
- [ ] Hamburger opens grouped Sheet; Timeline shows room×day grid with pink today
- [ ] Empty cell → Fast book Sheet; block → Smart Detail
- [ ] Fast book still saves via existing action
- [ ] Reply: files changed + how to test `/erp/calendar` and nav Sheet

## Done means
Cursor reviews the diff; you do not merge unless asked. **Start implementing now.**
