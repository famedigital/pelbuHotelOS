# HOTEL OS v2: THE DEFINITIVE MASTER SPECIFICATION & CURSOR COMPOSER BLUEPRINT
## From Micro/Cellular Primitives to Macro Sovereign Intelligence

> **Architecture:** Fastify (`v2/apps/api`), Vite SPA (`v2/apps/desk`), Drizzle ORM (`v2/packages/db`), Glacier Kit (`v2/packages/ui`)  
> **Visual Prestige:** Apple VisionOS Spatial Glass × Linear Keyboard Density × Bhutanese Sovereign Luxury  

---

## LAYER 0: CELLULAR & MICRO-LEVEL PRIMITIVES (THE ATOMIC FOUNDATION)

### 1. Typography & Numerics Engine
- **Prose & Headings:** `Plus Jakarta Sans` with geometric tracking (`letter-spacing: -0.011em`).
- **Numerics & Currencies:** `JetBrains Mono` with mandatory tabular alignment (`font-mono tabular-nums`).
- **Currency Cell Formatting:**
  - Currency symbol (`Nu.`, `$`, `₹`) rendered at 60% opacity.
  - Integer digits rendered in **900 Black weight**.
  - Cents (`.00`) rendered at dimmed **65% opacity** to eliminate visual clutter.
  - Delta micro-tags (`+Nu. 350 SC` or `−Nu. 1,200 Adv`) auto-colored in soft green/rose.

### 2. Photonic Status Indicators (`LedBeacon`)
Multi-layer breathing status indicators with solid pigment cores and radial diffusion halos:
- 🟢 **Emerald (Live Till / Clean Ready):** `rgba(16, 185, 129, 1)` with `rgba(16, 185, 129, 0.35)` breathing aura.
- 🔵 **Sapphire (In-House / Active Folio):** `rgba(37, 99, 235, 1)` with `rgba(37, 99, 235, 0.3)` aura.
- 🟡 **Himalayan Brass (Dirty Turnover / Pending Settle):** `rgba(245, 158, 11, 1)` aura.
- 🔴 **Ruby (Out of Order / Unpaid Checkout Block):** `rgba(239, 68, 68, 1)` sharp strobe.
- 🟣 **Violet (Guest Do Not Disturb / VIP Focus):** `rgba(139, 92, 246, 1)` aura.

### 3. Mechanical 3D Keycaps (`KeycapBadge`)
- Styled like an authentic mechanical keyboard switch (`⌘K`, `⌘B`, `⌘J`, `Esc`).
- Specular top rim light (`inset 0 1px 0 rgba(255, 255, 255, 0.6)` in light, `rgba(255, 255, 255, 0.15)` in dark).
- 1.5px drop shadow with tactile active depression: `transform: translateY(1px) scale(0.98)`.

### 4. Sensory Tactiles & Linear-Grade Keybindings
- **Sensory Audio Cues:**
  - Keycard encode click audio (`chk-tick`) on successful check-in.
  - Cash register mechanical click when till float drops or advances occur.
  - Himalayan singing bowl audit chime on successful night audit date advance.
- **Linear-Grade Keyboard Navigation:**
  - `J` / `K` to navigate up and down guest boarding passes.
  - `C` to trigger Keycard Encode Check-In; `O` to trigger Check-Out.
  - `X` to multi-select reservations for batch group actions.
  - `?` to toggle the Glass Keyboard Cheatsheet HUD.
  - `⌘Z` floating 5-second undo toast for accidental check-ins or room reassignments.

---

## LAYER 1: MOLECULAR COMPONENTS & DESKTOP 100VH ZERO-SCROLL COCKPIT

### 1. The Executive Flight Deck Header (`46px` Locked Height)
- Left Brand Crest: 28x28px gradient squircle with golden embossed crown icon (`👑`), hotel name, and `★★★★` gold stars.
- Center Search Pill: `280px` width, background `var(--hos-surface)`, ⌘K mechanical keycap.
- Right Status Array:
  - Calendar Chip: `📅 08 Nov · Shift 1`.
  - Cashier Till Float Chip: `🟢 Till: Nu. 48,250.00` with pulsing emerald dot.
  - Quick Print Studio button.
  - Primary Fast Book button: High-contrast gradient with ⌘B keycap.
  - Theme switch (Light / Midnight) and Staff PIN switcher pill.

### 2. Bento KPI Mission Ribbon (`74px` Locked Height)
5 Jewel-Toned Cards with interior atmospheric lighting and trend indicators:
1. **Occupancy Tonight:** Sapphire ambient light (`from-blue-500/[0.07]`), trend badge (`↑ 12.4%`), 24px bold odometer, and multi-segment progress bar.
2. **RevPAR & Yield:** Emerald ambient light (`from-emerald-500/[0.07]`), glowing radar dot, and `ADR Nu. 7,916 · 10% SC in`.
3. **Arrivals Flight:** Indigo ambient light (`from-indigo-500/[0.07]`), live unassigned warning badge (`⚠ 2 unassigned`).
4. **Departures Check:** Slate ambient light with breakdown for `Checked-Out` vs `Pending Settle`.
5. **Housekeeping Readiness:** Multi-badge status matrix with live colored dots for Clean, In-Progress, Dirty, and OOO.

### 3. Floor Map Quick Strip (`38px` Locked Height)
- Displays all rooms across Floor 1, 2, and 3 as tactile room chips color-coded by HK status. Clicking opens the StayHub or triggers quick room actions.

### 4. Dual-Pane Workstation (65% Worklist / 35% Radar)
- **Left Worklist (65%):**
  - Segment tab bar: `[Arrivals] [In-House] [Departures] [Tomorrow]`.
  - Filter bar with search input and `VIP ★` toggle.
  - **Luxury Boarding-Pass Cards (`.hos-boarding-pass`):**
    - State accent stripe: Indigo (`confirmed`), Emerald (`checked_in`), Slate (`checked_out`).
    - Dual-ring gradient initial avatars (`ring-2 ring-white/80 shadow-md`).
    - Nationality flag badges (`🇺🇸 USA`, `🇧🇹 BTN`, `🇩🇪 DEU`, `🇮🇳 IND`).
    - Monospace confirmation badge (`PS-2026-1402`), night counter (`4 Nights`), and meal plan tag (`MAP Plan`).
    - Airline-style settlement tag (`Nu. 0.00 Settled ✓` vs `Nu. 12,450 Pending Due`).
    - Tactile spring action buttons (`.hos-btn-spring`): `⚡ Check In (Keycard Encode)`, `Check Out`, and `StayHub Folio →`.
- **Right Operations Radar (35%):**
  - **VIP Radar in Residence:** Golden crown badges with **personalized guest stay preferences** (e.g. `★ Quiet Top Floor`, `★ Cordyceps Tea`, `★ Hot Stone Bath`).
  - **Tour Groups & Expeditions:** Shows tour agency MoU rosters, guide names (`Guide: Sangay Dorji`), and vehicle registrations (`Bus BP-1-A2041`).
  - **Front Desk Cashier Till:** Executive bank vault style with a live emerald beacon, live float tracking, and one-tap physical cash advance/drop triggers.

---

## LAYER 2: STUDIO EXPERIENCES & MASTER DRAWERS

### 1. FastBook Studio (`FastBookModal.tsx` · `⌘B`)
- Centered floating obsidian modal shell with specular border and 24px backdrop blur.
- Numeric steppers for **Rooms** (1–8), **Adults** (1–16), and **Children** (0–8) with Bhutanese child policy chip (`0–5 free · 6–11 50% meal`).
- Extra Rollaway Bed toggle switch (`+ Nu. 1,500/night`).
- Visual room category selection cards showing live vacant inventory counter (`X free`) and rack rates.
- Interactive Meal Plan pills (`EP`, `CP`, `MAP`, `AP`).
- Real-time DRC Form BST-3 Quotation Bento displaying Base Room Net, Meals & Extras, 10% Service Charge Tip Pool, 10% Bhutan BST, and Grand Total Due.
- Global keyboard bindings: `Cmd+Enter` / `Ctrl+Enter` to submit immediately; `Esc` to cancel.

### 2. StayHub Master Drawer (`StayHubDrawer.tsx`)
- Slide-over glass sheet with dual-stream selector (Master Folio for Tour Agency / Personal Folio for Guest Incidentals).
- **Night-by-Night Daily Rate & Meal Matrix:**
  - Independent editable row for every night of the stay (`N1 · 11-08`, `N2 · 11-09`).
  - Editable base nightly net rate, per-night meal plan pill selector, and extra bed toggle.
  - Live DRC tax calculation per night.
  - **"Copy N1 to all ↷"** bulk sync button.
  - Strict Dual-Folio checkout rule: Disallow checkout if personal balance > Nu. 0.50 even if master agency credit is pending.

---

## LAYER 3: DEDICATED MOBILE & TABLET EXPERIENCE FROM SCRATCH (<1024px)

1. **Floating Bottom Glass Dock (`MobileNav.tsx`):**
   - Fixed 58px bottom dock with safe-area padding.
   - 5 core destinations: Desk, Tape Chart, Housekeeping, POS, and More.
2. **Mobile StayView (`StayViewMobileView.tsx`):**
   - Replaces wide 30-day desktop table with a horizontal swipeable **Date Carousel** (`[Today 08] [Thu 09] [Fri 10]`) + vertical room cards list.
3. **Housekeeping "Hallway Mode" (`HousekeepingMobileView.tsx`):**
   - Large 2-column tactile room tiles with 1-tap `[Mark Clean]`, `[Mark Dirty]`, and `[Inspect]` buttons.
4. **Handheld Waiter POS (`PosMobileView.tsx`):**
   - Touch table grid, food & beverage category pills, quantity steppers, room charge posting, and full-width bottom "Fire KOT" button.
5. **Native Drawers (`vaul`):**
   - Open FastBook and StayHub as native iOS bottom drawers with top drag handles and swipe-to-dismiss gestures.

---

## LAYER 4: SOVEREIGN ONBOARDING WIZARD & FIRST-TIME STAFF TOUR

### 1. Sovereign Hotel Onboarding Wizard (`HotelOnboardingWizard.tsx`)
- Triggered on first-time login of a new hotel property.
- 5-step spatial glass modal wizard (800x620px) using `AnimatePresence mode="wait"` directional spring slides.
- **Step 1: Brand & Sovereign Identity:** Hotel Name, Dzongkhag selector (all 7 Bhutanese dzongkhags), 1–5 gold stars, TPN, Trade License.
- **Step 2: Inventory & Floors:** Total rooms stepper (4–120), floors stepper (1–8), nightly rack rate inputs.
- **Step 3: DRC Fiscal Rules:** 10% Service Charge tip pool toggle, 10% Bhutan Sales Tax toggle, starting cashier till float selector.
- **Step 4: Front Desk PIN & Shift:** GM/Cashier name, 4-digit Sovereign PIN, Shift 1 schedule.
- **Step 5: Grand Commissioning Celebration:** Celebratory crown badge, summary bento, Launch CTA.

### 2. Interactive First-Time Staff Guided Tour (`InteractiveStaffTour.tsx`)
- 7-step guided spotlight tour with darkened backdrop and floating glass guidance card (width 480px).
- Step 1: Executive Flight Deck Header.
- Step 2: Fast Book Studio (⌘B).
- Step 3: Bento KPI Mission Ribbon.
- Step 4: Floor Map Quick Strip.
- Step 5: Luxury Boarding-Pass Worklist.
- Step 6: Operations Radar & Till Vault.
- Step 7: Command Palette & Voice Dispatcher (⌘K / ⌘J).
- Automatic sequencing: Completing the Hotel Onboarding Wizard automatically launches the Staff Guided Tour.

---

## LAYER 5: SOVEREIGN AUTOMATION & REGULATORY INTELLIGENCE

1. **Intelligent Tetris Room Auto-Assigner:**
   - Group Clustering: Allocates all members of a Tour Operator group (*Yangphel*, *Druk Asia*) onto adjacent rooms on the same floor.
   - VIP Elevation: Automatically places VIP guests on the top floor (Floor 3).
   - Gap Minimization: Prevents unsellable 1-night orphaned slots between bookings.
2. **Autonomous 1-Click Night Audit Engine:**
   - Pre-flight check validates no open KOTs exist and warns if unassigned arrivals remain.
   - Atomically posts nightly room rate + 10% Service Charge + 10% BST to active guest folios.
   - Accrues daily tip-pool points based on active biometric attendance punches.
   - Advances `businessDate` to tomorrow (`YYYY-MM-DD + 1`).
3. **Natural Language Action Dispatcher (`⌘J`):**
   - Instant voice/text bar parsing: *"Extend Karma in 204 by 2 nights MAP"*, *"Assign Yangphel to Floor 2"*, *"Post laundry 450 to rm 102"*.
4. **Mountain Power/Fiber Offline-Resilient Transaction Buffer:**
   - Uses `IndexedDB` to queue mutations during internet outages; auto-syncs with idempotent UUIDs upon reconnection.
5. **Bhutan DRC Form BST-3 & Police Tourist Manifest Exporter:**
   - One-tap export of official DRC Form BST-3 tax returns and Royal Bhutan Police (RBP) daily immigration tourist manifests.

---

## VERIFICATION REQUIREMENTS
1. Run `cd v2 && pnpm --filter @hos-v2/desk typecheck` (Must pass with 0 errors).
2. Run `cd v2 && pnpm --filter @hos-v2/desk build` (Must build production bundles cleanly).
3. Test desktop 100vh zero-scroll layout (1920x1080) and mobile touch layout (390x844).
